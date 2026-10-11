-- v118 — lock all customer-lead inserts behind the server-verified Turnstile Edge Function.
-- IMPORTANT: Changes permissions and an obsolete public INSERT policy ONLY.
-- Existing customer records are not read, updated, or deleted.
-- The deployed submit-customer-lead Edge Function writes with service_role.
begin;

revoke insert on table public.customer_leads from anon, authenticated;
drop policy if exists "Public create customer lead" on public.customer_leads;
grant insert on table public.customer_leads to service_role;

commit;

select
  has_table_privilege('anon','public.customer_leads','INSERT') as anon_can_insert,
  has_table_privilege('authenticated','public.customer_leads','INSERT') as authenticated_can_insert,
  has_table_privilege('service_role','public.customer_leads','INSERT') as edge_service_role_can_insert;
-- Expected: false | false | true
select 'CUSTOMER_LEADS_EDGE_ONLY_V118_OK' as status;
