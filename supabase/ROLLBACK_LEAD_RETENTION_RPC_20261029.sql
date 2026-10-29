-- Rollback (execute only if a compatibility regression is confirmed).
-- Restores the pre-audit authenticated grant. It does not run a data purge.
BEGIN;
GRANT EXECUTE ON FUNCTION public.purge_expired_customer_leads() TO authenticated;
COMMIT;
