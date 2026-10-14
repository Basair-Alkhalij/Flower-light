import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const window={};
vm.runInNewContext(fs.readFileSync(new URL('../admin-navigation.js',import.meta.url),'utf8'),{window});
const nav=window.FL_ADMIN_NAV;
assert.equal(typeof nav.render,'function');
const content=[['sections','الأقسام'],['products','المنتجات'],['datasheet','صمّم داتا شيت'],['contacts','وسائل التواصل'],['leads','جهات اتصال العملاء'],['analytics','الإحصائيات']];
const ownerSettings=[['search-filters','فلاتر البحث'],['site-settings','إعدادات الموقع']];
const member=nav.render({view:'products',allowed:new Set(['overview','products','leads']),adminViewItems:content,ownerSettingsViewItems:ownerSettings,isPrimaryAdmin:false});
assert.match(member,/aria-current="page"/);
assert.match(member,/id="flAdminViewSelect"/);
assert.match(member,/المنتجات والكتالوج/);
assert.ok(member.includes('data-cloud-view="products"'));
assert.ok(member.includes('data-cloud-view="leads"'));
for(const denied of ['sections','datasheet','contacts','analytics','permissions','search-filters','site-settings']){
assert.ok(!member.includes('data-cloud-view="'+denied+'"'),'Permission leak '+denied);
assert.ok(!member.includes('<option value="'+denied+'"'),'Mobile permission leak '+denied);
}
const owner=nav.render({view:'search-filters',allowed:new Set(['overview',...content.map(x=>x[0]),...ownerSettings.map(x=>x[0]),'permissions','credentials']),adminViewItems:content,ownerSettingsViewItems:ownerSettings,isPrimaryAdmin:true});
assert.match(owner,/الحسابات والصلاحيات/);
assert.match(owner,/الفلاتر وقوالب المنتجات/);
assert.match(owner,/الموقع والمنشأة/);
assert.ok(!owner.includes('data-cloud-view="search-filters"') === false);
const expanded=nav.groups({view:'products',allowed:new Set(['overview',...content.map(x=>x[0]),...ownerSettings.map(x=>x[0]),'template-settings','business-settings','bank-settings']),adminViewItems:content,ownerSettingsViewItems:[...ownerSettings,['template-settings','قالب المنتجات'],['business-settings','بيانات الشركة'],['bank-settings','الحسابات البنكية']],isPrimaryAdmin:true});
assert.ok(expanded.find(([name])=>name==='الفلاتر وقوالب المنتجات')[1].some(([key])=>key==='template-settings'));
assert.ok(expanded.find(([name])=>name==='الموقع والمنشأة')[1].some(([key])=>key==='bank-settings'));
assert.ok(!expanded.find(([name])=>name==='الموقع والمنشأة')[1].some(([key])=>key==='search-filters'));

assert.match(owner,/<option value="search-filters" selected>/);
assert.match(owner,/aria-label="أقسام الإدارة"/);
const delegated=nav.render({view:'site-settings',allowed:new Set(['overview','leads','site-settings']),adminViewItems:content,ownerSettingsViewItems:ownerSettings,isPrimaryAdmin:false});
assert.match(delegated,/data-cloud-view="site-settings"/);
assert.doesNotMatch(delegated,/data-cloud-view="search-filters"/);
assert.doesNotMatch(delegated,/data-cloud-view="permissions"/);
// A delegated subadmin may enter exactly the owner-selected section, never
// any other section or the credentials/permissions owner-only controls.
const allDelegatable=[...content,['profile','البيانات الشخصية'],...ownerSettings,
  ['template-settings','قالب المنتجات'],['business-settings','بيانات الشركة'],
  ['bank-settings','الحسابات البنكية']];
const navigationKeys=new Set(allDelegatable.map(([key])=>key));
assert.equal(navigationKeys.size,12);
for(const selectedKey of navigationKeys){
  const groupList=nav.groups({view:selectedKey,
    allowed:new Set(['overview',selectedKey]),
    adminViewItems:allDelegatable.filter(([key])=>!['site-settings','search-filters','template-settings','business-settings','bank-settings'].includes(key)),
    ownerSettingsViewItems:allDelegatable.filter(([key])=>['site-settings','search-filters','template-settings','business-settings','bank-settings'].includes(key)),
    isPrimaryAdmin:false});
  const actual=groupList.flatMap(([,rows])=>rows.map(([key])=>key));
  assert.deepEqual(Array.from(actual),['overview',selectedKey],'Permission isolation for '+selectedKey);
}

console.log('ADMIN_NAVIGATION_MODULE_OK');
