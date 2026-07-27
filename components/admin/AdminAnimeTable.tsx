"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ExternalLink,
  ListVideo,
  Loader2,
  Pencil,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Anime } from "@/lib/types";

export function AdminAnimeTable({ animes }: { animes: Anime[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Anime | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Tembel oluşturma: env yokken render anında istemci kurmak
  // "@supabase/ssr: URL and API key are required" hatasıyla sayfayı düşürür.
  const getSupabase = () => createClient();

  const patch = async (id: string, values: Partial<Anime>) => {
    setBusyId(id);
    const { error } = await getSupabase()
      .from("animes")
      .update(values)
      .eq("id", id);
    setBusyId(null);
    if (error) return alert(`Güncellenemedi: ${error.message}`);
    startTransition(() => router.refresh());
  };

  const remove = async (anime: Anime) => {
    if (!confirm(`"${anime.title}" ve tüm bölümleri silinecek. Emin misiniz?`))
      return;
    setBusyId(anime.id);
    const { error } = await getSupabase()
      .from("animes")
      .delete()
      .eq("id", anime.id);
    setBusyId(null);
    if (error) return alert(`Silinemedi: ${error.message}`);
    startTransition(() => router.refresh());
  };

  if (animes.length === 0) {
    return (
      <p className="rounded-lg border border-ink-line bg-ink-soft/60 p-6 text-zinc-400">
        Kütüphane boş. Yukarıdaki kutudan bir anime aktarın.
      </p>
    );
  }

  return (
    <>
      <div className="overflow-x-auto rounded-xl border border-ink-line">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-ink-soft text-left text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="p-3">Başlık</th>
              <th className="p-3">MAL</th>
              <th className="p-3">Bölüm</th>
              <th className="p-3">Yayında</th>
              <th className="p-3">Öne Çıkan</th>
              <th className="p-3 text-right">İşlem</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-line">
            {animes.map((a) => (
              <tr key={a.id} className="transition-colors hover:bg-ink-soft/40">
                <td className="max-w-[280px] p-3">
                  <Link
                    href={`/anime/${a.slug}`}
                    target="_blank"
                    className="flex items-center gap-1.5 truncate font-medium hover:text-brand"
                  >
                    {a.title}
                    <ExternalLink size={12} className="shrink-0 opacity-50" />
                  </Link>
                  <span className="text-xs text-zinc-600">{a.slug}</span>
                </td>
                <td className="p-3 text-zinc-400">#{a.mal_id}</td>
                <td className="p-3 text-zinc-400">{a.total_episodes}</td>
                <td className="p-3">
                  <Toggle
                    on={a.is_published}
                    busy={busyId === a.id}
                    onChange={(v) => patch(a.id, { is_published: v })}
                  />
                </td>
                <td className="p-3">
                  <Toggle
                    on={a.is_featured}
                    busy={busyId === a.id}
                    onChange={(v) => patch(a.id, { is_featured: v })}
                  />
                </td>
                <td className="p-3">
                  <div className="flex items-center justify-end gap-1">
                    <Link
                      href={`/admin/anime/${a.id}`}
                      aria-label="Bölümleri ve video kaynaklarını yönet"
                      title="Bölümler / video kaynakları"
                      className="rounded p-1.5 text-zinc-400 transition-colors hover:bg-white/10 hover:text-white"
                    >
                      <ListVideo size={15} />
                    </Link>
                    <button
                      onClick={() => setEditing(a)}
                      aria-label="SEO düzenle"
                      title="SEO ayarları"
                      className="rounded p-1.5 text-zinc-400 transition-colors hover:bg-white/10 hover:text-white"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => remove(a)}
                      aria-label="Sil"
                      className="rounded p-1.5 text-zinc-400 transition-colors hover:bg-red-950 hover:text-red-400"
                    >
                      {busyId === a.id ? (
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

      <AnimatePresence>
        {editing ? (
          <SeoDrawer
            anime={editing}
            onClose={() => setEditing(null)}
            onSave={async (values) => {
              await patch(editing.id, values);
              setEditing(null);
            }}
          />
        ) : null}
      </AnimatePresence>
    </>
  );
}

function Toggle({
  on,
  busy,
  onChange,
}: {
  on: boolean;
  busy: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      role="switch"
      aria-checked={on}
      disabled={busy}
      onClick={() => onChange(!on)}
      className={`relative h-5 w-9 rounded-full transition-colors disabled:opacity-50 ${
        on ? "bg-brand" : "bg-zinc-700"
      }`}
    >
      <motion.span
        layout
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        className={`absolute top-0.5 size-4 rounded-full bg-white ${
          on ? "left-[18px]" : "left-0.5"
        }`}
      />
    </button>
  );
}

/** Sağdan açılan SEO düzenleme paneli. */
function SeoDrawer({
  anime,
  onClose,
  onSave,
}: {
  anime: Anime;
  onClose: () => void;
  onSave: (values: Partial<Anime>) => Promise<void>;
}) {
  const [title, setTitle] = useState(anime.meta_title ?? "");
  const [desc, setDesc] = useState(anime.meta_description ?? "");
  const [og, setOg] = useState(anime.og_image_url ?? "");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    await onSave({
      meta_title: title || null,
      meta_description: desc || null,
      og_image_url: og || null,
    });
    setSaving(false);
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
      />
      <motion.aside
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 300, damping: 32 }}
        className="fixed right-0 top-0 z-50 flex h-dvh w-full max-w-md flex-col border-l border-ink-line bg-ink-soft p-6"
      >
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold">SEO Ayarları</h3>
            <p className="text-sm text-zinc-500">{anime.title}</p>
          </div>
          <button onClick={onClose} aria-label="Kapat" className="p-1 text-zinc-400">
            <X size={20} />
          </button>
        </div>

        <div className="mt-6 flex-1 space-y-5 overflow-y-auto">
          <Field
            label="Meta Başlık"
            hint={`${title.length}/60 karakter`}
            warn={title.length > 60}
          >
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-ink-line bg-ink px-3 py-2 text-sm outline-none focus:border-brand"
            />
          </Field>

          <Field
            label="Meta Açıklama"
            hint={`${desc.length}/160 karakter`}
            warn={desc.length > 160}
          >
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              rows={4}
              className="w-full resize-none rounded-lg border border-ink-line bg-ink px-3 py-2 text-sm outline-none focus:border-brand"
            />
          </Field>

          <Field label="OpenGraph Görsel URL" hint="1200×630 önerilir">
            <input
              value={og}
              onChange={(e) => setOg(e.target.value)}
              placeholder="https://…"
              className="w-full rounded-lg border border-ink-line bg-ink px-3 py-2 text-sm outline-none focus:border-brand"
            />
          </Field>

          {/* Google sonuç önizlemesi */}
          <div className="rounded-lg border border-ink-line bg-ink p-4">
            <p className="mb-2 text-xs uppercase tracking-wide text-zinc-600">
              Google Önizleme
            </p>
            <p className="text-xs text-emerald-500">
              animeflix.com › anime › {anime.slug}
            </p>
            <p className="mt-0.5 truncate text-[15px] text-blue-400">
              {title || `${anime.title} Türkçe Altyazılı İzle`}
            </p>
            <p className="mt-0.5 line-clamp-2 text-xs text-zinc-400">
              {desc || anime.synopsis?.slice(0, 155) || "Açıklama yok."}
            </p>
          </div>
        </div>

        <button
          onClick={submit}
          disabled={saving}
          className="mt-6 flex items-center justify-center gap-2 rounded-lg bg-brand py-2.5 font-semibold transition-colors hover:bg-brand-hi disabled:opacity-50"
        >
          {saving ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Save size={16} />
          )}
          Kaydet
        </button>
      </motion.aside>
    </>
  );
}

function Field({
  label,
  hint,
  warn,
  children,
}: {
  label: string;
  hint?: string;
  warn?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline justify-between">
        <span className="text-sm font-medium text-zinc-300">{label}</span>
        {hint ? (
          <span className={`text-xs ${warn ? "text-amber-400" : "text-zinc-600"}`}>
            {hint}
          </span>
        ) : null}
      </span>
      {children}
    </label>
  );
}
