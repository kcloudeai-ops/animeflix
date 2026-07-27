-- =============================================================
--  YAYIN TAKVİMİ + KARAKTERLER
--  Supabase → SQL Editor → yapıştır → Run. Idempotent.
-- =============================================================

-- -------------------------------------------------------------
-- 1) Bölümlere kesin yayın ZAMANI
--    `air_date` yalnızca gün veriyor; takvim "20:00 · 3 bölüm"
--    diyebilmek için saat de gerekiyor.
-- -------------------------------------------------------------
alter table public.episodes
  add column if not exists air_at timestamptz;

-- Takvim sorgusu: belirli bir aralıktaki bölümler, zamana göre
create index if not exists episodes_air_at_idx
  on public.episodes (air_at)
  where air_at is not null;

-- "Son eklenen bölümler" akışı için
create index if not exists episodes_air_date_idx
  on public.episodes (air_date desc)
  where air_date is not null;

-- -------------------------------------------------------------
-- 2) Animenin bir sonraki bölümü (takvim kartları için)
-- -------------------------------------------------------------
alter table public.animes
  add column if not exists next_episode_number integer,
  add column if not exists next_episode_at     timestamptz;

create index if not exists animes_next_ep_idx
  on public.animes (next_episode_at)
  where next_episode_at is not null;

-- -------------------------------------------------------------
-- 3) KARAKTERLER + SESLENDİRENLER
-- -------------------------------------------------------------
create table if not exists public.characters (
  id          uuid primary key default gen_random_uuid(),
  anilist_id  integer unique,
  name        text not null,
  image_url   text,
  created_at  timestamptz not null default now()
);

create table if not exists public.voice_actors (
  id          uuid primary key default gen_random_uuid(),
  anilist_id  integer unique,
  name        text not null,
  image_url   text,
  language    text,
  created_at  timestamptz not null default now()
);

create table if not exists public.anime_characters (
  anime_id      uuid not null references public.animes(id)     on delete cascade,
  character_id  uuid not null references public.characters(id) on delete cascade,
  -- MAIN / SUPPORTING / BACKGROUND
  role          text,
  voice_actor_id uuid references public.voice_actors(id) on delete set null,
  sira          integer default 0,
  primary key (anime_id, character_id)
);

create index if not exists anime_characters_anime_idx
  on public.anime_characters (anime_id, sira);

-- -------------------------------------------------------------
-- 4) RLS — herkes okur, yalnızca admin yazar
-- -------------------------------------------------------------
alter table public.characters       enable row level security;
alter table public.voice_actors     enable row level security;
alter table public.anime_characters enable row level security;

do $$
declare t text;
begin
  foreach t in array array['characters','voice_actors','anime_characters'] loop
    execute format('drop policy if exists "%1$s_public_read" on public.%1$s', t);
    execute format(
      'create policy "%1$s_public_read" on public.%1$s for select using (true)', t);

    execute format('drop policy if exists "%1$s_admin_write" on public.%1$s', t);
    execute format(
      'create policy "%1$s_admin_write" on public.%1$s for all
       using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

-- -------------------------------------------------------------
-- 5) Kontrol
-- -------------------------------------------------------------
select
  (select count(*) from information_schema.columns
    where table_name='episodes' and column_name='air_at')          as episodes_air_at,
  (select count(*) from information_schema.columns
    where table_name='animes' and column_name='next_episode_at')   as animes_next_ep,
  (select count(*) from information_schema.tables
    where table_schema='public' and table_name='characters')       as characters_tablo;
