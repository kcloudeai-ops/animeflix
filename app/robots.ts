import { SITE_URL } from "@/lib/supabase/config";
import type { MetadataRoute } from "next";


export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/api/",
          "/giris",
          "/profil",
          "/listem",
          "/ara", // arama sonuçları ince/yinelenen içerik
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
