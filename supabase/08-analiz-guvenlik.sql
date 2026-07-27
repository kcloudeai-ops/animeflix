-- =============================================================
--  ANALİZ + GÜVENLİK
--  Yönetim paneli için sayfa görüntüleme takibi ve denetim günlüğü.
--  Supabase → SQL Editor → yapıştır → Run. Idempotent.
-- =============================================================

-- -------------------------------------------------------------
-- 1) SAYFA GÖRÜNTÜLEMELERİ (analiz)
--    Kişisel veri saklamaz: anonim session_id + yol + süre.
--    IP/isim yok — KVKK açısından temiz.
-- -------------------------------------------------------------
create table if not exists public.page_views (
  id           bigint generated always as identity primary key,
  session_id   text not null,          -- tarayıcıda üretilen anonim kimlik
  user_id      uuid references public.profiles(id) on delete set null,
  path         text not null,
  referrer     text,
  duration_sec integer not null default 0,
  created_at   timestamptz not null default now()
);

-- Panel sorguları: zamana ve yola göre
create index if not exists page_views_created_idx on public.page_views (created_at desc);
create index if not exists page_views_path_idx    on public.page_views (path);
create index if not exists page_views_session_idx on public.page_views (session_id, created_at desc);

-- -------------------------------------------------------------
-- 2) DENETİM GÜNLÜĞÜ (güvenlik)
--    Admin işlemleri: içe aktarma, silme, yayın, video ekleme…
-- -------------------------------------------------------------
create table if not exists public.admin_audit (
  id         bigint generated always as identity primary key,
  admin_id   uuid references public.profiles(id) on delete set null,
  action     text not null,            -- "anime_import", "anime_delete" …
  detail     jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_created_idx on public.admin_audit (created_at desc);

-- -------------------------------------------------------------
-- 3) profiles: son görülme (günlük aktif kullanıcı için)
-- -------------------------------------------------------------
alter table public.profiles
  add column if not exists last_seen_at timestamptz;

-- -------------------------------------------------------------
-- 4) RLS
-- -------------------------------------------------------------
alter table public.page_views  enable row level security;
alter table public.admin_audit enable row level security;

-- page_views: HERKES kendi görüntülemesini EKLEYEBİLİR ama kimse OKUYAMAZ
-- (yalnızca admin okur). Insert-only desen — analiz için standart.
drop policy if exists "page_views_insert_any" on public.page_views;
create policy "page_views_insert_any" on public.page_views
  for insert with check (true);

drop policy if exists "page_views_admin_read" on public.page_views;
create policy "page_views_admin_read" on public.page_views
  for select using (public.is_admin());

-- admin_audit: yalnızca admin okur ve yazar
drop policy if exists "admin_audit_admin_read" on public.admin_audit;
create policy "admin_audit_admin_read" on public.admin_audit
  for select using (public.is_admin());

drop policy if exists "admin_audit_admin_write" on public.admin_audit;
create policy "admin_audit_admin_write" on public.admin_audit
  for insert with check (public.is_admin());

-- -------------------------------------------------------------
-- 5) Panel özet fonksiyonları (SECURITY DEFINER — hızlı sayımlar)
--    Yalnızca admin çağırabilsin diye gövdede is_admin() kontrolü var.
-- -------------------------------------------------------------
create or replace function public.analytics_ozet()
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare sonuc jsonb;
begin
  if not public.is_admin() then
    raise exception 'yetki yok';
  end if;

  select jsonb_build_object(
    'bugun_goruntuleme', (select count(*) from page_views where created_at >= current_date),
    'bugun_ziyaretci',   (select count(distinct session_id) from page_views where created_at >= current_date),
    'aktif_5dk',         (select count(distinct session_id) from page_views where created_at >= now() - interval '5 minutes'),
    'aktif_uye_5dk',     (select count(distinct user_id) from page_views where user_id is not null and created_at >= now() - interval '5 minutes'),
    'ort_sure',          (select coalesce(round(avg(duration_sec)),0) from page_views where created_at >= current_date and duration_sec > 0),
    'gunluk_uye',        (select count(*) from profiles where last_seen_at >= current_date)
  ) into sonuc;

  return sonuc;
end $$;

grant execute on function public.analytics_ozet() to authenticated;

-- -------------------------------------------------------------
-- 6) Kontrol
-- -------------------------------------------------------------
select
  (select count(*) from information_schema.tables where table_schema='public' and table_name='page_views')  as page_views,
  (select count(*) from information_schema.tables where table_schema='public' and table_name='admin_audit') as admin_audit,
  (select count(*) from information_schema.columns where table_name='profiles' and column_name='last_seen_at') as last_seen;
