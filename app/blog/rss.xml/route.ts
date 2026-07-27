import { SITE_URL } from "@/lib/supabase/config";
import { getAllBlogSlugs } from "@/lib/queries";

export const revalidate = 3600;

/** Blog RSS beslemesi — okuyucular ve Google Haberler için. */
export async function GET() {
  const posts = await getAllBlogSlugs().catch(() => []);

  const kacisla = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const items = posts
    .map(
      (p) => `    <item>
      <title>${kacisla(p.title)}</title>
      <link>${SITE_URL}/blog/${p.slug}</link>
      <guid>${SITE_URL}/blog/${p.slug}</guid>
      <description>${kacisla(p.excerpt ?? "")}</description>
      <pubDate>${new Date(p.updated_at).toUTCString()}</pubDate>
    </item>`,
    )
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Anime Köşesi Blog</title>
    <link>${SITE_URL}/blog</link>
    <description>Anime dünyasından haberler, öneriler ve incelemeler.</description>
    <language>tr-TR</language>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
