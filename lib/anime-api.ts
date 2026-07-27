/**
 * ============================================================
 *  lib/anime-api.ts
 *  Jikan API (MyAnimeList — resmi olmayan REST katmanı) istemcisi.
 *
 *  Jikan rate limit'i: ~3 istek/saniye, 60 istek/dakika.
 *  Bu dosya istekleri tek bir kuyrukta seri hale getirip aralarına
 *  minimum gecikme koyar ve 429'da üstel geri çekilme uygular.
 *
 *  Sunucu tarafında (Server Component / Route Handler) kullanılır.
 * ============================================================
 */

import type {
  JikanAnime,
  JikanEpisode,
  JikanPagination,
  AnimeStatus,
} from "./types";
import { slugify } from "./slug";

const JIKAN_BASE = "https://api.jikan.moe/v4";

/**
 * Jikan iki ayrı sınır uygular: 3 istek/saniye VE 60 istek/dakika.
 * Dakika sınırı bağlayıcı olan: sürekli akışta ortalama 1 istek/saniyeyi
 * geçemezsiniz. Sadece 400 ms aralık koymak kısa patlamalarda çalışır ama
 * dakikada 150 isteğe denk gelir ve uzun senkronlarda 429 yer.
 */
const MIN_INTERVAL_MS = 350; // saniyelik sınır (3/sn) için
const MAX_PER_MINUTE = 55; // 60'ın biraz altında güvenlik payı
const MAX_RETRIES = 3;

export class JikanError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly endpoint: string,
  ) {
    super(message);
    this.name = "JikanError";
  }
}

// ------------------------------------------------------------
//  Rate limiter — tüm istekleri tek zincirde seri çalıştırır
// ------------------------------------------------------------
let chain: Promise<unknown> = Promise.resolve();
let lastCallAt = 0;
/** Son 60 saniyedeki isteklerin zaman damgaları (kayan pencere). */
let recentCalls: number[] = [];

