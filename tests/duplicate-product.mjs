import vm from 'node:vm';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
for(const fail of [false,true]){
  const ctx=vm.createContext({window:{},console,crypto:{randomUUID},confirm:()=>true,document:{getElementById:()=>null},URL});
  const run=file=>vm.runInContext(fs.readFileSync(new URL('../'+file,import.meta.url),'utf8'),ctx);
  run('tests/duplicate-fixture.js');ctx.window.setupDuplicateFixture(fail);
  run('admin-media.js');Object.assign(ctx.window.FL_ADMIN_CORE,ctx.window.FL_ADMIN_MEDIA);run('admin-products.js');
  await ctx.window.FL_ADMIN_PRODUCTS.duplicateProduct('p1');
  const s=JSON.parse(JSON.stringify(ctx.window.__duplicateState));
  assert.equal(s.payload.is_visible,false);assert.equal(s.payload.price,100);assert.equal(s.payload.wholesale_price,80);
  assert.equal(s.payload.specifications.find(x=>x.key==='show_specs').value,'1');
  assert.equal(s.payload.specifications.find(x=>x.key==='show_description').value,'0');
  assert.equal(JSON.parse(s.payload.specifications.find(x=>x.key==='pricing').value)[0].price,100);
  assert.equal(s.copies.length,2);assert.notEqual(s.payload.image_path,'c1/old.l.webp');
  if(fail){assert.deepEqual(s.deleted,['p2']);assert.equal(s.removed.length,2);assert.match(s.messages.at(-1),/gallery failed/);}
  else{assert.deepEqual(s.opened,['p2']);assert.equal(s.removed.length,0);assert.match(s.messages.at(-1),/تم إنشاء/);}
}
console.log('DUPLICATE_PRODUCT_SUCCESS_AND_ROLLBACK_OK');
