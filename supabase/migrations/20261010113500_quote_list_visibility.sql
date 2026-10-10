-- v111D: Owner-controlled public quote-list visibility
-- Safe/idempotent for existing installations.

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

select 'QUOTE_LIST_VISIBILITY_V111D_OK' as status;
