import fs from 'node:fs'; import vm from 'node:vm'; import assert from 'node:assert/strict';
const src=fs.readFileSync(new URL('../admin-leads.js', import.meta.url),'utf8');
const rows=Array.from({length:250},(_,i)=>({id:'id'+i,full_name:'عميل '+i,company_name:i%2?'شركة':'',mobile:'05000000'+String(i).padStart(2,'0'),created_at:'2026-10-01T10:00:00Z'}));
let deleted=[]; let lastLayout='';
function builder(table){
  const st={filter:null,range:[0,99],del:false,ids:null,eq:null};
  const b={
    select(){return b}, order(){return b}, range(a,z){st.range=[a,z];return b}, or(q){st.filter=q;return b},
    delete(){st.del=true;return b}, in(_,ids){st.ids=ids;return b}, eq(_,v){st.eq=v;return b},
    then(res){
      if(st.del){ deleted.push(...(st.ids||[st.eq])); return res({error:null}); }
      let r=rows; if(st.filter){const m=/%(.*?)%/.exec(st.filter)[1]; r=rows.filter(x=>x.full_name.includes(m));}
      res({data:r.slice(st.range[0],st.range[1]+1),error:null,count:r.length});
    }};
  return b;
}
const listeners={};
const doc={getElementById:id=>({addEventListener:(e,f)=>{listeners[id+':'+e]=f},disabled:false,dataset:{},innerHTML:'',value:'x'}),};
const body={querySelectorAll:()=>[]}; const shell={scrollTop:0};
const core={esc:s=>String(s??''),notify:m=>{notified.push(m)},layout:h=>{lastLayout=h},get db(){return {from:builder,rpc:async()=>({data:0,error:null})}},shell,body,
  allowedAdminViews:()=>new Set(['leads']),leadPhoneDigits:v=>String(v||'').replace(/\D/g,''),
  normalizeLeadPhone:v=>{let d=String(v||'').replace(/\D/g,'');return /^05\d{8}$/.test(d)?'966'+d.slice(1):d},
  vcardEscape:v=>String(v||'')};
const notified=[];
const win={FL_ADMIN_CORE:core};
const ctx=vm.createContext({window:win,document:doc,console,Intl,Date,Set,Math,Number,String,Array,Proxy,Promise,confirm:()=>true,setTimeout,requestAnimationFrame:f=>f(),Blob:class{},URL:{createObjectURL:()=>'',revokeObjectURL(){}}});
vm.runInContext(src,ctx);
const L=win.FL_ADMIN_LEADS; assert.ok(L,'module registered');
await L.loadLeadsPage({reset:true});
assert.equal(L.totalForStats(),250);
L.renderLeads(); assert.match(lastLayout,/المعروض: 100 من 250/); assert.match(lastLayout,/flLoadMoreLeads/);
await listeners['flLoadMoreLeads:click']();
assert.match(lastLayout,/المعروض: 200 من 250/);
await L.loadLeadsPage({reset:true,searchTerm:'عميل 7'});
L.renderLeads(); assert.match(lastLayout,/نتائج البحث/);
assert.equal(L.totalForStats(),250,'overall total kept while searching');
// missing-core safety
const w2={}; vm.runInContext(src,vm.createContext({window:w2,console:{error(){}}})); assert.equal(w2.FL_ADMIN_LEADS,undefined);
console.log('LEADS_MODULE_RUNTIME_OK');
