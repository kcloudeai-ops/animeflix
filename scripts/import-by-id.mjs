#!/usr/bin/env node
/**
 * ============================================================
 *  scripts/import-by-id.mjs
 *
 *  Belirli MAL id'lerini AniList'ten aktarır. Eksik sezon
 *  halkalarını (bir serinin kataloğumuzda olmayan öncül/ardıl
 *  sezonlarını) tamamlamak için build-series.mjs'in ürettiği
 *  .missing-neighbors.json listesini kullanır.
 *
 *  Kullanım:
 *    npm run import:ids                 (.missing-neighbors.json)
 *    npm run import:ids -- 21 20 1735   (elle id listesi)
 *
 *  Aktarım mantığı seed-anilist.mjs ile aynı — anime + türler
 *  + bölümler. Zaten var olan kayıtları mal_id ile birleştirir.
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

// ---------- Hedef id listesi ----------
const argIds = process.argv.slice(2).map(Number).filter((n) => n > 0);
let ids = argIds;
if (ids.length === 0) {
  const dosya = path.join(ROOT, ".missing-neighbors.json");
  if (!fs.existsSync(dosya)) {
    console.error(
      "\n  HATA: .missing-neighbors.json yok. Önce `npm run build:series` çalıştırın\n" +
        "  ya da id'leri argüman olarak verin: npm run import:ids -- 21 20\n",
    );
    process.exit(1);
  }
  ids = JSON.parse(fs.readFileSync(dosya, "utf8"));
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
async function sb(table, rows, onConflict) {
  if (rows.length === 0) return [];
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/${table}?on_conflict=${onConflict}`,
    {
      method: "POST",
      headers: { ...SB, Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify(rows),
    },
  );
  const body = await res.text();
  if (!res.ok) throw new Error(`${table} (${res.status}): ${body.slice(0, 220)}`);
  return body ? JSON.parse(body) : [];
}

// ---------- Dönüştürücüler (seed-anilist.mjs ile birebir) ----------
const TR = { ç:"c", ğ:"g", ı:"i", ö:"o", ş:"s", ü:"u", Ç:"c", Ğ:"g", İ:"i", Ö:"o", Ş:"s", Ü:"u" };
const slugify = (s) =>
  s.replace(/[çğıöşüÇĞİÖŞÜ]/g, (m) => TR[m] ?? m)
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);

const STATUS = { FINISHED:"finished", RELEASING:"airing", NOT_YET_RELEASED:"upcoming", CANCELLED:"finished", HIATUS:"airing" };
const FORMAT = { TV:"TV", TV_SHORT:"TV Short", MOVIE:"Movie", SPECIAL:"Special", OVA:"OVA", ONA:"ONA", MUSIC:"Music" };
const temizle = (h) => (h ?? "").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").replace(/\n{3,}/g, "\n\n").trim();

function toAnimeRow(m) {
  const title = m.title.english || m.title.romaji;
  const synopsis = temizle(m.description);
  const poster = m.coverImage?.extraLarge ?? m.coverImage?.large ?? null;
  return {
    mal_id: m.idMal,
    slug: `${slugify(title)}-izle-${m.idMal}`,
    title,
    title_english: m.title.english ?? null,
    title_japanese: m.title.native ?? null,
    synopsis: synopsis || null,
    poster_url: poster,
    banner_url: m.bannerImage ?? poster,
    trailer_url: m.trailer?.site === "youtube" && m.trailer.id
      ? `https://www.youtube.com/embed/${m.trailer.id}` : null,
    type: FORMAT[m.format] ?? m.format ?? null,
    status: STATUS[m.status] ?? "finished",
    season: m.season ? m.season.toLowerCase() : null,
    year: m.seasonYear ?? null,
    total_episodes: m.episodes ?? 0,
    duration_min: m.duration ?? null,
    score: m.averageScore != null ? Math.round(m.averageScore) / 10 : null,
    rating: null,
    studios: (m.studios?.nodes ?? []).map((s) => s.name),
    meta_title: `${title} Türkçe Altyazılı İzle`,
    meta_description: null, // İngilizce synopsis'i meta'ya yazma; site Türkçe üretir (lib/seo.ts)
    og_image_url: poster,
    synced_at: new Date().toISOString(),
  };
}

function toEpisodeRows(animeId, m) {
  const stream = m.streamingEpisodes ?? [];
  const toplam = m.episodes ?? 0;
  const gorulen = new Set();
  const rows = [];
  stream.forEach((e, i) => {
    const eslesme = (e.title ?? "").match(/^Episode\s+(\d+)\s*[-–—]?\s*(.*)$/i);
    const number = eslesme ? Number(eslesme[1]) : i + 1;
    if (gorulen.has(number)) return;
    gorulen.add(number);
    rows.push({
      anime_id: animeId, mal_episode_id: number, number,
      title: (eslesme ? eslesme[2] : e.title)?.trim() || null,
      thumbnail_url: e.thumbnail ?? null, air_date: null,
      source: "embed", video_url: null, mux_playback_id: null, is_published: true,
    });
  });
  for (let n = 1; n <= toplam; n++) {
    if (gorulen.has(n)) continue;
    rows.push({
      anime_id: animeId, mal_episode_id: n, number: n, title: null,
      thumbnail_url: null, air_date: null, source: "embed",
      video_url: null, mux_playback_id: null, is_published: true,
    });
  }
  return rows.sort((a, b) => a.number - b.number);
}

const QUERY = `
query ($ids: [Int]) {
  Page(page: 1, perPage: 25) {
    media(idMal_in: $ids, type: ANIME) {
      idMal title { romaji english native } description(asHtml: false)
      coverImage { extraLarge large } bannerImage
      format status episodes duration season seasonYear averageScore genres
      studios(isMain: true) { nodes { name } }
      trailer { id site }
      streamingEpisodes { title thumbnail }
    }
  }
}`;

// ---------- Ana akış ----------
const stats = { anime: 0, bolum: 0, eslesmeyen: 0, hata: 0 };

async function main() {
  console.log(`\n  ${ids.length} eksik komşu aktarılacak\n`);
  const started = Date.now();

  for (let i = 0; i < ids.length; i += 25) {
    const parti = ids.slice(i, i + 25);
    try {
      const data = await anilist(QUERY, { ids: parti });
      const donen = new Set();

      for (const m of data.Page.media) {
        donen.add(m.idMal);
        try {
          const [anime] = await sb("animes", [toAnimeRow(m)], "mal_id");
          if (m.genres?.length) {
            const genres = await sb("genres",
              m.genres.map((gn) => ({ name: gn, slug: slugify(gn) })), "name");
            if (genres.length)
              await sb("anime_genres",
                genres.map((gn) => ({ anime_id: anime.id, genre_id: gn.id })),
                "anime_id,genre_id");
          }
          const eps = toEpisodeRows(anime.id, m);
          if (eps.length) { await sb("episodes", eps, "anime_id,number"); stats.bolum += eps.length; }
          stats.anime++;
        } catch (err) {
          stats.hata++;
          console.log(`  [HATA] MAL${m.idMal}: ${String(err.message).slice(0, 100)}`);
        }
      }
      // AniList'te karşılığı olmayan id'ler
      for (const id of parti) if (!donen.has(id)) stats.eslesmeyen++;

      console.log(`  [${Math.min(i + 25, ids.length)}/${ids.length}] ${stats.anime} aktarıldı`);
    } catch (err) {
      console.log(`  [HATA] parti ${i / 25 + 1}: ${String(err.message).slice(0, 100)}`);
      stats.hata++;
    }
  }

  console.log(`\n  ---- Bitti (${((Date.now() - started) / 60000).toFixed(1)} dk) ----`);
  console.log(`  aktarılan anime  : ${stats.anime}`);
  console.log(`  bölüm            : ${stats.bolum}`);
  console.log(`  AniList'te yok   : ${stats.eslesmeyen}`);
  console.log(`  hata             : ${stats.hata}\n`);
  console.log(`  Sonra zinciri yeniden kurun: npm run build:series -- --reset\n`);
}

main().catch((e) => { console.error("\n  Beklenmeyen hata:", e); process.exit(1); });
