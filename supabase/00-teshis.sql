-- =============================================================
--  TEŞHİS — hiçbir şeyi değiştirmez, sadece okur.
--  schema.sql "column mal_id does not exist" hatası verirse
--  önce bunu çalıştırın.
-- =============================================================

-- 1) public şemasında hangi tablolar var?
select table_name
from information_schema.tables
where table_schema = 'public'
order by table_name;

-- 2) animes / genres tablolarının mevcut sütunları neler?
--    (Sonuç boşsa tablo yok; doluysa ve mal_id görünmüyorsa
--     çakışan eski bir tablo var demektir.)
select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name in ('animes', 'genres', 'episodes', 'profiles')
order by table_name, ordinal_position;

-- 3) İçlerinde veri var mı? (Silmeden önce mutlaka bakın.)
select 'animes'   as tablo, count(*) from public.animes
union all
select 'episodes', count(*) from public.episodes
union all
select 'genres',   count(*) from public.genres;
