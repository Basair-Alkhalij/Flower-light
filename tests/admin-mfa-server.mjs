import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const sql=read('supabase/PROPOSED_MFA_AAL2_REVIEW_ONLY.sql');
const edge=read('supabase/functions/manage-admin-account/index.ts');
const admin=read('admin.js');

assert.match(sql,/create schema if not exists flower_light_security/i);
assert.match(sql,/revoke all on schema flower_light_security from public, anon, authenticated/i);
assert.match(sql,/from auth\.mfa_factors f[\s\S]*?f\.user_id = auth\.uid\(\)[\s\S]*?f\.status = 'verified'/i);
assert.match(sql,/auth\.jwt\(\)->>'aal'\s*,\s*'aal1'\)\s*=\s*'aal2'/i);
for(const helper of ['is_site_owner','is_site_admin','has_admin_permission']){
  const part=sql.split('create or replace function public.'+helper+'(')[1]?.split(';')[0]||'';
  assert.match(part,/flower_light_security\.admin_mfa_session_allowed\(\)/,
    'Admin helper must enforce MFA: '+helper);
}
assert.match(sql,/get_current_admin_access\(\)[\s\S]*?admin_mfa_session_allowed\(\)/);
assert.match(sql,/using \(user_id = \(select auth\.uid\(\)\) and \(select public\.is_site_admin\(\)\)\)/);
assert.doesNotMatch(sql,/on public\.customer_leads.*as restrictive/i,
  'Do not accidentally block public customer lead handling');
assert.match(edge,/Authorization: `Bearer \$\{token\}`/);
assert.match(edge,/\/rest\/v1\/rpc\/is_site_owner/);
assert.match(edge,/const isOwner = Boolean\(ownerAccess\) && await hasOwnerMfaSession/);
assert.match(admin,/persistSession:false,autoRefreshToken:false,detectSessionInUrl:false/,
  'Owner password confirmation must not downgrade the active AAL2 session');
console.log('ADMIN_MFA_SERVER_GUARD_OK');
