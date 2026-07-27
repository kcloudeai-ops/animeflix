"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { FEATURED_GENRES, trGenre } from "@/lib/genre-names";

interface Genre {
  id: string;
  name: string;
  slug: string;
  count: number;
}

/**
 * Mobil gezinme. Masaüstü menüsü `hidden md:flex` olduğu için
 * telefonda hiçbir bağlantı görünmüyordu — bu bileşen o boşluğu kapatır.
 */
export function MobileMenu({
  links,
}: {
  links: { href: string; label: string }[];
}) {
  const [open, setOpen] = useState(false);

  const { data: genres = [] } = useQuery({
    queryKey: ["genres"],
    staleTime: 10 * 60_000,
    enabled: open, // menü açılana kadar istek atma
    queryFn: async (): Promise<Genre[]> => {
      const res = await fetch("/api/genres");
      return (await res.json()).genres ?? [];
    },
  });

  // Panel açıkken arka planın kaymasını engelle
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const oneCikan = [...genres]
    .sort((a, b) => {
      const ia = FEATURED_GENRES.indexOf(a.name);
      const ib = FEATURED_GENRES.indexOf(b.name);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return b.count - a.count;
    })
    .slice(0, 12);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Menüyü aç"
        aria-expanded={open}
        className="text-zinc-300 transition-colors hover:text-white md:hidden"
      >
        <Menu size={22} />
      </button>

      <AnimatePresence>
        {open ? (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm md:hidden"
            />

            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 34 }}
              className="fixed left-0 top-0 z-[70] flex h-dvh w-[min(84vw,320px)] flex-col border-r border-ink-line bg-ink-soft md:hidden"
            >
              <div className="flex items-center justify-between border-b border-ink-line p-4">
                <span className="text-xl font-extrabold tracking-tight text-brand">
                  ANIME<span className="text-white">FLIX</span>
                </span>
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Menüyü kapat"
                  className="p-1 text-zinc-400 hover:text-white"
                >
                  <X size={20} />
                </button>
              </div>

              <nav className="flex-1 overflow-y-auto p-4">
                <ul className="space-y-1">
                  {links.map((l) => (
                    <li key={l.href}>
                      <Link
                        href={l.href}
                        onClick={() => setOpen(false)}
                        className="block rounded-lg px-3 py-2.5 text-base text-zinc-200 transition-colors hover:bg-white/10"
                      >
                        {l.label}
                      </Link>
                    </li>
                  ))}
                  <li>
                    <Link
                      href="/profil"
                      onClick={() => setOpen(false)}
                      className="block rounded-lg px-3 py-2.5 text-base text-zinc-200 transition-colors hover:bg-white/10"
                    >
                      Profilim
                    </Link>
                  </li>
                </ul>

                {oneCikan.length > 0 ? (
                  <>
                    <p className="mb-2 mt-6 px-3 text-xs uppercase tracking-wide text-zinc-600">
                      Kategoriler
                    </p>
                    <ul className="grid grid-cols-2 gap-1">
                      {oneCikan.map((g) => (
                        <li key={g.id}>
                          <Link
                            href={`/kategori/${g.slug}`}
                            onClick={() => setOpen(false)}
                            className="block truncate rounded-lg px-3 py-2 text-sm text-zinc-400 transition-colors hover:bg-white/10 hover:text-white"
                          >
                            {trGenre(g.name)}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}
              </nav>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </>
  );
}
