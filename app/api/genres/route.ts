import { NextResponse } from "next/server";
import { getGenres } from "@/lib/queries";

/**
 * GET /api/genres — üst menüdeki "Kategoriler" açılırı için.
 * Herkese açık; sadece içinde anime bulunan türleri döner.
 */
export async function GET() {
  try {
    return NextResponse.json({ genres: await getGenres() });
  } catch {
    return NextResponse.json({ genres: [] }, { status: 200 });
  }
}
