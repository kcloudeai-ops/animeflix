#!/usr/bin/env node
/**
 * ============================================================
 *  scripts/fill-trailers.mjs
 *
 *  trailer_url'i boş olan animeler için AniList'ten resmi
 *  YouTube fragman ID'sini çeker. Yalnızca RESMİ fragmanlar
 *  (AniList'in trailer alanı) — telif riski yok.
 *
 *  Kullanım: npm run fill:trailers
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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SB = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

// ---------- AniList ----------
let sonIstek = 0;
async function anilist(ids, deneme = 0) {
  const bekle = 1500 - (Date.now() - sonIstek);
  if (bekle > 0) await sleep(bekle);
  sonIstek = Date.now();

  const query = `
  query ($ids: [Int]) {
    Page(page: 1, perPage: 50) {
      media(idMal_in: $ids, type: ANIME) {
        idMal
        trailer { id site }
      }
    }
  }`;

  const res = await fetch("https://graphql.anilist.co", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query, variables: { ids } }),
  });
  if (res.status === 429 && deneme < 4) {
    const s = Number(res.headers.get("retry-after") ?? 60);
    console.log(`  hız sınırı — ${s}s bekleniyor…`);
    await sleep(s * 1000 + 500);
    return anilist(ids, deneme + 1);
  }
  if (!res.ok) throw new Error(`AniList ${res.status}`);
  const json = await res.json();
  if (json.errors?.length) throw new Error(json.errors[0].message);
  return json.data.Page.media;
}

async function tumEksikler() {
  const hepsi = [];
  for (let off = 0; off < 100_000; off += 1000) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/animes?select=id,mal_id&trailer_url=is.null&mal_id=not.is.null&order=id&limit=1000&offset=${off}`,
      { headers: SB },
    );
    if (!res.ok) throw new Error(`animes (${res.status})`);
    const p = await res.json();
    hepsi.push(...p);
    if (p.length < 1000) break;
  }
  return hepsi;
}

async function guncelle(id, trailerUrl) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/animes?id=eq.${id}`, {
    method: "PATCH",
    headers: { ...SB, Prefer: "return=minimal" },
    body: JSON.stringify({ trailer_url: trailerUrl }),
  });
  if (!res.ok) throw new Error(`PATCH ${id} (${res.status})`);
}

async function main() {
  console.log("\n  Eksik fragmanlar dolduruluyor…\n");
  const eksik = await tumEksikler();
  const malHarita = new Map(eksik.map((a) => [a.mal_id, a.id]));
  console.log(`  ${eksik.length} animede fragman eksik\n`);

  let bulundu = 0, yok = 0, hata = 0;

  for (let i = 0; i < eksik.length; i += 50) {
    const parti = eksik.slice(i, i + 50).map((a) => a.mal_id);
    try {
      const media = await anilist(parti);
      for (const m of media) {
        const id = malHarita.get(m.idMal);
        if (!id) continue;
        // Yalnızca YouTube fragmanları
        if (m.trailer?.site === "youtube" && m.trailer.id) {
          try {
            await guncelle(id, `https://www.youtube.com/embed/${m.trailer.id}`);
            bulundu++;
          } catch (e) {
            hata++;
            console.log(`  [HATA] ${m.idMal}: ${String(e.message).slice(0, 80)}`);
          }
        } else {
          yok++;
        }
      }
      console.log(`  [${Math.min(i + 50, eksik.length)}/${eksik.length}] ${bulundu} fragman bulundu`);
    } catch (e) {
      hata++;
      console.log(`  [HATA] parti ${i / 50 + 1}: ${String(e.message).slice(0, 80)}`);
      if (hata > 15) break;
    }
  }

  console.log(`\n  ---- Bitti ----`);
  console.log(`  eklenen fragman   : ${bulundu}`);
  console.log(`  AniList'te yok    : ${yok}`);
  console.log(`  hata              : ${hata}\n`);
}

main().catch((e) => { console.error("\n  Beklenmeyen hata:", e); process.exit(1); });
