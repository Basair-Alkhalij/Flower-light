import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const read=file=>fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
const settingsSrc=read('admin-settings.js');
const filtersSrc=read('admin-search-filters.js');
function harness(granted,source){
  const calls=[],writes=[],events={},elements={},notifications=[];
  let html='';
  const getElement=id=>elements[id]??=( {
    value:'',checked:false,disabled:false,textContent:'',files:[],dataset:{},
    addEventListener(event,fn){events[id+':'+event]=fn;}
  });
  const doc={getElementById:getElement};
  const db={
    from(table){
      if(table!=='site_settings')throw Error('Unexpected table '+table);
      return {
        select:()=>({eq:()=>({maybeSingle:async()=>({data:{
          require_customer_lead:true,pwa_install_enabled:true,quote_list_enabled:true,
          master_barcode_path:'',design_footer_number:'',design_footer_label:'',
          catalog_filter_keys:['availability'],catalog_custom_filters:[]
        },error:null})})}),
        upsert:async row=>{writes.push(row);return {error:null};}
      };
    },
    rpc:async(name,args)=>{calls.push([name,args]);return {data:null,error:null};},
    storage:{from:()=>({upload:async()=>({error:null}),remove:async()=>({error:null})})}
  };
  const core={
    isPrimaryAdmin:false,
    canManageSection:key=>granted.has(key),
    esc:value=>String(value??''),notify:s=>notifications.push(s),
    imageUrl:path=>path,isStoragePath:path=>Boolean(path),bucket:'product-images',
    PRODUCT_SPEC_FIELDS:[{key:'wattage',label:'القدرة'}],
    layout:code=>{html=code},
    db
  };
  const window={FL_ADMIN_CORE:core,FLOWER_LIGHT_SITE_SETTINGS:{},dispatchEvent(){}};
  const context={window,document:doc,console,Proxy,Promise,Set,Map,Array,Object,String,
    Number,Boolean,RegExp,Date,crypto:{randomUUID:()=>'00000000-0000-4000-8000-000000000000'},
    confirm:()=>true,CustomEvent:class{}};
  vm.runInNewContext(source,context);
  return {calls,writes,events,elements,notifications,getElement,window,get html(){return html;}};
}

// Site settings ON, template OFF: only the site toggle RPC may be invoked.
{
  const h=harness(new Set(['site-settings']),settingsSrc),m=h.window.FL_ADMIN_SETTINGS;
  await m.load();
  assert.match(m.cardsHtml('site'),/flPwaInstallSettingsForm/);
  assert.doesNotMatch(m.cardsHtml('template'),/flMasterBarcodeSettingsForm/);
  m.bind(()=>{});
  h.getElement('flPwaInstallEnabled').checked=false;
  await h.events['flPwaInstallSettingsForm:submit']({preventDefault(){}});
  assert.deepEqual(JSON.parse(JSON.stringify(h.calls)),[
    ['admin_set_site_toggle',{p_key:'pwa_install_enabled',p_value:false}]
  ]);
  h.getElement('flDesignFooterNumber').value='1234';
  await h.events['flDesignFooterNumberSettingsForm:submit']({preventDefault(){}});
  assert.equal(h.calls.length,1,'Site-settings only must not write template metadata');
  assert.equal(h.writes.length,0,'Subadmin must never have broad site_settings upsert');
}

// Template ON, site OFF: both footer fields must be changed atomically.
{
  const h=harness(new Set(['template-settings']),settingsSrc),m=h.window.FL_ADMIN_SETTINGS;
  await m.load();
  assert.doesNotMatch(m.cardsHtml('site'),/flPwaInstallSettingsForm/);
  assert.match(m.cardsHtml('template'),/flDesignFooterNumberSettingsForm/);
  m.bind(()=>{});
  h.getElement('flDesignFooterNumber').value=' 0551234567 ';
  h.getElement('flDesignFooterLabel').value='الدعم';
  await h.events['flDesignFooterNumberSettingsForm:submit']({preventDefault(){}});
  assert.deepEqual(JSON.parse(JSON.stringify(h.calls)),[
    ['admin_save_template_footer',{p_number:'0551234567',p_label:'الدعم'}]
  ]);
  h.getElement('flPwaInstallEnabled').checked=false;
  await h.events['flPwaInstallSettingsForm:submit']({preventDefault(){}});
  assert.equal(h.calls.length,1,'Template-settings only must not change visitor site toggles');
  assert.equal(h.writes.length,0);
}

// No delegation: none of the cards must render, and bind must not issue reads/writes.
{
  const h=harness(new Set(),settingsSrc),m=h.window.FL_ADMIN_SETTINGS;
  await m.load();
  assert.doesNotMatch(m.cardsHtml(),/flPwaInstallSettingsForm|flDesignFooterNumberSettingsForm/);
  m.bind(()=>{});
  assert.equal(h.events['flPwaInstallSettingsForm:submit'],undefined);
  assert.equal(h.calls.length,0);
  assert.equal(h.writes.length,0);
}

// Filter-only delegated account uses the narrow filter RPC, not site_settings UPSERT.
{
  const h=harness(new Set(['search-filters']),filtersSrc);
  const m=h.window.FL_ADMIN_SEARCH_FILTERS;
  await m.load();m.render();
  assert.match(h.html,/flSearchFiltersSave/);
  await h.events['flSearchFiltersSave:click']();
  assert.equal(h.calls.length,1);
  assert.equal(h.calls[0][0],'admin_save_catalog_filters');
  assert.deepEqual(Array.from(h.calls[0][1].p_filter_keys),['availability']);
  assert.equal(h.writes.length,0);
}
{
  const h=harness(new Set(['site-settings']),filtersSrc);
  const m=h.window.FL_ADMIN_SEARCH_FILTERS;
  await m.load();m.render();
  assert.equal(h.html,'','A role without filters permission must not render controls');
  assert.equal(h.calls.length,0);
  assert.equal(h.writes.length,0);
}
console.log('DELEGATED_ADMIN_MODULES_OK');
