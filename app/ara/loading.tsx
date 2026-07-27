import { CardSkeleton } from "@/components/Skeletons";

/**
 * Bu rota `notFound()` çağırmıyor, dolayısıyla akış erken başlasa da
 * durum kodu bozulmaz. (Kök `loading.tsx` kaldırılmıştı: orada akış
 * erken başlayınca 404'ler 200 dönüyordu.)
 */
export default function Loading() {
  return (
    <div className="mx-auto max-w-[1600px] px-4 pb-20 pt-24 md:px-10">
      <div className="shimmer h-9 w-40 rounded bg-ink-soft" />
      <div className="shimmer mt-3 h-4 w-64 rounded bg-ink-soft" />
      <div className="mt-6 flex gap-2">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="shimmer h-10 w-32 rounded-lg bg-ink-soft" />
        ))}
      </div>
      <div className="mt-8 flex flex-wrap gap-x-3 gap-y-6">
        {Array.from({ length: 18 }, (_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
