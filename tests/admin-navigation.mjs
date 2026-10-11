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
const expanded=nav.groups({view:'products',allowed:new Set(['overview',...content.map(x=>x[0])]),adminViewItems:content,ownerSettingsViewItems:[...ownerSettings,['template-settings','قالب المنتجات'],['business-settings','بيانات الشركة'],['bank-settings','الحسابات البنكية']],isPrimaryAdmin:true});
assert.ok(expanded.find(([name])=>name==='الفلاتر وقوالب المنتجات')[1].some(([key])=>key==='template-settings'));
assert.ok(expanded.find(([name])=>name==='الموقع والمنشأة')[1].some(([key])=>key==='bank-settings'));
assert.ok(!expanded.find(([name])=>name==='الموقع والمنشأة')[1].some(([key])=>key==='search-filters'));

assert.match(owner,/<option value="search-filters" selected>/);
assert.match(owner,/aria-label="أقسام الإدارة"/);
console.log('ADMIN_NAVIGATION_MODULE_OK');
