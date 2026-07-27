import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { BlogEditor } from "@/components/admin/BlogEditor";
import type { BlogPost } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Yazıyı Düzenle",
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ id: string }> };

export default async function YaziDuzenlePage({ params }: Props) {
  const { id } = await params;
  if (!isSupabaseConfigured) notFound();

  const supabase = await createClient();
  const { data } = await supabase
    .from("blog_posts")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!data) notFound();

  return <BlogEditor post={data as BlogPost} />;
}
