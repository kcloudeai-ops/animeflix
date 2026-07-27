import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { ArticleJsonLd, BreadcrumbJsonLd } from "@/components/JsonLd";
import { Markdown } from "@/lib/markdown";
import { getBlogPost } from "@/lib/queries";

export const revalidate = 600;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getBlogPost(slug);
  if (!post) return { title: "Yazı bulunamadı" };

  const description =
    post.excerpt ?? post.content.replace(/[#*>`]/g, "").slice(0, 155);

  return {
    title: post.title,
    description,
    alternates: { canonical: `/blog/${slug}` },
    openGraph: {
      type: "article",
      title: post.title,
      description,
      publishedTime: post.published_at ?? undefined,
      images: post.cover_url ? [{ url: post.cover_url }] : [],
    },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = await getBlogPost(slug);
  if (!post) notFound();

  const description =
    post.excerpt ?? post.content.replace(/[#*>`]/g, "").slice(0, 160);
  const tarih = (post.published_at ?? post.created_at)
    ? new Date(post.published_at ?? post.created_at).toLocaleDateString(
        "tr-TR",
        { year: "numeric", month: "long", day: "numeric" },
      )
    : "";

  return (
    <article className="mx-auto max-w-[760px] px-4 pb-20 pt-24 md:px-6">
      <ArticleJsonLd
        title={post.title}
        description={description}
        slug={post.slug}
        coverUrl={post.cover_url}
        publishedAt={post.published_at}
        updatedAt={post.updated_at}
      />
      <BreadcrumbJsonLd
        items={[
          { name: "Anasayfa", path: "/" },
          { name: "Blog", path: "/blog" },
          { name: post.title, path: `/blog/${post.slug}` },
        ]}
      />

      <nav className="mb-4 text-sm text-zinc-500">
        <Link href="/blog" className="hover:text-white">
          Blog
        </Link>{" "}
        / <span className="text-zinc-300">{post.title}</span>
      </nav>

      <h1 className="text-3xl font-extrabold leading-tight tracking-tight md:text-4xl">
        {post.title}
      </h1>

      <p className="mt-3 flex items-center gap-1.5 text-sm text-zinc-500">
        <CalendarDays size={14} /> {tarih}
      </p>

      {post.tags.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-2">
          {post.tags.map((t) => (
            <li
              key={t}
              className="rounded-full bg-white/10 px-3 py-1 text-xs text-zinc-300"
            >
              {t}
            </li>
          ))}
        </ul>
      ) : null}

      {post.cover_url ? (
        <div className="relative mt-6 aspect-[16/9] overflow-hidden rounded-xl bg-ink-soft">
          <Image
            src={post.cover_url}
            alt=""
            fill
            priority
            sizes="760px"
            className="object-cover"
          />
        </div>
      ) : null}

      <div className="mt-8 text-[17px]">
        <Markdown text={post.content} />
      </div>

      <div className="mt-12 border-t border-ink-line pt-6">
        <Link
          href="/blog"
          className="text-sm text-brand hover:underline"
        >
          ← Tüm yazılar
        </Link>
      </div>
    </article>
  );
}
