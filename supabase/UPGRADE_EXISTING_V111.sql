-- Flower Light / Basair Gulf
-- Upgrade path for v111D-v111H additions.
-- Run this AFTER UPGRADE_EXISTING_V110.sql on an existing v105+ database.

begin;

alter table public.site_settings
  add column if not exists quote_list_enabled boolean not null default true;

update public.site_settings
set quote_list_enabled=true
where id=1 and quote_list_enabled is null;

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

select id, quote_list_enabled, updated_at
from public.site_settings
where id=1;

select availability, count(*) as products
from public.products
group by availability
order by availability;

select 'UPGRADE_EXISTING_V111_OK' as status;
