import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../site-loader.js',import.meta.url),'utf8');
const expectedAdmin=[
  'admin-mfa.js','admin-navigation.js','admin-overview.js','admin-product-specs.js',
  'admin.js','admin-analytics.js','admin-datasheet.js','admin-leads.js',
  'admin-permissions.js','admin-business.js','admin-banks.js',
  'admin-settings.js','admin-search-filters.js','admin-media.js',
  'admin-products.js','admin-product-form.js','admin-import.js'
];
const expectedVisitor=['public-sync.js','catalog-search.js'];
function run(search){
  const appended=[];
  const listeners=[];
  const removed=[];
  const context={
    URLSearchParams,
    location:{search},
    navigator:{serviceWorker:{register:async()=>{}}},
    window:{addEventListener:(name,fn)=>listeners.push([name,fn])},
    console,
    document:{
      body:{appendChild(node){appended.push(node);}},
      createElement(tag){assert.equal(tag,'script');return {async:true};},
      getElementById(id){return {remove(){removed.push(id);}};}
    }
  };
  vm.runInNewContext(source,context);
  assert.ok(appended.every(s=>s.async===false),'Scripts must preserve strict execution order');
  assert.ok(appended.every(s=>s.src.endsWith('?v=__FL_VERSION__')),'Scripts must be release-pinned');
  return {files:appended.map(s=>s.src.split('?')[0]),removed,listeners};
}
const owner=run('?admin=1');
assert.deepEqual(owner.files,expectedAdmin);
assert.equal(owner.listeners.length,0);
const subadmin=run('?admin=2');
assert.deepEqual(subadmin.files,expectedAdmin);
assert.deepEqual(subadmin.removed,['flCloudPrimaryAdmin']);
const visitor=run('');
assert.deepEqual(visitor.files,expectedVisitor);
assert.equal(visitor.listeners[0][0],'load');
console.log('RUNTIME_SCRIPT_ORDER_OK');
