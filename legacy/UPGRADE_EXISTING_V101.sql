-- EXISTING installations only. Back up first; do NOT run SUPABASE_SETUP.sql.
-- All four migrations below are repeatable. No product/customer data is deleted.

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
  -- Serialize concurrent inserts before checking the count.
  perform pg_advisory_xact_lock(734211, 1);
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


-- Flower Light v98: Owner-controlled PWA install prompt toggle.
-- Safe to run on an existing database. Public users may only read site_settings;
-- the existing Owner policy remains responsible for writes.

begin;

alter table public.site_settings
  add column if not exists pwa_install_enabled boolean not null default true;

update public.site_settings
set pwa_install_enabled=coalesce(pwa_install_enabled,true)
where id=1;

commit;

notify pgrst, 'reload schema';

select id,pwa_install_enabled,updated_at
from public.site_settings
where id=1;

select 'PWA_INSTALL_TOGGLE_OK' as status;


-- Flower Light v100 — ensure the products table matches the current admin/import schema.
-- Safe to run more than once. Existing values are preserved.

begin;

alter table public.products
  add column if not exists price numeric(12,2),
  add column if not exists wholesale_price numeric(12,2),
  add column if not exists wholesale_min_qty integer,
  add column if not exists limited_offer boolean not null default false;

comment on column public.products.price is 'Retail price.';
comment on column public.products.wholesale_price is 'Wholesale price.';
comment on column public.products.wholesale_min_qty is 'Minimum quantity for wholesale price.';
comment on column public.products.limited_offer is 'Show limited-time offer badge.';

commit;

notify pgrst, 'reload schema';

select 'PRODUCT_PRICING_COLUMNS_OK' as status;


-- v101: Owner-only atomic replacement. Original storage objects are retained.
begin;
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
select 'LEGACY_IMAGE_UPGRADE_OK' as status;
