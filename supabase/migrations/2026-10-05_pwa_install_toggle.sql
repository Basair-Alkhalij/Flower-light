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
