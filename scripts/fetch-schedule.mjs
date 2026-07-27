#!/usr/bin/env node
/**
 * ============================================================
 *  scripts/fetch-schedule.mjs
 *
 *  AniList'ten yayın takvimini ve karakterleri çeker.
 *
 *    --schedule    yayında olan animelerin bölüm saatleri (varsayılan)
 *    --characters  karakter + seslendiren listesi
 *    --all         ikisi birden
 *    --limit N     kaç anime işlensin
 *
 *  Kullanım:
 *    npm run fetch:schedule
 *    npm run fetch:schedule -- --characters --limit 300
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
if (!KEY.startsWith("sb_secret_") && !KEY.includes(".")) {
  console.error("\n  HATA: SUPABASE_SERVICE_ROLE_KEY tanınmayan biçimde.\n");
  process.exit(1);
}

const argv = process.argv.slice(2);
const has = (n) => argv.includes(`--${n}`);
const arg = (n, d) => {
  const i = argv.indexOf(`--${n}`);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : d;
};

const LIMIT = Number(arg("limit", 100000));
const TAKVIM = has("all") || has("schedule") || (!has("characters") && !has("all"));
const KARAKTER = has("all") || has("characters");

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
async function tumSatirlar(yolSablon) {
  const hepsi = [];
  for (let off = 0; off < 100_000; off += 1000) {
    const parca = await sbGet(`${yolSablon}&limit=1000&offset=${off}`);
    hepsi.push(...parca);
    if (parca.length < 1000) break;
  }
  return hepsi;
}

// ============================================================
//  1) YAYIN TAKVİMİ
// ============================================================
const TAKVIM_Q = `
query ($ids: [Int]) {
  Page(page: 1, perPage: 50) {
    media(idMal_in: $ids, type: ANIME) {
      idMal
      nextAiringEpisode { episode airingAt }
      airingSchedule(perPage: 50) { nodes { episode airingAt } }
    }
  }
}`;

async function takvimiCek() {
  console.log("\n  === YAYIN TAKVİMİ ===");

  // Yalnızca devam eden/yakında olanların takvimi anlamlı
  const animeler = await tumSatirlar(
    "animes?select=id,mal_id,title&status=in.(airing,upcoming)&mal_id=not.is.null&order=id",
  );
  const liste = animeler.slice(0, LIMIT);
  console.log(`  ${liste.length} anime işlenecek\n`);

  let saatli = 0,
    sonraki = 0,
    hata = 0;

  // AniList tek istekte 50 id kabul ediyor
  for (let i = 0; i < liste.length; i += 50) {
    const parti = liste.slice(i, i + 50);
    const idHaritasi = new Map(parti.map((a) => [a.mal_id, a]));

    try {
      const data = await anilist(TAKVIM_Q, { ids: parti.map((a) => a.mal_id) });

      for (const m of data.Page.media) {
        const anime = idHaritasi.get(m.idMal);
        if (!anime) continue;

        // a) Bölümlerin kesin yayın zamanı
        const nodes = m.airingSchedule?.nodes ?? [];
        for (const n of nodes) {
          const iso = new Date(n.airingAt * 1000).toISOString();
          try {
            await sbPatch(
              "episodes",
              `anime_id=eq.${anime.id}&number=eq.${n.episode}`,
              { air_at: iso, air_date: iso.slice(0, 10) },
            );
            saatli++;
          } catch {
            /* o bölüm bizde yoksa atla */
          }
        }

        // b) Animenin bir sonraki bölümü
        if (m.nextAiringEpisode) {
          await sbPatch("animes", `id=eq.${anime.id}`, {
            next_episode_number: m.nextAiringEpisode.episode,
            next_episode_at: new Date(
              m.nextAiringEpisode.airingAt * 1000,
            ).toISOString(),
          });
          sonraki++;
        }
      }

      console.log(
        `  [${Math.min(i + 50, liste.length)}/${liste.length}] ${saatli} bölüm saati, ${sonraki} sonraki bölüm`,
      );
    } catch (err) {
      hata++;
      console.log(`  [HATA] parti ${i / 50 + 1}: ${String(err.message).slice(0, 120)}`);
      if (hata > 10) break;
    }
  }

  console.log(`\n  bölüm saati yazılan : ${saatli}`);
  console.log(`  sonraki bölüm       : ${sonraki}`);
  console.log(`  hata                : ${hata}`);
}

