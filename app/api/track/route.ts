import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

/**
 * POST /api/track — anonim sayfa görüntüleme kaydı.
 *
 * Kişisel veri saklanmaz: rastgele session_id + yol + süre. IP/isim yok.
 * page_views RLS'i insert-only; okuma yalnızca admin. Kötüye kullanım
 * riskini sınırlamak için burada da temel doğrulama var.
 */
export async function POST(request: Request) {
  if (!isSupabaseConfigured) {
    // 204 gövde taşıyamaz; beacon durum kodunu umursamaz, 200 ok:false yeter
    return NextResponse.json({ ok: false });
  }

  const body = (await request.json().catch(() => null)) as {
    sessionId?: unknown;
    path?: unknown;
    referrer?: unknown;
    duration?: unknown;
  } | null;

  const sessionId = String(body?.sessionId ?? "").slice(0, 40);
  const path = String(body?.path ?? "").slice(0, 300);
  const referrer = body?.referrer ? String(body.referrer).slice(0, 300) : null;
  const duration = Math.max(0, Math.min(Number(body?.duration) || 0, 86400));

  // Geçersiz/yanlış biçimli istekleri sessizce yut
  if (!sessionId || !path.startsWith("/") || path.startsWith("/api")) {
    // 204 gövde taşıyamaz; beacon durum kodunu umursamaz, 200 ok:false yeter
    return NextResponse.json({ ok: false });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  await supabase.from("page_views").insert({
    session_id: sessionId,
    user_id: user?.id ?? null,
    path,
    referrer,
    duration_sec: Math.round(duration),
  });

  // Girişliyse "son görülme" güncelle (günlük aktif kullanıcı için)
  if (user) {
    await supabase
      .from("profiles")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", user.id);
  }

  return NextResponse.json({ ok: true });
}
