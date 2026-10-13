-- Global best-effort anti-flood ceilings for analytics.
-- Replaces only the logging RPC body; preserves parameters, permissions,
-- allowed event names, per-browser limits, and existing event records.
-- 120 events per rolling minute, 1,500 per rolling hour across all visitors.
-- Concurrent calls that cannot obtain the transaction lock are dropped.
create or replace function public.log_site_event(
  p_event_name text,
  p_event_label text default '',
  p_visitor_id text default '',
  p_session_id text default '',
  p_page_path text default '/',
  p_metadata jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event text := lower(trim(coalesce(p_event_name,'')));
  v_label text := left(trim(coalesce(p_event_label,'')),180);
  v_visitor text := left(trim(coalesce(p_visitor_id,'')),80);
  v_session text := left(trim(coalesce(p_session_id,'')),80);
  v_path text := left(coalesce(nullif(trim(p_page_path),''),'/'),300);
  v_meta jsonb := coalesce(p_metadata,'{}'::jsonb);
begin
  if v_event not in (
    'page_view',
    'products_open',
    'product_category_view',
    'product_image_open',
    'product_gallery_navigation',
    'product_whatsapp_click',
    'catalog_download',
    'contact_phone',
    'contact_whatsapp',
    'contact_location',
    'customer_lead_saved',
    'save_contact',
    'quote_cart_add',
    'quote_cart_open',
    'quote_whatsapp_submit',
    'quote_image_open',
    'quote_image_submit'
  ) then
    return false;
  end if;

  if char_length(v_visitor) < 8 or char_length(v_session) < 8 then
    return false;
  end if;

  if jsonb_typeof(v_meta) is distinct from 'object' or octet_length(v_meta::text) > 4000 then
    v_meta := '{}'::jsonb;
  end if;

  -- Fail closed when another analytics write holds the global transaction lock.
  -- This serializes the global cap checks without queueing public RPC traffic.
  if not pg_try_advisory_xact_lock(57452026, 6) then
    return false;
  end if;

  -- Global rolling ceilings independent of untrusted browser visitor/session IDs.
  -- Both checks use analytics_events_created_at_idx and stop at the threshold.
  if exists (
    select 1 from public.analytics_events e
    where e.created_at >= now() - interval '1 minute'
    order by e.created_at desc
    offset 119 limit 1
  ) then return false; end if;

  if exists (
    select 1 from public.analytics_events e
    where e.created_at >= now() - interval '1 hour'
    order by e.created_at desc
    offset 1499 limit 1
  ) then return false; end if;

  if exists (
    select 1 from public.analytics_events e
    where e.session_id=v_session
      and e.created_at >= now()-interval '1 minute'
    order by e.created_at desc
    offset 119 limit 1
  ) then return false; end if;

  if exists (
    select 1 from public.analytics_events e
    where e.visitor_id=v_visitor
      and e.created_at >= now()-interval '1 minute'
    order by e.created_at desc
    offset 239 limit 1
  ) then return false; end if;

  if exists (
    select 1 from public.analytics_events e
    where e.session_id=v_session
      and e.event_name=v_event
      and e.event_label=v_label
      and e.created_at >= now()-interval '1 second'
  ) then return false; end if;

  insert into public.analytics_events(event_name,event_label,visitor_id,session_id,page_path,metadata)
  values(v_event,v_label,v_visitor,v_session,v_path,v_meta);
  return true;
end;
$$;
