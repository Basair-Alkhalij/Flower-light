-- Rollback for Flower Light optional admin MFA database guard.

-- Restores the exact original 2026-10-29 production helper definitions.

begin;

CREATE OR REPLACE FUNCTION public.get_current_admin_access()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare
  v_role text;
  v_permissions text[];
  v_email text;
begin
  select a.role, a.permissions, u.email
  into v_role, v_permissions, v_email
  from public.admin_users a
  left join auth.users u on u.id = a.user_id
  where a.user_id = auth.uid();

  return jsonb_build_object(
    'role', coalesce(v_role,''),
    'permissions', coalesce(v_permissions,'{}'::text[]),
    'email', coalesce(v_email,'')
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.has_admin_permission(p_permission text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from public.admin_users a
    where a.user_id = auth.uid()
      and (
        a.role = 'owner'
        or (
          a.role = 'subadmin'
          and p_permission = any(a.permissions)
        )
      )
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_site_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from public.admin_users a
    where a.user_id = auth.uid()
      and a.role in ('owner','subadmin')
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_site_owner()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from public.admin_users a
    where a.user_id = auth.uid()
      and a.role = 'owner'
  );
$function$;

drop policy if exists "Subadmin views own admin row" on public.admin_users;

create policy "Subadmin views own admin row" on public.admin_users for select to authenticated using (user_id = auth.uid());

drop function if exists flower_light_security.admin_mfa_session_allowed();

drop schema if exists flower_light_security;

commit;
