"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { trType } from "@/lib/genre-names";

interface Hit {
  id: string;
  slug: string;
  title: string;
  year: number | null;
  type: string | null;
  score: number | null;
  poster_url: string | null;
}

export function SearchBar() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  // Açılınca odaklan
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Dışarı tıklama + Escape
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const { data: results = [], isFetching } = useQuery({
    queryKey: ["search", debounced],
    enabled: open && debounced.trim().length >= 2,
    staleTime: 60_000,
    queryFn: async (): Promise<Hit[]> => {
      const res = await fetch(`/api/search?q=${encodeURIComponent(debounced)}`);
      const json = await res.json();
      return json.results ?? [];
    },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (q.trim().length < 2) return;
    setOpen(false);
    router.push(`/ara?q=${encodeURIComponent(q.trim())}`);
  };

  return (
    <div ref={boxRef} className="relative">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          aria-label="Ara"
          className="text-zinc-300 transition-colors hover:text-white"
        >
          <Search size={20} />
        </button>
      ) : (
        <form onSubmit={submit} className="relative">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
          />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Anime ara…"
            className="w-[min(60vw,320px)] rounded-lg border border-ink-line bg-ink/90 py-2 pl-9 pr-8 text-sm outline-none backdrop-blur placeholder:text-zinc-600 focus:border-brand"
          />
          <button
            type="button"
            onClick={() => {
              setQ("");
              setOpen(false);
            }}
            aria-label="Aramayı kapat"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
          >
            {isFetching ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <X size={15} />
            )}
          </button>
        </form>
      )}

      <AnimatePresence>
        {open && debounced.trim().length >= 2 ? (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full z-50 mt-2 w-[min(90vw,380px)] overflow-hidden rounded-xl border border-ink-line bg-ink-soft/95 shadow-2xl backdrop-blur-lg"
          >
            {results.length === 0 ? (
              <p className="p-4 text-sm text-zinc-500">
                {isFetching ? "Aranıyor…" : "Sonuç bulunamadı."}
              </p>
            ) : (
              <>
                <ul className="max-h-[60vh] overflow-y-auto p-1.5">
                  {results.map((hit) => (
                    <li key={hit.id}>
                      <Link
                        href={`/anime/${hit.slug}`}
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-white/10"
                      >
                        <div className="relative h-16 w-11 shrink-0 overflow-hidden rounded bg-ink">
                          {hit.poster_url ? (
                            <Image
                              src={hit.poster_url}
                              alt=""
                              fill
                              sizes="44px"
                              className="object-cover"
                            />
                          ) : null}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm text-zinc-100">
                            {hit.title}
                          </p>
                          <p className="text-xs text-zinc-500">
                            {[hit.year, trType(hit.type), hit.score?.toFixed(1)]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={submit}
                  className="w-full border-t border-ink-line p-2.5 text-sm text-zinc-400 transition-colors hover:bg-white/5 hover:text-white"
                >
                  Tüm sonuçları gör
                </button>
              </>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
