-- Flower Light / Basair Gulf — upgrade an EXISTING v103 database to v105.
-- Run only after:
--   1) Cloudflare Turnstile is created.
--   2) TURNSTILE_SECRET_KEY and LEAD_RATE_LIMIT_PEPPER are saved in Supabase Secrets.
--   3) submit-customer-lead Edge Function is deployed.
--   4) config.js contains the public Turnstile Site key.
--
-- This file intentionally combines the v104 lead-security migration and the
-- v105 retention migration so an existing manually-maintained database can be
-- upgraded from Supabase SQL Editor without relying on CLI migration history.

-- v104: move public customer-lead writes behind the Turnstile Edge Function.
-- IMPORTANT: deploy submit-customer-lead and configure TURNSTILE_SECRET_KEY + config.js site key
-- BEFORE applying this migration to an existing live database.

create table if not exists public.customer_lead_rate_limits (
  key_hash text primary key check (char_length(key_hash) = 64),
  window_started_at timestamptz not null default now(),
  hits integer not null default 0 check (hits >= 0),
  updated_at timestamptz not null default now()
);

alter table public.customer_lead_rate_limits enable row level security;
revoke all on table public.customer_lead_rate_limits from public, anon, authenticated;
grant select, insert, update, delete on table public.customer_lead_rate_limits to service_role;

create index if not exists customer_lead_rate_limits_updated_idx
on public.customer_lead_rate_limits (updated_at);

create or replace function public.consume_customer_lead_rate_limit(
  p_key text,
  p_limit integer default 8,
  p_window_seconds integer default 300
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_row public.customer_lead_rate_limits%rowtype;
begin
  if p_key is null or char_length(p_key) <> 64 or p_limit < 1 or p_window_seconds < 30 then
    return false;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_key, 0));

  -- Small bounded cleanup; only salted hashes are stored and old rows disappear automatically.
  delete from public.customer_lead_rate_limits
  where updated_at < v_now - interval '7 days';

  select * into v_row
  from public.customer_lead_rate_limits
  where key_hash = p_key
  for update;

  if not found then
    insert into public.customer_lead_rate_limits(key_hash, window_started_at, hits, updated_at)
    values (p_key, v_now, 1, v_now);
    return true;
  end if;

  if v_now >= v_row.window_started_at + make_interval(secs => p_window_seconds) then
    update public.customer_lead_rate_limits
    set window_started_at = v_now, hits = 1, updated_at = v_now
    where key_hash = p_key;
    return true;
  end if;

  if v_row.hits >= p_limit then
    update public.customer_lead_rate_limits set updated_at = v_now where key_hash = p_key;
    return false;
  end if;

  update public.customer_lead_rate_limits
  set hits = hits + 1, updated_at = v_now
  where key_hash = p_key;
  return true;
end;
$$;

revoke all on function public.consume_customer_lead_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_customer_lead_rate_limit(text, integer, integer) to service_role;

-- Remove the old whole-site 20/5-minute trigger. It allowed one source to exhaust the quota for everyone.
drop trigger if exists customer_leads_rate_limit on public.customer_leads;
drop function if exists public.enforce_customer_lead_rate_limit();

-- Browser clients can no longer write leads directly. The Edge Function uses service_role after Turnstile validation.
revoke insert on table public.customer_leads from anon;

select 'TURNSTILE_CUSTOMER_LEADS_V104_OK' as status;


-- ============================================================================
-- V105 RETENTION
-- ============================================================================

-- v105: enforce the configured customer-lead retention period.
-- The value comes from business_privacy_settings.retention_days (default 180).
-- Cleanup runs daily when pg_cron is available, and application fallbacks call
-- this function after a successful lead insert / when admins open lead data.

create or replace function public.purge_expired_customer_leads()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_keep_days integer := 180;
  v_deleted integer := 0;
  v_role text := coalesce(auth.role(), '');
begin
  if v_role = 'authenticated' and not public.is_site_admin() then
    raise exception 'Not authorized';
  end if;

  select greatest(1, least(36500, coalesce(retention_days,180)))
    into v_keep_days
  from public.business_privacy_settings
  where id = 1;

  v_keep_days := coalesce(v_keep_days,180);

  delete from public.customer_leads
  where created_at < now() - make_interval(days => v_keep_days);

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.purge_expired_customer_leads() from public, anon;
grant execute on function public.purge_expired_customer_leads() to authenticated, service_role;

-- Schedule daily cleanup only when pg_cron is already enabled.
do $$
declare
  v_has_cron boolean := false;
begin
  select exists (
    select 1
    from pg_namespace n
    join pg_proc p on p.pronamespace = n.oid
    where n.nspname = 'cron' and p.proname = 'schedule'
  ) into v_has_cron;

  if v_has_cron then
    begin
      execute $sql$
        select cron.unschedule(jobid)
        from cron.job
        where jobname = 'flower-light-customer-leads-retention'
      $sql$;
    exception when others then
      raise notice 'Could not remove an existing customer-lead retention job: %', sqlerrm;
    end;

    begin
      execute $sql$
        select cron.schedule(
          'flower-light-customer-leads-retention',
          '40 2 * * *',
          'select public.purge_expired_customer_leads();'
        )
      $sql$;
      raise notice 'Customer-lead retention scheduled with pg_cron.';
    exception when others then
      raise notice 'pg_cron exists but scheduling customer-lead retention failed: %', sqlerrm;
    end;
  else
    raise notice 'pg_cron is not available; application cleanup fallbacks remain active.';
  end if;
end $$;

-- Enforce the configured retention immediately when the migration is applied.
select public.purge_expired_customer_leads() as deleted_expired_customer_leads;
select 'CUSTOMER_LEAD_RETENTION_V105_OK' as status;
