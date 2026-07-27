import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";

/**
 * Çerez okumayan, tamamen genel amaçlı istemci.
 *
 * `supabase/server.ts` çerezlerden oturum okur; bu da onu kullanan her
 * sorguyu istek-bağımlı yapar ve `unstable_cache` içine konulmasını
 * imkânsız kılar. Kullanıcıdan bağımsız veriler (tür listesi, filtre
 * seçenekleri) bu istemciyle çekilip önbelleğe alınabilir.
 *
 * RLS hâlâ geçerli: publishable anahtar yalnızca herkese açık satırları
 * görür.
 */
export function createPublicClient() {
  return createSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
