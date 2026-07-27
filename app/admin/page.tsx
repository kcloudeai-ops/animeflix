import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3, FileText, Film, Shield } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getAnalizOzet } from "@/lib/queries";
import { LiveStats } from "@/components/admin/LiveStats";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Gösterge Paneli",
  robots: { index: false, follow: false },
};

async function sayimlar() {
  if (!isSupabaseConfigured)
    return { anime: 0, bolum: 0, uye: 0, yazi: 0 };
  const supabase = await createClient();
  const say = async (t: string, filtre?: [string, string]) => {
    let q = supabase.from(t).select("*", { count: "exact", head: true });
    if (filtre) q = q.eq(filtre[0], filtre[1]);
    const { count } = await q;
    return count ?? 0;
  };
  const [anime, bolum, uye, yazi] = await Promise.all([
    say("animes"),
    say("episodes"),
    say("profiles"),
    say("blog_posts").catch(() => 0),
  ]);
  return { anime, bolum, uye, yazi };
}

export default async function AdminDashboard() {
  const [s, ozet] = await Promise.all([sayimlar(), getAnalizOzet()]);

  const kartlar = [
    { etiket: "Anime", deger: s.anime, href: "/admin/icerik", icon: Film },
    { etiket: "Bölüm", deger: s.bolum, href: "/admin/icerik", icon: Film },
    { etiket: "Üye", deger: s.uye, href: "/admin/guvenlik", icon: Shield },
    { etiket: "Blog yazısı", deger: s.yazi, href: "/admin/blog", icon: FileText },
  ];

  return (
    <div className="px-4 pb-20 pt-8 md:px-8">
      <header className="mb-8">
        <h1 className="text-2xl font-bold">Gösterge Paneli</h1>
        <p className="mt-1 text-zinc-400">
          Sitenin genel durumu ve canlı etkinlik.
        </p>
      </header>

      {/* KPI kartları */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kartlar.map((k) => (
          <Link
            key={k.etiket}
            href={k.href}
            className="rounded-xl border border-ink-line bg-ink-soft/60 p-4 transition-colors hover:border-zinc-600"
          >
            <div className="flex items-center gap-2 text-zinc-500">
              <k.icon size={15} />
              <span className="text-xs">{k.etiket}</span>
            </div>
            <p className="mt-2 text-2xl font-bold">
              {k.deger.toLocaleString("tr-TR")}
            </p>
          </Link>
        ))}
      </div>

      {/* Canlı istatistikler (10 sn'de bir tazelenir) */}
      <LiveStats ilk={ozet} />

      {/* Hızlı erişim */}
      <section className="mt-10">
        <h2 className="mb-3 text-lg font-semibold">Hızlı Erişim</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { href: "/admin/icerik", label: "İçerik / Anime", icon: Film },
            { href: "/admin/blog/yeni", label: "Yeni Blog Yazısı", icon: FileText },
            { href: "/admin/analiz", label: "Analiz", icon: BarChart3 },
            { href: "/admin/guvenlik", label: "Güvenlik", icon: Shield },
          ].map((h) => (
            <Link
              key={h.href}
              href={h.href}
              className="flex items-center gap-3 rounded-lg border border-ink-line bg-ink-soft/40 p-4 text-sm font-medium transition-colors hover:border-brand hover:text-brand"
            >
              <h.icon size={18} />
              {h.label}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
