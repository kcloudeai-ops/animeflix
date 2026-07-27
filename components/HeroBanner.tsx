"use client";

import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Info, Play } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { HeroSlayt } from "@/lib/queries";

/** Slayt geçiş aralığı. */
const ARALIK_MS = 3000;

export function HeroBanner({ slaytlar }: { slaytlar: HeroSlayt[] }) {
  const [i, setI] = useState(0);
  const [durdu, setDurdu] = useState(false);
  const zamanlayici = useRef<ReturnType<typeof setInterval> | null>(null);

  const ilerle = useCallback(
    (yon: 1 | -1 = 1) =>
      setI((v) => (v + yon + slaytlar.length) % slaytlar.length),
    [slaytlar.length],
  );

  useEffect(() => {
    if (slaytlar.length < 2 || durdu) return;

    // Hareket azaltma tercihi olan kullanıcılarda otomatik geçiş yapma
    const azalt = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (azalt) return;

    zamanlayici.current = setInterval(() => ilerle(1), ARALIK_MS);
    return () => {
      if (zamanlayici.current) clearInterval(zamanlayici.current);
    };
  }, [slaytlar.length, durdu, ilerle]);

  if (slaytlar.length === 0) return null;

  const { anime, gercekBanner } = slaytlar[i];
  const ozet = (anime.synopsis ?? "").slice(0, 220);

  return (
    <section
      // Yükseklik `vh` yerine EN-BOY ORANINA bağlı: banner'lar 2.6–3.2:1
      // geliyor, oysa vh tabanlı yükseklik dar/uzun pencerelerde 1.5:1'e
      // düşüp görseli aşırı kırpıyordu. 16/7 (≈2.29:1) kaynağa yakın.
      // `max-h` çok geniş ekranlarda hero'nun ekranı yutmasını engeller.
      // min-h metin bloğunun sığmasına göre belirlendi: badge + başlık +
      // künye + özet + düğmeler ≈ 320px, üstte 64px sabit navbar var.
      className="relative aspect-[16/7] max-h-[78vh] min-h-[520px] w-full overflow-hidden"
      onMouseEnter={() => setDurdu(true)}
      onMouseLeave={() => setDurdu(false)}
      onFocusCapture={() => setDurdu(true)}
      onBlurCapture={() => setDurdu(false)}
      aria-roledescription="carousel"
      aria-label="Öne çıkan animeler"
    >
      <AnimatePresence mode="sync">
        <motion.div
          key={anime.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.7, ease: "easeInOut" }}
          className="absolute inset-0"
        >
          {gercekBanner ? (
            /* Geniş banner: tüm alanı kaplar. */
            <Image
              src={anime.banner_url!}
              alt=""
              fill
              sizes="100vw"
              priority={i === 0}
              className="object-cover object-center"
            />
          ) : (
            /* Banner yok: afiş dikey olduğu için yayılamaz.
               Arkaya bulanık kopyası, öne doğru oranıyla kendisi. */
            <>
              <Image
                src={anime.poster_url ?? ""}
                alt=""
                fill
                sizes="100vw"
                priority={i === 0}
                className="scale-110 object-cover object-center blur-2xl saturate-150"
              />
              <div className="absolute inset-0 bg-ink/40" />
              <div className="absolute inset-y-0 right-[6%] hidden aspect-[2/3] h-[78%] my-auto overflow-hidden rounded-xl shadow-2xl ring-1 ring-white/10 md:block">
                <Image
                  src={anime.poster_url ?? ""}
                  alt={`${anime.title} afişi`}
                  fill
                  sizes="320px"
                  className="object-cover"
                />
              </div>
            </>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Netflix'in çift gradyanı: alttan ve soldan karartma */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink via-ink/40 to-transparent" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-ink/95 via-ink/55 to-transparent" />

      {/* Metin bloğu — slayt değişince yeniden canlanır */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`${anime.id}-metin`}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          // Yüzde yerine sabit alt boşluk: hero kısaldığında metin
          // yukarı kayıp navbar'ın altına girmesin.
          className="absolute bottom-16 left-0 max-w-2xl px-4 md:bottom-20 md:px-10"
        >
          <span className="mb-3 inline-block rounded bg-brand px-2 py-0.5 text-xs font-bold tracking-wide">
            ÖNE ÇIKAN
          </span>

          {/* 6xl'de uzun başlıklar iki satıra taşıp metin bloğunu
              hero'dan taşırıyordu; 5xl güvenli sınır. */}
          <h1 className="line-clamp-2 text-3xl font-extrabold leading-tight tracking-tight drop-shadow-lg md:text-5xl">
            {anime.title}
          </h1>

          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-zinc-300">
            {anime.score ? (
              <span className="font-semibold text-emerald-400">
                %{Math.round(anime.score * 10)} eşleşme
              </span>
            ) : null}
            {anime.year ? <span>{anime.year}</span> : null}
            {anime.total_episodes > 0 ? (
              <span>{anime.total_episodes} Bölüm</span>
            ) : null}
            {anime.rating ? (
              <span className="rounded border border-zinc-600 px-1.5 py-px text-xs">
                {anime.rating.split(" ")[0]}
              </span>
            ) : null}
          </div>

          <p className="mt-4 line-clamp-2 text-sm text-zinc-300 md:line-clamp-3 md:text-base">
            {ozet}
            {(anime.synopsis?.length ?? 0) > 220 ? "…" : ""}
          </p>

          <div className="mt-6 flex gap-3">
            <Link
              href={`/anime/${anime.slug}/bolum/1`}
              className="flex items-center gap-2 rounded bg-white px-6 py-2.5 font-semibold text-black transition-colors hover:bg-zinc-200"
            >
              <Play size={20} fill="currentColor" /> Oynat
            </Link>
            <Link
              href={`/anime/${anime.slug}`}
              className="flex items-center gap-2 rounded bg-white/20 px-6 py-2.5 font-semibold text-white backdrop-blur transition-colors hover:bg-white/30"
            >
              <Info size={20} /> Daha Fazla Bilgi
            </Link>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Slayt göstergeleri */}
      {slaytlar.length > 1 ? (
        <div className="absolute bottom-5 right-4 z-20 flex gap-2 md:right-10">
          {slaytlar.map((s, idx) => (
            <button
              key={s.anime.id}
              onClick={() => setI(idx)}
              aria-label={`${idx + 1}. slayta git: ${s.anime.title}`}
              aria-current={idx === i}
              className={`h-1.5 rounded-full transition-all ${
                idx === i ? "w-7 bg-white" : "w-3 bg-white/40 hover:bg-white/70"
              }`}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
