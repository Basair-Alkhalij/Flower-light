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
vm.runInContext(read('admin-import.js'),context,{filename:'admin-import.js'});
assert.equal(typeof context.window.FL_ADMIN_IMPORT?.openProductExcelImport,'function');
assert.equal(typeof context.window.FL_ADMIN_IMPORT?.downloadExcelTemplate,'function');

const formSource=read('admin-product-form.js');
const listSource=read('admin-products.js');
const importSource=read('admin-import.js');
assert.match(formSource,/flProdAvailability/);
assert.match(formSource,/availability:document\.getElementById\('flProdAvailability'\)/);
assert.match(listSource,/AVAILABILITY_LABELS/);
assert.match(listSource,/availability:productAvailability\(source\.availability\)/);
assert.match(importSource,/حالة التوفر/);
assert.match(importSource,/normalizeImportAvailability/);
assert.match(importSource,/availability:row\.availability/);

console.log('PRODUCT_MODULES_RUNTIME_OK');
