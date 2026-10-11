-- Flower Light / Basair Gulf — read-only production security audit (v117)
-- SAFE: SELECT statements only. Does not change tables, RLS, grants, keys, or data.
-- Run in Supabase SQL Editor with the same production project used by the website.
-- Inspect the returned findings; a column existing is not proof a deployed Edge Function is configured.
-- Do not post customer records, tokens, emails, or credentials in screenshots.

-- 1. RLS status and anonymous table-level privileges for the public and private entities.
select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as force_rls,
  has_table_privilege('anon', c.oid, 'SELECT') as anon_select,
  has_table_privilege('anon', c.oid, 'INSERT') as anon_insert,
  has_table_privilege('anon', c.oid, 'UPDATE') as anon_update,
  has_table_privilege('anon', c.oid, 'DELETE') as anon_delete,
  has_table_privilege('authenticated', c.oid, 'INSERT') as authenticated_insert_grant
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid=c.relnamespace
where c.relkind in ('r','p')
  and n.nspname='public'
  and c.relname in (
    'categories','products','site_profile','contact_items','site_settings',
    'customer_leads','customer_lead_rate_limits','admin_users',
    'admin_recovery_settings','business_privacy_settings','bank_accounts',
    'quote_requests','analytics_events','analytics_daily'
  )
order by c.relname;

-- 2. Effective customer-lead anti-spam permission; expected anon_insert = false, authenticated_insert = false, service_role_insert = true.
select
  to_regclass('public.customer_leads') is not null as customer_leads_exists,
  case when to_regclass('public.customer_leads') is null then null
       else has_table_privilege('anon',to_regclass('public.customer_leads'),'INSERT')
  end as anon_can_insert_customer_leads,
  case when to_regclass('public.customer_leads') is null then null
       else has_table_privilege('authenticated',to_regclass('public.customer_leads'),'INSERT')
  end as authenticated_can_insert_customer_leads,
  case when to_regclass('public.customer_leads') is null then null
       else has_table_privilege('service_role',to_regclass('public.customer_leads'),'INSERT')
  end as service_role_can_insert_customer_leads,
  to_regclass('public.customer_lead_rate_limits') is not null as hashed_rate_limit_table_exists,
  to_regprocedure('public.consume_customer_lead_rate_limit(text,integer,integer)') is not null as rate_limit_rpc_exists,
  case when to_regprocedure('public.consume_customer_lead_rate_limit(text,integer,integer)') is null then null
       else has_function_privilege('anon',to_regprocedure('public.consume_customer_lead_rate_limit(text,integer,integer)'),'EXECUTE')
  end as anon_can_execute_rate_limit_rpc;

-- 3. Active RLS policies. Review roles, commands and conditions.
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_catalog.pg_policies
where (schemaname='public' and tablename in (
  'customer_leads','admin_users','admin_recovery_settings','business_privacy_settings',
  'bank_accounts','categories','products','site_profile','contact_items','site_settings','quote_requests'
)) or (schemaname='storage' and tablename='objects')
order by schemaname,tablename,policyname;

-- 4. Security-definer function grants and search_path. Admin functions must not be callable by anon.
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as arguments,
  p.prosecdef as security_definer,
  p.proconfig as function_config,
  has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
  has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute,
  has_function_privilege('service_role',p.oid,'EXECUTE') as service_role_execute
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid=p.pronamespace
where n.nspname='public'
  and p.proname in (
    'is_site_admin','is_site_owner','has_admin_permission',
    'owner_get_admin2_settings','owner_set_admin2_settings',
    'consume_customer_lead_rate_limit','purge_expired_customer_leads'
  )
order by p.proname;

-- 5. Required bilingual columns exist? These are metadata checks, not content reads.
with expected(table_name,column_name) as (values
  ('categories','name_en'),('categories','description_en'),
  ('products','name_en'),('products','caption_en'),('products','specifications_en'),
  ('site_profile','brand_name_en'),('site_profile','company_name_en'),
  ('contact_items','label_en')
)
select e.table_name,e.column_name,(c.column_name is not null) as column_exists
from expected e
left join information_schema.columns c
  on c.table_schema='public' and c.table_name=e.table_name and c.column_name=e.column_name
order by e.table_name,e.column_name;

-- 6. Customer-lead triggers: the legacy whole-site limit trigger must be absent after v104.
select c.relname as table_name,t.tgname as trigger_name,t.tgenabled as enabled
from pg_catalog.pg_trigger t
join pg_catalog.pg_class c on c.oid=t.tgrelid
join pg_catalog.pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname='customer_leads' and not t.tgisinternal
order by t.tgname;

-- 7. Admin role counts only (no email, user ID or other personal data).
select role,count(*) as account_count
from public.admin_users
group by role
order by role;

-- 8. Configured customer-lead retention, without exposing any leads.
select retention_days
from public.business_privacy_settings
where id=1;

-- Review findings against docs/PRODUCTION_SECURITY_REVIEW_V117.md.
