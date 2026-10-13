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


// Exercise the actual request-body reader with absent/spoofed Content-Length,
// chunked Unicode input, the exact 8 KiB boundary, and oversized input.
assert.match(fn,/Number\.isFinite\(contentLength\) && contentLength > MAX_LEAD_BODY_BYTES/);
assert.match(fn,/const parsed = await readLimitedJson\(request\)/);
assert.match(fn,/if \(parsed\.tooLarge\) return jsonResponse\(413,/);
assert.doesNotMatch(fn,/await request\.json\(\)/);
const readerSource=fn.match(/const MAX_LEAD_BODY_BYTES = 8192\n\nasync function readLimitedJson\(request: Request\) \{[\s\S]*?\n\}\n\n(?=type TurnstileResult)/)?.[0];
assert.ok(readerSource,'streaming byte-limited JSON reader must exist');
const readLimitedJson=new Function('TextDecoder',readerSource
  .replace('request: Request','request')
  .replace(' as Record<string, unknown>','')+'\nreturn readLimitedJson;')(TextDecoder);
const encoder=new TextEncoder();
function chunkedRequest(bytes,chunkSize,headers={}){
  let offset=0;
  const stream=new ReadableStream({pull(controller){
    if(offset>=bytes.length){controller.close();return;}
    controller.enqueue(bytes.slice(offset,offset+chunkSize));
    offset+=chunkSize;
  }});
  return new Request('https://example.test/lead',{method:'POST',body:stream,duplex:'half',headers});
}
const good=JSON.stringify({full_name:'سارة',company_name:'شركة',mobile:'0501234567',turnstile_token:'token'});
const utf8=encoder.encode(good);
const normal=await readLimitedJson(chunkedRequest(utf8,7));
assert.equal(normal.tooLarge,false);
assert.equal(normal.data.full_name,'سارة');
const exactly8192=encoder.encode(JSON.stringify({padding:'x'.repeat(8192-'{"padding":""}'.length)}));
assert.equal(exactly8192.length,8192);
assert.equal((await readLimitedJson(chunkedRequest(exactly8192,4096))).tooLarge,false);
const over8192=encoder.encode(JSON.stringify({padding:'x'.repeat(8193-'{"padding":""}'.length)}));
assert.equal(over8192.length,8193);
assert.equal((await readLimitedJson(chunkedRequest(over8192,4096))).tooLarge,true);
assert.equal((await readLimitedJson(chunkedRequest(over8192,4096,{'content-length':'10'}))).tooLarge,true);
await assert.rejects(readLimitedJson(chunkedRequest(encoder.encode('{invalid'),4)),SyntaxError);

console.log('EDGE_ORIGINS_AND_SITE_URL_OK');
