/**
 * ============================================================
 *  lib/queries.ts — Sunucu tarafı veri erişim katmanı
 *
 *  Sayfalar doğrudan Supabase'i değil bu dosyayı çağırır.
 *  Böylece Supabase yapılandırılmadığında (demo mod) aynı
 *  fonksiyonlar Jikan'dan canlı veri döndürebilir.
 * ============================================================
 */

import "server-only";
import { unstable_cache } from "next/cache";
import { createPublicClient } from "./supabase/public-client";
import {
  getSeasonNow,
  getTopAnime,
  getAnimeById,
  malIdFromSlug,
  toAnimeRow,
} from "./anime-api";
import { createClient } from "./supabase/server";
import { isSupabaseConfigured } from "./supabase/config";
import type {
  Anime,
  AnimeCharacter,
  AnimeStatus,
  AnimeWithEpisodes,
  Episode,
  JikanAnime,
} from "./types";

/** Jikan kaydını, UI'ın beklediği `Anime` şekline büründürür (demo mod). */
function jikanToAnime(a: JikanAnime): Anime {
  const row = toAnimeRow(a);
  return {
    ...row,
    id: `jikan-${a.mal_id}`,
    is_published: true,
    is_featured: false,
    view_count: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    // Demo modda seri bağı yok — sezon sekmeleri gösterilmez
    series_id: null,
    season_number: null,
    season_label: null,
  };
}

/**
 * Jikan `/seasons/now` aynı seriyi birden çok kayıtla döndürebiliyor
 * (ör. bölünmüş kur'lar). Aynı id iki kez render edilirse React
 * "duplicate key" uyarısı verir ve carousel'de içerik tekrar eder.
 */
function dedupe(list: Anime[]): Anime[] {
  const seen = new Set<string>();
  return list.filter((a) => !seen.has(a.id) && seen.add(a.id));
}

const ANIME_COLUMNS =
  "id,mal_id,slug,title,title_english,title_japanese,synopsis,synopsis_tr,poster_url,banner_url,trailer_url,type,status,season,year,total_episodes,duration_min,score,rating,studios,is_published,is_featured,view_count,meta_title,meta_description,og_image_url,synced_at,created_at,updated_at,series_id,season_number,season_label";

export interface Row {
  title: string;
  items: Anime[];
}

// ============================================================
//  Sayfalama
//  2.169 anime tek sayfada basılınca kategori sayfası 7 MB'a
//  çıkıyor ve 5 saniye sürüyordu. Izgara sayfaları artık
//  sunucu tarafında sayfalanıyor.
// ============================================================

export const SAYFA_BOYUTU = 36;

export interface Sayfali<T> {
  items: T[];
  total: number;
  page: number;
  totalPages: number;
}

/** 1'den küçük ya da sayı olmayan girdileri 1'e sabitler. */
export function sayfaNo(raw: string | undefined): number {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : 1;
}

function sayfali<T>(
  items: T[],
  total: number,
  page: number,
): Sayfali<T> {
  return {
    items,
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / SAYFA_BOYUTU)),
  };
}

export type SiralamaKey = "puan" | "yeni" | "populer" | "ad";

export interface KesfetFiltre {
  tur?: string; // TV, Movie, OVA, ONA, Special
  yil?: string;
  durum?: AnimeStatus;
  sirala?: SiralamaKey;
}

/**
 * Filtre çubuğunun seçenekleri (tür ve yıl listesi).
 *
 * Bu veri kullanıcıdan bağımsız ve neredeyse hiç değişmiyor, ama her
 * /kesfet açılışında binlerce satır taranıyordu. Artık çerez okumayan
 * bir istemciyle çekilip 24 saat önbelleğe alınıyor.
 *
 * Ayrıca sayfalama şart: PostgREST tek istekte 1000 satırda kesiyor,
 * eski `.limit(5000)` yüzünden yıl listesi eksik geliyordu.
 */
export const getFiltreSecenekleri = unstable_cache(
  async (): Promise<{ turler: string[]; yillar: number[] }> => {
    if (!isSupabaseConfigured) return { turler: [], yillar: [] };

    const supabase = createPublicClient();
    const turler = new Set<string>();
    const yillar = new Set<number>();
    const ADIM = 1000;

    for (let from = 0; from < 100_000; from += ADIM) {
      const { data, error } = await supabase
        .from("animes")
        .select("type,year")
        .eq("is_published", true)
        .order("id")
        .range(from, from + ADIM - 1);

      if (error || !data?.length) break;

      for (const r of data as { type: string | null; year: number | null }[]) {
        if (r.type) turler.add(r.type);
        if (r.year) yillar.add(r.year);
      }

      if (data.length < ADIM) break;
    }

    return {
      turler: [...turler].sort(),
      yillar: [...yillar].sort((a, b) => b - a),
    };
  },
  ["filtre-secenekleri"],
  { revalidate: 86400, tags: ["filtre-secenekleri"] },
);

