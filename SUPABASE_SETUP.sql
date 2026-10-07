-- ============================================================================
-- FINAL CONSOLIDATED SUPABASE SQL — STAGE88
-- Safe for an existing database that already contains newer admin permissions.
-- This version fixes ERROR 23514 on admin_users_permissions_check by normalizing
-- legacy/current permission values before constraints are re-applied.
-- ============================================================================

-- Flower Light / بصائر الخليج
-- FINAL SUPABASE MASTER SQL — STAGE88
-- Generated: 2026-09-16
-- Purpose: one consolidated, non-destructive schema/security file for the current website release.
--
-- IMPORTANT:
-- * This file does NOT delete products, categories, contacts, customer leads, quotations, or catalogs.
-- * It intentionally excludes the old CLEAR_CATALOG_ONCE.sql destructive script.
-- * On an EXISTING database, run this file as-is. Existing owner/admin data is preserved.
-- * On a BRAND-NEW database, first create the owner in Supabase Authentication, then replace
--   OWNER_EMAIL_HERE near the end of this file with that email and run/re-run the file.
-- * The old independent panel-password system is not used.


-- ###########################################################################
-- BASE CATALOG
-- ###########################################################################

-- Flower Light product catalog - Supabase setup
-- Run this ONCE in Supabase Dashboard > SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text not null default '',
  sort_order integer not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete cascade,
  name text not null,
  model text not null default '',
  caption text not null default '',
  image_path text not null default '',
  sort_order integer not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists products_category_id_idx on public.products(category_id);
create index if not exists categories_sort_order_idx on public.categories(sort_order);
create index if not exists products_sort_order_idx on public.products(category_id, sort_order);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists categories_set_updated_at on public.categories;
create trigger categories_set_updated_at
before update on public.categories
for each row execute function public.set_updated_at();

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
before update on public.products
for each row execute function public.set_updated_at();

alter table public.categories enable row level security;
alter table public.products enable row level security;

-- Visitors can read visible data. A signed-in administrator can also see hidden rows.
drop policy if exists "Public read visible categories" on public.categories;
create policy "Public read visible categories"
on public.categories for select
to anon, authenticated
using (is_visible = true or (select auth.uid()) is not null);

drop policy if exists "Public read visible products" on public.products;
create policy "Public read visible products"
on public.products for select
to anon, authenticated
using (is_visible = true or (select auth.uid()) is not null);

-- Only authenticated users can change catalog data.
-- For this small single-admin project, disable public sign-ups in Supabase Auth.
drop policy if exists "Authenticated insert categories" on public.categories;
create policy "Authenticated insert categories"
on public.categories for insert
to authenticated
with check ((select auth.uid()) is not null);

drop policy if exists "Authenticated update categories" on public.categories;
create policy "Authenticated update categories"
on public.categories for update
to authenticated
using ((select auth.uid()) is not null)
with check ((select auth.uid()) is not null);

drop policy if exists "Authenticated delete categories" on public.categories;
create policy "Authenticated delete categories"
on public.categories for delete
to authenticated
using ((select auth.uid()) is not null);

drop policy if exists "Authenticated insert products" on public.products;
create policy "Authenticated insert products"
on public.products for insert
to authenticated
with check ((select auth.uid()) is not null);

drop policy if exists "Authenticated update products" on public.products;
create policy "Authenticated update products"
on public.products for update
to authenticated
using ((select auth.uid()) is not null)
with check ((select auth.uid()) is not null);

drop policy if exists "Authenticated delete products" on public.products;
create policy "Authenticated delete products"
on public.products for delete
to authenticated
using ((select auth.uid()) is not null);

-- Public image bucket for catalog images.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  5242880,
  array['image/jpeg','image/png','image/webp','image/gif']
)
on conflict (id) do update set
  public = true,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- A public bucket serves images publicly. Upload/update/delete still require policies.
drop policy if exists "Authenticated upload product images" on storage.objects;
create policy "Authenticated upload product images"
on storage.objects for insert
to authenticated
with check (bucket_id = 'product-images' and (select auth.uid()) is not null);

drop policy if exists "Authenticated update product images" on storage.objects;
create policy "Authenticated update product images"
on storage.objects for update
to authenticated
using (bucket_id = 'product-images' and (select auth.uid()) is not null)
with check (bucket_id = 'product-images' and (select auth.uid()) is not null);

drop policy if exists "Authenticated delete product images" on storage.objects;
create policy "Authenticated delete product images"
on storage.objects for delete
to authenticated
using (bucket_id = 'product-images' and (select auth.uid()) is not null);



-- ###########################################################################
-- SITE PROFILE + CONTACT ITEMS
-- ###########################################################################

-- إضافة بيانات البطاقة ووسائل التواصل إلى مشروع Supabase الحالي
-- شغّل هذا الملف مرة واحدة فقط من SQL Editor.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.site_profile (
  id smallint primary key default 1 check (id = 1),
  full_name text not null default '',
  brand_name text not null default '',
  company_name text not null default '',
  job_title_ar text not null default '',
  job_title_en text not null default '',
  logo_path text not null default '',
  portrait_path text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.contact_items (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('phone','whatsapp','website','email','location')),
  label text not null default '',
  value text not null,
  sort_order integer not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists contact_items_sort_order_idx
on public.contact_items(sort_order, created_at);

-- إعادة استخدام دالة updated_at التي أنشأناها سابقًا.
drop trigger if exists site_profile_set_updated_at on public.site_profile;
create trigger site_profile_set_updated_at
before update on public.site_profile
for each row execute function public.set_updated_at();

drop trigger if exists contact_items_set_updated_at on public.contact_items;
create trigger contact_items_set_updated_at
before update on public.contact_items
for each row execute function public.set_updated_at();

alter table public.site_profile enable row level security;
alter table public.contact_items enable row level security;

-- بيانات البطاقة عامة للقراءة لأنها تظهر أصلًا في الموقع.
drop policy if exists "Public read site profile" on public.site_profile;
create policy "Public read site profile"
on public.site_profile for select
to anon, authenticated
using (true);

-- الزائر يرى وسائل التواصل الظاهرة فقط، والمدير يرى الكل.
drop policy if exists "Public read visible contacts" on public.contact_items;
create policy "Public read visible contacts"
on public.contact_items for select
to anon, authenticated
using (is_visible = true or (select auth.uid()) is not null);

-- المدير المسجل فقط يستطيع إنشاء أو تعديل بيانات البطاقة.
drop policy if exists "Authenticated insert site profile" on public.site_profile;
create policy "Authenticated insert site profile"
on public.site_profile for insert
to authenticated
with check ((select auth.uid()) is not null and id = 1);

drop policy if exists "Authenticated update site profile" on public.site_profile;
create policy "Authenticated update site profile"
on public.site_profile for update
to authenticated
using ((select auth.uid()) is not null)
with check ((select auth.uid()) is not null and id = 1);

drop policy if exists "Authenticated delete site profile" on public.site_profile;
create policy "Authenticated delete site profile"
on public.site_profile for delete
to authenticated
using ((select auth.uid()) is not null);

-- المدير المسجل فقط يستطيع إدارة وسائل التواصل.
drop policy if exists "Authenticated insert contacts" on public.contact_items;
create policy "Authenticated insert contacts"
on public.contact_items for insert
to authenticated
with check ((select auth.uid()) is not null);

drop policy if exists "Authenticated update contacts" on public.contact_items;
create policy "Authenticated update contacts"
on public.contact_items for update
to authenticated
using ((select auth.uid()) is not null)
with check ((select auth.uid()) is not null);

drop policy if exists "Authenticated delete contacts" on public.contact_items;
create policy "Authenticated delete contacts"
on public.contact_items for delete
to authenticated
using ((select auth.uid()) is not null);

-- لا نضيف أي بيانات افتراضية هنا.
-- أول سجل للبيانات الشخصية وأول وسيلة تواصل ينشئهما الأدمن من لوحة التحكم.



-- ###########################################################################
-- CUSTOMER LEADS
-- ###########################################################################

-- ---------------------------------------------------------------------------
-- CUSTOMER LEADS — current schema (no hard-coded admin UID)
-- ---------------------------------------------------------------------------
create table if not exists public.customer_leads (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(trim(full_name)) between 2 and 120),
  company_name text default '',
  mobile text not null check (char_length(trim(mobile)) between 7 and 30),
  created_at timestamptz not null default now()
);

create index if not exists customer_leads_created_at_idx
on public.customer_leads(created_at desc);

alter table public.customer_leads enable row level security;



-- ###########################################################################
-- ANALYTICS V5.1 + ADMIN BASE
-- ###########################################################################

-- Flower Light Analytics V5.1
-- Run once in Supabase > SQL Editor > New query > Run
-- Improvements:
-- 1) Role-based admin access via admin_users (no UID repeated in policies/functions)
-- 2) First-party analytics through a validated RPC (no direct anonymous table inserts)
-- 3) FILTER aggregation in one reporting query
-- 4) Unified categories + locations aggregation
-- 5) Daily time-series data for the admin dashboard
-- 6) 180-day raw-event retention + daily archived rollups
-- 7) pg_cron is optional; dashboard access provides a safe maintenance fallback
-- 8) Rate-limit checks stop at the threshold instead of counting every matching row
--
-- Existing administrator is seeded once here. Add future admins by inserting their auth.users UUID
-- into public.admin_users; no policy/function edits are needed.

-- pg_cron is useful but optional. Some Supabase environments may not allow it.
-- Keep the rest of the upgrade working even when the extension cannot be enabled.
do $$
begin
  begin
    execute 'create extension if not exists pg_cron';
    raise notice 'pg_cron is available: automatic analytics retention can be scheduled.';
  exception
    when others then
      raise notice 'pg_cron is unavailable; continuing without it. Retention will still run as a dashboard fallback. Details: %', sqlerrm;
  end;
end $$;

-- -----------------------------------------------------------------------------
-- ADMIN ROLE TABLE
-- -----------------------------------------------------------------------------
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Owner bootstrap is handled at the end of this master file without a hard-coded UID.
alter table public.admin_users enable row level security;

create or replace function public.is_site_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users a
    where a.user_id = auth.uid()
  );
$$;

revoke all on function public.is_site_admin() from public, anon;
grant execute on function public.is_site_admin() to authenticated;

-- Admins can see the admin role list. Role changes are intentionally SQL-only.
drop policy if exists "Admins view admin users" on public.admin_users;
create policy "Admins view admin users"
on public.admin_users
for select
to authenticated
using (public.is_site_admin());

-- Remove any legacy write policy on the admin-managed public tables. Public SELECT
-- policies are intentionally kept so visible site data can still be read by visitors.
do $$
declare
  p record;
