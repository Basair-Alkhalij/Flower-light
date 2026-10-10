-- Flower Light / Basair Gulf
-- Owner-selected public catalog filters.

begin;

alter table public.site_settings
  add column if not exists catalog_filter_keys text[] not null
  default array['availability','wattage','cct']::text[];

update public.site_settings
set catalog_filter_keys=array['availability','wattage','cct']::text[]
where id=1 and catalog_filter_keys is null;

comment on column public.site_settings.catalog_filter_keys is
'Owner-selected product filter keys shown in the public catalog.';

commit;

select id, catalog_filter_keys, updated_at
from public.site_settings
where id=1;

select 'CATALOG_FILTER_SELECTION_V111L_OK' as status;
