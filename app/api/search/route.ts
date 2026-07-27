import { NextResponse } from "next/server";
import { searchAnimesQuick } from "@/lib/queries";

/** GET /api/search?q=... — navbar'daki anlık arama açılırı için. */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q") ?? "";
  if (q.trim().length < 2) return NextResponse.json({ results: [] });

  const results = await searchAnimesQuick(q, 8);

  return NextResponse.json({
    results: results.map((a) => ({
      id: a.id,
      slug: a.slug,
      title: a.title,
      year: a.year,
      type: a.type,
      score: a.score,
      poster_url: a.poster_url,
    })),
  });
}
