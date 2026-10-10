-- Flower Light / Basair Gulf
-- Upgrade path for v111D-v111H additions.
-- Run this AFTER UPGRADE_EXISTING_V110.sql on an existing v105+ database.

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

select id, quote_list_enabled, catalog_filter_keys, catalog_custom_filters, updated_at
from public.site_settings
where id=1;

select availability, count(*) as products
from public.products
group by availability
order by availability;

select 'UPGRADE_EXISTING_V111_OK' as status;
