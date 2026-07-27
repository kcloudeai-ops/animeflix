-- =============================================================
--  ANIMEFLIX — Supabase Şeması
--  Çalıştırma: Supabase Dashboard > SQL Editor > New query > Run
--  Idempotent: tekrar çalıştırılabilir.
-- =============================================================

create extension if not exists "pg_trgm";      -- başlık araması için
create extension if not exists "unaccent";

-- -------------------------------------------------------------
--  ÖN KONTROL
--  Aşağıdaki `create table if not exists` ifadeleri, farklı bir
--  yapıya sahip aynı isimli bir tablo varsa onu SESSİZCE atlar;
--  hata ancak çok sonra "column mal_id does not exist" (42703)
--  olarak ortaya çıkar. Bunu baştan, anlaşılır biçimde yakalayalım.
-- -------------------------------------------------------------
do $$
declare bad text;
begin
  select string_agg(t, ', ') into bad
  from (
    select 'animes' as t where to_regclass('public.animes') is not null
      and not exists (select 1 from information_schema.columns
                      where table_schema='public' and table_name='animes'
                        and column_name='mal_id')
    union all
    select 'genres' where to_regclass('public.genres') is not null
      and not exists (select 1 from information_schema.columns
                      where table_schema='public' and table_name='genres'
                        and column_name='mal_id')
  ) s;

  if bad is not null then
    raise exception
      'Uyumsuz tablo(lar) mevcut: %. Bunlar bu şemadan farklı bir yapıda. Önce supabase/01-sifirla.sql dosyasini calistirin, sonra bu dosyayi tekrar calistirin.', bad;
  end if;
end $$;

-- -------------------------------------------------------------
-- 0) ENUM'lar
-- -------------------------------------------------------------
do $$ begin
  create type user_role as enum ('user', 'editor', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type anime_status as enum ('airing', 'finished', 'upcoming');
exception when duplicate_object then null; end $$;

do $$ begin
  create type video_source as enum ('mux', 'cloudinary', 'embed', 'hls');
exception when duplicate_object then null; end $$;

-- -------------------------------------------------------------
-- 1) PROFILES  (auth.users 1-1)
-- -------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  username    text unique,
  full_name   text,
  avatar_url  text,
  role        user_role not null default 'user',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Yeni kayıt olan her kullanıcı için otomatik profil
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'user_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS'te sonsuz döngüyü önlemek için SECURITY DEFINER yardımcı fonksiyon.
-- (profiles politikası içinde profiles'ı sorgulamak recursion hatası verir.)
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- -------------------------------------------------------------
-- 2) ANIMES
-- -------------------------------------------------------------
create table if not exists public.animes (
  id              uuid primary key default gen_random_uuid(),
  mal_id          integer unique,                 -- Jikan / MyAnimeList ID
  slug            text unique not null,
  title           text not null,
  title_english   text,
  title_japanese  text,
  synopsis        text,
  poster_url      text,                           -- Supabase Storage veya MAL CDN
  banner_url      text,
  trailer_url     text,
  type            text,                           -- TV / Movie / OVA / ONA
  status          anime_status default 'finished',
  season          text,                           -- winter / spring / summer / fall
  year            integer,
  total_episodes  integer default 0,
  duration_min    integer,
  score           numeric(4,2),
  rating          text,                           -- PG-13, R-17 vb.
  studios         text[] default '{}',
  is_published    boolean not null default true,
  is_featured     boolean not null default false, -- anasayfa hero
  view_count      bigint not null default 0,

  -- SEO alanları (admin panelinden düzenlenebilir)
  meta_title       text,
  meta_description text,
  og_image_url     text,

  synced_at   timestamptz,                        -- son Jikan senkronu
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists animes_slug_idx        on public.animes (slug);
create index if not exists animes_mal_id_idx      on public.animes (mal_id);
create index if not exists animes_featured_idx    on public.animes (is_featured) where is_featured;
create index if not exists animes_published_idx   on public.animes (is_published, score desc nulls last);
create index if not exists animes_title_trgm_idx  on public.animes using gin (title gin_trgm_ops);

-- -------------------------------------------------------------
-- 3) GENRES  +  ANIME_GENRES (n-n)
-- -------------------------------------------------------------
create table if not exists public.genres (
  id      uuid primary key default gen_random_uuid(),
  mal_id  integer unique,
  name    text not null unique,
  slug    text not null unique
);

create table if not exists public.anime_genres (
  anime_id uuid references public.animes(id) on delete cascade,
  genre_id uuid references public.genres(id) on delete cascade,
  primary key (anime_id, genre_id)
);

create index if not exists anime_genres_genre_idx on public.anime_genres (genre_id);

-- -------------------------------------------------------------
-- 4) EPISODES
-- -------------------------------------------------------------
create table if not exists public.episodes (
  id             uuid primary key default gen_random_uuid(),
  anime_id       uuid not null references public.animes(id) on delete cascade,
  mal_episode_id integer,
  number         integer not null,
  title          text,
  synopsis       text,
  thumbnail_url  text,
  duration_sec   integer,

  -- Video kaynağı: Mux playback id, Cloudinary public id ya da embed URL
  source         video_source not null default 'embed',
  video_url      text,
  mux_playback_id text,

  air_date       date,
  is_published   boolean not null default true,
  view_count     bigint not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (anime_id, number)
);

