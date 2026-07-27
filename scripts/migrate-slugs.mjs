#!/usr/bin/env node
/**
 * ============================================================
 *  scripts/migrate-slugs.mjs
 *
 *  Mevcut anime slug'larını yeni "izle" formatına taşır:
 *    tokyo-ghoul-16498  ->  tokyo-ghoul-izle-16498
 *
 *  Zaten yeni formatta olanları atlar (idempotent). Eski URL'ler
 *  kırılmaz: uygulama animeyi slug'ın sonundaki mal_id ile bulup
 *  canonical'a 308 kalıcı yönlendirme yapar.
 *
 *  Kullanım: npm run migrate:slugs
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

const SB = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

async function tumAnimeler() {
  const hepsi = [];
  for (let off = 0; off < 100_000; off += 1000) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/animes?select=id,mal_id,slug&order=id&limit=1000&offset=${off}`,
      { headers: SB },
    );
    if (!res.ok) throw new Error(`animes (${res.status})`);
    const p = await res.json();
    hepsi.push(...p);
    if (p.length < 1000) break;
  }
  return hepsi;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Geçici ağ/DNS hatalarında birkaç kez dener. */
async function slugGuncelle(id, slug, deneme = 0) {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/animes?id=eq.${id}`, {
      method: "PATCH",
      headers: { ...SB, Prefer: "return=minimal" },
      body: JSON.stringify({ slug }),
    });
    if (!res.ok) {
      throw new Error(`PATCH ${id} (${res.status}): ${(await res.text()).slice(0, 120)}`);
    }
  } catch (err) {
    // fetch failed / ENOTFOUND gibi geçici hatalar: 3 kez, artan bekleme
    if (deneme < 3) {
      await sleep(1000 * (deneme + 1));
      return slugGuncelle(id, slug, deneme + 1);
    }
    throw err;
  }
}

async function main() {
  console.log("\n  Slug göçü: '...-ID' -> '...-izle-ID'\n");
  const animeler = await tumAnimeler();

  let guncel = 0, atlanan = 0, hata = 0, ardisik = 0;

  for (const a of animeler) {
    // Zaten "-izle-<id>" ile bitiyorsa atla
    if (new RegExp(`-izle-${a.mal_id}$`).test(a.slug)) { atlanan++; continue; }

    // Sondaki "-<id>" ekini "-izle-<id>" ile değiştir
    const kok = a.slug.replace(new RegExp(`-${a.mal_id}$`), "");
    const yeni = `${kok}-izle-${a.mal_id}`;

    try {
      await slugGuncelle(a.id, yeni);
      guncel++;
      ardisik = 0;
      if (guncel % 200 === 0) console.log(`  ${guncel} güncellendi…`);
    } catch (err) {
      hata++;
      ardisik++;
      console.log(`  [HATA] ${a.slug}: ${String(err.message).slice(0, 100)}`);
      // Yalnızca ART ARDA çok hata olursa dur (ağ tamamen koptu demektir).
      // Tek tük geçici hatalar göçü durdurmasın.
      if (ardisik >= 15) { console.log("  Ağ koptu — durduruluyor."); break; }
    }
  }

  console.log(`\n  ---- Bitti ----`);
  console.log(`  güncellenen : ${guncel}`);
  console.log(`  zaten yeni  : ${atlanan}`);
  console.log(`  hata        : ${hata}\n`);
}

main().catch((e) => { console.error("\n  Beklenmeyen hata:", e); process.exit(1); });
