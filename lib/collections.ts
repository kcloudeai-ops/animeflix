/**
 * ============================================================
 *  Otomatik koleksiyonlar — verilerden üretilen SEO liste sayfaları.
 *
 *  "En İyi Aksiyon Animeleri", "2024'ün En İyileri" gibi sayfalar
 *  yüksek hacimli aramalarda ("en iyi aksiyon anime") sıralanır,
 *  kullanıcıyı animeler arasında gezdirir ve iç bağlantı ağı kurar.
 *  Hiç manuel yazı gerektirmez; katalog büyüdükçe kendini günceller.
 * ============================================================
 */

import "server-only";
import { slugify } from "./slug";
import type { Anime } from "./types";

export type KoleksiyonTuru =
  | { kind: "genre"; genreSlug: string; genreName: string }
  | { kind: "year"; year: number }
  | { kind: "top" }
  | { kind: "airing" }
  | { kind: "movies" };

export interface Koleksiyon {
  slug: string;
  baslik: string; // H1 + title
  aciklama: string; // meta description
  tur: KoleksiyonTuru;
}

// Türkçe tür adları (genre-names ile aynı mantık, burada gömülü tutuldu)
const TR_TUR: Record<string, string> = {
  action: "Aksiyon",
  adventure: "Macera",
  comedy: "Komedi",
  drama: "Dram",
  fantasy: "Fantastik",
  romance: "Romantik",
  "sci-fi": "Bilim Kurgu",
  horror: "Korku",
  mystery: "Gizem",
  supernatural: "Doğaüstü",
  sports: "Spor",
  psychological: "Psikolojik",
  thriller: "Gerilim",
  "slice-of-life": "Yaşamdan Kesitler",
};

/**
 * Statik koleksiyon tanımları. Slug'lar SEO için özenle seçildi:
 * "en-iyi-aksiyon-animeleri" -> "en iyi aksiyon animeleri" araması.
 */
export function tumKoleksiyonlar(): Koleksiyon[] {
  const list: Koleksiyon[] = [];

  // Türe göre "en iyi" listeleri.
  // URL Türkçe ad'dan üretilir ("en-iyi-aksiyon-animeleri") — Türkçe
  // aramaya tam uyum. Veritabanı sorgusu ise İngilizce genreSlug'ı
  // ("action") kullanır çünkü genres tablosundaki slug İngilizce.
  for (const [genreSlug, ad] of Object.entries(TR_TUR)) {
    const trSlug = slugify(ad);
    list.push({
      slug: `en-iyi-${trSlug}-animeleri`,
      baslik: `En İyi ${ad} Animeleri`,
      aciklama: `Puana göre sıralanmış en iyi ${ad.toLowerCase()} animeleri. İzlenmesi gereken ${ad.toLowerCase()} türündeki en beğenilen yapımlar.`,
      tur: { kind: "genre", genreSlug, genreName: ad },
    });
  }

  // Yıla göre (son 6 yıl)
  const buYil = new Date().getFullYear();
  for (let y = buYil; y > buYil - 6; y--) {
    list.push({
      slug: `${y}-en-iyi-animeler`,
      baslik: `${y} Yılının En İyi Animeleri`,
      aciklama: `${y} yılında yayınlanan en iyi animeler. ${y} yapımı izlenmesi gereken anime serileri ve filmleri.`,
      tur: { kind: "year", year: y },
    });
  }

  // Editör seçkileri
  list.push(
    {
      slug: "en-iyi-animeler",
      baslik: "Tüm Zamanların En İyi Animeleri",
      aciklama:
        "Puana göre sıralanmış tüm zamanların en iyi animeleri. İzlenmesi gereken en beğenilen anime serileri.",
      tur: { kind: "top" },
    },
    {
      slug: "devam-eden-animeler",
      baslik: "Şu An Yayında Olan Animeler",
      aciklama:
        "Şu anda yayınlanmaya devam eden animeler. Bu sezonun güncel anime bölümleri.",
      tur: { kind: "airing" },
    },
    {
      slug: "en-iyi-anime-filmleri",
      baslik: "En İyi Anime Filmleri",
      aciklama:
        "Puana göre sıralanmış en iyi anime filmleri. İzlenmesi gereken anime sinema filmleri.",
      tur: { kind: "movies" },
    },
  );

  return list;
}

/** Slug'dan koleksiyon bulur. */
export function koleksiyonBul(slug: string): Koleksiyon | null {
  return tumKoleksiyonlar().find((k) => k.slug === slug) ?? null;
}

// Sorgu tarafı queries.ts'te (Supabase erişimi orada). Burada yalnızca
// koleksiyon tanımları var — istemciden de import edilebilsin diye.
export type { Anime };