/** Keşfet sayfası: filtrelenebilir, sıralanabilir, sayfalı liste. */
export async function getDiscoverAnimes(
  page = 1,
  filtre: KesfetFiltre = {},
): Promise<Sayfali<Anime>> {
  if (!isSupabaseConfigured) return sayfali([], 0, page);

  const supabase = await createClient();
  const from = (page - 1) * SAYFA_BOYUTU;

  let q = supabase
    .from("animes")
    .select(ANIME_COLUMNS, { count: "exact" })
    .eq("is_published", true);

  if (filtre.tur) q = q.eq("type", filtre.tur);
  if (filtre.durum) q = q.eq("status", filtre.durum);
  if (filtre.yil) {
    const y = Number(filtre.yil);
    if (Number.isInteger(y)) q = q.eq("year", y);
  }

  switch (filtre.sirala) {
    case "yeni":
      q = q.order("year", { ascending: false, nullsFirst: false });
      break;
    case "populer":
      q = q.order("view_count", { ascending: false });
      break;
    case "ad":
      q = q.order("title", { ascending: true });
      break;
    default:
      q = q.order("score", { ascending: false, nullsFirst: false });
  }

  // İkincil anahtar: eşit değerlerde sıra kararlı kalsın, sayfalar kaymasın
  const { data, count } = await q
    .order("id")
    .range(from, from + SAYFA_BOYUTU - 1);

  return sayfali((data ?? []) as Anime[], count ?? 0, page);
}

/** Hero'da dönen bir slayt. */
export interface HeroSlayt {
  anime: Anime;
  /**
   * Gerçek bir banner görseli mi, yoksa afişe mi düşüldü?
   * Afiş dikey (≈0.7:1) olduğu için geniş hero'ya yayılamaz —
   * arayüz bu durumda farklı bir yerleşim kullanır.
   */
  gercekBanner: boolean;
}

/**
 * Anasayfa hero'su: öne çıkarılmış animeler, yoksa en yüksek puanlılar.
 * Birden fazla döner çünkü hero otomatik olarak sırayla geçiyor.
 */
export async function getFeaturedAnimes(limit = 8): Promise<HeroSlayt[]> {
  if (!isSupabaseConfigured) {
    const top = await getTopAnime(limit).catch(() => []);
    return top.map((a) => {
      const anime = jikanToAnime(a);
      return {
        anime,
        gercekBanner: !!anime.banner_url && anime.banner_url !== anime.poster_url,
      };
    });
  }

  const supabase = await createClient();

  // Önce elle öne çıkarılanlar
  const { data: featured } = await supabase
    .from("animes")
    .select(ANIME_COLUMNS)
    .eq("is_published", true)
    .eq("is_featured", true)
    .order("score", { ascending: false, nullsFirst: false })
    .limit(limit);

  let liste = (featured ?? []) as Anime[];

  // Hiç işaretlenmemişse en yüksek puanlılara düş
  if (liste.length === 0) {
    const { data } = await supabase
      .from("animes")
      .select(ANIME_COLUMNS)
      .eq("is_published", true)
      .order("score", { ascending: false, nullsFirst: false })
      .limit(limit);
    liste = (data ?? []) as Anime[];
  }

  return dedupe(liste).map((anime) => ({
    anime,
    gercekBanner: !!anime.banner_url && anime.banner_url !== anime.poster_url,
  }));
}

/** Anasayfadaki yatay carousel satırları. */
export async function getHomeRows(): Promise<Row[]> {
  if (!isSupabaseConfigured) {
    const [top, season] = await Promise.all([
      getTopAnime(18).catch(() => []),
      getSeasonNow(18).catch(() => []),
    ]);
    return [
      { title: "Şu An Yayında", items: dedupe(season.map(jikanToAnime)) },
      { title: "En Popüler", items: dedupe(top.map(jikanToAnime)) },
      {
        title: "Yeniden Keşfet",
        items: dedupe([...top].reverse().map(jikanToAnime)),
      },
    ].filter((r) => r.items.length > 0);
  }

  const supabase = await createClient();
  const base = () =>
    supabase.from("animes").select(ANIME_COLUMNS).eq("is_published", true);

  const [airing, popular, recent] = await Promise.all([
    base().eq("status", "airing").order("score", { ascending: false, nullsFirst: false }).limit(18),
    base().order("view_count", { ascending: false }).limit(18),
    base().order("created_at", { ascending: false }).limit(18),
  ]);

  return [
    { title: "Şu An Yayında", items: (airing.data ?? []) as Anime[] },
    { title: "En Popüler", items: (popular.data ?? []) as Anime[] },
    { title: "Yeni Eklenenler", items: (recent.data ?? []) as Anime[] },
  ].filter((r) => r.items.length > 0);
}

