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
