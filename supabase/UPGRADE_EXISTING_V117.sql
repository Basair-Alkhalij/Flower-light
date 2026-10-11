-- v117: optional English labels for the public digital card.
-- Non-destructive. Run after / independently of v116; it does not modify existing Arabic values.
begin;
alter table public.site_profile
  add column if not exists brand_name_en text not null default '',
  add column if not exists company_name_en text not null default '';
alter table public.contact_items
  add column if not exists label_en text not null default '';
comment on column public.site_profile.brand_name_en is 'Optional English brand name displayed only to English visitors.';
comment on column public.site_profile.company_name_en is 'Optional English company name displayed only to English visitors.';
comment on column public.contact_items.label_en is 'Optional English branch/contact label. Original Arabic label remains unchanged.';
commit;
select 'PUBLIC_CARD_I18N_V117_OK' as status;