/** Detay sayfası: anime + bölümleri + türleri. */
export async function getAnimeBySlug(
  slug: string,
): Promise<AnimeWithEpisodes | null> {
  if (!isSupabaseConfigured) {
    // Demo modda slug'ın sonundaki mal_id'yi kullanırız
    const malId = malIdFromSlug(slug);
    if (malId === null) return null;

    try {
      const a = await getAnimeById(malId);
      const anime = jikanToAnime(a);
      const count = Math.min(anime.total_episodes || 12, 24);
      const episodes: Episode[] = Array.from({ length: count }, (_, i) => ({
        id: `demo-ep-${malId}-${i + 1}`,
        anime_id: anime.id,
        mal_episode_id: i + 1,
        number: i + 1,
        title: `${i + 1}. Bölüm`,
        synopsis: null,
        thumbnail_url: anime.poster_url,
        duration_sec: (anime.duration_min ?? 24) * 60,
        source: "embed",
        video_url: null,
        mux_playback_id: null,
        air_date: null,
        air_at: null,
        is_published: true,
        view_count: 0,
      }));

      return {
        ...anime,
        episodes,
        genres: a.genres.map((g) => ({
          id: `g-${g.mal_id}`,
          mal_id: g.mal_id,
          name: g.name,
          slug: g.name.toLowerCase(),
        })),
      };
    } catch {
      return null;
    }
  }

  const supabase = await createClient();

  // Slug yerine sondaki mal_id ile ararız. Böylece hem yeni format
  // ("...-izle-16498") hem de ESKİ URL'ler ("...-16498") aynı kayda
  // düşer; çağıran sayfa `anime.slug` ile isteneni karşılaştırıp
  // gerekirse 308 kalıcı yönlendirme yapar (SEO'da link değeri korunur).
  const malId = malIdFromSlug(slug);
  if (malId === null) return null;

  // Bölümler BİLE BİLE gömülmüyor: 220 bölümlük bir seride tüm satırları
  // çekmek sayfayı megabaytlara çıkarıyordu. Bölümler `getEpisodesPage`
  // ile parça parça, izleme sayfasında ise `getEpisodeContext` ile
  // yalnızca üç satır olarak çekiliyor.
  const { data } = await supabase
    .from("animes")
    .select(`${ANIME_COLUMNS}, anime_genres(genres(*))`)
    .eq("mal_id", malId)
    .eq("is_published", true)
    .maybeSingle();

  if (!data) return null;

  const raw = data as unknown as Anime & {
    anime_genres: { genres: AnimeWithEpisodes["genres"][number] }[];
  };

  return {
    ...raw,
    episodes: [], // ayrı sorgularla çekiliyor — yukarıdaki nota bakın
    genres: (raw.anime_genres ?? []).map((ag) => ag.genres).filter(Boolean),
  };
}

/** Kaldığı yerden devam edilecek bir bölüm. */
export interface DevamEden {
  anime: Anime;
  episodeNumber: number;
  /** 0-100 arası tamamlanma oranı; süre bilinmiyorsa null. */
  percent: number | null;
  positionSec: number;
}

/**
 * "İzlemeye Devam Et": kullanıcının yarım bıraktığı bölümler.
 * Oturum yoksa boş döner — anasayfa bu satırı hiç göstermez.
 * Aynı animenin birden çok bölümü varsa en son izlenen kalır.
 */
export async function getContinueWatching(): Promise<DevamEden[]> {
  if (!isSupabaseConfigured) return [];

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("watch_progress")
    .select(
      `position_sec, updated_at,
       episodes!inner(number, duration_sec, animes!inner(${ANIME_COLUMNS}))`,
    )
    .eq("user_id", user.id)
    .eq("completed", false)
    .order("updated_at", { ascending: false })
    .limit(30);

  const satirlar = (data ?? []) as unknown as {
    position_sec: number;
    episodes: {
      number: number;
      duration_sec: number | null;
      animes: Anime;
    } | null;
  }[];

  const gorulen = new Set<string>();
  const sonuc: DevamEden[] = [];

  for (const r of satirlar) {
    const ep = r.episodes;
    if (!ep?.animes || gorulen.has(ep.animes.id)) continue;
    gorulen.add(ep.animes.id);

    sonuc.push({
      anime: ep.animes,
      episodeNumber: ep.number,
      positionSec: r.position_sec,
      percent: ep.duration_sec
        ? Math.min(100, Math.round((r.position_sec / ep.duration_sec) * 100))
        : null,
    });
  }

  return sonuc.slice(0, 18);
}

/**
 * Site içi arama. Başlık, İngilizce ve Japonca adlarda arar.
 *
 * PostgREST'in `or=` sözdiziminde virgül ve parantez ayraç görevi görür;
 * temizlenmezse kullanıcının yazdığı bir virgül filtreyi bozar (ve
 * beklenmedik koşullar enjekte edilebilir). Bu yüzden girdiyi daraltıyoruz.
 */
export async function searchAnimes(
  query: string,
  page = 1,
): Promise<Sayfali<Anime>> {
  const q = query.trim().replace(/[,()\\%*]/g, " ").trim();
  if (q.length < 2 || !isSupabaseConfigured) return sayfali([], 0, page);

  const supabase = await createClient();
  const from = (page - 1) * SAYFA_BOYUTU;

  const { data, count } = await supabase
    .from("animes")
    .select(ANIME_COLUMNS, { count: "exact" })
    .eq("is_published", true)
    .or(
      `title.ilike.%${q}%,title_english.ilike.%${q}%,title_japanese.ilike.%${q}%`,
    )
    .order("score", { ascending: false, nullsFirst: false })
    .order("id")
    .range(from, from + SAYFA_BOYUTU - 1);

  return sayfali((data ?? []) as Anime[], count ?? 0, page);
}

