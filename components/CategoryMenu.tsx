"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { FEATURED_GENRES, trGenre } from "@/lib/genre-names";

interface Genre {
  id: string;
  name: string;
  slug: string;
  count: number;
}

export function CategoryMenu() {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const { data: genres = [] } = useQuery({
    queryKey: ["genres"],
    staleTime: 10 * 60_000, // türler nadiren değişir
    queryFn: async (): Promise<Genre[]> => {
      const res = await fetch("/api/genres");
      const json = await res.json();
      return json.genres ?? [];
    },
  });

  // Dışarı tıklayınca ve Escape ile kapat
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (genres.length === 0) return null;

  // Öne çıkan türler önce, kalanlar alfabetik
  const ordered = [...genres].sort((a, b) => {
    const ia = FEATURED_GENRES.indexOf(a.name);
    const ib = FEATURED_GENRES.indexOf(b.name);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.name.localeCompare(b.name, "tr");
  });

  return (
    <div ref={boxRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
        className="flex items-center gap-1 text-sm text-zinc-300 transition-colors hover:text-white"
      >
        Kategoriler
        <ChevronDown
          size={15}
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 top-full z-50 mt-3 w-[min(92vw,560px)] rounded-xl border border-ink-line bg-ink-soft/95 p-3 shadow-2xl backdrop-blur-lg"
          >
            <ul className="grid grid-cols-2 gap-1 sm:grid-cols-3">
              {ordered.map((g) => (
                <li key={g.id}>
                  <Link
                    href={`/kategori/${g.slug}`}
                    onClick={() => setOpen(false)}
                    className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-zinc-300 transition-colors hover:bg-white/10 hover:text-white"
                  >
                    <span className="truncate">{trGenre(g.name)}</span>
                    <span className="ml-2 shrink-0 text-xs text-zinc-600">
                      {g.count}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
