import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { Pagination } from "@/components/Pagination";
import { getBlogPosts, sayfaNo } from "@/lib/queries";

export const revalidate = 600;

type Props = { searchParams: Promise<{ sayfa?: string }> };

export async function generateMetadata({
  searchParams,
}: Props): Promise<Metadata> {
  const page = sayfaNo((await searchParams).sayfa);
  return {
    title: page > 1 ? `Blog — Sayfa ${page}` : "Blog & Haberler",
    description:
      "Anime dünyasından haberler, yeni sezon duyuruları, öneri listeleri ve incelemeler.",
    alternates: { canonical: page > 1 ? `/blog?sayfa=${page}` : "/blog" },
    robots: page > 1 ? { index: false, follow: true } : undefined,
  };
}

const tarih = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString("tr-TR", {
        year: "numeric", month: "long", day: "numeric",
      }) : "";

export default async function BlogPage({ searchParams }: Props) {
  const page = sayfaNo((await searchParams).sayfa);
  const { items, total, totalPages } = await getBlogPosts(page);

  return (
    <div className="mx-auto max-w-[1100px] px-4 pb-20 pt-24 md:px-8">
      <header className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">
          Blog &amp; Haberler
        </h1>
        <p className="mt-1 text-zinc-400">
          Anime dünyasından haberler, öneriler ve incelemeler.
        </p>
      </header>

      {items.length === 0 ? (
        <div className="rounded-lg border border-ink-line bg-ink-soft p-6 text-zinc-400">
          <p>Henüz yazı yayınlanmadı.</p>
          <p className="mt-1 text-sm text-zinc-500">
            Yönetici panelinden ilk yazıyı ekleyin:{" "}
            <code className="rounded bg-ink px-1.5 py-0.5">/admin/blog</code>
          </p>
        </div>
      ) : (
        <>
          <p className="mb-6 text-sm text-zinc-500">{total} yazı</p>

          <div className="grid gap-6 sm:grid-cols-2">
            {items.map((p) => (
              <Link
                key={p.id}
                href={`/blog/${p.slug}`}
                className="group flex flex-col overflow-hidden rounded-xl border border-ink-line bg-ink-soft/60 transition-colors hover:border-zinc-600"
              >
                {p.cover_url ? (
                  <div className="relative aspect-[16/9] overflow-hidden bg-ink">
                    <Image
                      src={p.cover_url}
                      alt=""
                      fill
                      sizes="(max-width:640px) 100vw, 550px"
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>
                ) : null}
                <div className="flex flex-1 flex-col p-5">
                  <h2 className="text-lg font-bold text-zinc-100 transition-colors group-hover:text-brand">
                    {p.title}
                  </h2>
                  {p.excerpt ? (
                    <p className="mt-2 line-clamp-3 flex-1 text-sm text-zinc-400">
                      {p.excerpt}
                    </p>
                  ) : null}
                  <p className="mt-3 flex items-center gap-1.5 text-xs text-zinc-600">
                    <CalendarDays size={12} />
                    {tarih(p.published_at ?? p.created_at)}
                  </p>
                </div>
              </Link>
            ))}
          </div>

          <Pagination page={page} totalPages={totalPages} basePath="/blog" />
        </>
      )}
    </div>
  );
}