/** Navbar'daki anlık arama açılırı — sayfalama gerekmez. */
export async function searchAnimesQuick(
  query: string,
  limit = 8,
): Promise<Anime[]> {
  const q = query.trim().replace(/[,()\\%*]/g, " ").trim();
  if (q.length < 2 || !isSupabaseConfigured) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("animes")
    .select(ANIME_COLUMNS)
    .eq("is_published", true)
    .or(
      `title.ilike.%${q}%,title_english.ilike.%${q}%,title_japanese.ilike.%${q}%`,
    )
    .order("score", { ascending: false, nullsFirst: false })
    .limit(limit);

  return dedupe((data ?? []) as Anime[]);
}

/** Menü ve kategori sayfaları için tür listesi (anime sayısıyla). */
export async function getGenres(): Promise<
  { id: string; name: string; slug: string; count: number }[]
> {
  if (!isSupabaseConfigured) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("genres")
    .select("id,name,slug,anime_genres(count)")
    .order("name");

  return ((data ?? []) as unknown as {
    id: string;
    name: string;
    slug: string;
    anime_genres: { count: number }[];
  }[])
    .map((g) => ({
      id: g.id,
      name: g.name,
      slug: g.slug,
      count: g.anime_genres?.[0]?.count ?? 0,
    }))
    .filter((g) => g.count > 0);
}

/**
 * Türü slug'dan bulur. Kategori sayfası bunu Suspense'ten ÖNCE çağırır:
 * `notFound()` yanıt akmaya başladıktan sonra çağrılırsa durum kodu
 * 200'de kilitlenir ve arama motorları olmayan sayfaları indeksler.
 */
export async function getGenreBySlug(
  slug: string,
): Promise<{ id: string; name: string; slug: string } | null> {
  if (!isSupabaseConfigured) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("genres")
    .select("id,name,slug")
    .eq("slug", slug)
    .maybeSingle();

  return (data as { id: string; name: string; slug: string } | null) ?? null;
}

/**
 * Kategori sayfası: bir türe ait yayınlanmış animeler, sayfalı.
 *
 * Eskiden tüm satırlar çekilip JS'te sıralanıyordu; Action'da 1.003
 * anime demek ve sayfa 7 MB'a çıkıyordu. Artık filtreleme, sıralama
 * ve sayfalama veritabanında yapılıyor.
 */
export async function getAnimesByGenre(
  slug: string,
  page = 1,
): Promise<
  ({ genre: { name: string; slug: string } } & Sayfali<Anime>) | null
> {
  if (!isSupabaseConfigured) return null;

  const supabase = await createClient();

  const { data: genre } = await supabase
    .from("genres")
    .select("id,name,slug")
    .eq("slug", slug)
    .maybeSingle();

  if (!genre) return null;

  const from = (page - 1) * SAYFA_BOYUTU;

  // `anime_genres!inner(...)` gömülü filtre: birleştirme veritabanında
  // yapılır, `count` da filtrelenmiş sonuç üzerinden döner.
  const { data, count } = await supabase
    .from("animes")
    .select(`${ANIME_COLUMNS},anime_genres!inner(genre_id)`, {
      count: "exact",
    })
    .eq("is_published", true)
    .eq("anime_genres.genre_id", (genre as { id: string }).id)
    .order("score", { ascending: false, nullsFirst: false })
    .order("id")
    .range(from, from + SAYFA_BOYUTU - 1);

  return {
    genre: genre as { name: string; slug: string },
    ...sayfali((data ?? []) as Anime[], count ?? 0, page),
  };
}

// ============================================================
//  Son yayınlanan bölümler / yayın takvimi
// ============================================================

/** Anasayfadaki akış ve takvim kartları için tek bölüm. */
export interface BolumAkis {
  id: string;
  number: number;
  title: string | null;
  thumbnail_url: string | null;
  air_at: string | null;
  air_date: string | null;
  anime: Pick<Anime, "id" | "slug" | "title" | "poster_url">;
}

/** Takvim için: kesin saat gerekiyor (06-yayin-takvimi.sql şart). */
const AKIS_SELECT =
  "id,number,title,thumbnail_url,air_at,air_date," +
  "animes!inner(id,slug,title,poster_url,is_published)";

/**
 * "Son eklenen" için: `air_at` YOK.
 * Bu akış yalnızca güne ihtiyaç duyuyor, dolayısıyla takvim
 * migration'ı çalıştırılmadan da çalışabilmeli. Aksi hâlde var
 * olmayan bir sütun yüzünden sorgu boş dönüp bölüm hiç görünmüyordu.
 */
const AKIS_SELECT_GUNLUK =
  "id,number,title,thumbnail_url,air_date," +
  "animes!inner(id,slug,title,poster_url,is_published)";