begin
  for p in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname='public'
      and tablename in ('categories','products','site_profile','contact_items')
      and cmd in ('ALL','INSERT','UPDATE','DELETE')
  loop
    execute format('drop policy if exists %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;

  -- Leads stay publicly insertable, but reading/updating/deleting is admin-only.
  for p in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname='public'
      and tablename='customer_leads'
      and cmd in ('ALL','SELECT','UPDATE','DELETE')
  loop
    execute format('drop policy if exists %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;

  -- Remove old product-images write policies before installing the role-based one.
  for p in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname='storage'
      and tablename='objects'
      and cmd in ('ALL','INSERT','UPDATE','DELETE')
      and (coalesce(qual,'') ilike '%product-images%' or coalesce(with_check,'') ilike '%product-images%')
  loop
    execute format('drop policy if exists %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
end $$;

-- RLS decides who can actually write; these grants allow the authenticated role
-- to reach the policy checks.
grant select, insert, update, delete on public.categories, public.products, public.site_profile, public.contact_items to authenticated;
grant select, insert, update, delete on public.customer_leads to authenticated;
grant insert on public.customer_leads to anon;
grant select on public.admin_users to authenticated;

-- Replace app write permissions with the reusable admin role check.
drop policy if exists "Admins manage categories" on public.categories;
create policy "Admins manage categories"
on public.categories for all to authenticated
using (public.is_site_admin())
with check (public.is_site_admin());

drop policy if exists "Admins manage products" on public.products;
create policy "Admins manage products"
on public.products for all to authenticated
using (public.is_site_admin())
with check (public.is_site_admin());

drop policy if exists "Admins manage site profile" on public.site_profile;
create policy "Admins manage site profile"
on public.site_profile for all to authenticated
using (public.is_site_admin())
with check (public.is_site_admin());

drop policy if exists "Admins manage contact items" on public.contact_items;
create policy "Admins manage contact items"
on public.contact_items for all to authenticated
using (public.is_site_admin())
with check (public.is_site_admin());

drop policy if exists "Public create customer lead" on public.customer_leads;
create policy "Public create customer lead"
on public.customer_leads
for insert
to anon, authenticated
with check (
  char_length(trim(full_name)) between 2 and 120
  and char_length(trim(company_name)) between 2 and 120
  and char_length(trim(mobile)) between 7 and 30
);

drop policy if exists "Admins manage customer leads" on public.customer_leads;
create policy "Admins manage customer leads"
on public.customer_leads for all to authenticated
using (public.is_site_admin())
with check (public.is_site_admin());

-- Keep product-images writes restricted to admins while preserving the public bucket/read setup.
drop policy if exists "Admins manage product images" on storage.objects;
create policy "Admins manage product images"
on storage.objects for all to authenticated
using (bucket_id = 'product-images' and public.is_site_admin())
with check (bucket_id = 'product-images' and public.is_site_admin());

-- -----------------------------------------------------------------------------
-- RAW ANALYTICS EVENTS
-- -----------------------------------------------------------------------------
create table if not exists public.analytics_events (
  id bigint generated by default as identity primary key,
  event_name text not null,
  event_label text not null default '',
  visitor_id text not null default '',
  session_id text not null default '',
  page_path text not null default '/',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint analytics_event_name_format check (event_name ~ '^[a-z0-9_]{2,64}$'),
  constraint analytics_event_label_length check (char_length(event_label) <= 180),
  constraint analytics_visitor_id_length check (char_length(visitor_id) <= 80),
  constraint analytics_session_id_length check (char_length(session_id) <= 80),
  constraint analytics_page_path_length check (char_length(page_path) <= 300),
  constraint analytics_metadata_size check (octet_length(metadata::text) <= 4000)
);

create index if not exists analytics_events_created_at_idx
on public.analytics_events(created_at desc);

create index if not exists analytics_events_name_created_idx
on public.analytics_events(event_name, created_at desc);

create index if not exists analytics_events_label_created_idx
on public.analytics_events(event_name, event_label, created_at desc);

create index if not exists analytics_events_session_created_idx
on public.analytics_events(session_id, created_at desc);

create index if not exists analytics_events_visitor_created_idx
on public.analytics_events(visitor_id, created_at desc);

alter table public.analytics_events enable row level security;

-- Visitors no longer insert directly into the table; they use log_site_event().
-- Remove any older direct-write policy regardless of its old name.
do $$
declare
  p record;
begin
  for p in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname='public'
      and tablename='analytics_events'
      and cmd in ('ALL','INSERT','UPDATE')
  loop
    execute format('drop policy if exists %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
end $$;

drop policy if exists "Public create analytics event" on public.analytics_events;
drop policy if exists "Admin read analytics events" on public.analytics_events;
drop policy if exists "Admin delete analytics events" on public.analytics_events;
drop policy if exists "Admins read analytics events" on public.analytics_events;
drop policy if exists "Admins delete analytics events" on public.analytics_events;

create policy "Admins read analytics events"
on public.analytics_events for select to authenticated
using (public.is_site_admin());

create policy "Admins delete analytics events"
on public.analytics_events for delete to authenticated
using (public.is_site_admin());

revoke insert, update on table public.analytics_events from anon, authenticated;
revoke select, delete on table public.analytics_events from anon;
grant select, delete on table public.analytics_events to authenticated;

-- Validated public logging endpoint. This narrows accepted event names and applies
-- lightweight per-session throttling to reduce accidental/bot flooding.
create or replace function public.log_site_event(
  p_event_name text,
  p_event_label text default '',
  p_visitor_id text default '',
  p_session_id text default '',
  p_page_path text default '/',
  p_metadata jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event text := lower(trim(coalesce(p_event_name,'')));
  v_label text := left(trim(coalesce(p_event_label,'')),180);
  v_visitor text := left(trim(coalesce(p_visitor_id,'')),80);
  v_session text := left(trim(coalesce(p_session_id,'')),80);
  v_path text := left(coalesce(nullif(trim(p_page_path),''),'/'),300);
  v_meta jsonb := coalesce(p_metadata,'{}'::jsonb);
begin
  if v_event not in (
    'page_view',
    'products_open',
    'product_category_view',
    'product_image_open',
    'product_gallery_navigation',
    'product_whatsapp_click',
    'catalog_download',
    'contact_phone',
    'contact_whatsapp',
    'contact_location',
    'customer_lead_saved',
    'save_contact'
  ) then
    return false;
  end if;

  if char_length(v_visitor) < 8 or char_length(v_session) < 8 then
    return false;
  end if;

  if jsonb_typeof(v_meta) is distinct from 'object' or octet_length(v_meta::text) > 4000 then
    v_meta := '{}'::jsonb;
  end if;

  -- Hard ceiling for one browser session.
  -- OFFSET 119 lets PostgreSQL stop as soon as the 120th matching row exists,
  -- instead of counting every event in the one-minute window.
  if exists (
    select 1
    from public.analytics_events e
    where e.session_id = v_session
      and e.created_at >= now() - interval '1 minute'
    order by e.created_at desc
    offset 119
    limit 1
  ) then
    return false;
  end if;

  -- A second best-effort ceiling by visitor id reduces accidental flooding
  -- if a browser session id is regenerated while the visitor id stays stable.
  -- These browser-provided identifiers are not a substitute for server/IP-level
  -- abuse protection, but they keep normal analytics traffic inexpensive.
  if exists (
    select 1
    from public.analytics_events e
    where e.visitor_id = v_visitor
      and e.created_at >= now() - interval '1 minute'
    order by e.created_at desc
    offset 239
    limit 1
  ) then
    return false;
  end if;

  -- Ignore exact duplicate taps/events within one second.
  if exists (
    select 1
    from public.analytics_events e
    where e.session_id = v_session
      and e.event_name = v_event
      and e.event_label = v_label
      and e.created_at >= now() - interval '1 second'
  ) then
    return false;
  end if;

  insert into public.analytics_events(
    event_name,event_label,visitor_id,session_id,page_path,metadata
  ) values (
    v_event,v_label,v_visitor,v_session,v_path,v_meta
  );

  return true;
end;
$$;

revoke all on function public.log_site_event(text,text,text,text,text,jsonb) from public;
grant execute on function public.log_site_event(text,text,text,text,text,jsonb) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- DAILY ARCHIVE / RETENTION
-- -----------------------------------------------------------------------------
create table if not exists public.analytics_daily (
  day date not null,
  event_name text not null,
  event_label text not null default '',
  event_count bigint not null default 0 check (event_count >= 0),
  unique_visitors bigint not null default 0 check (unique_visitors >= 0),
  unique_sessions bigint not null default 0 check (unique_sessions >= 0),
  primary key (day, event_name, event_label)
);

create index if not exists analytics_daily_event_day_idx
on public.analytics_daily(event_name, day desc);

alter table public.analytics_daily enable row level security;

drop policy if exists "Admins read analytics daily" on public.analytics_daily;
drop policy if exists "Admins delete analytics daily" on public.analytics_daily;

create policy "Admins read analytics daily"
on public.analytics_daily for select to authenticated
using (public.is_site_admin());

create policy "Admins delete analytics daily"
on public.analytics_daily for delete to authenticated
using (public.is_site_admin());

revoke all on table public.analytics_daily from anon;
grant select, delete on table public.analytics_daily to authenticated;

create or replace function public.maintain_analytics_retention(p_keep_days integer default 180)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_keep integer := greatest(coalesce(p_keep_days,180),30);
  v_today date := (now() at time zone 'Asia/Riyadh')::date;
  v_cutoff_day date;
  v_cutoff_ts timestamptz;
  v_archived bigint := 0;
  v_deleted bigint := 0;
begin
  v_cutoff_day := v_today - v_keep;
  v_cutoff_ts := (v_cutoff_day::timestamp at time zone 'Asia/Riyadh');

  insert into public.analytics_daily(day,event_name,event_label,event_count,unique_visitors,unique_sessions)
  select
    (e.created_at at time zone 'Asia/Riyadh')::date as day,
    e.event_name,
    e.event_label,
    count(*)::bigint,
    count(distinct nullif(e.visitor_id,''))::bigint,
    count(distinct nullif(e.session_id,''))::bigint
  from public.analytics_events e
  where e.created_at < v_cutoff_ts
  group by 1,2,3
  on conflict (day,event_name,event_label) do update
  set event_count = excluded.event_count,
      unique_visitors = excluded.unique_visitors,
      unique_sessions = excluded.unique_sessions;

  get diagnostics v_archived = row_count;

  delete from public.analytics_events e
  where e.created_at < v_cutoff_ts;

  get diagnostics v_deleted = row_count;

  return jsonb_build_object(
    'keep_days',v_keep,
    'cutoff_day',v_cutoff_day,
    'archive_rows_written',v_archived,
    'raw_rows_deleted',v_deleted
  );
end;
$$;

revoke all on function public.maintain_analytics_retention(integer) from public, anon, authenticated;

-- Try to schedule daily retention only when pg_cron is actually available.
-- Dynamic SQL avoids hard references to the cron schema when the extension is absent.
do $$
declare
  v_has_cron boolean := false;
begin
  select exists (
    select 1
    from pg_namespace n
    join pg_proc p on p.pronamespace = n.oid
    where n.nspname = 'cron'
      and p.proname = 'schedule'
  ) into v_has_cron;

  if v_has_cron then
    begin
      -- Remove the old named job first so rerunning this upgrade stays idempotent.
      execute $sql$
        select cron.unschedule(jobid)
        from cron.job
        where jobname = 'flower-light-analytics-retention'
      $sql$;
    exception
      when others then
        raise notice 'Could not remove an existing retention job; continuing: %', sqlerrm;
    end;

    begin
      execute $sql$
        select cron.schedule(
          'flower-light-analytics-retention',
          '25 2 * * *',
          'select public.maintain_analytics_retention(180);'
        )
      $sql$;
      raise notice 'Automatic analytics retention scheduled with pg_cron.';
    exception
      when others then
        raise notice 'pg_cron exists but scheduling failed; dashboard fallback remains active. Details: %', sqlerrm;
    end;
  else
    raise notice 'pg_cron is not available. Dashboard fallback will maintain retention when an admin opens analytics.';
  end if;
end $$;

-- Apply retention once now. This is independent of pg_cron and is safe to rerun.
select public.maintain_analytics_retention(180);

-- -----------------------------------------------------------------------------
-- ONE-PASS ANALYTICS REPORT
-- -----------------------------------------------------------------------------
create or replace function public.get_site_analytics(p_days integer default 30)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := (now() at time zone 'Asia/Riyadh')::date;
  v_since timestamptz;
  v_since_day date;
  v_series_since_day date;
  v_result jsonb;
begin
  if not public.is_site_admin() then
    raise exception 'Not authorized';
  end if;

  -- Fallback maintenance: if pg_cron is unavailable or its job stops, opening
  -- the admin analytics dashboard still enforces the 180-day raw-data policy.
  -- The created_at index makes this existence check cheap when nothing is due.
  if exists (
    select 1
    from public.analytics_events e
    where e.created_at < (((v_today - 180)::timestamp) at time zone 'Asia/Riyadh')
    limit 1
  ) then
    perform public.maintain_analytics_retention(180);
  end if;

  if p_days is null or p_days <= 0 then
    v_since := '-infinity'::timestamptz;
    v_since_day := '-infinity'::date;
    -- Keep the chart readable even when totals are all-time.
    v_series_since_day := v_today - 89;
  else
    -- Calendar-day filters in Saudi time: 1 = today, 7 = today + previous 6 days.
    v_since_day := v_today - (greatest(p_days,1) - 1);
    v_since := (v_since_day::timestamp at time zone 'Asia/Riyadh');
    -- Cap the chart to 180 daily points; totals still use the full selected period.
    v_series_since_day := greatest(v_since_day, v_today - 179);
  end if;

  with
  raw_events as materialized (
    select e.*,
           (e.created_at at time zone 'Asia/Riyadh')::date as local_day
    from public.analytics_events e
    where e.created_at >= v_since
  ),
  raw_daily as materialized (
    select
      local_day as day,
      event_name,
      event_label,
      count(*)::bigint as event_count,
      count(distinct nullif(visitor_id,''))::bigint as unique_visitors,
      count(distinct nullif(session_id,''))::bigint as unique_sessions
    from raw_events
    group by local_day,event_name,event_label
  ),
  archive_daily as materialized (
    select day,event_name,event_label,event_count,unique_visitors,unique_sessions
    from public.analytics_daily
    where day >= v_since_day
  ),
  combined_daily as materialized (
    select
      day,event_name,event_label,
      sum(event_count)::bigint as event_count,
      sum(unique_visitors)::bigint as unique_visitors,
      sum(unique_sessions)::bigint as unique_sessions
    from (
      select * from archive_daily
      union all
      select * from raw_daily
    ) x
    group by day,event_name,event_label
  ),
  summary as (
    select
      coalesce(sum(event_count) filter (where event_name='page_view'),0)::bigint as total_visits,
      coalesce(sum(event_count) filter (where event_name='products_open'),0)::bigint as products_open,
      coalesce(sum(event_count) filter (where event_name='catalog_download'),0)::bigint as catalog_downloads,
      coalesce(sum(event_count) filter (where event_name in ('contact_whatsapp','product_whatsapp_click')),0)::bigint as whatsapp_clicks,
      coalesce(sum(event_count) filter (where event_name='contact_phone'),0)::bigint as phone_clicks,
      coalesce(sum(event_count) filter (where event_name='contact_location'),0)::bigint as location_clicks,
      coalesce(sum(event_count) filter (where event_name='customer_lead_saved'),0)::bigint as lead_submissions,
      coalesce(sum(event_count) filter (where event_name='save_contact'),0)::bigint as saved_contacts
    from combined_daily
  ),
  archive_presence as (
    select exists(select 1 from archive_daily) as has_archive
  ),
  unique_calc as (
    select
      case
        when ap.has_archive then coalesce((
          select sum(unique_visitors)::bigint
          from combined_daily
          where event_name='page_view'
        ),0)
        else coalesce((
          select count(distinct nullif(visitor_id,''))::bigint
          from raw_events
          where event_name='page_view'
        ),0)
      end as unique_visitors,
      ap.has_archive as is_approx
    from archive_presence ap
  ),
  breakdown_rows as materialized (
    select event_name,event_label,sum(event_count)::bigint as cnt
    from combined_daily
    where event_name in ('product_category_view','contact_location')
      and trim(event_label) <> ''
    group by event_name,event_label
  ),
  breakdown as (
    select jsonb_build_object(
      'categories', coalesce(
        jsonb_agg(jsonb_build_object('label',event_label,'count',cnt) order by cnt desc,event_label)
          filter (where event_name='product_category_view'),
        '[]'::jsonb
      ),
      'locations', coalesce(
        jsonb_agg(jsonb_build_object('label',event_label,'count',cnt) order by cnt desc,event_label)
          filter (where event_name='contact_location'),
        '[]'::jsonb
      )
    ) as payload
    from breakdown_rows
  ),
  series_counts as materialized (
    select
      day,
      coalesce(sum(event_count) filter (where event_name='page_view'),0)::bigint as visits,
      coalesce(sum(event_count) filter (where event_name='products_open'),0)::bigint as products_open,
      coalesce(sum(event_count) filter (where event_name='catalog_download'),0)::bigint as catalog_downloads,
      coalesce(sum(event_count) filter (where event_name='customer_lead_saved'),0)::bigint as lead_submissions
    from combined_daily
    where day >= v_series_since_day
    group by day
  ),
  series as (
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'day',d.day,
        'visits',coalesce(s.visits,0),
        'products_open',coalesce(s.products_open,0),
        'catalog_downloads',coalesce(s.catalog_downloads,0),
        'lead_submissions',coalesce(s.lead_submissions,0)
      ) order by d.day
    ),'[]'::jsonb) as payload
    from generate_series(v_series_since_day,v_today,interval '1 day') as g(ts)
    cross join lateral (select g.ts::date as day) d
    left join series_counts s on s.day=d.day
  )
  select jsonb_build_object(
    'total_visits',s.total_visits,
    'unique_visitors',u.unique_visitors,
    'unique_visitors_is_approx',u.is_approx,
    'products_open',s.products_open,
    'catalog_downloads',s.catalog_downloads,
    'whatsapp_clicks',s.whatsapp_clicks,
    'phone_clicks',s.phone_clicks,
    'location_clicks',s.location_clicks,
    'lead_submissions',s.lead_submissions,
    'saved_contacts',s.saved_contacts,
    'categories',b.payload->'categories',
    'locations',b.payload->'locations',
    'timeseries',ts.payload,
    'timeseries_from',v_series_since_day,
    'raw_retention_days',180
  )
  into v_result
  from summary s
  cross join unique_calc u
  cross join breakdown b
  cross join series ts;

  return v_result;
end;
$$;

revoke all on function public.get_site_analytics(integer) from public, anon;
grant execute on function public.get_site_analytics(integer) to authenticated;

-- Optional verification after running:
-- select public.is_site_admin();
-- select public.get_site_analytics(30);



-- ###########################################################################
-- PRODUCTS / GALLERY / QUOTATIONS
-- ###########################################################################

-- Flower Light / بصائر الخليج
-- Product management + quotations + flexible customer identity
-- Includes the current gallery/quotation features plus optional company on product entry and
-- individual/company customer type for quotation requests.
--
-- Run once in Supabase > SQL Editor > New query > Run.
-- Safe to re-run. This script includes the complete product specifications schema, so you do NOT
-- need to run an older product-specifications migration separately.

begin;

-- ===========================================================================
-- 1) PROFESSIONAL PRODUCT SPECIFICATIONS
-- ===========================================================================

alter table public.products
add column if not exists specifications jsonb not null default '[]'::jsonb;

-- Pricing / promotion fields used by the current product form and Excel importer.
-- Kept here (and in the idempotent migration) so a fresh database matches the UI schema.
alter table public.products
  add column if not exists price numeric(12,2),
  add column if not exists wholesale_price numeric(12,2),
  add column if not exists wholesale_min_qty integer,
  add column if not exists limited_offer boolean not null default false;

comment on column public.products.price is 'Retail price.';
comment on column public.products.wholesale_price is 'Wholesale price.';
comment on column public.products.wholesale_min_qty is 'Minimum quantity for wholesale price.';
comment on column public.products.limited_offer is 'Show limited-time offer badge.';

update public.products
set specifications = '[]'::jsonb
where specifications is null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'products_specifications_is_array'
      and conrelid = 'public.products'::regclass
  ) then
    alter table public.products
      add constraint products_specifications_is_array
      check (jsonb_typeof(specifications) = 'array');
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'products_specifications_size'
      and conrelid = 'public.products'::regclass
  ) then
    alter table public.products
      add constraint products_specifications_size
      check (octet_length(specifications::text) <= 16000);
  end if;
end $$;

comment on column public.products.specifications is
'Ordered product technical specifications. JSON array of {key,label,value,unit}.';

-- ===========================================================================
-- 2) PRODUCT IMAGE GALLERY (MAX 4 IMAGES / ONE PRIMARY)
-- ===========================================================================

create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  image_path text not null,
  sort_order integer not null default 0,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  constraint product_images_path_not_blank check (char_length(trim(image_path)) > 0)
);

