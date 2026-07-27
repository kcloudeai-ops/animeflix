/**
 * Supabase ortam değişkenleri tek noktadan okunur.
 * Env yoksa uygulama çökmez — "demo mod"a düşer (Jikan'dan canlı veri).
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** Supabase gerçekten yapılandırılmış mı? */
export const isSupabaseConfigured =
  SUPABASE_URL.startsWith("http") && SUPABASE_ANON_KEY.length > 20;

/**
 * Canonical / OpenGraph / sitemap adresleri buradan üretilir.
 * Üretimde localhost kalırsa tüm SEO etiketleri ve sitemap yanlış
 * alan adını gösterir — sessizce geçmesin, build sırasında uyaralım.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
).replace(/\/+$/, ""); // sondaki eğik çizgi -> çift slash canonical'ı bozar

if (
  process.env.NODE_ENV === "production" &&
  SITE_URL.includes("localhost")
) {
  console.warn(
    "\n[UYARI] NEXT_PUBLIC_SITE_URL ayarlanmamış — canonical, OpenGraph ve " +
      "sitemap adresleri localhost gösterecek. Yayına almadan önce " +
      "gerçek alan adınızı tanımlayın.\n",
  );
}

/**
 * Google Search Console doğrulama kodu (meta etiket yöntemi).
 * Search Console → mülk ekle → "HTML etiketi" → content değerini
 * .env.local'e NEXT_PUBLIC_GOOGLE_VERIFICATION olarak yapıştırın.
 */
export const GOOGLE_VERIFICATION =
  process.env.NEXT_PUBLIC_GOOGLE_VERIFICATION ?? "";
