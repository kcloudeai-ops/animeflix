"use client";

import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  Download,
  Layers,
  Loader2,
  Search,
  TriangleAlert,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface Candidate {
  mal_id: number;
  title: string;
  year?: number | null;
  episodes?: number | null;
  image?: string;
}

type ItemStatus = "pending" | "running" | "done" | "error";

interface QueueItem extends Candidate {
  status: ItemStatus;
  message?: string;
}

/** Serbest metinden MAL ID'leri ayıklar: "1, 20 5114" -> [1,20,5114] */
function parseIds(text: string): number[] {
  const ids = (text.match(/\d+/g) ?? []).map(Number).filter((n) => n > 0);
  return [...new Set(ids)]; // tekrarları ele
}

export function AnimeImporter() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [running, setRunning] = useState(false);
  const cancelRef = useRef(false);

  // Kuyruğun güncel hali: runQueue döngüsü state closure'ına takılmadan
  // en son listeyi okuyabilsin diye ref'te aynalanır.
  const queueRef = useRef<QueueItem[]>([]);
  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 400);
    return () => clearTimeout(t);
  }, [query]);

  const typedIds = parseIds(query);
  const isIdInput = /^[\d\s,]+$/.test(query.trim()) && typedIds.length > 0;

  // --- Başlık araması (Jikan ?q= kesintide olabilir) ---
  const search = useQuery({
    queryKey: ["jikan-search", debounced],
    enabled: debounced.trim().length >= 2 && !isIdInput,
    queryFn: async (): Promise<{
      results: Candidate[];
      unavailable: boolean;
    }> => {
      const res = await fetch(
        `/api/admin/search?q=${encodeURIComponent(debounced)}`,
      );
      const json = await res.json();
      return { results: json.results ?? [], unavailable: !!json.unavailable };
    },
  });

  // --- Kuyruğu doldur ---
  const enqueue = (items: Candidate[]) => {
    setQueue((prev) => {
      // `seen` hem mevcut kuyruğu hem de bu partinin içindeki tekrarları
      // kapsamalı: Jikan aynı mal_id'yi tek listede iki kez döndürebiliyor.
      // Sadece `prev`e bakarsak parti içi tekrarlar sızar, React'te çift
      // key hatası verir ve aynı anime iki kez aktarılır.
      const seen = new Set(prev.map((i) => i.mal_id));
      const fresh: QueueItem[] = [];

      for (const item of items) {
        if (seen.has(item.mal_id)) continue;
        seen.add(item.mal_id);
        fresh.push({ ...item, status: "pending" });
      }

      return [...prev, ...fresh];
    });
  };

  const loadCatalog = async (source: "top" | "season") => {
    const res = await fetch(`/api/admin/catalog?source=${source}`);
    const json = await res.json();
    if (json.items?.length) enqueue(json.items);
    else alert(json.error ?? "Liste alınamadı.");
  };

  // --- Kuyruğu sırayla işle ---
  // Her anime için ayrı istek atılır: sunucu zaman aşımı riski yok ve
  // ilerleme canlı görünür. Jikan rate limit'i sunucuda zaten uygulanıyor.
  const runQueue = async () => {
    setRunning(true);
    cancelRef.current = false;

    for (const item of queueRef.current) {
      if (cancelRef.current) break;
      if (item.status === "done") continue;

      setQueue((q) =>
        q.map((i) =>
          i.mal_id === item.mal_id ? { ...i, status: "running" } : i,
        ),
      );

      try {
        const res = await fetch("/api/admin/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ malId: item.mal_id }),
        });
        const json = await res.json();

        if (!res.ok) throw new Error(json.error ?? "Aktarılamadı");

        setQueue((q) =>
          q.map((i) =>
            i.mal_id === item.mal_id
              ? {
                  ...i,
                  status: "done",
                  title: json.anime?.title ?? i.title,
                  message: json.warning
                    ? `${json.episodeCount} bölüm · ${json.warning}`
                    : `${json.episodeCount} bölüm`,
                }
              : i,
          ),
        );
      } catch (err) {
        setQueue((q) =>
          q.map((i) =>
            i.mal_id === item.mal_id
              ? {
                  ...i,
                  status: "error",
                  message: err instanceof Error ? err.message : "Hata",
                }
              : i,
          ),
        );
      }
    }

    setRunning(false);
    router.refresh();
  };

  const stats = {
    pending: queue.filter((i) => i.status === "pending").length,
    done: queue.filter((i) => i.status === "done").length,
    error: queue.filter((i) => i.status === "error").length,
  };

  return (
    <section className="rounded-xl border border-ink-line bg-ink-soft/60 p-5">
      <h2 className="text-lg font-semibold">Jikan API&apos;den İçe Aktar</h2>
      <p className="mt-1 text-sm text-zinc-400">
        Anime adı, tek bir MyAnimeList ID&apos;si ya da birden fazla ID
        (virgülle ayırarak) girebilirsiniz.
      </p>

      {/* --- Hazır listeler --- */}
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          onClick={() => loadCatalog("top")}
          disabled={running}
          className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm font-medium transition-colors hover:bg-white/20 disabled:opacity-40"
        >
          <Layers size={15} /> Popüler 25&apos;i kuyruğa al
        </button>
        <button
          onClick={() => loadCatalog("season")}
          disabled={running}
          className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm font-medium transition-colors hover:bg-white/20 disabled:opacity-40"
        >
          <Layers size={15} /> Bu sezonu kuyruğa al
        </button>
      </div>

      {/* --- Arama / ID kutusu --- */}
      <div className="relative mt-4">
        <Search
          size={18}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Örn: Frieren  ·  52991  ·  1, 20, 5114, 9253"
          className="w-full rounded-lg border border-ink-line bg-ink py-2.5 pl-10 pr-4 text-sm outline-none transition-colors placeholder:text-zinc-600 focus:border-brand"
        />
        {search.isFetching ? (
          <Loader2
            size={16}
            className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-zinc-500"
          />
        ) : null}
      </div>

      {isIdInput ? (
        <button
          onClick={() => {
            enqueue(
              typedIds.map((id) => ({ mal_id: id, title: `MAL #${id}` })),
            );
            setQuery("");
          }}
          disabled={running}
          className="mt-3 flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold transition-colors hover:bg-brand-hi disabled:opacity-50"
        >
          <Download size={16} />
          {typedIds.length === 1
            ? `MAL ID ${typedIds[0]} ekle`
            : `${typedIds.length} ID'yi kuyruğa ekle`}
        </button>
      ) : null}

      {search.data?.unavailable ? (
        <p className="mt-3 flex items-center gap-2 rounded-lg bg-amber-950/50 p-3 text-sm text-amber-200">
          <TriangleAlert size={16} className="shrink-0" />
          Jikan arama servisi şu an yanıt vermiyor. MyAnimeList ID&apos;si
          yazarak ya da yukarıdaki hazır listelerle devam edebilirsiniz.
        </p>
      ) : null}

      {/* --- Arama sonuçları --- */}
      <AnimatePresence mode="popLayout">
        {search.data && search.data.results.length > 0 ? (
          <motion.ul
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 grid gap-2 overflow-hidden"
          >
            {search.data.results.map((hit) => (
              <li
                key={hit.mal_id}
                className="flex items-center gap-3 rounded-lg border border-ink-line bg-ink p-2.5"
              >
                {hit.image ? (
                  <div className="relative size-14 shrink-0 overflow-hidden rounded">
                    <Image
                      src={hit.image}
                      alt=""
                      fill
                      sizes="56px"
                      className="object-cover"
                    />
                  </div>
                ) : null}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{hit.title}</p>
                  <p className="text-xs text-zinc-500">
                    MAL #{hit.mal_id}
                    {hit.year ? ` · ${hit.year}` : ""}
                    {hit.episodes ? ` · ${hit.episodes} bölüm` : ""}
                  </p>
                </div>
                <button
                  onClick={() => enqueue([hit])}
                  className="shrink-0 rounded-md bg-white/10 px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-brand"
                >
                  Kuyruğa ekle
                </button>
              </li>
            ))}
          </motion.ul>
        ) : null}
      </AnimatePresence>

      {/* --- Kuyruk --- */}
      {queue.length > 0 ? (
        <div className="mt-6 rounded-lg border border-ink-line bg-ink p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold">
              Kuyruk ({queue.length})
              <span className="ml-2 font-normal text-zinc-500">
                {stats.done} tamam · {stats.pending} bekliyor
                {stats.error > 0 ? ` · ${stats.error} hata` : ""}
              </span>
            </p>

            <div className="flex gap-2">
              {running ? (
                <button
                  onClick={() => (cancelRef.current = true)}
                  className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/20"
                >
                  Durdur
                </button>
              ) : (
                <>
                  <button
                    onClick={() => setQueue([])}
                    className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/20"
                  >
                    Temizle
                  </button>
                  <button
                    onClick={runQueue}
                    disabled={stats.pending === 0 && stats.error === 0}
                    className="flex items-center gap-1.5 rounded-lg bg-brand px-4 py-1.5 text-xs font-semibold transition-colors hover:bg-brand-hi disabled:opacity-40"
                  >
                    <Download size={14} />
                    {stats.pending === 0 && stats.error > 0
                      ? `${stats.error} hatalıyı tekrar dene`
                      : "Hepsini aktar"}
                  </button>
                </>
              )}
            </div>
          </div>

          {running ? (
            <div className="mt-3 h-1 overflow-hidden rounded-full bg-ink-line">
              <motion.div
                className="h-full bg-brand"
                animate={{
                  width: `${(stats.done / Math.max(queue.length, 1)) * 100}%`,
                }}
                transition={{ duration: 0.3 }}
              />
            </div>
          ) : null}

          <ul className="mt-3 max-h-80 space-y-1.5 overflow-y-auto">
            {queue.map((item) => (
              <li
                key={item.mal_id}
                className="flex items-start gap-2.5 rounded-md px-2 py-1.5 text-sm"
              >
                <span className="mt-0.5 shrink-0">
                  {item.status === "running" ? (
                    <Loader2 size={15} className="animate-spin text-zinc-400" />
                  ) : item.status === "done" ? (
                    <Check size={15} className="text-emerald-400" />
                  ) : item.status === "error" ? (
                    <X size={15} className="text-red-400" />
                  ) : (
                    <span className="block size-[15px] rounded-full border border-zinc-700" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-zinc-200">
                    {item.title}
                  </span>
                  {item.message ? (
                    <span
                      className={`block text-xs ${
                        item.status === "error"
                          ? "text-red-400"
                          : "text-zinc-500"
                      }`}
                    >
                      {item.message}
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
