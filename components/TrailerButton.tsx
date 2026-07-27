"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Film, X } from "lucide-react";
import { useEffect, useState } from "react";
import { youtubeEmbed, youtubeId } from "@/lib/youtube";

/**
 * "Fragmanı İzle" düğmesi + modal oynatıcı.
 *
 * YouTube iframe'i SAYFA AÇILIŞINDA yüklenmez — yalnızca kullanıcı
 * tıklayınca gelir. Aksi hâlde her detay sayfası YouTube'un ağır
 * script'lerini çekip performansı ve gizliliği bozardı. Ayrıca
 * çerez-azaltılmış (youtube-nocookie) alan kullanılır.
 */
export function TrailerButton({ trailerUrl }: { trailerUrl: string | null }) {
  const [acik, setAcik] = useState(false);
  const id = youtubeId(trailerUrl);

  // Modal açıkken arka planın kaymasını engelle + Escape ile kapat
  useEffect(() => {
    if (!acik) return;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setAcik(false);
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
    };
  }, [acik]);

  if (!id) return null;

  return (
    <>
      <button
        onClick={() => setAcik(true)}
        className="inline-flex items-center gap-2 rounded bg-white/10 px-6 py-2.5 font-semibold text-white transition-colors hover:bg-white/20"
      >
        <Film size={18} /> Fragmanı İzle
      </button>

      <AnimatePresence>
        {acik ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setAcik(false)}
            className="fixed inset-0 z-[80] grid place-items-center bg-black/85 p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-4xl"
            >
              <button
                onClick={() => setAcik(false)}
                aria-label="Fragmanı kapat"
                className="absolute -top-11 right-0 flex items-center gap-1 text-sm text-zinc-300 hover:text-white"
              >
                <X size={20} /> Kapat
              </button>

              <div className="relative aspect-video overflow-hidden rounded-xl bg-black ring-1 ring-white/10">
                <iframe
                  src={youtubeEmbed(id)}
                  title="Fragman"
                  allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                  allowFullScreen
                  className="absolute inset-0 size-full border-0"
                />
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
