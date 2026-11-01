import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../catalog-links.js',import.meta.url),'utf8');
const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const window={
  location:{
    href:'https://basair-alkhalij.github.io/Flower-light/?admin=1&product=old&v=123&other=ok#details',
    search:'?admin=1&product=old&v=123&other=ok'
  },
  FLOWER_LIGHT_CONTACTS:[
    {type:'whatsapp',value:'0560933353',is_visible:true},
    {type:'whatsapp',value:'0570000000',is_visible:false}
  ],
  FLOWER_LIGHT_PROFILE:{brand_name:'Flower Light'}
};
vm.runInNewContext(source,{window,URL,URLSearchParams});
assert.equal(typeof window.FL_CATALOG_LINKS?.create,'function');
const links=window.FL_CATALOG_LINKS.create({
  productDisplayName:item=>item.name||'منتج',
  productWhatsAppOption:(specs,key)=>key==='showDesc'||key==='showSpecs',
  productSpecsText:()=>['الواط: 12W','اللون: أبيض'],
  WHATSAPP_META_SHOW_DESCRIPTION:'showDesc',
  WHATSAPP_META_SHOW_SPECS:'showSpecs'
});
assert.equal(links.normalizeWhatsAppNumber('05 6093 3353'),'966560933353');
assert.equal(links.normalizeWhatsAppNumber('00966560933353'),'966560933353');
assert.equal(links.primaryWhatsAppNumber(),'966560933353');
const item={id:'sku 12',name:'كشاف تجريبي',model:'SKU 12',caption:'إضاءة مميزة',specifications:[]};
const msg=links.productWhatsAppMessage(item);
assert.match(msg,/كشاف تجريبي/);
assert.match(msg,/رقم المنتج \/ الكود: SKU 12/);
assert.match(msg,/إضاءة مميزة/);
assert.match(msg,/الواط: 12W/);
assert.match(links.productWhatsAppUrl(item),/^https:\/\/wa\.me\/966560933353\?text=/);
assert.ok(decodeURIComponent(links.productWhatsAppUrl(item).split('text=')[1]).includes('كشاف تجريبي'));
assert.equal(links.isAdminUrl(),true);
const shared=new URL(links.buildPublicShareUrl({category:'wall-lights'}));
assert.equal(shared.searchParams.has('admin'),false);
assert.equal(shared.searchParams.has('product'),false);
assert.equal(shared.searchParams.has('v'),false);
assert.equal(shared.searchParams.get('other'),'ok');
assert.equal(shared.searchParams.get('category'),'wall-lights');
assert.equal(shared.hash,'');
assert.equal(links.categoryShareUrl({slug:'wall-lights'}),'https://basair-alkhalij.github.io/Flower-light/c/wall-lights/');
assert.equal(links.productShareUrl(item),'https://basair-alkhalij.github.io/Flower-light/p/sku%2012/');
window.FLOWER_LIGHT_CONTACTS[0].is_visible=false;
assert.equal(links.productWhatsAppUrl(item),'#');
assert.match(app,/FL_CATALOG_LINKS\?\.create/);
assert.doesNotMatch(app,/function productWhatsAppMessage\(/);
assert.doesNotMatch(app,/function categoryShareUrl\(/);
console.log('CATALOG_LINKS_MODULE_OK');
