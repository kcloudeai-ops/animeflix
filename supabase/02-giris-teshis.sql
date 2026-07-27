-- =============================================================
--  GİRİŞ TEŞHİSİ — sadece okur, hiçbir şeyi değiştirmez.
-- =============================================================

select
  u.email,
  u.email_confirmed_at is not null           as eposta_onayli,
  u.encrypted_password is not null           as parola_tanimli,
  u.banned_until                             as yasakli_mi,
  u.last_sign_in_at                          as son_giris,
  u.created_at                               as olusturma,
  p.role                                     as rol
from auth.users u
left join public.profiles p on p.id = u.id
order by u.created_at;

-- Beklenen: eposta_onayli = true, parola_tanimli = true,
--           yasakli_mi = null, rol = 'admin' (kendi hesabınız için)
--
-- eposta_onayli = false  -> onay adımı çalışmamış
-- parola_tanimli = false -> hesapta hiç parola yok (OAuth ile açılmış olabilir)
-- ikisi de true ise      -> parola yanlış; 03-parola-sifirla.sql'i kullanın
