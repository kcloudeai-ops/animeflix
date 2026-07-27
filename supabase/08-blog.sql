-- =============================================================
--  BLOG / HABER
--  Supabase → SQL Editor → yapıştır → Run. Idempotent.
-- =============================================================

create table if not exists public.blog_posts (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  title       text not null,
  excerpt     text,                       -- kısa özet (liste + meta description)
  content     text not null,              -- Markdown gövde
  cover_url   text,
  author_id   uuid references public.profiles(id) on delete set null,
  tags        text[] default '{}',
  is_published boolean not null default false,
  published_at timestamptz,
  view_count   bigint not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists blog_posts_published_idx
  on public.blog_posts (is_published, published_at desc)
  where is_published;

create index if not exists blog_posts_slug_idx on public.blog_posts (slug);

-- updated_at otomatik
drop trigger if exists trg_touch_blog on public.blog_posts;
create trigger trg_touch_blog
  before update on public.blog_posts
  for each row execute function public.touch_updated_at();

-- -------------------------------------------------------------
--  RLS: yayınlanmışı herkes okur, yalnızca admin yazar
-- -------------------------------------------------------------
alter table public.blog_posts enable row level security;

drop policy if exists "blog_public_read" on public.blog_posts;
create policy "blog_public_read" on public.blog_posts
  for select using (is_published or public.is_admin());

drop policy if exists "blog_admin_write" on public.blog_posts;
create policy "blog_admin_write" on public.blog_posts
  for all using (public.is_admin()) with check (public.is_admin());

-- Kontrol
select count(*) as blog_posts_tablo
from information_schema.tables
where table_schema = 'public' and table_name = 'blog_posts';
