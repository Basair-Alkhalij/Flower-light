-- Flower Light · SECURITY DEFINER least-privilege phase 3 (2026-10-29)
-- Intended production change, verified against the active Supabase project.
--
-- The customer retention purge is called only by:
--   * the scheduled pg_cron job (username=postgres); and
--   * the submit-customer-lead Edge Function (service_role).
-- It is not invoked by the admin browser code. Therefore arbitrary authenticated
-- sessions should NOT be given EXECUTE on this SECURITY DEFINER delete operation.
--
-- Keep the service_role and postgres paths operational; do not disable the cron.
BEGIN;
REVOKE EXECUTE ON FUNCTION public.purge_expired_customer_leads()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_expired_customer_leads()
  TO service_role;
COMMIT;

-- Read-only verification:
-- SELECT has_function_privilege('anon','public.purge_expired_customer_leads()','EXECUTE') AS anon,
--        has_function_privilege('authenticated','public.purge_expired_customer_leads()','EXECUTE') AS authenticated,
--        has_function_privilege('service_role','public.purge_expired_customer_leads()','EXECUTE') AS worker;
-- Expected: false, false, true. Do NOT run purge just to test.
