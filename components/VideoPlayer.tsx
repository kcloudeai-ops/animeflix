"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import type { Episode } from "@/lib/types";

/**
 * Esnek oynatıcı — kaynağa göre doğru altyapıyı seçer:
 *  - mux        -> player.mux.com iframe (tüm tarayıcılarda HLS)
 *  - cloudinary -> doğrudan <video> (mp4/webm)
 *  - hls        -> Safari'de native, diğerlerinde hls.js dinamik import
 *  - embed      -> üçüncü parti iframe
 */
export function VideoPlayer({
  episode,
  poster,
  onProgress,
}: {
  episode: Pick<Episode, "source" | "video_url" | "mux_playback_id" | "title">;
  poster?: string | null;
  onProgress?: (seconds: number) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  const src =
    episode.source === "mux" && episode.mux_playback_id
      ? `https://player.mux.com/${episode.mux_playback_id}?accent-color=%23e50914`
      : episode.video_url;

  // HLS desteği: Safari dışı tarayıcılarda hls.js'i sadece gerektiğinde indir
  useEffect(() => {
    const el = videoRef.current;
    if (!el || episode.source !== "hls" || !src) return;
    if (el.canPlayType("application/vnd.apple.mpegurl")) {
      el.src = src;
      return;
    }

    let destroy: (() => void) | undefined;
    import("hls.js")
      .then(({ default: Hls }) => {
        if (!Hls.isSupported()) return setError("Tarayıcınız HLS desteklemiyor.");
        const hls = new Hls();
        hls.loadSource(src);
        hls.attachMedia(el);
        destroy = () => hls.destroy();
      })
      .catch(() => setError("Oynatıcı yüklenemedi."));

    return () => destroy?.();
  }, [episode.source, src]);

  // İzleme ilerlemesini 10 saniyede bir dışarı bildir
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !onProgress) return;
    let last = 0;
    const handler = () => {
      if (el.currentTime - last >= 10) {
        last = el.currentTime;
        onProgress(Math.floor(el.currentTime));
      }
    };
    el.addEventListener("timeupdate", handler);
    return () => el.removeEventListener("timeupdate", handler);
  }, [onProgress]);

  const frame =
    "relative aspect-video w-full overflow-hidden rounded-xl bg-black ring-1 ring-white/10";

  if (!src) {
    return (
      <div className={frame}>
        <div className="absolute inset-0 grid place-items-center px-6 text-center">
          <div>
            <p className="text-lg font-semibold text-zinc-300">
              Video kaynağı henüz eklenmedi
            </p>
            <p className="mt-1 text-sm text-zinc-500">
              Yönetici panelinden bu bölüme bir video URL&apos;i tanımlayın.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.985 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      className={frame}
    >
      {episode.source === "mux" || episode.source === "embed" ? (
        <iframe
          src={src}
          title={episode.title ?? "Bölüm oynatıcı"}
          allow="accelerometer; autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          loading="lazy"
          className="absolute inset-0 size-full border-0"
        />
      ) : (
        <video
          ref={videoRef}
          controls
          playsInline
          poster={poster ?? undefined}
          preload="metadata"
          className="absolute inset-0 size-full"
          {...(episode.source === "cloudinary" ? { src } : {})}
        />
      )}

      {error ? (
        <p className="absolute inset-x-0 bottom-0 bg-red-950/90 p-2 text-center text-sm text-red-200">
          {error}
        </p>
      ) : null}
    </motion.div>
  );
}