create unique index if not exists product_images_product_path_uidx
on public.product_images(product_id, image_path);

create index if not exists product_images_product_sort_idx
on public.product_images(product_id, sort_order, created_at);

alter table public.product_images enable row level security;

-- Public visitors can read gallery metadata only for visible products.
drop policy if exists "Public read visible product images" on public.product_images;
create policy "Public read visible product images"
on public.product_images
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.products p
    where p.id = product_images.product_id
      and p.is_visible = true
  )
);

-- Only real site admins may edit image metadata.
drop policy if exists "Admins manage product images metadata" on public.product_images;
create policy "Admins manage product images metadata"
on public.product_images
for all
to authenticated
using (public.is_site_admin())
with check (public.is_site_admin());

revoke all on table public.product_images from anon, authenticated;
grant select on table public.product_images to anon;
grant select, insert, update, delete on table public.product_images to authenticated;

-- Seed the current products.image_path as the primary image when needed.
insert into public.product_images(product_id, image_path, sort_order, is_primary)
select p.id, p.image_path, 0, true
from public.products p
where trim(coalesce(p.image_path,'')) <> ''
on conflict (product_id, image_path) do nothing;

-- Normalize existing galleries so every product has at most one PRIMARY marker.
-- Prefer products.image_path, otherwise the already-primary row, otherwise first row.
with ranked as (
  select
    pi.id,
    row_number() over (
      partition by pi.product_id
      order by
        (pi.image_path = p.image_path) desc,
        pi.is_primary desc,
        pi.sort_order asc,
        pi.created_at asc,
        pi.id asc
    ) as rn
  from public.product_images pi
  join public.products p on p.id = pi.product_id
)
update public.product_images pi
set is_primary = (ranked.rn = 1)
from ranked
where ranked.id = pi.id
  and pi.is_primary is distinct from (ranked.rn = 1);

-- Database-level guarantee: never more than one primary image per product.
create unique index if not exists product_images_one_primary_uidx
on public.product_images(product_id)
where is_primary = true;

-- Database-level maximum of four images for all future inserts/moves.
create or replace function public.enforce_product_images_max_four()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_count integer;
begin
  if tg_op = 'UPDATE' and new.product_id = old.product_id then
    return new;
  end if;

  select count(*) into v_count
  from public.product_images pi
  where pi.product_id = new.product_id;

  if v_count >= 4 then
    raise exception 'A product can have at most 4 images.' using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists product_images_max_four on public.product_images;
create trigger product_images_max_four
before insert or update of product_id on public.product_images
for each row execute function public.enforce_product_images_max_four();

-- Atomically replace a product gallery and keep products.image_path synchronized
-- with the selected primary image.
create or replace function public.set_product_gallery(
  p_product_id uuid,
  p_image_paths text[],
  p_primary_path text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_distinct_count integer;
begin
  if not public.is_site_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  if not exists (select 1 from public.products p where p.id = p_product_id) then
    raise exception 'Product not found.' using errcode = 'P0002';
  end if;

  v_count := coalesce(cardinality(p_image_paths), 0);
  if v_count < 1 or v_count > 4 then
    raise exception 'Product gallery must contain between 1 and 4 images.' using errcode = '23514';
  end if;

  if exists (
    select 1 from unnest(p_image_paths) as x(path)
    where nullif(trim(path), '') is null
  ) then
    raise exception 'Image paths cannot be blank.' using errcode = '23514';
  end if;

  select count(distinct x.path) into v_distinct_count
  from unnest(p_image_paths) as x(path);

  if v_distinct_count <> v_count then
    raise exception 'Duplicate image paths are not allowed.' using errcode = '23514';
  end if;

  if nullif(trim(coalesce(p_primary_path,'')), '') is null
     or not (p_primary_path = any(p_image_paths)) then
    raise exception 'Primary image must be one of the gallery images.' using errcode = '23514';
  end if;

  delete from public.product_images
  where product_id = p_product_id;

  insert into public.product_images(product_id, image_path, sort_order, is_primary)
  select
    p_product_id,
    x.path,
    (x.ord - 1) * 10,
    (x.path = p_primary_path)
  from unnest(p_image_paths) with ordinality as x(path, ord)
  order by x.ord;

  update public.products
  set image_path = p_primary_path
  where id = p_product_id;
end;
$$;

revoke all on function public.set_product_gallery(uuid,text[],text) from public, anon;
grant execute on function public.set_product_gallery(uuid,text[],text) to authenticated;

-- ===========================================================================
-- 3) SECURE / ATOMIC PRODUCT REORDERING
-- ===========================================================================

