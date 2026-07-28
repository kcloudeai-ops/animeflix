// ============================================================
//  Uygulama içi domain tipleri (Supabase satırlarıyla 1-1)
// ============================================================

export type UserRole = "user" | "editor" | "admin";
export type AnimeStatus = "airing" | "finished" | "upcoming";
export type VideoSource = "mux" | "cloudinary" | "embed" | "hls";

export interface Profile {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  created_at: string;
}

export interface Anime {
  id: string;
  mal_id: number | null;
  slug: string;
  title: string;
  title_english: string | null;
  title_japanese: string | null;
  synopsis: string | null;
  /** synopsis'in Türkçe makine çevirisi; render `synopsis_tr ?? synopsis` gösterir. */
  synopsis_tr?: string | null;
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
  is_published: boolean;
  is_featured: boolean;
  view_count: number;
  meta_title: string | null;
  meta_description: string | null;
  og_image_url: string | null;
  synced_at: string | null;
  created_at: string;
  updated_at: string;

  /** Ait olduğu seri — sezon sekmeleri buradan çıkar. */
  series_id: string | null;
  /** Seri içindeki sıra (1, 2, 3…). */
  season_number: number | null;
  /** "Season 3 Part 2", "Final Season" gibi serbest etiket. */
  season_label: string | null;
}

export interface Episode {
  id: string;
  anime_id: string;
  mal_episode_id: number | null;
  number: number;
  title: string | null;
  /** title'ın Türkçe makine çevirisi; render `title_tr ?? title` gösterir. */
  title_tr?: string | null;
  synopsis: string | null;
  /** synopsis'in Türkçe makine çevirisi (bölümlerde şimdilik veri yok). */
  synopsis_tr?: string | null;
  thumbnail_url: string | null;
  duration_sec: number | null;
  source: VideoSource;
  video_url: string | null;
  mux_playback_id: string | null;
  air_date: string | null;
  /** Kesin yayın zamanı (saat dahil) — takvim bunu kullanır. */
  air_at: string | null;
  is_published: boolean;
  view_count: number;
}

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content: string;
  cover_url: string | null;
  author_id: string | null;
  tags: string[];
  is_published: boolean;
  published_at: string | null;
  view_count: number;
  created_at: string;
  updated_at: string;
}

/** Bir animenin karakteri ve (varsa) seslendireni. */
export interface AnimeCharacter {
  id: string;
  name: string;
  image_url: string | null;
  role: string | null;
  voiceActor: { name: string; image_url: string | null } | null;
}

export interface Genre {
  id: string;
  mal_id: number | null;
  name: string;
  slug: string;
}

/** Detay sayfasının ihtiyaç duyduğu birleşik şekil */
export interface AnimeWithEpisodes extends Anime {
  episodes: Episode[];
  genres: Genre[];
}

// ============================================================
//  Jikan API (v4) — sadece kullandığımız alanlar
// ============================================================

export interface JikanImage {
  jpg: { image_url: string; small_image_url: string; large_image_url: string };
  webp?: { image_url: string; small_image_url: string; large_image_url: string };
}

export interface JikanAnime {
  mal_id: number;
  url: string;
  images: JikanImage;
  trailer?: { youtube_id: string | null; url: string | null; embed_url: string | null };
  title: string;
  title_english: string | null;
  title_japanese: string | null;
  type: string | null;
  episodes: number | null;
  status: string | null;
  airing: boolean;
  duration: string | null;
  rating: string | null;
  score: number | null;
  synopsis: string | null;
  season: string | null;
  year: number | null;
  studios: { mal_id: number; name: string }[];
  genres: { mal_id: number; name: string }[];
}

export interface JikanEpisode {
  mal_id: number;
  title: string | null;
  title_japanese: string | null;
  aired: string | null;
  filler: boolean;
  recap: boolean;
}

export interface JikanPagination {
  last_visible_page: number;
  has_next_page: boolean;
  current_page?: number;
}
