import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { Play, Star } from "lucide-react";
import {
  getAnimeBySlug,
  getAnimeCharacters,
  getEpisodesPage,
  getSeasons,
  getSimilarAnimes,
  sayfaNo,
} from "@/lib/queries";
import {
  BreadcrumbJsonLd,
  TrailerJsonLd,
  TVSeriesJsonLd,
} from "@/components/JsonLd";
import { WatchlistButton } from "@/components/WatchlistButton";
import { TrailerButton } from "@/components/TrailerButton";
import { youtubeId } from "@/lib/youtube";
import { Pagination } from "@/components/Pagination";
import { CharacterList } from "@/components/CharacterList";
import { SeasonTabs } from "@/components/SeasonTabs";
import { AnimeCard } from "@/components/AnimeCard";

export const revalidate = 3600;

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ bs?: string }>;
};

/** SSR tabanlı dinamik metadata — her anime için özgün OG etiketleri. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const anime = await getAnimeBySlug(slug);
  if (!anime) return { title: "Bulunamadı" };

  const title = anime.meta_title ?? `${anime.title} Türkçe Altyazılı İzle`;
  const description =
    anime.meta_description ??
    anime.synopsis?.slice(0, 155) ??
    `${anime.title} tüm bölümleri HD kalitede.`;
  const image = anime.og_image_url ?? anime.poster_url ?? undefined;

  return {
    title,
    description,
    alternates: { canonical: `/anime/${anime.slug}` },
    openGraph: {
      type: "video.tv_show",
      title,
      description,
      url: `/anime/${anime.slug}`,
      // Boyut beyan etmiyoruz: kaynak MAL afişi 2:3, sabit 1200×630 vermek
      // sosyal platformlarda yanlış kırpmaya yol açar.
      images: image ? [{ url: image, alt: anime.title }] : [],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: image ? [image] : [],
    },
  };
}

export default async function AnimeDetailPage({
  params,
  searchParams,
}: Props) {
  const { slug } = await params;
  const bolumSayfa = sayfaNo((await searchParams).bs);

  const anime = await getAnimeBySlug(slug);
  if (!anime) notFound();

  const trailerYtId = youtubeId(anime.trailer_url);

  // Eski/yanlış slug ile gelindiyse canonical'a 308 kalıcı yönlendir.
  // ".../tokyo-ghoul-16498" -> ".../tokyo-ghoul-izle-16498"
  if (anime.slug !== slug) {
    permanentRedirect(`/anime/${anime.slug}`);
  }

  // Dördü birbirinden bağımsız — paralel çalışsın
  const [bolumler, karakterler, benzerler, seri] = await Promise.all([
    getEpisodesPage(anime.id, bolumSayfa),
    getAnimeCharacters(anime.id),
    getSimilarAnimes(
      anime.id,
      anime.genres.map((g) => g.id),
    ),
    getSeasons(anime.series_id),
  ]);

  return (
    <article>
      <TVSeriesJsonLd
        anime={anime}
        karakterler={karakterler}
        sezonlar={seri?.sezonlar ?? []}
      />
      {trailerYtId ? (
        <TrailerJsonLd anime={anime} youtubeId={trailerYtId} />
      ) : null}
      <BreadcrumbJsonLd
        items={[
          { name: "Anasayfa", path: "/" },
          // Seriye bağlıysa VE bu anime serinin ilk sezonu DEĞİLSE
          // seri halkası ekle: "Anasayfa › Gintama › Gintama Season 2".
          // İlk sezondaysak seri adı = anime adı olur, tekrar etmeyelim.
          ...(seri &&
          seri.sezonlar.length > 1 &&
          seri.sezonlar[0].id !== anime.id
            ? [{ name: seri.title, path: `/anime/${seri.sezonlar[0].slug}` }]
            : []),
          { name: anime.title, path: `/anime/${anime.slug}` },
        ]}
      />

      {/* --- Kapak --- */}
      <div className="relative h-[52vh] min-h-[360px] w-full">
        {anime.banner_url ? (
          <Image
            src={anime.banner_url}
            alt=""
            fill
            sizes="100vw"
            priority
            className="object-cover"
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/60 to-ink/20" />
      </div>

      <div className="mx-auto -mt-40 max-w-[1400px] px-4 pb-16 md:px-10">
        <div className="flex flex-col gap-8 md:flex-row">
          {/* Afiş */}
          <div className="relative z-10 aspect-[2/3] w-40 shrink-0 overflow-hidden rounded-xl shadow-2xl ring-1 ring-white/10 md:w-60">
            {anime.poster_url ? (
              <Image
                src={anime.poster_url}
                alt={`${anime.title} afişi`}
                fill
                sizes="240px"
                className="object-cover"
              />
            ) : null}
          </div>

          {/* Bilgiler */}
          <div className="relative z-10 flex-1">
            <h1 className="text-3xl font-extrabold tracking-tight md:text-5xl">
              {anime.title}
            </h1>
            {anime.title_japanese ? (
              <p className="mt-1 text-sm text-zinc-500">{anime.title_japanese}</p>
            ) : null}

            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-zinc-300">
              {anime.score ? (
                <span className="flex items-center gap-1 font-semibold text-amber-400">
                  <Star size={14} fill="currentColor" /> {anime.score.toFixed(2)}
                </span>
              ) : null}
              {anime.year ? <span>{anime.year}</span> : null}
              {anime.type ? <span>{anime.type}</span> : null}
              {anime.duration_min ? <span>{anime.duration_min} dk</span> : null}
              <span className="rounded border border-zinc-700 px-2 py-0.5 text-xs">
                {anime.status === "airing"
                  ? "Devam Ediyor"
                  : anime.status === "upcoming"
                    ? "Yakında"
                    : "Tamamlandı"}
              </span>
            </div>

            {anime.genres.length > 0 ? (
              <ul className="mt-4 flex flex-wrap gap-2">
                {anime.genres.map((g) => (
                  <li
                    key={g.id}
                    className="rounded-full bg-white/10 px-3 py-1 text-xs text-zinc-200"
                  >
                    {g.name}
                  </li>
                ))}
              </ul>
            ) : null}

            <p className="mt-5 max-w-3xl leading-relaxed text-zinc-300">
              {anime.synopsis ?? "Özet bulunmuyor."}
            </p>

            {anime.studios.length > 0 ? (
              <p className="mt-4 text-sm text-zinc-500">
                <span className="text-zinc-400">Stüdyo:</span>{" "}
                {anime.studios.join(", ")}
              </p>
            ) : null}

            <div className="mt-6 flex flex-wrap gap-3">
              {bolumler.items.length > 0 ? (
                <Link
                  href={`/anime/${anime.slug}/bolum/${bolumler.items[0].number}`}
                  className="inline-flex items-center gap-2 rounded bg-brand px-6 py-2.5 font-semibold transition-colors hover:bg-brand-hi"
                >
                  <Play size={18} fill="currentColor" /> 1. Bölümü İzle
                </Link>
              ) : null}
              <TrailerButton trailerUrl={anime.trailer_url} />
              <WatchlistButton animeId={anime.id} />
            </div>
          </div>
        </div>

        {/* --- Bölüm listesi --- */}
        <section className="mt-14">
          <h2 className="mb-4 text-2xl font-bold">
            Bölümler{" "}
            <span className="text-base font-normal text-zinc-500">
              ({bolumler.total})
            </span>
          </h2>

          {bolumler.items.length === 0 ? (
            <p className="rounded-lg border border-ink-line bg-ink-soft p-6 text-zinc-400">
              Bu seri için henüz bölüm eklenmemiş.
            </p>
          ) : (
            <ul className="grid gap-2">
              {bolumler.items.map((ep) => (
                <li key={ep.id}>
                  <Link
                    href={`/anime/${anime.slug}/bolum/${ep.number}`}
                    className="group flex items-center gap-3 rounded-lg border border-ink-line bg-ink-soft/60 p-2.5 transition-colors hover:border-zinc-600 hover:bg-ink-soft sm:gap-4 sm:p-3"
                  >
                    {/* Kapak varsa göster; yoksa numara rozetine düş.
                        Aktarımda 19.907 bölüm kapağı geliyor. */}
                    {ep.thumbnail_url ? (
                      <span className="relative block aspect-video w-28 shrink-0 overflow-hidden rounded-md bg-ink sm:w-36">
                        <Image
                          src={ep.thumbnail_url}
                          alt=""
                          fill
                          sizes="144px"
                          loading="lazy"
                          className="object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                        <span className="absolute inset-0 grid place-items-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                          <Play size={20} fill="currentColor" />
                        </span>
                        <span className="absolute left-1 top-1 rounded bg-black/75 px-1.5 py-0.5 text-[11px] font-semibold">
                          {ep.number}
                        </span>
                      </span>
                    ) : (
                      <span className="grid size-10 shrink-0 place-items-center rounded-md bg-white/10 text-sm font-semibold">
                        {ep.number}
                      </span>
                    )}

                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-zinc-100">
                        {ep.title ?? `${ep.number}. Bölüm`}
                      </span>
                      <span className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-zinc-500">
                        {ep.air_date ? (
                          <span>
                            {new Date(ep.air_date).toLocaleDateString("tr-TR")}
                          </span>
                        ) : null}
                        {ep.duration_sec ? (
                          <span>{Math.round(ep.duration_sec / 60)} dk</span>
                        ) : null}
                      </span>
                    </span>

                    <Play
                      size={16}
                      className="shrink-0 text-zinc-600 transition-colors group-hover:text-white"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {/* Uzun serilerde bölüm listesi de sayfalanıyor */}
          <Pagination
            page={bolumler.page}
            totalPages={bolumler.totalPages}
            basePath={`/anime/${anime.slug}`}
            sayfaAnahtari="bs"
          />
        </section>

        {seri ? (
          <SeasonTabs
            seriTitle={seri.title}
            sezonlar={seri.sezonlar}
            aktifId={anime.id}
          />
        ) : null}

        <CharacterList karakterler={karakterler} />

        {benzerler.length > 0 ? (
          <section className="mt-14">
            <h2 className="mb-4 text-2xl font-bold">Benzer Animeler</h2>
            <div className="flex flex-wrap gap-x-3 gap-y-6">
              {benzerler.map((a, i) => (
                <AnimeCard key={a.id} anime={a} index={i} />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </article>
  );
}
