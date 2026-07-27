#!/usr/bin/env node
/**
 * ============================================================
 *  scripts/build-series.mjs
 *
 *  Animeleri SERİ zincirlerine bağlar.
 *
 *  Yöntem: AniList'in PREQUEL/SEQUEL ilişkileri. Başlıktan regex
 *  çıkarımı yapmıyoruz — "Spice and Wolf II", "A Certain Magical
 *  Index II", "SHADOWS HOUSE 2nd Season", "Attack on Titan Final
 *  Season" gibi tutarsız adlandırmalarda güvenilmez.
 *
 *  Algoritma:
 *    1. Her anime için PREQUEL/SEQUEL komşularını çek
 *    2. Birbirine bağlı olanları tek bileşene topla (union-find)
 *    3. Her bileşende PREQUEL'i olmayan halka = KÖK (1. sezon)
 *    4. Kökten SEQUEL'leri izleyerek sıra numarası ver
 *
 *  Kullanım:
 *    npm run build:series
 *    npm run build:series -- --limit 200   (küçük test)
 *    npm run build:series -- --reset       (ilerlemeyi sıfırla)
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

const argv = process.argv.slice(2);
const has = (n) => argv.includes(`--${n}`);
const arg = (n, d) => {
  const i = argv.indexOf(`--${n}`);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : d;
};

const LIMIT = Number(arg("limit", 100000));
const CACHE = path.join(ROOT, ".series-relations.json");

if (has("reset") && fs.existsSync(CACHE)) {
  fs.unlinkSync(CACHE);
  console.log("Önbellek sıfırlandı.");
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- AniList ----------
let sonIstek = 0;
async function anilist(query, variables, deneme = 0) {
  const bekle = 1500 - (Date.now() - sonIstek);
  if (bekle > 0) await sleep(bekle);
  sonIstek = Date.now();

  const res = await fetch("https://graphql.anilist.co", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query, variables }),
  });

  if (res.status === 429 && deneme < 4) {
    const s = Number(res.headers.get("retry-after") ?? 60);
    console.log(`  hız sınırı — ${s}s bekleniyor…`);
    await sleep(s * 1000 + 500);
    return anilist(query, variables, deneme + 1);
  }
  if (!res.ok) throw new Error(`AniList ${res.status}`);

  const json = await res.json();
  if (json.errors?.length) throw new Error(json.errors[0].message);
  return json.data;
}

// ---------- Supabase ----------
const SB = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  "Content-Type": "application/json",
};

async function sbGet(yol) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${yol}`, { headers: SB });
  if (!res.ok) throw new Error(`${yol} (${res.status}): ${(await res.text()).slice(0, 160)}`);
  return res.json();
}

async function sbUpsert(tablo, rows, onConflict) {
  if (rows.length === 0) return [];
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/${tablo}?on_conflict=${onConflict}`,
    {
      method: "POST",
      headers: { ...SB, Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify(rows),
    },
  );
  if (!res.ok) {
    throw new Error(`${tablo} (${res.status}): ${(await res.text()).slice(0, 240)}`);
  }
  return res.json();
}

async function sbPatch(tablo, filtre, govde) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${tablo}?${filtre}`, {
    method: "PATCH",
    headers: { ...SB, Prefer: "return=minimal" },
    body: JSON.stringify(govde),
  });
  if (!res.ok) {
    throw new Error(`${tablo} PATCH (${res.status}): ${(await res.text()).slice(0, 200)}`);
  }
}

/** PostgREST 1000 satırda kesiyor — sayfalayarak çek. */
async function tumSatirlar(sablon) {
  const hepsi = [];
  for (let off = 0; off < 100_000; off += 1000) {
    const p = await sbGet(`${sablon}&limit=1000&offset=${off}`);
    hepsi.push(...p);
    if (p.length < 1000) break;
  }
  return hepsi;
}

// ---------- Yardımcılar ----------
const TR = { ç:"c", ğ:"g", ı:"i", ö:"o", ş:"s", ü:"u", Ç:"c", Ğ:"g", İ:"i", Ö:"o", Ş:"s", Ü:"u" };
const slugify = (s) =>
  s.replace(/[çğıöşüÇĞİÖŞÜ]/g, (m) => TR[m] ?? m)
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "").slice(0, 70);

/**
 * Serinin görünen adından sezon ekini temizler.
 * "Attack on Titan Season 3 Part 2" -> "Attack on Titan"
 */
