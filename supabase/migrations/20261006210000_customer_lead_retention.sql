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
