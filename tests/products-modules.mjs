import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root=fileURLToPath(new URL('..',import.meta.url));
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

const core={
  db:{storage:{from(){return {copy:async()=>({error:null}),remove:async()=>({error:null}),upload:async()=>({error:null})};}},rpc:async()=>({error:null})},
  bucket:'product-images',
  categories:[{id:'c1',name:'ثريات'}],
  products:[
    {id:'p1',category_id:'c1',sort_order:20,created_at:'2026-01-02',image_path:'c1/a.l.webp'},
    {id:'p2',category_id:'c1',sort_order:10,created_at:'2026-01-01',image_path:'c1/b.l.webp'},
  ],
  productImages:[
    {id:'i1',product_id:'p1',image_path:'c1/a2.l.webp',sort_order:10,is_primary:false},
    {id:'i0',product_id:'p1',image_path:'c1/a.l.webp',sort_order:0,is_primary:true},
  ],
  siteCatalogs:[],selectedCategory:'c1',selectedProductNode:'category:c1',
  MAX_PRODUCT_IMAGES:4,
  esc:value=>String(value??''),notify(){},layout(){},body:{querySelector(){return null},querySelectorAll(){return[]}},
  imageUrl:path=>`https://cdn.example/${path}`,isStoragePath:path=>Boolean(path),
  syncPublicProductsFromAdminCache(){},loadCatalogAdminData:async()=>{},normalizeSpecifications:()=>[],productPricingTiers:()=>[],PRICE_TIER_TYPE_MAP:new Map(),
  catalogAdminCard:()=>'',openCatalogForm(){},deleteCatalog(){},
  openModal(){},closeModal(){},modal:{querySelector(){return null}},modalBody:{},
  productSpecsFormHtml:()=>'',productPricingEditorHtml:()=>'',productWhatsAppOption:()=>false,
  WHATSAPP_META_SHOW_DESCRIPTION:'x',WHATSAPP_META_SHOW_SPECS:'y',productSpecEditorRowHtml:()=>'',pricingTierEditorRowHtml:()=>'',syncPriceTierRow(){},
  collectProductPricingTiers:()=>[],collectProductSpecifications:()=>[],newCategorySlug:()=> 'new',PRODUCT_SPEC_FIELDS:[],pricingMetaRow:()=>({}),normalizeCatalogSelections(){},
  renderProducts(){},renderApp(){},
};

const context={
  window:{FL_ADMIN_CORE:core},console,crypto:{randomUUID:()=> 'uuid'},confirm:()=>true,
  document:{createElement(){return {getContext(){return {drawImage(){}}}}},getElementById(){return null},querySelector(){return null}},
  FileReader:function(){},Image:function(){},File:function(){},DOMParser:function(){},fetch:async()=>({ok:true,blob:async()=>new Blob()}),
  Blob,URL,setTimeout,clearTimeout,Map,Set,WeakMap,Array,Object,String,Number,Boolean,Math,RegExp,Date,Promise,
};
vm.createContext(context);

vm.runInContext(read('admin-media.js'),context,{filename:'admin-media.js'});
assert.ok(context.window.FL_ADMIN_MEDIA,'media module did not register');
assert.equal(context.window.FL_ADMIN_MEDIA.productThumbnailPath('c1/a.l.webp'),'c1/a.s.webp');
assert.deepEqual(Array.from(context.window.FL_ADMIN_MEDIA.productStoragePairPaths('c1/a.l.webp')),['c1/a.l.webp','c1/a.s.webp']);

core.productThumbnailPath=context.window.FL_ADMIN_MEDIA.productThumbnailPath;
core.productStoragePairPaths=context.window.FL_ADMIN_MEDIA.productStoragePairPaths;
core.storagePathUsedByOtherProduct=context.window.FL_ADMIN_MEDIA.storagePathUsedByOtherProduct;
core.fileToOptimizedBlob=context.window.FL_ADMIN_MEDIA.fileToOptimizedBlob;
core.uploadBlob=context.window.FL_ADMIN_MEDIA.uploadBlob;
core.uploadProductImagePair=context.window.FL_ADMIN_MEDIA.uploadProductImagePair;
core.uploadProductCatalogPdf=context.window.FL_ADMIN_MEDIA.uploadProductCatalogPdf;

vm.runInContext(read('admin-products.js'),context,{filename:'admin-products.js'});
assert.ok(context.window.FL_ADMIN_PRODUCTS,'products module did not register');
assert.equal(context.window.FL_ADMIN_PRODUCTS.nextProductSort('c1'),30);
const gallery=Array.from(context.window.FL_ADMIN_PRODUCTS.adminGalleryRows(core.products[0]));
assert.equal(gallery.length,2);
assert.equal(gallery[0].image_path,'c1/a.l.webp');
assert.equal(gallery[0].is_primary,true);
core.adminGalleryRows=context.window.FL_ADMIN_PRODUCTS.adminGalleryRows;
core.nextProductSort=context.window.FL_ADMIN_PRODUCTS.nextProductSort;

vm.runInContext(read('admin-product-form.js'),context,{filename:'admin-product-form.js'});
assert.equal(typeof context.window.FL_ADMIN_PRODUCT_FORM?.openProductForm,'function');
vm.runInContext(read('admin-product-specs.js'),context,{filename:'admin-product-specs.js'});
core.PRODUCT_SPEC_FIELDS.push(...context.window.FL_ADMIN_PRODUCT_SPECS.PRODUCT_SPEC_FIELDS);
core.resolveProductSpecDefinition=context.window.FL_ADMIN_PRODUCT_SPECS.resolveProductSpecDefinition;
core.normalizeKnownSpecValue=context.window.FL_ADMIN_PRODUCT_SPECS.normalizeKnownSpecValue;
vm.runInContext(read('admin-import.js'),context,{filename:'admin-import.js'});
assert.equal(typeof context.window.FL_ADMIN_IMPORT?.openProductExcelImport,'function');
assert.equal(typeof context.window.FL_ADMIN_IMPORT?.downloadExcelTemplate,'function');

