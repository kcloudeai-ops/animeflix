import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AnimeCard } from "@/components/AnimeCard";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { Anime } from "@/lib/types";

// Kullanıcıya özel — asla önbelleğe alınmaz
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Listem",
  robots: { index: false, follow: false },
};

export default async function WatchlistPage() {
  if (!isSupabaseConfigured) redirect("/");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Middleware zaten koruyor; yine de savunmacı davranıyoruz.
  if (!user) redirect("/giris?next=%2Flistem");

  const { data } = await supabase
    .from("watchlist")
    .select("created_at, animes(*)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const items = ((data ?? []) as unknown as { animes: Anime | null }[])
    .map((r) => r.animes)
    .filter((a): a is Anime => !!a);

  return (
    <div className="mx-auto max-w-[1600px] px-4 pb-20 pt-24 md:px-10">
      <header className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">
          Listem
        </h1>
        <p className="mt-1 text-zinc-400">
          {items.length > 0
            ? `${items.length} seri kayıtlı`
            : "Henüz bir şey eklemediniz"}
        </p>
      </header>

      {items.length === 0 ? (
        <div className="rounded-lg border border-ink-line bg-ink-soft p-6">
          <p className="text-zinc-300">Listeniz boş.</p>
          <p className="mt-1 text-sm text-zinc-500">
            Bir anime sayfasında <strong>Listeme Ekle</strong> düğmesine basarak
            buraya kaydedebilirsiniz.
          </p>
          <Link
            href="/kesfet"
            className="mt-4 inline-block rounded bg-brand px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-brand-hi"
          >
            Keşfetmeye başla
          </Link>
        </div>
      ) : (
        <div className="flex flex-wrap gap-x-3 gap-y-6">
          {items.map((a, i) => (
            <AnimeCard key={a.id} anime={a} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
