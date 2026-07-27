-- =============================================================
--  BÖLÜMLERİ YAYINA AL
--
--  Sorun: aktarım bölümleri `is_published = false` ile yazıyordu.
--  `episodes` RLS okuma politikası `is_published or is_admin()`
--  olduğu için bu satırlar ziyaretçilere görünmüyordu — her seri
--  "henüz bölüm eklenmemiş" görünüyordu.
--
--  Aktarım kodu düzeltildi (bundan sonrakiler yayında gelecek).
--  Bu script hâlihazırda yazılmış olanları görünür yapar.
-- =============================================================

-- 1) ÖNCE: gerçekten kaç bölüm var? (SQL Editor RLS'i baypas eder)
select
  count(*)                              as toplam_bolum,
  count(*) filter (where is_published)   as yayinda,
  count(*) filter (where not is_published) as gizli
from public.episodes;

-- 2) Hepsini yayına al
update public.episodes
set is_published = true
where not is_published;

-- 3) SONRA: kontrol
select
  a.title,
  count(e.id) as bolum
from public.animes a
left join public.episodes e on e.anime_id = a.id
group by a.title
order by bolum desc
limit 15;
