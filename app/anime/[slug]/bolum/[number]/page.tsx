import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getAnimeBySlug, getEpisodeContext } from "@/lib/queries";
import { EpisodeWatcher } from "@/components/EpisodeWatcher";
import { BreadcrumbJsonLd, VideoObjectJsonLd } from "@/components/JsonLd";
import { bolumMetaAciklama } from "@/lib/seo";

export const revalidate = 3600;

type Props = { params: Promise<{ slug: string; number: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, number } = await params;
  const anime = await getAnimeBySlug(slug);
  if (!anime) return { title: "Bölüm bulunamadı" };

  const ctx = await getEpisodeContext(anime.id, Number(number));
  if (!ctx) return { title: "Bölüm bulunamadı" };
  const ep = ctx.ep;

  const title = `${anime.title} ${ep.number}. Bölüm İzle`;
  // Bölüm synopsis'i İngilizce geliyor; meta'da Türkçe açıklama kullan.
  const description = bolumMetaAciklama(anime.title, ep.number);
  const image = ep.thumbnail_url ?? anime.poster_url ?? undefined;

  return {
    title,
    description,
    alternates: { canonical: `/anime/${anime.slug}/bolum/${ep.number}` },
    openGraph: {
      type: "video.episode",
      title,
      description,
      images: image ? [{ url: image }] : [],
    },
    // "player" kartı `twitter:player` + boyut etiketleri zorunlu kılar;
    // gömülü oynatıcı URL'imiz her bölümde olmadığı için geçerli olan
    // summary_large_image kullanılır.
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: image ? [image] : [],
    },
  };
}

export default async function EpisodePage({ params }: Props) {
  const { slug, number } = await params;
  const anime = await getAnimeBySlug(slug);
  if (!anime) notFound();

  // Eski/yanlış slug -> canonical'a 308 kalıcı yönlendir
  if (anime.slug !== slug) {
    permanentRedirect(`/anime/${anime.slug}/bolum/${number}`);
  }

  // Tüm bölüm listesini çekmiyoruz: uzun serilerde yüzlerce satır
  // demekti. Bu sorgu yalnızca bölümün kendisini ve iki komşusunu getirir.
  const ctx = await getEpisodeContext(anime.id, Number(number));
  if (!ctx) notFound();

  const { ep, prev, next } = ctx;

  return (
    <div className="mx-auto max-w-[1200px] px-4 pb-20 pt-24 md:px-8">
      <VideoObjectJsonLd anime={anime} episode={ep} />
      <BreadcrumbJsonLd
        items={[
          { name: "Anasayfa", path: "/" },
          { name: anime.title, path: `/anime/${anime.slug}` },
          {
            name: `${ep.number}. Bölüm`,
            path: `/anime/${anime.slug}/bolum/${ep.number}`,
          },
        ]}
      />

      <nav className="mb-4 text-sm text-zinc-400">
        <Link href="/" className="hover:text-white">
          Anasayfa
        </Link>{" "}
        /{" "}
        <Link href={`/anime/${anime.slug}`} className="hover:text-white">
          {anime.title}
        </Link>{" "}
        / <span className="text-zinc-200">{ep.number}. Bölüm</span>
      </nav>

      <EpisodeWatcher episode={ep} poster={ep.thumbnail_url ?? anime.poster_url} />

      <header className="mt-6">
        <h1 className="text-2xl font-bold md:text-3xl">
          {anime.title} — {ep.number}. Bölüm
        </h1>
        {ep.title ? <p className="mt-1 text-zinc-400">{ep.title}</p> : null}
        {ep.synopsis_tr ?? ep.synopsis ? (
          <p className="mt-3 max-w-3xl leading-relaxed text-zinc-300">
            {ep.synopsis_tr ?? ep.synopsis}
          </p>
        ) : null}
      </header>

      {/* Önceki / Sonraki */}
      <div className="mt-8 flex items-center justify-between gap-3">
        {prev ? (
          <Link
            href={`/anime/${anime.slug}/bolum/${prev.number}`}
            className="flex items-center gap-2 rounded bg-ink-soft px-4 py-2.5 text-sm transition-colors hover:bg-ink-line"
          >
            <ChevronLeft size={16} /> {prev.number}. Bölüm
          </Link>
        ) : (
          <span />
        )}

        <Link
          href={`/anime/${anime.slug}`}
          className="text-sm text-zinc-400 hover:text-white"
        >
          Tüm bölümler
        </Link>

        {next ? (
          <Link
            href={`/anime/${anime.slug}/bolum/${next.number}`}
            className="flex items-center gap-2 rounded bg-ink-soft px-4 py-2.5 text-sm transition-colors hover:bg-ink-line"
          >
            {next.number}. Bölüm <ChevronRight size={16} />
          </Link>
        ) : (
          <span />
        )}
      </div>
    </div>
  );
}
