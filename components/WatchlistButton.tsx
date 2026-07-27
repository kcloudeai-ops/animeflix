"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Check, Loader2, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";

/**
 * "Listeme ekle" düğmesi. Oturum yoksa /giris'e yönlendirir.
 * Başlangıç durumu istemcide okunur — detay sayfası ISR ile
 * önbelleklendiği için sunucuda kullanıcıya özel veri okunamaz.
 */
export function WatchlistButton({ animeId }: { animeId: string }) {
  const router = useRouter();
  const [inList, setInList] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) return setLoading(false);

    const supabase = createClient();
    let iptal = false;

    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        if (!iptal) setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("watchlist")
        .select("anime_id")
        .eq("anime_id", animeId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (!iptal) {
        setInList(!!data);
        setLoading(false);
      }
    })();

    return () => {
      iptal = true;
    };
  }, [animeId]);

  const toggle = async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push(`/giris?next=${encodeURIComponent(location.pathname)}`);
      return;
    }

    setBusy(true);
    // İyimser güncelleme: tıklama anında geri bildirim ver
    const hedef = !inList;
    setInList(hedef);

    const { error } = hedef
      ? await supabase
          .from("watchlist")
          .upsert({ user_id: user.id, anime_id: animeId })
      : await supabase
          .from("watchlist")
          .delete()
          .eq("user_id", user.id)
          .eq("anime_id", animeId);

    setBusy(false);
    if (error) {
      setInList(!hedef); // geri al
      alert(`İşlem başarısız: ${error.message}`);
      return;
    }
    router.refresh();
  };

  return (
    <button
      onClick={toggle}
      disabled={loading || busy}
      aria-pressed={inList}
      className={`inline-flex items-center gap-2 rounded px-5 py-2.5 font-semibold transition-colors disabled:opacity-60 ${
        inList
          ? "bg-white/20 text-white hover:bg-white/30"
          : "bg-white/10 text-zinc-200 hover:bg-white/20"
      }`}
    >
      {loading || busy ? (
        <Loader2 size={18} className="animate-spin" />
      ) : inList ? (
        <Check size={18} />
      ) : (
        <Plus size={18} />
      )}
      {inList ? "Listemde" : "Listeme Ekle"}
    </button>
  );
}
