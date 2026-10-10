-- Flower Light / Basair Gulf
-- Custom reusable catalog filters created by the Owner.

begin;

alter table public.site_settings
  add column if not exists catalog_custom_filters jsonb not null default '[]'::jsonb;

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

comment on column public.site_settings.catalog_custom_filters is
'Owner-created reusable catalog filter definitions, stored as [{key,label}].';

commit;

select id, catalog_filter_keys, catalog_custom_filters, updated_at
from public.site_settings
where id=1;

select 'CATALOG_CUSTOM_FILTERS_V111M_OK' as status;
