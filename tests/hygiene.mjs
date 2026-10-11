import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

// Duplicate declarations at the same indentation level can silently shadow logic.
for(const file of fs.readdirSync(root).filter(name=>name.endsWith('.js'))){
  const seen=new Map();
  read(file).split('\n').forEach((line,index)=>{
    const match=line.match(/^(\s*)(?:async\s+)?function\s+(\w+)\s*\(/);
    if(!match)return;
    const key=match[1].length+':'+match[2];
    assert.ok(!seen.has(key),file+': duplicate function '+match[2]+' at '+seen.get(key)+' / '+(index+1));
    seen.set(key,index+1);
  });
}

// The last duplicate dictionary key wins at runtime: require one unique definition.
{
  const seen=new Map();
  read('site-i18n.js').split('\n').forEach((line,index)=>{
    const match=line.match(/^\s*(['"])(.+?)\1\s*:\s*['"]/);
    if(!match)return;
    assert.ok(!seen.has(match[2]),'site-i18n.js: duplicate '+match[2]+' on lines '+seen.get(match[2])+' / '+(index+1));
    seen.set(match[2],index+1);
  });
}

// Every same-origin JS/CSS resource loaded by the public page must be cached.
// The pinned Supabase CDN UMD is rewritten to supabase-vendor.js by build.mjs.
const index=read('index.html');
const sw=read('sw.js');
const build=read('scripts/build.mjs');
assert.match(sw,/CACHE_VERSION\s*=\s*'flower-light-shell-v__FL_VERSION__'/);
const vendorCdn='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/dist/umd/supabase.js';
assert.ok(index.includes(vendorCdn),'expected pinned Supabase source');
assert.ok(build.includes("'supabase-vendor.js?v='+releaseVersion"),'vendor bundle must be self-hosted by production build');
const assets=new Set();
for(const match of index.matchAll(/<(?:script|link)\b[^>]*?(?:src|href)="([^"#]+)"/g)){
  const url=match[1];
  if(url===vendorCdn){assets.add('supabase-vendor.js');continue;}
  if(/^(?:https?:|data:|mailto:|tel:|\/\/)/.test(url))continue;
  const clean=url.split('?')[0].replace(/^\.\//,'');
  if(/\.(?:js|css|png|ico|webmanifest)$/.test(clean))assets.add(clean);
}
assert.ok(assets.size>10,'asset check found too few resources');
for(const asset of assets){
  if(asset==='favicon.ico'||asset==='apple-touch-icon.png')continue;
  assert.ok(sw.includes("path.endsWith('/"+asset+"')")||sw.includes("'./"+asset+"?v=__FL_VERSION__'")||sw.includes("'./"+asset+"'"),'service worker ignores '+asset);
}
assert.match(sw,/SHELL_URLS\s*=\s*\[/);
assert.ok(sw.includes("'./supabase-vendor.js?v=__FL_VERSION__'"),'Supabase vendor must be precached on first service worker installation');
assert.ok(sw.includes("path.endsWith('/supabase-vendor.js')"),'Supabase vendor must have a cache-first fetch handler');
assert.match(sw,/if\s*\(url\.search\.includes\('admin='\)\)\s*return false/);

// Prevent unversioned stale asset URLs in the generated pages.
for(const file of ['index.html','privacy.html','privacy-en.html','404.html','manifest.webmanifest','sw.js','site-loader.js',...fs.readdirSync(root).filter(n=>n.endsWith('.js'))]){
  assert.doesNotMatch(read(file),/\?v=\d+/,file+': hard-coded asset version');
}
console.log('HYGIENE_OK');
