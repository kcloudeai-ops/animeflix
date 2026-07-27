-- =============================================================
--  İÇERİK TEŞHİSİ — sadece okur.
--  "Aktarıldı" dendiği halde sitede içerik görünmüyorsa çalıştırın.
--
--  SQL Editor `postgres` rolüyle çalışır ve RLS'i baypas eder;
--  bu yüzden satır gerçekten var mı yok mu burada net görünür.
-- =============================================================

-- 1) Kayıt gerçekten var mı?
select mal_id, title, slug, is_published, is_featured, total_episodes, created_at
from public.animes
order by created_at desc;

-- 2) Bölümler
select count(*) as bolum_sayisi from public.episodes;

-- 3) Rolünüz hâlâ admin mi?
select u.email, p.role
from auth.users u join public.profiles p on p.id = u.id;

-- 4) RLS politikaları yerinde mi?
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public' and tablename in ('animes','episodes')
order by tablename, policyname;

-- -------------------------------------------------------------
--  YORUMLAMA
--
--  1 boş  -> Aktarım veritabanına hiç yazmamış (ya da sonradan
--            silinmiş / şema tekrar sıfırlanmış).
--
--  1 dolu ama sitede görünmüyor -> okuma tarafı sorunu:
--            is_published = false ise anasayfa filtreler.
--            Düzeltmek için:
--              update public.animes set is_published = true;
--
--  3'te role <> 'admin' -> aktarım yetkisi yok demektir; ama o
--            durumda API 403 dönerdi, "aktarıldı" demezdi.
-- -------------------------------------------------------------
