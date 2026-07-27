/**
 * Blog yazısı için SEO denetimi — canlı puanlama.
 * Güncel arama motoru gereksinimlerine göre her kuralı geçti/kaldı
 * olarak işaretler. Editörde yazarken anlık geri bildirim verir.
 */

export type SeoDurum = "gecti" | "uyari" | "kaldi";

export interface SeoKural {
  id: string;
  etiket: string;
  durum: SeoDurum;
  ipucu: string;
}

export interface SeoSonuc {
  puan: number; // 0-100
  gecen: number;
  toplam: number;
  kurallar: SeoKural[];
}

interface Girdi {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  cover: string;
  tags: string[];
}

/** Markdown'ı kabaca düz metne indirger (kelime/okuma sayımı için). */
function duzMetin(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_`~-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function seoAnaliz(g: Girdi): SeoSonuc {
  const metin = duzMetin(g.content);
  const kelimeler = metin ? metin.split(/\s+/).length : 0;
  const baslikUz = g.title.trim().length;
  const ozetUz = g.excerpt.trim().length;

  // Başlıktaki anahtar kelimeler (ilk anlamlı kelime kümesi)
  const anahtar = g.title
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .slice(0, 3);
  const metinKucuk = metin.toLowerCase();
  const anahtarGecti =
    anahtar.length > 0 && anahtar.some((w) => metinKucuk.includes(w));

  // Markdown yapısı
  const basliklar = (g.content.match(/^#{2,3}\s+/gm) ?? []).length;
  const linkler = (g.content.match(/\[[^\]]+\]\([^)]+\)/g) ?? []).length;
  // Anime sayfalarına iç bağlantı (SEO'da değerli)
  const icLink = /\]\((\/anime\/|\/koleksiyon\/|\/kategori\/)/.test(g.content);
  const gorsel = (g.content.match(/!\[[^\]]*\]\([^)]+\)/g) ?? []).length;

  const kurallar: SeoKural[] = [
    {
      id: "baslik",
      etiket: `Başlık uzunluğu (${baslikUz})`,
      durum: baslikUz >= 30 && baslikUz <= 60 ? "gecti" : baslikUz > 0 && baslikUz < 70 ? "uyari" : "kaldi",
      ipucu: "İdeal 30–60 karakter. Google başlığı bu aralıkta tam gösterir.",
    },
    {
      id: "slug",
      etiket: "URL (slug)",
      durum: /^[a-z0-9-]+$/.test(g.slug) && g.slug.length >= 3 && g.slug.length <= 75
        ? "gecti"
        : g.slug
          ? "uyari"
          : "kaldi",
      ipucu: "Kısa, küçük harf, tireyle ayrılmış ve anahtar kelime içermeli.",
    },
    {
      id: "ozet",
      etiket: `Meta açıklama / özet (${ozetUz})`,
      durum: ozetUz >= 120 && ozetUz <= 160 ? "gecti" : ozetUz > 0 && ozetUz < 200 ? "uyari" : "kaldi",
      ipucu: "İdeal 120–160 karakter. Arama sonucundaki açıklama metni.",
    },
    {
      id: "uzunluk",
      etiket: `İçerik uzunluğu (${kelimeler} kelime)`,
      durum: kelimeler >= 300 ? "gecti" : kelimeler >= 150 ? "uyari" : "kaldi",
      ipucu: "En az 300 kelime. Uzun, özgün içerik daha iyi sıralanır.",
    },
    {
      id: "basliklar",
      etiket: `Ara başlıklar (${basliklar})`,
      durum: basliklar >= 2 ? "gecti" : basliklar === 1 ? "uyari" : "kaldi",
      ipucu: "En az 2 ara başlık (## veya ###). İçeriği bölümlere ayırır.",
    },
    {
      id: "anahtar",
      etiket: "Anahtar kelime içerikte",
      durum: anahtarGecti ? "gecti" : "kaldi",
      ipucu: "Başlıktaki ana kelime içeriğin gövdesinde de geçmeli.",
    },
    {
      id: "iclink",
      etiket: "İç bağlantı (anime/koleksiyon)",
      durum: icLink ? "gecti" : linkler > 0 ? "uyari" : "kaldi",
      ipucu: "En az bir anime/koleksiyon sayfasına bağlantı verin — SEO için değerli.",
    },
    {
      id: "gorsel",
      etiket: "Kapak görseli",
      durum: g.cover.trim() ? "gecti" : gorsel > 0 ? "uyari" : "kaldi",
      ipucu: "Sosyal paylaşım ve liste için kapak görseli ekleyin.",
    },
    {
      id: "etiket",
      etiket: `Etiketler (${g.tags.length})`,
      durum: g.tags.length >= 2 ? "gecti" : g.tags.length === 1 ? "uyari" : "kaldi",
      ipucu: "2–5 etiket ekleyin. İçeriği sınıflandırır.",
    },
  ];

  const gecen = kurallar.filter((k) => k.durum === "gecti").length;
  const uyari = kurallar.filter((k) => k.durum === "uyari").length;
  // Uyarılar yarım puan
  const puan = Math.round(((gecen + uyari * 0.5) / kurallar.length) * 100);

  return { puan, gecen, toplam: kurallar.length, kurallar };
}
