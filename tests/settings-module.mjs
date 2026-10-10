import fs from 'node:fs'; import vm from 'node:vm'; import assert from 'node:assert/strict';
const src=fs.readFileSync(new URL('../admin-settings.js', import.meta.url),'utf8');

const listeners={}; const els={}; const notified=[]; const upserts=[]; let rerenders=0;
const mkEl=id=>els[id]||(els[id]={id,value:'',checked:false,files:[],disabled:false,textContent:'',hidden:false,addEventListener:(e,f)=>{listeners[id+':'+e]=f}});
const doc={getElementById:mkEl};
let siteRow={require_customer_lead:false,master_barcode_path:'',design_footer_number:'0501234567',design_footer_label:'خدمة العملاء',pwa_install_enabled:true,quote_list_enabled:false};
const dbStub={
  from:(table)=>{ assert.equal(table,'site_settings'); return {
    select:()=>({eq:()=>({maybeSingle:async()=>({data:siteRow,error:null})})}),
    upsert:async(row,opts)=>{upserts.push(row);Object.assign(siteRow,row);return {error:null}} }; },
  storage:{from:()=>({upload:async()=>({error:null}),remove:async()=>({error:null})})},
};
const make=(isPrimaryAdmin)=>({esc:s=>String(s??''),notify:m=>notified.push(m),imageUrl:p=>'https://img/'+p,isStoragePath:p=>!!p&&!/^https?:/.test(p),bucket:'product-images',isPrimaryAdmin,get db(){return dbStub}});
const win={FL_ADMIN_CORE:make(true)};
vm.runInContext(src,vm.createContext({window:win,document:doc,console,Set,Boolean,String,Array,Number,URL,Proxy,Promise,crypto:{randomUUID:()=>'uuid'}}));
const S=win.FL_ADMIN_SETTINGS; assert.ok(S,'module registered');

await S.load();
assert.equal(win.FLOWER_LIGHT_SITE_SETTINGS.require_customer_lead,false);
assert.equal(win.FLOWER_LIGHT_SITE_SETTINGS.design_footer_number,'0501234567');
assert.equal(win.FLOWER_LIGHT_SITE_SETTINGS.pwa_install_enabled,true);
assert.equal(win.FLOWER_LIGHT_SITE_SETTINGS.quote_list_enabled,false);
const html=S.cardsHtml();
for (const id of ['flCustomerLeadGateSettingsForm','flPwaInstallSettingsForm','flQuoteListSettingsForm','flMasterBarcodeSettingsForm','flDesignFooterNumberSettingsForm']) assert.match(html,new RegExp(id),id);
assert.match(html,/متوقف الآن/,'gate reflects loaded value (disabled)');
assert.match(html,/value="0501234567"/);
assert.match(S.cardsHtml('site'),/flCustomerLeadGateSettingsForm/);
assert.match(S.cardsHtml('site'),/flPwaInstallSettingsForm/);
assert.match(S.cardsHtml('site'),/flQuoteListSettingsForm/);
assert.doesNotMatch(S.cardsHtml('site'),/flMasterBarcodeSettingsForm/);
assert.match(S.cardsHtml('template'),/flMasterBarcodeSettingsForm/);
assert.match(S.cardsHtml('template'),/flDesignFooterNumberSettingsForm/);
assert.doesNotMatch(S.cardsHtml('template'),/flCustomerLeadGateSettingsForm/);

S.bind(()=>{rerenders++});
// disable the public install prompt and save
mkEl('flPwaInstallEnabled').checked=false; mkEl('flPwaInstallSettingsSave');
await listeners['flPwaInstallSettingsForm:submit']({preventDefault(){}});
assert.equal(JSON.stringify(upserts[0]),JSON.stringify({id:1,pwa_install_enabled:false}));
assert.equal(win.FLOWER_LIGHT_SITE_SETTINGS.pwa_install_enabled,false);
assert.equal(rerenders,1);
// enable the public quote-list feature and save
mkEl('flQuoteListEnabled').checked=true; mkEl('flQuoteListSettingsSave');
await listeners['flQuoteListSettingsForm:submit']({preventDefault(){}});
assert.equal(JSON.stringify(upserts[1]),JSON.stringify({id:1,quote_list_enabled:true}));
assert.equal(win.FLOWER_LIGHT_SITE_SETTINGS.quote_list_enabled,true);
assert.equal(rerenders,2);
// toggle the lead gate on and save
mkEl('flRequireCustomerLead').checked=true; mkEl('flCustomerLeadGateSave');
await listeners['flCustomerLeadGateSettingsForm:submit']({preventDefault(){}});
assert.equal(JSON.stringify(upserts[2]),JSON.stringify({id:1,require_customer_lead:true}));
assert.equal(win.FLOWER_LIGHT_SITE_SETTINGS.require_customer_lead,true);
assert.equal(rerenders,3);

// footer number
mkEl('flDesignFooterNumber').value='  0559999999  '; mkEl('flDesignFooterLabel').value='مندوب الجملة'; mkEl('flDesignFooterNumberSave');
await listeners['flDesignFooterNumberSettingsForm:submit']({preventDefault(){}});
assert.equal(JSON.stringify(upserts[3]),JSON.stringify({id:1,design_footer_number:'0559999999',design_footer_label:'مندوب الجملة'}));
assert.equal(win.FLOWER_LIGHT_SITE_SETTINGS.design_footer_number,'0559999999');
assert.equal(rerenders,4);

// barcode: saving with nothing selected must not hit the database
mkEl('flMasterBarcodeFile').files=[]; mkEl('flMasterBarcodeSave');
const before=upserts.length;
await listeners['flMasterBarcodeSettingsForm:submit']({preventDefault(){}});
assert.equal(upserts.length,before); assert.ok(notified.includes('اختر صورة باركود أولًا'));
// barcode: non-image rejected, oversized rejected
els.flMasterBarcodeFile.files=[{type:'application/pdf',name:'x.pdf',size:10}];
await listeners['flMasterBarcodeSettingsForm:submit']({preventDefault(){}});
assert.ok(notified.some(m=>m.includes('اختر ملف صورة للباركود فقط')));
els.flMasterBarcodeFile.files=[{type:'image/png',name:'x.png',size:6*1024*1024}];
await listeners['flMasterBarcodeSettingsForm:submit']({preventDefault(){}});
assert.ok(notified.some(m=>m.includes('5 MB')));
assert.equal(upserts.length,before,'invalid barcode never reaches the database');
// valid barcode saved
els.flMasterBarcodeFile.files=[{type:'image/png',name:'x.png',size:1000}];
await listeners['flMasterBarcodeSettingsForm:submit']({preventDefault(){}});
assert.match(upserts.at(-1).master_barcode_path,/^site-settings\/master-barcode-uuid\.png$/);

// sub-admin sees nothing and binds nothing
const w2={FL_ADMIN_CORE:make(false)};
const doc2={getElementById:()=>{throw new Error('must not touch DOM')}};
vm.runInContext(src,vm.createContext({window:w2,document:doc2,console,Set,Boolean,String,Array,Number,URL,Proxy,Promise,crypto:{}}));
assert.equal(w2.FL_ADMIN_SETTINGS.cardsHtml(),'');
w2.FL_ADMIN_SETTINGS.bind(()=>{});
// missing core -> no-op
const w3={}; vm.runInContext(src,vm.createContext({window:w3,console:{error(){}}})); assert.equal(w3.FL_ADMIN_SETTINGS,undefined);
console.log('SETTINGS_MODULE_RUNTIME_OK');
