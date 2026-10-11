-- Flower Light / Basair Gulf — UPGRADE_TO_V118.sql
-- For existing v110+ databases only. Never run SUPABASE_SETUP.sql against an existing database.
-- Required before application: deploy and verify the protected submit-customer-lead Edge Function.
-- The production site already has these upgrades; DO NOT reapply there.
-- This unified file preserves the original transactions and only revokes obsolete client lead inserts in v118.

-- ==========================================================
-- supabase/UPGRADE_EXISTING_V111.sql
-- ==========================================================
begin;

alter table public.site_settings
  add column if not exists quote_list_enabled boolean not null default true,
  add column if not exists catalog_filter_keys text[] not null default array['availability','wattage','cct']::text[],
  add column if not exists catalog_custom_filters jsonb not null default '[]'::jsonb;

update public.site_settings
set quote_list_enabled=true
where id=1 and quote_list_enabled is null;

update public.site_settings
set catalog_filter_keys=array['availability','wattage','cct']::text[]
where id=1 and catalog_filter_keys is null;

update public.site_settings
set catalog_custom_filters='[]'::jsonb
where id=1 and (catalog_custom_filters is null or jsonb_typeof(catalog_custom_filters) <> 'array');

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='site_settings_catalog_custom_filters_array_check'
      and conrelid='public.site_settings'::regclass
  ) then
    alter table public.site_settings
      add constraint site_settings_catalog_custom_filters_array_check
      check (jsonb_typeof(catalog_custom_filters)='array');
  end if;
end $$;

alter table public.products
  add column if not exists availability text not null default 'available';

update public.products
set availability='available'
where availability is null or availability not in ('available','out_of_stock','coming_soon');

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='products_availability_check'
      and conrelid='public.products'::regclass
  ) then
    alter table public.products
      add constraint products_availability_check
      check (availability in ('available','out_of_stock','coming_soon'));
  end if;
end $$;

comment on column public.products.availability is
'Public availability: available, out_of_stock, or coming_soon.';

commit;

-- ==========================================================
-- supabase/UPGRADE_EXISTING_V116.sql
-- ==========================================================
begin;

alter table public.categories
  add column if not exists name_en text not null default '',
  add column if not exists description_en text not null default '';

alter table public.products
  add column if not exists name_en text not null default '',
  add column if not exists caption_en text not null default '',
  add column if not exists specifications_en jsonb not null default '[]'::jsonb;

-- Use the same array size safety limit as the existing specifications column.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'products_specifications_en_is_array'
      and conrelid = 'public.products'::regclass
  ) then
    alter table public.products
      add constraint products_specifications_en_is_array
      check (jsonb_typeof(specifications_en) = 'array');
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'products_specifications_en_size'
      and conrelid = 'public.products'::regclass
  ) then
    alter table public.products
      add constraint products_specifications_en_size
      check (octet_length(specifications_en::text) <= 16000);
  end if;
end $$;

comment on column public.categories.name_en is 'Optional verified English category name; Arabic name is the original.';
comment on column public.categories.description_en is 'Optional verified English category description.';
comment on column public.products.name_en is 'Optional verified English product name.';
comment on column public.products.caption_en is 'Optional verified English product description.';
comment on column public.products.specifications_en is 'Optional English specifications array {key,label,value,unit}, without internal pricing metadata.';

commit;

-- ==========================================================
-- supabase/UPGRADE_EXISTING_V117.sql
-- ==========================================================
begin;
alter table public.site_profile
  add column if not exists brand_name_en text not null default '',
  add column if not exists company_name_en text not null default '';
alter table public.contact_items
  add column if not exists label_en text not null default '';
comment on column public.site_profile.brand_name_en is 'Optional English brand name displayed only to English visitors.';
comment on column public.site_profile.company_name_en is 'Optional English company name displayed only to English visitors.';
comment on column public.contact_items.label_en is 'Optional English branch/contact label. Original Arabic label remains unchanged.';
commit;

-- ==========================================================
-- supabase/UPGRADE_CUSTOMER_LEADS_EDGE_ONLY_V118.sql
-- ==========================================================
begin;

revoke insert on table public.customer_leads from anon, authenticated;
drop policy if exists "Public create customer lead" on public.customer_leads;
grant insert on table public.customer_leads to service_role;

commit;

-- Verification: six flags should be true when migration finishes.
select
  (select count(*) from information_schema.columns
    where table_schema='public' and table_name='site_settings'
    and column_name in ('quote_list_enabled','catalog_filter_keys','catalog_custom_filters'))=3
    and exists (select 1 from information_schema.columns where table_schema='public' and table_name='products' and column_name='availability') as v111_ok,
  (select count(*) from information_schema.columns where table_schema='public'
   and ((table_name='categories' and column_name in ('name_en','description_en'))
   or (table_name='products' and column_name in ('name_en','caption_en','specifications_en'))))=5 as v116_ok,
  (select count(*) from information_schema.columns where table_schema='public'
   and ((table_name='site_profile' and column_name in ('brand_name_en','company_name_en'))
   or (table_name='contact_items' and column_name='label_en')))=3 as v117_ok,
  not has_table_privilege('anon','public.customer_leads','INSERT') as anon_insert_blocked,
  not has_table_privilege('authenticated','public.customer_leads','INSERT') as authenticated_insert_blocked,
  has_table_privilege('service_role','public.customer_leads','INSERT') as service_role_can_insert,
  'UPGRADE_TO_V118_OK' as status;
