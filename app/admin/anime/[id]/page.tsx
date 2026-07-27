import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { EpisodeManager } from "@/components/admin/EpisodeManager";
import type { Anime, Episode } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Bölüm Yönetimi",
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ id: string }> };

export default async function AdminAnimePage({ params }: Props) {
  const { id } = await params;
  if (!isSupabaseConfigured) notFound();

  const supabase = await createClient();

  const { data: anime } = await supabase
    .from("animes")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!anime) notFound();

  const { data: episodes } = await supabase
    .from("episodes")
    .select("*")
    .eq("anime_id", id)
    .order("number");

  const a = anime as Anime;

  return (
    <div className="mx-auto max-w-[1200px] px-4 pb-20 pt-24 md:px-8">
      <Link
        href="/admin"
        className="mb-6 inline-flex items-center gap-2 text-sm text-zinc-400 transition-colors hover:text-white"
      >
        <ArrowLeft size={16} /> Yönetim paneline dön
      </Link>

      <header className="flex flex-col gap-4 sm:flex-row sm:items-start">
        {a.poster_url ? (
          <div className="relative aspect-[2/3] w-24 shrink-0 overflow-hidden rounded-lg ring-1 ring-white/10">
            <Image
              src={a.poster_url}
              alt=""
              fill
              sizes="96px"
              className="object-cover"
            />
          </div>
        ) : null}

        <div className="min-w-0">
          <h1 className="text-2xl font-bold md:text-3xl">{a.title}</h1>
          <p className="mt-1 text-sm text-zinc-500">
            MAL #{a.mal_id} · {a.total_episodes} bölüm (MAL) ·{" "}
            {episodes?.length ?? 0} kayıt
          </p>
          <Link
            href={`/anime/${a.slug}`}
            target="_blank"
            className="mt-2 inline-flex items-center gap-1.5 text-sm text-brand hover:underline"
          >
            Sitede görüntüle <ExternalLink size={13} />
          </Link>
        </div>
      </header>

      <div className="mt-8">
        <EpisodeManager
          animeId={a.id}
          animeSlug={a.slug}
          episodes={(episodes ?? []) as Episode[]}
        />
      </div>
    </div>
  );
}
