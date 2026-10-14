import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const master=read('SUPABASE_SETUP.sql');
const delta=read('supabase/PROPOSED_ADMIN_12_PERMISSIONS_REVIEW_ONLY.sql').trim();
const allowed=[
 'analytics','datasheet','profile','contacts','leads',
 'sections','products','search-filters','template-settings',
 'site-settings','business-settings','bank-settings'
];
const beginMarker='-- BEGIN REVIEWED ADMIN 12-SECTION RECONCILIATION';
const endMarker='-- END REVIEWED ADMIN 12-SECTION RECONCILIATION';
assert.equal(master.split(beginMarker).length,2,'Only one reviewed migration marker in master');
assert.equal(master.split(endMarker).length,2,'Only one reviewed migration tail in master');
const begin=master.indexOf('-- FLOWER LIGHT — ADMIN 12-SECTION DELEGATION (REVIEW ONLY / NOT APPROVED)',master.indexOf(beginMarker));
const end=master.indexOf(endMarker);
assert.ok(begin>=0 && end>begin,'Reviewed migration region must exist inside master');
const embedded=master.slice(begin,end).trim();
assert.equal(embedded,delta,'Master migration tail differs from reviewed incremental SQL; regenerate before merging');
assert.match(master.slice(0,2000),/do NOT rerun this historical consolidated master/i);
assert.match(master.slice(0,1200),/DO NOT EXECUTE THIS FULL MASTER/i);
const legacy=master.slice(0,master.indexOf(beginMarker));
const checks=[
 ['historical normalizer',/where p\.permission\s*=\s*any\(array\[([\s\S]*?)\]::text\[\]\)/g],
 ['historical constraints',/permissions\s*<@\s*array\[([\s\S]*?)\]::text\[\]/g],
 ['historical grant whitelist',/v_allowed constant text\[\]\s*:=\s*array\[([\s\S]*?)\]::text\[\]/g]
];
for(const [name,re] of checks){
 const found=[...legacy.matchAll(re)];
 assert.equal(found.length,3,'There must be exactly three '+name+' definitions');
 for(const [index,match] of found.entries()){
  const tokens=[...match[1].matchAll(/'([^']+)'/g)].map(x=>x[1]);
  for(const key of allowed){
   assert.ok(tokens.includes(key),'Legacy '+name+' #'+(index+1)+' strips '+key);
  }
 }
}
const stage=legacy.slice(legacy.indexOf('-- STAGE88 ADMIN=2 LEGACY ROLE COMPATIBILITY'));
assert.ok(stage.length>500);
assert.match(stage,/role='owner'/);
assert.doesNotMatch(stage.slice(0,450),/only the five/i);
assert.match(delta,/has_admin_permission\('leads'\)/);
assert.match(delta,/grant execute on function public\.purge_expired_customer_leads\(\) to authenticated,service_role/);
// Neither the master nor incremental migration grants account management to subadmin.
const ownerOnlyKeys=delta.match(/v_allowed constant text\[\]\s*:=\s*array\[([\s\S]*?)\]::text\[\]/)?.[1]||'';
assert.ok(ownerOnlyKeys);
assert.doesNotMatch(ownerOnlyKeys,/'(?:credentials|permissions)'/);
const altered=master.replace("'search-filters','template-settings'","'template-settings'");
assert.notEqual(altered,master,'Test mutation must change source');
const legacyBroken=altered.slice(0,altered.indexOf(beginMarker));
const arrays=[...legacyBroken.matchAll(checks[0][1])];
assert.ok(arrays.some(x=>![...x[1].matchAll(/'([^']+)'/g)].map(m=>m[1]).includes('search-filters')));
console.log('ADMIN_12_MASTER_COMPAT_OK: historical lists retain 12 keys and embedded delta matches exactly');