function seriAdi(baslik) {
  return (
    baslik
      .replace(
        /\s*[:\-–]?\s*(Season\s*\d+.*|\d+(st|nd|rd|th)\s+Season.*|Part\s*\d+.*|Final Season.*|2nd Season.*|3rd Season.*)$/i,
        "",
      )
      .replace(/\s+(II|III|IV|V|VI)$/i, "")
      .trim() || baslik
  );
}

/** Başlıktan sezon etiketi ("Season 3 Part 2", "Final Season"). */
function sezonEtiketi(baslik, seri) {
  const kalan = baslik.slice(seri.length).replace(/^[\s:\-–]+/, "").trim();
  return kalan || null;
}

// ---------- 1) İlişkileri çek ----------
const RELATIONS_Q = `
query ($ids: [Int]) {
  Page(page: 1, perPage: 25) {
    media(idMal_in: $ids, type: ANIME) {
      idMal
      startDate { year }
      relations {
        edges {
          relationType
          node { idMal type format startDate { year } }
        }
      }
    }
  }
}`;

async function iliskileriCek(animeler) {
  // Önbellek: script tekrar çalıştırılınca AniList'i yeniden yormasın
  const cache = fs.existsSync(CACHE)
    ? JSON.parse(fs.readFileSync(CACHE, "utf8"))
    : {};

  const eksik = animeler.filter((a) => !cache[a.mal_id]);
  console.log(`  ${Object.keys(cache).length} önbellekte, ${eksik.length} çekilecek\n`);

  for (let i = 0; i < eksik.length; i += 25) {
    const parti = eksik.slice(i, i + 25);
    try {
      const data = await anilist(RELATIONS_Q, { ids: parti.map((a) => a.mal_id) });

      for (const m of data.Page.media) {
        cache[m.idMal] = {
          yil: m.startDate?.year ?? null,
          prequel: [],
          sequel: [],
        };
        for (const e of m.relations?.edges ?? []) {
          const n = e.node;
          // Yalnızca ANIME ve TV/ONA/MOVIE gibi ana biçimler;
          // MUSIC/SPECIAL zincire dahil edilirse sıra bozuluyor
          if (n?.type !== "ANIME" || !n.idMal) continue;
          if (!["TV", "TV_SHORT", "ONA", "MOVIE", "OVA"].includes(n.format)) continue;

          if (e.relationType === "PREQUEL") cache[m.idMal].prequel.push(n.idMal);
          else if (e.relationType === "SEQUEL") cache[m.idMal].sequel.push(n.idMal);
        }
      }

      // Yanıt gelmeyen id'leri de işaretle ki tekrar sorulmasın
      for (const a of parti) {
        if (!cache[a.mal_id]) cache[a.mal_id] = { yil: null, prequel: [], sequel: [] };
      }

      fs.writeFileSync(CACHE, JSON.stringify(cache));
      console.log(`  [${Math.min(i + 25, eksik.length)}/${eksik.length}] ilişki çekildi`);
    } catch (err) {
      console.log(`  [HATA] parti ${i / 25 + 1}: ${String(err.message).slice(0, 110)}`);
    }
  }

  return cache;
}

// ---------- 2) Bileşenleri bul (union-find) ----------
function bilesenleriBul(malIdler, cache) {
  const ebeveyn = new Map(malIdler.map((id) => [id, id]));

  const bul = (x) => {
    while (ebeveyn.get(x) !== x) {
      ebeveyn.set(x, ebeveyn.get(ebeveyn.get(x)));
      x = ebeveyn.get(x);
    }
    return x;
  };
  const birlestir = (a, b) => {
    const ra = bul(a), rb = bul(b);
    if (ra !== rb) ebeveyn.set(ra, rb);
  };

  const kume = new Set(malIdler);
  for (const id of malIdler) {
    const c = cache[id];
    if (!c) continue;
    // Yalnızca BİZDE olan animeleri birleştir
    for (const p of [...c.prequel, ...c.sequel]) {
      if (kume.has(p)) birlestir(id, p);
    }
  }

  const gruplar = new Map();
  for (const id of malIdler) {
    const k = bul(id);
    if (!gruplar.has(k)) gruplar.set(k, []);
    gruplar.get(k).push(id);
  }
  return [...gruplar.values()];
}

