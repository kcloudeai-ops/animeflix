import Image from "next/image";
import type { AnimeCharacter } from "@/lib/types";

const ROL_TR: Record<string, string> = {
  MAIN: "Başrol",
  SUPPORTING: "Yardımcı",
  BACKGROUND: "Figüran",
};

/**
 * Karakter kartları. Sunucu bileşeni — etkileşim yok, JS göndermeye
 * gerek yok. Solda karakter, sağda seslendireni (varsa).
 */
export function CharacterList({ karakterler }: { karakterler: AnimeCharacter[] }) {
  if (karakterler.length === 0) return null;

  return (
    <section className="mt-14">
      <h2 className="mb-4 text-2xl font-bold">Karakterler</h2>

      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {karakterler.map((k) => (
          <li
            key={k.id}
            className="flex items-stretch justify-between gap-2 overflow-hidden rounded-lg border border-ink-line bg-ink-soft/60"
          >
            {/* Karakter */}
            <div className="flex min-w-0 flex-1 items-center gap-3 p-2">
              <div className="relative size-14 shrink-0 overflow-hidden rounded-md bg-ink">
                {k.image_url ? (
                  <Image
                    src={k.image_url}
                    alt=""
                    fill
                    sizes="56px"
                    loading="lazy"
                    className="object-cover"
                  />
                ) : null}
              </div>
              <div className="min-w-0">
                <p className="line-clamp-2 text-sm font-medium text-zinc-100">
                  {k.name}
                </p>
                {k.role ? (
                  <p className="text-xs text-zinc-500">
                    {ROL_TR[k.role] ?? k.role}
                  </p>
                ) : null}
              </div>
            </div>

            {/* Seslendiren */}
            {k.voiceActor ? (
              <div className="flex min-w-0 flex-1 items-center justify-end gap-3 p-2 text-right">
                <div className="min-w-0">
                  <p className="line-clamp-2 text-sm text-zinc-300">
                    {k.voiceActor.name}
                  </p>
                  <p className="text-xs text-zinc-600">Japonca</p>
                </div>
                <div className="relative size-14 shrink-0 overflow-hidden rounded-md bg-ink">
                  {k.voiceActor.image_url ? (
                    <Image
                      src={k.voiceActor.image_url}
                      alt=""
                      fill
                      sizes="56px"
                      loading="lazy"
                      className="object-cover"
                    />
                  ) : null}
                </div>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
