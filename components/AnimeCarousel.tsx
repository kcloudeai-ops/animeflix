"use client";

import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AnimeCard } from "./AnimeCard";
import type { Anime } from "@/lib/types";

export function AnimeCarousel({
  title,
  items,
}: {
  title: string;
  items: Anime[];
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const scrollBy = (dir: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: "smooth" });
  };

  const onScroll = () => {
    const el = trackRef.current;
    if (!el) return;
    setAtStart(el.scrollLeft < 8);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 8);
  };

  if (items.length === 0) return null;

  return (
    <section className="group/row relative py-5">
      <h2 className="mb-3 px-4 text-lg font-bold text-zinc-100 md:px-10 md:text-xl">
        {title}
      </h2>

      {/* Kaydırma okları — satırın üstüne gelince belirir */}
      <button
        onClick={() => scrollBy(-1)}
        disabled={atStart}
        aria-label="Geri kaydır"
        className="absolute left-0 top-1/2 z-30 hidden h-[62%] w-10 -translate-y-1/2 place-items-center bg-gradient-to-r from-ink to-transparent opacity-0 transition-opacity group-hover/row:opacity-100 disabled:!opacity-0 md:grid"
      >
        <ChevronLeft size={32} />
      </button>
      <button
        onClick={() => scrollBy(1)}
        disabled={atEnd}
        aria-label="İleri kaydır"
        className="absolute right-0 top-1/2 z-30 hidden h-[62%] w-10 -translate-y-1/2 place-items-center bg-gradient-to-l from-ink to-transparent opacity-0 transition-opacity group-hover/row:opacity-100 disabled:!opacity-0 md:grid"
      >
        <ChevronRight size={32} />
      </button>

      <div
        ref={trackRef}
        onScroll={onScroll}
        className="no-scrollbar flex gap-3 overflow-x-auto scroll-smooth px-4 pb-6 pt-2 md:px-10"
      >
        {items.map((a, i) => (
          <AnimeCard key={a.id} anime={a} index={i} />
        ))}
      </div>
    </section>
  );
}
