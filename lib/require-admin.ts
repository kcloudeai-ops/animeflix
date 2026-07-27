import { NextResponse } from "next/server";
import { createClient } from "./supabase/server";
import { isSupabaseConfigured } from "./supabase/config";

/**
 * Admin API rotaları için yetki kapısı.
 *
 * Middleware `/api/admin/*` yollarını zaten koruyor; bu kontrol ikinci
 * savunma hattı. Middleware `matcher`'ı ya da `AUTH_REQUIRED` listesi
 * ileride değişirse uçlar sessizce açığa çıkmasın — bir kez tam olarak
 * bu oldu ve catalog/search uçları kimlik doğrulamasız 200 döndü.
 *
 * Yetki varsa `null`, yoksa doğrudan döndürülecek `Response` verir.
 */
export async function requireAdmin(): Promise<NextResponse | null> {
  if (!isSupabaseConfigured) {
    return NextResponse.json(
      { error: "Supabase yapılandırılmamış." },
      { status: 503 },
    );
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Oturum gerekli" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Yetkiniz yok" }, { status: 403 });
  }

  return null;
}
