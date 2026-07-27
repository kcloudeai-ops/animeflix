"use client";

import { useCallback, useEffect, useRef } from "react";
import { VideoPlayer } from "./VideoPlayer";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { Episode } from "@/lib/types";

/**
 * VideoPlayer'ı sarar ve izleme ilerlemesini `watch_progress`'e yazar.
 *
 * Yazma sıklığı bilinçli olarak düşük: oynatıcı 10 saniyede bir haber
 * veriyor, biz de yalnızca o anlarda kaydediyoruz. Ayrıca sayfadan
 * ayrılırken son konum bir kez daha yazılıyor.
 */
export function EpisodeWatcher({
  episode,
  poster,
}: {
  episode: Episode;
  poster?: string | null;
}) {
  const sonKonum = useRef(0);
  const yazildi = useRef(0);

  const kaydet = useCallback(
    async (saniye: number, tamamlandi = false) => {
      if (!isSupabaseConfigured || saniye < 5) return;

      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return; // misafir kullanıcı — ilerleme tutulmaz

      await supabase.from("watch_progress").upsert({
        user_id: user.id,
        episode_id: episode.id,
        position_sec: Math.floor(saniye),
        completed: tamamlandi,
        updated_at: new Date().toISOString(),
      });

      yazildi.current = saniye;
    },
    [episode.id],
  );

  const onProgress = useCallback(
    (saniye: number) => {
      sonKonum.current = saniye;
      // Süre bilgisi varsa %90'ı geçince "tamamlandı" say
      const toplam = episode.duration_sec ?? 0;
      const bitti = toplam > 0 && saniye >= toplam * 0.9;
      kaydet(saniye, bitti);
    },
    [kaydet, episode.duration_sec],
  );

  // Sayfadan ayrılırken son konumu yaz (10 sn'lik aralığa denk gelmemiş olabilir)
  useEffect(() => {
    return () => {
      if (sonKonum.current > yazildi.current) {
        void kaydet(sonKonum.current);
      }
    };
  }, [kaydet]);

  return (
    <VideoPlayer episode={episode} poster={poster} onProgress={onProgress} />
  );
}
