import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { getAnalizOzet, getCanliAkis } from "@/lib/queries";

/** GET /api/admin/analiz-ozet — panelin canlı KPI + akış tazelemesi. */
export async function GET() {
  const red = await requireAdmin();
  if (red) return red;

  const [ozet, akis] = await Promise.all([getAnalizOzet(), getCanliAkis()]);
  return NextResponse.json({ ozet, akis });
}
