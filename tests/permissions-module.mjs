import fs from 'node:fs'; import vm from 'node:vm'; import assert from 'node:assert/strict';
const src=fs.readFileSync(new URL('../admin-permissions.js', import.meta.url),'utf8');

const listeners={}; let html=''; const notified=[]; const rpcCalls=[];
const doc={getElementById:id=>({addEventListener:(e,f)=>{listeners[id+':'+e]=f},disabled:false,textContent:''})};
const body={querySelectorAll:()=>[{value:'products_view'},{value:'leads'}]};
let state={email:'a2@example.com',perms:new Set(['leads']),view:'permissions',renders:0};
const core={
  esc:s=>String(s??''),notify:m=>notified.push(m),layout:h=>{html=h},body,
  adminViewItems:[['analytics','A'],['sections','S'],['products','P'],['leads','L']],
  delegatablePermissionKeys:new Set(['analytics','leads']),
  normalizePermissionList:v=>(v?.permissions||[]).filter(k=>['analytics','leads'].includes(k)),
  renderApp:()=>{state.renders++},
  get managedAdmin2Email(){return state.email}, set managedAdmin2Email(v){state.email=v},
  get managedAdmin2Permissions(){return state.perms}, set managedAdmin2Permissions(v){state.perms=v},
  get view(){return state.view}, set view(v){state.view=v},
  get db(){return {rpc:async(name,args)=>{rpcCalls.push([name,args]);return {data:{email:args.p_email,permissions:args.p_permissions},error:null}}}},
};
const win={FL_ADMIN_CORE:core};
vm.runInContext(src,vm.createContext({window:win,document:doc,console,Set,Boolean,String,Array}));
const P=win.FL_ADMIN_PERMISSIONS; assert.ok(P,'module registered');

P.renderPermissions();
assert.match(html,/a2@example\.com/);
assert.match(html,/name="admin2_permission"/);
const listHtml=html.split('fl-permission-list')[1]||'';
assert.match(listHtml,/>A</); assert.match(listHtml,/>L</);
assert.doesNotMatch(listHtml,/>S</,'sections is not delegatable'); assert.doesNotMatch(listHtml,/>P</,'products is not delegatable');

await listeners['flPermissionsForm:submit']({preventDefault(){}});
assert.equal(JSON.stringify(rpcCalls[0]),JSON.stringify(['owner_set_admin2_settings',{p_email:'a2@example.com',p_permissions:['products_view','leads']}]));
assert.equal(JSON.stringify([...state.perms]),JSON.stringify(['leads']),'unknown/non-delegatable keys filtered by normalizePermissionList');
assert.ok(notified.includes('تم حفظ صلاحيات الأدمن'));

listeners['flOpenCredentialsFromPermissions:click']();
assert.equal(state.view,'credentials'); assert.equal(state.renders,1);

state.email=''; P.renderPermissions();
assert.match(html,/لم يتم إنشاء حساب الأدمن/);
await listeners['flPermissionsForm:submit']({preventDefault(){}});
assert.equal(rpcCalls.length,1,'no RPC without a linked admin account');

const w2={}; vm.runInContext(src,vm.createContext({window:w2,console:{error(){}}})); assert.equal(w2.FL_ADMIN_PERMISSIONS,undefined);
console.log('PERMISSIONS_MODULE_RUNTIME_OK');
