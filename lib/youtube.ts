/**
 * Depoladığımız trailer_url biçimi: https://www.youtube.com/embed/{id}
 * Bu yardımcılar hem eski hem olası varyant biçimlerden id çıkarır.
 */
export function youtubeId(url: string | null): string | null {
  if (!url) return null;
  const m = url.match(
    /(?:youtube\.com\/(?:embed\/|watch\?v=)|youtu\.be\/)([\w-]{11})/,
  );
  return m ? m[1] : null;
}

/** YouTube küçük resmi (fragman posteri). maxres yoksa hq'ya düşülür. */
export function youtubeThumb(id: string): string {
  return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
}

/** Gizlilik dostu gömme adresi (çerez azaltılmış alan). */
export function youtubeEmbed(id: string): string {
  return `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`;
}
