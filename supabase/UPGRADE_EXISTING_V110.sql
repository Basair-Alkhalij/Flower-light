-- Flower Light / Basair Gulf — single upgrade path to v110
-- Baseline: an existing database that already has v105 applied.
-- Safe to re-run: each included migration is written to be idempotent.
-- Do NOT run SUPABASE_SETUP.sql again on an existing live database.

-- ===== Dynamic business fields (v106) =====
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

-- ===== Bank accounts (v108) =====
-- v108: Owner-managed public bank transfer accounts.
begin;

create table if not exists public.business_bank_accounts (
  id uuid primary key default gen_random_uuid(),
  bank_name text not null check (char_length(bank_name) between 1 and 80),
  beneficiary_name text not null default '' check (char_length(beneficiary_name) <= 120),
  iban text not null default '' check (char_length(iban) <= 34),
  account_number text not null default '' check (char_length(account_number) <= 80),
  swift_code text not null default '' check (char_length(swift_code) <= 20),
  note text not null default '' check (char_length(note) <= 240),
  is_visible boolean not null default true,
  is_primary boolean not null default false,
  sort_order integer not null default 0 check (sort_order between 0 and 100000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint business_bank_accounts_payment_value check (btrim(iban)<>'' or btrim(account_number)<>'')
);

alter table public.business_bank_accounts enable row level security;
revoke all on public.business_bank_accounts from public, anon, authenticated;
grant select, insert, update, delete on public.business_bank_accounts to authenticated;

drop policy if exists "Owner manages bank accounts" on public.business_bank_accounts;
create policy "Owner manages bank accounts" on public.business_bank_accounts
  for all to authenticated
  using (public.is_site_owner())
  with check (public.is_site_owner());

create index if not exists business_bank_accounts_order_idx
  on public.business_bank_accounts(is_primary desc, sort_order, created_at, id);
create unique index if not exists business_bank_accounts_single_primary_idx
  on public.business_bank_accounts(is_primary) where is_primary=true;

create or replace function public.get_public_bank_accounts()
returns jsonb
language sql
stable
security definer
set search_path=public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',id,
    'bank_name',bank_name,
    'beneficiary_name',nullif(beneficiary_name,''),
    'iban',nullif(iban,''),
    'account_number',nullif(account_number,''),
    'swift_code',nullif(swift_code,''),
    'note',nullif(note,''),
    'is_primary',is_primary,
    'sort_order',sort_order
  ) order by is_primary desc,sort_order,created_at,id),'[]'::jsonb)
  from public.business_bank_accounts
  where is_visible=true and btrim(bank_name)<>'' and (btrim(iban)<>'' or btrim(account_number)<>'');
$$;
revoke all on function public.get_public_bank_accounts() from public;
grant execute on function public.get_public_bank_accounts() to anon,authenticated;

commit;
notify pgrst,'reload schema';
select 'BANK_ACCOUNTS_V108_OK' as status;

select 'UPGRADE_EXISTING_V110_OK' as status;
