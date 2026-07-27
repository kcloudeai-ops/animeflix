"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";

/**
 * Sayfa düzeyinde hata sınırı. Bu olmadan bir sorgu patladığında
 * kullanıcı Next.js'in çıplak hata ekranını görüyordu.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Üretimde bir hata izleme servisine gönderilecek yer burası.
    console.error("Sayfa hatası:", error);
  }, [error]);

  return (
    <div className="grid min-h-[70dvh] place-items-center px-6 text-center">
      <div className="max-w-md">
        <h1 className="text-2xl font-bold">Bir şeyler ters gitti</h1>
        <p className="mt-2 text-zinc-400">
          Bu sayfa yüklenirken beklenmedik bir hata oluştu. Tekrar denemek
          çoğu zaman yeterli olur.
        </p>

        {error.digest ? (
          <p className="mt-3 text-xs text-zinc-600">
            Hata kodu: <code>{error.digest}</code>
          </p>
        ) : null}

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            onClick={reset}
            className="flex items-center gap-2 rounded bg-white px-5 py-2.5 font-semibold text-black transition-colors hover:bg-zinc-200"
          >
            <RefreshCw size={16} /> Tekrar dene
          </button>
          <Link
            href="/"
            className="rounded bg-white/10 px-5 py-2.5 font-semibold transition-colors hover:bg-white/20"
          >
            Anasayfaya dön
          </Link>
        </div>
      </div>
    </div>
  );
}
