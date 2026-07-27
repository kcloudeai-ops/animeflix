import type { Metadata } from "next";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { tumKoleksiyonlar } from "@/lib/collections";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Anime Koleksiyonları — En İyi Listeler",
  description:
    "Türe, yıla ve puana göre hazırlanmış anime listeleri: en iyi aksiyon animeleri, yılın en iyileri, en iyi anime filmleri ve daha fazlası.",
  alternates: { canonical: "/koleksiyon" },
};

export default function KoleksiyonlarPage() {
  const koleksiyonlar = tumKoleksiyonlar();

  return (
    <div className="mx-auto max-w-[1200px] px-4 pb-20 pt-24 md:px-8">
      <header className="mb-8">
        <h1 className="flex items-center gap-2 text-3xl font-extrabold tracking-tight md:text-4xl">
          <Sparkles size={28} className="text-brand" /> Koleksiyonlar
        </h1>
        <p className="mt-1 text-zinc-400">
          Türe, yıla ve puana göre özenle hazırlanmış anime listeleri.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {koleksiyonlar.map((k) => (
          <Link
            key={k.slug}
            href={`/koleksiyon/${k.slug}`}
            className="group rounded-xl border border-ink-line bg-ink-soft/60 p-5 transition-colors hover:border-brand hover:bg-ink-soft"
          >
            <h2 className="font-semibold text-zinc-100 transition-colors group-hover:text-brand">
              {k.baslik}
            </h2>
            <p className="mt-1.5 line-clamp-2 text-sm text-zinc-500">
              {k.aciklama}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
