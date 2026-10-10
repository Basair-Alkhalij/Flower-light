import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const src=fs.readFileSync(new URL('../quote-list.js',import.meta.url),'utf8');

function load(storage){
  const events=[];
  const win={
    localStorage:storage,
    FLOWER_LIGHT_PROFILE:{brand_name:'Flower Light'},
    FLOWER_LIGHT_CONTACTS:[{type:'whatsapp',value:'0560933353',is_visible:true}],
    flTrack:(name,params)=>events.push({name,params}),
    flNormalizeWhatsAppNumber:value=>String(value||'').replace(/\D/g,''),
  };
  vm.runInContext(src,vm.createContext({window:win,console,Map,Set,Math,Number,String,Array,Object,JSON,Date,Promise}));
  return {api:win.FL_QUOTE_LIST,events};
}

const memory=new Map();
const storage={
  getItem:key=>memory.has(key)?memory.get(key):null,
  setItem:(key,value)=>memory.set(key,value)
};
const {api,events}=load(storage);
assert.ok(api,'quote module registered');
assert.equal(api.storageKey,'fl_quote_list_v1');
assert.equal(api.limits.maxItems,30);
assert.equal(api.limits.maxQty,9999);

for(let i=1;i<=30;i++) assert.equal(api.add({id:'p'+i,name:'منتج '+i,model:'M'+i},1),true);
assert.equal(api.items().length,30);
assert.equal(api.add({id:'p31',name:'زائد'},1),false);
api.setQty('p1',20000);
assert.equal(api.items().find(x=>x.id==='p1').qty,9999);
api.setQty('p1',2);
assert.equal(api.items().find(x=>x.id==='p1').qty,2);
api.setQty('p1',0);
assert.equal(api.items().some(x=>x.id==='p1'),false);
assert.ok(memory.get('fl_quote_list_v1'),'state persisted');
assert.ok(events.some(x=>x.name==='quote_list_add'));
assert.ok(events.every(x=>Object.keys(x.params).length===1 && 'item_count' in x.params));

api.clear();
api.add({id:'one',name:'أ'.repeat(100),model:'A-1'},2);
api.add({id:'two',name:'مصباح ثاني',model:'B-2'},3);
const rows=api.items();
assert.equal(Array.from(rows[0].name).length,80);
const message=api.quoteListWhatsAppMessage(rows,{name:'محمد',notes:'فضلاً إرسال أفضل سعر'});
const plainMessage=message.replace(/[\u2066\u2069]/g,'');
assert.match(plainMessage,/السلام عليكم، أرغب بعرض سعر للمنتجات التالية:/);
assert.match(plainMessage,/1\) .* — A-1 \* 2/);
assert.match(plainMessage,/2\) مصباح ثاني — B-2 \* 3/);
assert.match(plainMessage,/الاسم: محمد/);
assert.match(plainMessage,/ملاحظات: فضلاً إرسال أفضل سعر/);
assert.match(plainMessage,/العلامة التجارية: Flower Light/);
assert.doesNotMatch(plainMessage,/ × /);
const duplicateMessage=api.quoteListWhatsAppMessage([{id:'same-code',name:'1230',model:'1230',qty:2}]).replace(/[\u2066\u2069]/g,'');
assert.match(duplicateMessage,/1\) 1230 \* 2/);
assert.doesNotMatch(duplicateMessage,/1230 — 1230/);

const broken={
  getItem(){throw new Error('blocked')},
  setItem(){throw new Error('blocked')}
};
const {api:blockedApi}=load(broken);
assert.doesNotThrow(()=>blockedApi.add({id:'safe',name:'يعمل بدون تخزين'},1));
assert.equal(blockedApi.items()[0].qty,1);

console.log('QUOTE_LIST_RUNTIME_OK');