create or replace function public.reorder_products(p_product_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_existing integer;
  v_categories integer;
begin
  if not public.is_site_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  v_count := coalesce(cardinality(p_product_ids), 0);
  if v_count = 0 then
    return;
  end if;
  if v_count > 500 then
    raise exception 'Too many products in one reorder operation.' using errcode = '22023';
  end if;

  if (select count(distinct x.id) from unnest(p_product_ids) as x(id)) <> v_count then
    raise exception 'Duplicate product IDs are not allowed.' using errcode = '22023';
  end if;

  select count(*), count(distinct p.category_id)
  into v_existing, v_categories
  from public.products p
  where p.id = any(p_product_ids);

  if v_existing <> v_count then
    raise exception 'One or more products were not found.' using errcode = 'P0002';
  end if;
  if v_categories <> 1 then
    raise exception 'Products must belong to the same category.' using errcode = '22023';
  end if;

  update public.products p
  set sort_order = (x.ord - 1) * 10
  from unnest(p_product_ids) with ordinality as x(id, ord)
  where p.id = x.id;
end;
$$;

revoke all on function public.reorder_products(uuid[]) from public, anon;
grant execute on function public.reorder_products(uuid[]) to authenticated;

commit;

-- ===========================================================================
-- VERIFICATION REPORT
-- ===========================================================================

select
  (select count(*) from public.product_images) as gallery_rows,
  (select count(*) from public.product_images where is_primary) as primary_rows,
  (select coalesce(max(cnt),0) from (
    select count(*) cnt from public.product_images group by product_id
  ) q) as max_images_on_one_product;

select
  routine_name,
  routine_type
from information_schema.routines
where routine_schema = 'public'
  and routine_name in ('set_product_gallery','reorder_products')
order by routine_name;



-- ===========================================================================
-- CUSTOMER IDENTITY
-- Product catalog entry: name + mobile required, company optional.
-- ===========================================================================

begin;

-- Allow customer_leads.company_name to be empty/null while keeping sensible length
-- validation when a company is supplied.
alter table public.customer_leads
  alter column company_name drop not null;

alter table public.customer_leads
  alter column company_name set default '';

do $$
declare c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid='public.customer_leads'::regclass
      and contype='c'
      and pg_get_constraintdef(oid) ilike '%company_name%'
  loop
    execute format('alter table public.customer_leads drop constraint if exists %I',c.conname);
  end loop;
end $$;

alter table public.customer_leads
  add constraint customer_leads_company_name_optional_check
  check (
    company_name is null
    or char_length(trim(company_name)) = 0
    or char_length(trim(company_name)) between 2 and 120
  );

drop policy if exists "Public create customer lead" on public.customer_leads;
create policy "Public create customer lead"
on public.customer_leads
for insert
to anon, authenticated
with check (
  char_length(trim(full_name)) between 2 and 120
  and (
    company_name is null
    or char_length(trim(company_name)) = 0
    or char_length(trim(company_name)) between 2 and 120
  )
  and char_length(trim(mobile)) between 7 and 30
);

commit;


-- ===========================================================================
-- QUOTATION REQUESTS (HISTORICAL / RETIRED SERVICE DATA)
-- ===========================================================================

begin;

create table if not exists public.quote_requests (
  id uuid primary key default gen_random_uuid(),
  request_code text not null unique default (
    'FL-' || to_char(now() at time zone 'Asia/Riyadh','YYYYMMDD') || '-' ||
    upper(substr(replace(gen_random_uuid()::text,'-',''),1,6))
  ),
  request_type text not null default 'image' check (request_type in ('image','cart')),
  customer_type text not null default 'individual' check (customer_type in ('individual','company')),
  full_name text not null check (char_length(trim(full_name)) between 2 and 120),
  company_name text not null default '' check (
    char_length(trim(company_name)) = 0 or char_length(trim(company_name)) between 2 and 120
  ),
  mobile text not null check (char_length(trim(mobile)) between 7 and 30),
  notes text not null default '' check (char_length(notes) <= 500),
  image_path text not null default '' check (char_length(image_path) <= 500),
  original_filename text not null default '' check (char_length(original_filename) <= 180),
  status text not null default 'new' check (status in ('new','processed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Upgrade existing quotation rows in-place.
alter table public.quote_requests
  add column if not exists customer_type text not null default 'individual';

alter table public.quote_requests
  alter column company_name drop not null;

alter table public.quote_requests
  alter column company_name set default '';

-- Existing legacy quotation rows all contained a company, so preserve that meaning.
update public.quote_requests
set customer_type='company'
where coalesce(trim(company_name),'') <> ''
  and customer_type='individual';

do $$
declare c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid='public.quote_requests'::regclass
      and contype='c'
      and (
        pg_get_constraintdef(oid) ilike '%company_name%'
        or pg_get_constraintdef(oid) ilike '%customer_type%'
      )
  loop
    execute format('alter table public.quote_requests drop constraint if exists %I',c.conname);
  end loop;
end $$;

alter table public.quote_requests
  add constraint quote_requests_customer_type_check
  check (customer_type in ('individual','company'));

alter table public.quote_requests
  add constraint quote_requests_company_by_type_check
  check (
    (customer_type='individual' and coalesce(trim(company_name),'')='')
    or
    (customer_type='company' and char_length(trim(company_name)) between 2 and 120)
  );

create index if not exists quote_requests_created_at_idx
on public.quote_requests(created_at desc);

create index if not exists quote_requests_status_created_idx
on public.quote_requests(status, created_at desc);

-- Keep updated_at accurate.
drop trigger if exists quote_requests_set_updated_at on public.quote_requests;
create trigger quote_requests_set_updated_at
before update on public.quote_requests
for each row execute function public.set_updated_at();

alter table public.quote_requests enable row level security;

-- Remove legacy policies if this file is re-run.
do $$
declare p record;
begin
  for p in
    select schemaname,tablename,policyname
    from pg_policies
    where schemaname='public' and tablename='quote_requests'
  loop
    execute format('drop policy if exists %I on %I.%I',p.policyname,p.schemaname,p.tablename);
  end loop;
end $$;

-- Public visitor can CREATE an image quote request but can never read it back.
create policy "Public create image quote request"
on public.quote_requests
for insert
to anon, authenticated
with check (
  request_type='image'
  and customer_type in ('individual','company')
  and char_length(trim(full_name)) between 2 and 120
  and (
    (customer_type='individual' and coalesce(trim(company_name),'')='')
    or
    (customer_type='company' and char_length(trim(company_name)) between 2 and 120)
  )
  and char_length(trim(mobile)) between 7 and 30
  and char_length(notes) <= 500
  and char_length(trim(image_path)) between 10 and 500
  and image_path like 'incoming/%'
  and status='new'
);

-- Only real site admins can read/update/delete requests.
create policy "Admins manage quote requests"
on public.quote_requests
for all
to authenticated
using (public.is_site_admin())
with check (public.is_site_admin());

revoke all on table public.quote_requests from anon, authenticated;
grant insert on table public.quote_requests to anon;
grant select,insert,update,delete on table public.quote_requests to authenticated;

-- ---------------------------------------------------------------------------
-- PRIVATE STORAGE BUCKET FOR CUSTOMER REQUEST IMAGES
-- ---------------------------------------------------------------------------
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values (
  'quote-requests',
  'quote-requests',
  false,
  4194304,
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do update set
  public=false,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

-- Remove only policies that belong to this bucket.
do $$
declare p record;
begin
  for p in
    select schemaname,tablename,policyname
    from pg_policies
    where schemaname='storage'
      and tablename='objects'
      and (
        coalesce(qual,'') ilike '%quote-requests%'
        or coalesce(with_check,'') ilike '%quote-requests%'
      )
  loop
    execute format('drop policy if exists %I on %I.%I',p.policyname,p.schemaname,p.tablename);
  end loop;
end $$;

-- Visitors may upload only NEW files to the incoming folder of this private bucket.
create policy "Public upload quote request image"
on storage.objects
for insert
to anon, authenticated
with check (
  bucket_id='quote-requests'
  and (storage.foldername(name))[1]='incoming'
);

-- Admins can read/delete/manage the private images.
create policy "Admins manage quote request images"
on storage.objects
for all
to authenticated
using (bucket_id='quote-requests' and public.is_site_admin())
with check (bucket_id='quote-requests' and public.is_site_admin());

-- ---------------------------------------------------------------------------
-- ANALYTICS RPC: add quotation funnel events without exposing raw analytics.
-- ---------------------------------------------------------------------------
create or replace function public.log_site_event(
  p_event_name text,
  p_event_label text default '',
  p_visitor_id text default '',
  p_session_id text default '',
  p_page_path text default '/',
  p_metadata jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event text := lower(trim(coalesce(p_event_name,'')));
  v_label text := left(trim(coalesce(p_event_label,'')),180);
  v_visitor text := left(trim(coalesce(p_visitor_id,'')),80);
  v_session text := left(trim(coalesce(p_session_id,'')),80);
  v_path text := left(coalesce(nullif(trim(p_page_path),''),'/'),300);
  v_meta jsonb := coalesce(p_metadata,'{}'::jsonb);
begin
  if v_event not in (
    'page_view',
    'products_open',
    'product_category_view',
    'product_image_open',
    'product_gallery_navigation',
    'product_whatsapp_click',
    'catalog_download',
    'contact_phone',
    'contact_whatsapp',
    'contact_location',
    'customer_lead_saved',
    'save_contact',
    'quote_cart_add',
    'quote_cart_open',
    'quote_whatsapp_submit',
    'quote_image_open',
    'quote_image_submit'
  ) then
    return false;
  end if;

  if char_length(v_visitor) < 8 or char_length(v_session) < 8 then
    return false;
  end if;

  if jsonb_typeof(v_meta) is distinct from 'object' or octet_length(v_meta::text) > 4000 then
    v_meta := '{}'::jsonb;
  end if;

  if exists (
    select 1 from public.analytics_events e
    where e.session_id=v_session
      and e.created_at >= now()-interval '1 minute'
    order by e.created_at desc
    offset 119 limit 1
  ) then return false; end if;

  if exists (
    select 1 from public.analytics_events e
    where e.visitor_id=v_visitor
      and e.created_at >= now()-interval '1 minute'
    order by e.created_at desc
    offset 239 limit 1
  ) then return false; end if;

  if exists (
    select 1 from public.analytics_events e
    where e.session_id=v_session
      and e.event_name=v_event
      and e.event_label=v_label
      and e.created_at >= now()-interval '1 second'
  ) then return false; end if;

  insert into public.analytics_events(event_name,event_label,visitor_id,session_id,page_path,metadata)
  values(v_event,v_label,v_visitor,v_session,v_path,v_meta);
  return true;
end;
$$;

revoke all on function public.log_site_event(text,text,text,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.log_site_event(text,text,text,text,text,jsonb) to anon, authenticated;

commit;

-- ===========================================================================
-- QUOTATION SCHEMA VERIFICATION
-- ===========================================================================
select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname='quote_requests';

select id,name,public,file_size_limit,allowed_mime_types
from storage.buckets
where id='quote-requests';

select schemaname,tablename,policyname,roles,cmd,qual,with_check
from pg_policies
where (schemaname='public' and tablename='quote_requests')
   or (schemaname='storage' and tablename='objects' and (
      coalesce(qual,'') ilike '%quote-requests%'
      or coalesce(with_check,'') ilike '%quote-requests%'
   ))
order by schemaname,tablename,policyname;



-- ###########################################################################
-- ANALYTICS RESET V5.2
-- ###########################################################################

-- Flower Light Analytics V5.2 - Reset analytics
-- Run once in Supabase > SQL Editor > New query > Run
-- Adds an admin-only RPC used by the "إعادة تعيين الإحصائيات" button.
-- It deletes analytics only. Products, categories, contacts and customer leads are untouched.

create or replace function public.reset_site_analytics()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_raw_deleted bigint := 0;
  v_daily_deleted bigint := 0;
begin
  if not public.is_site_admin() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  -- Block analytics writes for the few milliseconds needed to create a clean reset point.
  -- Any event arriving during the reset waits, then is inserted afterwards and counts as new.
  lock table public.analytics_events in access exclusive mode;
  lock table public.analytics_daily in access exclusive mode;

  -- Explicit predicates keep the reset compatible with Supabase safe-update.
  -- Both columns are primary-key columns and cannot be null, so all rows are removed.
  delete from public.analytics_events
  where id is not null;
  get diagnostics v_raw_deleted = row_count;

  delete from public.analytics_daily
  where day is not null;
  get diagnostics v_daily_deleted = row_count;

  return jsonb_build_object(
    'ok', true,
    'raw_deleted', v_raw_deleted,
    'daily_deleted', v_daily_deleted,
    'reset_at', now()
  );
end;
$$;

revoke all on function public.reset_site_analytics() from public, anon;
grant execute on function public.reset_site_analytics() to authenticated;

-- Optional verification (works only while authenticated as a site admin):
-- select public.reset_site_analytics();



-- ###########################################################################
-- SECURITY HARDENING V6
-- ###########################################################################

-- Flower Light / بصائر الخليج
-- Supabase Security Hardening V6
-- Purpose:
--   1) Keep public site data readable only where intended.
--   2) Restrict ALL writes to admin users through public.is_site_admin().
--   3) Prevent non-admin authenticated users from reading hidden products/contacts.
--   4) Keep customer leads private.
--   5) Lock down analytics tables and admin RPCs.
--   6) Keep product image writes admin-only.
--
-- Safe to re-run. Run in Supabase > SQL Editor.
-- IMPORTANT: This script assumes the existing V5 admin_users / is_site_admin() setup
-- already exists. It does not contain any admin UID or password.

begin;

-- ---------------------------------------------------------------------------
-- PRE-FLIGHT
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.categories') is null
     or to_regclass('public.products') is null
     or to_regclass('public.site_profile') is null
     or to_regclass('public.contact_items') is null
     or to_regclass('public.customer_leads') is null then
    raise exception 'Required Flower Light tables are missing. Run the original Supabase setup files first.';
  end if;

  if to_regclass('public.admin_users') is null
     or to_regprocedure('public.is_site_admin()') is null then
    raise exception 'V5 admin role setup is missing. Run ANALYTICS_V5_UPGRADE.sql first.';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- ENABLE RLS
-- ---------------------------------------------------------------------------
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.site_profile enable row level security;
alter table public.contact_items enable row level security;
alter table public.customer_leads enable row level security;
alter table public.admin_users enable row level security;

do $$
begin
  if to_regclass('public.analytics_events') is not null then
    execute 'alter table public.analytics_events enable row level security';
  end if;
  if to_regclass('public.analytics_daily') is not null then
    execute 'alter table public.analytics_daily enable row level security';
  end if;
  if to_regclass('public.admin_panel_passwords') is not null then
    execute 'alter table public.admin_panel_passwords enable row level security';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- REMOVE LEGACY WRITE POLICIES ON PUBLIC CONTENT TABLES
-- This closes old "any authenticated user can write" policies.
-- ---------------------------------------------------------------------------
do $$
declare
  p record;
begin
  for p in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('categories','products','site_profile','contact_items')
      and cmd in ('ALL','INSERT','UPDATE','DELETE')
  loop
    execute format('drop policy if exists %I on %I.%I',
      p.policyname, p.schemaname, p.tablename);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- PUBLIC READ POLICIES
-- Key fix: authenticated non-admin users no longer get hidden rows merely because
-- auth.uid() is non-null.
-- ---------------------------------------------------------------------------
drop policy if exists "Public read visible categories" on public.categories;
create policy "Public read visible categories"
on public.categories for select
to anon, authenticated
using (is_visible = true);

drop policy if exists "Public read visible products" on public.products;
create policy "Public read visible products"
on public.products for select
to anon, authenticated
using (is_visible = true);

drop policy if exists "Public read site profile" on public.site_profile;
create policy "Public read site profile"
on public.site_profile for select
to anon, authenticated
using (id = 1);

drop policy if exists "Public read visible contacts" on public.contact_items;
create policy "Public read visible contacts"
on public.contact_items for select
to anon, authenticated
using (is_visible = true);

-- ---------------------------------------------------------------------------
-- ADMIN MANAGEMENT POLICIES
-- public.is_site_admin() is the server-side authorization boundary.
-- ---------------------------------------------------------------------------
drop policy if exists "Admins manage categories" on public.categories;
create policy "Admins manage categories"
on public.categories for all
to authenticated
using (public.is_site_admin())
with check (public.is_site_admin());

drop policy if exists "Admins manage products" on public.products;
create policy "Admins manage products"
on public.products for all
to authenticated
using (public.is_site_admin())
with check (public.is_site_admin());

drop policy if exists "Admins manage site profile" on public.site_profile;
create policy "Admins manage site profile"
on public.site_profile for all
to authenticated
using (public.is_site_admin())
with check (public.is_site_admin() and id = 1);

drop policy if exists "Admins manage contact items" on public.contact_items;
create policy "Admins manage contact items"
on public.contact_items for all
to authenticated
using (public.is_site_admin())
with check (public.is_site_admin());

-- ---------------------------------------------------------------------------
-- CUSTOMER LEADS
-- Visitors may INSERT only. They cannot SELECT / UPDATE / DELETE.
-- ---------------------------------------------------------------------------
do $$
declare
  p record;
begin
  for p in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'customer_leads'
  loop
    execute format('drop policy if exists %I on %I.%I',
      p.policyname, p.schemaname, p.tablename);
  end loop;
end $$;

create policy "Public create customer lead"
on public.customer_leads
for insert
to anon, authenticated
with check (
  char_length(trim(full_name)) between 2 and 120
  and char_length(trim(company_name)) between 2 and 120
  and char_length(trim(mobile)) between 7 and 30
);

create policy "Admins manage customer leads"
on public.customer_leads
for all
to authenticated
using (public.is_site_admin())
with check (public.is_site_admin());

-- ---------------------------------------------------------------------------
-- ADMIN USERS
-- Role membership itself is visible only to admins; membership changes stay SQL-only.
-- ---------------------------------------------------------------------------
do $$
declare
  p record;
begin
  for p in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'admin_users'
  loop
    execute format('drop policy if exists %I on %I.%I',
      p.policyname, p.schemaname, p.tablename);
  end loop;
end $$;

create policy "Admins view admin users"
on public.admin_users
for select
to authenticated
using (public.is_site_admin());

-- ---------------------------------------------------------------------------
-- TABLE GRANTS
-- RLS is still the final row-level gate, but remove unnecessary privileges.
-- ---------------------------------------------------------------------------
revoke all on table public.categories, public.products, public.site_profile, public.contact_items from anon;
grant select on table public.categories, public.products, public.site_profile, public.contact_items to anon;

revoke all on table public.categories, public.products, public.site_profile, public.contact_items from authenticated;
grant select, insert, update, delete
on table public.categories, public.products, public.site_profile, public.contact_items
to authenticated;

revoke all on table public.customer_leads from anon;
grant insert on table public.customer_leads to anon;

revoke all on table public.customer_leads from authenticated;
grant select, insert, update, delete on table public.customer_leads to authenticated;

revoke all on table public.admin_users from anon, authenticated;
grant select on table public.admin_users to authenticated;

do $$
begin
  if to_regclass('public.admin_panel_passwords') is not null then
    execute 'revoke all on table public.admin_panel_passwords from anon, authenticated';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- ANALYTICS TABLES
-- Anonymous visitors never access raw analytics tables directly.
-- They write only through log_site_event().
-- ---------------------------------------------------------------------------
do $$
declare
  p record;
begin
  if to_regclass('public.analytics_events') is not null then
    for p in
      select schemaname, tablename, policyname
      from pg_policies
      where schemaname = 'public' and tablename = 'analytics_events'
    loop
      execute format('drop policy if exists %I on %I.%I',
        p.policyname, p.schemaname, p.tablename);
    end loop;

    execute 'create policy "Admins read analytics events"
      on public.analytics_events for select to authenticated
      using (public.is_site_admin())';

    execute 'create policy "Admins delete analytics events"
      on public.analytics_events for delete to authenticated
      using (public.is_site_admin())';

    execute 'revoke all on table public.analytics_events from anon';
    execute 'revoke all on table public.analytics_events from authenticated';
    execute 'grant select, delete on table public.analytics_events to authenticated';
  end if;

  if to_regclass('public.analytics_daily') is not null then
    for p in
      select schemaname, tablename, policyname
      from pg_policies
      where schemaname = 'public' and tablename = 'analytics_daily'
    loop
      execute format('drop policy if exists %I on %I.%I',
        p.policyname, p.schemaname, p.tablename);
    end loop;

    execute 'create policy "Admins read analytics daily"
      on public.analytics_daily for select to authenticated
      using (public.is_site_admin())';

    execute 'create policy "Admins delete analytics daily"
      on public.analytics_daily for delete to authenticated
      using (public.is_site_admin())';

    execute 'revoke all on table public.analytics_daily from anon';
    execute 'revoke all on table public.analytics_daily from authenticated';
    execute 'grant select, delete on table public.analytics_daily to authenticated';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- STORAGE
-- Product images remain publicly viewable because the bucket is public,
-- but upload/update/delete are admin-only.
-- ---------------------------------------------------------------------------
do $$
declare
  p record;
begin
  for p in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and cmd in ('ALL','INSERT','UPDATE','DELETE')
      and (
        coalesce(qual,'') ilike '%product-images%'
        or coalesce(with_check,'') ilike '%product-images%'
      )
  loop
    execute format('drop policy if exists %I on %I.%I',
      p.policyname, p.schemaname, p.tablename);
  end loop;
end $$;

drop policy if exists "Admins manage product images" on storage.objects;
create policy "Admins manage product images"
on storage.objects
for all
to authenticated
using (bucket_id = 'product-images' and public.is_site_admin())
with check (bucket_id = 'product-images' and public.is_site_admin());

-- ---------------------------------------------------------------------------
-- RPC / FUNCTION PRIVILEGES
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regprocedure('public.is_site_admin()') is not null then
    execute 'revoke all on function public.is_site_admin() from public, anon, authenticated';
    execute 'grant execute on function public.is_site_admin() to authenticated';
  end if;

  if to_regprocedure('public.log_site_event(text,text,text,text,text,jsonb)') is not null then
    execute 'revoke all on function public.log_site_event(text,text,text,text,text,jsonb) from public, anon, authenticated';
    execute 'grant execute on function public.log_site_event(text,text,text,text,text,jsonb) to anon, authenticated';
  end if;

  if to_regprocedure('public.get_site_analytics(integer)') is not null then
    execute 'revoke all on function public.get_site_analytics(integer) from public, anon, authenticated';
    execute 'grant execute on function public.get_site_analytics(integer) to authenticated';
  end if;

  if to_regprocedure('public.reset_site_analytics()') is not null then
    execute 'revoke all on function public.reset_site_analytics() from public, anon, authenticated';
    execute 'grant execute on function public.reset_site_analytics() to authenticated';
  end if;

  if to_regprocedure('public.verify_admin_panel_password(text,text)') is not null then
    execute 'revoke all on function public.verify_admin_panel_password(text,text) from public, anon, authenticated';
    execute 'grant execute on function public.verify_admin_panel_password(text,text) to authenticated';
  end if;

  if to_regprocedure('public.maintain_analytics_retention(integer)') is not null then
    execute 'revoke all on function public.maintain_analytics_retention(integer) from public, anon, authenticated';
  end if;
end $$;

commit;

-- ---------------------------------------------------------------------------
-- VERIFICATION REPORT
-- These SELECTs do not modify data. Review the result grid after Run.
-- ---------------------------------------------------------------------------

-- 1) RLS status
select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as force_rls
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where (n.nspname, c.relname) in (
  ('public','categories'),
  ('public','products'),
  ('public','site_profile'),
  ('public','contact_items'),
  ('public','customer_leads'),
  ('public','admin_users'),
  ('public','admin_panel_passwords'),
  ('public','analytics_events'),
  ('public','analytics_daily'),
  ('storage','objects')
)
order by n.nspname, c.relname;

-- 2) Effective policies on the application's tables
select
  schemaname,
  tablename,
  policyname,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where
  (schemaname = 'public' and tablename in (
    'categories','products','site_profile','contact_items','customer_leads',
    'admin_users','admin_panel_passwords','analytics_events','analytics_daily'
  ))
  or (schemaname = 'storage' and tablename = 'objects'
      and (coalesce(qual,'') ilike '%product-images%'
           or coalesce(with_check,'') ilike '%product-images%'))
order by schemaname, tablename, policyname;

-- 3) Table privileges granted to anon/authenticated
select
  grantee,
  table_schema,
  table_name,
  privilege_type
from information_schema.role_table_grants
where grantee in ('anon','authenticated')
  and table_schema in ('public','storage')
  and table_name in (
    'categories','products','site_profile','contact_items','customer_leads',
    'admin_users','admin_panel_passwords','analytics_events','analytics_daily','objects'
  )
order by table_schema, table_name, grantee, privilege_type;

-- 4) Function EXECUTE exposure
with funcs(signature) as (
  values
    ('public.is_site_admin()'),
    ('public.log_site_event(text,text,text,text,text,jsonb)'),
    ('public.get_site_analytics(integer)'),
    ('public.reset_site_analytics()'),
    ('public.verify_admin_panel_password(text,text)'),
    ('public.maintain_analytics_retention(integer)')
)
select
  signature,
  case when to_regprocedure(signature) is null then null
       else has_function_privilege('anon', to_regprocedure(signature), 'EXECUTE') end as anon_execute,
  case when to_regprocedure(signature) is null then null
       else has_function_privilege('authenticated', to_regprocedure(signature), 'EXECUTE') end as authenticated_execute
from funcs;



-- ###########################################################################
-- ADMIN ROLES + PERMISSIONS
-- ###########################################################################

-- Flower Light — Admin roles and permissions
-- admin=1 = Owner / المدير الرئيسي (كل الصلاحيات)
-- admin=2 = Sub-admin / الأدمن (صلاحيات يحددها admin=1)
--
-- IMPORTANT:
-- 1) Run this file once in Supabase > SQL Editor.
-- 2) Create a SECOND Supabase Auth user for admin=2 from Authentication > Users.
-- 3) Open ?admin=1, enter that user's email, tick permissions, then Save.
--
-- This migration keeps the existing owner account as Owner automatically.

begin;

-- ============================================================================
-- 1) ADMIN ROLES + PERMISSIONS
-- ============================================================================

alter table public.admin_users
  add column if not exists role text;

alter table public.admin_users
  add column if not exists permissions text[];

update public.admin_users
set role = coalesce(nullif(role,''),'owner')
where role is null or trim(role)='';

update public.admin_users
set permissions = '{}'::text[]
where permissions is null;

alter table public.admin_users
  alter column role set default 'owner',
  alter column role set not null,
  alter column permissions set default '{}'::text[],
  alter column permissions set not null;

do $$
begin
  alter table public.admin_users drop constraint if exists admin_users_role_check;
  alter table public.admin_users drop constraint if exists admin_users_permissions_check;
end $$;

alter table public.admin_users
  add constraint admin_users_role_check
  check (role in ('owner','subadmin'));

