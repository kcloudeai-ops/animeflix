# Yayına Alma Kontrol Listesi

Bu maddeler **tamamlanmadan siteyi yayına almayın**. Her biri şu anda
açık bir risk ya da bozuk davranış.

---

## 1. `service_role` anahtarını yenileyin — ACİL

Anahtar bir sohbet kanalında paylaşıldı. Bu anahtar RLS'i tamamen
baypas eder: onunla veritabanındaki her şey okunabilir, değiştirilebilir
ve silinebilir.

**Supabase → Project Settings → API Keys → `service_role` → Reset**

Yenileyince `.env.local` içindeki `SUPABASE_SERVICE_ROLE_KEY` değerini
güncelleyin. Bu anahtar **asla** `NEXT_PUBLIC_` önekiyle kullanılmamalı
ve `.env.example` gibi commit edilen dosyalara yazılmamalı.

## 2. Gerçek bir SMTP sağlayıcısı bağlayın

**E-posta onayı zaten AÇIK** (Authentication → Sign In / Providers →
Email → "Confirm email" ✓). Doğrulandı, bir şey yapmanıza gerek yok.

Ama Supabase'in **yerleşik SMTP'si saatte yalnızca ~2 e-posta**
gönderir ve çoğu zaman spam'e düşer. Onay açıkken bu, yeni
kullanıcıların **hiç giriş yapamaması** demektir — geliştirme sırasında
tam olarak bu duvara çarpıldı.

Yayına almadan önce kendi sağlayıcınızı bağlayın (Resend, SendGrid,
Postmark):

**Authentication → Emails → SMTP Settings**

Bağlanana kadar kayıt akışı pratikte çalışmaz.

## 3. `NEXT_PUBLIC_SITE_URL` değerini ayarlayın

Şu an `http://localhost:3000`. Bu hâliyle yayına alınırsa **canonical
etiketleri, OpenGraph adresleri, JSON-LD şemaları ve sitemap'in tamamı
localhost gösterir** — arama motorları siteyi indeksleyemez, sosyal
medya önizlemeleri çalışmaz.

```
NEXT_PUBLIC_SITE_URL=https://alanadiniz.com
```

Kod artık üretim derlemesinde localhost kalırsa konsola uyarı basıyor,
ama derlemeyi durdurmuyor — uyarıyı gözden kaçırmayın.

## 4. Supabase yönlendirme adreslerini güncelleyin

**Authentication → URL Configuration**

- **Site URL**: `https://alanadiniz.com`
- **Redirect URLs**: `https://alanadiniz.com/**`

Bunlar `localhost:3000`'de kalırsa giriş sonrası yönlendirmeler
kullanıcıyı localhost'a atar.

## 5. Ortam değişkenlerini barındırma sağlayıcısına taşıyın

`.env.local` git'e girmiyor (girmemeli). Vercel/Netlify panelinde
tanımlayın:

| Değişken | Görünürlük |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Tarayıcıya gider — sorun değil |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Tarayıcıya gider — tasarımı böyle |
| `SUPABASE_SERVICE_ROLE_KEY` | **Sadece sunucu** — asla public yapmayın |
| `NEXT_PUBLIC_SITE_URL` | Tarayıcıya gider |

## 6. İlk admin hesabını doğrulayın

Yayına aldıktan sonra kendi hesabınızın hâlâ admin olduğunu kontrol
edin:

```sql
select u.email, p.role
from auth.users u join public.profiles p on p.id = u.id
where p.role = 'admin';
```

Beklenmedik bir hesap admin görünüyorsa derhal düşürün.

---

## Bilinen eksikler (yayına engel değil)

- **Bölümlerde video kaynağı yok.** Site şu an bir katalog; oynatma
  için yönetim panelinden (`/admin` → 🎬) video URL'leri girilmeli.
- **15.137 bölüm başlıksız** — AniList'in `streamingEpisodes` kapsamı
  dışındakiler. Kozmetik.
- **API rotalarında hız sınırı yok.** `/api/search` ve `/api/genres`
  herkese açık; kötüye kullanım riski varsa bir sınırlayıcı ekleyin.
- **Telif.** Anime meta verisi AniList'ten alınıyor (kaynak belirtildi).
  Video içeriğinin hukuki sorumluluğu tamamen size aittir.
