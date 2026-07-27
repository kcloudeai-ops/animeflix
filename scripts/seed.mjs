#!/usr/bin/env node
/**
 * ============================================================
 *  scripts/seed.mjs — Toplu anime aktarımı (CLI)
 *
 *  Tarayıcıdaki kuyruk 2.000 seri için uygun değil: sekme kapanınca
 *  durur, ilerleme kaybolur. Bu script kaldığı yerden devam eder.
 *
 *  Kullanım:
 *    node scripts/seed.mjs --count 2000
 *    node scripts/seed.mjs --count 2000 --no-episodes   (sadece anime)
 *    node scripts/seed.mjs --reset                      (ilerlemeyi sıfırla)
 *
 *  Gerekli: .env.local içinde SUPABASE_SERVICE_ROLE_KEY
 *  (RLS'i baypas eder — bu yüzden SADECE yerelde çalıştırın.)
 * ============================================================
 */

import fs from "node:fs";
import path from "node:path";

// ---------- Ortam ----------
const ROOT = process.cwd();
const envText = fs.readFileSync(path.join(ROOT, ".env.local"), "utf8");
const env = (k) => {
  const m = envText.match(new RegExp(`^${k}=(.*)$`, "m"));
  return m ? m[1].trim() : "";
};

const SUPABASE_URL = env("NEXT_PUBLIC_SUPABASE_URL");
const SERVICE_KEY = env("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SERVICE_KEY || SERVICE_KEY.includes("...")) {
  console.error(
    "\n  HATA: .env.local içinde SUPABASE_SERVICE_ROLE_KEY eksik.\n" +
      "  Supabase → Project Settings → API Keys → Legacy API keys → service_role\n",
  );
  process.exit(1);
}

// Anahtarın gerçekten service_role olduğunu doğrula. anon anahtarı da
// geçerli bir JWT'dir; yanlışlıkla o girilirse script RLS'e takılıp
// anlaşılmaz "yazılamadı (401)" hatalarıyla dolar.
// Supabase'in iki anahtar biçimi var: yeni `sb_secret_...` ve eski JWT.
// Yeni biçim JWT değildir; çözümlemeye çalışmak onu haksız yere reddeder.
if (!SERVICE_KEY.startsWith("sb_secret_")) {
  if (SERVICE_KEY.startsWith("sb_publishable_")) {
    console.error(
      "\n  HATA: publishable (herkese açık) anahtar verilmiş — gizli anahtar gerekli.\n",
    );
    process.exit(1);
  }
  try {
    const payload = JSON.parse(
      Buffer.from(SERVICE_KEY.split(".")[1], "base64").toString("utf8"),
    );
    if (payload.role !== "service_role") {
      console.error(
        `\n  HATA: Verilen anahtarın rolü "${payload.role}" — "service_role" olmalı.\n`,
      );
      process.exit(1);
    }
    const ref = new URL(SUPABASE_URL).hostname.split(".")[0];
    if (payload.ref !== ref) {
      console.error(
        `\n  HATA: Anahtar "${payload.ref}" projesine ait, URL ise "${ref}".\n`,
      );
      process.exit(1);
    }
  } catch {
    console.error("\n  HATA: SUPABASE_SERVICE_ROLE_KEY tanınmayan biçimde.\n");
    process.exit(1);
  }
}

// ---------- Argümanlar ----------
const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : fallback;
};
const has = (name) => argv.includes(`--${name}`);

const TARGET = Number(arg("count", 2000));
const WITH_EPISODES = !has("no-episodes");
const PROGRESS_FILE = path.join(ROOT, ".seed-progress.json");

if (has("reset") && fs.existsSync(PROGRESS_FILE)) {
  fs.unlinkSync(PROGRESS_FILE);
  console.log("İlerleme sıfırlandı.");
}

const progress = fs.existsSync(PROGRESS_FILE)
  ? JSON.parse(fs.readFileSync(PROGRESS_FILE, "utf8"))
  : { page: 1, done: [], failed: [] };

const doneSet = new Set(progress.done);
const saveProgress = () => {
  progress.done = [...doneSet];
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 1));
};

