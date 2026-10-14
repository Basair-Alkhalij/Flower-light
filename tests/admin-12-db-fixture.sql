-- TEST FIXTURE: SYNTHETIC ROWS ONLY. Disposable PostgreSQL CI database.
-- Never execute this file against a Supabase project.
create role authenticated nologin;
create role anon nologin;
create role service_role nologin;
create schema auth;
create schema storage;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
create function auth.role() returns text language sql stable as $role$
  select nullif(current_setting('request.jwt.claim.role',true),'')
$role$;
create table auth.users(id uuid primary key,email text unique not null);
insert into auth.users values
 ('11111111-1111-4111-8111-111111111111','owner@example.invalid'),
 ('22222222-2222-4222-8222-222222222222','assistant@example.invalid');
create table public.admin_users (
 user_id uuid primary key,
 role text not null,
 permissions text[] not null default array[]::text[],
 constraint admin_users_permissions_check check (
   permissions <@ array['analytics','datasheet','profile','contacts','leads']::text[]
 )
);
insert into public.admin_users values
 ('11111111-1111-4111-8111-111111111111','owner','{}'),
 ('22222222-2222-4222-8222-222222222222','subadmin',array['leads']);
create function public.is_site_owner() returns boolean
 language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from admin_users
   where user_id=auth.uid() and role='owner')
$$;
create function public.has_admin_permission(permission text) returns boolean
 language sql stable security definer set search_path=public,pg_temp as $$
 select exists(select 1 from admin_users
  where user_id=auth.uid()
   and (role='owner' or (role='subadmin' and permission=any(permissions))))
$$;
revoke all on function public.is_site_owner() from public,anon;
revoke all on function public.has_admin_permission(text) from public,anon;
grant execute on function public.is_site_owner() to authenticated;
grant execute on function public.has_admin_permission(text) to authenticated;
-- Only the signature is needed for migration preflight; the migration replaces it.
create function public.owner_set_admin2_settings(text,text[] default array[]::text[])
 returns jsonb language sql as $$select '{}'::jsonb$$;
create table public.site_settings (
 id smallint primary key,
 require_customer_lead boolean default true,
 pwa_install_enabled boolean default true,
 quote_list_enabled boolean default true,
 catalog_filter_keys text[] default array['availability']::text[],
 catalog_custom_filters jsonb default '[]'::jsonb,
 master_barcode_path text default '',
 design_footer_number text default '',
 design_footer_label text default ''
);
insert into public.site_settings(id) values(1);
create table public.business_privacy_settings (
 id int primary key,retention_days int,show_all boolean
);
insert into public.business_privacy_settings values(1,180,true);
-- Synthetic aged/fresh customer leads for permission-sensitive retention checks.
create table public.customer_leads (
 id int primary key,
 created_at timestamptz not null
);
insert into public.customer_leads(id,created_at) values
 (1,now()-interval '250 days'),(2,now()-interval '2 days');
alter table public.customer_leads enable row level security;
create policy "Admin manage leads by permission" on public.customer_leads for all
  to authenticated using(public.is_site_owner() or public.has_admin_permission('leads'))
  with check(public.is_site_owner() or public.has_admin_permission('leads'));
grant select,insert,update,delete on public.customer_leads to authenticated;
create table public.business_public_fields (
 id int primary key,label text,value text
);
create table public.business_bank_accounts (
 id int primary key,bank_name text
);
create table storage.objects (
 id int primary key,bucket_id text,name text
);
create function storage.foldername(p text) returns text[] language sql immutable as $$
 select string_to_array(p,'/')
$$;
-- Realistic owner-only default policies: no business or settings write for subadmin.
alter table public.site_settings enable row level security;
alter table public.business_privacy_settings enable row level security;
alter table public.business_public_fields enable row level security;
alter table public.business_bank_accounts enable row level security;
alter table storage.objects enable row level security;
create policy "owner site settings" on public.site_settings
 for all to authenticated using(public.is_site_owner())
 with check(public.is_site_owner());
create policy "owner company privacy" on public.business_privacy_settings
 for all to authenticated using(public.is_site_owner())
 with check(public.is_site_owner());
create policy "owner company fields" on public.business_public_fields
 for all to authenticated using(public.is_site_owner())
 with check(public.is_site_owner());
create policy "owner banks" on public.business_bank_accounts
 for all to authenticated using(public.is_site_owner())
 with check(public.is_site_owner());
create policy "owner storage" on storage.objects
 for all to authenticated using(public.is_site_owner())
 with check(public.is_site_owner());
grant usage on schema public,auth,storage to authenticated,anon;
-- The fixture's service role models the existing trusted scheduled-maintenance API role.
grant usage on schema public,auth to service_role;
grant select,insert,update,delete on
 public.site_settings,public.business_privacy_settings,
 public.business_public_fields,public.business_bank_accounts,
 storage.objects to authenticated;
grant execute on function storage.foldername(text) to authenticated;
-- Reproduce the category policies exactly as specified by the source setup.
create table public.categories(id int primary key,name text not null);
insert into public.categories values(1,'Synthetic category');
alter table public.categories enable row level security;
create policy "Admin read all categories" on public.categories for select to authenticated
  using (public.is_site_owner() or public.has_admin_permission('sections')
    or public.has_admin_permission('products'));
create policy "Admin insert categories" on public.categories for insert to authenticated
  with check(public.is_site_owner() or public.has_admin_permission('sections'));
create policy "Admin update categories" on public.categories for update to authenticated
  using(public.is_site_owner() or public.has_admin_permission('sections'))
  with check(public.is_site_owner() or public.has_admin_permission('sections'));
create policy "Admin delete categories" on public.categories for delete to authenticated
  using(public.is_site_owner() or
    (public.has_admin_permission('sections') and public.has_admin_permission('products')));
grant select,insert,update,delete on public.categories to authenticated;

