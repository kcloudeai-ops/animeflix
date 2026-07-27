"use client";

import { Check, TriangleAlert, X } from "lucide-react";
import type { SeoSonuc } from "@/lib/seo-check";

/** Editörün yanında canlı SEO puanı + kural listesi. */
export function SeoChecklist({ sonuc }: { sonuc: SeoSonuc }) {
  const renk =
    sonuc.puan >= 80
      ? "text-emerald-400"
      : sonuc.puan >= 50
        ? "text-amber-400"
        : "text-red-400";

  const halkaRenk =
    sonuc.puan >= 80 ? "#34d399" : sonuc.puan >= 50 ? "#fbbf24" : "#f87171";

  return (
    <div className="rounded-xl border border-ink-line bg-ink-soft/60 p-4">
      <div className="flex items-center gap-3">
        {/* Puan halkası */}
        <div className="relative grid size-14 shrink-0 place-items-center">
          <svg className="size-14 -rotate-90" viewBox="0 0 36 36">
            <circle
              cx="18"
              cy="18"
              r="15.5"
              fill="none"
              stroke="rgb(255 255 255 / 0.08)"
              strokeWidth="3"
            />
            <circle
              cx="18"
              cy="18"
              r="15.5"
              fill="none"
              stroke={halkaRenk}
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={`${(sonuc.puan / 100) * 97.4} 97.4`}
              style={{ transition: "stroke-dasharray 0.4s ease" }}
            />
          </svg>
          <span className={`absolute text-sm font-bold ${renk}`}>
            {sonuc.puan}
          </span>
        </div>

        <div>
          <p className="text-sm font-semibold">SEO Puanı</p>
          <p className="text-xs text-zinc-500">
            {sonuc.gecen}/{sonuc.toplam} kural karşılandı
          </p>
        </div>
      </div>

      <ul className="mt-4 space-y-2">
        {sonuc.kurallar.map((k) => (
          <li key={k.id} className="flex items-start gap-2 text-sm" title={k.ipucu}>
            <span className="mt-0.5 shrink-0">
              {k.durum === "gecti" ? (
                <Check size={15} className="text-emerald-400" />
              ) : k.durum === "uyari" ? (
                <TriangleAlert size={15} className="text-amber-400" />
              ) : (
                <X size={15} className="text-red-400" />
              )}
            </span>
            <span
              className={
                k.durum === "gecti"
                  ? "text-zinc-300"
                  : k.durum === "uyari"
                    ? "text-amber-200/90"
                    : "text-zinc-400"
              }
            >
              {k.etiket}
              {k.durum !== "gecti" ? (
                <span className="mt-0.5 block text-xs text-zinc-600">
                  {k.ipucu}
                </span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
