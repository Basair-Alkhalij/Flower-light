import assert from 'node:assert/strict';
import fs from 'node:fs';

const draft=fs.readFileSync(new URL('../supabase/PROPOSED_ADMIN_12_PERMISSIONS_REVIEW_ONLY.sql',import.meta.url),'utf8');
const edge=fs.readFileSync(new URL('../supabase/functions/manage-admin-account/index.ts',import.meta.url),'utf8');
const browser=fs.readFileSync(new URL('../admin.js',import.meta.url),'utf8');

function assertBalancedSqlQuoting(source){
  let i=0,mode='sql',dollar='',closed=true;
  while(i<source.length){
    const ch=source[i],next=source[i+1];
    if(mode==='comment'){if(ch==='\n')mode='sql';i++;continue;}
    if(mode==='block'){if(ch==='*'&&next==='/'){mode='sql';i+=2;}else i++;continue;}
    if(mode==='single'){
      if(ch==="'"){if(next==="'"){i+=2;continue;}mode='sql';}
      i++;continue;
    }
    if(mode==='double'){
      if(ch==='"'){if(next==='"'){i+=2;continue;}mode='sql';}
      i++;continue;
    }
    if(mode==='dollar'){
      if(source.startsWith(dollar,i)){i+=dollar.length;mode='sql';}
      else i++;
      continue;
    }
    if(ch==='-'&&next==='-'){mode='comment';i+=2;continue;}
    if(ch==='/'&&next==='*'){mode='block';i+=2;continue;}
    if(ch==="'"){mode='single';i++;continue;}
    if(ch==='"'){mode='double';i++;continue;}
    if(ch==='$'){
      const mark=source.slice(i).match(/^\$[a-z_]*\$/i)?.[0];
      if(mark){dollar=mark;mode='dollar';i+=mark.length;continue;}
    }
    i++;
  }
  closed=['sql','comment'].includes(mode);
  assert.ok(closed,'Unterminated SQL quote/comment/dollar block: '+mode);
}
function verify(source){
  assertBalancedSqlQuoting(source);
  assert.equal((source.match(/^begin;$/gm)||[]).length,1,'exactly one transaction BEGIN');
  assert.equal((source.match(/^commit;$/gm)||[]).length,1,'exactly one transaction COMMIT');
  assert.match(source,/^-- DO NOT RUN IN PRODUCTION WITHOUT A SEPARATE, EXPLICIT OWNER APPROVAL\.$/m);
  const commitPos=source.search(/^commit;$/m);
  assert.ok(commitPos>source.indexOf('\nbegin;\n'),'COMMIT must follow BEGIN');
  assert.ok(source.slice(commitPos+'commit;'.length).split('\n').every(
    line=>/^\s*$/.test(line)||/^\s*--/.test(line)
  ),'Executable or duplicated SQL found after COMMIT');
  assert.equal((source.match(/\$preflight\$/g)||[]).length,2,'preflight DO block');
  assert.equal((source.match(/\$fn\$/g)||[]).length,14,'seven complete SQL functions');
  const intended=[
    ['owner_set_admin2_settings','is_site_owner'],
    ['owner_get_delegatable_permissions','is_site_owner'],
    ['admin_set_site_toggle','site-settings'],
    ['admin_save_catalog_filters','search-filters'],
    ['admin_set_template_field','template-settings'],
    ['admin_save_template_footer','template-settings'],
    ['purge_expired_customer_leads',"has_admin_permission('leads')"]
  ];
  for(const [fn,guard] of intended){
    const matcher=new RegExp('create or replace function public\\.'+fn+'\\([\\s\\S]*?as \\$fn\\$([\\s\\S]*?)\\$fn\\$;');
    const body=source.match(matcher)?.[1];
    assert.ok(body,'Missing SQL RPC '+fn);
    assert.ok(body.includes(guard),'RPC '+fn+' lacks its permission gate');
    assert.match(source,new RegExp('revoke all on function public\\.'+fn+'\\('),
      'RPC '+fn+' must be revoked from PUBLIC and anon');
    assertBalancedSqlQuoting(body);
  }
  for(const key of ['analytics','datasheet','profile','contacts','leads','sections',
    'products','search-filters','template-settings','site-settings',
    'business-settings','bank-settings']){
    assert.match(source,new RegExp("'"+key+"'"),'Missing allowed delegated key: '+key);
  }
  assert.doesNotMatch(source,/create policy[^;]*on public\.site_settings[^;]*for (?:all|update|insert)/i,
    'Broad delegated write policy for shared site_settings would bypass scoped RPCs');
  assert.match(source,/role='owner'\s+or\s+permissions <@/);
  assert.match(source,/category DELETE requires BOTH/);
  // The sensitive privacy singleton is never deletable by a business-only admin.
  const privacyStart=source.indexOf('-- D. Business rows:');
  const privacyEnd=source.indexOf('-- E. Bank accounts',privacyStart);
  assert.ok(privacyStart>=0&&privacyEnd>privacyStart);
  const privacy=source.slice(privacyStart,privacyEnd);
  for(const operation of ['select','insert','update']){
    assert.match(privacy,new RegExp('on public\\.business_privacy_settings for '+operation+' to authenticated'));
  }
  assert.doesNotMatch(privacy,/on public\\.business_privacy_settings for (?:all|delete) to authenticated/i);
  assert.match(privacy,/NEVER deleted by subadmin/);
  assert.match(source,/bucket_id='product-images'/);
  assert.match(source,/storage\.foldername\(name\)/);
  assert.match(source,/\^site-settings\/master-barcode-/);
  assert.match(source,/\^custom_filter_\[a-z0-9\]\+\$'/,
    'Custom-filter validation must end in a closed, anchored SQL string');
  assert.match(source,/jsonb_typeof\(x\.item->'key'\) is distinct from 'string'/);
  assert.match(source,/admin_save_template_footer\(text,text\) to authenticated/);
  assert.match(source,/if v_role='authenticated' and not public\.has_admin_permission\('leads'\)/);
  assert.doesNotMatch(source,/if v_role\s*=\s*'authenticated' and not public\.is_site_admin\(\)/);
  assert.match(source,/grant execute on function public\.purge_expired_customer_leads\(\) to authenticated,service_role/);
  assert.doesNotMatch(source,/grant\s+(?:all|update)\s+on\s+(?:table\s+)?public\.site_settings\s+to\s+authenticated/i);
  const keyWhitelist=source.match(/v_allowed constant text\[\][\s\S]*?::text\[\];/)?.[0]||'';
  assert.ok(keyWhitelist,'Owner grant whitelist missing');
  assert.doesNotMatch(keyWhitelist,/['\"](?:credentials|permissions)['\"]\s*[,\)\]]/);
  assert.match(source,/-- No UPDATE to admin_users, no auto-grants/);
  assert.match(source,/revoke all on function public\.owner_get_delegatable_permissions\(\) from public,anon/);
  assert.match(edge,/if \(!isOwner\) return response\(403/);
  assert.match(browser,/owner_get_delegatable_permissions/);
}
verify(draft);
// Mutation regressions: catch the exact malformed draft and accidental merge
// duplication that previously slipped past UI-only checks.
assert.throws(()=>verify(draft.replace(/^\s*commit;$/m,'')));
assert.throws(()=>verify(draft+draft));
assert.throws(()=>verify(draft.replace(
  "not public.has_admin_permission('leads')",
  "not public.is_site_admin()"
)));
assert.throws(()=>verify(draft.replace(
  "'^custom_filter_[a-z0-9]+$'",
  "'^custom_filter_[a-z0-9]+"
)));
console.log('ADMIN_12_SQL_DRAFT_INTEGRITY_OK (static only; PostgreSQL/RLS not executed)');
