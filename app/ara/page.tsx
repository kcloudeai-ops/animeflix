import type { Metadata } from "next";
import { Suspense } from "react";
import { AnimeCard } from "@/components/AnimeCard";
import { CardSkeleton } from "@/components/Skeletons";
import { Pagination } from "@/components/Pagination";
import { searchAnimes, sayfaNo } from "@/lib/queries";

type Props = { searchParams: Promise<{ q?: string; sayfa?: string }> };

export async function generateMetadata({
  searchParams,
}: Props): Promise<Metadata> {
  const { q } = await searchParams;
  return {
    title: q ? `"${q}" için arama sonuçları` : "Arama",
    // Arama sonuç sayfaları indekslenmemeli (ince/yinelenen içerik)
    robots: { index: false, follow: true },
  };
}

async function Results({ q, page }: { q: string; page: number }) {
  const { items, total, totalPages } = await searchAnimes(q, page);

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-ink-line bg-ink-soft p-6">
        <p className="text-zinc-300">
          <strong>{q}</strong> için sonuç bulunamadı.
        </p>
        <p className="mt-1 text-sm text-zinc-500">
          Farklı bir yazım deneyin ya da Keşfet sayfasından göz atın.
        </p>
      </div>
    );
  }

  return (
    <>
      <p className="mb-6 text-sm text-zinc-500">
        {total} sonuç
        {totalPages > 1 ? ` · sayfa ${page}/${totalPages}` : ""}
      </p>

      <div className="flex flex-wrap gap-x-3 gap-y-6">
        {items.map((a, i) => (
          <AnimeCard key={a.id} anime={a} index={i} />
        ))}
      </div>

      <Pagination
        page={page}
        totalPages={totalPages}
        basePath="/ara"
        params={{ q }}
      />
    </>
  );
}

export default async function SearchPage({ searchParams }: Props) {
  const { q = "", sayfa } = await searchParams;
  const page = sayfaNo(sayfa);

  return (
    <div className="mx-auto max-w-[1600px] px-4 pb-20 pt-24 md:px-10">
      <header className="mb-6">
        <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">
          {q ? <>&ldquo;{q}&rdquo;</> : "Arama"}
        </h1>
      </header>

      {q.trim().length < 2 ? (
        <p className="text-zinc-400">Aramak için en az iki harf yazın.</p>
      ) : (
        <Suspense
          key={`${q}-${page}`}
          fallback={
            <div className="flex flex-wrap gap-x-3 gap-y-6">
              {Array.from({ length: 12 }, (_, i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
          }
        >
          <Results q={q} page={page} />
        </Suspense>
      )}
    </div>
  );
}