// ---------- 3) Grubu sırala ----------
/**
 * Grubu izleme sırasına dizer.
 *
 * Öncelik YAYIN YILI, ikincil anahtar PREQUEL/SEQUEL zinciri.
 *
 * Neden salt zincir değil: AniList öncül OVA'ları hikâye
 * kronolojisine göre bağlıyor. "Tokyo Ghoul: [JACK]" (2015) ana
 * seriden ÖNCE geliyormuş gibi işaretli, oysa "Tokyo Ghoul" 2014'te
 * yayınlandı. Salt zincir takibi bunu 1. sezon yapıp seriye de
 * yanlış ad veriyordu.
 *
 * Neden salt yıl değil: aynı yıl içinde çıkan sezonları (Jormungand
 * 2012 + Jormungand: Perfect Order 2012) ayırt edemiyor — orada
 * doğru cevabı zincir veriyor.
 */
function grubuSirala(grup, cache) {
  const kume = new Set(grup);
  const yil = (id) => cache[id]?.yil ?? 9999;

  // 1) Zincir sırası: kökten SEQUEL'leri izleyerek konum ata
  const kokler = grup.filter((id) => {
    const c = cache[id];
    return !c || !c.prequel.some((p) => kume.has(p));
  });

  const zincirSira = new Map();
  const gorulen = new Set();
  let konum = 0;

  for (const kok of [...kokler].sort((a, b) => yil(a) - yil(b))) {
    let mevcut = kok;
    while (mevcut && !gorulen.has(mevcut)) {
      gorulen.add(mevcut);
      zincirSira.set(mevcut, konum++);
      const sonraki = (cache[mevcut]?.sequel ?? [])
        .filter((s) => kume.has(s) && !gorulen.has(s))
        .sort((a, b) => yil(a) - yil(b));
      mevcut = sonraki[0];
    }
  }
  for (const id of grup) {
    if (!zincirSira.has(id)) zincirSira.set(id, konum++);
  }

  // 2) Önce yıl, eşitse zincir konumu
  return [...grup].sort(
    (a, b) => yil(a) - yil(b) || zincirSira.get(a) - zincirSira.get(b),
  );
}

// ---------- Ana akış ----------
async function main() {
  console.log("\n  === SERİ ZİNCİRLERİ ===\n");

  const animeler = (
    await tumSatirlar("animes?select=id,mal_id,title,year&mal_id=not.is.null&order=id")
  ).slice(0, LIMIT);

  console.log(`  ${animeler.length} anime\n`);

  const cache = await iliskileriCek(animeler);

  const malHarita = new Map(animeler.map((a) => [a.mal_id, a]));
  const gruplar = bilesenleriBul([...malHarita.keys()], cache);

  const cokluk = gruplar.filter((g) => g.length > 1);
  console.log(`\n  toplam grup      : ${gruplar.length}`);
  console.log(`  çok sezonlu seri : ${cokluk.length}`);
  console.log(`  tek sezonluk     : ${gruplar.length - cokluk.length}\n`);

  let seri = 0,
    baglanan = 0,
    hata = 0;

  for (const grup of cokluk) {
    const sirali = grubuSirala(grup, cache);
    const ilk = malHarita.get(sirali[0]);
    if (!ilk) continue;

    const ad = seriAdi(ilk.title);

    try {
      const [kayit] = await sbUpsert(
        "series",
        [{ title: ad, slug: `${slugify(ad)}-${sirali[0]}`, root_mal_id: sirali[0] }],
        "root_mal_id",
      );

      for (const [i, malId] of sirali.entries()) {
        const a = malHarita.get(malId);
        if (!a) continue;
        await sbPatch("animes", `id=eq.${a.id}`, {
          series_id: kayit.id,
          season_number: i + 1,
          season_label: sezonEtiketi(a.title, ad),
        });
        baglanan++;
      }

      seri++;
      if (seri % 25 === 0) {
        console.log(`  [${seri}/${cokluk.length}] ${baglanan} anime bağlandı`);
      }
    } catch (err) {
      hata++;
      console.log(`  [HATA] ${ad.slice(0, 40)}: ${String(err.message).slice(0, 120)}`);
      if (hata > 20) break;
    }
  }

  console.log(`\n  ---- Bitti ----`);
  console.log(`  oluşturulan seri : ${seri}`);
  console.log(`  bağlanan anime   : ${baglanan}`);
  console.log(`  hata             : ${hata}\n`);
}

main().catch((e) => {
  console.error("\n  Beklenmeyen hata:", e);
  process.exit(1);
});
