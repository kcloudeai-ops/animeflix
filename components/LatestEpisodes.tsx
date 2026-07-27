"use client";

import Image from "next/image";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Clock, Play } from "lucide-react";
import { useState } from "react";
import type { BolumAkis, ZamanAraligi } from "@/lib/queries";

const SEKMELER: { key: ZamanAraligi; label: string }[] = [
  { key: "hepsi", label: "Tümü" },
  { key: "bugun", label: "Bugün" },
  { key: "hafta", label: "Bu Hafta" },
  { key: "ay", label: "Bu Ay" },
];

/** "3 saat önce", "2 gün önce" — mutlak tarihe göre daha okunur. */
function gecenSure(tarih: string | null): string {
  if (!tarih) return "";
  const fark = Date.now() - new Date(tarih).getTime();
  const dk = Math.floor(fark / 60000);
  if (dk < 1) return "az önce";
  if (dk < 60) return `${dk} dakika önce`;
  const saat = Math.floor(dk / 60);
  if (saat < 24) return `${saat} saat önce`;
  const gun = Math.floor(saat / 24);
  if (gun < 30) return `${gun} gün önce`;
  const ay = Math.floor(gun / 30);
  if (ay < 12) return `${ay} ay önce`;
  return `${Math.floor(ay / 12)} yıl önce`;
}

export function LatestEpisodes({ ilk }: { ilk: BolumAkis[] }) {
  const [aralik, setAralik] = useState<ZamanAraligi>("hepsi");

  const { data: bolumler = [], isFetching } = useQuery({
    queryKey: ["latest-episodes", aralik],
    staleTime: 5 * 60_000,
    // "hepsi" sunucudan geldi; ilk boyamada ağ isteği yapma
    initialData: aralik === "hepsi" ? ilk : undefined,
    queryFn: async (): Promise<BolumAkis[]> => {
      const res = await fetch(`/api/latest-episodes?aralik=${aralik}`);
      return (await res.json()).items ?? [];
    },
  });

  if (ilk.length === 0) return null;

  return (
    <section className="py-5">
      <div className="mb-3 flex flex-wrap items-center gap-3 px-4 md:px-10">
        <h2 className="text-lg font-bold text-zinc-100 md:text-xl">
          Son Eklenen Bölümler
        </h2>

        <div className="flex gap-1.5">
          {SEKMELER.map((s) => (
            <button
              key={s.key}
              onClick={() => setAralik(s.key)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                aralik === s.key
                  ? "bg-brand text-white"
                  : "bg-white/10 text-zinc-400 hover:bg-white/20 hover:text-white"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {bolumler.length === 0 ? (
        <p className="px-4 text-sm text-zinc-500 md:px-10">
          {isFetching ? "Yükleniyor…" : "Bu aralıkta yeni bölüm yok."}
        </p>
      ) : (
        <div className="no-scrollbar flex gap-3 overflow-x-auto scroll-smooth px-4 pb-4 md:px-10">
          {bolumler.map((b, i) => (
            <motion.div
              key={b.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: Math.min(i, 8) * 0.03 }}
              className="group w-[260px] shrink-0"
            >
              <Link
                href={`/anime/${b.anime.slug}/bolum/${b.number}`}
                className="block"
              >
                <div className="relative aspect-video overflow-hidden rounded-lg bg-ink-soft ring-1 ring-white/5">
                  {b.thumbnail_url || b.anime.poster_url ? (
                    <Image
                      src={b.thumbnail_url ?? b.anime.poster_url ?? ""}
                      alt=""
                      fill
                      sizes="260px"
                      loading={i < 4 ? "eager" : "lazy"}
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : null}

                  <span className="absolute inset-0 grid place-items-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                    <span className="grid size-11 place-items-center rounded-full bg-white text-black">
                      <Play size={16} fill="currentColor" />
                    </span>
                  </span>

                  <span className="absolute left-2 top-2 rounded bg-brand px-1.5 py-0.5 text-[11px] font-bold">
                    {b.number}. Bölüm
                  </span>
                </div>

                <h3 className="mt-2 line-clamp-1 text-sm font-medium text-zinc-200 transition-colors group-hover:text-white">
                  {b.anime.title}
                </h3>
                <p className="line-clamp-1 text-xs text-zinc-500">
                  {b.title ?? `${b.number}. Bölüm`}
                </p>
                <p className="mt-0.5 flex items-center gap-1 text-xs text-zinc-600">
                  <Clock size={11} /> {gecenSure(b.air_at ?? b.air_date)}
                </p>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </section>
  );
}
