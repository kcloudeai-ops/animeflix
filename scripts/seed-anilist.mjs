#!/usr/bin/env node
/**
 * ============================================================
 *  scripts/seed-anilist.mjs — AniList üzerinden toplu aktarım
 *
 *  Neden Jikan yerine AniList?
 *   - Jikan'ın MAL'a bağlantısı sık sık kopuyor (504). AniList'in
 *     kendi veritabanı var, aracıya bağımlı değil.
 *   - İstek başına 50 kayıt: 2000 anime ≈ 40 istek (Jikan'da ~2500).
 *   - Bölüm başlıkları ve kapakları AYNI istekte geliyor —
 *     anime başına ayrı bölüm isteği yok.
 *   - Gerçek banner görselleri var.
 *   - `idMal` alanı sayesinde mevcut kayıtlarla çakışmadan birleşir.
 *
 *  Kullanım:
 *    npm run seed:anilist -- --count 2000
 *    npm run seed:anilist -- --count 2000 --reset
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
  console.error("\n  HATA: .env.local içinde SUPABASE_SERVICE_ROLE_KEY eksik.\n");
  process.exit(1);
}

/**
 * Anahtarın gerçekten tam yetkili olduğunu doğrula.
 * Supabase'in iki anahtar biçimi var:
 *   - Yeni : sb_secret_... (gizli) / sb_publishable_... (herkese açık)
 *   - Eski : JWT, payload'ında role alanı taşır
 */
function anahtarTamYetkiliMi(key) {
  if (key.startsWith("sb_secret_")) return { ok: true };
  if (key.startsWith("sb_publishable_"))
    return { ok: false, neden: "publishable (herkese açık) anahtar verilmiş" };

  try {
    const p = JSON.parse(
      Buffer.from(key.split(".")[1], "base64").toString("utf8"),
    );
    return p.role === "service_role"
      ? { ok: true }
      : { ok: false, neden: `anahtarın rolü "${p.role}"` };
  } catch {
    return { ok: false, neden: "tanınmayan anahtar biçimi" };
  }
}

const kontrol = anahtarTamYetkiliMi(SERVICE_KEY);
if (!kontrol.ok) {
  console.error(
    `\n  HATA: SUPABASE_SERVICE_ROLE_KEY geçersiz — ${kontrol.neden}.\n` +
      "  Gerekli: service_role (legacy) ya da sb_secret_... (yeni) anahtar.\n",
  );
  process.exit(1);
}

// ---------- Argümanlar ----------
const argv = process.argv.slice(2);
const arg = (n, d) => {
  const i = argv.indexOf(`--${n}`);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : d;
};
const has = (n) => argv.includes(`--${n}`);

const TARGET = Number(arg("count", 2000));
const PER_PAGE = 50; // AniList üst sınırı
const PROGRESS_FILE = path.join(ROOT, ".seed-anilist-progress.json");

if (has("reset") && fs.existsSync(PROGRESS_FILE)) {
  fs.unlinkSync(PROGRESS_FILE);
  console.log("İlerleme sıfırlandı.");
}

const progress = fs.existsSync(PROGRESS_FILE)
  ? JSON.parse(fs.readFileSync(PROGRESS_FILE, "utf8"))
  : { page: 1, done: [] };

const doneSet = new Set(progress.done);
const saveProgress = () => {
  progress.done = [...doneSet];
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 1));
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- AniList ----------
// Belgelenen sınır 90 istek/dk; güvenli tarafta kalmak için ~1.5 sn aralık.
const QUERY = `
query ($page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    pageInfo { hasNextPage }
    media(type: ANIME, sort: POPULARITY_DESC, isAdult: false) {
      idMal
      title { romaji english native }
      description(asHtml: false)
      coverImage { extraLarge large }
      bannerImage
      format status episodes duration season seasonYear
      averageScore genres
      studios(isMain: true) { nodes { name } }
      trailer { id site }
      streamingEpisodes { title thumbnail }
    }
  }
}`;

async function anilist(page, deneme = 0) {
  const res = await fetch("https://graphql.anilist.co", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query: QUERY, variables: { page, perPage: PER_PAGE } }),
  });

  // 429: Retry-After başlığına uy
  if (res.status === 429 && deneme < 4) {
    const bekle = Number(res.headers.get("retry-after") ?? 60) * 1000;
    console.log(`  hız sınırı — ${Math.ceil(bekle / 1000)}s bekleniyor…`);
    await sleep(bekle + 500);
    return anilist(page, deneme + 1);
  }

  if (!res.ok) {
    const err = new Error(`AniList ${res.status} (sayfa ${page})`);
    err.status = res.status;
    throw err;
  }

  const json = await res.json();
  if (json.errors?.length) {
    throw new Error(`AniList: ${json.errors[0].message}`);
  }
  return json.data.Page;
}

// ---------- Supabase ----------
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
    throw new Error(`${table} (${res.status}): ${body.slice(0, 250)}`);
  }
  return body ? JSON.parse(body) : [];
}

// ---------- Dönüştürücüler ----------
const TR = { ç:"c", ğ:"g", ı:"i", ö:"o", ş:"s", ü:"u", Ç:"c", Ğ:"g", İ:"i", Ö:"o", Ş:"s", Ü:"u" };
const slugify = (s) =>
  s.replace(/[çğıöşüÇĞİÖŞÜ]/g, (m) => TR[m] ?? m)
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "").slice(0, 80);

const STATUS = {
  FINISHED: "finished",
  RELEASING: "airing",
  NOT_YET_RELEASED: "upcoming",
  CANCELLED: "finished",
  HIATUS: "airing",
};

const FORMAT = {
  TV: "TV", TV_SHORT: "TV Short", MOVIE: "Movie", SPECIAL: "Special",
  OVA: "OVA", ONA: "ONA", MUSIC: "Music",
};

