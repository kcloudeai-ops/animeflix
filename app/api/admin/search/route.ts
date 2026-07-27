import { NextResponse } from "next/server";
import { searchAnime } from "@/lib/anime-api";
import { requireAdmin } from "@/lib/require-admin";

/** GET /api/admin/search?q=naruto — admin panelindeki canlı arama kutusu. */
export async function GET(request: Request) {
  const red = await requireAdmin();
  if (red) return red;

  const q = new URL(request.url).searchParams.get("q") ?? "";
  if (q.trim().length < 2) return NextResponse.json({ results: [] });

  try {
    const { results, unavailable } = await searchAnime(q, 8);
    return NextResponse.json({
      unavailable,
      results: results.map((a) => ({
        mal_id: a.mal_id,
        title: a.title_english || a.title,
        year: a.year,
        type: a.type,
        episodes: a.episodes,
        score: a.score,
        image: a.images.webp?.image_url ?? a.images.jpg.image_url,
      })),
    });
  } catch {
    return NextResponse.json({ results: [], error: "Jikan erişilemedi" }, { status: 502 });
  }
}
