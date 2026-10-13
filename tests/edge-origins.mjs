import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
function parseOrigins(file,secret){
 const code=read(file);
 const match=code.match(/\/\/ ALLOWED_ORIGINS:begin([\s\S]*?)\/\/ ALLOWED_ORIGINS:end/);
 assert.ok(match,file+' lacks origin configuration');
 const Deno={env:{get:key=>key==='ALLOWED_ORIGINS'?secret:undefined}};
 return new Function('Deno',match[1]+';return {allowedOrigins,extraOrigins};')(Deno);
}
for(const file of ['supabase/functions/submit-customer-lead/index.ts','supabase/functions/manage-admin-account/index.ts']){
 const base=parseOrigins(file,undefined);
 assert.ok(base.allowedOrigins.has('https://basair-alkhalij.github.io'));
 assert.deepEqual(base.extraOrigins,[]);
 const allowed=parseOrigins(file,' https://www.example.com/ ,https://example.com,http://evil.test, https://bad.test/path, javascript:alert(1), https://ok.example:8443');
 assert.deepEqual(allowed.extraOrigins,['https://www.example.com','https://example.com','https://ok.example:8443']);
 assert.ok(allowed.allowedOrigins.has('https://example.com'));
 assert.ok(!allowed.allowedOrigins.has('http://evil.test'));
 assert.ok(!allowed.allowedOrigins.has('https://bad.test/path'));
}
const fn=read('supabase/functions/submit-customer-lead/index.ts');
assert.match(fn,/extraOrigins\.map\(\(origin\) => new URL\(origin\)\.hostname\)/);
const build=read('scripts/build.mjs');
const siteUrl=build.match(/DEFAULT_SITE_URL='([^']+)'/);
assert.ok(siteUrl);
assert.equal(JSON.parse(read('site-settings.json')).siteUrl,siteUrl[1]);
// Regression: internal admin errors may be logged, but must never reach callers.
const adminAccount = read('supabase/functions/manage-admin-account/index.ts');
const adminCatch = adminAccount.slice(adminAccount.lastIndexOf('  } catch (error) {'));
assert.match(adminCatch, /console\.error\('\[manage-admin-account\]', message\)/);
assert.match(adminCatch, /return response\(409, \{ error: 'هذا البريد مرتبط بحساب آخر بالفعل\.' \}\)/);
assert.match(adminCatch, /return response\(500, \{ error: 'تعذر تنفيذ العملية\. حاول مرة أخرى\.' \}\)/);
assert.doesNotMatch(adminCatch, /return response\(500, \{ error: `[^\`]*\$\{message\}/);

console.log('EDGE_ORIGINS_AND_SITE_URL_OK');
