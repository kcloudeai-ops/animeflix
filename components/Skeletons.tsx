/** Suspense fallback'lerinde kullanılan iskelet ekranlar. */

export function CardSkeleton() {
  return (
    <div className="w-[160px] shrink-0 md:w-[210px]">
      <div className="shimmer aspect-[2/3] rounded-lg bg-ink-soft" />
      <div className="shimmer mt-2 h-3.5 w-4/5 rounded bg-ink-soft" />
      <div className="shimmer mt-1.5 h-3 w-2/5 rounded bg-ink-soft" />
    </div>
  );
}

export function CarouselSkeleton({ count = 8 }: { count?: number }) {
  return (
    <section className="py-5">
      <div className="shimmer mb-3 ml-4 h-5 w-44 rounded bg-ink-soft md:ml-10" />
      <div className="no-scrollbar flex gap-3 overflow-hidden px-4 pb-6 md:px-10">
        {Array.from({ length: count }, (_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    </section>
  );
}

export function HeroSkeleton() {
  return (
    <div className="relative h-[68vh] min-h-[440px] md:h-[80vh]">
      <div className="shimmer absolute inset-0 bg-ink-soft" />
      <div className="absolute bottom-[14%] left-0 space-y-4 px-4 md:px-10">
        <div className="shimmer h-12 w-[min(90vw,520px)] rounded bg-ink-line" />
        <div className="shimmer h-4 w-[min(80vw,420px)] rounded bg-ink-line" />
        <div className="shimmer h-4 w-[min(70vw,360px)] rounded bg-ink-line" />
        <div className="flex gap-3 pt-2">
          <div className="shimmer h-11 w-36 rounded bg-ink-line" />
          <div className="shimmer h-11 w-44 rounded bg-ink-line" />
        </div>
      </div>
    </div>
  );
}
