-- =============================================================
--  PAROLA SIFIRLAMA (geliştirme ortamı)
--
--  Onay e-postası gönderilemediğinde ("Reset password" linki
--  ulaşmıyor) parolayı doğrudan burada belirleyebilirsiniz.
--
--  KULLANIM:
--    1. Aşağıdaki 'BURAYA_YENI_PAROLA' yerine kendi parolanızı yazın.
--    2. Parolanızı kimseyle paylaşmayın — bu dosyaya yazıp
--       kaydetmeyin, çalıştırdıktan sonra editörden temizleyin.
--    3. E-postayı kendi hesabınızla değiştirin.
-- =============================================================

update auth.users
set
  encrypted_password = extensions.crypt('BURAYA_YENI_PAROLA', extensions.gen_salt('bf')),
  email_confirmed_at = coalesce(email_confirmed_at, now()),
  updated_at         = now()
where email = 'kcloudeai@gmail.com';

-- `extensions.crypt` bulunamadı hatası alırsanız şemasız deneyin:
--   encrypted_password = crypt('BURAYA_YENI_PAROLA', gen_salt('bf')),

-- Teyit (parola görünmez, sadece güncellendiği doğrulanır)
select email,
       email_confirmed_at is not null as onayli,
       updated_at
from auth.users
where email = 'kcloudeai@gmail.com';
