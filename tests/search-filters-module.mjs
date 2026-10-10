import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const src=fs.readFileSync(new URL('../admin-search-filters.js', import.meta.url),'utf8');
const listeners={}; const els={}; const upserts=[]; const notified=[]; let rendered='';
const mkEl=id=>els[id]||(els[id]={id,value:'',checked:false,disabled:false,textContent:'',dataset:{},addEventListener:(event,fn)=>{listeners[id+':'+event]=fn}});
const document={getElementById:mkEl,querySelectorAll:()=>[]};
let siteRow={
  catalog_filter_keys:['availability','custom_filter_finish'],
  catalog_custom_filters:[{key:'custom_filter_finish',label:'نوع التشطيب'}]
};
const db={
  from(table){
    assert.equal(table,'site_settings');
    return{
      select:()=>({eq:()=>({maybeSingle:async()=>({data:siteRow,error:null})})}),
      upsert:async row=>{upserts.push(row);siteRow={...siteRow,...row};return{error:null}}
    };
  }
};
const core={
  esc:value=>String(value??''),notify:msg=>notified.push(msg),layout:html=>{rendered=html;},isPrimaryAdmin:true,
  PRODUCT_SPEC_FIELDS:[{key:'wattage',label:'القدرة'},{key:'cct',label:'حرارة اللون'},{key:'color',label:'اللون'}],
  get db(){return db;}
};
const window={FL_ADMIN_CORE:core,FLOWER_LIGHT_SITE_SETTINGS:{},dispatchEvent(){}};
const context={window,document,console,Proxy,Set,Map,Array,Object,String,Number,Boolean,Promise,RegExp,Date,crypto:{randomUUID:()=> 'AABB-CCDD-0011-2233'},confirm:()=>true,CustomEvent:class{constructor(type,init){this.type=type;this.detail=init?.detail;}}};
vm.createContext(context);
vm.runInContext(src,context,{filename:'admin-search-filters.js'});
const M=window.FL_ADMIN_SEARCH_FILTERS;
assert.ok(M,'module registered');

await M.load();
assert.deepEqual(Array.from(window.FLOWER_LIGHT_SITE_SETTINGS.catalog_filter_keys),['availability','custom_filter_finish']);
assert.equal(window.FLOWER_LIGHT_CUSTOM_FILTERS[0].label,'نوع التشطيب');

M.render();
assert.match(rendered,/فلاتر البحث/);
assert.match(rendered,/role="switch"/);
assert.match(rendered,/aria-checked="true"/);
assert.match(rendered,/aria-checked="false"/);
assert.match(rendered,/width:52px;height:30px/);
assert.match(rendered,/width:24px;height:24px/);
assert.doesNotMatch(rendered,/ON · تشغيل|OFF · إيقاف|>تشغيل<\/span>|>إيقاف<\/span>/);
assert.match(rendered,/حفظ الفلاتر والترتيب/);
assert.match(rendered,/▲/);
assert.match(rendered,/▼/);

// Turn wattage ON, then move it above the existing filters.
await listeners['flSearchFilterToggle_wattage:click']();
assert.match(rendered,/القدرة/);
await listeners['flSearchFilterUp_wattage:click']();
await listeners['flSearchFilterUp_wattage:click']();
await listeners['flSearchFiltersSave:click']();
assert.deepEqual(Array.from(upserts.at(-1).catalog_filter_keys),['wattage','availability','custom_filter_finish']);
assert.ok(notified.some(msg=>msg.includes('ترتيبها')));

// Turn availability OFF and save: it must disappear from the persisted order.
await listeners['flSearchFilterToggle_availability:click']();
await listeners['flSearchFiltersSave:click']();
assert.deepEqual(Array.from(upserts.at(-1).catalog_filter_keys),['wattage','custom_filter_finish']);

// Add a reusable custom filter; it must be switched on and join product-spec definitions.
mkEl('flCustomFilterLabel').value='نوع العدسة';
await listeners['flCustomFilterAdd:click']();
assert.ok(window.FLOWER_LIGHT_CUSTOM_FILTERS.some(row=>row.label==='نوع العدسة'));
assert.ok(notified.some(msg=>msg.includes('تمت إضافة الفلتر وتشغيله')));
await listeners['flSearchFiltersSave:click']();
assert.ok(Array.isArray(upserts.at(-1).catalog_custom_filters));
assert.ok(upserts.at(-1).catalog_custom_filters.some(row=>row.label==='نوع العدسة'));
assert.equal(upserts.at(-1).catalog_filter_keys.at(-1),'custom_filter_aabbccdd00112233');

const subCore={...core,isPrimaryAdmin:false};
const subWindow={FL_ADMIN_CORE:subCore};
vm.runInContext(src,vm.createContext({window:subWindow,document,console,Proxy,Set,Map,Array,Object,String,Number,Boolean,Promise,RegExp,Date,crypto:{},confirm:()=>true,CustomEvent:class{}}));
assert.ok(subWindow.FL_ADMIN_SEARCH_FILTERS);
await subWindow.FL_ADMIN_SEARCH_FILTERS.load();

console.log('SEARCH_FILTERS_MODULE_RUNTIME_OK');
