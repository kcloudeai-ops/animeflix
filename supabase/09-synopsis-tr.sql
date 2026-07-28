-- ============================================================
--  09-synopsis-tr.sql
--
--  Türkçe özet kolonu. Kaynak `synopsis` İngilizce (AniList);
--  makine çevirisi buraya yazılır. Site `synopsis_tr ?? synopsis`
--  gösterir — İngilizce orijinal KORUNUR (geri dönülebilir).
--
--  Çalıştırdıktan sonra çeviriyi doldur:
--    node scripts/translate-synopsis.mjs --table=animes
-- ============================================================

alter table public.animes   add column if not exists synopsis_tr text;
alter table public.episodes add column if not exists synopsis_tr text;