-- Normalize any permissions left by older/newer migrations before applying
-- the temporary compatibility constraint. This makes the final script safe to
-- run on an already-upgraded database as well as on a fresh database.
update public.admin_users a
set permissions = coalesce((
  select array_agg(p.permission order by p.ord)
  from unnest(coalesce(a.permissions,'{}'::text[])) with ordinality as p(permission,ord)
  where p.permission = any(array[
    'analytics','quotes','profile','contacts','leads',
    'sections','products','services','datasheet'
  ]::text[])
),'{}'::text[]);

alter table public.admin_users
  add constraint admin_users_permissions_check
  check (
    permissions <@ array[
      'analytics','quotes','profile','contacts','leads',
      'sections','products','services','datasheet'
    ]::text[]
  );

create or replace function public.is_site_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users a
    where a.user_id = auth.uid()
      and a.role in ('owner','subadmin')
  );
$$;

create or replace function public.is_site_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users a
    where a.user_id = auth.uid()
      and a.role = 'owner'
  );
$$;

create or replace function public.has_admin_permission(p_permission text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users a
    where a.user_id = auth.uid()
      and (
        a.role = 'owner'
        or (
          a.role = 'subadmin'
          and p_permission = any(a.permissions)
        )
      )
  );
$$;

revoke all on function public.is_site_admin() from public, anon;
revoke all on function public.is_site_owner() from public, anon;
revoke all on function public.has_admin_permission(text) from public, anon;
grant execute on function public.is_site_admin() to authenticated;
grant execute on function public.is_site_owner() to authenticated;
grant execute on function public.has_admin_permission(text) to authenticated;

-- Current logged-in account role/permissions for the web app.
create or replace function public.get_current_admin_access()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_role text;
  v_permissions text[];
  v_email text;
begin
  select a.role, a.permissions, u.email
  into v_role, v_permissions, v_email
  from public.admin_users a
  left join auth.users u on u.id = a.user_id
  where a.user_id = auth.uid();

  return jsonb_build_object(
    'role', coalesce(v_role,''),
    'permissions', coalesce(v_permissions,'{}'::text[]),
    'email', coalesce(v_email,'')
  );
end;
$$;

-- Owner sees the single admin=2 account currently linked.
create or replace function public.owner_get_admin2_settings()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_email text := '';
  v_permissions text[] := '{}'::text[];
begin
  if not public.is_site_owner() then
    raise exception 'Owner access required' using errcode='42501';
  end if;

  select coalesce(u.email,''), coalesce(a.permissions,'{}'::text[])
  into v_email, v_permissions
  from public.admin_users a
  join auth.users u on u.id = a.user_id
  where a.role='subadmin'
  order by a.created_at asc
  limit 1;

  return jsonb_build_object(
    'email', coalesce(v_email,''),
    'permissions', coalesce(v_permissions,'{}'::text[])
  );
end;
$$;

-- Owner links ONE Auth user to admin=2 and saves its allowed sections.
create or replace function public.owner_set_admin2_settings(
  p_email text,
  p_permissions text[] default '{}'::text[]
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid;
  v_email text;
  v_existing_role text;
  v_permissions text[] := '{}'::text[];
  v_allowed constant text[] := array[
    'analytics','quotes','profile','contacts','leads','sections','products'
  ]::text[];
begin
  if not public.is_site_owner() then
    raise exception 'Owner access required' using errcode='42501';
  end if;

  if p_email is null or position('@' in trim(p_email)) < 2 then
    raise exception 'Enter a valid admin=2 email.' using errcode='22023';
  end if;

  select u.id, u.email
  into v_user_id, v_email
  from auth.users u
  where lower(u.email) = lower(trim(p_email))
  limit 1;

  if v_user_id is null then
    raise exception 'No Supabase Auth user exists with this email. Create it first in Authentication > Users.' using errcode='P0002';
  end if;

  if v_user_id = auth.uid() then
    raise exception 'admin=2 must use a different Supabase Auth account from admin=1.' using errcode='22023';
  end if;

  select role into v_existing_role
  from public.admin_users
  where user_id=v_user_id;

  if v_existing_role='owner' then
    raise exception 'This email is already an Owner account and cannot be converted to admin=2.' using errcode='22023';
  end if;

  select coalesce(array_agg(x.permission order by x.ord),'{}'::text[])
  into v_permissions
  from (
    select distinct on (p.permission)
      p.permission,
      p.ord
    from unnest(coalesce(p_permissions,'{}'::text[])) with ordinality as p(permission,ord)
    where p.permission = any(v_allowed)
    order by p.permission,p.ord
  ) x;

  -- This project uses one admin=2 account. Remove a previous sub-admin link if changed.
  delete from public.admin_users
  where role='subadmin'
    and user_id<>v_user_id;

  insert into public.admin_users(user_id,role,permissions)
  values(v_user_id,'subadmin',coalesce(v_permissions,'{}'::text[]))
  on conflict(user_id) do update
  set role='subadmin',
      permissions=excluded.permissions;

  return jsonb_build_object(
    'email', coalesce(v_email,''),
    'permissions', coalesce(v_permissions,'{}'::text[])
  );
end;
$$;

revoke all on function public.get_current_admin_access() from public, anon;
revoke all on function public.owner_get_admin2_settings() from public, anon;
revoke all on function public.owner_set_admin2_settings(text,text[]) from public, anon;
grant execute on function public.get_current_admin_access() to authenticated;
grant execute on function public.owner_get_admin2_settings() to authenticated;
grant execute on function public.owner_set_admin2_settings(text,text[]) to authenticated;

-- ============================================================================
-- 3) RLS — REAL SERVER-SIDE PERMISSIONS
-- ============================================================================

-- Admin role table itself.
drop policy if exists "Admins view admin users" on public.admin_users;
drop policy if exists "Owners view admin users" on public.admin_users;
drop policy if exists "Subadmin views own admin row" on public.admin_users;

create policy "Owners view admin users"
on public.admin_users for select to authenticated
using (public.is_site_owner());

create policy "Subadmin views own admin row"
on public.admin_users for select to authenticated
using (user_id=auth.uid());

revoke all on table public.admin_users from anon, authenticated;
grant select on table public.admin_users to authenticated;

-- CATEGORIES: products permission may READ categories, but only sections permission may edit them.
drop policy if exists "Admins manage categories" on public.categories;
drop policy if exists "Admin read all categories" on public.categories;
drop policy if exists "Admin insert categories" on public.categories;
drop policy if exists "Admin update categories" on public.categories;
drop policy if exists "Admin delete categories" on public.categories;

create policy "Admin read all categories"
on public.categories for select to authenticated
using (
  public.is_site_owner()
  or public.has_admin_permission('sections')
  or public.has_admin_permission('products')
);

create policy "Admin insert categories"
on public.categories for insert to authenticated
with check (public.is_site_owner() or public.has_admin_permission('sections'));

create policy "Admin update categories"
on public.categories for update to authenticated
using (public.is_site_owner() or public.has_admin_permission('sections'))
with check (public.is_site_owner() or public.has_admin_permission('sections'));

-- Deleting a category can delete/affect products, so sub-admin needs BOTH permissions.
create policy "Admin delete categories"
on public.categories for delete to authenticated
using (
  public.is_site_owner()
  or (public.has_admin_permission('sections') and public.has_admin_permission('products'))
);

-- PRODUCTS
drop policy if exists "Admins manage products" on public.products;
drop policy if exists "Admin manage products by permission" on public.products;
create policy "Admin manage products by permission"
on public.products for all to authenticated
using (public.is_site_owner() or public.has_admin_permission('products'))
with check (public.is_site_owner() or public.has_admin_permission('products'));

-- PRODUCT IMAGE METADATA
drop policy if exists "Admins manage product images metadata" on public.product_images;
drop policy if exists "Admin manage product image metadata by permission" on public.product_images;
create policy "Admin manage product image metadata by permission"
on public.product_images for all to authenticated
using (public.is_site_owner() or public.has_admin_permission('products'))
with check (public.is_site_owner() or public.has_admin_permission('products'));

-- SITE PROFILE
drop policy if exists "Admins manage site profile" on public.site_profile;
drop policy if exists "Admin manage site profile by permission" on public.site_profile;
create policy "Admin manage site profile by permission"
on public.site_profile for all to authenticated
using (public.is_site_owner() or public.has_admin_permission('profile'))
with check ((public.is_site_owner() or public.has_admin_permission('profile')) and id=1);

-- CONTACTS
drop policy if exists "Admins manage contact items" on public.contact_items;
drop policy if exists "Admin manage contacts by permission" on public.contact_items;
create policy "Admin manage contacts by permission"
on public.contact_items for all to authenticated
using (public.is_site_owner() or public.has_admin_permission('contacts'))
with check (public.is_site_owner() or public.has_admin_permission('contacts'));

-- CUSTOMER LEADS: keep the existing public INSERT policy; restrict private list/actions.
drop policy if exists "Admins manage customer leads" on public.customer_leads;
drop policy if exists "Admin manage leads by permission" on public.customer_leads;
create policy "Admin manage leads by permission"
on public.customer_leads for all to authenticated
using (public.is_site_owner() or public.has_admin_permission('leads'))
with check (public.is_site_owner() or public.has_admin_permission('leads'));

-- QUOTE REQUESTS: keep existing public INSERT policy.
drop policy if exists "Admins manage quote requests" on public.quote_requests;
drop policy if exists "Admin manage quotes by permission" on public.quote_requests;
create policy "Admin manage quotes by permission"
on public.quote_requests for all to authenticated
using (public.is_site_owner() or public.has_admin_permission('quotes'))
with check (public.is_site_owner() or public.has_admin_permission('quotes'));

-- ANALYTICS RAW TABLES
do $$
begin
  if to_regclass('public.analytics_events') is not null then
    execute 'drop policy if exists "Admins read analytics events" on public.analytics_events';
    execute 'drop policy if exists "Admins delete analytics events" on public.analytics_events';
    execute 'drop policy if exists "Admin read analytics by permission" on public.analytics_events';
    execute 'drop policy if exists "Admin delete analytics by permission" on public.analytics_events';
    execute 'create policy "Admin read analytics by permission" on public.analytics_events for select to authenticated using (public.is_site_owner() or public.has_admin_permission(''analytics''))';
    execute 'create policy "Admin delete analytics by permission" on public.analytics_events for delete to authenticated using (public.is_site_owner() or public.has_admin_permission(''analytics''))';
  end if;
  if to_regclass('public.analytics_daily') is not null then
    execute 'drop policy if exists "Admins read analytics daily" on public.analytics_daily';
    execute 'drop policy if exists "Admins delete analytics daily" on public.analytics_daily';
    execute 'drop policy if exists "Admin read analytics daily by permission" on public.analytics_daily';
    execute 'drop policy if exists "Admin delete analytics daily by permission" on public.analytics_daily';
    execute 'create policy "Admin read analytics daily by permission" on public.analytics_daily for select to authenticated using (public.is_site_owner() or public.has_admin_permission(''analytics''))';
    execute 'create policy "Admin delete analytics daily by permission" on public.analytics_daily for delete to authenticated using (public.is_site_owner() or public.has_admin_permission(''analytics''))';
  end if;
end $$;

-- STORAGE: product images / site profile assets.
drop policy if exists "Admins manage product images" on storage.objects;
drop policy if exists "Role manage product files" on storage.objects;
create policy "Role manage product files"
on storage.objects for all to authenticated
using (
  bucket_id='product-images'
  and (
    public.is_site_owner()
    or (
      coalesce((storage.foldername(name))[1],'')='site-assets'
      and public.has_admin_permission('profile')
    )
    or (
      coalesce((storage.foldername(name))[1],'')<>'site-assets'
      and public.has_admin_permission('products')
    )
  )
)
with check (
  bucket_id='product-images'
  and (
    public.is_site_owner()
    or (
      coalesce((storage.foldername(name))[1],'')='site-assets'
      and public.has_admin_permission('profile')
    )
    or (
      coalesce((storage.foldername(name))[1],'')<>'site-assets'
      and public.has_admin_permission('products')
    )
  )
);

-- Private quote attachments. Keep the existing PUBLIC INSERT policy for incoming/.
drop policy if exists "Admins manage quote request images" on storage.objects;
drop policy if exists "Role manage quote request files" on storage.objects;
create policy "Role manage quote request files"
on storage.objects for all to authenticated
using (
  bucket_id='quote-requests'
  and (public.is_site_owner() or public.has_admin_permission('quotes'))
)
with check (
  bucket_id='quote-requests'
  and (public.is_site_owner() or public.has_admin_permission('quotes'))
);

-- ============================================================================
-- 4) SCOPED RPC WRAPPERS — prevents bypassing RLS through old admin RPCs
-- ============================================================================

create or replace function public.get_site_analytics_for_admin(p_days integer default 30)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
begin
  if not (public.is_site_owner() or public.has_admin_permission('analytics')) then
    raise exception 'Analytics permission required' using errcode='42501';
  end if;
  return public.get_site_analytics(p_days);
end;
$$;

create or replace function public.reset_site_analytics_for_admin()
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
begin
  if not (public.is_site_owner() or public.has_admin_permission('analytics')) then
    raise exception 'Analytics permission required' using errcode='42501';
  end if;
  return public.reset_site_analytics();
end;
$$;

create or replace function public.set_product_gallery_for_admin(
  p_product_id uuid,
  p_image_paths text[],
  p_primary_path text
)
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  if not (public.is_site_owner() or public.has_admin_permission('products')) then
    raise exception 'Products permission required' using errcode='42501';
  end if;
  perform public.set_product_gallery(p_product_id,p_image_paths,p_primary_path);
end;
$$;

create or replace function public.reorder_products_for_admin(p_product_ids uuid[])
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  if not (public.is_site_owner() or public.has_admin_permission('products')) then
    raise exception 'Products permission required' using errcode='42501';
  end if;
  perform public.reorder_products(p_product_ids);
end;
$$;

-- Remove browser access to the old broad admin RPCs and expose only scoped versions.
revoke all on function public.get_site_analytics(integer) from public, anon, authenticated;
revoke all on function public.reset_site_analytics() from public, anon, authenticated;
revoke all on function public.set_product_gallery(uuid,text[],text) from public, anon, authenticated;
revoke all on function public.reorder_products(uuid[]) from public, anon, authenticated;

revoke all on function public.get_site_analytics_for_admin(integer) from public, anon;
revoke all on function public.reset_site_analytics_for_admin() from public, anon;
revoke all on function public.set_product_gallery_for_admin(uuid,text[],text) from public, anon;
revoke all on function public.reorder_products_for_admin(uuid[]) from public, anon;

grant execute on function public.get_site_analytics_for_admin(integer) to authenticated;
grant execute on function public.reset_site_analytics_for_admin() to authenticated;
grant execute on function public.set_product_gallery_for_admin(uuid,text[],text) to authenticated;
grant execute on function public.reorder_products_for_admin(uuid[]) to authenticated;

commit;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

select
  a.role,
  a.permissions,
  u.email
from public.admin_users a
left join auth.users u on u.id=a.user_id
order by case when a.role='owner' then 0 else 1 end, a.created_at;

select
  schemaname,tablename,policyname,roles,cmd
from pg_policies
where (schemaname='public' and tablename in (
  'admin_users','categories','products','product_images','site_profile',
  'contact_items','customer_leads','quote_requests','analytics_events','analytics_daily'
))
   or (schemaname='storage' and tablename='objects' and policyname in (
     'Role manage product files','Role manage quote request files','Public upload quote request image'
   ))
order by schemaname,tablename,policyname;



-- ###########################################################################
-- SERVICES + DATASHEET
-- ###########################################################################

-- Flower Light — Services and datasheet settings
-- شغّل هذا الملف مرة واحدة من Supabase > SQL Editor ثم اضغط Run.
-- «صمّم داتا شيت» أصبح أداة إدارية قابلة للتفويض إلى admin=2، ولا يظهر للعملاء.

begin;

-- --------------------------------------------------------------------------
-- 1) ظهور «طلب عرض سعر» للعملاء
-- --------------------------------------------------------------------------

alter table public.site_profile
  add column if not exists quote_service_visible boolean not null default true;

