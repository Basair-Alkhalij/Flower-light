-- Flower Light — opt-in MFA protection for administrator API access.
-- REVIEWED CHANGE / manually applied only after Edge function is deployed.
-- When an admin has no verified factor, their current access remains unchanged.
-- Once a factor is verified, AAL1 JWTs lose admin privileges; AAL2 is required.
-- Do not extend this guard to the independent recovery-email account:
-- that account is not an admin and must retain its protected recovery route.
begin;

create schema if not exists flower_light_security;
revoke all on schema flower_light_security from public, anon, authenticated;

create or replace function flower_light_security.admin_mfa_session_allowed()
returns boolean
language sql
stable security definer
set search_path = ''
as $mfa$
  select auth.uid() is not null
     and (
       not exists (
         select 1
         from auth.mfa_factors f
         where f.user_id = auth.uid()
           and f.status = 'verified'
       )
       or coalesce(auth.jwt()->>'aal','aal1') = 'aal2'
     );
$mfa$;
revoke all on function flower_light_security.admin_mfa_session_allowed() from public, anon, authenticated;

-- Keep the original owner/subadmin permission model. Add only session assurance.
create or replace function public.is_site_owner()
returns boolean
language sql
stable security definer
set search_path to 'public'
as $owner$
  select flower_light_security.admin_mfa_session_allowed()
     and exists (
       select 1 from public.admin_users a
       where a.user_id = auth.uid() and a.role = 'owner'
     );
$owner$;

create or replace function public.is_site_admin()
returns boolean
language sql
stable security definer
set search_path to 'public'
as $admin$
  select flower_light_security.admin_mfa_session_allowed()
     and exists (
       select 1 from public.admin_users a
       where a.user_id = auth.uid() and a.role in ('owner','subadmin')
     );
$admin$;

create or replace function public.has_admin_permission(p_permission text)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $permission$
  select flower_light_security.admin_mfa_session_allowed()
     and exists (
       select 1 from public.admin_users a
       where a.user_id=auth.uid()
         and (a.role='owner' or (a.role='subadmin' and p_permission=any(a.permissions)))
     );
$permission$;

-- get_current_admin_access previously exposed role and email even at AAL1.
-- The login UI calls it only after the TOTP challenge has been completed.
create or replace function public.get_current_admin_access()
returns jsonb
language plpgsql
stable security definer
set search_path to 'public','auth'
as $access$
declare
  v_role text;
  v_permissions text[];
  v_email text;
begin
  if not flower_light_security.admin_mfa_session_allowed() then
    return jsonb_build_object('role','','permissions','[]'::jsonb,'email','');
  end if;
  select a.role,a.permissions,u.email
  into v_role,v_permissions,v_email
  from public.admin_users a left join auth.users u on u.id=a.user_id
  where a.user_id=auth.uid();
  return jsonb_build_object(
    'role',coalesce(v_role,''),
    'permissions',coalesce(v_permissions,'{}'::text[]),
    'email',coalesce(v_email,'')
  );
end;
$access$;

-- Block direct owner/subadmin membership introspection at AAL1.
-- Other owner policies already call is_site_owner().
drop policy if exists "Subadmin views own admin row" on public.admin_users;
create policy "Subadmin views own admin row"
on public.admin_users
for select to authenticated
using (user_id = (select auth.uid()) and (select public.is_site_admin()));

commit;

-- Verification examples (read-only):
-- select public.is_site_owner(), public.is_site_admin(), public.has_admin_permission('products');
-- select role,count(*) from public.admin_users group by role;
-- select count(*) from auth.mfa_factors where status='verified' and user_id in (select user_id from public.admin_users);
-- A manual negative test with AAL1 token from a *verified-factor* admin is mandatory:
-- owner settings edit, product INSERT, bank accounts UPDATE, storage UPLOAD, and admin RPC must fail.
