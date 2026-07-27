# SEO Kurulum Rehberi

Kod tarafı hazır. Bu iki adım **sizin** yapmanız gerekenler — biri alan
adınızı, diğeri Google hesabınızı gerektiriyor.

---

## 1. `NEXT_PUBLIC_SITE_URL` — gerçek alan adı

Şu an `http://localhost:3000`. Bu hâliyle yayına alınırsa **tüm**
canonical etiketleri, OpenGraph adresleri, JSON-LD şemaları ve
sitemap'in 2.639 URL'i localhost gösterir — Google siteyi indeksleyemez.

### Nerede ayarlanır

**Yerelde test için** `.env.local`:
```
NEXT_PUBLIC_SITE_URL=https://alanadiniz.com
```

**Yayında** (Vercel / Netlify / sunucu) barındırma panelinde ortam
değişkeni olarak. `.env.local` git'e girmiyor, oraya yazmak yayını
etkilemez.

> Sonunda `/` olmadan yazın. Kod zaten temizliyor ama alışkanlık iyi.

Değişiklikten sonra **yeniden derleme** gerekir (`npm run build`) —
`NEXT_PUBLIC_` değişkenleri derleme anında gömülür.

---

## 2. Google Search Console

Google'ın 2.639 sayfayı bulup indekslemesi için.

### Adım adım

1. [search.google.com/search-console](https://search.google.com/search-console)
   → **Mülk ekle** → **URL öneki** → `https://alanadiniz.com`

2. Doğrulama yöntemi: **"HTML etiketi"** seçin. Google şöyle bir kod verir:
   ```html
   <meta name="google-site-verification" content="AbC123..." />
   ```
   Sadece `content` içindeki değeri kopyalayın (`AbC123...`).

3. `.env.local` (ve yayın panelinde):
   ```
   NEXT_PUBLIC_GOOGLE_VERIFICATION=AbC123...
   ```
   Yeniden derleyip yayınlayın. Kod bu değeri otomatik olarak
   `<head>`'e ekliyor.

4. Search Console'da **Doğrula**'ya basın.

5. Doğrulandıktan sonra: sol menü → **Site Haritaları** →
   `sitemap.xml` yazıp **Gönder**.

### Bing de ekleyin (5 dakika)

[bing.com/webmasters](https://www.bing.com/webmasters) → Search
Console'dan **içe aktar** düğmesiyle tek tıkla. Türkiye'de Bing/Yandex
trafiği azımsanmayacak düzeyde.

---

## Doğrulama kontrol listesi

Yayına aldıktan sonra tarayıcıda kontrol edin:

- [ ] `alanadiniz.com/sitemap.xml` açılıyor ve URL'ler gerçek alan adını gösteriyor
- [ ] `alanadiniz.com/robots.txt` sitemap satırında gerçek alan adı var
- [ ] Bir anime sayfasında sağ tık → kaynağı görüntüle → `rel="canonical"` gerçek alan adı
- [ ] [Rich Results Test](https://search.google.com/test/rich-results)
      ile bir anime sayfasını tarayın — TVSeries + Breadcrumb görünmeli
- [ ] Anasayfayı tarayın — WebSite + Organization görünmeli

---

## Bunlar tamamlandıktan sonra — sıradaki SEO katmanları

Öncelik sırasına göre:

### Yüksek etki
- **Slug'a "izle" eki**: `/anime/tokyo-ghoul-izle` biçimi. "tokyo ghoul
  izle" Türkçe aramada tam eşleşme. Slug değişikliği eski URL'leri
  kıracağı için 301 yönlendirme tablosu gerekir — planlı yapılmalı.
- **Bölüm sayfalarına gerçek `VideoObject`**: video kaynağı eklendiğinde
  Google video zengin sonucu (thumbnail + süre) verir. Altyapı hazır.

### Orta etki
- **`TVSeason` şeması**: 570 seri için sezon yapısı hazır, şema eklenebilir.
- **Karakterler için `Person` şeması**: 19.065 karakter.
- **Blog / haber bölümü**: yeni sezon duyuruları, öneri listeleri.
  Uzun kuyruk trafiği için en güçlü kaldıraç.

### Uzun vade
- **Kullanıcı yorumları / puanları**: taze, özgün içerik sinyali.
- **hreflang**: İngilizce sürüm eklenirse.
