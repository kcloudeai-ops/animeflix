import "server-only";
import { createClient } from "./supabase/server";

/**
 * Yönetici işlemini denetim günlüğüne yazar. Sessizce başarısız olur —
 * günlük yazımı asıl işlemi (aktarma vb.) hiçbir zaman bozmamalı.
 * RLS: yalnızca admin insert edebilir (admin_audit_admin_write).
 */
export async function denetimYaz(
  action: string,
  detail?: Record<string, unknown>,
): Promise<void> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    await supabase.from("admin_audit").insert({
      admin_id: user?.id ?? null,
      action,
      detail: detail ?? null,
    });
  } catch {
    // yut
  }
}
