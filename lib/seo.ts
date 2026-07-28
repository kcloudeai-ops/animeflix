/**
 * Türkçe meta açıklama yardımcıları.
 *
 * Veri kaynağı (AniList/Kitsu) synopsis'i İNGİLİZCE geliyor; bu metni meta
 * description / OpenGraph / JSON-LD'de kullanmak Türkçe bir site için hem
 * SEO hem kullanıcı açısından yanlış. Bu yüzden açıklamaları İngilizce
 * synopsis'ten değil, yapısal alanlardan (tür, yıl, bölüm) Türkçe olarak
 * üretiyoruz. Admin elle `meta_description` girdiyse çağıran taraf onu
 * tercih eder (bkz. anime detay sayfası).
 */

import { trGenre } from "@/lib/genre-names";

/** Anime serisi için Türkçe, SEO uyumlu meta açıklaması. */
export function animeMetaAciklama(a: {
  title: string;
  genres?: { name: string }[];
  year?: number | null;
  total_episodes?: number | null;
}): string {
  const turler = (a.genres ?? [])
    .slice(0, 2)
    .map((g) => trGenre(g.name))
    .filter(Boolean);

  const parcalar: string[] = [];
  if (turler.length) parcalar.push(`${turler.join(", ")} türünde`);
  if (a.year) parcalar.push(`${a.year} yapımı`);
  if (a.total_episodes && a.total_episodes > 0) {
    parcalar.push(`${a.total_episodes} bölüm`);
  }
  const detay = parcalar.length ? ` ${parcalar.join(", ")}.` : "";

  return `${a.title} anime serisini Türkçe altyazılı ve HD kalitede ücretsiz izle.${detay} Tüm bölümler Anime Köşesi'nde.`;
}

/** Tek bölüm için Türkçe meta açıklaması. */
export function bolumMetaAciklama(baslik: string, bolumNo: number): string {
  return `${baslik} ${bolumNo}. bölümü Türkçe altyazılı ve HD kalitede ücretsiz izle. Anime Köşesi'nde tüm bölümler tek sayfada.`;
}

/** Anime fragmanı (tanıtım videosu) için Türkçe meta açıklaması. */
export function fragmanMetaAciklama(baslik: string): string {
  return `${baslik} animesinin resmi fragmanını (tanıtım videosu) izleyin. Türkçe altyazılı tüm bölümler Anime Köşesi'nde.`;
}