/** PostgREST satırını düz `BolumAkis` şekline indirger. */
function akisSatiri(r: unknown): BolumAkis | null {
  const row = r as {
    id: string;
    number: number;
    title: string | null;
    thumbnail_url: string | null;
    air_at?: string | null;
    air_date: string | null;
    animes: {
      id: string;
      slug: string;
      title: string;
      poster_url: string | null;
      is_published: boolean;
    } | null;
  };
  if (!row.animes?.is_published) return null;
  return {
    id: row.id,
    number: row.number,
    title: row.title,
    thumbnail_url: row.thumbnail_url,
    air_at: row.air_at ?? null,
    air_date: row.air_date,
    anime: {
      id: row.animes.id,
      slug: row.animes.slug,
      title: row.animes.title,
      poster_url: row.animes.poster_url,
    },
  };
}

export type ZamanAraligi = "hepsi" | "bugun" | "hafta" | "ay";

/**
 * "Son Eklenen Bölümler": yayın tarihi GEÇMİŞ olan bölümler, en yeniden
 * eskiye. `created_at` kullanılamaz — toplu aktarımda hepsi aynı damgayı
 * taşıyor, dolayısıyla anlamlı bir kronoloji vermiyor.
 */
export async function getLatestEpisodes(
  aralik: ZamanAraligi = "hepsi",
  limit = 24,
): Promise<BolumAkis[]> {
  if (!isSupabaseConfigured) return [];

  const supabase = await createClient();
  const simdi = new Date();

  const esik = new Date(simdi);
  if (aralik === "bugun") esik.setDate(esik.getDate() - 1);
  else if (aralik === "hafta") esik.setDate(esik.getDate() - 7);
  else if (aralik === "ay") esik.setMonth(esik.getMonth() - 1);

  let q = supabase
    .from("episodes")
    .select(AKIS_SELECT_GUNLUK)
    .eq("is_published", true)
    .not("air_date", "is", null)
    // Gelecek tarihli bölümler "son eklenen" değildir — onlar takvimde
    .lte("air_date", yerelGun(simdi));

  if (aralik !== "hepsi") {
    q = q.gte("air_date", yerelGun(esik));
  }

  const { data } = await q
    .order("air_date", { ascending: false })
    .order("number", { ascending: false })
    .limit(limit);

  return ((data ?? []) as unknown[])
    .map(akisSatiri)
    .filter((x): x is BolumAkis => !!x);
}

/** Takvimdeki tek bir gün. */
export interface TakvimGunu {
  tarih: string; // YYYY-MM-DD
  bolumler: BolumAkis[];
}

/**
 * Yayın takvimi: `baslangic` gününden itibaren `gun` günlük pencere.
 * Saat bilgisi `air_at` alanından gelir (AniList zaman damgası).
 */
export async function getSchedule(
  baslangic: Date,
  gun = 7,
): Promise<TakvimGunu[]> {
  if (!isSupabaseConfigured) return [];

  const bas = new Date(baslangic);
  bas.setHours(0, 0, 0, 0);
  const bit = new Date(bas);
  bit.setDate(bit.getDate() + gun);

  const supabase = await createClient();
  // `air_at` sütunu 06-yayin-takvimi.sql ile geliyor. Migration henüz
  // çalıştırılmadıysa hata döner; sayfayı düşürmek yerine boş takvim
  // gösterip kullanıcıyı yönlendiriyoruz.
  const { data, error } = await supabase
    .from("episodes")
    .select(AKIS_SELECT)
    .eq("is_published", true)
    .not("air_at", "is", null)
    .gte("air_at", bas.toISOString())
    .lt("air_at", bit.toISOString())
    .order("air_at")
    .limit(500);

  if (error) {
    console.warn(`[takvim] sorgu başarısız: ${error.message}`);
    return bosTakvim(bas, gun);
  }

  const satirlar = ((data ?? []) as unknown[])
    .map(akisSatiri)
    .filter((x): x is BolumAkis => !!x);

  // Günlere böl — pencerede boş gün de görünsün
  const gunler = bosTakvim(bas, gun);

  const harita = new Map(gunler.map((g) => [g.tarih, g]));
  for (const b of satirlar) {
    if (!b.air_at) continue;
    harita.get(yerelGun(new Date(b.air_at)))?.bolumler.push(b);
  }

  return gunler;
}

/** Bölümsüz gün iskeleti — hem boş takvim hem de doldurma tabanı. */
function bosTakvim(bas: Date, gun: number): TakvimGunu[] {
  return Array.from({ length: gun }, (_, i) => {
    const d = new Date(bas);
    d.setDate(d.getDate() + i);
    return { tarih: yerelGun(d), bolumler: [] };
  });
}

