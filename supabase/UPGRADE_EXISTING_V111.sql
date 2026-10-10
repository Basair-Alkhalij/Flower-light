-- Flower Light / Basair Gulf
-- Upgrade path for v111D site-setting additions.
-- Run this AFTER UPGRADE_EXISTING_V110.sql on an existing v105+ database.

begin;

alter table public.site_settings
  add column if not exists quote_list_enabled boolean not null default true;

update public.site_settings
set quote_list_enabled=true
where id=1 and quote_list_enabled is null;

commit;

select id, quote_list_enabled, updated_at
from public.site_settings
where id=1;

select 'UPGRADE_EXISTING_V111_OK' as status;