update public.site_profile
set quote_service_visible=coalesce(quote_service_visible,true)
where id=1;

-- أوقف علم ظهور الداتا شيت القديم إن كان موجودًا من نسخة سابقة.
-- الواجهة الحالية لا تعرض أداة الداتا شيت للعملاء مهما كانت قيمة هذا العمود.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema='public'
      and table_name='site_profile'
      and column_name='datasheet_service_visible'
  ) then
    execute 'update public.site_profile set datasheet_service_visible=false where id=1';
  end if;
end;
$$;

create or replace function public.get_quote_service_visibility_for_admin()
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  v_quote_visible boolean;
begin
  if not (
    public.is_site_owner()
    or public.has_admin_permission('services')
  ) then
    raise exception 'Services permission required' using errcode='42501';
  end if;

  select quote_service_visible
  into v_quote_visible
  from public.site_profile
  where id=1;

  if not found then
    raise exception 'Site profile row 1 was not found' using errcode='P0002';
  end if;

  return jsonb_build_object('quote_service_visible',v_quote_visible);
end;
$$;

create or replace function public.set_quote_service_visibility(
  p_quote_visible boolean
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_quote_visible boolean;
begin
  if not (
    public.is_site_owner()
    or public.has_admin_permission('services')
  ) then
    raise exception 'Services permission required' using errcode='42501';
  end if;

  update public.site_profile
  set quote_service_visible=coalesce(p_quote_visible,false)
  where id=1
  returning quote_service_visible into v_quote_visible;

  if not found then
    raise exception 'Site profile row 1 was not found' using errcode='P0002';
  end if;

  return jsonb_build_object('quote_service_visible',v_quote_visible);
end;
$$;

revoke all on function public.get_quote_service_visibility_for_admin() from public,anon;
revoke all on function public.set_quote_service_visibility(boolean) from public,anon;
grant execute on function public.get_quote_service_visibility_for_admin() to authenticated;
grant execute on function public.set_quote_service_visibility(boolean) to authenticated;

-- --------------------------------------------------------------------------
-- 2) صلاحيات admin=2
--    «صمّم داتا شيت» قابل للتفويض، والأقسام والمنتجات للمدير الأساسي فقط.
-- --------------------------------------------------------------------------

alter table public.admin_users
  drop constraint if exists admin_users_permissions_check;

update public.admin_users a
set permissions=coalesce((
  select array_agg(p.permission order by p.ord)
  from unnest(coalesce(a.permissions,'{}'::text[])) with ordinality as p(permission,ord)
  where p.permission=any(array[
    'analytics','quotes','profile','contacts','leads','services','datasheet'
  ]::text[])
),'{}'::text[]);

alter table public.admin_users
  add constraint admin_users_permissions_check
  check (
    permissions <@ array[
      'analytics','quotes','profile','contacts','leads','services','datasheet'
    ]::text[]
  );

create or replace function public.owner_set_admin2_settings(
  p_email text,
  p_permissions text[] default '{}'::text[]
)
returns jsonb
language plpgsql
security definer
set search_path=public,auth
as $$
declare
  v_user_id uuid;
  v_email text;
  v_existing_role text;
  v_permissions text[] := '{}'::text[];
  v_allowed constant text[] := array[
    'analytics','quotes','profile','contacts','leads','services','datasheet'
  ]::text[];
begin
  if not public.is_site_owner() then
    raise exception 'Owner access required' using errcode='42501';
  end if;

  if p_email is null or position('@' in trim(p_email)) < 2 then
    raise exception 'Enter a valid admin=2 email.' using errcode='22023';
  end if;

  select u.id,u.email
  into v_user_id,v_email
  from auth.users u
  where lower(u.email)=lower(trim(p_email))
  limit 1;

  if v_user_id is null then
    raise exception 'No Supabase Auth user exists with this email. Create it first in Authentication > Users.' using errcode='P0002';
  end if;

  if v_user_id=auth.uid() then
    raise exception 'admin=2 must use a different Supabase Auth account from admin=1.' using errcode='22023';
  end if;

  select role into v_existing_role
  from public.admin_users
  where user_id=v_user_id;

  if v_existing_role='owner' then
    raise exception 'This email is already an Owner account and cannot be converted to admin=2.' using errcode='22023';
  end if;

  select coalesce(array_agg(x.permission order by x.ord),'{}'::text[])
  into v_permissions
  from (
    select distinct on (p.permission)
      p.permission,
      p.ord
    from unnest(coalesce(p_permissions,'{}'::text[])) with ordinality as p(permission,ord)
    where p.permission=any(v_allowed)
    order by p.permission,p.ord
  ) x;

  delete from public.admin_users
  where role='subadmin'
    and user_id<>v_user_id;

  insert into public.admin_users(user_id,role,permissions)
  values(v_user_id,'subadmin',coalesce(v_permissions,'{}'::text[]))
  on conflict(user_id) do update
  set role='subadmin',
      permissions=excluded.permissions;

  return jsonb_build_object(
    'email',coalesce(v_email,''),
    'permissions',coalesce(v_permissions,'{}'::text[])
  );
end;
$$;

revoke all on function public.owner_set_admin2_settings(text,text[]) from public,anon;
grant execute on function public.owner_set_admin2_settings(text,text[]) to authenticated;

commit;

-- تحقق سريع بعد التشغيل
select id,quote_service_visible
from public.site_profile
where id=1;

select a.role,a.permissions,u.email
from public.admin_users a
left join auth.users u on u.id=a.user_id
order by case when a.role='owner' then 0 else 1 end,a.created_at;

-- --------------------------------------------------------------------------
-- 3) حقول الداتا شيت الثابتة التي يحددها Admin 1
-- --------------------------------------------------------------------------

begin;

alter table public.site_profile
  add column if not exists datasheet_spec_fields jsonb not null default
  '[
    {"key":"datasheet_1","label":"القدرة","unit":"W"},
    {"key":"datasheet_2","label":"اللومن","unit":"lm"},
    {"key":"datasheet_3","label":"المقاس","unit":""},
    {"key":"datasheet_4","label":"اللون","unit":""}
  ]'::jsonb;

update public.site_profile
set datasheet_spec_fields='[
  {"key":"datasheet_1","label":"القدرة","unit":"W"},
  {"key":"datasheet_2","label":"اللومن","unit":"lm"},
  {"key":"datasheet_3","label":"المقاس","unit":""},
  {"key":"datasheet_4","label":"اللون","unit":""}
]'::jsonb
where id=1
  and (datasheet_spec_fields is null or jsonb_typeof(datasheet_spec_fields)<>'array');

create or replace function public.get_datasheet_settings()
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  v_fields jsonb;
begin
  if not (
    public.is_site_owner()
    or public.has_admin_permission('datasheet')
  ) then
    raise exception 'Datasheet permission required' using errcode='42501';
  end if;

  select datasheet_spec_fields
  into v_fields
  from public.site_profile
  where id=1;

  if not found then
    raise exception 'Site profile row 1 was not found' using errcode='P0002';
  end if;

  return jsonb_build_object(
    'fields',case
      when jsonb_typeof(coalesce(v_fields,'[]'::jsonb))='array' then coalesce(v_fields,'[]'::jsonb)
      else '[]'::jsonb
    end
  );
end;
$$;

create or replace function public.owner_set_datasheet_fields(
  p_fields jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_clean jsonb := '[]'::jsonb;
begin
  if not public.is_site_owner() then
    raise exception 'Owner access required' using errcode='42501';
  end if;

  if jsonb_typeof(coalesce(p_fields,'[]'::jsonb)) <> 'array' then
    raise exception 'p_fields must be a JSON array.' using errcode='22023';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'key','datasheet_' || x.ord::text,
      'label',left(trim(x.item->>'label'),80),
      'unit',left(trim(coalesce(x.item->>'unit','')),20)
    ) order by x.ord
  ),'[]'::jsonb)
  into v_clean
  from (
    select item,ord
    from jsonb_array_elements(coalesce(p_fields,'[]'::jsonb)) with ordinality as e(item,ord)
    where ord<=15
      and length(trim(coalesce(item->>'label','')))>0
    order by ord
  ) x;

  update public.site_profile
  set datasheet_spec_fields=v_clean
  where id=1;

  if not found then
    raise exception 'Site profile row 1 was not found' using errcode='P0002';
  end if;

  return jsonb_build_object('fields',v_clean);
end;
$$;

revoke all on function public.get_datasheet_settings() from public,anon;
revoke all on function public.owner_set_datasheet_fields(jsonb) from public,anon;
grant execute on function public.get_datasheet_settings() to authenticated;
grant execute on function public.owner_set_datasheet_fields(jsonb) to authenticated;

commit;

-- تحقق سريع من الحقول المحفوظة
select id,datasheet_spec_fields
from public.site_profile
where id=1;



-- ###########################################################################
-- MULTI PDF CATALOGS
-- ###########################################################################

-- Flower Light — Multiple PDF catalogs beside product sections
-- Run once in Supabase > SQL Editor > Run

create table if not exists public.site_catalogs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  pdf_path text not null,
  file_name text not null default '',
  sort_order integer not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.site_catalogs enable row level security;

drop policy if exists "site catalogs public read" on public.site_catalogs;
create policy "site catalogs public read"
on public.site_catalogs for select
to public
using (is_visible = true);

drop policy if exists "site catalogs authenticated read" on public.site_catalogs;
drop policy if exists "site catalogs authenticated write" on public.site_catalogs;
drop policy if exists "Admin read all site catalogs" on public.site_catalogs;
drop policy if exists "Admin insert site catalogs" on public.site_catalogs;
drop policy if exists "Admin update site catalogs" on public.site_catalogs;
drop policy if exists "Admin delete site catalogs" on public.site_catalogs;

create policy "Admin read all site catalogs"
on public.site_catalogs for select
to authenticated
using (
  public.is_site_owner()
  or public.has_admin_permission('sections')
  or public.has_admin_permission('products')
);

create policy "Admin insert site catalogs"
on public.site_catalogs for insert
to authenticated
with check (public.is_site_owner() or public.has_admin_permission('sections'));

create policy "Admin update site catalogs"
on public.site_catalogs for update
to authenticated
using (public.is_site_owner() or public.has_admin_permission('sections'))
with check (public.is_site_owner() or public.has_admin_permission('sections'));

create policy "Admin delete site catalogs"
on public.site_catalogs for delete
to authenticated
using (public.is_site_owner() or public.has_admin_permission('sections'));