/** Date -> "YYYY-MM-DD" (yerel saat; toISOString UTC'ye kaydırır). */
export function yerelGun(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// ============================================================
//  Karakterler ve benzer animeler
// ============================================================

/** Detay sayfası için karakter listesi (seslendirenleriyle). */
export async function getAnimeCharacters(
  animeId: string,
  limit = 12,
): Promise<AnimeCharacter[]> {
  if (!isSupabaseConfigured) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("anime_characters")
    .select(
      "role,sira,characters!inner(id,name,image_url),voice_actors(name,image_url)",
    )
    .eq("anime_id", animeId)
    .order("sira")
    .limit(limit);

  // Tablo henüz oluşturulmadıysa sayfa çökmesin
  if (error) return [];

  return ((data ?? []) as unknown as {
    role: string | null;
    characters: { id: string; name: string; image_url: string | null };
    voice_actors: { name: string; image_url: string | null } | null;
  }[]).map((r) => ({
    id: r.characters.id,
    name: r.characters.name,
    image_url: r.characters.image_url,
    role: r.role,
    voiceActor: r.voice_actors
      ? { name: r.voice_actors.name, image_url: r.voice_actors.image_url }
      : null,
  }));
}

/**
 * Benzer animeler: ortak türe sahip, puana göre en iyiler.
 * Aynı seriyi (aynı başlık kökü) elemek için basit bir filtre uygulanır.
 */
export async function getSimilarAnimes(
  animeId: string,
  genreIds: string[],
  limit = 12,
): Promise<Anime[]> {
  if (!isSupabaseConfigured || genreIds.length === 0) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("animes")
    .select(`${ANIME_COLUMNS},anime_genres!inner(genre_id)`)
    .eq("is_published", true)
    .in("anime_genres.genre_id", genreIds)
    .neq("id", animeId)
    .order("score", { ascending: false, nullsFirst: false })
    .limit(limit * 4); // tekilleştirme sonrası yeterli kalsın

  return dedupe((data ?? []) as Anime[]).slice(0, limit);
}

// ============================================================
//  Blog / haber
// ============================================================

const BLOG_LIST_COLS =
  "id,slug,title,excerpt,cover_url,tags,published_at,created_at";

/** Yayınlanmış blog yazıları, en yeniden eskiye (sayfalı). */
export async function getBlogPosts(page = 1, boyut = 12) {
  if (!isSupabaseConfigured)
    return { items: [], total: 0, page, totalPages: 1 };

  const supabase = await createClient();
  const from = (page - 1) * boyut;

  const { data, count } = await supabase
    .from("blog_posts")
    .select(BLOG_LIST_COLS, { count: "exact" })
    .eq("is_published", true)
    .order("published_at", { ascending: false, nullsFirst: false })
    .range(from, from + boyut - 1);

  return {
    items: (data ?? []) as Partial<import("./types").BlogPost>[],
    total: count ?? 0,
    page,
    totalPages: Math.max(1, Math.ceil((count ?? 0) / boyut)),
  };
}

/** Tek blog yazısı (tam gövde). */
export async function getBlogPost(
  slug: string,
): Promise<import("./types").BlogPost | null> {
  if (!isSupabaseConfigured) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("blog_posts")
    .select("*")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();

  return (data as import("./types").BlogPost | null) ?? null;
}

/** Sitemap + RSS için tüm yayınlanmış yazı slug'ları. */
export async function getAllBlogSlugs(): Promise<
  { slug: string; updated_at: string; title: string; excerpt: string | null }[]
> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("blog_posts")
    .select("slug,updated_at,title,excerpt")
    .eq("is_published", true)
    .order("published_at", { ascending: false })
    .limit(1000);
  return (data ?? []) as {
    slug: string;
    updated_at: string;
    title: string;
    excerpt: string | null;
  }[];
}

// ============================================================
//  Yönetim paneli — analiz + güvenlik
// ============================================================

export interface AnalizOzet {
  bugun_goruntuleme: number;
  bugun_ziyaretci: number;
  aktif_5dk: number;
  aktif_uye_5dk: number;
  ort_sure: number;
  gunluk_uye: number;
}

/** Panel üst KPI'ları (SECURITY DEFINER RPC — admin doğrulaması gövdede). */
export async function getAnalizOzet(): Promise<AnalizOzet | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("analytics_ozet");
  if (error) return null;
  return data as AnalizOzet;
}

export interface CanliSayfa {
  path: string;
  aktif: number;
}
export interface CanliZiyaret {
  path: string;
  session_id: string;
  duration_sec: number;
  created_at: string;
}

/** Canlı akış: son 5 dk'daki sayfa görüntülemeleri + en aktif yollar. */
export async function getCanliAkis(): Promise<{
  sayfalar: CanliSayfa[];
  son: CanliZiyaret[];
}> {
  if (!isSupabaseConfigured) return { sayfalar: [], son: [] };
  const supabase = await createClient();

  const esik = new Date(Date.now() - 5 * 60_000).toISOString();
  const { data } = await supabase
    .from("page_views")
    .select("path,session_id,duration_sec,created_at")
    .gte("created_at", esik)
    .order("created_at", { ascending: false })
    .limit(200);

  const satirlar = (data ?? []) as CanliZiyaret[];

  // Yola göre benzersiz session say
  const yolHarita = new Map<string, Set<string>>();
  for (const r of satirlar) {
    if (!yolHarita.has(r.path)) yolHarita.set(r.path, new Set());
    yolHarita.get(r.path)!.add(r.session_id);
  }
  const sayfalar = [...yolHarita.entries()]
    .map(([path, s]) => ({ path, aktif: s.size }))
    .sort((a, b) => b.aktif - a.aktif)
    .slice(0, 15);

  return { sayfalar, son: satirlar.slice(0, 20) };
}

/** Son 7 günün günlük görüntüleme sayısı (grafik için). */
export async function getGunlukGoruntuleme(): Promise<
  { gun: string; sayi: number }[]
> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();

  const esik = new Date(Date.now() - 7 * 86400_000).toISOString();
  const { data } = await supabase
    .from("page_views")
    .select("created_at")
    .gte("created_at", esik)
    .limit(50000);

  const say = new Map<string, number>();
  // Boş günler de görünsün
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400_000);
    say.set(yerelGun(d), 0);
  }
  for (const r of (data ?? []) as { created_at: string }[]) {
    const g = yerelGun(new Date(r.created_at));
    if (say.has(g)) say.set(g, (say.get(g) ?? 0) + 1);
  }
  return [...say.entries()].map(([gun, sayi]) => ({ gun, sayi }));
}

/** En çok görüntülenen sayfalar (bugün). */
export async function getPopulerSayfalar(): Promise<
  { path: string; sayi: number }[]
> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();

  const { data } = await supabase
    .from("page_views")
    .select("path")
    .gte("created_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString())
    .limit(50000);

  const say = new Map<string, number>();
  for (const r of (data ?? []) as { path: string }[]) {
    say.set(r.path, (say.get(r.path) ?? 0) + 1);
  }
  return [...say.entries()]
    .map(([path, sayi]) => ({ path, sayi }))
    .sort((a, b) => b.sayi - a.sayi)
    .slice(0, 15);
}

export interface DenetimKaydi {
  id: number;
  action: string;
  detail: Record<string, unknown> | null;
  created_at: string;
  admin_id: string | null;
}

/** Güvenlik: son admin işlemleri (denetim günlüğü). */
export async function getDenetimGunlugu(limit = 50): Promise<DenetimKaydi[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("admin_audit")
    .select("id,action,detail,created_at,admin_id")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []) as DenetimKaydi[];
}

// ============================================================
//  Koleksiyonlar (otomatik SEO liste sayfaları)
// ============================================================

/** Bir koleksiyonun animelerini puana göre döndürür. */
export async function getKoleksiyonAnimeleri(
  tur: import("./collections").KoleksiyonTuru,
  limit = 30,
): Promise<Anime[]> {
  if (!isSupabaseConfigured) return [];

  const supabase = await createClient();

  // Türe göre: anime_genres üzerinden gömülü filtre
  if (tur.kind === "genre") {
    const { data: genre } = await supabase
      .from("genres")
      .select("id")
      .eq("slug", tur.genreSlug)
      .maybeSingle();
    if (!genre) return [];

    const { data } = await supabase
      .from("animes")
      .select(`${ANIME_COLUMNS},anime_genres!inner(genre_id)`)
      .eq("is_published", true)
      .eq("anime_genres.genre_id", (genre as { id: string }).id)
      .not("score", "is", null)
      .order("score", { ascending: false, nullsFirst: false })
      .order("id")
      .limit(limit);
    return dedupe((data ?? []) as Anime[]);
  }

  let q = supabase
    .from("animes")
    .select(ANIME_COLUMNS)
    .eq("is_published", true);

  if (tur.kind === "year") q = q.eq("year", tur.year);
  else if (tur.kind === "airing") q = q.eq("status", "airing");
  else if (tur.kind === "movies") q = q.eq("type", "Movie");

  // "top" için ek filtre yok — sadece en yüksek puanlılar
  const { data } = await q
    .not("score", "is", null)
    .order("score", { ascending: false, nullsFirst: false })
    .order("id")
    .limit(limit);

  return dedupe((data ?? []) as Anime[]);
}

// ============================================================
//  Seriler / sezonlar
// ============================================================

/** Bir serideki tek sezon (= bir anime kaydı). */
export interface Sezon {
  id: string;
  slug: string;
  title: string;
  season_number: number;
  season_label: string | null;
  year: number | null;
  total_episodes: number;
  poster_url: string | null;
}

/**
 * Bir animenin ait olduğu serinin tüm sezonları, sırayla.
 * Anime bir seriye bağlı değilse boş döner — detay sayfası
 * o zaman sezon sekmelerini hiç göstermez.
 */
export async function getSeasons(
  seriesId: string | null,
): Promise<{ title: string; sezonlar: Sezon[] } | null> {
  if (!seriesId || !isSupabaseConfigured) return null;

  const supabase = await createClient();

  const [{ data: seri }, { data: uyeler }] = await Promise.all([
    supabase.from("series").select("title").eq("id", seriesId).maybeSingle(),
    supabase
      .from("animes")
      .select(
        "id,slug,title,season_number,season_label,year,total_episodes,poster_url",
      )
      .eq("series_id", seriesId)
      .eq("is_published", true)
      .order("season_number"),
  ]);

  const sezonlar = (uyeler ?? []) as Sezon[];
  // Tek üyeli "seri" bir seri değildir; sekme göstermeye değmez
  if (!seri || sezonlar.length < 2) return null;

  return { title: (seri as { title: string }).title, sezonlar };
}

/** Detay sayfasında tek seferde gösterilen bölüm sayısı. */
export const BOLUM_SAYFA_BOYUTU = 20;

/**
 * Detay sayfası için bölümlerin bir sayfası.
 *
 * Naruto (220 bölüm) gibi uzun serilerde tüm bölümleri kapaklarıyla
 * basmak sayfayı 2,3 MB'a çıkarıyordu. Artık parça parça çekiliyor.
 */
