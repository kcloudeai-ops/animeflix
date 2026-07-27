"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { CalendarDays, Play } from "lucide-react";
import { useState } from "react";
import type { TakvimGunu } from "@/lib/queries";

const GUN_ADI = ["PAZ", "PZT", "SAL", "ÇAR", "PER", "CUM", "CMT"];
const AY_ADI = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

/** "2026-07-23" -> Date. Saat eklemek yerel/UTC kaymasını önler. */
const gunDate = (s: string) => new Date(`${s}T12:00:00`);

export function ScheduleView({
  gunler,
  bugun,
}: {
  gunler: TakvimGunu[];
  bugun: string;
}) {
  // Bugün pencerede varsa onunla başla
  const bugunIdx = gunler.findIndex((g) => g.tarih === bugun);
  const [secili, setSecili] = useState(bugunIdx >= 0 ? bugunIdx : 0);

  const aktif = gunler[secili];
  const toplam = gunler.reduce((t, g) => t + g.bolumler.length, 0);

  if (toplam === 0) {
    return (
      <div className="rounded-lg border border-ink-line bg-ink-soft p-6">
        <p className="flex items-center gap-2 text-zinc-300">
          <CalendarDays size={18} /> Bu hafta için yayın bilgisi yok.
        </p>
        <p className="mt-2 text-sm text-zinc-500">
          Takvim verisi AniList&apos;ten çekilir. Yönetici olarak{" "}
          <code className="rounded bg-ink px-1.5 py-0.5">
            npm run fetch:schedule
          </code>{" "}
          komutunu çalıştırın.
        </p>
      </div>
    );
  }

  // Saate göre grupla — "20:00 · 3 bölüm" başlıkları için
  const saatler = new Map<string, typeof aktif.bolumler>();
  for (const b of aktif.bolumler) {
    const saat = b.air_at
      ? new Date(b.air_at).toLocaleTimeString("tr-TR", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "—";
    if (!saatler.has(saat)) saatler.set(saat, []);
    saatler.get(saat)!.push(b);
  }

  const ay = gunDate(gunler[0].tarih);

  return (
    <>
      <p className="mb-3 text-sm font-medium text-zinc-400">
        {AY_ADI[ay.getMonth()]} {ay.getFullYear()}
      </p>

      {/* Gün seçici */}
      <div className="no-scrollbar mb-8 flex gap-2 overflow-x-auto pb-1">
        {gunler.map((g, i) => {
          const d = gunDate(g.tarih);
          const seciliMi = i === secili;
          const bugunMu = g.tarih === bugun;

          return (
            <button
              key={g.tarih}
              onClick={() => setSecili(i)}
              aria-current={seciliMi}
              className={`relative min-w-[84px] shrink-0 rounded-xl border p-3 text-center transition-colors ${
                seciliMi
                  ? "border-brand bg-brand/15"
                  : "border-ink-line bg-ink-soft/60 hover:border-zinc-600"
              }`}
            >
              <span
                className={`block text-xs font-semibold ${
                  bugunMu ? "text-brand" : "text-zinc-500"
                }`}
              >
                {GUN_ADI[d.getDay()]}
              </span>
              <span className="mt-0.5 block text-xl font-bold">
                {d.getDate()}
              </span>
              <span className="mt-0.5 block text-[11px] text-zinc-500">
                {g.bolumler.length} bölüm
              </span>
              {bugunMu ? (
                <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-brand" />
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Seçili günün bölümleri */}
      {aktif.bolumler.length === 0 ? (
        <p className="rounded-lg border border-ink-line bg-ink-soft p-6 text-zinc-400">
          Bu gün için planlanmış bölüm yok.
        </p>
      ) : (
        <div className="space-y-8">
          {[...saatler.entries()].map(([saat, liste]) => (
            <section key={saat}>
              <div className="mb-3 flex items-baseline gap-3">
                <h2 className="text-lg font-bold tabular-nums">{saat}</h2>
                <span className="text-sm text-zinc-500">
                  {liste.length} bölüm
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {liste.map((b, i) => {
                  const gelecek = b.air_at
                    ? new Date(b.air_at).getTime() > Date.now()
                    : false;

                  return (
                    <motion.div
                      key={b.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.28, delay: Math.min(i, 8) * 0.03 }}
                    >
                      <Link
                        href={
                          gelecek
                            ? `/anime/${b.anime.slug}`
                            : `/anime/${b.anime.slug}/bolum/${b.number}`
                        }
                        className="group flex gap-3 rounded-xl border border-ink-line bg-ink-soft/60 p-3 transition-colors hover:border-zinc-600 hover:bg-ink-soft"
                      >
                        <div className="relative aspect-[2/3] w-16 shrink-0 overflow-hidden rounded-md bg-ink">
                          {b.anime.poster_url ? (
                            <Image
                              src={b.anime.poster_url}
                              alt=""
                              fill
                              sizes="64px"
                              loading="lazy"
                              className="object-cover"
                            />
                          ) : null}
                        </div>

                        <div className="min-w-0 flex-1">
                          <h3 className="line-clamp-2 text-sm font-medium text-zinc-100 transition-colors group-hover:text-white">
                            {b.anime.title}
                          </h3>
                          <p className="mt-1 text-xs text-zinc-400">
                            {b.number}. Bölüm
                          </p>
                          <span
                            className={`mt-1.5 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium ${
                              gelecek
                                ? "bg-white/10 text-zinc-400"
                                : "bg-emerald-600/20 text-emerald-300"
                            }`}
                          >
                            {gelecek ? (
                              "Yakında"
                            ) : (
                              <>
                                <Play size={9} fill="currentColor" /> Yayında
                              </>
                            )}
                          </span>
                        </div>
                      </Link>
                    </motion.div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
