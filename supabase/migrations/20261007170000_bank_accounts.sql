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
