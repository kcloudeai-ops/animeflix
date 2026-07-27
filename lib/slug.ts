/**
 * SEO ve sitemap uyumlu slug üretici. İstemci ve sunucuda çalışır.
 *
 * Türkçe karakterleri (hem büyük hem küçük) doğru ASCII karşılığına
 * çevirir. Editördeki eski sürüm yalnızca küçük harfleri ele alıyordu;
 * "Şubat" -> "ubat", "İzlenmesi" -> "i-zlenmesi" gibi bozuk ve anahtar
 * kelimesini kaybeden slug'lar üretiyordu.
 */
const TR: Record<string, string> = {
  ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u", i: "i",
  Ç: "c", Ğ: "g", İ: "i", Ö: "o", Ş: "s", Ü: "u", I: "i",
};

export function slugify(input: string): string {
  return (
    input
      // Türkçe harfleri toLowerCase'ten ÖNCE çevir: "İ".toLowerCase()
      // birleşik nokta (i̇) üretip slug'ı bozuyor.
      .replace(/[çğıöşüÇĞİÖŞÜIİ]/g, (m) => TR[m] ?? m)
      // Kalan aksanları ayır ve at (é -> e)
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80)
      // slice sonda tire bırakmış olabilir — tekrar temizle
      .replace(/-+$/g, "")
  );
}
