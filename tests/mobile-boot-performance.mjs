import assert from 'node:assert/strict';
import fs from 'node:fs';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const ordered=[
  'config.js','business-info.js','bank-info.js',
  'analytics.js','catalog-pdf-viewer.js','quote-list.js',
  'catalog-gallery.js','catalog-product-meta.js','catalog-pricing.js',
  'app.js','pwa-install.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/dist/umd/supabase.js',
  'site-loader.js'
];
let last=-1;
for(const name of ordered){
  const pattern=new RegExp('<script\\s+[^>]*src=["\x27]'+name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+(name.startsWith('https:')?'':'\\?v=__FL_VERSION__')+'["\x27][^>]*><\\/script>','i');
  const match=html.match(pattern);
  assert.ok(match,'Expected external script: '+name);
  assert.match(match[0],/\bdefer\b/,'Deferred loading required for '+name);
  const i=html.indexOf(match[0]);
  assert.ok(i>last,'Preserve dependent script execution order: '+name);
  last=i;
}
assert.match(html,/<script src="theme-mode\.js\?v=__FL_VERSION__"><\/script>/,
  'Synchronous theme selection is intentional to prevent flash of wrong theme');
const configIndex=html.indexOf('config.js?v=__FL_VERSION__');
const publicInfoIndex=html.indexOf('business-info.js?v=__FL_VERSION__');
const bankIndex=html.indexOf('bank-info.js?v=__FL_VERSION__');
const catalogIndex=html.indexOf('app.js?v=__FL_VERSION__');
assert.ok(configIndex<publicInfoIndex && publicInfoIndex<bankIndex && bankIndex<catalogIndex,
  'Start visitor-only public data requests before loading the larger catalog program');
console.log('MOBILE_BOOT_NONBLOCKING_OK');
