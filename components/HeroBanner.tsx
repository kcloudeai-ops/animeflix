"use client";

import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import { Info, Play, Sparkles } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { HeroSlayt } from "@/lib/queries";

/** Slayt geçiş aralığı. */
const ARALIK_MS = 3000;

// --- Kademeli metin açılış varyantları (imza hareket) ---
const metinKap: Variants = {
  gizli: {},
  acik: { transition: { staggerChildren: 0.07, delayChildren: 0.15 } },
  cikis: { opacity: 0, y: -12, transition: { duration: 0.3 } },
};

/** Badge, künye, özet, butonlar: maske altından yumuşakça belirir. */
const ogeVar: Variants = {
  gizli: { opacity: 0, y: 18, filter: "blur(6px)" },
  acik: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
  },
};

/** Başlık kelimeleri tek tek yukarı kayar. */
const kelimeVar: Variants = {
  gizli: { y: "110%" },
  acik: { y: "0%", transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
};

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
  const ozet = (anime.synopsis_tr ?? anime.synopsis ?? "").slice(0, 220);

  return (
    <section
      // Yükseklik `vh` yerine EN-BOY ORANINA bağlı: banner'lar 2.6–3.2:1
      // geliyor, oysa vh tabanlı yükseklik dar/uzun pencerelerde 1.5:1'e
      // düşüp görseli aşırı kırpıyordu. 16/7 (≈2.29:1) kaynağa yakın.
      // `max-h` çok geniş ekranlarda hero'nun ekranı yutmasını engeller.
      // min-h metin bloğunun sığmasına göre belirlendi: badge + başlık +
      // künye + özet + düğmeler ≈ 320px, üstte 64px sabit navbar var.
      className="relative aspect-[16/7] max-h-[88vh] min-h-[460px] w-full overflow-hidden md:min-h-[520px]"
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
          transition={{ duration: 0.9, ease: [0.4, 0, 0.2, 1] }}
          className="absolute inset-0"
        >
          {/* MOBİL: dikey afiş ekranı doldurur. Yatay banner telefonda
              aşırı kırpılıyordu (≈0.72:1 kutuya 2.6:1 görsel → %70 kesik).
              Afiş 2:3 olduğu için telefona neredeyse birebir oturur;
              object-top yüzleri üstte tutar. */}
          <div className="absolute inset-0 md:hidden">
            <Image
              src={anime.poster_url ?? anime.banner_url ?? ""}
              alt=""
              fill
              sizes="100vw"
              priority={i === 0}
              className="object-cover object-top"
            />
          </div>

          {/* MASAÜSTÜ / TV: sinematik geniş banner + Ken Burns */}
          <div className="absolute inset-0 hidden md:block">
            {gercekBanner ? (
              /* Görsel yavaşça zoom yapıp kayar — sinematik "canlı" his. */
              <motion.div
                className="absolute inset-0"
                initial={{ scale: 1.12, x: 12 }}
                animate={durdu ? {} : { scale: 1, x: 0 }}
                transition={{ duration: 8, ease: "linear" }}
              >
                <Image
                  src={anime.banner_url!}
                  alt=""
                  fill
                  sizes="100vw"
                  priority={i === 0}
                  className="object-cover object-center"
                />
              </motion.div>
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
                <div className="absolute inset-y-0 right-[6%] my-auto hidden aspect-[2/3] h-[78%] overflow-hidden rounded-xl shadow-2xl ring-1 ring-white/10 md:block">
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
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Netflix'in çift gradyanı: alttan ve soldan karartma */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink via-ink/40 to-transparent" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-ink/95 via-ink/55 to-transparent" />

      {/* Metin bloğu — slayt değişince öğeler SIRAYLA (kademeli) belirir */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`${anime.id}-metin`}
          variants={metinKap}
          initial="gizli"
          animate="acik"
          exit="cikis"
          className="absolute bottom-16 left-0 max-w-2xl px-4 md:bottom-20 md:px-10 xl:max-w-3xl 2xl:bottom-28 2xl:px-16"
        >
          <motion.span
            variants={ogeVar}
            className="mb-3 inline-flex items-center gap-1.5 rounded bg-brand px-2 py-0.5 text-xs font-bold tracking-wide shadow-lg shadow-brand/30"
          >
            <Sparkles size={12} /> ÖNE ÇIKAN
          </motion.span>

          {/* Başlık kelime kelime, maske altından yukarı kayarak açılır */}
          <h1 className="line-clamp-2 text-3xl font-extrabold leading-tight tracking-tight drop-shadow-lg md:text-5xl xl:text-6xl 2xl:text-7xl">
            {anime.title.split(" ").map((kelime, ki) => (
              <span
                key={ki}
                className="inline-block overflow-hidden align-bottom"
              >
                <motion.span variants={kelimeVar} className="inline-block">
                  {kelime}
                </motion.span>
                {ki < anime.title.split(" ").length - 1 ? " " : ""}
              </span>
            ))}
          </h1>

          <motion.div
            variants={ogeVar}
            className="mt-3 flex flex-wrap items-center gap-3 text-sm text-zinc-300"
          >
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
          </motion.div>

          <motion.p
            variants={ogeVar}
            className="mt-4 line-clamp-2 text-sm text-zinc-300 md:line-clamp-3 md:text-base"
          >
            {ozet}
            {((anime.synopsis_tr ?? anime.synopsis)?.length ?? 0) > 220 ? "…" : ""}
          </motion.p>

          <motion.div variants={ogeVar} className="mt-6 flex gap-3">
            <Link
              href={`/anime/${anime.slug}/bolum/1`}
              className="group flex items-center gap-2 overflow-hidden rounded bg-white px-6 py-2.5 font-semibold text-black transition-all hover:bg-zinc-100 hover:shadow-lg hover:shadow-white/20"
            >
              <Play
                size={20}
                fill="currentColor"
                className="transition-transform group-hover:scale-110"
              />
              Oynat
            </Link>
            <Link
              href={`/anime/${anime.slug}`}
              className="flex items-center gap-2 rounded bg-white/15 px-6 py-2.5 font-semibold text-white backdrop-blur transition-colors hover:bg-white/25"
            >
              <Info size={20} /> Daha Fazla Bilgi
            </Link>
          </motion.div>
        </motion.div>
      </AnimatePresence>

      {/* Slayt göstergeleri — aktif olan, 3 sn'lik geçişi DOLARAK gösterir */}
      {slaytlar.length > 1 ? (
        <div className="absolute bottom-5 right-4 z-20 flex items-center gap-2 md:right-10">
          {slaytlar.map((s, idx) => (
            <button
              key={s.anime.id}
              onClick={() => setI(idx)}
              aria-label={`${idx + 1}. slayta git: ${s.anime.title}`}
              aria-current={idx === i}
              className={`relative h-1.5 overflow-hidden rounded-full transition-all duration-300 ${
                idx === i ? "w-8 bg-white/25" : "w-3 bg-white/40 hover:bg-white/70"
              }`}
            >
              {idx === i && !durdu ? (
                <motion.span
                  key={`${anime.id}-bar`}
                  className="absolute inset-y-0 left-0 rounded-full bg-white"
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: ARALIK_MS / 1000, ease: "linear" }}
                />
              ) : idx === i ? (
                <span className="absolute inset-0 rounded-full bg-white" />
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
