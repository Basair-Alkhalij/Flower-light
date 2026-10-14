-- FLOWER LIGHT — ADMIN 12-SECTION DELEGATION (REVIEW ONLY / NOT APPROVED)
-- DO NOT RUN IN PRODUCTION WITHOUT A SEPARATE, EXPLICIT OWNER APPROVAL.
-- Requires all existing SUPABASE_SETUP.sql migrations, including STAGE88, v108 banks.
-- This script is a proposed transaction. No data rows are inserted, changed or deleted
-- by applying it; the owner's later permission choices are separate actions.
-- Existing subadmin permissions remain exactly as they are until owner changes them.
--
-- Other release components MUST be updated and tested before enabling new permissions:
-- admin.js, admin-permissions.js, navigation, owner-settings modules, Edge
-- manage-admin-account, plus browser and RLS integration tests.
-- Never grant 'credentials' or 'permissions' to the subadmin.

begin;

-- Abort instead of silently installing partial authorization.
do $preflight$
begin
  if to_regclass('public.admin_users') is null
     or to_regclass('public.site_settings') is null
     or to_regclass('public.business_privacy_settings') is null
     or to_regclass('public.business_public_fields') is null
     or to_regclass('public.business_bank_accounts') is null
     or to_regprocedure('public.is_site_owner()') is null
     or to_regprocedure('public.has_admin_permission(text)') is null
     or to_regprocedure('public.owner_set_admin2_settings(text,text[])') is null
  then
    raise exception 'Admin 12-section migration requires the full prior Flower Light schema';
  end if;
end;
$preflight$;

-- A. Permission names: the five current keys stay valid; seven more become possible.
-- No UPDATE to admin_users, no auto-grants or automatic assignment to the subadmin.
alter table public.admin_users drop constraint if exists admin_users_permissions_check;
alter table public.admin_users add constraint admin_users_permissions_check
  check (
    role='owner' or
    permissions <@ array[
      'analytics','datasheet','profile','contacts','leads',
      'sections','products','search-filters','template-settings',
      'site-settings','business-settings','bank-settings'
    ]::text[]
  );

