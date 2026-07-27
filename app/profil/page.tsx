import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { ProfileForm } from "@/components/ProfileForm";
import type { Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Profilim",
  robots: { index: false, follow: false },
};

export default async function ProfilePage() {
  if (!isSupabaseConfigured) redirect("/");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/giris?next=%2Fprofil");

  const [{ data: profile }, watchlist, progress] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase
      .from("watchlist")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id),
    supabase
      .from("watch_progress")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id),
  ]);

  const p = profile as Profile | null;

  const istatistik = [
    { etiket: "Listemdeki seri", deger: watchlist.count ?? 0 },
    { etiket: "İzlenen bölüm", deger: progress.count ?? 0 },
    {
      etiket: "Üyelik",
      deger: p?.created_at
        ? new Date(p.created_at).toLocaleDateString("tr-TR", {
            year: "numeric",
            month: "long",
          })
        : "—",
    },
  ];

  return (
    <div className="mx-auto max-w-[900px] px-4 pb-20 pt-24 md:px-8">
      <header className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">
          Profilim
        </h1>
        <p className="mt-1 text-zinc-400">{user.email}</p>
        {p?.role && p.role !== "user" ? (
          <span className="mt-2 inline-block rounded-full bg-brand px-3 py-1 text-xs font-semibold uppercase tracking-wide">
            {p.role}
          </span>
        ) : null}
      </header>

      <div className="mb-8 grid gap-3 sm:grid-cols-3">
        {istatistik.map((s) => (
          <div
            key={s.etiket}
            className="rounded-xl border border-ink-line bg-ink-soft/60 p-4"
          >
            <p className="text-2xl font-bold">{s.deger}</p>
            <p className="mt-0.5 text-sm text-zinc-500">{s.etiket}</p>
          </div>
        ))}
      </div>

      <ProfileForm
        initial={{
          username: p?.username ?? "",
          full_name: p?.full_name ?? "",
        }}
      />

      {p?.role === "admin" ? (
        <Link
          href="/admin"
          className="mt-6 inline-block rounded-lg bg-white/10 px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-white/20"
        >
          Yönetim paneline git
        </Link>
      ) : null}
    </div>
  );
}
