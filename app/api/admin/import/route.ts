import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/require-admin";
import { denetimYaz } from "@/lib/audit";
import {
  JikanError,
  getAnimeById,
  getAnimeEpisodes,
  makePlaceholderEpisodes,
  toAnimeRow,
  toEpisodeRows,
} from "@/lib/anime-api";
import { slugify } from "@/lib/anime-api";

export const runtime = "nodejs";
export const maxDuration = 60; // bölüm sayfalama uzun sürebilir

/**
 * POST /api/admin/import  { malId: number }
 * Jikan'dan animeyi + bölümlerini çeker, Supabase'e upsert eder.
 * Middleware zaten /admin'i korur; burada API için ikinci kez doğrularız.
 */
export async function POST(request: Request) {
  // Middleware'e ek ikinci savunma hattı
  const red = await requireAdmin();
  if (red) return red;

  const supabase = await createClient();

  // --- Girdi ---
  const body = (await request.json().catch(() => null)) as {
    malId?: unknown;
  } | null;
  const malId = Number(body?.malId);

  if (!Number.isInteger(malId) || malId <= 0) {
    return NextResponse.json(
      { error: "Geçerli bir MyAnimeList ID'si gerekli" },
      { status: 400 },
    );
  }

  try {
    // --- 1) Anime kaydı ---
    const jikanAnime = await getAnimeById(malId);
    const animeRow = toAnimeRow(jikanAnime);

    const { data: anime, error: animeErr } = await supabase
      .from("animes")
      .upsert(animeRow, { onConflict: "mal_id" })
      .select("id, slug, title")
      .single();

    if (animeErr) throw new Error(`Anime kaydedilemedi: ${animeErr.message}`);

    // --- 2) Türler ---
    if (jikanAnime.genres.length > 0) {
      const { data: genres } = await supabase
        .from("genres")
        .upsert(
          jikanAnime.genres.map((g) => ({
            mal_id: g.mal_id,
            name: g.name,
            slug: slugify(g.name),
          })),
          { onConflict: "mal_id" },
        )
        .select("id");

      if (genres?.length) {
        await supabase.from("anime_genres").upsert(
          genres.map((g) => ({ anime_id: anime.id, genre_id: g.id })),
          { onConflict: "anime_id,genre_id" },
        );
      }
    }

    // --- 3) Bölümler ---
    // Jikan'ın bölüm ucu sık sık 504 veriyor. Bu, zaten kaydedilmiş
    // anime kaydını çöpe atmamalı: bölüm çekimi başarısız olursa
    // aktarım "kısmi başarı" olarak tamamlanır, kullanıcı uyarılır ve
    // bölümler sonradan tekrar aktarılabilir.
    let episodeCount = 0;
    let episodeWarning: string | null = null;

    // Mevcut bölümler: elle girilmiş video alanlarını korumak için
    // tekrar aktarımda bunları geri yazarız.
    const { data: existing } = await supabase
      .from("episodes")
      .select("number, video_url, mux_playback_id, source, is_published")
      .eq("anime_id", anime.id);

    const byNumber = new Map(
      (existing ?? []).map((e) => [e.number as number, e]),
    );

    /** Jikan verisini mevcut video alanlarıyla birleştirir. */
    const merge = (rows: ReturnType<typeof toEpisodeRows>) =>
      rows.map((r) => {
        const prev = byNumber.get(r.number);
        // Anahtar kümesi her satırda AYNI olmalı — PostgREST toplu eklemede
        // farklı anahtarlı nesneleri reddediyor ("All object keys must match").
        // Bu yüzden prev olmasa da tüm alanları yazıyoruz.
        return {
          ...r,
          // Elle girilen video bilgisi asla ezilmez
          source: prev?.source ?? r.source,
          video_url: prev?.video_url ?? null,
          mux_playback_id: prev?.mux_playback_id ?? null,
          is_published: prev?.is_published ?? r.is_published,
          // title / air_date Jikan'dan tazelenir
        };
      });

    const saveEpisodes = async (rows: ReturnType<typeof toEpisodeRows>) => {
      if (rows.length === 0) return 0;
      const { error } = await supabase
        .from("episodes")
        .upsert(merge(rows), { onConflict: "anime_id,number" });

      if (error) {
        // Tam Postgres hatasını loga bas: RLS ihlali mi, kısıt ihlali mi,
        // sütun uyuşmazlığı mı — mesajdan anlaşılsın.
        console.error(`[import] MAL #${malId} bölüm yazımı başarısız:`, {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
          ornekSatir: merge(rows)[0],
        });
        throw new Error(
          `Bölümler kaydedilemedi (${error.code ?? "?"}): ${error.message}`,
        );
      }
      return rows.length;
    };

    try {
      const jikanEpisodes = await getAnimeEpisodes(malId);

      // Jikan 200 döndüğü hâlde boş liste verirse yazma sessizce 0 kalır;
      // bu durumu yer tutucu üretimiyle aynı yola sokalım.
      if (jikanEpisodes.length === 0) {
        throw new JikanError("Bölüm listesi boş döndü", 204, `/anime/${malId}/episodes`);
      }

      console.log(
        `[import] MAL #${malId}: Jikan ${jikanEpisodes.length} bölüm verdi`,
      );
      episodeCount = await saveEpisodes(toEpisodeRows(anime.id, jikanEpisodes));
      console.log(`[import] MAL #${malId}: ${episodeCount} bölüm yazıldı`);
    } catch (epErr) {
      // Jikan bölüm listesi alınamadı. Bölüm sayısı biliniyorsa yer
      // tutucu satırlar üret ki seri "0 bölüm" kalmasın.
      const total = animeRow.total_episodes;
      console.warn(
        `[import] MAL #${malId}: bölüm çekimi başarısız ` +
          `(${epErr instanceof JikanError ? `Jikan ${epErr.status}` : String(epErr)}), ` +
          `total_episodes=${total} -> ${total > 0 ? "yer tutucu üretilecek" : "yer tutucu YOK"}`,
      );

      if (epErr instanceof JikanError && total > 0) {
        try {
          episodeCount = await saveEpisodes(
            makePlaceholderEpisodes(anime.id, total),
          );
          episodeWarning =
            `Jikan bölüm listesi alınamadı (${epErr.status}). ` +
            `${total} yer tutucu bölüm oluşturuldu — video URL'lerini şimdi girebilirsiniz. ` +
            `Aynı ID ile tekrar aktarım, girdiğiniz videoları koruyarak gerçek başlıkları doldurur.`;
        } catch (phErr) {
          episodeWarning =
            phErr instanceof Error ? phErr.message : "Bölümler oluşturulamadı.";
        }
      } else {
        episodeWarning =
          epErr instanceof JikanError
            ? `Bölüm listesi Jikan'dan alınamadı (${epErr.status}) ve bölüm sayısı bilinmiyor.`
            : `Bölümler kaydedilemedi: ${
                epErr instanceof Error ? epErr.message : "bilinmeyen hata"
              }`;
      }
    }

    // --- 4) Denetim günlüğü + önbellek ---
    await denetimYaz("anime_import", {
      mal_id: malId,
      title: anime.title,
      episodes: episodeCount,
    });

    revalidatePath("/");
    revalidatePath(`/anime/${anime.slug}`);
    revalidatePath("/admin");

    return NextResponse.json({
      ok: true,
      anime: { id: anime.id, slug: anime.slug, title: anime.title },
      episodeCount,
      warning: episodeWarning,
    });
  } catch (err) {
    // Teşhis edilebilirlik: hatanın tamamı sunucu loguna düşsün.
    console.error(`[import] MAL #${malId} başarısız:`, err);

    if (err instanceof JikanError) {
      if (err.status === 404) {
        return NextResponse.json(
          { error: `MAL ID ${malId} bulunamadı.` },
          { status: 404 },
        );
      }
      // Jikan/MyAnimeList kaynaklı arıza bizim sunucu hatamız değil.
      // 502 döneriz ki arayüz "tekrar denenebilir" olduğunu bilsin.
      return NextResponse.json(
        {
          error: `Jikan bu animeyi veremedi (${err.status}). MyAnimeList geçici olarak yanıt vermiyor — sonra tekrar deneyin.`,
          retryable: true,
        },
        { status: 502 },
      );
    }

    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