-- B. Owner-only RPC for granting permissions to the *existing* linked account.
-- Same signature and single-subadmin behavior as current production function.
-- Invalid or owner-only keys fail, rather than being silently accepted.
create or replace function public.owner_set_admin2_settings(
  p_email text, p_permissions text[] default '{}'::text[]
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $fn$
declare
  v_user_id uuid;
  v_email text;
  v_existing_role text;
  v_permissions text[] := '{}'::text[];
  v_allowed constant text[] := array[
    'analytics','datasheet','profile','contacts','leads',
    'sections','products','search-filters','template-settings',
    'site-settings','business-settings','bank-settings'
  ]::text[];
begin
  if not public.is_site_owner() then
    raise exception 'Owner access required' using errcode='42501';
  end if;
  if p_email is null or position('@' in btrim(p_email)) < 2 then
    raise exception 'Enter a valid admin=2 email' using errcode='22023';
  end if;
  if cardinality(coalesce(p_permissions,'{}'::text[]))>12 then
    raise exception 'Too many permissions' using errcode='22023';
  end if;
  if exists(
    select 1 from unnest(coalesce(p_permissions,'{}'::text[])) as x(permission)
    where x.permission is null or x.permission <> all(v_allowed)
  ) then
    raise exception 'Unsupported or owner-only permission' using errcode='22023';
  end if;
  select id,email into v_user_id,v_email
  from auth.users where lower(email)=lower(btrim(p_email)) limit 1;
  if v_user_id is null then
    raise exception 'No Supabase Auth user exists with this email' using errcode='P0002';
  end if;
  if v_user_id=auth.uid() then
    raise exception 'admin=2 must use a different Supabase Auth account' using errcode='22023';
  end if;
  select role into v_existing_role from public.admin_users where user_id=v_user_id;
  if v_existing_role='owner' then
    raise exception 'Owner account cannot be changed to admin=2' using errcode='22023';
  end if;
  select coalesce(array_agg(x.permission order by x.ord),'{}'::text[])
  into v_permissions
  from (
    select distinct on (p.permission) p.permission,p.ord
    from unnest(coalesce(p_permissions,'{}'::text[])) with ordinality as p(permission,ord)
    order by p.permission,p.ord
  ) x;
  -- Existing system allows exactly one linked admin=2.
  delete from public.admin_users where role='subadmin' and user_id<>v_user_id;
  insert into public.admin_users(user_id,role,permissions)
  values(v_user_id,'subadmin',v_permissions)
  on conflict(user_id) do update set role='subadmin',permissions=excluded.permissions;
  return jsonb_build_object('email',coalesce(v_email,''),'permissions',v_permissions);
end;
$fn$;
revoke all on function public.owner_set_admin2_settings(text,text[]) from public,anon;
grant execute on function public.owner_set_admin2_settings(text,text[]) to authenticated;

-- Owner-only capability handshake. An unchanged production DB without this RPC
-- keeps the existing five switches enabled; after the migration, all 12 become
-- selectable. A failed RPC never turns ON new permissions in the frontend.
create or replace function public.owner_get_delegatable_permissions()
returns text[] language plpgsql stable security definer
set search_path=public,pg_temp as $fn$
begin
  if not public.is_site_owner() then
    raise exception 'Owner access required' using errcode='42501';
  end if;
  return array[
    'analytics','datasheet','profile','contacts','leads',
    'sections','products','search-filters','template-settings',
    'site-settings','business-settings','bank-settings'
  ]::text[];
end;
$fn$;
revoke all on function public.owner_get_delegatable_permissions() from public,anon;
grant execute on function public.owner_get_delegatable_permissions() to authenticated;

-- C. The existing category, product, image, PDF-catalog RLS and Storage policies
-- already check has_admin_permission('sections') / ('products').
-- Do not replace or broaden them. In particular, category DELETE requires BOTH
-- 'sections' and 'products'; this must remain true in the end-to-end UI.

-- D. Business rows: delegate only with the independent business-settings key.
-- Owner-only policies remain in place. No anon or PUBLIC write grants.
-- A repeat execution replaces only these named delegated policies.
drop policy if exists "Subadmin business privacy by section" on public.business_privacy_settings;
drop policy if exists "Subadmin public company fields by section" on public.business_public_fields;
drop policy if exists "Subadmin bank accounts by section" on public.business_bank_accounts;
create policy "Subadmin business privacy by section"
on public.business_privacy_settings for all to authenticated
using (public.has_admin_permission('business-settings'))
with check (public.has_admin_permission('business-settings'));

create policy "Subadmin public company fields by section"
on public.business_public_fields for all to authenticated
using (public.has_admin_permission('business-settings'))
with check (public.has_admin_permission('business-settings'));

-- E. Bank accounts are a separate and independent permission.
create policy "Subadmin bank accounts by section"
on public.business_bank_accounts for all to authenticated
using (public.has_admin_permission('bank-settings'))
with check (public.has_admin_permission('bank-settings'));

-- F. Settings all share one row. NEVER create a broad subadmin UPDATE policy
-- on public.site_settings: RLS is row-based, and cannot limit specific columns.
-- These SECURITY DEFINER functions update only the exact settings named.
-- The owner-only direct site_settings policy remains unchanged.

create or replace function public.admin_set_site_toggle(
  p_key text, p_value boolean
) returns void language plpgsql security definer
set search_path=public,pg_temp as $fn$
begin
  if not public.has_admin_permission('site-settings') then
    raise exception 'Site-settings permission required' using errcode='42501';
  end if;
  if p_key is null or p_key not in
     ('require_customer_lead','pwa_install_enabled','quote_list_enabled')
     or p_value is null then
    raise exception 'Invalid site toggle' using errcode='22023';
  end if;
  update public.site_settings set
    require_customer_lead = case when p_key='require_customer_lead'
      then p_value else require_customer_lead end,
    pwa_install_enabled = case when p_key='pwa_install_enabled'
      then p_value else pwa_install_enabled end,
    quote_list_enabled = case when p_key='quote_list_enabled'
      then p_value else quote_list_enabled end
  where id=1;
  if not found then raise exception 'Site settings are missing' using errcode='P0002'; end if;
end;
$fn$;

-- Filter customization is deliberately isolated from all other site settings.
create or replace function public.admin_save_catalog_filters(
  p_filter_keys text[], p_custom_filters jsonb
) returns void language plpgsql security definer
set search_path=public,pg_temp as $fn$
declare
  v_standard constant text[] := array[
    'availability','sku','wattage','lumens','cct','cri','voltage',
    'ip_rating','dimensions','color','material','beam_angle',
    'frequency','warranty','bulb_base','bulb_count'
  ]::text[];
begin
  if not public.has_admin_permission('search-filters') then
    raise exception 'Search-filters permission required' using errcode='42501';
  end if;
  if p_filter_keys is null or cardinality(p_filter_keys)>36
    or p_custom_filters is null or jsonb_typeof(p_custom_filters)<>'array'
    or jsonb_array_length(p_custom_filters)>20 then
    raise exception 'Invalid filter list' using errcode='22023';
  end if;
  if exists(
    select 1 from jsonb_array_elements(p_custom_filters) as x(item)
    where jsonb_typeof(x.item) is distinct from 'object'
      or coalesce(x.item->>'key','') !~ '^custom_filter_[a-z0-9]+
  ) then
    raise exception 'Invalid custom filter definition' using errcode='22023';
  end if;
  if exists(
    select 1 from jsonb_array_elements(p_custom_filters) as x(item)
    group by item->>'key' having count(*)>1
  ) then
    raise exception 'Duplicate custom filter ID' using errcode='22023';
  end if;
  if exists (
    select 1 from unnest(p_filter_keys) as k(key)
    where k.key is null or (
      k.key <> all(v_standard)
      and not exists(
        select 1 from jsonb_array_elements(p_custom_filters) as x(item)
        where x.item->>'key'=k.key
      )
    )
  ) or cardinality(p_filter_keys) <> (select count(distinct k.key) from unnest(p_filter_keys) k(key))
  then
    raise exception 'Invalid or duplicate active filter' using errcode='22023';
  end if;
  update public.site_settings
  set catalog_filter_keys=p_filter_keys, catalog_custom_filters=p_custom_filters
  where id=1;
  if not found then raise exception 'Site settings are missing' using errcode='P0002'; end if;
end;
$fn$;

-- Template fields are changed one at a time; no access to other site settings.
create or replace function public.admin_set_template_field(
  p_key text, p_value text
) returns void language plpgsql security definer
set search_path=public,pg_temp as $fn$
begin
  if not public.has_admin_permission('template-settings') then
    raise exception 'Template-settings permission required' using errcode='42501';
  end if;
  if p_key is null or p_key not in
    ('master_barcode_path','design_footer_number','design_footer_label')
    or p_value is null then
    raise exception 'Invalid template field' using errcode='22023';
  end if;
  if p_key='master_barcode_path' then
    if p_value<>'' and p_value !~
      '^site-settings/master-barcode-[0-9a-fA-F-]{36}\.(png|jpg|webp|svg)$' then
      raise exception 'Invalid barcode path' using errcode='22023';
    end if;
  elsif length(p_value)>40 then
    raise exception 'Template field exceeds allowed length' using errcode='22023';
  end if;
  update public.site_settings set
    master_barcode_path=case when p_key='master_barcode_path'
      then p_value else master_barcode_path end,
    design_footer_number=case when p_key='design_footer_number'
      then p_value else design_footer_number end,
    design_footer_label=case when p_key='design_footer_label'
      then p_value else design_footer_label end
  where id=1;
  if not found then raise exception 'Site settings are missing' using errcode='P0002'; end if;
end;
$fn$;

-- Save the two related footer fields as a single atomic, scoped update.
create or replace function public.admin_save_template_footer(
  p_number text, p_label text
) returns void language plpgsql security definer
set search_path=public,pg_temp as $fn$
begin
  if not public.has_admin_permission('template-settings') then
    raise exception 'Template-settings permission required' using errcode='42501';
  end if;
  if p_number is null or p_label is null
    or length(p_number)>40 or length(p_label)>40 then
    raise exception 'Invalid footer values' using errcode='22023';
  end if;
  update public.site_settings
    set design_footer_number=p_number,design_footer_label=p_label
  where id=1;
  if not found then raise exception 'Site settings are missing' using errcode='P0002'; end if;
end;
$fn$;

-- Postgres defaults EXECUTE to PUBLIC for new functions; revoke explicitly.
revoke all on function public.admin_set_site_toggle(text,boolean) from public,anon;
revoke all on function public.admin_save_catalog_filters(text[],jsonb) from public,anon;
revoke all on function public.admin_set_template_field(text,text) from public,anon;
revoke all on function public.admin_save_template_footer(text,text) from public,anon;
grant execute on function public.admin_set_site_toggle(text,boolean) to authenticated;
grant execute on function public.admin_save_catalog_filters(text[],jsonb) to authenticated;
grant execute on function public.admin_set_template_field(text,text) to authenticated;
grant execute on function public.admin_save_template_footer(text,text) to authenticated;

-- G. Barcode files: permit only site-settings/ namespace for template editors.
-- The product-images bucket's other folders, including site-assets, stay governed
-- by existing policies. The server enforces folder checks even for direct API calls.
drop policy if exists "Subadmin template barcode files" on storage.objects;
create policy "Subadmin template barcode files"
on storage.objects for all to authenticated
using (
  bucket_id='product-images'
  and coalesce((storage.foldername(name))[1],'')='site-settings'
  and name ~ '^site-settings/master-barcode-[0-9a-fA-F-]{36}\.(png|jpg|webp|svg)$'
  and public.has_admin_permission('template-settings')
)
with check (
  bucket_id='product-images'
  and coalesce((storage.foldername(name))[1],'')='site-settings'
  and name ~ '^site-settings/master-barcode-[0-9a-fA-F-]{36}\.(png|jpg|webp|svg)$'
  and public.has_admin_permission('template-settings')
);

commit;

-- READ-ONLY verification queries for a future authorized migration review:
-- select conname, pg_get_constraintdef(oid) from pg_constraint
--   where conrelid='public.admin_users'::regclass
--     and conname='admin_users_permissions_check';
-- select policyname, cmd, qual, with_check from pg_policies
--   where schemaname='public' and tablename='site_settings';
-- select proname, prosecdef from pg_proc where proname in
--   ('admin_set_site_toggle','admin_save_catalog_filters','admin_set_template_field');
--
-- SECURITY NEGATIVE TESTS REQUIRED BEFORE THE OWNER ENABLES ANY NEW KEY:
-- 1) anon/no-login calls to all 4 RPCs: DENIED.
-- 2) subadmin with only 'analytics','datasheet','leads':
--    every new settings RPC and business/bank write DENIED.
-- 3) with ONLY search-filters: update filters allowed; changing PWA, barcode,
--    privacy fields, banks, credentials and permissions DENIED.
-- 4) with ONLY site-settings: toggle allowed; filters and barcode DENIED.
-- 5) with ONLY template-settings: barcode/footers allowed; other settings
--    and Storage outside site-settings/master-barcode-* DENIED.
-- 6) with ONLY business-settings: business tables allowed; banks DENIED.
-- 7) with ONLY bank-settings: banks allowed; business/privacy DENIED.
-- 8) sections-only may not delete a category; sections + products may.
-- 9) owner-only account management and permission grants remain DENIED.
-- 10) verify no change to existing subadmin assignments after migration.

      or length(coalesce(x.item->>'key',''))>40
      or coalesce(length(btrim(x.item->>'label')),0) not between 1 and 50
      or (x.item - 'key' - 'label') <> '{}'::jsonb
      or jsonb_typeof(x.item->'key') is distinct from 'string'
      or jsonb_typeof(x.item->'label') is distinct from 'string'
  ) then
    raise exception 'Invalid custom filter definition' using errcode='22023';
  end if;
  if exists(
    select 1 from jsonb_array_elements(p_custom_filters) as x(item)
    group by item->>'key' having count(*)>1
  ) then
    raise exception 'Duplicate custom filter ID' using errcode='22023';
  end if;
  if exists (
    select 1 from unnest(p_filter_keys) as k(key)
    where k.key is null or (
      k.key <> all(v_standard)
      and not exists(
        select 1 from jsonb_array_elements(p_custom_filters) as x(item)
        where x.item->>'key'=k.key
      )
    )
  ) or cardinality(p_filter_keys) <> (select count(distinct k.key) from unnest(p_filter_keys) k(key))
  then
    raise exception 'Invalid or duplicate active filter' using errcode='22023';
  end if;
  update public.site_settings
  set catalog_filter_keys=p_filter_keys, catalog_custom_filters=p_custom_filters
  where id=1;
  if not found then raise exception 'Site settings are missing' using errcode='P0002'; end if;
