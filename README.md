# AnimeFlix

Next.js 15 (App Router) + TypeScript + Supabase + Tailwind v4 + Framer Motion ile
kurulmuş, Jikan API'den beslenen anime akış platformu.

---

## Hızlı Başlangıç

```bash
# 1) Bağımlılıklar
npm install

# 2) Ortam değişkenleri
cp .env.example .env.local     # Windows PowerShell: Copy-Item .env.example .env.local
#    -> .env.local içine Supabase URL / anon key / service role key yazın

# 3) Geliştirme sunucusu
npm run dev                    # http://localhost:3000

# 4) Üretim derlemesi
npm run build && npm start
```

`.env.local` **doldurulmadan da çalışır**: uygulama "demo mod"a düşer ve
anasayfa/detay verilerini doğrudan Jikan'dan çeker. Bu modda içe aktarma ve
oturum açma devre dışıdır.

### Supabase kurulumu

1. [supabase.com](https://supabase.com) üzerinde proje açın.
2. **SQL Editor → New query** → `supabase/schema.sql` içeriğini yapıştırıp çalıştırın.
3. **Project Settings → API**'den `URL`, `anon key` ve `service_role key` değerlerini
   `.env.local` içine kopyalayın.
4. Siteden `/giris` üzerinden kayıt olun, sonra SQL Editor'de kendinizi admin yapın:

   ```sql
   update public.profiles set role = 'admin'
   where id = (select id from auth.users where email = 'siz@ornek.com');
   ```

5. `/admin` artık erişilebilir.

---

## Dosya Mimarisi

```
cloudev1/
├── app/
│   ├── layout.tsx                    # kök layout, global metadata + title template
│   ├── globals.css                   # Tailwind v4 @theme, shimmer/no-scrollbar utility'leri
│   ├── providers.tsx                 # TanStack Query sağlayıcısı
│   ├── page.tsx                      # Anasayfa (hero + carousel'lar, streaming SSR)
│   ├── kesfet/page.tsx               # Tüm yapımlar ızgarası
│   ├── giris/page.tsx                # Giriş / kayıt (Supabase Auth)
│   ├── not-found.tsx                 # 404
│   ├── sitemap.ts                    # dinamik sitemap.xml
│   ├── robots.ts                     # robots.txt (/admin, /api kapalı)
│   ├── anime/[slug]/
│   │   ├── page.tsx                  # Detay + generateMetadata + TVSeries JSON-LD
│   │   └── bolum/[number]/page.tsx   # İzleme + VideoObject JSON-LD
│   ├── admin/page.tsx                # Yönetim paneli (force-dynamic, noindex)
│   └── api/admin/
│       ├── import/route.ts           # POST: Jikan -> Supabase aktarımı
│       └── search/route.ts           # GET : Jikan başlık araması
│
├── components/
│   ├── Navbar.tsx                    # scroll'a göre şeffaf -> opak
│   ├── HeroBanner.tsx                # Netflix tarzı hero
│   ├── AnimeCard.tsx                 # hover zoom + skor rozeti
│   ├── AnimeCarousel.tsx             # yatay kaydırma + kenar okları
│   ├── VideoPlayer.tsx               # mux / cloudinary / hls / embed
│   ├── Skeletons.tsx                 # Suspense fallback'leri
│   ├── JsonLd.tsx                    # TVSeries / VideoObject / BreadcrumbList
│   └── admin/
│       ├── AnimeImporter.tsx         # arama + tek tıkla aktarma
│       └── AdminAnimeTable.tsx       # CRUD tablosu + SEO çekmecesi
│
├── lib/
│   ├── anime-api.ts                  # Jikan istemcisi (rate limit, retry, dönüştürücüler)
│   ├── queries.ts                    # sunucu veri erişimi (+ demo mod fallback)
│   ├── types.ts                      # domain + Jikan tipleri
│   └── supabase/
│       ├── config.ts                 # env okuma + isSupabaseConfigured
│       ├── client.ts                 # tarayıcı istemcisi
│       └── server.ts                 # sunucu + service-role istemcisi
│
├── supabase/schema.sql               # tablolar, RLS, trigger'lar, storage, RPC
├── middleware.ts                     # oturum tazeleme + /admin rol koruması
└── next.config.ts                    # görsel domainleri, AVIF/WebP, tracing root
```

---

## Mimari Notlar

### Jikan edge davranışı (ölçülmüş)

Jikan'ın CDN'i collection uçlarında **sorgu dizeli** istekleri zaman zaman
kalıcı olarak 504 ile önbelleğe alıyor:

| İstek | Sonuç |
| --- | --- |
| `/seasons/now` | 200 |
| `/seasons/now?sfw=true` | 504 (cache'li, ~0.1 sn) |
| `/top/anime` | 200 |
| `/top/anime?filter=bypopularity` | 504 |
| `/anime/{id}/full` | 200 |

Yeniden deneme işe yaramaz (hata önbelleklenmiş). Bu yüzden `lib/anime-api.ts`
liste uçlarını **parametresiz** çağırır; `sfw` filtresi ve kırpma yerelde yapılır.
Arama (`?q=`) parametresiz çalışamadığı için kesintiye girdiğinde istisna
fırlatmak yerine `unavailable: true` döner ve admin arayüzü kullanıcıyı
"MAL ID ile aktarın" yoluna yönlendirir — ID tabanlı aktarma path uçlarını
kullandığı için kesintiden etkilenmez.

### Rate limiting

Jikan ~3 istek/sn sınırına sahip. `lib/anime-api.ts` tüm istekleri tek bir
Promise zincirinde seri hale getirir, aralarına 400 ms koyar ve 429'da
1s → 2s → 4s üstel geri çekilme uygular.

### Önbellekleme katmanları

| Katman | Süre | Nerede |
| --- | --- | --- |
| Jikan `fetch` (ISR) | 1–6 saat | `lib/anime-api.ts` |
| Sayfa ISR | 1 saat | `export const revalidate` |
| TanStack Query | 1 dk stale | `app/providers.tsx` |
| Aktarma sonrası | anında | `revalidatePath()` |

### Güvenlik

- `middleware.ts` her istekte Supabase oturumunu tazeler; `/admin`, `/listem`,
  `/profil` oturum ister, `/admin` ayrıca `role = 'admin'` ister.
- Yetkisiz `/admin` erişimi **404'e rewrite** edilir — rotanın varlığı sızmaz.
- `/api/admin/*` rotaları middleware'e güvenmez, rolü ikinci kez doğrular.
- RLS tüm tablolarda açık; `public.is_admin()` SECURITY DEFINER olduğu için
  `profiles` politikası kendini sorgularken recursion oluşmaz.

---

## Yapılmadı / Sonraki adımlar

- `/listem` (izleme listesi) sayfası — tablo ve RLS hazır, arayüz yok.
  Bu yüzden navbar'a eklenmedi.
- `generateStaticParams` — `/anime/[slug]` şu an istek anında render edilip
  ISR ile önbelleğe alınıyor. Popüler başlıkları build'de üretmek isterseniz
  detay sayfasına ekleyin.
- Bölüm video kaynakları Jikan'da yok; aktarım sonrası bölümler
  `is_published = false` gelir, video URL'i admin panelinden girilir.
