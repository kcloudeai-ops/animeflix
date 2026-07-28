"use client";

import Image from "next/image";
import Link from "next/link";
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "framer-motion";
import { Play, Star } from "lucide-react";
import type { PointerEvent } from "react";
import type { Anime } from "@/lib/types";

export function AnimeCard({
  anime,
  index,
  progress,
  href,
  altYazi,
}: {
  anime: Anime;
  index: number;
  /** 0-100; verilirse afişin altında ilerleme çubuğu çizilir. */
  progress?: number | null;
  /** Varsayılan detay sayfası yerine özel hedef (ör. kaldığı bölüm). */
  href?: string;
  /** Başlığın altındaki satırı ezer (ör. "12. bölümde kaldınız"). */
  altYazi?: string;
}) {
  const azalt = useReducedMotion();

  // İmleç konumu (-0.5 … 0.5), yumuşak yaylı takip.
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 180, damping: 18 });
  const sy = useSpring(my, { stiffness: 180, damping: 18 });

  // Eğim (±6°) — imlecin ters yönüne yatar, gerçek kart hissi.
  const rotateY = useTransform(sx, [-0.5, 0.5], [6, -6]);
  const rotateX = useTransform(sy, [-0.5, 0.5], [-6, 6]);
  // Parlama, imlecin bulunduğu noktada toplanır.
  const glareX = useTransform(sx, [-0.5, 0.5], ["0%", "100%"]);
  const glareY = useTransform(sy, [-0.5, 0.5], ["0%", "100%"]);
  const glare = useMotionTemplate`radial-gradient(circle at ${glareX} ${glareY}, rgba(255,255,255,0.18), transparent 55%)`;

  const izle = (e: PointerEvent<HTMLDivElement>) => {
    if (azalt) return;
    const r = e.currentTarget.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width - 0.5);
    my.set((e.clientY - r.top) / r.height - 0.5);
  };
  const sifirla = () => {
    mx.set(0);
    my.set(0);
  };

  return (
    <motion.div
      // `whileInView` KULLANMA: ilk ekranda zaten görünür olan kartlarda
      // IntersectionObserver kaydırma olmadan tetiklenmiyordu ve kartlar
      // opacity:0 takılı kalıyordu — ızgara sayfaları boş görünüyordu.
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index, 8) * 0.04 }}
      whileHover={{ scale: 1.06, zIndex: 20 }}
      onPointerMove={izle}
      onPointerLeave={sifirla}
      style={
        azalt
          ? undefined
          : { rotateX, rotateY, transformStyle: "preserve-3d", perspective: 700 }
      }
      className="group relative w-[160px] shrink-0 md:w-[210px]"
    >
      <Link href={href ?? `/anime/${anime.slug}`} className="block">
        <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-ink-soft ring-1 ring-white/5 transition-shadow duration-300 group-hover:shadow-2xl group-hover:shadow-brand/25">
          {anime.poster_url ? (
            <Image
              src={anime.poster_url}
              alt={`${anime.title} afişi`}
              fill
              sizes="(max-width: 768px) 160px, 210px"
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              // İlk 6 kart LCP'yi etkiler, gerisi tembel yüklenir
              loading={index < 6 ? "eager" : "lazy"}
              priority={index < 3}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-zinc-600">
              Görsel yok
            </div>
          )}

          {/* İmleç takipli parlama — yalnızca hover'da görünür */}
          {!azalt ? (
            <motion.div
              className="pointer-events-none absolute inset-0 opacity-0 mix-blend-soft-light transition-opacity duration-300 group-hover:opacity-100"
              style={{ background: glare }}
            />
          ) : null}

          {/* Hover katmanı */}
          <div className="pointer-events-none absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            <div className="flex items-center gap-2 p-3">
              <span className="grid size-8 place-items-center rounded-full bg-white text-black">
                <Play size={14} fill="currentColor" />
              </span>
              <span className="text-xs text-zinc-300">
                {anime.total_episodes > 0
                  ? `${anime.total_episodes} bölüm`
                  : anime.type ?? "—"}
              </span>
            </div>
          </div>

          {anime.score ? (
            <span className="absolute left-2 top-2 flex items-center gap-1 rounded bg-black/70 px-1.5 py-0.5 text-[11px] font-semibold text-amber-400 backdrop-blur">
              <Star size={10} fill="currentColor" />
              {anime.score.toFixed(1)}
            </span>
          ) : null}

          {/* İzleme ilerlemesi — afişin en altında ince şerit */}
          {progress != null ? (
            <span className="absolute inset-x-0 bottom-0 h-1 bg-black/60">
              <span
                className="block h-full bg-brand"
                style={{ width: `${Math.max(2, Math.min(100, progress))}%` }}
              />
            </span>
          ) : null}
        </div>

        <h3 className="mt-2 line-clamp-2 text-sm font-medium text-zinc-200 transition-colors group-hover:text-white">
          {anime.title}
        </h3>
        <p className="text-xs text-zinc-500">
          {altYazi ?? [anime.year, anime.type].filter(Boolean).join(" • ")}
        </p>
      </Link>
    </motion.div>
  );
}