end;
$fn$;

-- Template fields are changed one at a time; no access to other site settings.
create or replace function public.admin_set_template_field(
  p_key text, p_value text
) returns void language plpgsql security definer
set search_path=public,pg_temp as $fn$
begin
  if not public.has_admin_permission('template-settings') then
    raise exception 'Template-settings permission required' using errcode='42501';
  end if;
  if p_key is null or p_key not in
    ('master_barcode_path','design_footer_number','design_footer_label')
    or p_value is null then
    raise exception 'Invalid template field' using errcode='22023';
  end if;
  if p_key='master_barcode_path' then
    if p_value<>'' and p_value !~
      '^site-settings/master-barcode-[0-9a-fA-F-]{36}\.(png|jpg|webp|svg)$' then
      raise exception 'Invalid barcode path' using errcode='22023';
    end if;
  elsif length(p_value)>40 then
    raise exception 'Template field exceeds allowed length' using errcode='22023';
  end if;
  update public.site_settings set
    master_barcode_path=case when p_key='master_barcode_path'
      then p_value else master_barcode_path end,
    design_footer_number=case when p_key='design_footer_number'
      then p_value else design_footer_number end,
    design_footer_label=case when p_key='design_footer_label'
      then p_value else design_footer_label end
  where id=1;
  if not found then raise exception 'Site settings are missing' using errcode='P0002'; end if;
