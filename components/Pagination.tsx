import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Sunucu bileşeni: sayfa bağlantıları gerçek <a> etiketleri.
 * Böylece arama motorları derin sayfaları tarayabilir ve JavaScript
 * kapalıyken de gezinme çalışır.
 */
export function Pagination({
  page,
  totalPages,
  basePath,
  params = {},
  sayfaAnahtari = "sayfa",
}: {
  page: number;
  totalPages: number;
  /** Örn: "/kategori/action" */
  basePath: string;
  /** Korunacak diğer sorgu parametreleri, örn: { q: "naruto" } */
  params?: Record<string, string>;
  /**
   * Sayfa numarasının tutulduğu sorgu anahtarı. Anime detay sayfasında
   * "bs" kullanılıyor: orada bölüm listesi sayfalanıyor ve ileride
   * sayfanın kendi "sayfa" parametresiyle çakışmaması gerekiyor.
   */
  sayfaAnahtari?: string;
}) {
  if (totalPages <= 1) return null;

  const href = (p: number) => {
    const sp = new URLSearchParams(params);
    if (p > 1) sp.set(sayfaAnahtari, String(p));
    const qs = sp.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  // Geçerli sayfanın etrafında dar bir pencere + baş/son
  const pencere = new Set<number>([1, totalPages]);
  for (let p = page - 2; p <= page + 2; p++) {
    if (p >= 1 && p <= totalPages) pencere.add(p);
  }
  const sayfalar = [...pencere].sort((a, b) => a - b);

  const kutu =
    "grid h-10 min-w-10 place-items-center rounded-lg px-3 text-sm transition-colors";

  return (
    <nav
      aria-label="Sayfalama"
      className="mt-10 flex flex-wrap items-center justify-center gap-1.5"
    >
      {page > 1 ? (
        <Link
          href={href(page - 1)}
          rel="prev"
          aria-label="Önceki sayfa"
          className={`${kutu} bg-white/10 hover:bg-white/20`}
        >
          <ChevronLeft size={18} />
        </Link>
      ) : (
        <span className={`${kutu} bg-white/5 text-zinc-700`}>
          <ChevronLeft size={18} />
        </span>
      )}

      {sayfalar.map((p, i) => {
        const oncekiVar = i > 0 && sayfalar[i - 1] !== p - 1;
        return (
          <span key={p} className="flex items-center gap-1.5">
            {oncekiVar ? (
              <span className="px-1 text-zinc-600">…</span>
            ) : null}
            {p === page ? (
              <span
                aria-current="page"
                className={`${kutu} bg-brand font-semibold text-white`}
              >
                {p}
              </span>
            ) : (
              <Link
                href={href(p)}
                className={`${kutu} bg-white/10 text-zinc-300 hover:bg-white/20 hover:text-white`}
              >
                {p}
              </Link>
            )}
          </span>
        );
      })}

      {page < totalPages ? (
        <Link
          href={href(page + 1)}
          rel="next"
          aria-label="Sonraki sayfa"
          className={`${kutu} bg-white/10 hover:bg-white/20`}
        >
          <ChevronRight size={18} />
        </Link>
      ) : (
        <span className={`${kutu} bg-white/5 text-zinc-700`}>
          <ChevronRight size={18} />
        </span>
      )}
    </nav>
  );
}
