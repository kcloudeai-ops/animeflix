# Anime Köşesi — Proje Durumu (Devir Belgesi)

> Bu dosya, yeni bir oturumun (ya da başka birinin) projeyi baştan
> anlaması için tutulur. Sohbet geçmişi olmadan da buradan devam edilebilir.

## Genel

- **Proje**: **Anime Köşesi** — Türkçe anime katalog/izleme platformu
  (marka adı "Anime Köşesi", alan adı **animekosesi.com**; kod içinde eski
  paket adı "animekosesi", vaktiyle "AnimeFlix" adıyla başlamıştı)
- **Yığın**: Next.js 15 (App Router) + TypeScript + Supabase (Postgres+Auth) +
  Tailwind v4 + Framer Motion + TanStack Query
- **Konum**: `C:\Users\nuref\Desktop\cloudev1`
- **Git deposu**: https://github.com/kcloudeai-ops/animeflix (private, `main` dalı).
  Değişiklikten sonra: `git add -A && git commit -m "..." && git push`
- **Çalıştırma**: `npm run dev` → http://localhost:3000
- **Veri kaynağı**: **AniList GraphQL** (Jikan/MAL sık 504 verdiği için terk edildi).
  Bölüm başlık boşlukları **Kitsu**'dan dolduruldu.

## Veri durumu (Supabase)

| | Adet |
|---|---|
| Anime | ~2.612 |
| Bölüm | ~42.000 (%86 gerçek başlıklı) |
| Seri (çok sezonlu) | 570 |
| Karakter | ~19.000 |
| Trailer (resmi YouTube) | %79 (kalan ~%21'in resmi fragmanı **yok** — eski/OVA/film) |
| **Bölüm videosu** | **0 — bkz. "Video" bölümü** |

## Slug sistemi (ÖNEMLİ)

- Anime slug'ı: `{başlık}-izle-{mal_id}` → `attack-on-titan-izle-16498`
- Lookup **slug ile değil, sondaki mal_id ile** yapılır (`malIdFromSlug`).
- Eski/yanlış slug → canonical'a **308 kalıcı yönlendirme** (SEO korunur).
- Tek slugify kaynağı: `lib/slug.ts` (Türkçe büyük+küçük harf doğru çevrilir).

## Kurulu özellikler

- Anasayfa: 3 sn'de geçen hero carousel (mobilde DİKEY afiş, masaüstü/TV'de
  geniş banner + Ken Burns — yatay banner telefonu aşırı kırptığı için ayrı;
  birleştirmeyin), "Son Eklenen Bölümler" (sekmeli),
  "İzlemeye Devam Et", tür carousel'leri
- `/kesfet` (filtre+sayfalama), `/ara` (arama), `/kategori/[slug]`,
  `/takvim` (yayın takvimi), `/koleksiyon` (otomatik SEO listeleri)
- Anime detay: sezon sekmeleri, karakterler+seslendirenler, benzer animeler,
  fragman modalı, bölüm listesi (20'şer sayfalı)
- `/listem`, `/profil`, izleme ilerlemesi (`watch_progress`)
- `/blog` + admin editörü (Markdown araç çubuğu + canlı SEO puanı)
- **Yönetim paneli** (sidebar'lı): Gösterge Paneli / İçerik / Blog / Analiz / Güvenlik
- **Canlı analiz**: anonim sayfa takibi (`PageTracker` + `/api/track`),
  10 sn'de tazelenen KPI + "şu an bakılan sayfalar"
- SEO: TVSeries/TVSeason/Person/VideoObject/ItemList/Breadcrumb JSON-LD,
  sitemap (~2.700 URL), robots, OG image, manifest, favicon
- **Meta açıklamaları Türkçe**: synopsis İngilizce geldiği için meta/OG/JSON-LD
  açıklamaları `lib/seo.ts`'te yapısal alanlardan (tür+yıl+bölüm) Türkçe
  üretilir; tür adları `trGenre` ile çevrilir. Admin `meta_description`
  girerse o kullanılır. (Görünür synopsis metni hâlâ İngilizce — ayrı iş.)

## Scriptler (npm run …)

| Komut | İş |
|---|---|
| `seed:anilist -- --count N` | AniList'ten toplu anime aktarımı |
| `fill:titles` | Kitsu'dan eksik bölüm başlıkları |
| `fill:trailers` | AniList'ten eksik fragmanlar |
| `build:series` | Sezon zincirlerini kurar (PREQUEL/SEQUEL) |
| `import:ids` | Eksik sezon komşularını aktarır |
| `fetch:schedule -- --all` | Yayın saatleri + karakterler |
| `migrate:slugs` | Slug'ları -izle- formatına taşır |
| `node scripts/fix-meta-tr.mjs [--apply]` | İngilizce auto meta_description'ları null'lar (çalıştırıldı) |

Tümü `.env.local`'deki `SUPABASE_SERVICE_ROLE_KEY` ile çalışır, Next.js'ten bağımsız.

## SQL migration'ları (`supabase/`) — SIRAYLA çalıştırılır

`00`→`08` arası. **`08-analiz-guvenlik.sql` HENÜZ ÇALIŞTIRILMADI** —
analiz paneli tabloları (page_views, admin_audit) onu bekliyor. Panel
çalışana kadar çökmez, sıfır gösterir.

## Video (kritik karar)

Bölümlerde **hiç video kaynağı yok**. Yasal yol lisans/JustWatch
yönlendirmesidir. **Korsan entegrasyonu (Consumet, hianime-api, embed
scraping) YAPILMADI ve yapılmayacak** — telif ihlali. Oynatıcı altyapısı
(embed/HLS/Mux) hazır; yasal kaynak admin panelinden elle girilir.
Trailer'lar %100 yasaldır ve eklenmiştir.

## Kullanıcının panelden yapması gerekenler (yayın öncesi)

1. **`08-analiz-guvenlik.sql`** çalıştır (analiz paneli için)
2. **Eski JWT anahtarlarını devre dışı bırak** (Supabase → API Keys →
   "Disable JWT-based API keys") — yeni sb_secret_/sb_publishable_
   anahtarlarına geçildi ama eskiler hâlâ aktif
3. **SMTP bağla** (Auth → Emails) — yoksa yeni üye onay maili alamaz
4. **`NEXT_PUBLIC_SITE_URL`** gerçek alan adı + **Search Console** (kod hazır,
   `NEXT_PUBLIC_GOOGLE_VERIFICATION` env'i bekliyor) — bkz. `SEO-KURULUM.md`

## Bilinen tuzaklar (tekrar yaşama)

- **PostgREST tek istekte 1000 satır** döndürür, fazlasını sessizce kırpar →
  sayfalayarak çek (`range`)
- **HTTP 204 gövde taşıyamaz** → `NextResponse.json(...,{status:204})` patlar
- **Dev sunucusu asistan oturumuyla ölebilir** → kullanıcı kendi terminalinden
  `npm run dev` çalıştırmalı; kontrol: `netstat -ano | findstr ":3000"`
- **next.config image host'ları**: cdn.myanimelist.net, s4.anilist.co,
  img1/2.ak.crunchyroll.com, media.kitsu.app/io, img.youtube.com
- Üretim build'i dev sunucusu açıkken `.next`'e yazınca çakışır → build'den
  önce dev'i durdur

## İlgili belgeler

- `README.md` — kurulum
- `URETIM.md` — yayın öncesi güvenlik kontrol listesi
- `SEO-KURULUM.md` — alan adı + Search Console rehberi
