import { Suspense } from "react";
import { HeroBanner } from "@/components/HeroBanner";
import { AnimeCarousel } from "@/components/AnimeCarousel";
import { ContinueRow } from "@/components/ContinueRow";
import { CarouselSkeleton, HeroSkeleton } from "@/components/Skeletons";
import { LatestEpisodes } from "@/components/LatestEpisodes";
import { SiteJsonLd } from "@/components/JsonLd";
import { getFeaturedAnimes, getHomeRows, getLatestEpisodes } from "@/lib/queries";

// Sayfa statik üretilir, saatte bir arka planda tazelenir.
// "İzlemeye Devam Et" kullanıcıya özel olduğu için istemcide çekiliyor;
// sunucuda okunsaydı bu sayfa dinamik olur ve hiç önbelleğe alınamazdı.
export const revalidate = 3600;

async function Hero() {
  const slaytlar = await getFeaturedAnimes(8);

  if (slaytlar.length === 0) {
    return (
      <div className="grid h-[60vh] place-items-center px-6 text-center">
        <div>
          <h1 className="text-3xl font-bold">Henüz içerik yok</h1>
          <p className="mt-2 text-zinc-400">
            Yönetici panelinden anime aktarın:{" "}
            <code className="rounded bg-ink-soft px-1.5 py-0.5">/admin</code>
          </p>
        </div>
      </div>
    );
  }

  return <HeroBanner slaytlar={slaytlar} />;
}

async function Latest() {
  // İlk sekme ("Tümü") sunucuda hazırlanır: akış ilk boyamada dolu gelir,
  // sekme değiştirilince istemci /api/latest-episodes'a gider.
  const ilk = await getLatestEpisodes("hepsi");
  return <LatestEpisodes ilk={ilk} />;
}

async function Rows() {
  const rows = await getHomeRows();
  return (
    <>
      {rows.map((row) => (
        <AnimeCarousel key={row.title} title={row.title} items={row.items} />
      ))}
    </>
  );
}

export default function HomePage() {
  return (
    <>
      <SiteJsonLd />

      <Suspense fallback={<HeroSkeleton />}>
        <Hero />
      </Suspense>

      {/* Hafif bindirme: hero kısaldığı için eski -mt-24 metnin üstüne
          çıkıyordu. Gradyan zaten geçişi yumuşattığı için bu kadarı yeter. */}
      <div className="relative z-10 -mt-4 md:-mt-6">
        {/* Kişisel satır: istemcide yüklenir, sayfayı dinamikleştirmez */}
        <ContinueRow />

        <Suspense fallback={<CarouselSkeleton count={6} />}>
          <Latest />
        </Suspense>

        <Suspense
          fallback={
            <>
              <CarouselSkeleton />
              <CarouselSkeleton />
            </>
          }
        >
          <Rows />
        </Suspense>
      </div>
    </>
  );
}
