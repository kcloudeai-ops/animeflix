"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";

const SIRALAMA = [
  { value: "puan", label: "Puana göre" },
  { value: "yeni", label: "En yeni" },
  { value: "populer", label: "En çok izlenen" },
  { value: "ad", label: "A–Z" },
];

const DURUM = [
  { value: "airing", label: "Devam ediyor" },
  { value: "finished", label: "Tamamlandı" },
  { value: "upcoming", label: "Yakında" },
];

/**
 * Filtreler URL'de tutulur (`?tur=TV&yil=2024`). Böylece sonuç
 * paylaşılabilir, geri tuşu çalışır ve sunucu tarafında filtrelenir.
 */
export function FilterBar({
  turler,
  yillar,
}: {
  turler: string[];
  yillar: number[];
}) {
  const router = useRouter();
  const sp = useSearchParams();

  const guncelle = (anahtar: string, deger: string) => {
    const next = new URLSearchParams(sp.toString());
    if (deger) next.set(anahtar, deger);
    else next.delete(anahtar);
    next.delete("sayfa"); // filtre değişince 1. sayfaya dön
    const qs = next.toString();
    router.push(qs ? `/kesfet?${qs}` : "/kesfet");
  };

  const aktif = ["tur", "yil", "durum", "sirala"].filter((k) => sp.get(k));

  const secim =
    "rounded-lg border border-ink-line bg-ink px-3 py-2 text-sm outline-none transition-colors focus:border-brand";

  return (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      <select
        aria-label="Sıralama"
        value={sp.get("sirala") ?? "puan"}
        onChange={(e) => guncelle("sirala", e.target.value)}
        className={secim}
      >
        {SIRALAMA.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>

      <select
        aria-label="Tür"
        value={sp.get("tur") ?? ""}
        onChange={(e) => guncelle("tur", e.target.value)}
        className={secim}
      >
        <option value="">Tüm türler</option>
        {turler.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>

      <select
        aria-label="Yıl"
        value={sp.get("yil") ?? ""}
        onChange={(e) => guncelle("yil", e.target.value)}
        className={secim}
      >
        <option value="">Tüm yıllar</option>
        {yillar.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>

      <select
        aria-label="Durum"
        value={sp.get("durum") ?? ""}
        onChange={(e) => guncelle("durum", e.target.value)}
        className={secim}
      >
        <option value="">Tüm durumlar</option>
        {DURUM.map((d) => (
          <option key={d.value} value={d.value}>
            {d.label}
          </option>
        ))}
      </select>

      {aktif.length > 0 ? (
        <button
          onClick={() => router.push("/kesfet")}
          className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-2 text-sm text-zinc-300 transition-colors hover:bg-white/20 hover:text-white"
        >
          <X size={14} /> Filtreleri temizle
        </button>
      ) : null}
    </div>
  );
}
