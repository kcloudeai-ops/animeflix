"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Anonim sayfa görüntüleme takibi. Her rota değişiminde ÖNCEKİ sayfanın
 * yolu ve orada geçirilen süre kaydedilir. Kişisel veri toplamaz —
 * yalnızca tarayıcıda üretilen rastgele bir session_id kullanılır.
 *
 * sendBeacon: sayfa kapanırken/geçişte bile isteğin gitmesini garanti eder.
 */
export function PageTracker() {
  const yol = usePathname();
  const oncekiYol = useRef<string | null>(null);
  const baslangic = useRef<number>(Date.now());

  useEffect(() => {
    // Kalıcı anonim oturum kimliği
    let sid = localStorage.getItem("af_sid");
    if (!sid) {
      sid = crypto.randomUUID();
      localStorage.setItem("af_sid", sid);
    }

    const gonder = (path: string, duration: number) => {
      const govde = JSON.stringify({
        sessionId: sid,
        path,
        referrer: document.referrer || null,
        duration,
      });
      // Beacon varsa onu kullan (geçiş sırasında bile gider)
      if (navigator.sendBeacon) {
        navigator.sendBeacon("/api/track", new Blob([govde], { type: "application/json" }));
      } else {
        fetch("/api/track", { method: "POST", body: govde, keepalive: true });
      }
    };

    // Admin ve giriş sayfaları analize dahil edilmez — yönetici gezinmesi
    // istatistikleri kirletmesin, ziyaretçi verisi temiz kalsın.
    const izlenir = (p: string) =>
      !p.startsWith("/admin") && !p.startsWith("/giris") && !p.startsWith("/kayit");

    // Önceki sayfanın süresini kaydet
    if (
      oncekiYol.current &&
      oncekiYol.current !== yol &&
      izlenir(oncekiYol.current)
    ) {
      gonder(oncekiYol.current, Math.round((Date.now() - baslangic.current) / 1000));
    }
    // Yeni sayfa: hemen bir görüntüleme (süre 0) — "şu an burada" için
    if (izlenir(yol)) gonder(yol, 0);

    oncekiYol.current = yol;
    baslangic.current = Date.now();

    // Sekme kapanırken son sayfanın süresini de gönder
    const ayrilirken = () => {
      if (oncekiYol.current && izlenir(oncekiYol.current)) {
        gonder(oncekiYol.current, Math.round((Date.now() - baslangic.current) / 1000));
      }
    };
    window.addEventListener("pagehide", ayrilirken);
    return () => window.removeEventListener("pagehide", ayrilirken);
  }, [yol]);

  return null;
}
