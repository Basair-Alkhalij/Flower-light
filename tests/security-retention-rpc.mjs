import assert from 'node:assert/strict';
import fs from 'node:fs';
const sql=fs.readFileSync(new URL('../supabase/RESTRICT_LEAD_RETENTION_RPC_20261029.sql',import.meta.url),'utf8');
const rollback=fs.readFileSync(new URL('../supabase/ROLLBACK_LEAD_RETENTION_RPC_20261029.sql',import.meta.url),'utf8');
const admin=fs.readFileSync(new URL('../admin.js',import.meta.url),'utf8');
const edge=fs.readFileSync(new URL('../supabase/functions/submit-customer-lead/index.ts',import.meta.url),'utf8');
assert.match(sql,/REVOKE EXECUTE ON FUNCTION public\.purge_expired_customer_leads\(\)\s+FROM PUBLIC, anon, authenticated/i);
assert.match(sql,/GRANT EXECUTE ON FUNCTION public\.purge_expired_customer_leads\(\)\s+TO service_role/i);
assert.match(rollback,/GRANT EXECUTE ON FUNCTION public\.purge_expired_customer_leads\(\) TO authenticated/i);
assert.doesNotMatch(admin,/['"]purge_expired_customer_leads['"]/,
  'Admin browser must not rely on retention RPC');
assert.match(edge,/admin\.rpc\('purge_expired_customer_leads'\)/,
  'Lead submission Edge Function still needs service_role execution');
assert.doesNotMatch(sql,/DROP\s+(TABLE|FUNCTION)|TRUNCATE|DELETE\s+FROM/i,
  'Permission migration must not drop or remove user data');
console.log('LEAD_RETENTION_RPC_LEAST_PRIVILEGE_OK');
