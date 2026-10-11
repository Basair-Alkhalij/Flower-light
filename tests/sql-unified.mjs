import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const normalize=sql=>sql.replace(/--[^\n]*/g,'').replace(/\s+/g,' ').trim();

const unified=normalize(read('supabase/UPGRADE_TO_V118.sql'));
const components=['supabase/UPGRADE_EXISTING_V111.sql','supabase/UPGRADE_EXISTING_V116.sql','supabase/UPGRADE_EXISTING_V117.sql','supabase/UPGRADE_CUSTOMER_LEADS_EDGE_ONLY_V118.sql'];
let cursor=0;
for(const file of components){
  const raw=read(file),begin=raw.indexOf('begin;'),end=raw.lastIndexOf('commit;')+'commit;'.length;
  assert.ok(begin>=0&&end>begin,'Bad original migration: '+file);
  const body=normalize(raw.slice(begin,end));
  const found=unified.indexOf(body,cursor);
  assert.ok(found>=0, file+' is missing or out of order');
  cursor=found+body.length;
}
assert.match(unified,/UPGRADE_TO_V118_OK' as status;$/);
for(const column of ['v111_ok','v116_ok','v117_ok','anon_insert_blocked','authenticated_insert_blocked','service_role_can_insert']){
  assert.ok(unified.includes(column),'Missing check: '+column);
}
assert.doesNotMatch(unified,/\bdrop\s+table\b|\btruncate\b|\bdelete\s+from\b/i);
const guide=read('supabase/README.md');
for(const name of ['UPGRADE_TO_V118.sql','UPGRADE_EXISTING_V105.sql','UPGRADE_EXISTING_V110.sql','SUPABASE_SETUP.sql','submit-customer-lead']) assert.ok(guide.includes(name),name);
console.log('SQL_UNIFIED_OK');
