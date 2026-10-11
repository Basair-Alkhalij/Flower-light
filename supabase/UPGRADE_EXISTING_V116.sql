-- v116 — bilingual catalog fields. Run once on the existing Supabase project.
-- Non-destructive: all Arabic values, product IDs, prices and images remain untouched.
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

select 'BILINGUAL_CATALOG_V116_OK' as status;