// ============================================================
//  2) KARAKTERLER
// ============================================================
const KARAKTER_Q = `
query ($ids: [Int]) {
  Page(page: 1, perPage: 25) {
    media(idMal_in: $ids, type: ANIME) {
      idMal
      characters(sort: ROLE, perPage: 12) {
        edges {
          role
          node { id name { full } image { large } }
          voiceActors(language: JAPANESE) {
            id name { full } image { large }
          }
        }
      }
    }
  }
}`;

async function karakterleriCek() {
  console.log("\n  === KARAKTERLER ===");

  // Zaten karakteri olanları atla
  const mevcut = new Set(
    (await tumSatirlar("anime_characters?select=anime_id&order=anime_id")).map(
      (r) => r.anime_id,
    ),
  );

  const animeler = (
    await tumSatirlar(
      "animes?select=id,mal_id,title&mal_id=not.is.null&order=score.desc.nullslast",
    )
  ).filter((a) => !mevcut.has(a.id));

  const liste = animeler.slice(0, LIMIT);
  console.log(`  ${mevcut.size} animede zaten var, ${liste.length} işlenecek\n`);

  let karakter = 0,
    hata = 0;

  for (let i = 0; i < liste.length; i += 25) {
    const parti = liste.slice(i, i + 25);
    const idHaritasi = new Map(parti.map((a) => [a.mal_id, a]));

    try {
      const data = await anilist(KARAKTER_Q, { ids: parti.map((a) => a.mal_id) });

      for (const m of data.Page.media) {
        const anime = idHaritasi.get(m.idMal);
        const edges = m.characters?.edges ?? [];
        if (!anime || edges.length === 0) continue;

        // Karakterler
        const karakterSatir = edges
          .filter((e) => e.node?.id)
          .map((e) => ({
            anilist_id: e.node.id,
            name: e.node.name?.full ?? "?",
            image_url: e.node.image?.large ?? null,
          }));
        const kayitliK = await sbUpsert("characters", karakterSatir, "anilist_id");
        const kHarita = new Map(kayitliK.map((k) => [k.anilist_id, k.id]));

        // Seslendirenler
        const vaSatir = [];
        const gorulen = new Set();
        for (const e of edges) {
          const va = e.voiceActors?.[0];
          if (!va?.id || gorulen.has(va.id)) continue;
          gorulen.add(va.id);
          vaSatir.push({
            anilist_id: va.id,
            name: va.name?.full ?? "?",
            image_url: va.image?.large ?? null,
            language: "Japanese",
          });
        }
        const kayitliVA = vaSatir.length
          ? await sbUpsert("voice_actors", vaSatir, "anilist_id")
          : [];
        const vHarita = new Map(kayitliVA.map((v) => [v.anilist_id, v.id]));

        // Bağlantılar
        const baglar = [];
        const eklendi = new Set();
        edges.forEach((e, idx) => {
          const cid = kHarita.get(e.node?.id);
          if (!cid || eklendi.has(cid)) return;
          eklendi.add(cid);
          baglar.push({
            anime_id: anime.id,
            character_id: cid,
            role: e.role ?? null,
            voice_actor_id: vHarita.get(e.voiceActors?.[0]?.id) ?? null,
            sira: idx,
          });
        });

        if (baglar.length) {
          await sbUpsert("anime_characters", baglar, "anime_id,character_id");
          karakter += baglar.length;
        }
      }

      console.log(
        `  [${Math.min(i + 25, liste.length)}/${liste.length}] ${karakter} karakter bağlandı`,
      );
    } catch (err) {
      hata++;
      console.log(`  [HATA] parti ${i / 25 + 1}: ${String(err.message).slice(0, 120)}`);
      if (hata > 10) break;
    }
  }

  console.log(`\n  bağlanan karakter : ${karakter}`);
  console.log(`  hata              : ${hata}`);
}

// ---------- Çalıştır ----------
(async () => {
  const t0 = Date.now();
  if (TAKVIM) await takvimiCek();
  if (KARAKTER) await karakterleriCek();
  console.log(`\n  Toplam süre: ${((Date.now() - t0) / 60000).toFixed(1)} dakika\n`);
})().catch((e) => {
  console.error("\n  Beklenmeyen hata:", e);
  process.exit(1);
});
