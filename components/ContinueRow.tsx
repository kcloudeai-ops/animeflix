"use client";

import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AnimeCard } from "./AnimeCard";
import type { DevamEden } from "@/lib/queries";

/**
 * "İzlemeye Devam Et" satırı. AnimeCarousel'den farkı: her kart
 * kaldığı bölüme gider ve afişin altında ilerleme çubuğu taşır.
 *
 * Veri sunucuda değil BURADA çekiliyor: kullanıcıya özel olduğu için
 * sunucuda okunsaydı anasayfanın tamamı dinamik olur ve önbelleğe
 * alınamazdı. Böylece sayfa statik kalıyor, bu satır sonradan beliriyor.
 */
export function ContinueRow() {
  const trackRef = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const { data: items = [] } = useQuery({
    queryKey: ["continue-watching"],
    staleTime: 60_000,
    queryFn: async (): Promise<DevamEden[]> => {
      const res = await fetch("/api/continue-watching");
      return (await res.json()).items ?? [];
    },
  });

  if (items.length === 0) return null;

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

  return (
    <section className="group/row relative py-5">
      <h2 className="mb-3 px-4 text-lg font-bold text-zinc-100 md:px-10 md:text-xl">
        İzlemeye Devam Et
      </h2>

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
        {items.map((it, i) => (
          <AnimeCard
            key={it.anime.id}
            anime={it.anime}
            index={i}
            progress={it.percent}
            href={`/anime/${it.anime.slug}/bolum/${it.episodeNumber}`}
            altYazi={
              it.percent != null
                ? `${it.episodeNumber}. bölüm · %${it.percent}`
                : `${it.episodeNumber}. bölümde kaldınız`
            }
          />
        ))}
      </div>
    </section>
  );
}