/** AniList açıklaması HTML kırıntıları içerir (<br>, <i>). Temizle. */
const temizle = (html) =>
  (html ?? "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

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
    // AniList gerçek banner veriyor; yoksa afişe düşüyoruz.
    banner_url: m.bannerImage ?? poster,
    trailer_url:
      m.trailer?.site === "youtube" && m.trailer.id
        ? `https://www.youtube.com/embed/${m.trailer.id}`
        : null,
    type: FORMAT[m.format] ?? m.format ?? null,
    status: STATUS[m.status] ?? "finished",
    season: m.season ? m.season.toLowerCase() : null,
    year: m.seasonYear ?? null,
    total_episodes: m.episodes ?? 0,
    duration_min: m.duration ?? null,
    // AniList puanı 0-100; şemamız 0-10 bekliyor.
    score: m.averageScore != null ? Math.round(m.averageScore) / 10 : null,
    rating: null,
    studios: (m.studios?.nodes ?? []).map((s) => s.name),
    meta_title: `${title} Türkçe Altyazılı İzle`,
    // Synopsis İNGİLİZCE; meta'ya yazma. Boş bırak — site Türkçe açıklamayı
    // yapısal alanlardan üretir (lib/seo.ts). Admin panelinden elle girilebilir.
    meta_description: null,
    og_image_url: poster,
    synced_at: new Date().toISOString(),
  };
}

/**
 * streamingEpisodes başlıkları "Episode 12 - Gerçek Başlık" biçiminde gelir.
 * Numarayı ayıklayıp temiz başlığı bırakıyoruz. Ayıklanamazsa sıra numarası
 * kullanılır.
 */
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
      anime_id: animeId,
      mal_episode_id: number,
      number,
      title: (eslesme ? eslesme[2] : e.title)?.trim() || null,
      thumbnail_url: e.thumbnail ?? null,
      air_date: null,
      source: "embed",
      video_url: null,
      mux_playback_id: null,
      is_published: true,
    });
  });

  // streamingEpisodes eksikse bilinen bölüm sayısından tamamla
  for (let n = 1; n <= toplam; n++) {
    if (gorulen.has(n)) continue;
    rows.push({
      anime_id: animeId,
      mal_episode_id: n,
      number: n,
      title: null,
      thumbnail_url: null,
      air_date: null,
      source: "embed",
      video_url: null,
      mux_playback_id: null,
      is_published: true,
    });
  }

  return rows.sort((a, b) => a.number - b.number);
}

// ---------- Ana akış ----------
const stats = { anime: 0, bolum: 0, baslikli: 0, atlanan: 0, hata: 0 };

async function main() {
  console.log(`\n  Kaynak: AniList GraphQL`);
  console.log(`  Hedef : ${TARGET} anime`);
  console.log(`  Mevcut: ${doneSet.size}\n`);

  const started = Date.now();

  while (doneSet.size < TARGET) {
    let sayfa;
    try {
      sayfa = await anilist(progress.page);
    } catch (err) {
      console.error(`  ! sayfa ${progress.page}: ${err.message}`);
      stats.hata++;
      if (stats.hata >= 3) {
        console.error("  Üst üste hata — durduruluyor. Tekrar çalıştırın.\n");
        break;
      }
      await sleep(5000);
      continue;
    }

    for (const m of sayfa.media) {
      if (doneSet.size >= TARGET) break;
      // AniList'e özel kayıtların MAL karşılığı yok; şemamız mal_id ile
      // tekilleştirdiği için bunları atlıyoruz.
      if (!m.idMal) { stats.atlanan++; continue; }
      if (doneSet.has(m.idMal)) { stats.atlanan++; continue; }

      try {
        const [anime] = await sb("animes", [toAnimeRow(m)], "mal_id");

        if (m.genres?.length) {
          const genres = await sb(
            "genres",
            m.genres.map((g) => ({ name: g, slug: slugify(g) })),
            "name",
          );
          if (genres.length) {
            await sb(
              "anime_genres",
              genres.map((g) => ({ anime_id: anime.id, genre_id: g.id })),
              "anime_id,genre_id",
            );
          }
        }

        const eps = toEpisodeRows(anime.id, m);
        if (eps.length) {
          await sb("episodes", eps, "anime_id,number");
          stats.bolum += eps.length;
          stats.baslikli += eps.filter((e) => e.title).length;
        }

        doneSet.add(m.idMal);
        stats.anime++;

        const dk = ((Date.now() - started) / 60000).toFixed(1);
        console.log(
          `  [${doneSet.size}/${TARGET}] ${dk}dk  ${anime.title} — ${eps.length} bölüm` +
            (eps.some((e) => e.title) ? " (başlıklı)" : ""),
        );
      } catch (err) {
        stats.hata++;
        console.log(`  [HATA] ${m.title.romaji}: ${String(err.message).slice(0, 140)}`);
      }
    }

    saveProgress();
    if (!sayfa.pageInfo.hasNextPage) break;
    progress.page++;
    saveProgress();
    await sleep(1500); // AniList'e nazik davran
  }

  const dk = ((Date.now() - started) / 60000).toFixed(1);
  console.log(`\n  ---- Bitti (${dk} dakika) ----`);
  console.log(`  yeni anime       : ${stats.anime}`);
  console.log(`  bölüm            : ${stats.bolum} (${stats.baslikli} gerçek başlıklı)`);
  console.log(`  atlanan          : ${stats.atlanan}`);
  console.log(`  hata             : ${stats.hata}`);
  console.log(`  toplam aktarılan : ${doneSet.size}\n`);
}

main().catch((e) => {
  console.error("\n  Beklenmeyen hata:", e);
  process.exit(1);
});
