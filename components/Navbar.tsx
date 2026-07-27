"use client";

import Link from "next/link";
import { motion, useScroll, useMotionValueEvent } from "framer-motion";
import { Shuffle, User } from "lucide-react";
import { useState } from "react";
import { CategoryMenu } from "./CategoryMenu";
import { MobileMenu } from "./MobileMenu";
import { SearchBar } from "./SearchBar";

// /listem middleware'deki AUTH_REQUIRED listesiyle korunuyor:
// oturumu olmayan ziyaretçi tıklarsa /giris'e yönlenir.
const LINKS = [
  { href: "/", label: "Anasayfa" },
  { href: "/kesfet", label: "Keşfet" },
  { href: "/takvim", label: "Takvim" },
  { href: "/koleksiyon", label: "Koleksiyonlar" },
  { href: "/blog", label: "Blog" },
  { href: "/listem", label: "Listem" },
];

export function Navbar() {
  const { scrollY } = useScroll();
  const [solid, setSolid] = useState(false);

  // Netflix davranışı: sayfa kaydırıldıkça şeffaf -> opak
  useMotionValueEvent(scrollY, "change", (y) => setSolid(y > 60));

  return (
    <motion.header
      initial={false}
      animate={{
        backgroundColor: solid ? "rgba(11,11,15,0.92)" : "rgba(11,11,15,0)",
        backdropFilter: solid ? "blur(12px)" : "blur(0px)",
      }}
      transition={{ duration: 0.3 }}
      className="fixed inset-x-0 top-0 z-50"
    >
      <nav className="mx-auto flex h-16 max-w-[1600px] items-center gap-4 px-4 md:gap-8 md:px-10">
        <MobileMenu links={LINKS} />

        <Link href="/" className="shrink-0">
          <span className="text-2xl font-extrabold tracking-tight text-brand">
            ANIME<span className="text-white">FLIX</span>
          </span>
        </Link>

        <ul className="hidden items-center gap-6 text-sm text-zinc-300 md:flex">
          {LINKS.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                className="transition-colors hover:text-white"
              >
                {l.label}
              </Link>
            </li>
          ))}
          <li>
            <CategoryMenu />
          </li>
        </ul>

        <div className="ml-auto flex items-center gap-3 md:gap-4">
          <SearchBar />
          <a
            href="/rastgele"
            aria-label="Rastgele anime"
            title="Rastgele anime"
            className="hidden text-zinc-300 transition-colors hover:text-white sm:block"
          >
            <Shuffle size={19} />
          </a>
          {/* Oturum varsa middleware /profil'e izin verir, yoksa /giris'e
              yönlendirir — bu yüzden tek hedef yeterli. */}
          <Link
            href="/profil"
            aria-label="Hesabım"
            className="rounded-md bg-white/10 p-1.5 text-zinc-200 transition-colors hover:bg-white/20"
          >
            <User size={18} />
          </Link>
        </div>
      </nav>
    </motion.header>
  );
}
