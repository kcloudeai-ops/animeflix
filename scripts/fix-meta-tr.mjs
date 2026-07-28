#!/usr/bin/env node
/**
 * ============================================================
 *  scripts/fix-meta-tr.mjs
 *
 *  Seed scriptleri `meta_description` alanını İNGİLİZCE synopsis
 *  ile doldurmuştu (synopsis.slice(0,155)). Bu, Türkçe bir site
 *  için yanlış meta açıklaması demek. Bu script, otomatik üretilmiş
 *  İngilizce meta_description'ları TESPİT EDİP null'lar; böylece
 *  site render'da Türkçe açıklamayı yapısal alanlardan üretir
 *  (lib/seo.ts → animeMetaAciklama).
 *
 *  GÜVENLİ: Yalnızca `meta_description === synopsis.slice(0,155).trim()`
 *  olan satırlara dokunur (seed'in imzası). Admin'in elle girdiği,
 *  synopsis'ten farklı açıklamalar KORUNUR.
 *
 *  Kullanım:
 *    node scripts/fix-meta-tr.mjs           (KURU ÇALIŞMA — sadece rapor)
 *    node scripts/fix-meta-tr.mjs --apply   (gerçekten null'lar)
 * ============================================================
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const envText = fs.readFileSync(path.join(ROOT, ".env.local"), "utf8");
const env = (k) => {
  const m = envText.match(new RegExp(`^${k}=(.*)$`, "m"));
  return m ? m[1].trim() : "";
};

const SUPABASE_URL = env("NEXT_PUBLIC_SUPABASE_URL");
const KEY = env("SUPABASE_SERVICE_ROLE_KEY");
if (!SUPABASE_URL || !KEY || KEY.includes("...")) {
  console.error("\n  HATA: .env.local içinde SUPABASE_SERVICE_ROLE_KEY eksik.\n");
  process.exit(1);
}

const APPLY = process.argv.includes("--apply");
const SB = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  "Content-Type": "application/json",
};

// ---------- Tüm satırları sayfalayarak çek (PostgREST 1000 sınırı) ----------
async function tumAnimeler() {
  const hepsi = [];
  const SAYFA = 1000;
  for (let off = 0; ; off += SAYFA) {
    const url =
      `${SUPABASE_URL}/rest/v1/animes` +
      `?select=id,title,synopsis,meta_description` +
      `&meta_description=not.is.null&synopsis=not.is.null` +
      `&order=id.asc&limit=${SAYFA}&offset=${off}`;
    const res = await fetch(url, { headers: SB });
    if (!res.ok) throw new Error(`select (${res.status}): ${(await res.text()).slice(0, 200)}`);
    const parca = await res.json();
    hepsi.push(...parca);
    if (parca.length < SAYFA) break;
  }
  return hepsi;
}

// Seed imzası: meta_description, synopsis'in ilk 155 karakterinin trim'i mi?
function otomatikIngilizce(a) {
  const auto = (a.synopsis ?? "").slice(0, 155).trim();
  return auto.length > 0 && a.meta_description === auto;
}

async function nullla(ids) {
  const PARCA = 200;
  for (let i = 0; i < ids.length; i += PARCA) {
    const grup = ids.slice(i, i + PARCA);
    const url = `${SUPABASE_URL}/rest/v1/animes?id=in.(${grup.join(",")})`;
    const res = await fetch(url, {
      method: "PATCH",
      headers: { ...SB, Prefer: "return=minimal" },
      body: JSON.stringify({ meta_description: null }),
    });
    if (!res.ok) throw new Error(`patch (${res.status}): ${(await res.text()).slice(0, 200)}`);
    process.stdout.write(`  güncellendi: ${Math.min(i + PARCA, ids.length)}/${ids.length}\r`);
  }
  process.stdout.write("\n");
}

async function main() {
  console.log(`\n  Mod: ${APPLY ? "UYGULA (--apply)" : "KURU ÇALIŞMA (rapor)"}\n`);
  const rows = await tumAnimeler();
  console.log(`  meta_description dolu + synopsis dolu satır: ${rows.length}`);

  const hedef = rows.filter(otomatikIngilizce);
  console.log(`  otomatik İngilizce (null'lanacak): ${hedef.length}`);
  console.log(`  korunacak (admin/farklı metin): ${rows.length - hedef.length}\n`);

  console.log("  Örnekler (null'lanacaklar):");
  for (const a of hedef.slice(0, 3)) {
    console.log(`   • ${a.title}\n     "${a.meta_description.slice(0, 70)}…"`);
  }

  if (!APPLY) {
    console.log("\n  Kuru çalışma. Uygulamak için: node scripts/fix-meta-tr.mjs --apply\n");
    return;
  }

  console.log(`\n  ${hedef.length} satır null'lanıyor…`);
  await nullla(hedef.map((a) => a.id));
  console.log("  Bitti. Artık site meta açıklamalarını Türkçe üretecek.\n");
}

main().catch((e) => {
  console.error("\n  HATA:", e.message, "\n");
  process.exit(1);
});
