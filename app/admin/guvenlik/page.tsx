import type { Metadata } from "next";
import { ExternalLink, Shield, ShieldAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getDenetimGunlugu } from "@/lib/queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Güvenlik",
  robots: { index: false, follow: false },
};

const ISLEM_TR: Record<string, string> = {
  anime_import: "Anime içe aktarıldı",
  anime_delete: "Anime silindi",
  anime_update: "Anime güncellendi",
  episode_update: "Bölüm güncellendi",
  blog_create: "Blog yazısı oluşturuldu",
  blog_update: "Blog yazısı güncellendi",
  blog_delete: "Blog yazısı silindi",
};

async function sonUyeler() {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("username, role, last_seen_at, created_at")
    .order("last_seen_at", { ascending: false, nullsFirst: false })
    .limit(10);
  return (data ?? []) as {
    username: string | null;
    role: string;
    last_seen_at: string | null;
    created_at: string;
  }[];
}

export default async function AdminGuvenlikPage() {
  const [gunluk, uyeler] = await Promise.all([
    getDenetimGunlugu(50),
    sonUyeler(),
  ]);

  const tarih = (s: string | null) =>
    s ? new Date(s).toLocaleString("tr-TR") : "—";

  return (
    <div className="px-4 pb-20 pt-8 md:px-8">
      <header className="mb-8">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Shield size={24} /> Güvenlik
        </h1>
        <p className="mt-1 text-zinc-400">
          Yönetici işlem günlüğü, üye etkinliği ve koruma durumu.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Denetim günlüğü */}
        <section className="rounded-xl border border-ink-line bg-ink-soft/60 p-5">
          <h2 className="mb-4 text-sm font-semibold text-zinc-300">
            İşlem Günlüğü{" "}
            <span className="font-normal text-zinc-600">
              (son {gunluk.length})
            </span>
          </h2>
          {gunluk.length === 0 ? (
            <p className="text-sm text-zinc-500">
              Henüz kayıtlı işlem yok. Anime aktardığınızda ya da içerik
              düzenlediğinizde burada görünür.
            </p>
          ) : (
            <ul className="max-h-[420px] space-y-2 overflow-y-auto">
              {gunluk.map((k) => (
                <li
                  key={k.id}
                  className="flex items-start gap-2 border-b border-ink-line/60 pb-2 text-sm last:border-0"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-zinc-200">
                      {ISLEM_TR[k.action] ?? k.action}
                    </span>
                    {k.detail ? (
                      <span className="block truncate text-xs text-zinc-600">
                        {JSON.stringify(k.detail)}
                      </span>
                    ) : null}
                  </span>
                  <span className="shrink-0 text-xs text-zinc-600">
                    {tarih(k.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Üye etkinliği */}
        <section className="rounded-xl border border-ink-line bg-ink-soft/60 p-5">
          <h2 className="mb-4 text-sm font-semibold text-zinc-300">
            Son Aktif Üyeler
          </h2>
          {uyeler.length === 0 ? (
            <p className="text-sm text-zinc-500">Üye yok.</p>
          ) : (
            <ul className="space-y-2">
              {uyeler.map((u, i) => (
                <li key={i} className="flex items-center gap-3 text-sm">
                  <span className="min-w-0 flex-1 truncate text-zinc-200">
                    {u.username ?? "isimsiz"}
                    {u.role !== "user" ? (
                      <span className="ml-2 rounded bg-brand/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-brand">
                        {u.role}
                      </span>
                    ) : null}
                  </span>
                  <span className="shrink-0 text-xs text-zinc-600">
                    {tarih(u.last_seen_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Altyapı koruması — dürüst bilgilendirme */}
      <section className="mt-8 rounded-xl border border-amber-800/40 bg-amber-950/20 p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-amber-200">
          <ShieldAlert size={16} /> Altyapı Koruması
        </h2>
        <p className="mt-2 text-sm text-zinc-400">
          DDoS, bot ve WAF (web uygulaması güvenlik duvarı) gibi saldırılar
          uygulama katmanında <strong>görünmez</strong> — bunlar CDN/barındırma
          katmanında durdurulur. Yukarıdaki günlük yalnızca uygulama içi
          yönetici işlemlerini ve üye etkinliğini gösterir. Gerçek saldırı
          koruması için:
        </p>
        <ul className="mt-3 space-y-2 text-sm">
          <li className="flex items-center gap-2">
            <span className="text-amber-400">•</span>
            <span className="text-zinc-300">
              <strong>Cloudflare</strong> (ücretsiz katman) — DDoS koruması, bot
              yönetimi, WAF, hız sınırı.
            </span>
            <a
              href="https://dash.cloudflare.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand hover:underline"
            >
              <ExternalLink size={13} />
            </a>
          </li>
          <li className="flex items-center gap-2">
            <span className="text-amber-400">•</span>
            <span className="text-zinc-300">
              <strong>Supabase → Authentication → Rate Limits</strong> — giriş
              denemesi sınırı ve başarısız giriş takibi.
            </span>
          </li>
          <li className="flex items-center gap-2">
            <span className="text-amber-400">•</span>
            <span className="text-zinc-300">
              <strong>Supabase → Logs → Auth</strong> — başarısız giriş
              denemeleri ve şüpheli erişim burada görünür.
            </span>
          </li>
        </ul>
      </section>
    </div>
  );
}
