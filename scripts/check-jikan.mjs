#!/usr/bin/env node
/**
 * scripts/check-jikan.mjs
 *
 * Aktarıma başlamadan önce MyAnimeList/Jikan ayakta mı diye bakar.
 * Kapalıyken seed çalıştırmak dakikalarca boşa dönmek demek — önce bunu
 * çalıştırın, "AÇIK" derse aktarıma geçin.
 *
 *   npm run seed:check
 */

/**
 * Testler bilinçli olarak ÖNBELLEKSİZ uçlardan seçildi.
 * `/anime/1/full` gibi popüler adresler Jikan'ın CDN'inde durduğu için
 * kaynak kapalıyken bile 200 döner ve "açık" yanılgısı yaratır.
 * Rastgele sayfa numaraları bu tuzağı da elemek için kullanılıyor.
 */
const rastgele = (min, max) => min + Math.floor(Math.random() * (max - min));

const TESTS = [
  [`liste sayfa ${rastgele(20, 200)}`, null],
  [`liste sayfa ${rastgele(200, 600)}`, null],
  ["bölüm listesi", "https://api.jikan.moe/v4/anime/918/episodes"],
  ["anime detay", `https://api.jikan.moe/v4/anime/${rastgele(2000, 9000)}/full`],
].map(([ad, url]) => [
  ad,
  url ?? `https://api.jikan.moe/v4/top/anime?page=${ad.match(/\d+/)[0]}`,
]);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let basarili = 0;

console.log("\n  MyAnimeList / Jikan durumu:\n");

for (const [ad, url] of TESTS) {
  let durum;
  try {
    const res = await fetch(url);
    durum = res.status;
    if (res.ok) basarili++;
  } catch {
    durum = "BAĞLANTI YOK";
  }
  console.log(`    ${ad.padEnd(16)} -> ${durum}`);
  await sleep(1400);
}

console.log("");

if (basarili === TESTS.length) {
  console.log("  ✓ AÇIK — aktarıma başlayabilirsiniz:\n");
  console.log("      npm run seed -- --count 600      (partiler hâlinde artırın)");
  console.log("      npm run seed -- --fix-episodes   (yer tutucu başlıkları doldurur)\n");
  process.exit(0);
} else if (basarili > 0) {
  console.log(`  ~ KISMEN AÇIK (${basarili}/${TESTS.length}) — aktarım yarım kalabilir.`);
  console.log("    Küçük partilerle deneyin: npm run seed -- --count 550\n");
  process.exit(0);
} else {
  console.log("  ✗ KAPALI — MyAnimeList yanıt vermiyor. Şimdi aktarım yapmayın.");
  console.log("    Bir süre sonra tekrar deneyin: npm run seed:check\n");
  process.exit(1);
}
