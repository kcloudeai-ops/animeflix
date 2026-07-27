"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";

function LoginForm() {
  const router = useRouter();
  const next = useSearchParams().get("next") ?? "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSupabaseConfigured) {
      setMessage("Supabase yapılandırılmamış (.env.local).");
      return;
    }
    setBusy(true);
    setMessage(null);

    const supabase = createClient();
    const { error } =
      mode === "login"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

    setBusy(false);
    if (error) return setMessage(error.message);

    if (mode === "signup") {
      setMessage("E-postanıza gönderilen bağlantıyla hesabınızı doğrulayın.");
      return;
    }
    router.push(next);
    router.refresh();
  };

  return (
    <motion.form
      onSubmit={submit}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-sm rounded-xl border border-ink-line bg-ink-soft/80 p-8 backdrop-blur"
    >
      <h1 className="text-2xl font-bold">
        {mode === "login" ? "Giriş Yap" : "Hesap Oluştur"}
      </h1>

      <div className="mt-6 space-y-3">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="E-posta"
          className="w-full rounded-lg border border-ink-line bg-ink px-3 py-2.5 text-sm outline-none focus:border-brand"
        />
        <input
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Parola"
          className="w-full rounded-lg border border-ink-line bg-ink px-3 py-2.5 text-sm outline-none focus:border-brand"
        />
      </div>

      <button
        type="submit"
        disabled={busy}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-brand py-2.5 font-semibold transition-colors hover:bg-brand-hi disabled:opacity-50"
      >
        {busy ? <Loader2 size={16} className="animate-spin" /> : null}
        {mode === "login" ? "Giriş Yap" : "Kayıt Ol"}
      </button>

      {message ? (
        <p className="mt-4 rounded-lg bg-ink p-3 text-sm text-amber-300">{message}</p>
      ) : null}

      <button
        type="button"
        onClick={() => setMode(mode === "login" ? "signup" : "login")}
        className="mt-4 w-full text-sm text-zinc-400 hover:text-white"
      >
        {mode === "login"
          ? "Hesabın yok mu? Kayıt ol"
          : "Zaten hesabın var mı? Giriş yap"}
      </button>
    </motion.form>
  );
}

export default function LoginPage() {
  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
