import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../catalog-specifications.js',import.meta.url),'utf8');
const settings={catalog_custom_filters:[{key:'custom_filter_test1',label:'إضاءة جانبية'}]};
const ctx={
  window:{
    FLOWER_LIGHT_SITE_SETTINGS:settings,
    FL_CATALOG_PRODUCT_META:{formatProductSpecValue:spec=>[spec.value,spec.unit].filter(Boolean).join(' ')},
    FL_CATALOG_PRICING:{PRICING_META_KEY:'__pricing_tiers'}
  },
  document:{createElement:()=>{throw Error('No DOM needed for normalization checks');}},
  console
};
vm.runInNewContext(source,ctx);
const mod=ctx.window.FL_CATALOG_SPECIFICATIONS;
assert.equal(typeof mod.canonicalProductSpecKey,'function');
assert.equal(typeof mod.createProductSpecsElement,'function');
assert.equal(mod.canonicalProductSpecKey('custom_1','اضاءه جانبيه'),'custom_filter_test1');
assert.equal(mod.canonicalProductSpecKey('custom_filter_test1','القدرة'),'custom_filter_test1');
assert.equal(mod.canonicalProductSpecKey('legacy_foo','سوكت'),'bulb_base');
assert.equal(mod.canonicalProductSpecKey('legacy_foo','socket'),'bulb_base');
assert.equal(mod.canonicalProductSpecKey('legacy_foo','dimension'),'dimensions');
assert.equal(mod.canonicalProductSpecKey('legacy_foo','مواصفة غير معروفة'),'legacy_foo');
const specs=Array.from(mod.normalizeProductSpecifications([
  {key:'custom_1',label:'اضاءه جانبيه',value:'نعم'},
  {key:'legacy_foo',label:'سوكت',value:'E27'},
  {key:'__whatsapp_show_description',value:'1'},
  {key:'__pricing_tiers',value:'[]'},
  {key:'other',label:'مواصفة غير معروفة',value:'متاح',unit:'م'}
]));
assert.equal(specs.length,3);
assert.equal(specs[0].key,'custom_filter_test1');
assert.equal(specs[1].key,'bulb_base');
assert.equal(specs[2].unit,'م');
assert.deepEqual(Array.from(mod.productSpecsText({specifications:[{key:'wattage',value:'12',unit:'W'}]})),['القدرة: 12 W']);
assert.equal(mod.productWhatsAppOption([{key:'__whatsapp_show_description',value:'yes'}],mod.WHATSAPP_META_SHOW_DESCRIPTION),true);
assert.equal(mod.productWhatsAppOption([{key:'__whatsapp_show_specifications',value:'off'}],mod.WHATSAPP_META_SHOW_SPECS),false);
settings.catalog_custom_filters.push({key:'custom_filter_test2',label:'اضاءة جانبية'});
assert.equal(mod.canonicalProductSpecKey('custom_1','اضاءه جانبيه'),'custom_1','Ambiguous filter labels must not resolve');
delete ctx.window.FLOWER_LIGHT_SITE_SETTINGS;
assert.equal(mod.canonicalProductSpecKey('custom_1','اضاءه جانبيه'),'custom_1','Missing site settings must not remap legacy keys');
assert.equal(Object.isFrozen(mod),true);

const index=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const pos=name=>index.indexOf(name+'?v=__FL_VERSION__');
assert.ok(pos('catalog-product-meta.js')<pos('catalog-pricing.js'));
assert.ok(pos('catalog-pricing.js')<pos('catalog-specifications.js'));
assert.ok(pos('catalog-specifications.js')<pos('app.js'));
const sw=fs.readFileSync(new URL('../sw.js',import.meta.url),'utf8');
assert.ok(sw.includes("'./catalog-specifications.js?v=__FL_VERSION__'"));
assert.ok(sw.includes("path.endsWith('/catalog-specifications.js')"));
console.log('CATALOG_SPECIFICATIONS_MODULE_OK');
