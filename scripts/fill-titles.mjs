#!/usr/bin/env node
/**
 * ============================================================
 *  scripts/fill-titles.mjs — Eksik bölüm başlıklarını Kitsu'dan doldur
 *
 *  AniList'in `streamingEpisodes` alanı yalnızca Crunchyroll'da
 *  listelenen bölümleri kapsıyor; geri kalanlar başlıksız kalıyor.
 *  Kitsu'nun episodes ucu bu boşluğu dolduruyor ve MAL id ile
 *  eşleştirilebiliyor.
 *
 *  Elle girilmiş video alanları KORUNUR — sadece başlık ve kapak yazılır.
 *
 *  Kullanım:
 *    npm run fill:titles
 *    npm run fill:titles -- --limit 100    (küçük parti)
 *    npm run fill:titles -- --reset
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
const SERVICE_KEY = env("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SERVICE_KEY || SERVICE_KEY.includes("...")) {
  console.error("\n  HATA: .env.local içinde SUPABASE_SERVICE_ROLE_KEY eksik.\n");
  process.exit(1);
}

const argv = process.argv.slice(2);
const arg = (n, d) => {
  const i = argv.indexOf(`--${n}`);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : d;
};
const has = (n) => argv.includes(`--${n}`);

const LIMIT = Number(arg("limit", 100000));
const PROGRESS_FILE = path.join(ROOT, ".fill-titles-progress.json");

if (has("reset") && fs.existsSync(PROGRESS_FILE)) {
  fs.unlinkSync(PROGRESS_FILE);
  console.log("İlerleme sıfırlandı.");
}

const progress = fs.existsSync(PROGRESS_FILE)
  ? JSON.parse(fs.readFileSync(PROGRESS_FILE, "utf8"))
  : { done: [], bosuna: [] };

const doneSet = new Set(progress.done);
const bosunaSet = new Set(progress.bosuna); // Kitsu'da karşılığı yok
const saveProgress = () => {
  progress.done = [...doneSet];
  progress.bosuna = [...bosunaSet];
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 1));
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- Kitsu ----------
let sonIstek = 0;
const KITSU_ARALIK = 320; // ~3 istek/sn — nazik davran

async function kitsu(yol) {
  const bekle = KITSU_ARALIK - (Date.now() - sonIstek);
  if (bekle > 0) await sleep(bekle);
  sonIstek = Date.now();

  const res = await fetch(`https://kitsu.io/api/edge${yol}`, {
    headers: { Accept: "application/vnd.api+json" },
  });
  if (!res.ok) {
    const e = new Error(`Kitsu ${res.status}`);
    e.status = res.status;
    throw e;
  }
  return res.json();
}

/** MAL id -> Kitsu anime id */
async function kitsuId(malId) {
  const j = await kitsu(
    `/mappings?filter[externalSite]=myanimelist/anime&filter[externalId]=${malId}&include=item`,
  );
  return j.included?.[0]?.id ?? j.data?.[0]?.relationships?.item?.data?.id ?? null;
}

/** Kitsu bölümleri — sayfa başına 20, hepsini topla. */
async function kitsuEpisodes(id) {
  const hepsi = [];
  let offset = 0;

  while (offset < 2000) {
    const j = await kitsu(
      `/anime/${id}/episodes?page[limit]=20&page[offset]=${offset}`,
    );
    const parca = j.data ?? [];
    hepsi.push(...parca);
    if (parca.length < 20) break;
    offset += 20;
  }

  return hepsi;
}

// ---------- Supabase ----------
const SB = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
};

