import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/supabase/config";
import {
  getAllAnimeSlugs,
  getAllBlogSlugs,
  getGenreSlugs,
  getPlayableEpisodePaths,
} from "@/lib/queries";
import { tumKoleksiyonlar } from "@/lib/collections";

export const revalidate = 86400; // günde bir yenile

/** Tek bir sitemap dosyasının protokol sınırı. */
const URL_TAVANI = 50_000;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [animes, genreSlugs, episodes, blog] = await Promise.all([
    getAllAnimeSlugs().catch(() => []),
    getGenreSlugs().catch(() => []),
    getPlayableEpisodePaths().catch(() => []),
    getAllBlogSlugs().catch(() => []),
  ]);

  const girdiler: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/kesfet`, changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE_URL}/takvim`, changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE_URL}/koleksiyon`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${SITE_URL}/blog`, changeFrequency: "daily", priority: 0.7 },

    ...blog.map((b) => ({
      url: `${SITE_URL}/blog/${b.slug}`,
      lastModified: new Date(b.updated_at),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),

    // Otomatik koleksiyon liste sayfaları — yüksek hacimli aramalar için
    ...tumKoleksiyonlar().map((k) => ({
      url: `${SITE_URL}/koleksiyon/${k.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),

    ...genreSlugs.map((slug) => ({
      url: `${SITE_URL}/kategori/${slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),

    ...animes.map((a) => ({
      url: `${SITE_URL}/anime/${a.slug}`,
      lastModified: new Date(a.updated_at),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),

    ...episodes.map((e) => ({
      url: `${SITE_URL}${e.path}`,
      lastModified: new Date(e.updated_at),
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
  ];

  // Sitemap protokolü dosya başına 50.000 URL'e izin verir. Bölümlere
  // video eklendikçe bu sınır aşılabilir; sessizce kırpmak yerine
  // uyaralım ki o gün geldiğinde sitemap'i parçalara bölelim.
  if (girdiler.length > URL_TAVANI) {
    console.warn(
      `[sitemap] ${girdiler.length} URL üretildi, sınır ${URL_TAVANI}. ` +
        `generateSitemaps ile parçalara bölünmeli.`,
    );
    return girdiler.slice(0, URL_TAVANI);
  }

  return girdiler;
}
