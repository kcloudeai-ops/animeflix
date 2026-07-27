import type { NextConfig } from "next";

const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : undefined;

const nextConfig: NextConfig = {
  // Üst dizinlerdeki lockfile'lar yüzünden yanlış workspace kökü seçilmesin
  outputFileTracingRoot: __dirname,
  images: {
    // WebP/AVIF dönüşümü next/image tarafından otomatik yapılır.
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      // MyAnimeList CDN — Jikan'dan gelen afişler
      { protocol: "https", hostname: "cdn.myanimelist.net" },
      { protocol: "https", hostname: "img.youtube.com" },
      // AniList CDN — afiş ve banner görselleri (ana kaynak)
      { protocol: "https", hostname: "s4.anilist.co" },
      // Crunchyroll — AniList'in streamingEpisodes bölüm kapakları
      { protocol: "https", hostname: "img1.ak.crunchyroll.com" },
      { protocol: "https", hostname: "img2.ak.crunchyroll.com" },
      // Kitsu — eksik bölüm başlıklarıyla birlikte gelen kapaklar
      { protocol: "https", hostname: "media.kitsu.app" },
      { protocol: "https", hostname: "media.kitsu.io" },
      // Supabase Storage (env varsa)
      ...(supabaseHost
        ? [{ protocol: "https" as const, hostname: supabaseHost }]
        : []),
    ],
  },
  experimental: {
    // Framer Motion / lucide gibi barrel paketlerde tree-shaking
    optimizePackageImports: ["framer-motion", "lucide-react"],
  },
};

export default nextConfig;
