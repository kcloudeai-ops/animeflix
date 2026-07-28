#!/usr/bin/env node
/**
 * ============================================================
 *  scripts/translate-titles.mjs
 *
 *  İngilizce bölüm `title`'larını Türkçeye çevirip `title_tr`
 *  kolonuna yazar. Kaynak korunur; site `title_tr ?? title` gösterir.
 *
 *  ÖN KOŞUL: supabase/10-episode-title-tr.sql çalıştırılmış olmalı.
 *
 *  Jenerik "N. Bölüm" başlıkları ATLANIR (zaten Türkçe).
 *
 *  TOPLU çeviri: ~40 başlık tek istekte, satır sonuyla ayrılır.
 *  Google satır sonlarını koruduğu için 1:1 geri eşlenir; segment
 *  sayısı tutmazsa o grup tek tek çevrilir (güvenli mod).
 *  Yeniden çalıştırılabilir: yalnızca title_tr'si boş satırlar.
 *
 *  Kullanım:
 *    node scripts/translate-titles.mjs
 *    node scripts/translate-titles.mjs --limit=100   (deneme)
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

const LIMIT = Number(
  (process.argv.find((a) => a.startsWith("--limit=")) || "").split("=")[1] || 0,
);
const SB = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  "Content-Type": "application/json",
};
const bekle = (ms) => new Promise((r) => setTimeout(r, ms));

// Jenerik "12. Bölüm" başlığı mı? (çevrilmemeli)
const jenerik = (t) => /^\s*\d+\.\s*Bölüm\s*$/.test(t ?? "");

// ---------- Çevrilecek satırlar (title_tr boş, gerçek başlık) ----------
async function cekilecekler() {
  const hepsi = [];
  const SAYFA = 1000;
  for (let off = 0; ; off += SAYFA) {
    const url =
      `${SUPABASE_URL}/rest/v1/episodes` +
      `?select=id,title&title=not.is.null&title_tr=is.null` +
      `&order=id.asc&limit=${SAYFA}&offset=${off}`;
    const res = await fetch(url, { headers: SB });
    if (!res.ok) {
      const t = await res.text();
      if (t.includes("title_tr")) {
        throw new Error(
          "title_tr kolonu yok. Önce supabase/10-episode-title-tr.sql çalıştırın.",
        );
      }
      throw new Error(`select (${res.status}): ${t.slice(0, 200)}`);
    }
    const parca = await res.json();
    hepsi.push(...parca.filter((r) => r.title && !jenerik(r.title)));
    if (parca.length < SAYFA) break;
    if (LIMIT && hepsi.length >= LIMIT) break;
  }
  return LIMIT ? hepsi.slice(0, LIMIT) : hepsi;
}

// ---------- Google (resmi olmayan) toplu çeviri ----------
async function ceviriMetni(metin) {
  const url =
    "https://translate.googleapis.com/translate_a/single" +
    `?client=gtx&sl=en&tl=tr&dt=t&q=${encodeURIComponent(metin)}`;
  for (let deneme = 0; deneme < 5; deneme++) {
    let res;
    try {
      res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; AnimeKosesiBot/1.0)" },
      });
    } catch {
      await bekle(1500 * 2 ** deneme);
      continue;
    }
    if (res.status === 429 || res.status >= 500) {
      await bekle(1500 * 2 ** deneme);
      continue;
    }
    if (!res.ok) throw new Error(`çeviri (${res.status})`);
    const data = await res.json();
    return (data[0] ?? []).map((s) => s[0]).join("");
  }
  throw new Error("çeviri 5 denemede başarısız");
}

// Bir grubu satır-sonu birleştirmeyle çevir; eşleşmezse tek tek.
async function grupCevir(basliklar) {
  const birlesik = basliklar.join("\n");
  const cevrilen = (await ceviriMetni(birlesik)).split("\n");
  if (cevrilen.length === basliklar.length) {
    return cevrilen.map((s) => s.trim());
  }
  // Güvenli mod: birebir
  const tek = [];
  for (const b of basliklar) {
    tek.push((await ceviriMetni(b)).trim());
    await bekle(200);
  }
  return tek;
}

async function yaz(id, tr) {
  const url = `${SUPABASE_URL}/rest/v1/episodes?id=eq.${id}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: { ...SB, Prefer: "return=minimal" },
    body: JSON.stringify({ title_tr: tr }),
  });
  if (!res.ok) throw new Error(`patch (${res.status}): ${(await res.text()).slice(0, 140)}`);
}

// Grubu, kodlanmış uzunluk ~3500'ü aşmayacak ve ≤40 öğe olacak şekilde topla.
function gruplara(rows, maxAdet = 40, maxKar = 1500) {
  const gruplar = [];
  let g = [];
  let uzunluk = 0;
  for (const r of rows) {
    const l = r.title.length + 1;
    if (g.length && (g.length >= maxAdet || uzunluk + l > maxKar)) {
      gruplar.push(g);
      g = [];
      uzunluk = 0;
    }
    g.push(r);
    uzunluk += l;
  }
  if (g.length) gruplar.push(g);
  return gruplar;
}

async function main() {
  console.log(`\n  Bölüm başlıkları çevriliyor${LIMIT ? ` (deneme, ilk ${LIMIT})` : ""}…`);
  const rows = await cekilecekler();
  console.log(`  Çevrilecek başlık: ${rows.length}\n`);
  if (rows.length === 0) {
    console.log("  Çevrilecek başlık yok.\n");
    return;
  }

  const gruplar = gruplara(rows);
  let ok = 0;
  let hata = 0;
  const t0 = Date.now();

  for (const grup of gruplar) {
    try {
      const cevrilen = await grupCevir(grup.map((r) => r.title));
      for (let i = 0; i < grup.length; i++) {
        const tr = cevrilen[i];
        if (tr && tr !== grup[i].title) {
          await yaz(grup[i].id, tr);
          ok++;
        } else {
          hata++;
        }
      }
    } catch (e) {
      hata += grup.length;
      process.stdout.write(`\n  grup hatası: ${e.message}`);
    }
    const gecen = ((Date.now() - t0) / 1000).toFixed(0);
    process.stdout.write(
      `\r  ilerleme: ${ok + hata}/${rows.length}  (ok:${ok} hata:${hata})  ${gecen}s   `,
    );
    await bekle(300); // hız sınırına saygı
  }

  console.log(`\n\n  Bitti. Çevrildi: ${ok}, atlandı/hata: ${hata}`);
  if (hata > 0) console.log("  Script yeniden çalıştırılabilir; eksikleri tamamlar.");
  console.log("");
}

main().catch((e) => {
  console.error("\n  HATA:", e.message, "\n");
  process.exit(1);
});
