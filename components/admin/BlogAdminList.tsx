"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ExternalLink, Loader2, Pencil, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { BlogPost } from "@/lib/types";

export function BlogAdminList({ posts }: { posts: BlogPost[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const yayinDurumu = async (p: BlogPost) => {
    setBusyId(p.id);
    const supabase = createClient();
    const yeni = !p.is_published;
    const { error } = await supabase
      .from("blog_posts")
      .update({
        is_published: yeni,
        // İlk kez yayınlanıyorsa yayın tarihini şimdi ayarla
        published_at: yeni && !p.published_at ? new Date().toISOString() : p.published_at,
      })
      .eq("id", p.id);
    setBusyId(null);
    if (error) return alert(`Hata: ${error.message}`);
    startTransition(() => router.refresh());
  };

  const sil = async (p: BlogPost) => {
    if (!confirm(`"${p.title}" silinecek. Emin misiniz?`)) return;
    setBusyId(p.id);
    const supabase = createClient();
    const { error } = await supabase.from("blog_posts").delete().eq("id", p.id);
    setBusyId(null);
    if (error) return alert(`Hata: ${error.message}`);
    startTransition(() => router.refresh());
  };

  if (posts.length === 0) {
    return (
      <p className="rounded-lg border border-ink-line bg-ink-soft/60 p-6 text-zinc-400">
        Henüz yazı yok. &quot;Yeni Yazı&quot; ile başlayın.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-ink-line">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="bg-ink-soft text-left text-xs uppercase tracking-wide text-zinc-500">
          <tr>
            <th className="p-3">Başlık</th>
            <th className="p-3">Durum</th>
            <th className="p-3 text-right">İşlem</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-line">
          {posts.map((p) => (
            <tr key={p.id} className="transition-colors hover:bg-ink-soft/40">
              <td className="max-w-[380px] p-3">
                <span className="block truncate font-medium">{p.title}</span>
                <span className="text-xs text-zinc-600">/{p.slug}</span>
              </td>
              <td className="p-3">
                <button
                  onClick={() => yayinDurumu(p)}
                  disabled={busyId === p.id}
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${
                    p.is_published
                      ? "bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30"
                      : "bg-zinc-700/50 text-zinc-400 hover:bg-zinc-700"
                  }`}
                >
                  {busyId === p.id ? "…" : p.is_published ? "Yayında" : "Taslak"}
                </button>
              </td>
              <td className="p-3">
                <div className="flex items-center justify-end gap-1">
                  {p.is_published ? (
                    <Link
                      href={`/blog/${p.slug}`}
                      target="_blank"
                      aria-label="Görüntüle"
                      className="rounded p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white"
                    >
                      <ExternalLink size={15} />
                    </Link>
                  ) : null}
                  <Link
                    href={`/admin/blog/${p.id}`}
                    aria-label="Düzenle"
                    className="rounded p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white"
                  >
                    <Pencil size={15} />
                  </Link>
                  <button
                    onClick={() => sil(p)}
                    disabled={busyId === p.id}
                    aria-label="Sil"
                    className="rounded p-1.5 text-zinc-400 hover:bg-red-950 hover:text-red-400"
                  >
                    {busyId === p.id ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <Trash2 size={15} />
                    )}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
