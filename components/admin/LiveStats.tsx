"use client";

import { useQuery } from "@tanstack/react-query";
import { Activity, Clock, Eye, Users } from "lucide-react";
import type { AnalizOzet } from "@/lib/queries";

/**
 * Canlı KPI'lar — 10 saniyede bir /api/admin/analiz-ozet'ten tazelenir.
 * "Şu an aktif" hissini polling ile verir (Realtime altyapısı gerekmez).
 */
export function LiveStats({ ilk }: { ilk: AnalizOzet | null }) {
  const { data } = useQuery({
    queryKey: ["analiz-ozet"],
    initialData: ilk,
    refetchInterval: 10_000,
    queryFn: async (): Promise<AnalizOzet | null> => {
      const res = await fetch("/api/admin/analiz-ozet");
      if (!res.ok) return null;
      return (await res.json()).ozet ?? null;
    },
  });

  const o = data;

  const kutular = [
    {
      etiket: "Şu an aktif",
      deger: o?.aktif_5dk ?? 0,
      alt: `${o?.aktif_uye_5dk ?? 0} üye`,
      icon: Activity,
      canli: true,
    },
    {
      etiket: "Bugünkü ziyaretçi",
      deger: o?.bugun_ziyaretci ?? 0,
      alt: `${o?.bugun_goruntuleme ?? 0} görüntüleme`,
      icon: Users,
    },
    {
      etiket: "Ort. sayfa süresi",
      deger: `${o?.ort_sure ?? 0}s`,
      alt: "bugün",
      icon: Clock,
    },
    {
      etiket: "Günlük aktif üye",
      deger: o?.gunluk_uye ?? 0,
      alt: "bugün giriş yapan",
      icon: Eye,
    },
  ];

  return (
    <section className="mt-6">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-lg font-semibold">Canlı</h2>
        <span className="flex items-center gap-1.5 text-xs text-emerald-400">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
          </span>
          10 sn'de bir güncellenir
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kutular.map((k) => (
          <div
            key={k.etiket}
            className={`rounded-xl border p-4 ${
              k.canli
                ? "border-emerald-800/50 bg-emerald-950/20"
                : "border-ink-line bg-ink-soft/60"
            }`}
          >
            <div className="flex items-center gap-2 text-zinc-500">
              <k.icon size={15} className={k.canli ? "text-emerald-400" : ""} />
              <span className="text-xs">{k.etiket}</span>
            </div>
            <p className="mt-2 text-2xl font-bold">
              {typeof k.deger === "number"
                ? k.deger.toLocaleString("tr-TR")
                : k.deger}
            </p>
            <p className="text-xs text-zinc-600">{k.alt}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