function schedule<T>(task: () => Promise<T>): Promise<T> {
  const run = chain.then(async () => {
    // 1) Saniyelik sınır: ardışık istekler arasında minimum aralık
    const gap = MIN_INTERVAL_MS - (Date.now() - lastCallAt);
    if (gap > 0) await sleep(gap);

    // 2) Dakikalık sınır: pencere doluysa en eski istek düşene kadar bekle
    recentCalls = recentCalls.filter((t) => Date.now() - t < 60_000);
    if (recentCalls.length >= MAX_PER_MINUTE) {
      const waitMs = 60_000 - (Date.now() - recentCalls[0]) + 50;
      await sleep(waitMs);
      recentCalls = recentCalls.filter((t) => Date.now() - t < 60_000);
    }

    lastCallAt = Date.now();
    recentCalls.push(lastCallAt);
    return task();
  });
  // Zincirin bir hata yüzünden kopmasını engelle
  chain = run.catch(() => undefined);
  return run;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface JikanEnvelope<T> {
  data: T;
  pagination?: JikanPagination;
}

interface FetchOpts {
  /** ISR süresi (saniye). Varsayılan 1 saat. */
  revalidate?: number;
  /** Next.js cache tag — admin senkronundan sonra invalidate etmek için */
  tags?: string[];
}

async function jikanFetch<T>(
  endpoint: string,
  { revalidate = 3600, tags = [] }: FetchOpts = {},
): Promise<JikanEnvelope<T>> {
  return schedule(async () => {
    let attempt = 0;

    while (true) {
      const res = await fetch(`${JIKAN_BASE}${endpoint}`, {
        headers: { Accept: "application/json" },
        next: { revalidate, tags: ["jikan", ...tags] },
      });

      if (res.status === 429 && attempt < MAX_RETRIES) {
        // Üstel geri çekilme: 1s, 2s, 4s
        await sleep(1000 * 2 ** attempt);
        attempt++;
        continue;
      }

      if (res.status === 404) {
        throw new JikanError("Kayıt bulunamadı", 404, endpoint);
      }

      if (!res.ok) {
        throw new JikanError(
          `Jikan isteği başarısız (${res.status})`,
          res.status,
          endpoint,
        );
      }

      return (await res.json()) as JikanEnvelope<T>;
    }
  });
}

// ============================================================
//  Public API
// ============================================================

/** Tek bir animenin tam kaydı (ilişkiler + tema dahil). */
export async function getAnimeById(malId: number): Promise<JikanAnime> {
  const { data } = await jikanFetch<JikanAnime>(`/anime/${malId}/full`, {
    tags: [`anime-${malId}`],
  });
  return data;
}

/** Bir animenin tüm bölümleri — Jikan sayfa sayfa döner, hepsini toplarız. */
export async function getAnimeEpisodes(malId: number): Promise<JikanEpisode[]> {
  const all: JikanEpisode[] = [];
  let page = 1;

  while (page <= 25) {
    // güvenlik tavanı: 25 sayfa (~2500 bölüm)
    // 1. sayfayı sorgu dizesiz iste — bkz. aşağıdaki "Jikan edge" notu.
    const path =
      page === 1
        ? `/anime/${malId}/episodes`
        : `/anime/${malId}/episodes?page=${page}`;

    try {
      const { data, pagination } = await jikanFetch<JikanEpisode[]>(path, {
        tags: [`anime-${malId}-episodes`],
      });

      all.push(...data);
      if (!pagination?.has_next_page) break;
      page++;
    } catch (err) {
      // Sonraki sayfalar `?page=N` taşıdığı için Jikan edge'inde 504
      // yiyebiliyor. O ana kadar toplananları çöpe atmayalım: elimizde
      // veri varsa kısmi sonuçla dönüyoruz, hiç yoksa hatayı yükseltiyoruz
      // (çağıran taraf yer tutucu bölümlere düşsün).
      if (all.length > 0) break;
      throw err;
    }
  }

  return all;
}

/**
 * ------------------------------------------------------------
 *  Jikan edge notu (ölçülmüş davranış)
 *
 *  Jikan'ın CDN'i collection uçlarında sorgu dizeli istekleri
 *  zaman zaman 504 ile ve *önbellekten* (~0.1 sn) döndürüyor:
 *
 *      /seasons/now                 -> 200
 *      /seasons/now?sfw=true        -> 504  (kalıcı, cache'lenmiş)
 *      /top/anime                   -> 200
 *      /top/anime?filter=bypopularity -> 504
 *
 *  Bu yüzden liste uçlarını **sorgu dizesiz** çağırıp filtreleme ve
 *  kırpmayı burada yapıyoruz. Yeniden deneme işe yaramaz (hata
 *  önbellekli), tek doğru çözüm parametreyi hiç göndermemek.
 * ------------------------------------------------------------
 */

/** `sfw=true` parametresinin yerel karşılığı: yetişkin içeriği ele. */
function filterSfw(list: JikanAnime[]): JikanAnime[] {
  return list.filter((a) => !/^(Rx|R\+)/i.test(a.rating ?? ""));
}

/** En popüler animeler — anasayfa carousel'i. */
export async function getTopAnime(limit = 20): Promise<JikanAnime[]> {
  const { data } = await jikanFetch<JikanAnime[]>("/top/anime", {
    revalidate: 21600, // 6 saat
  });
  return filterSfw(data).slice(0, limit);
}

/** Bu sezon yayınlananlar — "Şu An Yayında" carousel'i. */
export async function getSeasonNow(limit = 20): Promise<JikanAnime[]> {
  const { data } = await jikanFetch<JikanAnime[]>("/seasons/now", {
    revalidate: 21600,
  });
  return filterSfw(data).slice(0, limit);
}

/**
 * Başlığa göre arama — admin panelindeki arama kutusu.
 *
 * Bu uç `?q=` olmadan çalışamaz; Jikan araması kesintiye girdiğinde
 * istisna fırlatmak yerine boş liste döner ve `searchUnavailable`
 * bayrağı ile arayüz "MAL ID ile aktarın" yönlendirmesi yapabilir.
 */
export async function searchAnime(
  query: string,
  limit = 12,
): Promise<{ results: JikanAnime[]; unavailable: boolean }> {
  if (!query.trim()) return { results: [], unavailable: false };

  try {
    const { data } = await jikanFetch<JikanAnime[]>(
      `/anime?q=${encodeURIComponent(query)}`,
      { revalidate: 600 },
    );
    return { results: filterSfw(data).slice(0, limit), unavailable: false };
  } catch (err) {
    if (err instanceof JikanError && err.status >= 500) {
      return { results: [], unavailable: true };
    }
    throw err;
  }
}

// ============================================================
//  Dönüştürücüler: Jikan şekli -> Supabase satırı
// ============================================================

// Tek kaynak: URL-güvenli slug üretici lib/slug.ts'te.
// Bu dosya içinde de kullanıldığı için ayrıca import edilir (aşağıda).
export { slugify };

/**
 * Anime slug'ı: "tokyo-ghoul-izle-16498".
 *  - "izle" anahtar kelimesi başlıktan hemen sonra: "X izle" Türkçe
 *    aramasında tam eşleşme sağlar.
 *  - mal_id sonda: benzersizliği garanti eder ve URL'den kayıt bulmayı
 *    kolaylaştırır (eski "...-16498" URL'leri de aynı kayda düşer).
 */
export function animeSlug(title: string, malId: number): string {
  return `${slugify(title)}-izle-${malId}`;
}

/** Bir anime slug'ının sonundaki mal_id'yi çıkarır (yeni ve eski format). */
export function malIdFromSlug(slug: string): number | null {
  const m = slug.match(/-(\d+)$/);
  return m ? Number(m[1]) : null;
}

function mapStatus(jikanStatus: string | null): AnimeStatus {
  switch (jikanStatus) {
    case "Currently Airing":
      return "airing";
    case "Not yet aired":
      return "upcoming";
    default:
      return "finished";
  }
}

/** "24 min per ep" -> 24 */
function parseDuration(raw: string | null): number | null {
  if (!raw) return null;
  const hr = raw.match(/(\d+)\s*hr/);
  const min = raw.match(/(\d+)\s*min/);
  const total = (hr ? +hr[1] * 60 : 0) + (min ? +min[1] : 0);
  return total || null;
}

/** Jikan afişi: WebP varsa onu tercih et (daha küçük dosya). */
function bestImage(a: JikanAnime): string | null {
  return (
    a.images.webp?.large_image_url ??
    a.images.jpg.large_image_url ??
    a.images.jpg.image_url ??
    null
  );
}

export interface AnimeInsert {
  mal_id: number;
  slug: string;
  title: string;
  title_english: string | null;
  title_japanese: string | null;
  synopsis: string | null;
  poster_url: string | null;
  banner_url: string | null;
  trailer_url: string | null;
  type: string | null;
  status: AnimeStatus;
  season: string | null;
  year: number | null;
  total_episodes: number;
  duration_min: number | null;
  score: number | null;
  rating: string | null;
  studios: string[];
  meta_title: string;
  meta_description: string;
  og_image_url: string | null;
  synced_at: string;
}

/** Jikan kaydını `animes` tablosuna yazılabilir hale getirir. */
export function toAnimeRow(a: JikanAnime): AnimeInsert {
  const displayTitle = a.title_english || a.title;
  const poster = bestImage(a);
  const plainSynopsis = (a.synopsis ?? "")
    .replace(/\[Written by MAL Rewrite\]/gi, "")
    .trim();

  return {
    mal_id: a.mal_id,
    slug: animeSlug(displayTitle, a.mal_id),
    title: displayTitle,
    title_english: a.title_english,
    title_japanese: a.title_japanese,
    synopsis: plainSynopsis || null,
    poster_url: poster,
    banner_url: a.trailer?.youtube_id
      ? `https://img.youtube.com/vi/${a.trailer.youtube_id}/maxresdefault.jpg`
      : poster,
    trailer_url: a.trailer?.embed_url ?? null,
    type: a.type,
    status: mapStatus(a.status),
    season: a.season,
    year: a.year,
    total_episodes: a.episodes ?? 0,
    duration_min: parseDuration(a.duration),
    score: a.score,
    rating: a.rating,
    studios: a.studios.map((s) => s.name),

    // SEO varsayılanları — admin panelinden ezilebilir.
    // Site adı eklenmez: layout'taki `title.template` zaten "%s | AnimeFlix"
    // uyguluyor, burada da eklersek başlık iki kez soneklenir.
    meta_title: `${displayTitle} Türkçe Altyazılı İzle`,
    meta_description:
      plainSynopsis.slice(0, 155).trim() ||
      `${displayTitle} anime serisinin tüm bölümlerini HD kalitede izle.`,
    og_image_url: poster,

    synced_at: new Date().toISOString(),
  };
}

export interface EpisodeInsert {
  anime_id: string;
  mal_episode_id: number;
  number: number;
  title: string | null;
  air_date: string | null;
  source: "embed";
  video_url: null;
  is_published: boolean;
}

/**
 * Jikan bölüm listesi alınamadığında (ör. o URL için önbelleklenmiş 504)
 * animenin bilinen bölüm sayısından yer tutucu satırlar üretir.
 * Böylece seri "0 bölüm" kalmaz ve video URL'leri hemen girilebilir;
 * Jikan toparlayınca tekrar aktarım gerçek başlıkları doldurur.
 */
export function makePlaceholderEpisodes(
  animeId: string,
  count: number,
): EpisodeInsert[] {
  return Array.from({ length: count }, (_, i) => ({
    anime_id: animeId,
    mal_episode_id: i + 1,
    number: i + 1,
    title: null, // gerçek başlık sonraki senkronda gelir
    air_date: null,
    source: "embed" as const,
    video_url: null,
    is_published: true, // bkz. toEpisodeRows'daki gerekçe
  }));
}

/** Jikan bölüm listesini `episodes` satırlarına çevirir. */
export function toEpisodeRows(
  animeId: string,
  eps: JikanEpisode[],
): EpisodeInsert[] {
  return eps.map((e, i) => ({
    anime_id: animeId,
    mal_episode_id: e.mal_id,
    number: e.mal_id || i + 1,
    title: e.title,
    air_date: e.aired ? e.aired.slice(0, 10) : null,
    // Video kaynağı Jikan'da yok — admin panelinden elle eklenir.
    source: "embed" as const,
    video_url: null,
    // Videosuz bölümler de YAYINDA olmalı: aksi hâlde RLS okuma politikası
    // (`is_published or is_admin()`) bunları herkesten gizler ve her seri
    // "henüz bölüm eklenmemiş" görünür. Oynatıcı zaten video yoksa
    // "kaynak henüz eklenmedi" yer tutucusunu gösteriyor.
    is_published: true,
  }));
}
