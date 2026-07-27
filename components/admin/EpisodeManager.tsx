"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Check, ClipboardPaste, Loader2, Save, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Episode, VideoSource } from "@/lib/types";

const SOURCES: { value: VideoSource; label: string; hint: string }[] = [
  { value: "embed", label: "Embed", hint: "iframe URL'i (üçüncü parti oynatıcı)" },
  { value: "mux", label: "Mux", hint: "Playback ID" },
  { value: "cloudinary", label: "Cloudinary", hint: "mp4/webm dosya URL'i" },
  { value: "hls", label: "HLS", hint: ".m3u8 URL'i" },
];

interface Draft {
  video_url: string;
  mux_playback_id: string;
  source: VideoSource;
}

export function EpisodeManager({
  animeId,
  animeSlug,
  episodes,
}: {
  animeId: string;
  animeSlug: string;
  episodes: Episode[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [drafts, setDrafts] = useState<Record<string, Draft>>(() =>
    Object.fromEntries(
      episodes.map((e) => [
        e.id,
        {
          video_url: e.video_url ?? "",
          mux_playback_id: e.mux_playback_id ?? "",
          source: e.source,
        },
      ]),
    ),
  );

  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkSource, setBulkSource] = useState<VideoSource>("embed");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const setDraft = (id: string, patch: Partial<Draft>) =>
    setDrafts((d) => ({ ...d, [id]: { ...d[id], ...patch } }));

  /**
   * Toplu yapıştırma: her satır sırayla bir bölüme atanır.
   * "12 https://..." biçimi de desteklenir — baştaki sayı bölüm
   * numarası sayılır, böylece eksik/atlanmış bölümler doğru eşleşir.
   */
  const applyBulk = () => {
    const lines = bulkText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    const next = { ...drafts };
    let sirali = 0;

    for (const line of lines) {
      const eslesme = line.match(/^(\d+)[\s,;|\t]+(.+)$/);
      let ep: Episode | undefined;
      let url: string;

      if (eslesme) {
        ep = episodes.find((e) => e.number === Number(eslesme[1]));
        url = eslesme[2].trim();
      } else {
        ep = episodes[sirali++];
        url = line;
      }

      if (!ep) continue;
      next[ep.id] = {
        ...next[ep.id],
        video_url: url,
        source: bulkSource,
        ...(bulkSource === "mux" ? { mux_playback_id: url, video_url: "" } : {}),
      };
    }

    setDrafts(next);
    setBulkOpen(false);
    setBulkText("");
  };

  const kaydet = async () => {
    setSaving(true);
    setError(null);
    setSaved(null);

    const supabase = createClient();

    // Sadece gerçekten değişmiş bölümleri gönder
    const degisenler = episodes.filter((e) => {
      const d = drafts[e.id];
      return (
        d.video_url !== (e.video_url ?? "") ||
        d.mux_playback_id !== (e.mux_playback_id ?? "") ||
        d.source !== e.source
      );
    });

    if (degisenler.length === 0) {
      setSaving(false);
      setSaved(0);
      return;
    }

    // upsert yerine tek tek update: mevcut satırların diğer alanlarına
    // (title, air_date, view_count) dokunmamak için.
    for (const e of degisenler) {
      const d = drafts[e.id];
      const { error: err } = await supabase
        .from("episodes")
        .update({
          source: d.source,
          video_url: d.video_url.trim() || null,
          mux_playback_id: d.mux_playback_id.trim() || null,
        })
        .eq("id", e.id);

      if (err) {
        setError(`${e.number}. bölüm kaydedilemedi: ${err.message}`);
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    setSaved(degisenler.length);
    startTransition(() => router.refresh());
  };

  const doluSayisi = episodes.filter((e) => {
    const d = drafts[e.id];
    return d.source === "mux" ? d.mux_playback_id : d.video_url;
  }).length;

  if (episodes.length === 0) {
    return (
      <p className="rounded-lg border border-ink-line bg-ink-soft p-6 text-zinc-400">
        Bu anime için bölüm kaydı yok. Yönetim panelinden tekrar aktarın.
      </p>
    );
  }

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Video Kaynakları</h2>
          <p className="text-sm text-zinc-500">
            {doluSayisi}/{episodes.length} bölümde kaynak tanımlı
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setBulkOpen((v) => !v)}
            className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm font-medium transition-colors hover:bg-white/20"
          >
            <ClipboardPaste size={15} /> Toplu yapıştır
          </button>
          <button
            onClick={kaydet}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold transition-colors hover:bg-brand-hi disabled:opacity-50"
          >
            {saving ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Save size={15} />
            )}
            Kaydet
          </button>
        </div>
      </div>

      {/* Toplu yapıştırma paneli */}
      {bulkOpen ? (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="mb-4 overflow-hidden rounded-lg border border-ink-line bg-ink-soft p-4"
        >
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <label className="text-sm text-zinc-300">Kaynak türü:</label>
            <select
              value={bulkSource}
              onChange={(e) => setBulkSource(e.target.value as VideoSource)}
              className="rounded-lg border border-ink-line bg-ink px-3 py-1.5 text-sm outline-none focus:border-brand"
            >
              {SOURCES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <textarea
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            rows={8}
            placeholder={
              "Her satıra bir URL — sırayla bölümlere atanır:\n" +
              "https://ornek.com/bolum1\n" +
              "https://ornek.com/bolum2\n\n" +
              "Ya da bölüm numarasıyla eşleştirin:\n" +
              "1 https://ornek.com/bolum1\n" +
              "5 https://ornek.com/bolum5"
            }
            className="w-full resize-y rounded-lg border border-ink-line bg-ink px-3 py-2 font-mono text-xs outline-none focus:border-brand"
          />

          <div className="mt-3 flex gap-2">
            <button
              onClick={applyBulk}
              disabled={!bulkText.trim()}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold hover:bg-brand-hi disabled:opacity-40"
            >
              Uygula
            </button>
            <button
              onClick={() => setBulkOpen(false)}
              className="rounded-lg bg-white/10 px-4 py-2 text-sm hover:bg-white/20"
            >
              Vazgeç
            </button>
          </div>
          <p className="mt-2 text-xs text-zinc-600">
            Uygula sadece formu doldurur — veritabanına yazmak için
            &quot;Kaydet&quot;e basın.
          </p>
        </motion.div>
      ) : null}

      {saved !== null ? (
        <p className="mb-4 flex items-center gap-2 rounded-lg bg-emerald-950/60 p-3 text-sm text-emerald-300">
          <Check size={16} />
          {saved === 0
            ? "Değişiklik yok."
            : `${saved} bölüm kaydedildi.`}
        </p>
      ) : null}

      {error ? (
        <p className="mb-4 flex items-center gap-2 rounded-lg bg-red-950/60 p-3 text-sm text-red-300">
          <X size={16} /> {error}
        </p>
      ) : null}

      {/* Bölüm listesi */}
      <ul className="space-y-2">
        {episodes.map((e) => {
          const d = drafts[e.id];
          const mux = d.source === "mux";
          const dolu = mux ? d.mux_playback_id : d.video_url;

          return (
            <li
              key={e.id}
              className="grid gap-2 rounded-lg border border-ink-line bg-ink-soft/50 p-3 sm:grid-cols-[3rem_9rem_1fr]"
            >
              <div className="flex items-center gap-2">
                <span
                  className={`grid size-8 place-items-center rounded-md text-sm font-semibold ${
                    dolu ? "bg-emerald-600/25 text-emerald-300" : "bg-white/10"
                  }`}
                >
                  {e.number}
                </span>
              </div>

              <select
                value={d.source}
                onChange={(ev) =>
                  setDraft(e.id, { source: ev.target.value as VideoSource })
                }
                className="rounded-lg border border-ink-line bg-ink px-2 py-2 text-sm outline-none focus:border-brand"
              >
                {SOURCES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>

              <div className="min-w-0">
                <input
                  value={mux ? d.mux_playback_id : d.video_url}
                  onChange={(ev) =>
                    setDraft(
                      e.id,
                      mux
                        ? { mux_playback_id: ev.target.value }
                        : { video_url: ev.target.value },
                    )
                  }
                  placeholder={SOURCES.find((s) => s.value === d.source)?.hint}
                  className="w-full rounded-lg border border-ink-line bg-ink px-3 py-2 text-sm outline-none placeholder:text-zinc-700 focus:border-brand"
                />
                <p className="mt-1 truncate text-xs text-zinc-600">
                  {e.title ?? `${e.number}. Bölüm`}
                  {" · "}
                  <a
                    href={`/anime/${animeSlug}/bolum/${e.number}`}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-zinc-400 hover:underline"
                  >
                    sayfayı aç
                  </a>
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
