import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const window={};
vm.runInNewContext(fs.readFileSync(new URL('../catalog-product-meta.js',import.meta.url),'utf8'),{window});
const m=window.FL_CATALOG_PRODUCT_META;
assert.equal(m.productDisplayName({name:'مصباح',caption:'رقم 1'}),'مصباح');
assert.equal(m.productDisplayName({caption:'رقم 1'}),'رقم 1');
assert.equal(m.productDisplayName({}),'منتج');
for(const [code,label] of [['available','متوفر'],['out_of_stock','نفد'],['coming_soon','قريبًا']]){assert.equal(m.normalizeProductAvailability(code),code);assert.equal(m.productAvailabilityLabel(code),label)}
assert.equal(m.normalizeProductAvailability('unknown'),'available');
assert.equal(m.productAvailabilityLabel(null),'متوفر');
console.log('CATALOG_PRODUCT_META_OK');
