-- ============================================================
--  10-episode-title-tr.sql
--
--  Bölüm başlıklarının Türkçe karşılığı. Kaynak `title` İngilizce
--  (Kitsu). Makine çevirisi buraya yazılır; site `title_tr ?? title`
--  gösterir. İngilizce orijinal KORUNUR.
--
--  Jenerik "N. Bölüm" başlıkları zaten Türkçe — çevrilmez.
--
--  Çalıştırdıktan sonra:
--    node scripts/translate-titles.mjs
-- ============================================================

alter table public.episodes add column if not exists title_tr text;
