import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { AnimeCard } from "@/components/AnimeCard";
import { CardSkeleton } from "@/components/Skeletons";
import { Pagination } from "@/components/Pagination";
import {
  getAnimesByGenre,
  getGenreBySlug,
  getGenres,
  sayfaNo,
} from "@/lib/queries";
import { trGenre } from "@/lib/genre-names";
import { BreadcrumbJsonLd } from "@/components/JsonLd";

export const revalidate = 3600;

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ sayfa?: string }>;
};

export async function generateMetadata({
  params,
  searchParams,
}: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = sayfaNo((await searchParams).sayfa);
  const data = await getAnimesByGenre(slug, page);
  if (!data) return { title: "Kategori bulunamadı" };

  const ad = trGenre(data.genre.name);
  const ek = page > 1 ? ` — Sayfa ${page}` : "";
  const title = `${ad} Anime İzle${ek}`;
  const description = `${ad} türündeki ${data.total} anime serisini Türkçe altyazılı ve HD kalitede izleyin.`;

  return {
    title,
    description,
    alternates: {
      canonical:
        page > 1 ? `/kategori/${slug}?sayfa=${page}` : `/kategori/${slug}`,
    },
    openGraph: { title, description, url: `/kategori/${slug}` },
    robots: page > 1 ? { index: false, follow: true } : undefined,
  };
}

/** Izgara Suspense içinde akar; tür kontrolü dışarıda kaldı. */
async function Grid({ slug, page }: { slug: string; page: number }) {
  const data = await getAnimesByGenre(slug, page);
  if (!data || data.items.length === 0) {
    return (
      <p className="rounded-lg border border-ink-line bg-ink-soft p-6 text-zinc-400">
        Bu kategoride bu sayfada içerik yok.
      </p>
    );
  }

  return (
    <>
      <div className="flex flex-wrap gap-x-3 gap-y-6">
        {data.items.map((a, i) => (
          <AnimeCard key={a.id} anime={a} index={i} />
        ))}
      </div>

      <Pagination
        page={page}
        totalPages={data.totalPages}
        basePath={`/kategori/${slug}`}
      />
    </>
  );
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const page = sayfaNo((await searchParams).sayfa);

  // Tür yoksa AKIŞ BAŞLAMADAN 404 ver — aksi hâlde durum kodu 200'de kalır.
  const [genre, allGenres] = await Promise.all([
    getGenreBySlug(slug),
    getGenres(),
  ]);

  if (!genre) notFound();

  const ad = trGenre(genre.name);
  const toplam = allGenres.find((g) => g.slug === slug)?.count ?? 0;

  return (
    <div className="mx-auto max-w-[1600px] px-4 pb-20 pt-24 md:px-10">
      <BreadcrumbJsonLd
        items={[
          { name: "Anasayfa", path: "/" },
          { name: ad, path: `/kategori/${slug}` },
        ]}
      />

      <header className="mb-6">
        <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">
          {ad}
        </h1>
        <p className="mt-1 text-zinc-400">
          {toplam} seri · puana göre sıralı
        </p>
      </header>

      <nav className="mb-8 flex flex-wrap gap-2">
        {allGenres.map((g) => (
          <Link
            key={g.id}
            href={`/kategori/${g.slug}`}
            className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
              g.slug === slug
                ? "bg-brand font-semibold text-white"
                : "bg-white/10 text-zinc-300 hover:bg-white/20"
            }`}
          >
            {trGenre(g.name)}
            <span className="ml-1.5 text-xs opacity-60">{g.count}</span>
          </Link>
        ))}
      </nav>

      <Suspense
        key={`${slug}-${page}`}
        fallback={
          <div className="flex flex-wrap gap-x-3 gap-y-6">
            {Array.from({ length: 18 }, (_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        }
      >
        <Grid slug={slug} page={page} />
      </Suspense>
    </div>
  );
}
