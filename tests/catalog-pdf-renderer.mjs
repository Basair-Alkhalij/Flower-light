import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const pdfSource=fs.readFileSync(new URL('../catalog-pdf-renderer.js',import.meta.url),'utf8');
const appSource=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const sw=fs.readFileSync(new URL('../sw.js',import.meta.url),'utf8');

const rendererPos=html.indexOf('catalog-pdf-renderer.js?v=__FL_VERSION__');
const appPos=html.indexOf('app.js?v=__FL_VERSION__');
assert.ok(rendererPos>0 && rendererPos<appPos,'PDF renderer must load before app.js');
assert.match(html,/<script src="catalog-pdf-renderer.js\?v=__FL_VERSION__" defer><\/script>/);
assert.match(sw,/\.\/catalog-pdf-renderer\.js\?v=__FL_VERSION__/);
assert.match(sw,/path\.endsWith\('\/catalog-pdf-renderer\.js'\)/);
assert.ok(appSource.includes('FL_CATALOG_PDF_RENDERER?.create'),'Public app must use extracted module');
assert.doesNotMatch(appSource,/function createBrandedProductPdfPage\(/,
  'PDF layout code must not be duplicated in app.js');

let drawCalls=0;
const gradient={addColorStop(){}};
const ctx=new Proxy({
  measureText(text){return {width:String(text).length*11}},
  createLinearGradient(){return gradient},
  createRadialGradient(){return gradient},
  getImageData(){return {data:new Uint8ClampedArray(4)}},
  setTransform(){},
  drawImage(){drawCalls++},
  fillText(){drawCalls++}
},{get(target,key){return key in target?target[key]:(typeof key==='symbol'?undefined:()=>{});},set(target,key,value){target[key]=value;return true}});
const canvas={width:0,height:0,getContext(){return ctx},toBlob(callback){callback(new Blob(['test'],{type:'image/jpeg'}));}};
const window={FLOWER_LIGHT_PRODUCTS:{extraSections:[]},FLOWER_LIGHT_PROFILE:{brand_name:'Flower Light'},FLOWER_LIGHT_SITE_SETTINGS:{},FLOWER_LIGHT_CONTACTS:[]};
const sandbox={window,document:{createElement(type){assert.equal(type,'canvas');return {...canvas}}},fetch:async()=>{throw Error('Offline fixture');},
  URL:{revokeObjectURL(){}},Image:class {},console:{warn(){}},Blob,Uint8ClampedArray,Promise,Math,Set,String,Number,Array};
vm.runInNewContext(pdfSource,sandbox,{filename:'catalog-pdf-renderer.js'});
assert.equal(typeof window.FL_CATALOG_PDF_RENDERER?.create,'function');
const module=window.FL_CATALOG_PDF_RENDERER.create({
  productDisplayName:item=>item.name||'بدون اسم',
  productPricingLines:item=>item.price?[{label:'السعر',value:item.price}]:[],
  productSpecifications:item=>item.specifications||[],
  specificationDisplayValue:spec=>spec?.value||'',
  normalizedProductGallery:item=>item.gallery||[]
});
assert.ok(Object.isFrozen(module));
assert.equal(module.PDF_EXPORT_SCALE,2);
assert.equal(module.JPG_EXPORT_SCALE,3);
assert.equal(module.PDF_IMAGE_QUALITY,.94);
assert.equal(module.JPG_IMAGE_QUALITY,.94);
const item={id:'one',name:'كشاف تجريبي',model:'FL-101',caption:'وصف تجريبي',image:'',price:120,specifications:[{key:'wattage',label:'الواط',value:'12W'}]};
const section={name:'كشافات',items:[item,{...item,image:'data:image/png;base64,AA=='}]};
assert.equal(module.sectionPdfEntries(section).length,1);
window.FLOWER_LIGHT_PRODUCTS.extraSections=[section];
assert.equal(module.catalogPdfEntries().length,1);
assert.throws(()=>window.FL_CATALOG_PDF_RENDERER.create({}),/PDF renderer missing dependency/);

const {canvas:page,failedImages,imageCount}=await module.createProductOverviewPdfPage(item,{scale:1});
assert.equal(page.width,1000);
assert.equal(page.height,1414);
assert.equal(imageCount,1);
assert.equal(failedImages,1); // Placeholder instead of a missing image.
assert.ok(drawCalls>0,'Expected product branding and text drawing');
console.log('CATALOG_PDF_RENDERER_SPLIT_OK');
