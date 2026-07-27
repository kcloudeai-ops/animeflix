"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  FileText,
  Film,
  LayoutDashboard,
  Menu,
  Shield,
  X,
} from "lucide-react";
import { useState } from "react";

const BOLUMLER = [
  { href: "/admin", label: "Gösterge Paneli", icon: LayoutDashboard, exact: true },
  { href: "/admin/icerik", label: "İçerik / Anime", icon: Film },
  { href: "/admin/blog", label: "Blog", icon: FileText },
  { href: "/admin/analiz", label: "Analiz", icon: BarChart3 },
  { href: "/admin/guvenlik", label: "Güvenlik", icon: Shield },
];

export function AdminSidebar() {
  const yol = usePathname();
  const [acik, setAcik] = useState(false);

  const aktifMi = (href: string, exact?: boolean) =>
    exact ? yol === href : yol === href || yol.startsWith(`${href}/`);

  const liste = (
    <nav className="space-y-1">
      {BOLUMLER.map(({ href, label, icon: Icon, exact }) => {
        const aktif = aktifMi(href, exact);
        return (
          <Link
            key={href}
            href={href}
            onClick={() => setAcik(false)}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
              aktif
                ? "bg-brand text-white"
                : "text-zinc-400 hover:bg-white/5 hover:text-white"
            }`}
          >
            <Icon size={18} />
            {label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* Mobil aç düğmesi */}
      <button
        onClick={() => setAcik(true)}
        className="fixed left-4 top-20 z-40 rounded-lg bg-ink-soft p-2 text-zinc-300 ring-1 ring-ink-line md:hidden"
        aria-label="Menü"
      >
        <Menu size={20} />
      </button>

      {/* Masaüstü sabit sidebar */}
      <aside className="hidden w-60 shrink-0 border-r border-ink-line md:block">
        <div className="sticky top-16 p-4">
          <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-wide text-zinc-600">
            Yönetim
          </p>
          {liste}
        </div>
      </aside>

      {/* Mobil çekmece */}
      {acik ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/70"
            onClick={() => setAcik(false)}
          />
          <div className="absolute left-0 top-0 h-full w-64 border-r border-ink-line bg-ink p-4">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-sm font-semibold">Yönetim</span>
              <button onClick={() => setAcik(false)} aria-label="Kapat">
                <X size={20} className="text-zinc-400" />
              </button>
            </div>
            {liste}
          </div>
        </div>
      ) : null}
    </>
  );
}
