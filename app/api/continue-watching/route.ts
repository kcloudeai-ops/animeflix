import { NextResponse } from "next/server";
import { getContinueWatching } from "@/lib/queries";

/**
 * GET /api/continue-watching
 *
 * "İzlemeye Devam Et" kullanıcıya özeldir. Anasayfada sunucuda
 * render edilirse tüm sayfa dinamik olur ve hiç önbelleğe alınamaz.
 * Bu uç sayesinde anasayfa ISR ile statik kalıyor, kişisel satır ise
 * yüklendikten sonra istemcide beliriyor.
 */
export async function GET() {
  try {
    const items = await getContinueWatching();
    return NextResponse.json(
      { items },
      // Kişisel veri: hiçbir ara katman önbelleğe almasın
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json({ items: [] });
  }
}
