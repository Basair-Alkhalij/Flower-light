-- Flower Light v111H — product availability states
begin;

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

select availability, count(*) as products
from public.products
group by availability
order by availability;

select 'PRODUCT_AVAILABILITY_V111H_OK' as status;
