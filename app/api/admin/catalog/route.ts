import { NextResponse } from "next/server";
import { getSeasonNow, getTopAnime } from "@/lib/anime-api";
import { requireAdmin } from "@/lib/require-admin";

/**
 * GET /api/admin/catalog?source=top|season
 *
 * Toplu aktarma için aday listesi döner. Jikan'ın arama ucu (`?q=`)
 * kesintide olsa bile bu path tabanlı uçlar çalışıyor.
 */
export async function GET(request: Request) {
  const red = await requireAdmin();
  if (red) return red;

  const source = new URL(request.url).searchParams.get("source") ?? "top";

  try {
    const raw =
      source === "season" ? await getSeasonNow(25) : await getTopAnime(25);

    // Jikan aynı seriyi birden çok kayıtla döndürebiliyor (bölünmüş kur'lar).
    // Tekilleştirilmezse kuyrukta çift satır oluşur ve aynı anime iki kez
    // aktarılır.
    const seen = new Set<number>();
    const list = raw.filter((a) => !seen.has(a.mal_id) && seen.add(a.mal_id));

    return NextResponse.json({
      items: list.map((a) => ({
        mal_id: a.mal_id,
        title: a.title_english || a.title,
        year: a.year,
        episodes: a.episodes,
        image: a.images.webp?.image_url ?? a.images.jpg.image_url,
      })),
    });
  } catch {
    return NextResponse.json(
      { items: [], error: "Jikan listesi alınamadı." },
      { status: 502 },
    );
  }
}
