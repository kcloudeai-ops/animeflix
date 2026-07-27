import type { Metadata } from "next";
import { AnimeImporter } from "@/components/admin/AnimeImporter";
import { AdminAnimeTable } from "@/components/admin/AdminAnimeTable";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { Anime } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "İçerik Yönetimi",
  robots: { index: false, follow: false },
};

async function getAnimes(): Promise<Anime[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("animes")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(50);
  return (data ?? []) as Anime[];
}

export default async function AdminIcerikPage() {
  const animes = await getAnimes();

  return (
    <div className="px-4 pb-20 pt-8 md:px-8">
      <header className="mb-8">
        <h1 className="text-2xl font-bold">İçerik / Anime</h1>
        <p className="mt-1 text-zinc-400">
          Anime aktarın, SEO ve video kaynaklarını düzenleyin.
        </p>
      </header>

      {!isSupabaseConfigured ? (
        <div className="mb-8 rounded-lg border border-amber-800/60 bg-amber-950/40 p-4 text-sm text-amber-200">
          <strong>Demo mod:</strong> Supabase yapılandırılmamış.{" "}
          <code className="rounded bg-black/40 px-1">.env.local</code> dosyasını
          doldurup sunucuyu yeniden başlatın.
        </div>
      ) : null}

      <AnimeImporter />

      <section className="mt-12">
        <h2 className="mb-4 text-xl font-semibold">
          Kütüphane{" "}
          <span className="text-sm font-normal text-zinc-500">
            (son {animes.length})
          </span>
        </h2>
        <AdminAnimeTable animes={animes} />
      </section>
    </div>
  );
}
