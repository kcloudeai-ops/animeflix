import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";

/**
 * Server Component / Route Handler / Server Action istemcisi.
 * Next.js 15'te `cookies()` async olduğu için bu fonksiyon da async.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Server Component'ten çağrıldığında cookie yazılamaz.
          // Oturum yenileme zaten middleware'de yapıldığı için güvenle yutulur.
        }
      },
    },
  });
}

/**
 * NOT: Burada bir `createAdminClient` (service_role) yardımcısı vardı ve
 * hiçbir yerden çağrılmıyordu. Kaldırıldı: service_role RLS'i tamamen
 * baypas eder, dolayısıyla web uygulamasında hazır bekleyen böyle bir
 * fonksiyon yalnızca kazara kullanılma riski taşır.
 *
 * Toplu veri işleri (scripts/seed-anilist.mjs, scripts/fill-titles.mjs)
 * service_role anahtarını kendileri okur ve Next.js'ten bağımsız çalışır.
 */
