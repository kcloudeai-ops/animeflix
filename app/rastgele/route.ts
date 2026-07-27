import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

/**
 * GET /rastgele — rastgele bir animeye yönlendirir.
 * Kullanıcıyı keşfe teşvik eden hafif bir eğlence özelliği.
 * Puanı yüksek (>=7) havuzdan seçer ki kalitesiz sayfaya düşmesin.
 */
export async function GET(request: Request) {
  if (!isSupabaseConfigured) {
    return NextResponse.redirect(new URL("/kesfet", request.url));
  }

  const supabase = await createClient();

  // Toplam sayıyı al, rastgele offset seç (RLS-güvenli, indexli)
  const { count } = await supabase
    .from("animes")
    .select("id", { count: "exact", head: true })
    .eq("is_published", true)
    .gte("score", 7);

  const toplam = count ?? 0;
  if (toplam === 0) {
    return NextResponse.redirect(new URL("/kesfet", request.url));
  }

  const offset = Math.floor(Math.random() * toplam);
  const { data } = await supabase
    .from("animes")
    .select("slug")
    .eq("is_published", true)
    .gte("score", 7)
    .order("id")
    .range(offset, offset)
    .maybeSingle();

  const slug = (data as { slug: string } | null)?.slug;
  return NextResponse.redirect(
    new URL(slug ? `/anime/${slug}` : "/kesfet", request.url),
  );
}
