import type { Metadata } from "next";
import { Suspense } from "react";
import { AnimeCard } from "@/components/AnimeCard";
import { CardSkeleton } from "@/components/Skeletons";
import { Pagination } from "@/components/Pagination";
import { FilterBar } from "@/components/FilterBar";
import {
  getDiscoverAnimes,
  getFiltreSecenekleri,
  sayfaNo,
  type KesfetFiltre,
  type SiralamaKey,
} from "@/lib/queries";
import type { AnimeStatus } from "@/lib/types";

export const revalidate = 3600;

type Query = {
  sayfa?: string;
  tur?: string;
  yil?: string;
  durum?: string;
  sirala?: string;
};
type Props = { searchParams: Promise<Query> };

const GECERLI_SIRALAMA: SiralamaKey[] = ["puan", "yeni", "populer", "ad"];
const GECERLI_DURUM: AnimeStatus[] = ["airing", "finished", "upcoming"];

/** Bilinmeyen değerleri sessizce düşür — sorguya güvenilmeyen veri gitmesin. */
function filtreCoz(q: Query): KesfetFiltre {
  return {
    tur: q.tur || undefined,
    yil: q.yil || undefined,
    durum: GECERLI_DURUM.includes(q.durum as AnimeStatus)
      ? (q.durum as AnimeStatus)
      : undefined,
    sirala: GECERLI_SIRALAMA.includes(q.sirala as SiralamaKey)
      ? (q.sirala as SiralamaKey)
      : undefined,
  };
}

export async function generateMetadata({
  searchParams,
}: Props): Promise<Metadata> {
  const q = await searchParams;
  const page = sayfaNo(q.sayfa);
  const filtreli = !!(q.tur || q.yil || q.durum || q.sirala);
  const ek = page > 1 ? ` — Sayfa ${page}` : "";

  return {
    title: `Keşfet${ek}`,
    description:
      "Tüm anime serilerine göz atın: türe, yıla ve duruma göre filtreleyin.",
    alternates: { canonical: "/kesfet" },
    // Filtre kombinasyonları sonsuz sayıda URL üretir; sadece temiz
    // sayfa indekslensin, diğerlerinin linkleri yine taransın.
    robots: page > 1 || filtreli ? { index: false, follow: true } : undefined,
  };
}

async function Grid({ page, filtre }: { page: number; filtre: KesfetFiltre }) {
  const { items, total, totalPages } = await getDiscoverAnimes(page, filtre);

  if (items.length === 0) {
    return (
      <p className="rounded-lg border border-ink-line bg-ink-soft p-6 text-zinc-400">
        Bu filtrelerle eşleşen içerik yok. Filtreleri temizleyip tekrar deneyin.
      </p>
    );
  }

  const sp = new URLSearchParams(
    Object.entries(filtre).filter(([, v]) => v) as [string, string][],
  );

  return (
    <>
      <p className="mb-6 text-sm text-zinc-500">
        {total} seri · sayfa {page}/{totalPages}
      </p>

      <div className="flex flex-wrap gap-x-3 gap-y-6">
        {items.map((a, i) => (
          <AnimeCard key={a.id} anime={a} index={i} />
        ))}
      </div>

      <Pagination
        page={page}
        totalPages={totalPages}
        basePath="/kesfet"
        params={Object.fromEntries(sp)}
      />
    </>
  );
}

export default async function DiscoverPage({ searchParams }: Props) {
  const q = await searchParams;
  const page = sayfaNo(q.sayfa);
  const filtre = filtreCoz(q);
  const { turler, yillar } = await getFiltreSecenekleri();

  return (
    <div className="mx-auto max-w-[1600px] px-4 pb-20 pt-24 md:px-10">
      <header className="mb-6">
        <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">
          Keşfet
        </h1>
        <p className="mt-1 text-zinc-400">
          Türe, yıla ve duruma göre filtreleyin.
        </p>
      </header>

      <Suspense fallback={<div className="mb-6 h-10" />}>
        <FilterBar turler={turler} yillar={yillar} />
      </Suspense>

      <Suspense
        key={JSON.stringify({ page, filtre })}
        fallback={
          <div className="flex flex-wrap gap-x-3 gap-y-6">
            {Array.from({ length: 18 }, (_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        }
      >
        <Grid page={page} filtre={filtre} />
      </Suspense>
    </div>
  );
}
