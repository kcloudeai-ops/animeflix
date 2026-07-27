"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bookmark, CalendarDays, Compass, Home, User } from "lucide-react";

const SEKMELER = [
  { href: "/", label: "Ana Sayfa", icon: Home },
  { href: "/kesfet", label: "Keşfet", icon: Compass },
  { href: "/takvim", label: "Takvim", icon: CalendarDays },
  { href: "/listem", label: "Listem", icon: Bookmark },
  { href: "/profil", label: "Profil", icon: User },
];

/**
 * Mobil alt gezinme. Hamburger menü tek dokunuşluk gezinmeyi
 * iki dokunuşa çıkarıyordu; anime izleyicilerinin çoğunluğu mobil.
 * Masaüstünde gizli — orada navbar zaten yeterli.
 */
export function BottomNav() {
  const yol = usePathname();

  return (
    <nav
      aria-label="Alt gezinme"
      // pb: iPhone'daki ev çubuğu alanı (safe-area) için
      className="fixed inset-x-0 bottom-0 z-50 border-t border-ink-line bg-ink/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg md:hidden"
    >
      <ul className="flex">
        {SEKMELER.map(({ href, label, icon: Icon }) => {
          const aktif = href === "/" ? yol === "/" : yol.startsWith(href);

          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={aktif ? "page" : undefined}
                className={`flex flex-col items-center gap-0.5 py-2 text-[10px] transition-colors ${
                  aktif ? "text-brand" : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <Icon size={20} strokeWidth={aktif ? 2.4 : 1.8} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