-- Keep the dedicated PDF bucket. This also fixes application/pdf MIME rejection.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('catalog-files', 'catalog-files', true, 52428800, array['application/pdf'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "catalog files public read" on storage.objects;
create policy "catalog files public read"
on storage.objects for select
to public
using (bucket_id = 'catalog-files');

drop policy if exists "catalog files authenticated write" on storage.objects;
drop policy if exists "Role manage catalog files" on storage.objects;
create policy "Role manage catalog files"
on storage.objects for all
to authenticated
using (
  bucket_id = 'catalog-files'
  and (public.is_site_owner() or public.has_admin_permission('sections'))
)
with check (
  bucket_id = 'catalog-files'
  and (public.is_site_owner() or public.has_admin_permission('sections'))
);

-- Migrate the legacy single catalog into the multi-catalog table, if it exists.
do $$
begin
  if to_regclass('public.site_catalog') is not null then
    insert into public.site_catalogs (name, description, pdf_path, file_name, sort_order, is_visible)
    select 'الكتالوج', '', sc.pdf_path, coalesce(sc.file_name, 'catalog.pdf'), 0, true
    from public.site_catalog sc
    where sc.id = 1
      and coalesce(sc.pdf_path, '') <> ''
      and not exists (
        select 1 from public.site_catalogs x where x.pdf_path = sc.pdf_path
      );
  end if;
end $$;



-- ###########################################################################
-- CATALOG SECURITY
-- ###########################################################################

-- Flower Light — Catalog security
-- Secure PDF catalogs with the same server-side role/permission model used by the rest of the admin panel.
-- Run ONCE in Supabase > SQL Editor after the earlier admin-role migrations.
-- Catalogs are treated like Sections:
--   * Public visitors can read visible catalogs only.
--   * Owner can read/manage every catalog.
--   * A future admin with `sections` permission can manage catalogs.
--   * A future admin with `products` permission can read all catalogs but cannot change them.

begin;

-- ---------------------------------------------------------------------------
-- PRE-FLIGHT: the role/permission functions must already exist.
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regprocedure('public.is_site_owner()') is null
     or to_regprocedure('public.has_admin_permission(text)') is null then
    raise exception 'Admin role functions are missing. Run the admin roles/permissions migration first.';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- SITE CATALOGS TABLE
-- ---------------------------------------------------------------------------
alter table public.site_catalogs enable row level security;

-- Remove legacy broad catalog policies before applying the current policies.
drop policy if exists "site catalogs public read" on public.site_catalogs;
drop policy if exists "site catalogs authenticated read" on public.site_catalogs;
drop policy if exists "site catalogs authenticated write" on public.site_catalogs;
drop policy if exists "Admin read all site catalogs" on public.site_catalogs;
drop policy if exists "Admin insert site catalogs" on public.site_catalogs;
drop policy if exists "Admin update site catalogs" on public.site_catalogs;
drop policy if exists "Admin delete site catalogs" on public.site_catalogs;

-- Visitors (and ordinary authenticated sessions) can only see catalogs marked visible.
create policy "site catalogs public read"
on public.site_catalogs
for select
to anon, authenticated
using (is_visible = true);

-- Admin-side read access mirrors the Categories rules.
-- `products` may read catalogs because catalogs appear inside the product/catalog selector.
create policy "Admin read all site catalogs"
on public.site_catalogs
for select
to authenticated
using (
  public.is_site_owner()
  or public.has_admin_permission('sections')
  or public.has_admin_permission('products')
);

-- Creating/editing/deleting catalogs is a Sections-level action.
create policy "Admin insert site catalogs"
on public.site_catalogs
for insert
to authenticated
with check (
  public.is_site_owner()
  or public.has_admin_permission('sections')
);

create policy "Admin update site catalogs"
on public.site_catalogs
for update
to authenticated
using (
  public.is_site_owner()
  or public.has_admin_permission('sections')
)
with check (
  public.is_site_owner()
  or public.has_admin_permission('sections')
);

create policy "Admin delete site catalogs"
on public.site_catalogs
for delete
to authenticated
using (
  public.is_site_owner()
  or public.has_admin_permission('sections')
);

-- Explicit grants; RLS remains the server-side authorization boundary.
revoke all on table public.site_catalogs from anon, authenticated;
grant select on table public.site_catalogs to anon;
grant select, insert, update, delete on table public.site_catalogs to authenticated;

-- ---------------------------------------------------------------------------
-- CATALOG PDF STORAGE
-- ---------------------------------------------------------------------------
-- Keep PDFs public for visitors, but protect every write with the same Sections permission.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('catalog-files', 'catalog-files', true, 52428800, array['application/pdf'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "catalog files public read" on storage.objects;
drop policy if exists "catalog files authenticated write" on storage.objects;
drop policy if exists "Role manage catalog files" on storage.objects;

create policy "catalog files public read"
on storage.objects
for select
to public
using (bucket_id = 'catalog-files');

create policy "Role manage catalog files"
on storage.objects
for all
to authenticated
using (
  bucket_id = 'catalog-files'
  and (
    public.is_site_owner()
    or public.has_admin_permission('sections')
  )
)
with check (
  bucket_id = 'catalog-files'
  and (
    public.is_site_owner()
    or public.has_admin_permission('sections')
  )
);

commit;

-- ---------------------------------------------------------------------------
-- VERIFICATION
-- ---------------------------------------------------------------------------
select schemaname, tablename, policyname, roles, cmd
from pg_policies
where (schemaname='public' and tablename='site_catalogs')
   or (schemaname='storage' and tablename='objects' and policyname in (
        'catalog files public read','Role manage catalog files'
      ))
order by schemaname, tablename, policyname;



-- ###########################################################################
-- FINAL RECONCILIATION
-- ###########################################################################

-- ===========================================================================
-- FINAL CURRENT-SCHEMA RECONCILIATION
-- ===========================================================================

-- Keep a profile row available so service/datasheet RPCs always have row id=1.
insert into public.site_profile(id)
values (1)
on conflict (id) do nothing;

-- Customer company is optional in the current UI.
alter table public.customer_leads alter column company_name drop not null;
alter table public.customer_leads alter column company_name set default '';

do $$
declare c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid='public.customer_leads'::regclass
      and contype='c'
      and pg_get_constraintdef(oid) ilike '%company_name%'
  loop
    execute format('alter table public.customer_leads drop constraint if exists %I',c.conname);
  end loop;
end $$;

alter table public.customer_leads
  add constraint customer_leads_company_name_optional_check
  check (
    company_name is null
    or char_length(trim(company_name)) = 0
    or char_length(trim(company_name)) between 2 and 120
  );

drop policy if exists "Public create customer lead" on public.customer_leads;
create policy "Public create customer lead"
on public.customer_leads
for insert
to anon, authenticated
with check (
  char_length(trim(full_name)) between 2 and 120
  and (
    company_name is null
    or char_length(trim(company_name)) = 0
    or char_length(trim(company_name)) between 2 and 120
  )
  and char_length(trim(mobile)) between 7 and 30
);

revoke all on table public.customer_leads from anon;
grant insert on table public.customer_leads to anon;
revoke all on table public.customer_leads from authenticated;
grant select,insert,update,delete on table public.customer_leads to authenticated;

-- The current application uses Supabase email/password + role checks only.
-- Remove the obsolete extra panel-password RPC if an older database still has it.
drop function if exists public.verify_admin_panel_password(text,text);

-- Optional owner bootstrap for a fresh database.
-- Existing databases keep their current owner unchanged.
-- For a brand-new database only, replace OWNER_EMAIL_HERE below with the email
-- of an already-created Supabase Authentication user and rerun this file.
do $$
declare
  v_owner_email text := 'OWNER_EMAIL_HERE';
  v_owner_id uuid;
begin
  if exists (select 1 from public.admin_users where role='owner') then
    raise notice 'Owner already configured; keeping the existing owner.';
    return;
  end if;

  if v_owner_email='OWNER_EMAIL_HERE' or position('@' in v_owner_email)<2 then
    raise notice 'No owner row exists. For a fresh install, replace OWNER_EMAIL_HERE with the owner Auth email and rerun.';
    return;
  end if;

  select id into v_owner_id
  from auth.users
  where lower(email)=lower(v_owner_email)
  limit 1;

  if v_owner_id is null then
    raise exception 'No Supabase Auth user exists for owner email %',v_owner_email;
  end if;

  insert into public.admin_users(user_id,role,permissions)
  values(v_owner_id,'owner','{}'::text[])
  on conflict(user_id) do update set role='owner',permissions='{}'::text[];
end $$;

-- Final grants for RPCs used by the current site.
revoke all on function public.get_current_admin_access() from public,anon;
revoke all on function public.owner_get_admin2_settings() from public,anon;
revoke all on function public.owner_set_admin2_settings(text,text[]) from public,anon;
revoke all on function public.get_quote_service_visibility_for_admin() from public,anon;
revoke all on function public.set_quote_service_visibility(boolean) from public,anon;
revoke all on function public.get_datasheet_settings() from public,anon;
revoke all on function public.owner_set_datasheet_fields(jsonb) from public,anon;
revoke all on function public.get_site_analytics_for_admin(integer) from public,anon;
revoke all on function public.reset_site_analytics_for_admin() from public,anon;
revoke all on function public.set_product_gallery_for_admin(uuid,text[],text) from public,anon;
revoke all on function public.reorder_products_for_admin(uuid[]) from public,anon;

grant execute on function public.get_current_admin_access() to authenticated;
grant execute on function public.owner_get_admin2_settings() to authenticated;
grant execute on function public.owner_set_admin2_settings(text,text[]) to authenticated;
grant execute on function public.get_quote_service_visibility_for_admin() to authenticated;
grant execute on function public.set_quote_service_visibility(boolean) to authenticated;
grant execute on function public.get_datasheet_settings() to authenticated;
grant execute on function public.owner_set_datasheet_fields(jsonb) to authenticated;
grant execute on function public.get_site_analytics_for_admin(integer) to authenticated;
grant execute on function public.reset_site_analytics_for_admin() to authenticated;
grant execute on function public.set_product_gallery_for_admin(uuid,text[],text) to authenticated;
grant execute on function public.reorder_products_for_admin(uuid[]) to authenticated;

-- Verification summary (read-only).
select 'SCHEMA_RECONCILIATION_OK' as status,
       (select count(*) from public.categories) as categories,
       (select count(*) from public.products) as products,
       (select count(*) from public.site_catalogs) as catalogs,
       (select count(*) from public.admin_users where role='owner') as owners;

-- The quote-request service is retired. Keep historical data/files,
-- but revoke its public/admin access and remove the old permission keys.
do $$
begin
  if to_regclass('public.quote_requests') is not null then
    execute 'drop policy if exists "Public create image quote request" on public.quote_requests';
    execute 'drop policy if exists "Admins manage quote requests" on public.quote_requests';
    execute 'drop policy if exists "Admin manage quotes by permission" on public.quote_requests';
    execute 'revoke all on table public.quote_requests from public, anon, authenticated';
  end if;
  if to_regclass('storage.objects') is not null then
    execute 'drop policy if exists "Public upload quote request image" on storage.objects';
    execute 'drop policy if exists "Admins manage quote request images" on storage.objects';
    execute 'drop policy if exists "Role manage quote request files" on storage.objects';
  end if;
  if to_regprocedure('public.get_quote_service_visibility_for_admin()') is not null then
    execute 'revoke all on function public.get_quote_service_visibility_for_admin() from public, anon, authenticated';
  end if;
  if to_regprocedure('public.set_quote_service_visibility(boolean)') is not null then
    execute 'revoke all on function public.set_quote_service_visibility(boolean) from public, anon, authenticated';
  end if;
  if to_regclass('public.admin_users') is not null then
    update public.admin_users
       set permissions=array_remove(array_remove(coalesce(permissions,'{}'::text[]),'quotes'),'services')
     where permissions && array['quotes','services']::text[];
  end if;
end
$$;
-- Flower Light — Admin recovery email settings
-- بريد الاستعادة الأساسي للمدير والأدمن.
-- شغّل هذا الملف مرة واحدة داخل Supabase > SQL Editor.

begin;

create table if not exists public.admin_recovery_settings (
  id smallint primary key default 1 check (id = 1),
  recovery_user_id uuid unique references auth.users(id) on delete set null,
  recovery_email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  constraint admin_recovery_email_format_check
    check (recovery_email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
);

alter table public.admin_recovery_settings enable row level security;

drop policy if exists "Owner reads recovery settings" on public.admin_recovery_settings;
drop policy if exists "Recovery account reads own settings" on public.admin_recovery_settings;

create policy "Owner reads recovery settings"
on public.admin_recovery_settings
for select
to authenticated
using (public.is_site_owner());

create policy "Recovery account reads own settings"
on public.admin_recovery_settings
for select
to authenticated
using (recovery_user_id = auth.uid());

revoke all on table public.admin_recovery_settings from public, anon, authenticated;
grant select on table public.admin_recovery_settings to authenticated;

commit;

select
  id,
  recovery_email,
  recovery_user_id,
  updated_at
from public.admin_recovery_settings;

-- ###########################################################################
-- CUSTOMER LEAD SPAM / DUPLICATE PROTECTION
-- ###########################################################################
-- Keeps the public form usable while suppressing rapid duplicate submissions
-- of the same phone number. No client IP is stored.

create index if not exists customer_leads_mobile_recent_idx
on public.customer_leads (regexp_replace(coalesce(mobile,''), '[^0-9]', '', 'g'), created_at desc);

create or replace function public.suppress_recent_duplicate_customer_lead()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_digits text := regexp_replace(coalesce(new.mobile,''), '[^0-9]', '', 'g');
begin
  if char_length(v_digits) < 7 then
    return new;
  end if;

  if exists (
    select 1
    from public.customer_leads
    where regexp_replace(coalesce(mobile,''), '[^0-9]', '', 'g') = v_digits
      and created_at >= now() - interval '15 minutes'
  ) then
    -- Silently suppress a rapid duplicate. The website can continue normally
    -- without exposing whether the number already exists.
    return null;
  end if;

  return new;
end;
$$;

revoke all on function public.suppress_recent_duplicate_customer_lead() from public, anon, authenticated;

drop trigger if exists customer_leads_suppress_recent_duplicate on public.customer_leads;
create trigger customer_leads_suppress_recent_duplicate
before insert on public.customer_leads
for each row execute function public.suppress_recent_duplicate_customer_lead();

select 'CUSTOMER_LEAD_PROTECTION_OK' as status;


-- ###########################################################################
-- OPTIONAL CUSTOMER LEAD GATE
-- The Owner can enable/disable the name + mobile gate shown before products.
-- Public visitors may read this single setting but can never change it.
-- ###########################################################################

create table if not exists public.site_settings (
  id smallint primary key default 1 check (id = 1),
  require_customer_lead boolean not null default true,
  master_barcode_path text not null default '',
  design_footer_number text not null default '',
  pwa_install_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Upgrade-safe: CREATE TABLE IF NOT EXISTS does not add new columns to an existing table.
alter table public.site_settings
  add column if not exists master_barcode_path text not null default '',
  add column if not exists design_footer_number text not null default '',
  add column if not exists design_footer_label text not null default '',
  add column if not exists pwa_install_enabled boolean not null default true;

insert into public.site_settings(id,require_customer_lead)
values(1,true)
on conflict (id) do nothing;

drop trigger if exists site_settings_set_updated_at on public.site_settings;
create trigger site_settings_set_updated_at
before update on public.site_settings
for each row execute function public.set_updated_at();

alter table public.site_settings enable row level security;

drop policy if exists "Public read site settings" on public.site_settings;
create policy "Public read site settings"
on public.site_settings for select
to anon, authenticated
using (id = 1);

drop policy if exists "Owner manages site settings" on public.site_settings;
create policy "Owner manages site settings"
on public.site_settings for all
to authenticated
using (public.is_site_owner())
with check (public.is_site_owner() and id = 1);

revoke all on table public.site_settings from public, anon, authenticated;
grant select on table public.site_settings to anon, authenticated;
grant insert, update on table public.site_settings to authenticated;

select id, require_customer_lead, master_barcode_path, design_footer_number, design_footer_label, pwa_install_enabled, updated_at
from public.site_settings
where id=1;

-- ###########################################################################
-- STAGE88 ADMIN=2 FINAL PERMISSION HARDENING
-- The assistant admin can receive only the five UI-supported permissions.
-- Sections and products remain Owner-only. Historical quote/service keys are removed.
-- ###########################################################################

begin;

update public.admin_users a
set permissions=coalesce((
  select array_agg(p.permission order by p.ord)
  from unnest(coalesce(a.permissions,'{}'::text[])) with ordinality as p(permission,ord)
  where p.permission=any(array[
    'analytics','profile','contacts','leads','datasheet'
  ]::text[])
),'{}'::text[])
where a.role='subadmin';

alter table public.admin_users
  drop constraint if exists admin_users_permissions_check;

alter table public.admin_users
  add constraint admin_users_permissions_check
  check (
    role='owner'
    or permissions <@ array[
      'analytics','profile','contacts','leads','datasheet'
    ]::text[]
  );

create or replace function public.owner_set_admin2_settings(
  p_email text,
  p_permissions text[] default '{}'::text[]
)
returns jsonb
language plpgsql
security definer
set search_path=public,auth
as $$
declare
  v_user_id uuid;
  v_email text;
  v_existing_role text;
  v_permissions text[] := '{}'::text[];
  v_allowed constant text[] := array[
    'analytics','profile','contacts','leads','datasheet'
  ]::text[];
begin
  if not public.is_site_owner() then
    raise exception 'Owner access required' using errcode='42501';
  end if;

  if p_email is null or position('@' in trim(p_email)) < 2 then
    raise exception 'Enter a valid admin=2 email.' using errcode='22023';
  end if;

  select u.id,u.email
  into v_user_id,v_email
  from auth.users u
  where lower(u.email)=lower(trim(p_email))
  limit 1;

  if v_user_id is null then
    raise exception 'No Supabase Auth user exists with this email. Create it first in Authentication > Users.' using errcode='P0002';
  end if;

  if v_user_id=auth.uid() then
    raise exception 'admin=2 must use a different Supabase Auth account from admin=1.' using errcode='22023';
  end if;

  select role into v_existing_role
  from public.admin_users
  where user_id=v_user_id;

  if v_existing_role='owner' then
    raise exception 'This email is already an Owner account and cannot be converted to admin=2.' using errcode='22023';
  end if;

  select coalesce(array_agg(x.permission order by x.ord),'{}'::text[])
  into v_permissions
  from (
    select distinct on (p.permission) p.permission,p.ord
    from unnest(coalesce(p_permissions,'{}'::text[])) with ordinality as p(permission,ord)
    where p.permission=any(v_allowed)
    order by p.permission,p.ord
  ) x;

  delete from public.admin_users
  where role='subadmin' and user_id<>v_user_id;

  insert into public.admin_users(user_id,role,permissions)
  values(v_user_id,'subadmin',coalesce(v_permissions,'{}'::text[]))
  on conflict(user_id) do update
  set role='subadmin',permissions=excluded.permissions;

  return jsonb_build_object(
    'email',coalesce(v_email,''),
    'permissions',coalesce(v_permissions,'{}'::text[])
  );
end;
$$;

revoke all on function public.owner_set_admin2_settings(text,text[]) from public,anon;
grant execute on function public.owner_set_admin2_settings(text,text[]) to authenticated;

commit;

select 'STAGE88_ADMIN2_PERMISSIONS_OK' as status;

-- ###########################################################################
-- STAGE88 GLOBAL MASTER BARCODE
-- One optional barcode image for all approved datasheet/product exports.
-- The Owner is the only account allowed to write files in site-settings/.
-- ###########################################################################

begin;

alter table public.site_settings
  add column if not exists master_barcode_path text not null default '';

update public.site_settings
set master_barcode_path=coalesce(master_barcode_path,'')
where id=1;

-- Reinstall the final product-images write policy with a dedicated Owner-only
-- namespace for global site settings such as the master barcode.
drop policy if exists "Admins manage product images" on storage.objects;
drop policy if exists "Role manage product files" on storage.objects;
create policy "Role manage product files"
on storage.objects for all to authenticated
using (
  bucket_id='product-images'
  and (
    public.is_site_owner()
    or (
      coalesce((storage.foldername(name))[1],'')='site-assets'
      and public.has_admin_permission('profile')
    )
    or (
      coalesce((storage.foldername(name))[1],'') not in ('site-assets','site-settings')
      and public.has_admin_permission('products')
    )
  )
)
with check (
  bucket_id='product-images'
  and (
    public.is_site_owner()
    or (
      coalesce((storage.foldername(name))[1],'')='site-assets'
      and public.has_admin_permission('profile')
    )
    or (
      coalesce((storage.foldername(name))[1],'') not in ('site-assets','site-settings')
      and public.has_admin_permission('products')
    )
  )
);

commit;

select id, require_customer_lead, master_barcode_path, design_footer_number, design_footer_label, pwa_install_enabled, updated_at
from public.site_settings
where id=1;

select 'STAGE88_MASTER_BARCODE_OK' as status;

-- ###########################################################################
-- STAGE88 DESIGN FOOTER NUMBER
-- Optional Owner-managed number that replaces the website URL in export footer.
-- Empty value means that the middle footer contact block is not rendered.
-- ###########################################################################

begin;

alter table public.site_settings
  add column if not exists design_footer_number text not null default '',
  add column if not exists design_footer_label text not null default '';

update public.site_settings
set design_footer_number=coalesce(design_footer_number,''),
    design_footer_label=coalesce(design_footer_label,'')
where id=1;

commit;

select id, require_customer_lead, master_barcode_path, design_footer_number, design_footer_label, pwa_install_enabled, updated_at
from public.site_settings
where id=1;

select 'STAGE88_DESIGN_FOOTER_LABEL_OK' as status;
select 'STAGE88_FINAL_OK' as status;



-- ###########################################################################
-- FINAL RELEASE ADD-ON: CUSTOMER LEAD RATE LIMIT
-- Also kept as a separate migration for upgrades from older installations.
-- ###########################################################################
-- ###########################################################################
-- CUSTOMER LEAD RATE LIMIT (volume-based, adds to the existing duplicate guard)
-- ###########################################################################
-- The project already blocks a rapid duplicate of the SAME phone number
-- (public.suppress_recent_duplicate_customer_lead, 15-minute window).
-- That trigger does not limit overall VOLUME: a script could still insert
-- many leads per minute using different fake numbers, since `anon` has a
-- direct INSERT grant on public.customer_leads.
--
-- This migration adds a second trigger that caps total inserts regardless
-- of phone number. Run this in the Supabase SQL editor (or via the CLI) on
-- the live project — it cannot be applied from this environment.
--
-- Review MAX_INSERTS_PER_WINDOW / WINDOW_MINUTES below before running.

create or replace function public.enforce_customer_lead_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  max_inserts_per_window constant int := 20;      -- tune to expected real traffic
  window_minutes constant int := 5;
  recent_count int;
begin
  select count(*) into recent_count
  from public.customer_leads
  where created_at >= now() - make_interval(mins => window_minutes);

  if recent_count >= max_inserts_per_window then
    -- Fail closed with a generic error; the public form should show a
    -- friendly "please try again shortly" message on this rejection.
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_customer_lead_rate_limit() from public, anon, authenticated;

drop trigger if exists customer_leads_rate_limit on public.customer_leads;
create trigger customer_leads_rate_limit
before insert on public.customer_leads
for each row execute function public.enforce_customer_lead_rate_limit();

select 'CUSTOMER_LEAD_RATE_LIMIT_OK' as status;

select 'FLOWER_LIGHT_FINAL_OK' as status;


-- v102: Private owner settings; public RPC returns visible fields only.
begin;
create table if not exists public.business_privacy_settings (
 id integer primary key check (id=1),
 legal_name text not null default '' check (length(legal_name)<=200),
 commercial_registration text not null default '' check (length(commercial_registration)<=40),
 tax_number text not null default '' check (length(tax_number)<=40),
 contact_phone text not null default '' check (length(contact_phone)<=40),
 retention_days integer not null default 180 check (retention_days between 1 and 36500),
 show_all boolean not null default true,
 show_legal_name boolean not null default true,
 show_commercial_registration boolean not null default true,
 show_tax_number boolean not null default true,
 show_contact_phone boolean not null default true,
 show_retention_days boolean not null default true
);
alter table public.business_privacy_settings enable row level security;
revoke all on public.business_privacy_settings from public,anon,authenticated;
grant select,insert,update on public.business_privacy_settings to authenticated;
drop policy if exists "Owner manages business privacy" on public.business_privacy_settings;
create policy "Owner manages business privacy" on public.business_privacy_settings
 for all to authenticated using (public.is_site_owner()) with check (public.is_site_owner());
insert into public.business_privacy_settings
 (id,legal_name,commercial_registration,tax_number,contact_phone,retention_days)
 values (1,'شركة بصائر الخليج','1010230086','311199840200003','0560933353',180)
 on conflict (id) do nothing;
create or replace function public.get_public_business_privacy()
returns jsonb language sql stable security definer set search_path=public
as $$
 select coalesce((select case when show_all then jsonb_strip_nulls(jsonb_build_object(
 'legal_name',case when show_legal_name then legal_name end,
 'commercial_registration',case when show_commercial_registration then commercial_registration end,
 'tax_number',case when show_tax_number then tax_number end,
 'contact_phone',case when show_contact_phone then contact_phone end,
 'retention_days',case when show_retention_days then retention_days end
 )) else '{}'::jsonb end from public.business_privacy_settings where id=1),'{}'::jsonb);
$$;
revoke all on function public.get_public_business_privacy() from public;
grant execute on function public.get_public_business_privacy() to anon,authenticated;
commit;
notify pgrst,'reload schema';
select 'BUSINESS_PRIVACY_SETTINGS_OK' as status;


-- ============================================================================
-- V104: TURNSTILE-PROTECTED CUSTOMER LEADS
-- ============================================================================
-- v104: move public customer-lead writes behind the Turnstile Edge Function.
-- IMPORTANT: deploy submit-customer-lead and configure TURNSTILE_SECRET_KEY + config.js site key
-- BEFORE applying this migration to an existing live database.

create table if not exists public.customer_lead_rate_limits (
  key_hash text primary key check (char_length(key_hash) = 64),
  window_started_at timestamptz not null default now(),
  hits integer not null default 0 check (hits >= 0),
  updated_at timestamptz not null default now()
);

alter table public.customer_lead_rate_limits enable row level security;
revoke all on table public.customer_lead_rate_limits from public, anon, authenticated;
grant select, insert, update, delete on table public.customer_lead_rate_limits to service_role;

create index if not exists customer_lead_rate_limits_updated_idx
on public.customer_lead_rate_limits (updated_at);

create or replace function public.consume_customer_lead_rate_limit(
  p_key text,
  p_limit integer default 8,
  p_window_seconds integer default 300
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_row public.customer_lead_rate_limits%rowtype;
begin
  if p_key is null or char_length(p_key) <> 64 or p_limit < 1 or p_window_seconds < 30 then
    return false;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_key, 0));

  -- Small bounded cleanup; only salted hashes are stored and old rows disappear automatically.
  delete from public.customer_lead_rate_limits
  where updated_at < v_now - interval '7 days';

  select * into v_row
  from public.customer_lead_rate_limits
  where key_hash = p_key
  for update;

  if not found then
    insert into public.customer_lead_rate_limits(key_hash, window_started_at, hits, updated_at)
    values (p_key, v_now, 1, v_now);
    return true;
  end if;

  if v_now >= v_row.window_started_at + make_interval(secs => p_window_seconds) then
    update public.customer_lead_rate_limits
    set window_started_at = v_now, hits = 1, updated_at = v_now
    where key_hash = p_key;
    return true;
  end if;

  if v_row.hits >= p_limit then
    update public.customer_lead_rate_limits set updated_at = v_now where key_hash = p_key;
    return false;
  end if;

  update public.customer_lead_rate_limits
  set hits = hits + 1, updated_at = v_now
  where key_hash = p_key;
  return true;
end;
$$;

revoke all on function public.consume_customer_lead_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_customer_lead_rate_limit(text, integer, integer) to service_role;

-- Remove the old whole-site 20/5-minute trigger. It allowed one source to exhaust the quota for everyone.
drop trigger if exists customer_leads_rate_limit on public.customer_leads;
drop function if exists public.enforce_customer_lead_rate_limit();

-- Browser clients can no longer write leads directly. The Edge Function uses service_role after Turnstile validation.
revoke insert on table public.customer_leads from anon;

select 'TURNSTILE_CUSTOMER_LEADS_V104_OK' as status;
-- v105: enforce the configured customer-lead retention period.
-- The value comes from business_privacy_settings.retention_days (default 180).
-- Cleanup runs daily when pg_cron is available, and application fallbacks call
-- this function after a successful lead insert / when admins open lead data.

create or replace function public.purge_expired_customer_leads()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_keep_days integer := 180;
  v_deleted integer := 0;
  v_role text := coalesce(auth.role(), '');
begin
  if v_role = 'authenticated' and not public.is_site_admin() then
    raise exception 'Not authorized';
  end if;

  select greatest(1, least(36500, coalesce(retention_days,180)))
    into v_keep_days
  from public.business_privacy_settings
  where id = 1;

  v_keep_days := coalesce(v_keep_days,180);

  delete from public.customer_leads
  where created_at < now() - make_interval(days => v_keep_days);

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.purge_expired_customer_leads() from public, anon;
grant execute on function public.purge_expired_customer_leads() to authenticated, service_role;

-- Schedule daily cleanup only when pg_cron is already enabled.
do $$
declare
  v_has_cron boolean := false;
begin
  select exists (
    select 1
    from pg_namespace n
    join pg_proc p on p.pronamespace = n.oid
    where n.nspname = 'cron' and p.proname = 'schedule'
  ) into v_has_cron;

  if v_has_cron then
    begin
      execute $sql$
        select cron.unschedule(jobid)
        from cron.job
        where jobname = 'flower-light-customer-leads-retention'
      $sql$;
    exception when others then
      raise notice 'Could not remove an existing customer-lead retention job: %', sqlerrm;
    end;

    begin
      execute $sql$
        select cron.schedule(
          'flower-light-customer-leads-retention',
          '40 2 * * *',
          'select public.purge_expired_customer_leads();'
        )
      $sql$;
      raise notice 'Customer-lead retention scheduled with pg_cron.';
    exception when others then
      raise notice 'pg_cron exists but scheduling customer-lead retention failed: %', sqlerrm;
    end;
  else
    raise notice 'pg_cron is not available; application cleanup fallbacks remain active.';
  end if;
end $$;

-- Enforce the configured retention immediately when the migration is applied.
select public.purge_expired_customer_leads() as deleted_expired_customer_leads;
select 'CUSTOMER_LEAD_RETENTION_V105_OK' as status;
-- v106: Dynamic owner-managed business information fields + legacy-image RPC catch-up.
begin;

create table if not exists public.business_public_fields (
  id uuid primary key default gen_random_uuid(),
  label text not null check (char_length(label) between 1 and 80),
  value text not null check (char_length(value) between 1 and 300),
  sort_order integer not null default 0 check (sort_order between 0 and 100000),
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.business_public_fields enable row level security;
revoke all on public.business_public_fields from public, anon, authenticated;
grant select, insert, update, delete on public.business_public_fields to authenticated;

drop policy if exists "Owner manages business public fields" on public.business_public_fields;
create policy "Owner manages business public fields" on public.business_public_fields
  for all to authenticated
  using (public.is_site_owner())
  with check (public.is_site_owner());

create index if not exists business_public_fields_order_idx
  on public.business_public_fields(sort_order, created_at, id);

-- Seed the current fixed company details once. After this migration, the owner
-- can rename, add, remove, hide and reorder rows freely from the admin panel.
do $$
begin
  if not exists (select 1 from public.business_public_fields) then
    insert into public.business_public_fields(label,value,sort_order,is_visible)
    select x.label,x.value,x.sort_order,true
    from public.business_privacy_settings s
    cross join lateral (values
      ('الاسم التجاري', nullif(btrim(s.legal_name),''), 0),
      ('السجل التجاري', nullif(btrim(s.commercial_registration),''), 1),
      ('الرقم الضريبي', nullif(btrim(s.tax_number),''), 2),
      ('للتواصل', nullif(btrim(s.contact_phone),''), 3)
    ) as x(label,value,sort_order)
    where s.id=1 and x.value is not null;
  end if;
end $$;

-- Public RPC: only visible dynamic rows are returned. Retention stays a separate
-- operational/privacy setting and is shown on privacy.html only when enabled.
create or replace function public.get_public_business_privacy()
returns jsonb
language sql
stable
security definer
set search_path=public
as $$
  select coalesce((
    select case when s.show_all then jsonb_strip_nulls(jsonb_build_object(
      'fields', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id',f.id,
            'label',f.label,
            'value',f.value,
            'sort_order',f.sort_order
          ) order by f.sort_order,f.created_at,f.id
        )
        from public.business_public_fields f
        where f.is_visible=true and btrim(f.label)<>'' and btrim(f.value)<>''
      ),'[]'::jsonb),
      'retention_days',case when s.show_retention_days then s.retention_days end
    )) else '{}'::jsonb end
    from public.business_privacy_settings s
    where s.id=1
  ),'{}'::jsonb);
$$;
revoke all on function public.get_public_business_privacy() from public;
grant execute on function public.get_public_business_privacy() to anon,authenticated;

-- Catch-up for installations that skipped the older v101 image migration.
create or replace function public.replace_legacy_product_image_for_owner(p_old_path text,p_new_path text)
returns integer
language plpgsql security definer set search_path = public
as $$
declare a integer; b integer;
begin
  if not coalesce(public.is_site_owner(),false) then
    raise exception 'Owner access required' using errcode='42501';
  end if;
  if p_old_path is null or p_old_path='' or p_new_path is null
     or p_new_path !~ '^[a-zA-Z0-9_-]+/[a-zA-Z0-9-]+\.l\.webp$'
     or p_old_path=p_new_path then
    raise exception 'Invalid image paths';
  end if;
  update public.products set image_path=p_new_path where image_path=p_old_path;
  get diagnostics a = row_count;
  update public.product_images set image_path=p_new_path where image_path=p_old_path;
  get diagnostics b = row_count;
  if a+b=0 then raise exception 'Image references changed; refresh and retry'; end if;
  return a+b;
end;
$$;
revoke all on function public.replace_legacy_product_image_for_owner(text,text) from public,anon;
grant execute on function public.replace_legacy_product_image_for_owner(text,text) to authenticated;

commit;
notify pgrst,'reload schema';
select 'BUSINESS_DYNAMIC_FIELDS_V106_OK' as status;

-- ===== v108 bank accounts =====
-- v108: Owner-managed public bank transfer accounts.
begin;

create table if not exists public.business_bank_accounts (
  id uuid primary key default gen_random_uuid(),
  bank_name text not null check (char_length(bank_name) between 1 and 80),
  beneficiary_name text not null default '' check (char_length(beneficiary_name) <= 120),
  iban text not null default '' check (char_length(iban) <= 34),
  account_number text not null default '' check (char_length(account_number) <= 80),
  swift_code text not null default '' check (char_length(swift_code) <= 20),
  note text not null default '' check (char_length(note) <= 240),
  is_visible boolean not null default true,
  is_primary boolean not null default false,
  sort_order integer not null default 0 check (sort_order between 0 and 100000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint business_bank_accounts_payment_value check (btrim(iban)<>'' or btrim(account_number)<>'')
);

alter table public.business_bank_accounts enable row level security;
revoke all on public.business_bank_accounts from public, anon, authenticated;
grant select, insert, update, delete on public.business_bank_accounts to authenticated;

drop policy if exists "Owner manages bank accounts" on public.business_bank_accounts;
create policy "Owner manages bank accounts" on public.business_bank_accounts
  for all to authenticated
  using (public.is_site_owner())
  with check (public.is_site_owner());

create index if not exists business_bank_accounts_order_idx
  on public.business_bank_accounts(is_primary desc, sort_order, created_at, id);
create unique index if not exists business_bank_accounts_single_primary_idx
  on public.business_bank_accounts(is_primary) where is_primary=true;

create or replace function public.get_public_bank_accounts()
returns jsonb
language sql
stable
security definer
set search_path=public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',id,
    'bank_name',bank_name,
    'beneficiary_name',nullif(beneficiary_name,''),
    'iban',nullif(iban,''),
    'account_number',nullif(account_number,''),
    'swift_code',nullif(swift_code,''),
    'note',nullif(note,''),
    'is_primary',is_primary,
    'sort_order',sort_order
  ) order by is_primary desc,sort_order,created_at,id),'[]'::jsonb)
  from public.business_bank_accounts
  where is_visible=true and btrim(bank_name)<>'' and (btrim(iban)<>'' or btrim(account_number)<>'');
$$;
revoke all on function public.get_public_bank_accounts() from public;
grant execute on function public.get_public_bank_accounts() to anon,authenticated;

commit;
notify pgrst,'reload schema';
select 'BANK_ACCOUNTS_V108_OK' as status;

