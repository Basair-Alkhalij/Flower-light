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

assert.equal(m.formatProductSpecValue({key:'lumens',label:'اللومن',value:'1200',unit:'lm'},'ar'),'1200');
assert.equal(m.formatProductSpecValue({key:'lumens',label:'اللومن',value:'1200 lm',unit:'lm'},'ar'),'1200');
assert.equal(m.formatProductSpecValue({key:'lumens',label:'اللومن',value:'1200 lm lm',unit:'lm'},'ar'),'1200');
assert.equal(m.formatProductSpecValue({key:'wattage',label:'القدرة',value:'100 W W',unit:'W'},'ar'),'100 واط');
assert.equal(m.formatProductSpecValue({key:'lumens',label:'اللومن',value:'1200 لومن',unit:'lm'},'ar'),'1200');
assert.equal(m.formatProductSpecValue({key:'wattage',label:'القدرة',value:'100',unit:'W'},'ar'),'100 واط');
assert.equal(m.formatProductSpecValue({key:'wattage',label:'القدرة',value:'100W',unit:'W'},'ar'),'100 واط');
assert.equal(m.formatProductSpecValue({key:'wattage',label:'الواط',value:'100W',unit:'W'},'ar'),'100');
assert.equal(m.formatProductSpecValue({key:'wattage',label:'Power',value:'100 واط',unit:'W'},'en'),'100 W');
assert.equal(m.formatProductSpecValue({key:'lumens',label:'Lumens',value:'1200 lm',unit:'lm'},'en'),'1200 lm');
assert.equal(m.formatProductSpecValue({key:'voltage',label:'الفولت',value:'220 V',unit:'V'},'ar'),'220');
assert.equal(m.formatProductSpecValue({key:'voltage',label:'الفولت',value:'220/240 فولت V',unit:'V'},'ar'),'220/240');
assert.equal(m.formatProductSpecValue({key:'voltage',label:'الفولت',value:'220/240 فولت V',unit:'V'},'en'),'220/240 V');
assert.equal(m.formatProductSpecValue({key:'voltage',label:'الجهد',value:'220/240 V',unit:'V'},'ar'),'220/240 فولت');
assert.equal(m.formatProductSpecValue({key:'cct',label:'حرارة اللون',value:'3000/6500 K كلفن',unit:'K'},'ar'),'3000/6500 كلفن');
assert.equal(m.formatProductSpecValue({key:'cct',label:'Color temperature',value:'3000/6500 K كلفن',unit:'K'},'en'),'3000/6500 K');
assert.equal(m.formatProductSpecValue({key:'frequency',label:'التردد',value:'50/60 هرتز Hz',unit:'Hz'},'ar'),'50/60 هرتز');
assert.equal(m.formatProductSpecValue({key:'frequency',label:'Frequency',value:'50/60 هرتز Hz',unit:'Hz'},'en'),'50/60 Hz');
assert.equal(m.formatProductSpecValue({key:'beam_angle',label:'زاوية الإضاءة',value:'120 درجة °',unit:'°'},'ar'),'120°');
assert.equal(m.formatProductSpecValue({key:'beam_angle',label:'Beam angle',value:'120°',unit:'°'},'en'),'120°');
assert.equal(m.formatProductSpecValue({key:'dimensions',label:'المقاس',value:'25 سم سم',unit:'سم'},'ar'),'25 سم');
assert.equal(m.formatProductSpecValue({key:'dimensions',label:'المقاس',value:'30 × 12 × 8 سم'},'ar'),'30 × 12 × 8 سم');

assert.equal(m.formatProductSpecValue({key:'ip_rating',label:'درجة الحماية',value:'IP65'},'ar'),'IP65');
assert.equal(m.formatProductSpecValue({key:'color',label:'اللون',value:'ذهبي'},'ar'),'ذهبي');
assert.equal(m.formatProductSpecValue({key:'wattage',label:'القدرة',value:'',unit:'W'},'ar'),'');
assert.match(fs.readFileSync(new URL('../catalog-specifications.js',import.meta.url),'utf8'),/return formatProductSpecValue\(spec,window\.FL_I18N/,'product cards, WhatsApp and data sheets must use common display formatting');

console.log('CATALOG_PRODUCT_META_OK');
