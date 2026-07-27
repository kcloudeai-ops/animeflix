"use client";

import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import type { CanliPage, CanliAkisSonuc } from "./live-types";

/**
 * "Şu an bakılan sayfalar" — 10 saniyede bir tazelenir. Her yolda kaç
 * benzersiz ziyaretçi aktif (son 5 dk) gösterilir; canlı hissini
 * polling ile verir.
 */
export function LiveFeed({ ilk }: { ilk: CanliAkisSonuc }) {
  const { data } = useQuery({
    queryKey: ["canli-akis"],
    initialData: ilk,
    refetchInterval: 10_000,
    queryFn: async (): Promise<CanliAkisSonuc> => {
      const res = await fetch("/api/admin/analiz-ozet");
      if (!res.ok) return { sayfalar: [], son: [] };
      return (await res.json()).akis ?? { sayfalar: [], son: [] };
    },
  });

  const sayfalar: CanliPage[] = data?.sayfalar ?? [];

  return (
    <section className="rounded-xl border border-ink-line bg-ink-soft/60 p-5">
      <div className="mb-4 flex items-center gap-2">
        <h2 className="text-sm font-semibold text-zinc-300">
          Şu An Bakılan Sayfalar
        </h2>
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
        </span>
      </div>

      {sayfalar.length === 0 ? (
        <p className="text-sm text-zinc-500">
          Son 5 dakikada aktif ziyaretçi yok.
        </p>
      ) : (
        <ul className="space-y-2">
          <AnimatePresence initial={false}>
            {sayfalar.map((p) => (
              <motion.li
                key={p.path}
                layout
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-3 text-sm"
              >
                <span className="min-w-0 flex-1 truncate text-zinc-300">
                  {p.path}
                </span>
                <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-950/50 px-2 py-0.5 text-xs font-semibold text-emerald-300">
                  <span className="size-1.5 rounded-full bg-emerald-400" />
                  {p.aktif}
                </span>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </section>
  );
}