// ---------- Jikan: hız sınırlı istemci ----------
// Jikan: 3 istek/sn VE 60 istek/dk. Dakika sınırı bağlayıcı olan.
const MIN_GAP = 350;
const MAX_PER_MIN = 55;
let lastCall = 0;
let window_ = [];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function jikan(endpoint, { retries = 2 } = {}) {
  const gap = MIN_GAP - (Date.now() - lastCall);
  if (gap > 0) await sleep(gap);

  window_ = window_.filter((t) => Date.now() - t < 60_000);
  if (window_.length >= MAX_PER_MIN) {
    const wait = 60_000 - (Date.now() - window_[0]) + 100;
    process.stdout.write(`  (dakika limiti: ${Math.ceil(wait / 1000)}s bekleniyor)\r`);
    await sleep(wait);
    window_ = window_.filter((t) => Date.now() - t < 60_000);
  }

  lastCall = Date.now();
  window_.push(lastCall);

  const res = await fetch(`https://api.jikan.moe/v4${endpoint}`, {
    headers: { Accept: "application/json" },
  });

  if (res.status === 429 && retries > 0) {
    await sleep(2000);
    return jikan(endpoint, { retries: retries - 1 });
  }
  if (!res.ok) {
    const err = new Error(`Jikan ${res.status} @ ${endpoint}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

// ---------- Supabase REST ----------
async function sb(table, rows, onConflict) {
  const url =
    `${SUPABASE_URL}/rest/v1/${table}` +
    (onConflict ? `?on_conflict=${onConflict}` : "");

  const res = await fetch(url, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify(rows),
  });

  const body = await res.text();
  if (!res.ok) {
    throw new Error(`${table} yazılamadı (${res.status}): ${body.slice(0, 300)}`);
  }
  return body ? JSON.parse(body) : [];
}

// ---------- Dönüştürücüler (lib/anime-api.ts ile aynı mantık) ----------
const TR_MAP = { ç:"c", ğ:"g", ı:"i", ö:"o", ş:"s", ü:"u", Ç:"c", Ğ:"g", İ:"i", Ö:"o", Ş:"s", Ü:"u" };
const slugify = (s) =>
  s.replace(/[çğıöşüÇĞİÖŞÜ]/g, (m) => TR_MAP[m] ?? m)
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "").slice(0, 80);

const mapStatus = (s) =>
  s === "Currently Airing" ? "airing" : s === "Not yet aired" ? "upcoming" : "finished";

function parseDuration(raw) {
  if (!raw) return null;
  const hr = raw.match(/(\d+)\s*hr/);
  const min = raw.match(/(\d+)\s*min/);
  const t = (hr ? +hr[1] * 60 : 0) + (min ? +min[1] : 0);
  return t || null;
}

function toAnimeRow(a) {
  const title = a.title_english || a.title;
  const poster =
    a.images?.webp?.large_image_url ?? a.images?.jpg?.large_image_url ?? null;
  const synopsis = (a.synopsis ?? "").replace(/\[Written by MAL Rewrite\]/gi, "").trim();

  return {
    mal_id: a.mal_id,
    slug: `${slugify(title)}-${a.mal_id}`,
    title,
    title_english: a.title_english ?? null,
    title_japanese: a.title_japanese ?? null,
    synopsis: synopsis || null,
    poster_url: poster,
    banner_url: a.trailer?.youtube_id
      ? `https://img.youtube.com/vi/${a.trailer.youtube_id}/maxresdefault.jpg`
      : poster,
    trailer_url: a.trailer?.embed_url ?? null,
    type: a.type ?? null,
    status: mapStatus(a.status),
    season: a.season ?? null,
    year: a.year ?? null,
    total_episodes: a.episodes ?? 0,
    duration_min: parseDuration(a.duration),
    score: a.score ?? null,
    rating: a.rating ?? null,
    studios: (a.studios ?? []).map((s) => s.name),
    meta_title: `${title} Türkçe Altyazılı İzle`,
    meta_description:
      synopsis.slice(0, 155).trim() ||
      `${title} anime serisinin tüm bölümlerini HD kalitede izle.`,
    og_image_url: poster,
    synced_at: new Date().toISOString(),
  };
}

// ---------- Bölümler ----------
async function fetchEpisodes(malId) {
  const all = [];
  let page = 1;

  while (page <= 25) {
    const ep = page === 1
      ? `/anime/${malId}/episodes`
      : `/anime/${malId}/episodes?page=${page}`;
    try {
      const j = await jikan(ep);
      const data = Array.isArray(j.data) ? j.data : [];
      all.push(...data);
      if (!j.pagination?.has_next_page) break;
      page++;
    } catch (err) {
      if (all.length > 0) break; // kısmi sonucu koru
      throw err;
    }
  }
  return all;
}

function episodeRows(animeId, eps) {
  const seen = new Set();
  const rows = [];
  eps.forEach((e, i) => {
    const number = e.mal_id || i + 1;
    if (seen.has(number)) return; // aynı numara iki kez gelirse upsert patlar
    seen.add(number);
    rows.push({
      anime_id: animeId,
      mal_episode_id: e.mal_id ?? number,
      number,
      title: e.title ?? null,
      air_date: e.aired ? e.aired.slice(0, 10) : null,
      source: "embed",
      video_url: null,
      is_published: true,
    });
  });
  return rows;
}

const placeholderRows = (animeId, count) =>
  Array.from({ length: count }, (_, i) => ({
    anime_id: animeId,
    mal_episode_id: i + 1,
    number: i + 1,
    title: null,
    air_date: null,
    source: "embed",
    video_url: null,
    is_published: true,
  }));

// ---------- Ana akış ----------
const stats = { anime: 0, episodes: 0, placeholder: 0, hata: 0, atlanan: 0 };

async function importAnime(a) {
  const [anime] = await sb("animes", [toAnimeRow(a)], "mal_id");
  stats.anime++;

  // Türler
  if (a.genres?.length) {
    const genres = await sb(
      "genres",
      a.genres.map((g) => ({ mal_id: g.mal_id, name: g.name, slug: slugify(g.name) })),
      "mal_id",
    );
    if (genres.length) {
      await sb(
        "anime_genres",
        genres.map((g) => ({ anime_id: anime.id, genre_id: g.id })),
        "anime_id,genre_id",
      );
    }
  }

  if (!WITH_EPISODES) return `${anime.title}`;

  // Bölümler
  try {
    const eps = await fetchEpisodes(a.mal_id);
    if (eps.length === 0) throw Object.assign(new Error("boş liste"), { status: 204 });
    const rows = episodeRows(anime.id, eps);
    await sb("episodes", rows, "anime_id,number");
    stats.episodes += rows.length;
    return `${anime.title} — ${rows.length} bölüm`;
  } catch (err) {
    const total = a.episodes ?? 0;
    if (total > 0) {
      const rows = placeholderRows(anime.id, total);
      await sb("episodes", rows, "anime_id,number");
      stats.placeholder += rows.length;
      return `${anime.title} — ${rows.length} yer tutucu bölüm (Jikan: ${err.status ?? "?"})`;
    }
    return `${anime.title} — bölüm yok (Jikan: ${err.status ?? "?"})`;
  }
}

async function main() {
  console.log(`\n  Hedef: ${TARGET} anime${WITH_EPISODES ? " + bölümler" : " (bölümsüz)"}`);
  console.log(`  Zaten aktarılmış: ${doneSet.size}\n`);

  // ---- ÖN KONTROL ----
  // İşin gerçekten bağlı olduğu ucu test et: liste sayfası.
  // `/anime/1/full` gibi popüler bir uç Jikan'ın CDN'inde önbellekli
  // olduğu için kaynak kapalıyken bile 200 döner ve yanıltır.
  try {
    await jikan(`/top/anime?page=${progress.page > 1215 ? 1 : progress.page}`);
  } catch (err) {
    console.error(
      `\n  MyAnimeList şu an yanıt vermiyor (Jikan ${err.status ?? "?"}).\n` +
        `  Aktarım başlatılmadı — ilerleme (${doneSet.size} anime) korundu.\n\n` +
        `  Durumu kontrol etmek için: npm run seed:check\n`,
    );
    process.exit(1);
  }

  const started = Date.now();
  const MAX_PAGE = 1215;

  // Önceki çalıştırma sayfa aralığının sonuna dayandıysa başa sar:
  // `doneSet` tekrarları zaten engelliyor, atlanan sayfalar toplanır.
  if (progress.page > MAX_PAGE) {
    console.log("  Sayfa aralığı bitmişti — başa sarılıyor.\n");
    progress.page = 1;
  }

  progress.failedPages ??= [];
  let ardisikHata = 0;

  /** Bir liste sayfasını artan beklemelerle birkaç kez dener. */
  async function sayfaCek(page) {
    const beklemeler = [3000, 10_000, 30_000];
    for (let deneme = 0; ; deneme++) {
      try {
        const j = await jikan(`/top/anime?page=${page}`);
        return j.data ?? [];
      } catch (err) {
        if (deneme >= beklemeler.length) throw err;
        process.stdout.write(
          `  sayfa ${page}: Jikan ${err.status}, ${beklemeler[deneme] / 1000}s sonra tekrar\r`,
        );
        await sleep(beklemeler[deneme]);
      }
    }
  }

  while (doneSet.size < TARGET && progress.page <= MAX_PAGE) {
    let list;
    try {
      list = await sayfaCek(progress.page);
      ardisikHata = 0;
    } catch (err) {
      ardisikHata++;
      if (!progress.failedPages.includes(progress.page)) {
        progress.failedPages.push(progress.page); // sonraki turda tekrar denenir
      }
      console.log(`  ! sayfa ${progress.page} alınamadı (${err.status})`);

      // Devre kesici: arka arkaya çok sayıda sayfa düşüyorsa Jikan
      // geçici olarak bozuk demektir. Sayfa aralığını dakikalar içinde
      // tüketmek yerine bekleyip aynı noktadan devam ederiz.
      if (ardisikHata >= 5) {
        console.log(`  Jikan bozuk görünüyor — 2 dakika bekleniyor...`);
        await sleep(120_000);
        ardisikHata = 0;
        continue; // sayfayı ilerletme, aynı sayfayı tekrar dene
      }

      progress.page++;
      saveProgress();
      continue;
    }

    if (list.length === 0) break;

    for (const a of list) {
      if (doneSet.size >= TARGET) break;
      if (doneSet.has(a.mal_id)) { stats.atlanan++; continue; }

      try {
        const label = await importAnime(a);
        doneSet.add(a.mal_id);
        const dk = ((Date.now() - started) / 60000).toFixed(1);
        console.log(`  [${doneSet.size}/${TARGET}] ${dk}dk  ${label}`);
      } catch (err) {
        stats.hata++;
        progress.failed.push({ mal_id: a.mal_id, hata: String(err.message).slice(0, 200) });
        console.log(`  [HATA] #${a.mal_id}: ${err.message.slice(0, 160)}`);
      }
      saveProgress();
    }

    progress.page++;
    saveProgress();
  }

  const dk = ((Date.now() - started) / 60000).toFixed(1);
  console.log(`\n  ---- Bitti (${dk} dakika) ----`);
  console.log(`  anime            : ${stats.anime}`);
  console.log(`  gerçek bölüm     : ${stats.episodes}`);
  console.log(`  yer tutucu bölüm : ${stats.placeholder}`);
  console.log(`  hata             : ${stats.hata}`);
  console.log(`  zaten vardı      : ${stats.atlanan}\n`);
  if (progress.failed.length) {
    console.log(`  Başarısızlar .seed-progress.json içinde. Tekrar çalıştırmak devam ettirir.\n`);
  }
}

/**
 * --fix-episodes
 * Bölümü hiç olmayan ya da yalnızca yer tutucu (başlıksız) bölümleri olan
 * animeleri bulup Jikan'dan tekrar dener. Jikan geçici 504'lerden sonra
 * boşlukları kapatmak için: normal çalıştırma bunları "yapıldı" saydığı
 * için atlar, bu mod özellikle onları hedefler.
 */
async function fixEpisodes() {
  // main() ile aynı ön kontrol: kapalıyken 457 animeyi tek tek denemek
  // yarım saat boşa dönmek demek.
  try {
    await jikan("/anime/1/episodes");
  } catch (err) {
    console.error(
      `\n  MyAnimeList şu an yanıt vermiyor (Jikan ${err.status ?? "?"}).\n` +
        `  Onarım başlatılmadı. Kontrol: npm run seed:check\n`,
    );
    process.exit(1);
  }

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/animes?select=id,mal_id,title,total_episodes,episodes(number,title,video_url,source,mux_playback_id)&limit=5000`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } },
  );
  const animes = await res.json();

  const eksik = animes.filter((a) => {
    const eps = a.episodes ?? [];
    if (eps.length === 0) return true;
    return eps.every((e) => !e.title); // hepsi yer tutucu
  });

  console.log(`\n  Toplam anime: ${animes.length}`);
  console.log(`  Onarılacak  : ${eksik.length} (bölümsüz ya da sadece yer tutucu)\n`);

  let duzeldi = 0;
  for (const [i, a] of eksik.entries()) {
    try {
      const eps = await fetchEpisodes(a.mal_id);
      if (eps.length === 0) {
        console.log(`  [${i + 1}/${eksik.length}] ${a.title} — Jikan hâlâ boş`);
        continue;
      }
      // Elle girilmiş video bilgisini koru: yer tutucunun üzerine
      // gerçek başlığı yazarken video_url'i sıfırlamamalıyız.
      const oncekiler = new Map(
        (a.episodes ?? []).map((e) => [e.number, e]),
      );
      // Anahtar kümesi HER satırda aynı olmalı: PostgREST toplu eklemede
      // farklı anahtarlı nesneleri reddeder ("All object keys must match").
      const rows = episodeRows(a.id, eps).map((r) => {
        const prev = oncekiler.get(r.number);
        return {
          ...r,
          source: prev?.source ?? r.source,
          video_url: prev?.video_url ?? null,
          mux_playback_id: prev?.mux_playback_id ?? null,
        };
      });

      await sb("episodes", rows, "anime_id,number");
      duzeldi++;
      console.log(`  [${i + 1}/${eksik.length}] ${a.title} — ${rows.length} gerçek bölüm yazıldı`);
    } catch (err) {
      console.log(`  [${i + 1}/${eksik.length}] ${a.title} — Jikan ${err.status ?? "?"}`);
    }
  }

  console.log(`\n  ---- Bitti: ${duzeldi}/${eksik.length} anime onarıldı ----\n`);
}

const run = has("fix-episodes") ? fixEpisodes : main;

run().catch((e) => {
  console.error("\n  Beklenmeyen hata:", e);
  process.exit(1);
});