end;
$fn$;

-- Postgres defaults EXECUTE to PUBLIC for new functions; revoke explicitly.
revoke all on function public.admin_set_site_toggle(text,boolean) from public,anon;
revoke all on function public.admin_save_catalog_filters(text[],jsonb) from public,anon;
revoke all on function public.admin_set_template_field(text,text) from public,anon;
grant execute on function public.admin_set_site_toggle(text,boolean) to authenticated;
grant execute on function public.admin_save_catalog_filters(text[],jsonb) to authenticated;
grant execute on function public.admin_set_template_field(text,text) to authenticated;

-- G. Barcode files: permit only site-settings/ namespace for template editors.
-- The product-images bucket's other folders, including site-assets, stay governed
-- by existing policies. The server enforces folder checks even for direct API calls.
create policy "Subadmin template barcode files"
on storage.objects for all to authenticated
using (
  bucket_id='product-images'
  and coalesce((storage.foldername(name))[1],'')='site-settings'
  and name ~ '^site-settings/master-barcode-[0-9a-fA-F-]{36}\.(png|jpg|webp|svg)$'
  and public.has_admin_permission('template-settings')
)
with check (
  bucket_id='product-images'
  and coalesce((storage.foldername(name))[1],'')='site-settings'
  and name ~ '^site-settings/master-barcode-[0-9a-fA-F-]{36}\.(png|jpg|webp|svg)$'
  and public.has_admin_permission('template-settings')
);

