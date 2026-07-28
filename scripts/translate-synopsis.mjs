#!/usr/bin/env node
/**
 * ============================================================
 *  scripts/translate-synopsis.mjs
 *
 *  İngilizce `synopsis`'i Türkçeye çevirip `synopsis_tr` kolonuna
 *  yazar. Kaynak metin korunur; site `synopsis_tr ?? synopsis`
 *  gösterir.
 *
 *  ÖN KOŞUL: supabase/09-synopsis-tr.sql çalıştırılmış olmalı
 *  (synopsis_tr kolonu). Yoksa script anlaşılır bir hata verir.
 *
 *  Çeviri: Google'ın resmi olmayan ücretsiz uç noktası. Anahtar
 *  gerektirmez; hız sınırı vardır, bu yüzden araya gecikme konur
 *  ve 429'da geri çekilir. YENİDEN ÇALIŞTIRILABİLİR: yalnızca
 *  synopsis_tr'si boş satırları işler, yarıda kalırsa kaldığı
 *  yerden devam eder.
 *
 *  Kullanım:
 *    node scripts/translate-synopsis.mjs --table=animes
 *    node scripts/translate-synopsis.mjs --table=episodes
 *    node scripts/translate-synopsis.mjs --table=animes --limit=20   (deneme)
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

const arg = (k, def) => {
  const m = process.argv.find((a) => a.startsWith(`--${k}=`));
  return m ? m.split("=")[1] : def;
};
const TABLE = arg("table", "animes");
const LIMIT = Number(arg("limit", "0")); // 0 = sınırsız
if (!["animes", "episodes"].includes(TABLE)) {
  console.error("\n  HATA: --table=animes veya --table=episodes olmalı.\n");
  process.exit(1);
}

const SB = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  "Content-Type": "application/json",
};
const bekle = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- Çevrilecek satırları çek (synopsis_tr boş) ----------
async function cekilecekler() {
  const hepsi = [];
  const SAYFA = 1000;
  for (let off = 0; ; off += SAYFA) {
    const url =
      `${SUPABASE_URL}/rest/v1/${TABLE}` +
      `?select=id,synopsis&synopsis=not.is.null&synopsis_tr=is.null` +
      `&order=id.asc&limit=${SAYFA}&offset=${off}`;
    const res = await fetch(url, { headers: SB });
    if (!res.ok) {
      const t = await res.text();
      if (t.includes("synopsis_tr")) {
        throw new Error(
          "synopsis_tr kolonu yok. Önce supabase/09-synopsis-tr.sql çalıştırın.",
        );
      }
      throw new Error(`select (${res.status}): ${t.slice(0, 200)}`);
    }
    const parca = await res.json();
    hepsi.push(...parca.filter((r) => (r.synopsis ?? "").trim().length > 0));
    if (parca.length < SAYFA) break;
    if (LIMIT && hepsi.length >= LIMIT) break;
  }
  return LIMIT ? hepsi.slice(0, LIMIT) : hepsi;
}

// ---------- Google (resmi olmayan) çeviri ----------
// Uzun metni cümle sınırından ~1500 karakterlik parçalara böl (URL sınırı).
function parcala(metin, max = 1500) {
  if (metin.length <= max) return [metin];
  const cumleler = metin.split(/(?<=[.!?…])\s+/);
  const parcalar = [];
  let buf = "";
  for (const c of cumleler) {
    if ((buf + " " + c).length > max) {
      if (buf) parcalar.push(buf);
      buf = c.length > max ? c.slice(0, max) : c;
    } else {
      buf = buf ? `${buf} ${c}` : c;
    }
  }
  if (buf) parcalar.push(buf);
  return parcalar;
}

async function ceviriParca(metin) {
  const url =
    "https://translate.googleapis.com/translate_a/single" +
    `?client=gtx&sl=en&tl=tr&dt=t&q=${encodeURIComponent(metin)}`;
  for (let deneme = 0; deneme < 5; deneme++) {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; AnimeKosesiBot/1.0)" },
    });
    if (res.status === 429 || res.status >= 500) {
      const s = 1500 * 2 ** deneme;
      process.stdout.write(` [${res.status}, ${s}ms bekleniyor]`);
      await bekle(s);
      continue;
    }
    if (!res.ok) throw new Error(`çeviri (${res.status})`);
    const data = await res.json();
    // data[0] = segment dizisi; her segment[0] = çevrilen parça
    return (data[0] ?? []).map((s) => s[0]).join("");
  }
  throw new Error("çeviri 5 denemede başarısız (hız sınırı olabilir)");
}

async function cevir(metin) {
  const parcalar = parcala(metin.trim());
  const sonuc = [];
  for (const p of parcalar) {
    sonuc.push(await ceviriParca(p));
    if (parcalar.length > 1) await bekle(250);
  }
  return sonuc.join(" ").trim();
}

async function yaz(id, tr) {
  const url = `${SUPABASE_URL}/rest/v1/${TABLE}?id=eq.${id}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: { ...SB, Prefer: "return=minimal" },
    body: JSON.stringify({ synopsis_tr: tr }),
  });
  if (!res.ok) throw new Error(`patch (${res.status}): ${(await res.text()).slice(0, 160)}`);
}

async function main() {
  console.log(`\n  Tablo: ${TABLE}${LIMIT ? ` (deneme, ilk ${LIMIT})` : ""}`);
  const rows = await cekilecekler();
  console.log(`  Çevrilecek satır: ${rows.length}\n`);
  if (rows.length === 0) {
    console.log("  Çevrilecek bir şey yok (hepsi dolu ya da synopsis boş).\n");
    return;
  }

  let ok = 0;
  let hata = 0;
  const t0 = Date.now();
  for (const r of rows) {
    try {
      const tr = await cevir(r.synopsis);
      if (tr && tr !== r.synopsis) {
        await yaz(r.id, tr);
        ok++;
      } else {
        hata++;
      }
    } catch (e) {
      hata++;
      process.stdout.write(`\n  #${r.id} hata: ${e.message}`);
    }
    if ((ok + hata) % 25 === 0 || ok + hata === rows.length) {
      const gecen = ((Date.now() - t0) / 1000).toFixed(0);
      process.stdout.write(
        `\r  ilerleme: ${ok + hata}/${rows.length}  (ok:${ok} hata:${hata})  ${gecen}s   `,
      );
    }
    await bekle(350); // hız sınırına saygı
  }
  console.log(`\n\n  Bitti. Çevrildi: ${ok}, atlandı/hata: ${hata}\n`);
  if (hata > 0) {
    console.log("  Not: script yeniden çalıştırılabilir; eksik kalanları tamamlar.\n");
  }
}

main().catch((e) => {
  console.error("\n  HATA:", e.message, "\n");
  process.exit(1);
});
