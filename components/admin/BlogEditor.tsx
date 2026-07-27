"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { Check, Eye, Loader2, Save } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Markdown } from "@/lib/markdown";
import { seoAnaliz } from "@/lib/seo-check";
import { slugify } from "@/lib/slug";
import { MarkdownToolbar } from "./MarkdownToolbar";
import { SeoChecklist } from "./SeoChecklist";
import type { BlogPost } from "@/lib/types";

export function BlogEditor({ post }: { post?: BlogPost }) {
  const router = useRouter();
  const yeni = !post;

  const [title, setTitle] = useState(post?.title ?? "");
  const [slug, setSlug] = useState(post?.slug ?? "");
  const [slugElle, setSlugElle] = useState(!yeni);
  const [excerpt, setExcerpt] = useState(post?.excerpt ?? "");
  const [cover, setCover] = useState(post?.cover_url ?? "");
  const [tags, setTags] = useState((post?.tags ?? []).join(", "));
  const [content, setContent] = useState(post?.content ?? "");
  const [onizleme, setOnizleme] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mesaj, setMesaj] = useState<string | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const contentRef = useRef<HTMLTextAreaElement>(null);

  // Canlı SEO analizi — her tuş vuruşunda yeniden hesaplanır
  const seo = useMemo(
    () =>
      seoAnaliz({
        title,
        slug,
        excerpt,
        content,
        cover,
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
      }),
    [title, slug, excerpt, content, cover, tags],
  );

  const baslikDegis = (v: string) => {
    setTitle(v);
    if (!slugElle) setSlug(slugify(v));
  };

  const kaydet = async (yayinla: boolean) => {
    if (!title.trim() || !content.trim()) {
      setHata("Başlık ve içerik zorunlu.");
      return;
    }
    setBusy(true);
    setHata(null);
    setMesaj(null);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const govde = {
      title: title.trim(),
      slug: slug.trim() || slugify(title),
      excerpt: excerpt.trim() || null,
      cover_url: cover.trim() || null,
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
      content,
      is_published: yayinla,
      ...(yayinla && !post?.published_at
        ? { published_at: new Date().toISOString() }
        : {}),
      ...(yeni ? { author_id: user?.id ?? null } : {}),
    };

    const { data, error } = yeni
      ? await supabase.from("blog_posts").insert(govde).select("id").single()
      : await supabase
          .from("blog_posts")
          .update(govde)
          .eq("id", post!.id)
          .select("id")
          .single();

    setBusy(false);
    if (error) {
      setHata(
        error.code === "23505"
          ? "Bu slug zaten kullanımda."
          : error.message,
      );
      return;
    }

    setMesaj("Kaydedildi.");
    if (yeni && data) router.push(`/admin/blog/${data.id}`);
    else router.refresh();
  };

  const alan =
    "w-full rounded-lg border border-ink-line bg-ink px-3 py-2 text-sm outline-none focus:border-brand";

  return (
    <div className="mx-auto max-w-[1200px] px-4 pb-20 pt-24 md:px-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          {yeni ? "Yeni Yazı" : "Yazıyı Düzenle"}
        </h1>
        <button
          onClick={() => setOnizleme((v) => !v)}
          className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm hover:bg-white/20"
        >
          <Eye size={15} /> {onizleme ? "Düzenle" : "Önizle"}
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div>
      {onizleme ? (
        <article className="rounded-xl border border-ink-line bg-ink-soft/40 p-6">
          <h1 className="text-3xl font-extrabold">{title || "Başlık"}</h1>
          <div className="mt-6">
            <Markdown text={content || "_İçerik yok_"} />
          </div>
        </article>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-zinc-400">Başlık</label>
            <input
              value={title}
              onChange={(e) => baslikDegis(e.target.value)}
              className={alan}
              placeholder="Yazı başlığı"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-zinc-400">
              Slug (URL)
            </label>
            <input
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value);
                setSlugElle(true);
              }}
              className={alan}
              placeholder="yazi-url-adresi"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm text-zinc-400">
                Kapak görsel URL
              </label>
              <input
                value={cover}
                onChange={(e) => setCover(e.target.value)}
                className={alan}
                placeholder="https://…"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-zinc-400">
                Etiketler (virgülle)
              </label>
              <input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                className={alan}
                placeholder="haber, öneri"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm text-zinc-400">
              Özet (liste + arama açıklaması)
            </label>
            <textarea
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              rows={2}
              className={`${alan} resize-none`}
              placeholder="Kısa özet…"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-zinc-400">İçerik</label>
            {/* Biçimlendirme araç çubuğu — tıklayınca markdown ekler */}
            <MarkdownToolbar areaRef={contentRef} onChange={setContent} />
            <textarea
              ref={contentRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={20}
              className="w-full resize-y rounded-b-lg border border-ink-line bg-ink px-3 py-2 font-mono text-[13px] outline-none focus:border-brand"
              placeholder="## Giriş&#10;&#10;Yazınız buraya… Metni seçip üstteki butonlarla biçimlendirin."
            />
          </div>
        </div>
      )}

        </div>

        {/* Sağ sütun: canlı SEO paneli (önizlemede gizli) */}
        {!onizleme ? (
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <SeoChecklist sonuc={seo} />
          </aside>
        ) : null}
      </div>

      {hata ? (
        <p className="mt-4 rounded-lg bg-red-950/60 p-3 text-sm text-red-300">
          {hata}
        </p>
      ) : null}
      {mesaj ? (
        <p className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-950/60 p-3 text-sm text-emerald-300">
          <Check size={16} /> {mesaj}
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-2">
        <button
          onClick={() => kaydet(false)}
          disabled={busy}
          className="flex items-center gap-2 rounded-lg bg-white/10 px-5 py-2.5 text-sm font-semibold hover:bg-white/20 disabled:opacity-50"
        >
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          Taslak Kaydet
        </button>
        <button
          onClick={() => {
            if (seo.puan < 50) {
              const devam = confirm(
                `SEO puanı düşük (${seo.puan}/100). Yine de yayınlansın mı?`,
              );
              if (!devam) return;
            }
            kaydet(true);
          }}
          disabled={busy}
          className="flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold hover:bg-brand-hi disabled:opacity-50"
        >
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
          Yayınla
        </button>

        {/* Puan rozeti */}
        <span
          className={`ml-auto flex items-center gap-1.5 self-center rounded-lg px-3 py-1.5 text-xs font-semibold ${
            seo.puan >= 80
              ? "bg-emerald-950/60 text-emerald-300"
              : seo.puan >= 50
                ? "bg-amber-950/60 text-amber-300"
                : "bg-red-950/60 text-red-300"
          }`}
        >
          SEO {seo.puan}/100
        </span>
      </div>
    </div>
  );
}
