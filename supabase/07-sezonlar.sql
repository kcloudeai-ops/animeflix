-- =============================================================
--  SEZON YAPISI
--
--  Sorun: "Attack on Titan", "Attack on Titan Season 2",
--  "Attack on Titan Season 3 Part 2" şu an birbirinden habersiz
--  üç ayrı kayıt. Kullanıcı bir sezonu açtığında diğerlerine
--  geçemiyor.
--
--  Çözüm: animeleri bir SERİ altında toplayıp sıra numarası ver.
--  Bağlar AniList'in PREQUEL/SEQUEL ilişkilerinden kurulur —
--  başlıktan regex çıkarımı "Spice and Wolf II" ile
--  "A Certain Magical Index II" gibi tutarsız adlandırmalarda
--  tökezliyor.
--
--  Supabase → SQL Editor → yapıştır → Run. Idempotent.
-- =============================================================

-- -------------------------------------------------------------
-- 1) SERİLER
-- -------------------------------------------------------------
create table if not exists public.series (
  id          uuid primary key default gen_random_uuid(),
  -- Serinin kökü (ilk sezon) — görüntülenen ad buradan gelir
  title       text not null,
  slug        text unique not null,
  -- Zincirin ilk halkasının MAL id'si; tekrar çalıştırmada
  -- aynı seriyi yeniden oluşturmamak için kullanılır
  root_mal_id integer unique,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- -------------------------------------------------------------
-- 2) ANIME -> SERİ bağı
-- -------------------------------------------------------------
alter table public.animes
  add column if not exists series_id     uuid references public.series(id) on delete set null,
  -- Seri içindeki sıra: 1, 2, 3… (Part'lar da ayrı halka sayılır)
  add column if not exists season_number integer,
  -- "Season 3 Part 2", "Final Season" gibi serbest etiket
  add column if not exists season_label  text;

create index if not exists animes_series_idx
  on public.animes (series_id, season_number)
  where series_id is not null;

-- -------------------------------------------------------------
-- 3) updated_at tetikleyicisi
-- -------------------------------------------------------------
drop trigger if exists trg_touch_series on public.series;
create trigger trg_touch_series
  before update on public.series
  for each row execute function public.touch_updated_at();

-- -------------------------------------------------------------
-- 4) RLS — herkes okur, yalnızca admin yazar
-- -------------------------------------------------------------
alter table public.series enable row level security;

drop policy if exists "series_public_read" on public.series;
create policy "series_public_read" on public.series
  for select using (true);

drop policy if exists "series_admin_write" on public.series;
create policy "series_admin_write" on public.series
  for all using (public.is_admin()) with check (public.is_admin());

-- -------------------------------------------------------------
-- 5) Kontrol
-- -------------------------------------------------------------
select
  (select count(*) from information_schema.tables
    where table_schema='public' and table_name='series')            as series_tablo,
  (select count(*) from information_schema.columns
    where table_name='animes' and column_name='series_id')          as animes_series_id,
  (select count(*) from information_schema.columns
    where table_name='animes' and column_name='season_number')      as animes_season_number;
