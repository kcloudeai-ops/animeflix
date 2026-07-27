import { NextResponse } from "next/server";
import { getLatestEpisodes, type ZamanAraligi } from "@/lib/queries";

const GECERLI: ZamanAraligi[] = ["hepsi", "bugun", "hafta", "ay"];

/** GET /api/latest-episodes?aralik=hafta — anasayfadaki akış sekmeleri. */
export async function GET(request: Request) {
  const ham = new URL(request.url).searchParams.get("aralik") ?? "hepsi";
  // Bilinmeyen değeri sorguya geçirme
  const aralik = GECERLI.includes(ham as ZamanAraligi)
    ? (ham as ZamanAraligi)
    : "hepsi";

  try {
    return NextResponse.json({ items: await getLatestEpisodes(aralik) });
  } catch {
    return NextResponse.json({ items: [] });
  }
}
