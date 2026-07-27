import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { BlogPost } from "@/lib/types";
import { BlogAdminList } from "@/components/admin/BlogAdminList";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Blog Yönetimi",
  robots: { index: false, follow: false },
};

export default async function AdminBlogPage() {
  let posts: BlogPost[] = [];
  if (isSupabaseConfigured) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("blog_posts")
      .select("*")
      .order("created_at", { ascending: false });
    posts = (data ?? []) as BlogPost[];
  }

  return (
    <div className="mx-auto max-w-[1100px] px-4 pb-20 pt-24 md:px-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Blog Yönetimi</h1>
          <p className="mt-1 text-zinc-400">{posts.length} yazı</p>
        </div>
        <Link
          href="/admin/blog/yeni"
          className="flex items-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-brand-hi"
        >
          <Plus size={16} /> Yeni Yazı
        </Link>
      </div>

      <BlogAdminList posts={posts} />
    </div>
  );
}
