import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../catalog-export.js',import.meta.url),'utf8');
const index=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const sw=fs.readFileSync(new URL('../sw.js',import.meta.url),'utf8');
const build=fs.readFileSync(new URL('../scripts/build.mjs',import.meta.url),'utf8');
assert.ok(index.indexOf('catalog-pdf-renderer.js?v=__FL_VERSION__') <
  index.indexOf('catalog-export.js?v=__FL_VERSION__'));
assert.ok(index.indexOf('catalog-export.js?v=__FL_VERSION__') <
  index.indexOf('app.js?v=__FL_VERSION__'));
assert.match(sw,/\.\/catalog-export\.js\?v=__FL_VERSION__/);
assert.match(sw,/path\.endsWith\('\/catalog-export\.js'\)/);
assert.match(build,/'catalog-export\.js'/);

const products=[
  {id:'one',model:'FL-01',name:'مصباح 1'},
  {id:'two',model:'FL-02',name:'مصباح 2'}
];
const saved=[];
const jpgFiles=[];
const tracking=[];
const toast=[];
let pdfImages=0;
let pageAdds=0;
let modalChoice='pdf';
let rendered=0;
const mainLabel={textContent:'تنزيل جميع المنتجات'};
const mainButton={disabled:false,dataset:{hasProducts:'true'},querySelector(){return mainLabel}};
const categoryLabel={textContent:'تحميل قسم'};
const categoryButton={disabled:false,dataset:{hasProducts:'true'},querySelector(){return categoryLabel}};
const document={
  fonts:{load:async()=>{}},
  body:{appendChild(){}},
  createElement(tag){
    assert.equal(tag,'a');
    return {href:'',download:'',click(){saved.push(this.download)},remove(){}};
  }
};
const context={
  document,Blob,Promise,console,
  setTimeout:callback=>callback(),
  URL:{createObjectURL:()=> 'blob:catalog-test',revokeObjectURL(){}},
  window:{requestAnimationFrame:callback=>callback(),setTimeout:callback=>callback()}
};
vm.runInNewContext(source,context,{filename:'catalog-export.js'});
assert.equal(typeof context.window.FL_CATALOG_EXPORT?.create,'function');
assert.throws(()=>context.window.FL_CATALOG_EXPORT.create({}),/Catalog export missing dependency/);

const module=context.window.FL_CATALOG_EXPORT.create({
  catalogDownloadPdf:mainButton,
  catalogDownloadPdfLabel:mainLabel,
  catalogPdfEntries:()=>products.map(item=>({item})),
  sectionPdfEntries:section=>section.items.map(item=>({item})),
  productDisplayName:item=>item.name,
  safePdfFilePart:value=>String(value).replace(/\s+/g,'-'),
  createProductOverviewPdfPage:async()=>{
    rendered++;
    return {canvas:{toDataURL:()=> 'data:image/jpeg;base64,AA=='},failedImages:0};
  },
  downloadCanvasAsJpg:async(canvas,name)=>{jpgFiles.push(name)},
  askExportChoice:async()=>modalChoice,
  loadJsPdfOnDemand:async()=>class {
    addPage(){pageAdds++}
    addImage(){pdfImages++}
    output(){return new Blob(['pdf'],{type:'application/pdf'})}
  },
  showPublicToast:message=>toast.push(message),
  trackEvent:(name,params)=>tracking.push({name,params}),
  queryCategoryButtons:()=>[categoryButton],
  PDF_EXPORT_SCALE:2,
  JPG_EXPORT_SCALE:3,
  PDF_IMAGE_QUALITY:.94
});
assert.equal(Object.isFrozen(module),true);
await module.handleCatalogDownloadChoice();
assert.deepEqual(saved,['flower-light-products-datasheet.pdf']);
assert.equal(pdfImages,2);
assert.equal(pageAdds,1);
assert.equal(rendered,2);
assert.equal(module.isBusy(),false);
assert.equal(mainButton.disabled,false);
assert.equal(categoryButton.disabled,false);
assert.equal(mainLabel.textContent,'تنزيل جميع المنتجات');
assert.equal(tracking[0].params.products_count,2);
modalChoice='jpg';
await module.handleSectionDownloadChoice({name:'إنارة',items:[products[0]]},categoryButton);
assert.deepEqual(jpgFiles,['إنارة-01-FL-01.jpg']);
assert.equal(module.isBusy(),false);
assert.equal(categoryLabel.textContent,'تحميل قسم');
assert.equal(tracking[1].params.products_count,1);
assert.equal(tracking[1].params.category,'إنارة');
assert.ok(toast.length>=2);
console.log('CATALOG_EXPORT_MODULE_OK');
