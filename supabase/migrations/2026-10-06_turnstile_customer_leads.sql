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
