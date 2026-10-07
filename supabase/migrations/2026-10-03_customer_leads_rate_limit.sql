-- ###########################################################################
-- CUSTOMER LEAD RATE LIMIT (volume-based, adds to the existing duplicate guard)
-- ###########################################################################
-- The project already blocks a rapid duplicate of the SAME phone number
-- (public.suppress_recent_duplicate_customer_lead, 15-minute window).
-- That trigger does not limit overall VOLUME: a script could still insert
-- many leads per minute using different fake numbers, since `anon` has a
-- direct INSERT grant on public.customer_leads.
--
-- This migration adds a second trigger that caps total inserts regardless
-- of phone number. Run this in the Supabase SQL editor (or via the CLI) on
-- the live project — it cannot be applied from this environment.
--
-- Review MAX_INSERTS_PER_WINDOW / WINDOW_MINUTES below before running.

create or replace function public.enforce_customer_lead_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  max_inserts_per_window constant int := 20;      -- tune to expected real traffic
  window_minutes constant int := 5;
  recent_count int;
begin
  -- Serialize concurrent inserts before checking the count.
  perform pg_advisory_xact_lock(734211, 1);
  select count(*) into recent_count
  from public.customer_leads
  where created_at >= now() - make_interval(mins => window_minutes);

  if recent_count >= max_inserts_per_window then
    -- Fail closed with a generic error; the public form should show a
    -- friendly "please try again shortly" message on this rejection.
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_customer_lead_rate_limit() from public, anon, authenticated;

drop trigger if exists customer_leads_rate_limit on public.customer_leads;
create trigger customer_leads_rate_limit
before insert on public.customer_leads
for each row execute function public.enforce_customer_lead_rate_limit();

select 'CUSTOMER_LEAD_RATE_LIMIT_OK' as status;
