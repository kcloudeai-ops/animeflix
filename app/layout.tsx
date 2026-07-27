import type { Metadata } from "next";
import "./globals.css";
import { GOOGLE_VERIFICATION, SITE_URL } from "@/lib/supabase/config";
import { Providers } from "./providers";
import { Navbar } from "@/components/Navbar";
import { BottomNav } from "@/components/BottomNav";
import { PageTracker } from "@/components/PageTracker";


export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "AnimeFlix — Türkçe Altyazılı Anime İzle",
    template: "%s | AnimeFlix",
  },
  description:
    "Binlerce anime serisi ve filmi HD kalitede, Türkçe altyazılı ve reklamsız. Yeni bölümler her hafta.",
  keywords: ["anime izle", "türkçe altyazılı anime", "anime bölümleri", "hd anime"],
  // Kök canonical; iç sayfalar kendi `alternates.canonical` değerleriyle ezer
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "tr_TR",
    siteName: "AnimeFlix",
    url: SITE_URL,
  },
  twitter: { card: "summary_large_image" },
  // Search Console doğrulaması — kod varsa <meta name="google-site-verification">
  ...(GOOGLE_VERIFICATION
    ? { verification: { google: GOOGLE_VERIFICATION } }
    : {}),
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large", // Google görsel önizlemesini büyük göstersin
      "max-snippet": -1,
    },
  },
};

export const viewport = {
  themeColor: "#0b0b0f",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr">
      {/*
        suppressHydrationWarning: ColorZilla, Grammarly, LastPass gibi
        tarayıcı eklentileri React hydrate olmadan önce <body>'ye kendi
        attribute'larını ekliyor (ör. cz-shortcut-listen="true"). Bu,
        sunucu HTML'i ile istemci arasında sahte bir uyuşmazlık üretir.
        Bayrak yalnızca BU elemanın attribute'larını kapsar; içerideki
        gerçek hydration hataları raporlanmaya devam eder.
      */}
      <body className="min-h-dvh bg-ink antialiased" suppressHydrationWarning>
        <Providers>
          <PageTracker />
          <Navbar />
          {/* pb-16: alt gezinme çubuğu içeriği örtmesin (yalnızca mobil) */}
          <main className="pb-16 md:pb-0">{children}</main>
          <BottomNav />
          <footer className="border-t border-ink-line mt-24 py-10 text-center text-sm text-zinc-500">
            <p>
              © {new Date().getFullYear()} AnimeFlix — Anime verileri{" "}
              <a
                href="https://jikan.moe"
                className="underline hover:text-zinc-300"
                rel="noopener noreferrer"
                target="_blank"
              >
                Jikan API
              </a>{" "}
              üzerinden MyAnimeList'ten alınmaktadır.
            </p>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
