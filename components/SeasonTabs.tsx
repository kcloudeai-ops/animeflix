import Link from "next/link";
import { Layers } from "lucide-react";
import type { Sezon } from "@/lib/queries";

/**
 * Serideki sezonlar arasında geçiş. Sunucu bileşeni — her sekme
 * gerçek bir bağlantı, dolayısıyla JS'siz de çalışır ve arama
 * motorları sezonlar arasındaki bağı görebilir.
 */
export function SeasonTabs({
  seriTitle,
  sezonlar,
  aktifId,
}: {
  seriTitle: string;
  sezonlar: Sezon[];
  aktifId: string;
}) {
  if (sezonlar.length < 2) return null;

  return (
    <section className="mt-12">
      <h2 className="mb-1 flex items-center gap-2 text-2xl font-bold">
        <Layers size={22} /> Sezonlar
      </h2>
      <p className="mb-4 text-sm text-zinc-500">
        {seriTitle} · {sezonlar.length} sezon
      </p>

      <ul className="flex flex-wrap gap-2">
        {sezonlar.map((s) => {
          const aktif = s.id === aktifId;

          return (
            <li key={s.id}>
              <Link
                href={`/anime/${s.slug}`}
                aria-current={aktif ? "page" : undefined}
                className={`flex min-w-[136px] flex-col rounded-lg border px-4 py-2.5 transition-colors ${
                  aktif
                    ? "border-brand bg-brand/15"
                    : "border-ink-line bg-ink-soft/60 hover:border-zinc-600 hover:bg-ink-soft"
                }`}
              >
                <span
                  className={`text-sm font-semibold ${
                    aktif ? "text-white" : "text-zinc-200"
                  }`}
                >
                  {s.season_number}. Sezon
                </span>

                {/* Etiket varsa göster ("Part 2", "Final Season") */}
                {s.season_label ? (
                  <span className="mt-0.5 line-clamp-1 text-xs text-zinc-400">
                    {s.season_label}
                  </span>
                ) : null}

                <span className="mt-1 text-xs text-zinc-600">
                  {[
                    s.year,
                    s.total_episodes > 0 ? `${s.total_episodes} bölüm` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