export async function getEpisodesPage(
  animeId: string,
  page = 1,
): Promise<Sayfali<Episode>> {
  if (!isSupabaseConfigured) return sayfali([], 0, page);

  const supabase = await createClient();
  const from = (page - 1) * BOLUM_SAYFA_BOYUTU;

  const { data, count } = await supabase
    .from("episodes")
    .select("*", { count: "exact" })
    .eq("anime_id", animeId)
    .eq("is_published", true)
    .order("number")
    .range(from, from + BOLUM_SAYFA_BOYUTU - 1);

  return {
    items: (data ?? []) as Episode[],
    total: count ?? 0,
    page,
    totalPages: Math.max(1, Math.ceil((count ?? 0) / BOLUM_SAYFA_BOYUTU)),
  };
}

/**
 * İzleme sayfası için tek bölüm + komşuları.
 * Tüm bölüm listesini çekmeye gerek yok — üç satır yeterli.
 */
export async function getEpisodeContext(
  animeId: string,
  number: number,
): Promise<{ ep: Episode; prev: Episode | null; next: Episode | null } | null> {
  if (!isSupabaseConfigured) return null;

  const supabase = await createClient();

  const [{ data: ep }, { data: prevRows }, { data: nextRows }] =
    await Promise.all([
      supabase
        .from("episodes")
        .select("*")
        .eq("anime_id", animeId)
        .eq("number", number)
        .eq("is_published", true)
        .maybeSingle(),
      supabase
        .from("episodes")
        .select("*")
        .eq("anime_id", animeId)
        .eq("is_published", true)
        .lt("number", number)
        .order("number", { ascending: false })
        .limit(1),
      supabase
        .from("episodes")
        .select("*")
        .eq("anime_id", animeId)
        .eq("is_published", true)
        .gt("number", number)
        .order("number")
        .limit(1),
    ]);

  if (!ep) return null;

  return {
    ep: ep as Episode,
    prev: ((prevRows ?? [])[0] as Episode) ?? null,
    next: ((nextRows ?? [])[0] as Episode) ?? null,
  };
}

/**
 * Sitemap için tüm yayınlanmış anime slug'ları.
 *
 * DİKKAT: PostgREST tek istekte en fazla 1000 satır döndürür ve fazlasını
 * SESSİZCE kırpar — `.limit(5000)` yazmak işe yaramıyordu, sitemap
 * 2.169 animenin yalnızca 1.000'ini içeriyordu. Bu yüzden `range()` ile
 * sayfalayarak tamamını topluyoruz.
 */
export async function getAllAnimeSlugs(): Promise<
  { slug: string; updated_at: string }[]
> {
  if (!isSupabaseConfigured) {
    const top = await getTopAnime(25);
    return top.map((a) => ({
      slug: toAnimeRow(a).slug,
      updated_at: new Date().toISOString(),
    }));
  }

  const supabase = await createClient();
  const hepsi: { slug: string; updated_at: string }[] = [];
  const ADIM = 1000;

  for (let from = 0; from < 100_000; from += ADIM) {
    const { data, error } = await supabase
      .from("animes")
      .select("slug,updated_at")
      .eq("is_published", true)
      .order("id")
      .range(from, from + ADIM - 1);

    if (error || !data?.length) break;
    hepsi.push(...(data as { slug: string; updated_at: string }[]));
    if (data.length < ADIM) break;
  }

  return hepsi;
}

/** Sitemap için kategori slug'ları. */
export async function getGenreSlugs(): Promise<string[]> {
  const genres = await getGenres();
  return genres.map((g) => g.slug);
}

/**
 * Sitemap için bölüm sayfaları — YALNIZCA video kaynağı tanımlı olanlar.
 *
 * Video eklenmemiş bölüm sayfaları boş oynatıcı gösteriyor; 36.850 boş
 * sayfayı dizine göndermek "ince içerik" sayılır ve sitenin genel
 * sıralamasına zarar verir. Video girildikçe bu liste kendiliğinden büyür.
 */
export async function getPlayableEpisodePaths(): Promise<
  { path: string; updated_at: string }[]
> {
  if (!isSupabaseConfigured) return [];

  const supabase = await createClient();
  const hepsi: { path: string; updated_at: string }[] = [];
  const ADIM = 1000;

  for (let from = 0; from < 100_000; from += ADIM) {
    const { data, error } = await supabase
      .from("episodes")
      .select("number,updated_at,animes!inner(slug,is_published)")
      .eq("is_published", true)
      .not("video_url", "is", null)
      .order("id")
      .range(from, from + ADIM - 1);

    if (error || !data?.length) break;

    for (const e of data as unknown as {
      number: number;
      updated_at: string;
      animes: { slug: string; is_published: boolean } | null;
    }[]) {
      if (!e.animes?.is_published) continue;
      hepsi.push({
        path: `/anime/${e.animes.slug}/bolum/${e.number}`,
        updated_at: e.updated_at,
      });
    }

    if (data.length < ADIM) break;
  }

  return hepsi;
}
