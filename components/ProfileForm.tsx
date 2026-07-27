"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, Loader2, LogOut, Save } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function ProfileForm({
  initial,
}: {
  initial: { username: string; full_name: string };
}) {
  const router = useRouter();
  const [username, setUsername] = useState(initial.username);
  const [fullName, setFullName] = useState(initial.full_name);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const kaydet = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/giris?next=%2Fprofil");
      return;
    }

    const { error: err } = await supabase
      .from("profiles")
      .update({
        username: username.trim() || null,
        full_name: fullName.trim() || null,
      })
      .eq("id", user.id);

    setBusy(false);

    if (err) {
      // `username` benzersiz — çakışmayı anlaşılır biçimde bildir
      setError(
        err.code === "23505"
          ? "Bu kullanıcı adı zaten alınmış."
          : err.message,
      );
      return;
    }

    setSaved(true);
    router.refresh();
  };

  const cikis = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  return (
    <form
      onSubmit={kaydet}
      className="rounded-xl border border-ink-line bg-ink-soft/60 p-5"
    >
      <h2 className="text-lg font-semibold">Hesap bilgileri</h2>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm text-zinc-300">
            Kullanıcı adı
          </span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            maxLength={32}
            className="w-full rounded-lg border border-ink-line bg-ink px-3 py-2 text-sm outline-none focus:border-brand"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm text-zinc-300">
            Görünen ad
          </span>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            maxLength={64}
            className="w-full rounded-lg border border-ink-line bg-ink px-3 py-2 text-sm outline-none focus:border-brand"
          />
        </label>
      </div>

      {error ? (
        <p className="mt-4 rounded-lg bg-red-950/60 p-3 text-sm text-red-300">
          {error}
        </p>
      ) : null}

      {saved ? (
        <p className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-950/60 p-3 text-sm text-emerald-300">
          <Check size={16} /> Kaydedildi.
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={busy}
          className="flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-brand-hi disabled:opacity-50"
        >
          {busy ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <Save size={15} />
          )}
          Kaydet
        </button>

        <button
          type="button"
          onClick={cikis}
          className="flex items-center gap-2 rounded-lg bg-white/10 px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-white/20"
        >
          <LogOut size={15} /> Çıkış yap
        </button>
      </div>
    </form>
  );
}
