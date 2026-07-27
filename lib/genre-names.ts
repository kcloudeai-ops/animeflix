/**
 * MyAnimeList tür adlarının Türkçe karşılıkları.
 * Listede olmayan bir tür gelirse İngilizce adı olduğu gibi gösterilir —
 * eksik çeviri, boş kategori adından iyidir.
 */
const TR: Record<string, string> = {
  Action: "Aksiyon",
  Adventure: "Macera",
  "Avant Garde": "Avangart",
  "Award Winning": "Ödüllü",
  "Boys Love": "Boys Love",
  Comedy: "Komedi",
  Drama: "Dram",
  Ecchi: "Ecchi",
  Erotica: "Erotik",
  Fantasy: "Fantastik",
  "Girls Love": "Girls Love",
  Gourmet: "Yemek",
  Hentai: "Hentai",
  Horror: "Korku",
  Mystery: "Gizem",
  Romance: "Romantik",
  "Sci-Fi": "Bilim Kurgu",
  "Slice of Life": "Yaşamdan Kesitler",
  Sports: "Spor",
  Supernatural: "Doğaüstü",
  Suspense: "Gerilim",
};

export function trGenre(name: string): string {
  return TR[name] ?? name;
}

/** Ana menüde öne çıkarılacak türler (varsa bu sırayla gösterilir). */
export const FEATURED_GENRES = [
  "Action",
  "Adventure",
  "Comedy",
  "Drama",
  "Fantasy",
  "Romance",
  "Sci-Fi",
  "Mystery",
  "Supernatural",
  "Suspense",
  "Horror",
  "Sports",
];