commit;

-- READ-ONLY verification queries for a future authorized migration review:
-- select conname, pg_get_constraintdef(oid) from pg_constraint
--   where conrelid='public.admin_users'::regclass
--     and conname='admin_users_permissions_check';
-- select policyname, cmd, qual, with_check from pg_policies
--   where schemaname='public' and tablename='site_settings';
-- select proname, prosecdef from pg_proc where proname in
--   ('admin_set_site_toggle','admin_save_catalog_filters','admin_set_template_field');
--
-- SECURITY NEGATIVE TESTS REQUIRED BEFORE THE OWNER ENABLES ANY NEW KEY:
-- 1) anon/no-login calls to all 4 RPCs: DENIED.
-- 2) subadmin with only 'analytics','datasheet','leads':
--    every new settings RPC and business/bank write DENIED.
-- 3) with ONLY search-filters: update filters allowed; changing PWA, barcode,
--    privacy fields, banks, credentials and permissions DENIED.
-- 4) with ONLY site-settings: toggle allowed; filters and barcode DENIED.
-- 5) with ONLY template-settings: barcode/footers allowed; other settings
--    and Storage outside site-settings/master-barcode-* DENIED.
-- 6) with ONLY business-settings: business tables allowed; banks DENIED.
-- 7) with ONLY bank-settings: banks allowed; business/privacy DENIED.
-- 8) sections-only may not delete a category; sections + products may.
-- 9) owner-only account management and permission grants remain DENIED.
-- 10) verify no change to existing subadmin assignments after migration.
