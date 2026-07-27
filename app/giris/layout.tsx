import type { Metadata } from "next";

// page.tsx bir Client Component olduğu için `metadata` export edemez;
// başlık ve noindex bayrağı bu sunucu layout'undan verilir.
export const metadata: Metadata = {
  title: "Giriş Yap",
  robots: { index: false, follow: false },
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