/** PostgREST tek seferde en fazla 1000 satır döner — sayfalayarak çek. */
async function tumAnimeler() {
  const hepsi = [];
  let offset = 0;

  while (true) {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/animes?select=id,mal_id,title,` +
        `episodes(id,number,title,thumbnail_url,video_url,source,mux_playback_id,is_published)` +
        `&order=id&limit=1000&offset=${offset}`,
      { headers: SB },
    );
    if (!res.ok) throw new Error(`animes okunamadı: ${res.status}`);
    const parca = await res.json();
    hepsi.push(...parca);
    if (parca.length < 1000) break;
    offset += 1000;
  }

  return hepsi;
}

async function yaz(rows) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/episodes?on_conflict=anime_id,number`,
    {
      method: "POST",
      headers: {
        ...SB,
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(rows),
    },
  );
  if (!res.ok) {
    throw new Error(`episodes (${res.status}): ${(await res.text()).slice(0, 200)}`);
  }
}

// ---------- Ana akış ----------
const stats = { anime: 0, baslik: 0, kapak: 0, eslesmeyen: 0, hata: 0 };

async function main() {
  console.log("\n  Kaynak: Kitsu (eksik bölüm başlıkları)\n");
  console.log("  Anime listesi çekiliyor…");

  const animeler = await tumAnimeler();

  const hedef = animeler.filter((a) => {
    if (!a.mal_id) return false;
    if (doneSet.has(a.mal_id) || bosunaSet.has(a.mal_id)) return false;
    const eps = a.episodes ?? [];
    return eps.length > 0 && eps.some((e) => !e.title);
  });

  console.log(`  Toplam anime      : ${animeler.length}`);
  console.log(`  Eksiği olan       : ${hedef.length}`);
  console.log(`  Bu turda işlenecek: ${Math.min(hedef.length, LIMIT)}\n`);

  const started = Date.now();
  const liste = hedef.slice(0, LIMIT);

  for (const [i, a] of liste.entries()) {
    try {
      const kid = await kitsuId(a.mal_id);
      if (!kid) {
        bosunaSet.add(a.mal_id);
        stats.eslesmeyen++;
        saveProgress();
        continue;
      }

      const eps = await kitsuEpisodes(kid);
      const kitsuMap = new Map(
        eps
          .filter((e) => e.attributes?.number)
          .map((e) => [e.attributes.number, e.attributes]),
      );

      // Sadece başlığı EKSİK olan satırları güncelle; video alanlarını koru.
      const rows = [];
      for (const ep of a.episodes ?? []) {
        if (ep.title) continue;
        const k = kitsuMap.get(ep.number);
        if (!k?.canonicalTitle) continue;

        rows.push({
          anime_id: a.id,
          number: ep.number,
          mal_episode_id: ep.number,
          title: k.canonicalTitle,
          thumbnail_url: ep.thumbnail_url ?? k.thumbnail?.original ?? null,
          air_date: k.airdate ?? null,
          // Elle girilmiş video bilgisi asla ezilmez
          source: ep.source ?? "embed",
          video_url: ep.video_url ?? null,
          mux_playback_id: ep.mux_playback_id ?? null,
          is_published: ep.is_published ?? true,
        });
      }

      if (rows.length > 0) {
        await yaz(rows);
        stats.baslik += rows.length;
        stats.kapak += rows.filter((r) => r.thumbnail_url).length;
      }

      doneSet.add(a.mal_id);
      stats.anime++;

      const dk = ((Date.now() - started) / 60000).toFixed(1);
      console.log(
        `  [${i + 1}/${liste.length}] ${dk}dk  ${a.title.slice(0, 42)} — ${rows.length} başlık`,
      );
    } catch (err) {
      stats.hata++;
      if (err.status === 404) bosunaSet.add(a.mal_id);
      console.log(`  [HATA] ${a.title.slice(0, 40)}: ${err.message}`);
      if (stats.hata > 30) {
        console.error("\n  Çok fazla hata — durduruluyor.\n");
        break;
      }
    }
    saveProgress();
  }

  const dk = ((Date.now() - started) / 60000).toFixed(1);
  console.log(`\n  ---- Bitti (${dk} dakika) ----`);
  console.log(`  işlenen anime     : ${stats.anime}`);
  console.log(`  yazılan başlık    : ${stats.baslik}`);
  console.log(`  eklenen kapak     : ${stats.kapak}`);
  console.log(`  Kitsu'da yok      : ${stats.eslesmeyen}`);
  console.log(`  hata              : ${stats.hata}\n`);
}

main().catch((e) => {
  console.error("\n  Beklenmeyen hata:", e);
  process.exit(1);
});