const adminSource=read('admin.js');
const specSource=read('admin-product-specs.js');
const appSource=read('app.js');
const formSource=read('admin-product-form.js');
const listSource=read('admin-products.js');
const importSource=read('admin-import.js');
assert.match(formSource,/flProdAvailability/);
assert.match(formSource,/availability:document\.getElementById\('flProdAvailability'\)/);
assert.match(listSource,/AVAILABILITY_LABELS/);
assert.match(listSource,/availability:productAvailability\(source\.availability\)/);
assert.match(importSource,/حالة التوفر/);
assert.match(importSource,/normalizeImportAvailability/);
assert.match(importSource,/parseImportEnglishSpec/);
assert.match(importSource,/name_en:row\.name_en/);
assert.match(importSource,/standardSpecDefs=PRODUCT_SPEC_FIELDS/);
assert.match(importSource,/availability:row\.availability/);
assert.match(specSource,/PRODUCT_SPEC_ALIAS_GROUPS/);
assert.match(specSource,/الواط/);
assert.match(adminSource,/resolveProductSpecDefinition/);
assert.match(adminSource,/data-flex-spec-type/);
assert.match(formSource,/data-flex-spec-type/);
assert.match(formSource,/syncSpecRow/);
assert.match(importSource,/normalizeKnownSpecValue/);
assert.match(appSource,/canonicalProductSpecKey/);
assert.match(appSource,/PRODUCT_SPEC_ALIAS_LOOKUP/);

// Workbook round-trip: all technical-spec columns + Arabic/English values are real import fields.
const testWorksheet=(rows)=>({rows,__rows:rows});
let exportedWorkbook=null;
context.window.XLSX={
  utils:{
    book_new:()=>({SheetNames:[],Sheets:{}}),
    aoa_to_sheet:rows=>testWorksheet(rows),
    book_append_sheet:(wb,ws,name)=>{wb.SheetNames.push(name);wb.Sheets[name]=ws;},
    encode_col:n=>{let s='';for(let v=n+1;v;v=Math.floor((v-1)/26))s=String.fromCharCode(65+(v-1)%26)+s;return s;},
    sheet_to_json:sheet=>sheet.__rows||[]
  },
  writeFile:(wb)=>{exportedWorkbook=wb;},
  read:()=>({SheetNames:['المنتجات','دليل المواصفات'],Sheets:{
    'المنتجات':testWorksheet([{'اسم المنتج (عربي)':'جدارية تجريبية','اسم المنتج (English)':'Wall light','الوصف (عربي)':'وصف عربي','الوصف (English)':'English description','الكود':'WL-205','القدرة (W)':'12W','EN: القدرة | Power':'12 W','اللومن (lm)':'1200','EN: اللومن | Lumens':'1200 lm','حالة التوفر':'متوفر','ظاهر':'نعم','وصف واتساب':'نعم','مواصفات واتساب':'لا','الصورة 1':'https://example.com/product.jpg'}]),
    'دليل المواصفات':testWorksheet([{'المفتاح':'sku','المواصفة بالعربي':'SKU / كود المنتج'}])
  }})
};
context.window.JSZip={loadAsync:async()=>({file:()=>null})};
await context.window.FL_ADMIN_IMPORT.downloadExcelTemplate();
assert.ok(exportedWorkbook,'Excel export was not called');
const worksheet=exportedWorkbook.Sheets['ثريات'];
assert.ok(worksheet,'category worksheet was not exported');
const exportedHeader=worksheet.rows[0];
assert.equal(exportedHeader.length,23+15*2);
assert.ok(exportedHeader.includes('اسم المنتج (English)'));
assert.ok(exportedHeader.includes('الوصف (English)'));
assert.ok(exportedHeader.includes('EN: القدرة | Power'));
assert.ok(exportedHeader.includes('EN: درجة الحماية IP | IP rating'));
assert.ok(exportedWorkbook.Sheets['دليل المواصفات'],'specification guide missing');
const plan=await context.window.FL_ADMIN_IMPORT.parseProductImportFile({name:'products.xlsx',arrayBuffer:async()=>new ArrayBuffer(0)});
assert.equal(plan.total,1);
assert.equal(plan.sections.length,1,'specification guide must be ignored');
const imported=plan.sections[0].products[0];
assert.equal(imported.name,'جدارية تجريبية');
assert.equal(imported.name_en,'Wall light');
assert.equal(imported.caption_en,'English description');
assert.equal(imported.whatsapp_description,true);
assert.equal(imported.whatsapp_specs,false);
assert.equal(imported.specifications.find(row=>row.key==='wattage')?.value,'12');
assert.equal(imported.specifications.find(row=>row.key==='wattage')?.unit,'W');
assert.equal(imported.specifications_en.find(row=>row.key==='wattage')?.label,'Power');
assert.equal(imported.specifications_en.find(row=>row.key==='wattage')?.value,'12 W');
assert.equal(imported.specifications_en.find(row=>row.key==='lumens')?.value,'1200 lm');
assert.equal(imported.imageRefs[0],'https://example.com/product.jpg');

console.log('PRODUCT_MODULES_RUNTIME_OK');
