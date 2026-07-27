import type { Metadata } from "next";
import { getSchedule, yerelGun } from "@/lib/queries";
import { ScheduleView } from "@/components/ScheduleView";

// Takvim saatlik değişir; sık tazelensin
export const revalidate = 900;

export const metadata: Metadata = {
  title: "Yayın Takvimi",
  description:
    "Bu hafta yayınlanacak anime bölümleri: gün gün, saat saat yayın takvimi.",
  alternates: { canonical: "/takvim" },
};

export default async function SchedulePage() {
  // Haftanın başı (Pazartesi) — Türkiye'de hafta pazartesi başlar,
  // JS'te getDay() pazar = 0 olduğu için kaydırma gerekiyor.
  const bugun = new Date();
  const gun = bugun.getDay();
  const pazartesiyeKalan = gun === 0 ? -6 : 1 - gun;

  const haftaBasi = new Date(bugun);
  haftaBasi.setDate(haftaBasi.getDate() + pazartesiyeKalan);
  haftaBasi.setHours(0, 0, 0, 0);

  const gunler = await getSchedule(haftaBasi, 7);

  return (
    <div className="mx-auto max-w-[1400px] px-4 pb-20 pt-24 md:px-8">
      <header className="mb-6">
        <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">
          Yayın Takvimi
        </h1>
        <p className="mt-1 text-zinc-400">
          Bu hafta yayınlanacak bölümler, yerel saatinize göre.
        </p>
      </header>

      <ScheduleView gunler={gunler} bugun={yerelGun(bugun)} />
    </div>
  );
}
