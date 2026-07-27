-- =============================================================
--  SIFIRLAMA — VERİ SİLER, GERİ ALINAMAZ
--
--  Bu projede çalıştırılmadan önce doğrulandı (21.07.2026):
--    animes = 0 kayıt, episodes = 0 kayıt, profiles = 0 kayıt
--  Yani silinecek gerçek veri yok. Başka bir projede
--  kullanacaksanız ÖNCE 00-teshis.sql ile sayıları teyit edin.
--
--  Neden gerekli: projede bu şemadan FARKLI bir yapıya sahip
--  animes/episodes/profiles tabloları vardı (mal_id, poster_url,
--  meta_title, studios, episodes.number, episodes.source
--  sütunları yok). `create table if not exists` bunları sessizce
--  atladığı için schema.sql yarıda kalıyordu.
--
--  auth.users (kullanıcı hesapları) SİLİNMEZ.
--  Çalıştırdıktan sonra schema.sql'i baştan çalıştırın.
-- =============================================================

-- Trigger'ı önce kaldır: profiles düşerken auth.users'a bağlı kalmasın.
drop trigger if exists on_auth_user_created on auth.users;

-- Tablolar — cascade, bağlı politika/FK/index'leri de düşürür.
drop table if exists public.watch_progress cascade;
drop table if exists public.watchlist      cascade;
drop table if exists public.anime_genres   cascade;
drop table if exists public.episodes       cascade;
drop table if exists public.genres         cascade;
drop table if exists public.animes         cascade;
drop table if exists public.profiles       cascade;

-- Fonksiyonlar
drop function if exists public.increment_episode_view(uuid);
drop function if exists public.handle_new_user() cascade;
drop function if exists public.touch_updated_at() cascade;
drop function if exists public.is_admin();

-- Tipler — eski şemadan kalan farklı tanımlar olabilir, cascade ile temizle.
drop type if exists video_source cascade;
drop type if exists anime_status cascade;
drop type if exists user_role    cascade;

-- Bittiğinde: public şemasında bu projeye ait tablo kalmamalı.
select table_name from information_schema.tables
where table_schema = 'public' order by table_name;
