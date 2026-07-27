import type { Metadata } from "next";
import { BlogEditor } from "@/components/admin/BlogEditor";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Yeni Yazı",
  robots: { index: false, follow: false },
};

export default function YeniYaziPage() {
  return <BlogEditor />;
}
