import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AnimeCard } from "@/components/AnimeCard";
import { BreadcrumbJsonLd, ItemListJsonLd } from "@/components/JsonLd";
import { koleksiyonBul, tumKoleksiyonlar } from "@/lib/collections";
import { getKoleksiyonAnimeleri } from "@/lib/queries";

export const revalidate = 86400;

type Props = { params: Promise<{ slug: string }> };

// Tüm koleksiyonlar önceden üretilebilir (sabit, sınırlı sayıda)
export function generateStaticParams() {
  return tumKoleksiyonlar().map((k) => ({ slug: k.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const k = koleksiyonBul(slug);
  if (!k) return { title: "Koleksiyon bulunamadı" };

  return {
    title: k.baslik,
    description: k.aciklama,
    alternates: { canonical: `/koleksiyon/${slug}` },
    openGraph: { title: k.baslik, description: k.aciklama },
  };
}

export default async function KoleksiyonPage({ params }: Props) {
  const { slug } = await params;
  const k = koleksiyonBul(slug);
  if (!k) notFound();

  const animeler = await getKoleksiyonAnimeleri(k.tur, 30);

  return (
    <div className="mx-auto max-w-[1600px] px-4 pb-20 pt-24 md:px-10">
      <ItemListJsonLd name={k.baslik} animeler={animeler} />
      <BreadcrumbJsonLd
        items={[
          { name: "Anasayfa", path: "/" },
          { name: "Koleksiyonlar", path: "/koleksiyon" },
          { name: k.baslik, path: `/koleksiyon/${slug}` },
        ]}
      />

      <header className="mb-8">
        <nav className="mb-3 text-sm text-zinc-500">
          <Link href="/koleksiyon" className="hover:text-white">
            Koleksiyonlar
          </Link>{" "}
          / <span className="text-zinc-300">{k.baslik}</span>
        </nav>
        <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">
          {k.baslik}
        </h1>
        <p className="mt-2 max-w-3xl text-zinc-400">{k.aciklama}</p>
      </header>

      {animeler.length === 0 ? (
        <p className="rounded-lg border border-ink-line bg-ink-soft p-6 text-zinc-400">
          Bu listede henüz içerik yok.
        </p>
      ) : (
        <>
          {/* Sıralı liste — SEO için görünür numaralandırma */}
          <div className="flex flex-wrap gap-x-3 gap-y-6">
            {animeler.map((a, i) => (
              <div key={a.id} className="relative">
                <span className="absolute -left-1 -top-1 z-20 grid size-6 place-items-center rounded-full bg-brand text-xs font-bold text-white shadow">
                  {i + 1}
                </span>
                <AnimeCard anime={a} index={i} />
              </div>
            ))}
          </div>

          {/* Diğer koleksiyonlara iç bağlantı */}
          <section className="mt-14">
            <h2 className="mb-4 text-xl font-bold">Diğer Koleksiyonlar</h2>
            <div className="flex flex-wrap gap-2">
              {tumKoleksiyonlar()
                .filter((x) => x.slug !== slug)
                .slice(0, 12)
                .map((x) => (
                  <Link
                    key={x.slug}
                    href={`/koleksiyon/${x.slug}`}
                    className="rounded-full bg-white/10 px-3 py-1.5 text-sm text-zinc-300 transition-colors hover:bg-white/20 hover:text-white"
                  >
                    {x.baslik}
                  </Link>
                ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
