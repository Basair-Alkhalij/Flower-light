-- v106: Dynamic owner-managed business information fields + legacy-image RPC catch-up.
begin;

create table if not exists public.business_public_fields (
  id uuid primary key default gen_random_uuid(),
  label text not null check (char_length(label) between 1 and 80),
  value text not null check (char_length(value) between 1 and 300),
  sort_order integer not null default 0 check (sort_order between 0 and 100000),
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.business_public_fields enable row level security;
revoke all on public.business_public_fields from public, anon, authenticated;
grant select, insert, update, delete on public.business_public_fields to authenticated;

drop policy if exists "Owner manages business public fields" on public.business_public_fields;
create policy "Owner manages business public fields" on public.business_public_fields
  for all to authenticated
  using (public.is_site_owner())
  with check (public.is_site_owner());

create index if not exists business_public_fields_order_idx
  on public.business_public_fields(sort_order, created_at, id);

-- Seed the current fixed company details once. After this migration, the owner
-- can rename, add, remove, hide and reorder rows freely from the admin panel.
do $$
begin
  if not exists (select 1 from public.business_public_fields) then
    insert into public.business_public_fields(label,value,sort_order,is_visible)
    select x.label,x.value,x.sort_order,true
    from public.business_privacy_settings s
    cross join lateral (values
      ('الاسم التجاري', nullif(btrim(s.legal_name),''), 0),
      ('السجل التجاري', nullif(btrim(s.commercial_registration),''), 1),
      ('الرقم الضريبي', nullif(btrim(s.tax_number),''), 2),
      ('للتواصل', nullif(btrim(s.contact_phone),''), 3)
    ) as x(label,value,sort_order)
    where s.id=1 and x.value is not null;
  end if;
end $$;

-- Public RPC: only visible dynamic rows are returned. Retention stays a separate
-- operational/privacy setting and is shown on privacy.html only when enabled.
create or replace function public.get_public_business_privacy()
returns jsonb
language sql
stable
security definer
set search_path=public
as $$
  select coalesce((
    select case when s.show_all then jsonb_strip_nulls(jsonb_build_object(
      'fields', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id',f.id,
            'label',f.label,
            'value',f.value,
            'sort_order',f.sort_order
          ) order by f.sort_order,f.created_at,f.id
        )
        from public.business_public_fields f
        where f.is_visible=true and btrim(f.label)<>'' and btrim(f.value)<>''
      ),'[]'::jsonb),
      'retention_days',case when s.show_retention_days then s.retention_days end
    )) else '{}'::jsonb end
    from public.business_privacy_settings s
    where s.id=1
  ),'{}'::jsonb);
$$;
revoke all on function public.get_public_business_privacy() from public;
grant execute on function public.get_public_business_privacy() to anon,authenticated;

-- Catch-up for installations that skipped the older v101 image migration.
create or replace function public.replace_legacy_product_image_for_owner(p_old_path text,p_new_path text)
returns integer
language plpgsql security definer set search_path = public
as $$
declare a integer; b integer;
begin
  if not coalesce(public.is_site_owner(),false) then
    raise exception 'Owner access required' using errcode='42501';
  end if;
  if p_old_path is null or p_old_path='' or p_new_path is null
     or p_new_path !~ '^[a-zA-Z0-9_-]+/[a-zA-Z0-9-]+\.l\.webp$'
     or p_old_path=p_new_path then
    raise exception 'Invalid image paths';
  end if;
  update public.products set image_path=p_new_path where image_path=p_old_path;
  get diagnostics a = row_count;
  update public.product_images set image_path=p_new_path where image_path=p_old_path;
  get diagnostics b = row_count;
  if a+b=0 then raise exception 'Image references changed; refresh and retry'; end if;
  return a+b;
end;
$$;
revoke all on function public.replace_legacy_product_image_for_owner(text,text) from public,anon;
grant execute on function public.replace_legacy_product_image_for_owner(text,text) to authenticated;

commit;
notify pgrst,'reload schema';
select 'BUSINESS_DYNAMIC_FIELDS_V106_OK' as status;
