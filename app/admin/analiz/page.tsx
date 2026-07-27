import type { Metadata } from "next";
import {
  getCanliAkis,
  getGunlukGoruntuleme,
  getPopulerSayfalar,
} from "@/lib/queries";
import { LiveFeed } from "@/components/admin/LiveFeed";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Analiz",
  robots: { index: false, follow: false },
};

export default async function AdminAnalizPage() {
  const [gunluk, populer, akis] = await Promise.all([
    getGunlukGoruntuleme(),
    getPopulerSayfalar(),
    getCanliAkis(),
  ]);

  const maks = Math.max(1, ...gunluk.map((g) => g.sayi));
  const gunAdi = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];

  return (
    <div className="px-4 pb-20 pt-8 md:px-8">
      <header className="mb-8">
        <h1 className="text-2xl font-bold">Analiz</h1>
        <p className="mt-1 text-zinc-400">
          Sayfa görüntülemeleri, canlı ziyaretçi akışı ve popüler içerik.
        </p>
      </header>

      {/* 7 günlük grafik */}
      <section className="mb-8 rounded-xl border border-ink-line bg-ink-soft/60 p-5">
        <h2 className="mb-4 text-sm font-semibold text-zinc-300">
          Son 7 Gün — Görüntüleme
        </h2>
        <div className="flex items-end gap-2" style={{ height: 160 }}>
          {gunluk.map((g) => {
            const d = new Date(`${g.gun}T12:00:00`);
            return (
              <div key={g.gun} className="flex flex-1 flex-col items-center gap-2">
                <span className="text-xs text-zinc-500">{g.sayi}</span>
                <div
                  className="w-full rounded-t bg-brand/70 transition-all"
                  style={{ height: `${(g.sayi / maks) * 110}px`, minHeight: 2 }}
                  title={`${g.gun}: ${g.sayi}`}
                />
                <span className="text-xs text-zinc-600">{gunAdi[d.getDay()]}</span>
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Canlı akış — istemcide 10 sn'de bir tazelenir */}
        <LiveFeed ilk={akis} />

        {/* Popüler sayfalar (bugün) */}
        <section className="rounded-xl border border-ink-line bg-ink-soft/60 p-5">
          <h2 className="mb-4 text-sm font-semibold text-zinc-300">
            Bugün En Çok Görüntülenen
          </h2>
          {populer.length === 0 ? (
            <p className="text-sm text-zinc-500">Henüz veri yok.</p>
          ) : (
            <ul className="space-y-2">
              {populer.map((p, i) => (
                <li
                  key={p.path}
                  className="flex items-center gap-3 text-sm"
                >
                  <span className="w-5 shrink-0 text-right text-xs text-zinc-600">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-zinc-300">
                    {p.path}
                  </span>
                  <span className="shrink-0 font-semibold text-zinc-400">
                    {p.sayi}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <p className="mt-8 text-xs text-zinc-600">
        Veriler anonimdir: yalnızca rastgele oturum kimliği, sayfa yolu ve süre
        saklanır. IP adresi veya kişisel bilgi toplanmaz.
      </p>
    </div>
  );
}