create index if not exists episodes_anime_idx on public.episodes (anime_id, number);

-- -------------------------------------------------------------
-- 5) İZLEME LİSTESİ + İLERLEME
-- -------------------------------------------------------------
create table if not exists public.watchlist (
  user_id    uuid references public.profiles(id) on delete cascade,
  anime_id   uuid references public.animes(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, anime_id)
);

create table if not exists public.watch_progress (
  user_id      uuid references public.profiles(id) on delete cascade,
  episode_id   uuid references public.episodes(id) on delete cascade,
  position_sec integer not null default 0,
  completed    boolean not null default false,
  updated_at   timestamptz not null default now(),
  primary key (user_id, episode_id)
);

-- -------------------------------------------------------------
-- 6) updated_at otomatik güncelleme
-- -------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

do $$
declare t text;
begin
  foreach t in array array['profiles','animes','episodes'] loop
    execute format('drop trigger if exists trg_touch_%1$s on public.%1$s', t);
    execute format(
      'create trigger trg_touch_%1$s before update on public.%1$s
       for each row execute function public.touch_updated_at()', t);
  end loop;
end $$;

-- -------------------------------------------------------------
-- 7) ROW LEVEL SECURITY
-- -------------------------------------------------------------
alter table public.profiles       enable row level security;
alter table public.animes         enable row level security;
alter table public.genres         enable row level security;
alter table public.anime_genres   enable row level security;
alter table public.episodes       enable row level security;
alter table public.watchlist      enable row level security;
alter table public.watch_progress enable row level security;

-- PROFILES ---------------------------------------------------
drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin" on public.profiles
  for select using (auth.uid() = id or public.is_admin());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "profiles_admin_all" on public.profiles;
create policy "profiles_admin_all" on public.profiles
  for all using (public.is_admin()) with check (public.is_admin());

-- ANIMES / GENRES / EPISODES: herkes okur, sadece admin yazar ----
drop policy if exists "animes_public_read" on public.animes;
create policy "animes_public_read" on public.animes
  for select using (is_published or public.is_admin());

drop policy if exists "animes_admin_write" on public.animes;
create policy "animes_admin_write" on public.animes
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "episodes_public_read" on public.episodes;
create policy "episodes_public_read" on public.episodes
  for select using (is_published or public.is_admin());

drop policy if exists "episodes_admin_write" on public.episodes;
create policy "episodes_admin_write" on public.episodes
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "genres_public_read" on public.genres;
create policy "genres_public_read" on public.genres for select using (true);
drop policy if exists "genres_admin_write" on public.genres;
create policy "genres_admin_write" on public.genres
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "anime_genres_public_read" on public.anime_genres;
create policy "anime_genres_public_read" on public.anime_genres for select using (true);
drop policy if exists "anime_genres_admin_write" on public.anime_genres;
create policy "anime_genres_admin_write" on public.anime_genres
  for all using (public.is_admin()) with check (public.is_admin());

-- KULLANICIYA ÖZEL TABLOLAR ----------------------------------
drop policy if exists "watchlist_own" on public.watchlist;
create policy "watchlist_own" on public.watchlist
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "watch_progress_own" on public.watch_progress;
create policy "watch_progress_own" on public.watch_progress
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- -------------------------------------------------------------
-- 8) STORAGE BUCKET (afişler / thumbnail'lar)
-- -------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('anime-images', 'anime-images', true)
on conflict (id) do nothing;

drop policy if exists "anime_images_public_read" on storage.objects;
create policy "anime_images_public_read" on storage.objects
  for select using (bucket_id = 'anime-images');

drop policy if exists "anime_images_admin_write" on storage.objects;
create policy "anime_images_admin_write" on storage.objects
  for all using (bucket_id = 'anime-images' and public.is_admin())
  with check (bucket_id = 'anime-images' and public.is_admin());

-- -------------------------------------------------------------
-- 9) RPC: görüntülenme sayacı (RLS'i baypas eden güvenli artış)
-- -------------------------------------------------------------
create or replace function public.increment_episode_view(p_episode_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  update public.episodes set view_count = view_count + 1 where id = p_episode_id;
  update public.animes a set view_count = a.view_count + 1
    from public.episodes e where e.id = p_episode_id and a.id = e.anime_id;
end $$;

grant execute on function public.increment_episode_view(uuid) to anon, authenticated;

-- -------------------------------------------------------------
-- 10) GERİ DOLDURMA
--     `handle_new_user` trigger'ı yalnızca YENİ kayıtlarda çalışır.
--     Şemayı kurmadan önce zaten kayıt olmuş kullanıcılar varsa
--     profilleri burada oluşturulur.
-- -------------------------------------------------------------
insert into public.profiles (id, username)
select u.id, coalesce(u.raw_user_meta_data->>'user_name', split_part(u.email, '@', 1))
from auth.users u
on conflict (id) do nothing;

-- =============================================================
--  KURULUM SONRASI: kendini admin yap
--  (Auth > Users'tan e-postanla kayıt olduktan sonra çalıştır)
-- =============================================================
-- update public.profiles set role = 'admin'
-- where id = (select id from auth.users where email = 'finance@gravantlabs.com');
