-- v102: Private owner settings; public RPC returns visible fields only.
begin;
create table if not exists public.business_privacy_settings (
 id integer primary key check (id=1),
 legal_name text not null default '' check (length(legal_name)<=200),
 commercial_registration text not null default '' check (length(commercial_registration)<=40),
 tax_number text not null default '' check (length(tax_number)<=40),
 contact_phone text not null default '' check (length(contact_phone)<=40),
 retention_days integer not null default 180 check (retention_days between 1 and 36500),
 show_all boolean not null default true,
 show_legal_name boolean not null default true,
 show_commercial_registration boolean not null default true,
 show_tax_number boolean not null default true,
 show_contact_phone boolean not null default true,
 show_retention_days boolean not null default true
);
alter table public.business_privacy_settings enable row level security;
revoke all on public.business_privacy_settings from public,anon,authenticated;
grant select,insert,update on public.business_privacy_settings to authenticated;
drop policy if exists "Owner manages business privacy" on public.business_privacy_settings;
create policy "Owner manages business privacy" on public.business_privacy_settings
 for all to authenticated using (public.is_site_owner()) with check (public.is_site_owner());
insert into public.business_privacy_settings
 (id,legal_name,commercial_registration,tax_number,contact_phone,retention_days)
 values (1,'شركة بصائر الخليج','1010230086','311199840200003','0560933353',180)
 on conflict (id) do nothing;
create or replace function public.get_public_business_privacy()
returns jsonb language sql stable security definer set search_path=public
as $$
 select coalesce((select case when show_all then jsonb_strip_nulls(jsonb_build_object(
 'legal_name',case when show_legal_name then legal_name end,
 'commercial_registration',case when show_commercial_registration then commercial_registration end,
 'tax_number',case when show_tax_number then tax_number end,
 'contact_phone',case when show_contact_phone then contact_phone end,
 'retention_days',case when show_retention_days then retention_days end
 )) else '{}'::jsonb end from public.business_privacy_settings where id=1),'{}'::jsonb);
$$;
revoke all on function public.get_public_business_privacy() from public;
grant execute on function public.get_public_business_privacy() to anon,authenticated;
commit;
notify pgrst,'reload schema';
select 'BUSINESS_PRIVACY_SETTINGS_OK' as status;
