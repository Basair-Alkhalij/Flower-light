// Flower Light admin — Excel/ZIP import and export (v100 module split)
(() => {
  'use strict';
  const core=window.FL_ADMIN_CORE;
  if(!core){console.error('[admin-import] FL_ADMIN_CORE missing');return;}
  const db = new Proxy({}, { get: (_, prop) => { const real=core.db; const value=real[prop]; return typeof value==='function'?value.bind(real):value; } });
  function liveArray(key){
    return new Proxy([], {
      get(_target,prop){ const arr=core[key]||[]; const value=arr[prop]; return typeof value==='function'?value.bind(arr):value; },
      set(_target,prop,value){ const arr=core[key]||[]; arr[prop]=value; return true; },
      ownKeys(){ return Reflect.ownKeys(core[key]||[]); },
      getOwnPropertyDescriptor(){ return { configurable:true, enumerable:true }; }
    });
  }
  const categories=liveArray('categories');
  const products=liveArray('products');
  const { esc,notify,openModal,closeModal,modalBody,MAX_PRODUCT_IMAGES,PRODUCT_SPEC_FIELDS,resolveProductSpecDefinition,normalizeSpecifications,productPricingTiers,productWhatsAppOption,WHATSAPP_META_SHOW_DESCRIPTION,WHATSAPP_META_SHOW_SPECS,pricingMetaRow,adminGalleryRows,imageUrl,newCategorySlug,nextProductSort,isStoragePath,storagePathUsedByOtherProduct,bucket,loadCatalogAdminData,syncPublicProductsFromAdminCache,uploadProductImagePair,productStoragePairPaths }=core;
  const XLSX_IMPORT_CDN='https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
  const XLSX_IMPORT_SRI='sha384-EnyY0/GSHQGSxSgMwaIPzSESbqoOLSexfnSMN2AP+39Ckmn92stwABZynq1JyzdT';
  const JSZIP_IMPORT_CDN='https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
  const JSZIP_IMPORT_SRI='sha384-+mbV2IY1Zk/X1p/nWllGySJSUN8uMs+gUAN10Or95UBH0fpj6GfKgPmgC5EXieXG';
  let productImportLibrariesPromise=null;
  let currentProductImportPlan=null;

  function loadAdminScriptOnce(src,marker,test,integrity){
    if(test()) return Promise.resolve();
    return new Promise((resolve,reject)=>{
      const existing=document.querySelector(`script[data-${marker}]`);
      const done=()=>test()?resolve():reject(new Error('تعذر تحميل مكتبة الاستيراد'));
      if(existing){existing.addEventListener('load',done,{once:true});existing.addEventListener('error',()=>reject(new Error('تعذر تحميل مكتبة الاستيراد')),{once:true});return;}
      const script=document.createElement('script');script.src=src;script.async=true;script.setAttribute(`data-${marker}`,'1');if(integrity){script.integrity=integrity;script.crossOrigin='anonymous';script.referrerPolicy='no-referrer';}
      script.addEventListener('load',done,{once:true});script.addEventListener('error',()=>reject(new Error('تعذر تحميل مكتبة الاستيراد من الإنترنت')),{once:true});document.head.appendChild(script);
    });
  }

  function loadProductImportLibraries(){
    if(productImportLibrariesPromise) return productImportLibrariesPromise;
    productImportLibrariesPromise=(async()=>{
      await Promise.all([
        loadAdminScriptOnce(XLSX_IMPORT_CDN,'fl-xlsx',()=>Boolean(window.XLSX),XLSX_IMPORT_SRI),
        loadAdminScriptOnce(JSZIP_IMPORT_CDN,'fl-jszip',()=>Boolean(window.JSZip),JSZIP_IMPORT_SRI)
      ]);
      if(!window.XLSX||!window.JSZip) throw new Error('مكتبات Excel غير جاهزة');
    })().catch(error=>{productImportLibrariesPromise=null;throw error;});
    return productImportLibrariesPromise;
  }

  function importText(value){return String(value??'').trim();}
  function importKey(value){
    return importText(value).toLowerCase().replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/[\s_\-\/]+/g,' ').replace(/[.:،؛]/g,'').trim();
  }
  function importNumber(value){
    const s=importText(value).replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/,/g,'');
    if(!s) return null; const n=Number(s); return Number.isFinite(n)?n:null;
  }
  function importBoolean(value,defaultValue=false){
    const s=importKey(value);
    if(!s) return defaultValue;
    if(['نعم','yes','true','1','ظاهر','مفعل','مفعل'].includes(s)) return true;
    if(['لا','no','false','0','مخفي','غير مفعل'].includes(s)) return false;
    return defaultValue;
  }
  function normalizeImportAvailability(value,defaultValue=null){
    const s=importKey(value);
    if(!s) return defaultValue;
    if(['available','in stock','متوفر'].includes(s)) return 'available';
    if(['out of stock','out_of_stock','sold out','نفد','غير متوفر'].includes(s)) return 'out_of_stock';
    if(['coming soon','coming_soon','قريبا','قريباً'].includes(s)) return 'coming_soon';
    return defaultValue;
  }
  function excelAvailability(value){
    return ({available:'متوفر',out_of_stock:'نفد',coming_soon:'قريبًا'})[normalizeImportAvailability(value,'available')]||'متوفر';
  }
  function normalizeImportPath(value){
    const parts=String(value||'').replace(/\\/g,'/').split('/');const out=[];
    for(const part of parts){if(!part||part==='.')continue;if(part==='..')out.pop();else out.push(part);}return out.join('/');
  }
  function resolveImportPart(baseFile,target){
    const t=String(target||'').replace(/\\/g,'/');if(t.startsWith('/'))return normalizeImportPath(t.slice(1));
    const base=String(baseFile||'').replace(/\\/g,'/').split('/');base.pop();return normalizeImportPath([...base,t].join('/'));
  }
  function importMime(name){
    const ext=String(name||'').split('.').pop().toLowerCase();
    return ({jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',gif:'image/gif',bmp:'image/bmp',avif:'image/avif'})[ext]||'application/octet-stream';
  }
  function xmlLocal(root,name){return root?.getElementsByTagNameNS?.('*',name)?.[0]||null;}
  function xmlRelationships(doc){
    const map=new Map();
    [...(doc?.getElementsByTagNameNS?.('*','Relationship')||[])].forEach(node=>map.set(node.getAttribute('Id'),node.getAttribute('Target')));
    return map;
  }

  async function extractEmbeddedExcelImages(excelBuffer,workbook){
    const result=new Map();
    const addImage=(sheetName,row,col,source)=>{
      if(!sheetName||!source)return;
      let rowMap=result.get(sheetName);if(!rowMap){rowMap=new Map();result.set(sheetName,rowMap);}
      const arr=rowMap.get(row)||[];
      const signature=source.name||source.url||'';
      if(!arr.some(item=>(item.name||item.url||'')===signature))arr.push({...source,col:Number(col)||0});
      arr.sort((a,b)=>(a.col||0)-(b.col||0));rowMap.set(row,arr);
    };
    try{
      const zip=await window.JSZip.loadAsync(excelBuffer);
      const parser=new DOMParser();
      const wbEntry=zip.file('xl/workbook.xml'),relEntry=zip.file('xl/_rels/workbook.xml.rels');
      if(!wbEntry||!relEntry)return result;
      const wbDoc=parser.parseFromString(await wbEntry.async('text'),'application/xml');
      const relDoc=parser.parseFromString(await relEntry.async('text'),'application/xml');
      const wbRels=xmlRelationships(relDoc);const sheetPaths=new Map();
      [...wbDoc.getElementsByTagNameNS('*','sheet')].forEach(sheet=>{
        const name=sheet.getAttribute('name')||'';
        const rid=sheet.getAttribute('r:id')||sheet.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id');
        const target=wbRels.get(rid);if(name&&target)sheetPaths.set(name,resolveImportPart('xl/workbook.xml',target));
      });

      // A) Classic Excel pictures anchored over worksheet cells (drawing*.xml).
      for(const sheetName of workbook.SheetNames||[]){
        const wsPath=sheetPaths.get(sheetName);if(!wsPath)continue;
        const wsEntry=zip.file(wsPath);if(!wsEntry)continue;
        const wsDoc=parser.parseFromString(await wsEntry.async('text'),'application/xml');
        const drawing=xmlLocal(wsDoc,'drawing');
        if(drawing){
          const drawingRid=drawing.getAttribute('r:id')||drawing.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id');
          const wsParts=wsPath.split('/');const wsFile=wsParts.pop();const wsDir=wsParts.join('/');
          const wsRelsEntry=zip.file(`${wsDir}/_rels/${wsFile}.rels`);
          if(wsRelsEntry){
            const wsRelDoc=parser.parseFromString(await wsRelsEntry.async('text'),'application/xml');const wsRels=xmlRelationships(wsRelDoc);
            const drawingTarget=wsRels.get(drawingRid);
            if(drawingTarget){
              const drawingPath=resolveImportPart(wsPath,drawingTarget);const drawingEntry=zip.file(drawingPath);
              if(drawingEntry){
                const drawParts=drawingPath.split('/');const drawFile=drawParts.pop();const drawDir=drawParts.join('/');
                const drawingRelsEntry=zip.file(`${drawDir}/_rels/${drawFile}.rels`);
                if(drawingRelsEntry){
                  const drawDoc=parser.parseFromString(await drawingEntry.async('text'),'application/xml');
                  const drawRelDoc=parser.parseFromString(await drawingRelsEntry.async('text'),'application/xml');const drawRels=xmlRelationships(drawRelDoc);
                  const anchors=[...drawDoc.getElementsByTagNameNS('*','twoCellAnchor'),...drawDoc.getElementsByTagNameNS('*','oneCellAnchor')];
                  for(const anchor of anchors){
                    const from=xmlLocal(anchor,'from'),rowNode=xmlLocal(from,'row'),colNode=xmlLocal(from,'col'),blip=xmlLocal(anchor,'blip');
                    if(!rowNode||!blip)continue;
                    const row=Number(rowNode.textContent),col=Number(colNode?.textContent||0);
                    const embed=blip.getAttribute('r:embed')||blip.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','embed');
                    const mediaTarget=drawRels.get(embed);if(!mediaTarget)continue;
                    const mediaPath=resolveImportPart(drawingPath,mediaTarget),mediaEntry=zip.file(mediaPath);if(!mediaEntry)continue;
                    addImage(sheetName,row,col,{kind:'zipEntry',entry:mediaEntry,name:mediaPath,embedded:true,embeddedType:'drawing'});
                  }
                }
              }
            }
          }
        }
      }

      // B) Microsoft 365 "Place in Cell" pictures. These are stored as Rich Data,
      // not as worksheet drawings. Excel exposes the cell value as #VALUE!, while
      // the actual image lives under xl/media and is linked through metadata.xml.
      const metadataEntry=zip.file('xl/metadata.xml');
      const richValueEntry=zip.file('xl/richData/rdrichvalue.xml');
      const richRelEntry=zip.file('xl/richData/richValueRel.xml');
      const richRelRelsEntry=zip.file('xl/richData/_rels/richValueRel.xml.rels');
      if(metadataEntry&&richValueEntry&&richRelEntry&&richRelRelsEntry){
        const metadataDoc=parser.parseFromString(await metadataEntry.async('text'),'application/xml');
        const richValueDoc=parser.parseFromString(await richValueEntry.async('text'),'application/xml');
        const richRelDoc=parser.parseFromString(await richRelEntry.async('text'),'application/xml');
        const richRelRelsDoc=parser.parseFromString(await richRelRelsEntry.async('text'),'application/xml');

        // cell vm is 1-based into valueMetadata/bk; each bk points to a rich-value index.
        const metadataToRich=[];
        const valueMetadata=[...metadataDoc.getElementsByTagNameNS('*','valueMetadata')][0];
        if(valueMetadata){
          [...valueMetadata.getElementsByTagNameNS('*','bk')].forEach((bk,index)=>{
            const rc=xmlLocal(bk,'rc');metadataToRich[index+1]=Number(rc?.getAttribute('v'));
          });
        }

        // Each rich value's first <v> is the zero-based local-image relation index.
        const richValueToRelIndex=[];
        [...richValueDoc.getElementsByTagNameNS('*','rv')].forEach((rv,index)=>{
          const values=[...rv.getElementsByTagNameNS('*','v')];richValueToRelIndex[index]=Number(values[0]?.textContent);
        });
        const orderedRelIds=[...richRelDoc.getElementsByTagNameNS('*','rel')].map(rel=>rel.getAttribute('r:id')||rel.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id'));
        const richRels=xmlRelationships(richRelRelsDoc);

        const colIndexFromCell=ref=>{
          const letters=String(ref||'').match(/^[A-Z]+/i)?.[0]?.toUpperCase()||'A';let n=0;
          for(const ch of letters)n=n*26+(ch.charCodeAt(0)-64);return Math.max(0,n-1);
        };
        const rowIndexFromCell=ref=>Math.max(0,(Number(String(ref||'').match(/\d+/)?.[0])||1)-1);

        for(const sheetName of workbook.SheetNames||[]){
          const wsPath=sheetPaths.get(sheetName);if(!wsPath)continue;const wsEntry=zip.file(wsPath);if(!wsEntry)continue;
          const wsDoc=parser.parseFromString(await wsEntry.async('text'),'application/xml');
          const cells=[...wsDoc.getElementsByTagNameNS('*','c')];
          for(const cell of cells){
            const vm=Number(cell.getAttribute('vm')||0);if(!vm)continue;
            const richIndex=metadataToRich[vm];if(!Number.isInteger(richIndex)||richIndex<0)continue;
            const relIndex=richValueToRelIndex[richIndex];if(!Number.isInteger(relIndex)||relIndex<0)continue;
            const relId=orderedRelIds[relIndex];const target=richRels.get(relId);if(!target)continue;
            const mediaPath=resolveImportPart('xl/richData/richValueRel.xml',target);const mediaEntry=zip.file(mediaPath);if(!mediaEntry)continue;
            const ref=cell.getAttribute('r')||'';
            addImage(sheetName,rowIndexFromCell(ref),colIndexFromCell(ref),{kind:'zipEntry',entry:mediaEntry,name:mediaPath,embedded:true,embeddedType:'cell'});
          }
        }
      }
    }catch(error){console.warn('[Excel import] embedded image extraction skipped',error);}
    return result;
  }


  const IMPORT_HEADER_ALIASES={
    product_id:['معرف المنتج','product id','product_id'],name:['اسم المنتج','الاسم','product name','name'],model:['الكود','كود المنتج','رقم المنتج','model','code','sku'],caption:['الوصف','description','caption'],
    price:['سعر المفرق','سعر القطاعي','سعر التجزئه','سعر التجزئة','retail price','price'],
    wholesale_price:['سعر الجمله','سعر الجملة','wholesale price'],
    wholesale_min_qty:['الجملة أدنى','كمية الجملة','كميه الجمله','اقل كميه للجمله','أقل كمية للجملة','wholesale qty','wholesale min qty'],
    wholesale_max_qty:['الجملة أعلى','اعلى كميه للجمله','أعلى كمية للجملة','wholesale max qty'],
    bulk_price:['سعر جملة الجملة','سعر جمله الجمله','bulk wholesale price','bulk price'],
    bulk_min_qty:['جملة الجملة أدنى','جمله الجمله ادنى','bulk min qty'],
    bulk_max_qty:['جملة الجملة أعلى','جمله الجمله اعلى','bulk max qty'],
    limited_offer:['عرض محدود','عرض لفتره محدوده','عرض لفترة محدودة','limited offer'],availability:['حالة التوفر','حاله التوفر','التوفر','availability','stock status'],is_visible:['ظاهر','اظهار','إظهار','visible'],sort_order:['الترتيب','sort','sort order']
  };
  const IMPORT_ALIAS_MAP=(()=>{const m=new Map();Object.entries(IMPORT_HEADER_ALIASES).forEach(([key,list])=>list.forEach(v=>m.set(importKey(v),key)));return m;})();
  function canonicalImportHeader(header){
    const raw=importText(header),key=importKey(raw);if(!key)return null;if(IMPORT_ALIAS_MAP.has(key))return IMPORT_ALIAS_MAP.get(key);
    const img=key.match(/^(?:الصوره|صوره|image)\s*([1-4])$/);if(img)return `image${img[1]}`;return null;
  }
  function knownSpecDefinition(label){
    return resolveProductSpecDefinition?.('',label) || null;
  }
  function parseImportSpec(header,value,index){
    let label=importText(header).replace(/^\s*(?:مواصفه|مواصفة|spec)\s*[:：-]\s*/i,'').trim();if(!label||importText(value)==='')return null;
    let unit='';const match=label.match(/[\(\[]\s*([^\)\]]+)\s*[\)\]]\s*$/);if(match){unit=match[1].trim();label=label.slice(0,match.index).trim();}
    const def=knownSpecDefinition(label);if(!unit&&def?.unit)unit=def.unit;
    const text=importText(value);if(unit&&new RegExp(`${unit.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\s*$`,'i').test(text))unit='';
    return {key:def?.key||`excel_${index+1}`,label:def?.label||label,value:text,unit};
  }

  function outerZipImageLookup(zip){
    const full=new Map(),base=new Map();if(!zip)return {full,base};
    Object.values(zip.files).forEach(entry=>{if(entry.dir)return;const name=normalizeImportPath(entry.name);if(!/\.(jpe?g|png|webp|gif|bmp|avif)$/i.test(name))return;full.set(name.toLowerCase(),entry);const b=name.split('/').pop().toLowerCase();if(!base.has(b))base.set(b,entry);else base.set(b,null);});
    return {full,base};
  }
  function resolveImportImageReference(ref,lookup){
    const value=importText(ref);if(!value)return null;if(/^(https?:|data:|blob:)/i.test(value))return {kind:'url',url:value,name:value};
    const clean=normalizeImportPath(value).toLowerCase();let entry=lookup.full.get(clean);if(!entry)entry=lookup.base.get(clean.split('/').pop());return entry?{kind:'zipEntry',entry,name:entry.name,embedded:false}:null;
  }

  async function parseProductImportFile(file){
    await loadProductImportLibraries();
    const fileName=String(file?.name||'').toLowerCase();let excelBuffer=null,outerZip=null,excelName=file?.name||'';
    if(fileName.endsWith('.zip')){
      outerZip=await window.JSZip.loadAsync(file);const entries=Object.values(outerZip.files).filter(e=>!e.dir&&/\.xlsx?$/i.test(e.name)&&!/(^|\/)~\$/.test(e.name));
      if(!entries.length)throw new Error('لم أجد ملف Excel داخل ZIP');
      const preferred=entries.find(e=>/products?|منتجات|flower/i.test(e.name))||entries[0];excelBuffer=await preferred.async('arraybuffer');excelName=preferred.name;
    }else if(/\.xlsx?$/i.test(fileName)){excelBuffer=await file.arrayBuffer();}
    else throw new Error('اختر ملف Excel (.xlsx) أو ZIP يحتوي Excel والصور');

    const workbook=window.XLSX.read(excelBuffer,{type:'array',cellDates:false});
    const embedded=await extractEmbeddedExcelImages(excelBuffer,workbook);const outerLookup=outerZipImageLookup(outerZip);
    const ignoreSheets=new Set(['تعليمات','instructions','instruction','readme','ملاحظات']);const sections=[];let total=0,resolvedImages=0,missingImages=0;
    for(const sheetName of workbook.SheetNames||[]){
      if(ignoreSheets.has(importKey(sheetName)))continue;const sheet=workbook.Sheets[sheetName];if(!sheet)continue;
      const rows=window.XLSX.utils.sheet_to_json(sheet,{defval:'',raw:false});if(!rows.length)continue;
      const headers=Object.keys(rows[0]||{});const headerMap=new Map(headers.map(h=>[h,canonicalImportHeader(h)]));const section={name:importText(sheetName),products:[]};
      rows.forEach((row,rowIndex)=>{
        const nameHeader=headers.find(h=>headerMap.get(h)==='name');const name=importText(nameHeader?row[nameHeader]:'');if(!name)return;
        const get=canonical=>{const h=headers.find(x=>headerMap.get(x)===canonical);return h?row[h]:'';};
        const imageRefs=[];for(let i=1;i<=4;i++){const value=importText(get(`image${i}`));if(value&&!/^#(?:VALUE!|N\/A|REF!|NAME\?|NUM!|DIV\/0!|NULL!|SPILL!|CALC!)/i.test(value))value.split(/[;,\n]+/).map(v=>v.trim()).filter(Boolean).forEach(v=>imageRefs.push(v));}
        const sources=[],unresolved=[];imageRefs.slice(0,4).forEach(ref=>{const src=resolveImportImageReference(ref,outerLookup);if(src){sources.push(src);resolvedImages++;}else{unresolved.push(ref);missingImages++;}});
        if(!sources.length){const excelRow=Number(row.__rowNum__??(rowIndex+1));const embeddedForRow=embedded.get(sheetName)?.get(excelRow)||[];embeddedForRow.slice(0,4).forEach(src=>{sources.push(src);resolvedImages++;});}
        const specs=[];headers.forEach((header,index)=>{if(headerMap.get(header))return;const spec=parseImportSpec(header,row[header],index);if(spec)specs.push(spec);});
        const retailPrice=importNumber(get('price'));
        const wholesalePrice=importNumber(get('wholesale_price'));
        const wholesaleMin=importNumber(get('wholesale_min_qty'));
        const wholesaleMax=importNumber(get('wholesale_max_qty'));
        const bulkPrice=importNumber(get('bulk_price'));
        const bulkMin=importNumber(get('bulk_min_qty'));
        const bulkMax=importNumber(get('bulk_max_qty'));
        const pricingTiers=[];
        if(retailPrice!=null) pricingTiers.push({type:'retail',price:retailPrice,min_qty:null,max_qty:null});
        if(wholesalePrice!=null) pricingTiers.push({type:'wholesale',price:wholesalePrice,min_qty:wholesaleMin==null?null:Math.trunc(wholesaleMin),max_qty:wholesaleMax==null?null:Math.trunc(wholesaleMax)});
        if(bulkPrice!=null) pricingTiers.push({type:'bulk',price:bulkPrice,min_qty:bulkMin==null?null:Math.trunc(bulkMin),max_qty:bulkMax==null?null:Math.trunc(bulkMax)});
        const product={sheetName,rowNumber:Number(row.__rowNum__??(rowIndex+1))+1,product_id:importText(get('product_id')),name,model:importText(get('model')),caption:importText(get('caption')),price:retailPrice,wholesale_price:wholesalePrice,wholesale_min_qty:wholesaleMin,pricing_tiers:pricingTiers,limited_offer:importBoolean(get('limited_offer'),false),availability:normalizeImportAvailability(get('availability'),null),is_visible:importBoolean(get('is_visible'),true),sort_order:importNumber(get('sort_order')),specifications:specs.slice(0,30),imageSources:sources.slice(0,4),imageRefs:imageRefs.slice(0,4),unresolvedImages:unresolved};
        section.products.push(product);total++;
      });
      if(section.products.length)sections.push(section);
    }
    if(!sections.length||!total)throw new Error('لم أجد منتجات صالحة. تأكد أن كل ورقة قسم وبها عمود «اسم المنتج».');
    return {fileName:file.name,excelName,sections,total,resolvedImages,missingImages};
  }

  async function importSourceToFile(source){
    if(source.kind==='zipEntry'){const blob=await source.entry.async('blob');return new File([blob],String(source.name||'image').split('/').pop(),{type:importMime(source.name)});}
    if(source.kind==='url'){const response=await fetch(source.url,{mode:'cors'});if(!response.ok)throw new Error(`تعذر تحميل الصورة: ${source.url}`);const blob=await response.blob();return new File([blob],`import-${Date.now()}.${(blob.type.split('/')[1]||'jpg').replace('jpeg','jpg')}`,{type:blob.type||'image/jpeg'});}
    throw new Error('مصدر صورة غير معروف');
  }

  function productImportPreviewHtml(plan){
    const rows=plan.sections.map(section=>`<div class="fl-import-section"><strong>${esc(section.name)}</strong><span>${section.products.length} منتج</span><small>${section.products.reduce((n,p)=>n+p.imageSources.length,0)} صور جاهزة${section.products.some(p=>p.unresolvedImages.length)?' · يوجد صور غير موجودة':''}</small></div>`).join('');
    const warnings=plan.sections.flatMap(s=>s.products.filter(p=>p.unresolvedImages.length).map(p=>`${s.name} / ${p.name}: ${p.unresolvedImages.join('، ')}`)).slice(0,8);
    return `<div class="fl-import-summary"><div><strong>${plan.sections.length}</strong><span>أقسام</span></div><div><strong>${plan.total}</strong><span>منتجات</span></div><div><strong>${plan.resolvedImages}</strong><span>صور جاهزة</span></div><div><strong>${plan.missingImages}</strong><span>صور مفقودة</span></div></div><div class="fl-import-sections">${rows}</div>${warnings.length?`<div class="fl-cloud-note bad"><b>تنبيه صور:</b><br>${warnings.map(esc).join('<br>')}${plan.missingImages>warnings.length?'<br>…':''}</div>`:''}`;
  }


  const EMBEDDED_EXCEL_TEMPLATE_B64='UEsDBBQAAAAIANqRL127Y4+3JgEAAOACAAAPAAAAeGwvd29ya2Jvb2sueG1stdJNTsMwEAXgq0TeUydOmj817YYNW27gOGNiNbYj24VskQpCvUhRQUIsuUl8G0RBLQIWbLobzUhPn0ZvthhkF1yDsUKrCkWTEAWgmG6EuqrQyvGzHC3ms6G80WZZa70MBtkpWw4Vap3rS4wta0FSO9E9qEF2XBtJnZ1oc4Vtb4A2tgVwssMkDFMsqVDoI2+/tYcpUFRChcbd+ObXfuPvxu24Q8H+dtFUKEKBKUVTocuYZSSFJomgiZOUcPQlMv8Rac4Fg3PNVhKU+yQZ6KgTWtlW9BYF+JfpaXz1mx8ecvCQOqVxkaYkCnkSpuT0nufxZdz+YYqPP5pmRRFClsVZnRCWn9706Nf+1j/4+2+e5OBp8pzlPJqyCGhS0+IEHnysFD62df4OUEsDBBQAAAAIANqRL10P4OhZMgIAAHsZAAANAAAAeGwvc3R5bGVzLnhtbOVZTW/bMAz9K4Luiy2nLbagbtEWMLBLL+1hV8WWHQGUZEhK5vTXD5Y/M6DbvCZ23CQHk4z4RFJPgsXc3hcC0I5pw5UMMVn4GDEZq4TLLMRbm375iu/vbouVsXtgLxvGLCoESLMqQryxNl95nok3TFCzUDmThYBUaUGtWSideSbXjCamdBPgBb5/4wnKJS4RUyWtQbHaShviZWtyk72hHYUQE4KRVxokFawyPVEN3Cpn9zqP5rmuxrcANzVArEBppLN1iKP681Fo8lHoWjBuEg7QFuOqKgYHKJ85tZZpGXEAVMuv+5yFWCrJWsR68F+dMk33JLge7GcU8KSKK3s6zPhb5D80eD3/I+EHj+X3z/i14Cq5Vjphuq1lgDtjtSqd7LWj3ToygJeS5T/S1ps47yJFcisiYb8nIfYxKletETlALVZQtVKh9yGbKXroy+B/4Yu0m2c4AOkB0DyH/fNWrJmO3MZ1PztrpGRf4wCd9ujAnP6vIQTv5XDiEMilhOD0B+CZFKwjL20MaKM0f1PSlgdSzKRluuFpkc4z+h3TlsdD83mPkyNuC3IpIYzNSTJ/Ti4nOqSCSwnhVJw83+iPy8kRD6ngUkIYm5Nkppyc0x77qWn+yopqwoEbzp8uucFhz4ljR1uTcZObKZU+Tf2PkEgw/TV0nBBOeb6c2f3zE6VyQoZP87I24bXwTCs3KcPJfBjutY3ag7bwb03h1o7KNn+In8tM4LA1228BG6d2f6Pc/QJQSwMEFAAAAAgA2pEvXfpcAVkDAwAA2g0AABMAAAB4bC90aGVtZS90aGVtZTEueG1svVfbcpswFPwVRu8NN3PzhGQSx24f0mmnyQ/IIECNEB5Jjp2/7yBuAozjNHbsB0tiz9lF57DC17f7nGiviHFc0BCYVwbQEI2KGNM0BFuRfPPB7c01nIsM5UijMEchWGRQfP/9DLR9TiifwxBkQmzmus6jDOWQXxUbRPc5SQqWQ8GvCpbqMYM7TNOc6JZhuHoOMQVt3iVBOaKClwsRYU/RAbLyWvxilj/8jS8I014hCcEO07jYPaO9ABqBXCwIC4EhP0DTb671NoqIiWAlcCU/TWAdEb9YMpCl6zbSWFr+zOwYJIKIMXDpl98uo0TAKEK0lqOCTcc1fKsBK6hqeCB74Jn2IEBhsMcMgXtvzfoBElUNZ+MbXQXLB6cfIFHV0BkF3BnWfWD3AySqGrqjgNnyzrOW/QCJygimL2O46/m+28BbTFKQHwfxgesa3kOD72C60mpVAip6jfcrSXCEZN/l8G/BVgUVsspQYKqJtw1KYFQ2KCR4zbD2iNNMSB44R/AdQMSPAvQBZ47puwKOUB8hbek6Bl3dDLk1uZh8JBNMyJN4I+iRS3G8IDheYULkREa1pdhkC8Iawh4wZbAb8zpVyrVNwUNggMlc0kEwFdWa6zVPPZyTbf6ziOumN1s7gHMORXfBcBSfaBnkLOWqhhJ3sg7PntDR0Q112CfqkHdyshDf/LCQ4KgQXSkPwVSD5SnhzGq75REkKC4LVifolfUsJQ5mU3dkfXZrTygxz2CMmrzGlJKpZuu68AxFVqR4/mElQTAhpNyqSxRZH9sBof2Ztiv5vebu/sssNoyLB8izCicvtecrVWgCw/kCGqvcmcvR6MM9REmCIjGx0k0fuaizHLz8WXQ5KbYCsacs3mlrsmV/YBwCxzMdA2gx5qIpgBZj1rXP+P2iW4dkk8HayXsPbYWX45ZTESvlDKX357Xidbo6y3H1ftTAtabs1pt+Ei9wPgbKuaT4R+B/1FMrqzz3sanqUOVNGq09Ic++kNF2Xfl1hjps2dJjm9cxORv8gWpWbv4BUEsDBBQAAAAIANqRL10NHrnoZQAAAHMAAAAUAAAAeGwvc2hhcmVkU3RyaW5ncy54bWwFwVEKwyAMANCrSP5n3D7GkNqeRdq0CiYWkw2Pv/eWbXJzPxpauyR4+gCOZO9HlSvB187HB7Z1mVHV3OQmGmeCYnZHRN0LcVbfb5LJ7eyDs6nv40K9B+VDC5Fxw1cIb+RcBRyuf1BLAwQUAAAACADakS9diL0UwZgEAACODAAAGAAAAHhsL3dvcmtzaGVldHMvc2hlZXQxLnhtbIVXXW/iVhD9KyM/7T4EMIR8oCWrdttVKrXSqi8r9c0F89HaGNlO4DXG9hK6Un9An1ZR1kBIKCIfYn/JzL+p5tomNjXhJdjXc++cc+6ZOzdv3vZ1Dc5V02obnaok5woSqJ2aUW93mlXpzG7sHUlvT970Kz3D/NNqqaoNfV3rWJV+VWrZdreSz1u1lqorVs7oqp2+rjUMU1dsK2eYzbzVNVWlLqbpWr5YKBzkdaXdkXhBMfpeBH8woa42lDPN/tXonartZsuuSnJZgjwH1gzNin5BbzNICXSlL3577brdqkpyUYJWu15XO1WpIEHtzLIN/WP07XmZcHoxml5cTz8s75qef4YhcP+g2Aq/mEYPTBHEkEvryWsSgmqNY76TJbCqUlkCuypZtim+nJ+QgwG5OAYMcIlTGuECA5wDeeTjFGcY4BTea0ZPNeFnXpSxnIeIxF/T6CWQlBIJSyKhfLSRUeS7wyca4iS1WDTv+5fmTXFFLo3IY1wvQ9lPQNkXSxaLG0vKmfm3BNOAXKAhLsjBCfzYr6ka4JQ8vOFxB5fk0V8YAF3QCBgseTQkB1c5oS154WC8QDU1KqbjZwiXqwDe4IJGTBI/A85wjkFyYEwuXdCQ/NzLGpQTGpSzaRUzNdgSjI+4glCIyB8R3Qe6YOzsIIfcHagOEqgOshOVMlFtCWY/0IB8GgC5+EAO4xniIt6FCKiHYwzwHhc4ASHoHfPw6QKXIYF0OPMSu4z/AC5phLcY0JDc1N5GZYN3omxm9AkDNgVvaIBfacSO4A27xSldwn4EbIc+hwl9DrMp72fqsyUYr2j4DHQeeQ6f2FHCi+L1igbsOrYe6zRl6BUQOy6+R5KuhfNwRi7Ooa0rTdXiyghogNPoKImN7bFTI5Nc4Yo8nMcJxYI4ARnwmly6TI/us2w3Yhl8xG/4FK0XZSUPV3ERhrN/++mDAIG3ON8h8FFC4KNszcqZAm8J5qpldGy/Z+4xlUokUf7d6Z5cKMh7cu6PbvNlhMcJhMfZSQ8yEW4J3hCcPkVn1HostAAuBf4RTvjQIpe1jN3h4EPCwkBu6hzYobhcSHaiQjbIw0xG26LxijmsuBIZ5DduXTGNlM8SrEQh09+4Yp8yCU/0kyF5OGGT+mHQRgHv4pbqsnI22qNsbluiyRWd4jYmIeoqPFzGNCIfyKGh4OJHtbUiX1SgH3KOZIk6Cg9V4kYzF/v96uNriM6FMBlvJLzS9Ne72BaTbIvZ+I+z2W6Jxmv8lxvnYI2fBmJTBYkZP4adlRvMmJzoUKXh8+GUvryEQ3SBUzHwyAKxWA7TBBzjlKWlEd6kz3wc45wP+Gvy8R4D/ALk4xLv2BweDXDB0u3SJ3kFkktbLh6FbIFKOxscXuOjoDYR28f8uN/NBB3hljEbXlyQvnCIw+5n1lfcpOiSu1mqgQkX4T1+TdxE/lcCnFfskUse0IjBbOxOtiz5jQurrppN9Z2qhXfZ9RuYaoPlqpyu77vpyK7SVH9RzGa7Y4GmNuyqVMgdSmCG11zxbBtd8VSW4HfDtg09fmupSl01+a0kQcMw7PVLmGn9r8XJf1BLAwQUAAAACADakS9djhVuzOcDAADaEAAAGAAAAHhsL3dvcmtzaGVldHMvc2hlZXQyLnhtbKWYXVPbRhSG/8rOXtGZgj6MP+KJnGkhlBaSkDRprlVbttXqw5XW4F4WLNfDv+h0OioQSl0mtNz2V5z9N51dSzYkZ42tXvnIe553d6VXL2sePxn4Hjl0otgNA4saGzolTtAMW27QsWiftddr9Enj8aB+FEbfx13HYWTge0FcH1i0y1ivrmlxs+v4drwR9pxg4HvtMPJtFm+EUUeLe5FjtyTme5qp6xXNt92ACkH57Y5sPohIy2nbfY+9Co92HbfTZRY1ypRoorEZenH2SXxXLJIS3x7IzyO3xboWNU1Kum6r5QQW1Slp9mMW+m+nY8ZcZoqbGW7OcKOyAl7K8NIML+kr4JsZvjlffHkFvJzh5WJ4JcMrxfBqhleL4bUMr83v/Cr4owx/VAw39Nw3ekGBmfGMggK59URRSCA3nyhygdoqArn9RFFIIDegKAoJ5BYURSGB3ISiKCSQ21AUhQRyI4qiiICZO1EUhQRyJ4piaQFtnqUyfLdtZouLKDwikWwSuVuawbMklnndFD2fGZTEFjWrlDCLxiySQ4cNSOGaJwRSPuQJH8E5vBPTHU4nneGfK3E+5Cd8DFcYtbWIGsN7/hNGbS+g4D0fwwTOiIGRT5chTYzcWYYsYeQXy5CbGLmrIq/hFibTR3IMf0MKt/wUE/jyYQF4xxM+hDMM/0qB8xOe8FM4e1BgTzX/LUzghvAELuFK5Y19FfwPpPxnmGDMs0V+OoYrea/X3n6Csc8XsUM+Fu4na56Pwi9U8CVMIJXTznRGZG0PFTl4aAUjjHq5iEr4sXiBMe7VIl/+ASlP8If6tYr7C1I+nvviN7iBFH4RN/zfP9H9vl60ghueQIrv+I2Km/BTnvAxnN+jNJmDd+LQvJN65lTK/FDqQohBSuBSOieFc7L/dBtNPoXE1u66oetoDG09NKvcxRVM+IjABR9CChd3VoJmokLS9e2OE2vZYtaNje96HTQZl+NNFb/zEZ/9YZMRuGhw997g9BfEYcOsltFEw5vNGppfaHNZR6NKsX9x89F0UvWP4JYnaDahqzF0dDnP8eYy3v0C7S7pePeByn2/wrUqjF8qmJpOxPEAzRflNPxEvqlDfspP0ITBt1NBd/NaMU1JLGzEx6oX5o1qeefiAfIhgd9lDi3OFO2DA1fLZvY3tue2bOaGQUyaYT9geeLcHyTsx55jUc+NGSXxD5HTFi6s75m6LrvFr+2+ZxsNOvXUp8KKVMw4GxEX90WXm2bfrO//z2k++koePnt2x3lmRx03iInntJlF9Y0qJdH0tClrFvZkVabk25Cx0M+vuo7dciJxVaKkHYZsdjE94M7+TdH4D1BLAwQUAAAACADakS9dO+NOzdkDAACIEAAAGAAAAHhsL3dvcmtzaGVldHMvc2hlZXQzLnhtbKWYXXPbRBSG/8rOXoUZEn04/qincgeatqFxaVoKuRa2bAv0YaR1Yi5JLePJH+CaYRhNOmmNyTSQW/gTZ/8Ns6sPN+mRY4srn/We593V6vVr2fcfjF2HHFtBaPueQbUdlRLL6/hd2+sbdMR62w36oHV/3Dzxg+/DgWUxMnYdL2yODTpgbNhUlLAzsFwz3PGHljd2nZ4fuCYLd/ygr4TDwDK7EnMdRVfVmuKatkeFoHz3sWw+DEjX6pkjh730T/Ytuz9gBtWqlCiiseM7YfpKXFtskhLXHMvXE7vLBgbVdUoGdrdreQZVKemMQua7R8mctpRJcD3F9RzXahvglRSv5HhF3QDfTfHd5earG+DVFK+Ww2spXiuH11O8Xg5vpHhjefKb4PdS/F45XFMz36glBXLjaSUFMuuJopRAZj5RZAKNTQQy+4milEBmQFGUEsgsKIpSApkJRVFKILOhKEoJZEYURRkBPXOiKEoJZE4UxdoCyjJLZfjumcwUg8A/IYFsErlbyeE8iWVed0TPZxoloUH1OiXMoCEL5NRxC2K45BGBmE94xKfwBi7EcsfJojn+eSHOJ/w1n8Ecox6uombwnv+EUXsrKHjPZ7CAc6Jh5KN1SB0jH69DVjDyyTrkLkbuF5GXcA2L5Jacwl8QwzU/wwS+uFsALnjEJ3CO4U8LcP6aR/wMzu8UOCha/xoWcEV4BG9hXuSNdhH8N8T8Z1hgzLNVfjqFuTzrraNPMPbLVeyEz4T7yZbjovDzIvgtLCCWy+Y6U7J1gIoc3rWDKUa9WEVF/FR8gDHu5SpfvoOYR/hN/aqI+xNiPlv64ne4ghh+FQf+zx/o9b5atYMrHkGMX/HXRdyCn/GIz+DNDUqROfhBHOofpJ6eSOm3pS5gLu6bvJz2oz008grYo/a2rqpo/jxcZzlZvuMTOZDXM4cFfhJ7BXq2a/atUEl3sq3tfDfso3n4EZ9+HcnIWzX5ZNXk/o3J5EfBcatRRTMK7a2jIfwU7dVVNHsKjoZPIEbjpqh/Ctc8QsMG3Y3WQMMF762p6N6fo90VFe8+LDLVb3BZFK4vCpiKSv79hWgqEV/6aGoULpY8H/AzkZRobuBHgN+9V0X7Exub8hnEtz7kWTSgtswSQLn1eNQ1mfmN6dhdk9m+F5KOP/JYlg83Jwn7cWgZ1LFDRkn4Q2D1hMWaB7qqym7x23jkmFqLJob5VPiMihXzGTG4KbreMm292f6fy3z0lnxUHJp965kZ9G0vJI7VYwZVd+qUBMmzoayZP5RVlZJvfcZ8NxsNLLNrBWJUoaTn+ywfJOed/6nQ+g9QSwMEFAAAAAgA2pEvXbyi4XLZAwAAnBAAABgAAAB4bC93b3Jrc2hlZXRzL3NoZWV0NC54bWylmF1z2kYUhv/Kzl45MzX64MM2E5Fp4yROjRvXTZtrFQSo1QeVFpte2kaU4V9kOh3FaVKXeuLWt/0V5/ybzi6SiJ0VBvUGzrL7vGclvXoRPHw0dB1ybAWh7XsG1UoqJZbX8tu21zXogHU2t+mjxsNh/cQPfgx7lsXI0HW8sD40aI+xfl1RwlbPcs2w5Pctb+g6HT9wTRaW/KCrhP3AMtsCcx1FV9Wa4pq2R7mg+PSpWHwYkLbVMQcOO/JP9iy722MG1aqUKHxhy3fC5J24Nt8kJa45FO8ndpv1DKrrlPTsdtvyDKpS0hqEzHdfzee0hcwc1xNcz3CttgZeTvByhpfVNfBKglcWm6+ugVcTvFoMryV4rRi+leBbxfDtBN9enPl18J0E3ymGa2rqG7WgQGY8raBAaj1eFBJIzceLVGB7HYHUfrwoJJAakBeFBFIL8qKQQGpCXhQSSG3Ii0ICqRF5UURAT53Ii0ICqRN5sbKAsshSEb67JjP5IPBPSCAW8dwtZ3CWxCKvW3zN5xoloUH1LUqYQUMWiKnjBsRwhRGBGEcY4Rjewjve7njeNMO/yMVxhOc4gUsZ9XgZNYEPeCqjdpdQ8AEnMIMLosnIJ6uQuox8ugpZlpHPViErMnIvj7yCG5jNL8kZ/A0x3OBUJvD8fgF4hxGO4EKGf5mD4zlGOIWLewX28/rfwAyuCUbwHi7zvNHMg/+BGH+BmYw5WOanM7gU53rj1QMZ+9UydoQT7n6y4bhS+EUe/B5mEIu2mc6YbOxLRQ7v28FYRn29jIrwjN/AMu5omS//gBgj+UX9Jo/7C2KcLHzxG1xDDK/5Cf/3T+nxvly2g2uMIJYf8bd53AynGOEE3t6iFJGDH8Wh/lHq6XMp/a7UGxzhqbhYzSe70sDLIQ+bm2VVlabP4/ubwRWe4SlOibgzpvC7NP9ydGzX7FqhkuxgUyv90O9KU/ATPvkSEkG3bPLZssm9W5PznwLHDU1XpdEkXbyzI80h6Vq57n7OucEx3GAkzZm1iQPpfso1aarI1+qqdPcvcvZSVlVVqfCXWlVOHuZ561d4g1O4liZHDlNRuQ+lh36U2wbPxe03wimeS2NjHXe8zDsPfGNjnEB85x5Pk2H1a5mmgnLnkaltMvM707HbJrN9LyQtf+CxNDNuTxL2c98yqGOHjJLwp8DqcP/V93VVFav57+WBY2oNOu//GY4gprxjNsMHt0VXa9PU683/2eaTj8TjY9/sWgdm0LW9kDhWhxlULW1REsyfF0XN/L6oqpR87zPmu+moZ5ltK+CjMiUd32fZYP6Imv3R0PgPUEsDBBQAAAAAANqRL12IWce3KAEAACgBAAALAAAAX3JlbHMvLnJlbHPvu788P3htbCB2ZXJzaW9uPSIxLjAiIGVuY29kaW5nPSJ1dGYtOCI/PjxSZWxhdGlvbnNoaXBzIHhtbG5zPSJodHRwOi8vc2NoZW1hcy5vcGVueG1sZm9ybWF0cy5vcmcvcGFja2FnZS8yMDA2L3JlbGF0aW9uc2hpcHMiPjxSZWxhdGlvbnNoaXAgVHlwZT0iaHR0cDovL3NjaGVtYXMub3BlbnhtbGZvcm1hdHMub3JnL29mZmljZURvY3VtZW50LzIwMDYvcmVsYXRpb25zaGlwcy9vZmZpY2VEb2N1bWVudCIgVGFyZ2V0PSIveGwvd29ya2Jvb2sueG1sIiBJZD0iUjA0ODEzMWYyYjZjOTRhNWIiIC8+PC9SZWxhdGlvbnNoaXBzPlBLAwQUAAAACADakS9d5KdZE0IBAADPBAAAGgAAAHhsL19yZWxzL3dvcmtib29rLnhtbC5yZWxzzdSxbsMgEAbgV7HYawzG2FRxsnTpmuYFMD5sKwYsIK3zbB36SH2FKm1V2VWHLpGyMBzSr4+7E++vb5vdbMbkGXwYnK0RSTOUgFWuHWxXo1PUdxXabTd7GGUcnA39MIVkNqMNNepjnO4xDqoHI0PqJrCzGbXzRsaQOt/hSaqj7ADTLOPYLzPQOjM5nCf4T6LTelDw4NTJgI1/BOMQzyMElByk7yDWCM/jdy2dzYiSx7ZG+wYUyxTnhGvGdF6iBF8NFHswsPZ8lr5OslApUTRCMlJwIhgBck1V6KWH9in6wXa/u7W8WvDaijAi8raEsmFUi2vyXpw/hh4grmk/5csDAOKye7kqKYeWEWhzxqm+AR5d8GjDZS44pyTTLOP0Bnj5sntFKUQGZZlfhquqG+Cx1e5VqtKkUAQka+TX7uHVt7T9AFBLAwQUAAAACADakS9dw8UgKCIBAADuBAAAEwAAAFtDb250ZW50X1R5cGVzXS54bWzNlMFKAzEQhl9lyVWatFVEpNse1KsK+gIhO7sbmkxCZrpun82Dj+QrSFMpIsJS3EIvmcvk/77/Mp/vH4tV713RQSIbsBQzORUFoAmVxaYUG64nN2K1XLxuI1DRe4dUipY53ipFpgWvSYYI2HtXh+Q1kwypUVGbtW5AzafTa2UCMiBPeJchlot7qPXGcfHQM+Ae23snirv93g5VCh2js0azDag6rH5BJqGurYEqmI0HZEkxga6oBWDvZJ7Sa4sXOVj9yUzg6DjodyuZwOUdam2kA+Kpg5RsBcWzTvyoPZRC9U4Rbx2QHLlhDh1Ccwse9u/s3wI5ZrBsqxNUL5wsNqN3/pk9JPIW0jp/JJXHbGSZQ/6xIvNzEbk8F5Grk4uofL2WX1BLAQIUAxQAAAAIANqRL127Y4+3JgEAAOACAAAPAAAAAAAAAAAAAACkgQAAAAB4bC93b3JrYm9vay54bWxQSwECFAMUAAAACADakS9dD+DoWTICAAB7GQAADQAAAAAAAAAAAAAApIFTAQAAeGwvc3R5bGVzLnhtbFBLAQIUAxQAAAAIANqRL136XAFZAwMAANoNAAATAAAAAAAAAAAAAACkgbADAAB4bC90aGVtZS90aGVtZTEueG1sUEsBAhQDFAAAAAgA2pEvXQ0euehlAAAAcwAAABQAAAAAAAAAAAAAAKSB5AYAAHhsL3NoYXJlZFN0cmluZ3MueG1sUEsBAhQDFAAAAAgA2pEvXYi9FMGYBAAAjgwAABgAAAAAAAAAAAAAAKSBewcAAHhsL3dvcmtzaGVldHMvc2hlZXQxLnhtbFBLAQIUAxQAAAAIANqRL12OFW7M5wMAANoQAAAYAAAAAAAAAAAAAACkgUkMAAB4bC93b3Jrc2hlZXRzL3NoZWV0Mi54bWxQSwECFAMUAAAACADakS9dO+NOzdkDAACIEAAAGAAAAAAAAAAAAAAApIFmEAAAeGwvd29ya3NoZWV0cy9zaGVldDMueG1sUEsBAhQDFAAAAAgA2pEvXbyi4XLZAwAAnBAAABgAAAAAAAAAAAAAAKSBdRQAAHhsL3dvcmtzaGVldHMvc2hlZXQ0LnhtbFBLAQIUAxQAAAAAANqRL12IWce3KAEAACgBAAALAAAAAAAAAAAAAACkgYQYAABfcmVscy8ucmVsc1BLAQIUAxQAAAAIANqRL13kp1kTQgEAAM8EAAAaAAAAAAAAAAAAAACkgdUZAAB4bC9fcmVscy93b3JrYm9vay54bWwucmVsc1BLAQIUAxQAAAAIANqRL13DxSAoIgEAAO4EAAATAAAAAAAAAAAAAACkgU8bAABbQ29udGVudF9UeXBlc10ueG1sUEsFBgAAAAALAAsA1QIAAKIcAAAAAA==';
  const EMBEDDED_IMPORT_PACKAGE_B64='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';

  function downloadEmbeddedBase64File(base64Data,mimeType,fileName){
    try{
      const binary=atob(base64Data);const bytes=new Uint8Array(binary.length);
      for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
      const blob=new Blob([bytes],{type:mimeType});const url=URL.createObjectURL(blob);
      const a=document.createElement('a');a.href=url;a.download=fileName;document.body.appendChild(a);a.click();a.remove();
      setTimeout(()=>URL.revokeObjectURL(url),3000);
    }catch(error){console.warn('[Embedded template download]',error);notify('تعذر تجهيز ملف القالب. حدّث الصفحة وحاول مرة أخرى.');}
  }
  function excelSafeSheetName(value,used){
    const base=(importText(value)||'منتجات').replace(/[\\\/?*\[\]:]/g,' ').replace(/\s+/g,' ').trim().slice(0,31)||'منتجات';
    let name=base,index=2;while(used.has(name.toLowerCase())){const suffix=` ${index++}`;name=(base.slice(0,Math.max(1,31-suffix.length))+suffix).trim();}used.add(name.toLowerCase());return name;
  }
  function excelSpecHeader(spec){
    const label=importText(spec?.label)||'مواصفة';const unit=importText(spec?.unit);return unit?`${label} (${unit})`:label;
  }
  function excelSpecKey(spec){return `${importKey(spec?.label)}|${importKey(spec?.unit)}`;}
  function excelBoolean(value){return value===false?'لا':'نعم';}
  function liveExcelHeaders(specHeaders=[]){
    return ['معرف المنتج','اسم المنتج','الكود','الوصف','سعر المفرق','سعر الجملة','الجملة أدنى','الجملة أعلى','سعر جملة الجملة','جملة الجملة أدنى','جملة الجملة أعلى','عرض محدود','حالة التوفر','ظاهر','الترتيب','الصورة 1','الصورة 2','الصورة 3','الصورة 4',...specHeaders];
  }
  function excelColumnWidths(specCount){
    return [24,28,18,36,14,14,14,14,16,16,16,14,16,12,12,36,36,36,36,...Array(specCount).fill(20)].map(w=>({wch:w}));
  }
  async function downloadExcelTemplate(event){
    const button=event?.currentTarget||document.getElementById('flDownloadExcelTemplate');const original=button?.innerHTML;
    if(button){button.disabled=true;button.classList.add('loading');const title=button.querySelector('.fl-product-tool-title');if(title)title.textContent='جاري تجهيز Excel...';}
    try{
      await loadProductImportLibraries();
      const wb=window.XLSX.utils.book_new();const usedNames=new Set();
      const instructions=[
        ['قالب Flower Light — المنتجات الحالية'],
        ['هذا الملف يحتوي كل المنتجات الحالية، ويمكنك تعديل أي بيانات أو إضافة صفوف جديدة ثم استيراده من زر «استيراد Excel».'],
        ['مهم: لا تغيّر «معرف المنتج» للصفوف الحالية. عند إضافة منتج جديد اترك «معرف المنتج» فارغًا.'],
        ['كل ورقة تمثل قسمًا. يمكنك إضافة منتج جديد في نهاية ورقة القسم نفسها.'],
        ['للمنتج الجديد: اكتب رابط الصورة في «الصورة 1» على الأقل، أو استخدم حزمة ZIP إذا أردت صورًا محلية.'],
        ['صور المنتجات الحالية مضافة كرابط تلقائيًا، وعند إعادة استيراد الملف دون تغيير الروابط سيحتفظ الموقع بالصور نفسها دون إعادة رفعها.'],
        ['القيم المقبولة في «ظاهر» و«عرض محدود»: نعم / لا.'],
        ['القيم المقبولة في «حالة التوفر»: متوفر / نفد / قريبًا.']
      ];
      const infoWs=window.XLSX.utils.aoa_to_sheet(instructions);infoWs['!cols']=[{wch:110}];
      window.XLSX.utils.book_append_sheet(wb,infoWs,excelSafeSheetName('تعليمات',usedNames));

      const standardOnly=liveExcelHeaders([]);
      for(const category of categories){
        const rows=products.filter(p=>String(p.category_id)===String(category.id)).sort((a,b)=>(Number(a.sort_order)||0)-(Number(b.sort_order)||0));
        const specDefs=[];const seenSpecs=new Set();
        rows.forEach(product=>normalizeSpecifications(product.specifications).forEach(spec=>{const key=excelSpecKey(spec);if(!key||seenSpecs.has(key))return;seenSpecs.add(key);specDefs.push({key,header:excelSpecHeader(spec)});}));
        const headers=liveExcelHeaders(specDefs.map(item=>item.header));
        const data=rows.map(product=>{
          const gallery=adminGalleryRows(product).slice(0,4);const images=gallery.map(item=>imageUrl(item.image_path)).filter(Boolean);
          while(images.length<4)images.push('');
          const specs=new Map(normalizeSpecifications(product.specifications).map(spec=>[excelSpecKey(spec),importText(spec.value)]));
          const pricing=productPricingTiers(product.specifications,product);
          const retail=pricing.find(row=>row.type==='retail');
          const wholesale=pricing.find(row=>row.type==='wholesale');
          const bulk=pricing.find(row=>row.type==='bulk');
          return [
            importText(product.id),importText(product.name),importText(product.model),importText(product.caption),
            retail?.price??'',wholesale?.price??'',wholesale?.min_qty??'',wholesale?.max_qty??'',
            bulk?.price??'',bulk?.min_qty??'',bulk?.max_qty??'',
            product.limited_offer===true?'نعم':'لا',excelAvailability(product.availability),excelBoolean(product.is_visible),product.sort_order==null?'':Number(product.sort_order),...images,
            ...specDefs.map(def=>specs.get(def.key)||'')
          ];
        });
        if(!data.length)data.push(Array(headers.length).fill(''));
        const ws=window.XLSX.utils.aoa_to_sheet([headers,...data]);ws['!cols']=excelColumnWidths(specDefs.length);ws['!autofilter']={ref:`A1:${window.XLSX.utils.encode_col(headers.length-1)}${data.length+1}`};
        window.XLSX.utils.book_append_sheet(wb,ws,excelSafeSheetName(category.name,usedNames));
      }
      if(!categories.length){
        const ws=window.XLSX.utils.aoa_to_sheet([standardOnly,Array(standardOnly.length).fill('')]);ws['!cols']=excelColumnWidths(0);window.XLSX.utils.book_append_sheet(wb,ws,excelSafeSheetName('منتجات',usedNames));
      }
      const stamp=new Date().toISOString().slice(0,10);window.XLSX.writeFile(wb,`Flower-Light-Products-${stamp}.xlsx`,{compression:true});
      notify(`تم تجهيز ملف Excel بكل المنتجات الحالية (${products.length} منتج)`);
    }catch(error){console.warn('[Excel export] failed',error);notify('تعذر تجهيز ملف Excel: '+(error?.message||error));}
    finally{if(button){button.disabled=false;button.classList.remove('loading');if(original!=null)button.innerHTML=original;}}
  }
  function downloadImportPackageTemplate(){downloadEmbeddedBase64File(EMBEDDED_IMPORT_PACKAGE_B64,'application/zip','Flower-Light-Import-Package-Template.zip');}

  function openProductExcelImport(){
    currentProductImportPlan=null;
    openModal('استيراد المنتجات من Excel',`<div class="fl-excel-import">
      <div class="fl-cloud-note"><b>طريقتان مدعومتان:</b><br>1) ملف Excel وفيه الصور داخل الخلايا أو ملصوقة داخل صفوف المنتجات.<br>2) ملف ZIP يحتوي Excel + مجلد images، وتكتب أسماء الصور في أعمدة «الصورة 1…4».</div>
      <div class="fl-cloud-field full"><label>اختر Excel أو ZIP</label><input id="flExcelImportFile" type="file" accept=".xlsx,.xls,.zip,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/zip"></div>
      <div class="fl-cloud-field full"><label>طريقة التعامل مع الأكواد الموجودة</label><select id="flExcelImportMode"><option value="upsert">تحديث المنتج إذا كان الكود موجودًا + إضافة الجديد</option><option value="new_only">إضافة الجديد فقط وتخطي الأكواد الموجودة</option></select></div>
      <div id="flExcelImportPreview" class="fl-import-preview"><div class="fl-cloud-empty">اختر الملف وسيظهر ملخص قبل الاستيراد.</div></div>
      <div id="flExcelImportProgress" class="fl-import-progress" hidden><div><span id="flExcelImportProgressText">جاري الاستيراد…</span><strong id="flExcelImportProgressCount">0/0</strong></div><progress id="flExcelImportProgressBar" max="100" value="0"></progress></div>
      <div class="fl-cloud-dialog-actions"><button class="fl-cloud-btn primary" id="flExcelImportStart" type="button" disabled>استيراد الآن</button><button class="fl-cloud-btn" id="flExcelImportCancel" type="button">إلغاء</button></div>
    </div>`);
    document.getElementById('flExcelImportCancel')?.addEventListener('click',closeModal);
    const input=document.getElementById('flExcelImportFile'),start=document.getElementById('flExcelImportStart'),preview=document.getElementById('flExcelImportPreview');
    input?.addEventListener('change',async()=>{
      const file=input.files?.[0];currentProductImportPlan=null;start.disabled=true;if(!file)return;
      preview.innerHTML='<div class="fl-cloud-empty">جاري قراءة Excel والصور…</div>';
      try{const plan=await parseProductImportFile(file);currentProductImportPlan=plan;preview.innerHTML=productImportPreviewHtml(plan);start.disabled=false;}
      catch(error){preview.innerHTML=`<div class="fl-cloud-note bad">${esc(error?.message||error)}</div>`;}
    });
    start?.addEventListener('click',()=>runProductExcelImport());
  }

  async function ensureImportCategory(name,categoryMap,nextSortRef){
    const key=importKey(name);if(categoryMap.has(key))return categoryMap.get(key);
    const categoryName=importText(name);
    const payload={name:categoryName,description:`منتجات قسم ${categoryName}`,sort_order:nextSortRef.value,is_visible:true,slug:newCategorySlug()};nextSortRef.value+=10;
    const {data,error}=await db.from('categories').insert(payload).select().single();if(error)throw error;categories.push(data);categoryMap.set(key,data);return data;
  }

  async function runProductExcelImport(){
    const plan=currentProductImportPlan;if(!plan)return;const start=document.getElementById('flExcelImportStart'),cancel=document.getElementById('flExcelImportCancel');
    const mode=document.getElementById('flExcelImportMode')?.value||'upsert';const progress=document.getElementById('flExcelImportProgress'),bar=document.getElementById('flExcelImportProgressBar'),text=document.getElementById('flExcelImportProgressText'),count=document.getElementById('flExcelImportProgressCount');
    start.disabled=true;if(cancel)cancel.disabled=true;if(progress)progress.hidden=false;const categoryMap=new Map(categories.map(c=>[importKey(c.name),c]));const nextSortRef={value:(categories.length?Math.max(...categories.map(c=>Number(c.sort_order)||0))+10:0)};
    const idMap=new Map(products.map(p=>[String(p.id),p]));const codeMap=new Map(products.filter(p=>importText(p.model)).map(p=>[importKey(p.model),p]));let created=0,updated=0,skipped=0,failed=0,done=0;const errors=[];
    const total=plan.total;
    for(const section of plan.sections){
      let category;
      try{category=await ensureImportCategory(section.name,categoryMap,nextSortRef);}catch(error){section.products.forEach(p=>errors.push(`${section.name} / ${p.name}: تعذر إنشاء القسم - ${error.message||error}`));failed+=section.products.length;done+=section.products.length;continue;}
      let newSort=nextProductSort(category.id);
      for(const row of section.products){
        done++;if(text)text.textContent=`${section.name} — ${row.name}`;if(count)count.textContent=`${done}/${total}`;if(bar)bar.value=Math.round(done/total*100);
        const existing=(row.product_id?idMap.get(String(row.product_id)):null)||(row.model?codeMap.get(importKey(row.model)):null);if(existing&&mode==='new_only'){skipped++;continue;}
        const uploaded=[];let createdId='';
        try{
          const previousImagePaths=existing?adminGalleryRows(existing).map(x=>x.image_path).filter(Boolean):[];
          const previousImageUrls=previousImagePaths.map(path=>imageUrl(path));
          const exportedUrlsUnchanged=Boolean(existing&&row.imageSources.length&&row.imageSources.length===previousImageUrls.length&&row.imageSources.every((source,index)=>source.kind==='url'&&String(source.url)===String(previousImageUrls[index])));
          let imagePaths=[];
          if(exportedUrlsUnchanged){imagePaths=[...previousImagePaths];}
          else if(row.imageSources.length){
            for(const source of row.imageSources.slice(0,MAX_PRODUCT_IMAGES)){const file=await importSourceToFile(source);const pair=await uploadProductImagePair(file,category.id);uploaded.push(...pair.paths);imagePaths.push(pair.largePath);}
          }else if(existing){imagePaths=[...previousImagePaths];}
          if(!imagePaths.length)throw new Error(row.unresolvedImages.length?`الصور غير موجودة: ${row.unresolvedImages.join('، ')}`:'لا توجد صورة للمنتج');
          const importedPricing=Array.isArray(row.pricing_tiers)?row.pricing_tiers:[];
          for(const tier of importedPricing){
            if(tier.min_qty!=null&&tier.min_qty<1)tier.min_qty=null;
            if(tier.max_qty!=null&&tier.max_qty<1)tier.max_qty=null;
            if(tier.min_qty!=null&&tier.max_qty!=null&&tier.max_qty<tier.min_qty)[tier.min_qty,tier.max_qty]=[tier.max_qty,tier.min_qty];
          }
          const importedRetail=importedPricing.find(tier=>tier.type==='retail');
          const importedWholesale=importedPricing.find(tier=>tier.type==='wholesale');
          const preservedMeta=existing?[
            {key:WHATSAPP_META_SHOW_DESCRIPTION,label:'',value:productWhatsAppOption(existing.specifications,WHATSAPP_META_SHOW_DESCRIPTION)?'1':'0',unit:''},
            {key:WHATSAPP_META_SHOW_SPECS,label:'',value:productWhatsAppOption(existing.specifications,WHATSAPP_META_SHOW_SPECS)?'1':'0',unit:''}
          ]:[
            {key:WHATSAPP_META_SHOW_DESCRIPTION,label:'',value:'0',unit:''},
            {key:WHATSAPP_META_SHOW_SPECS,label:'',value:'0',unit:''}
          ];
          const payload={category_id:category.id,name:row.name,model:row.model,caption:row.caption,specifications:[...row.specifications,...preservedMeta,pricingMetaRow(importedPricing)],price:importedRetail?.price??null,wholesale_price:importedWholesale?.price??null,wholesale_min_qty:importedWholesale?.min_qty??null,limited_offer:row.limited_offer,availability:row.availability||normalizeImportAvailability(existing?.availability,'available')||'available',is_visible:row.is_visible,sort_order:row.sort_order!=null?Math.trunc(row.sort_order):(existing?Number(existing.sort_order)||0:newSort)};
          let saved;
          if(existing){const {data,error}=await db.from('products').update(payload).eq('id',existing.id).select().single();if(error)throw error;saved=data;updated++;}
          else{const {data,error}=await db.from('products').insert({...payload,image_path:imagePaths[0]}).select().single();if(error)throw error;saved=data;createdId=saved.id;created++;newSort+=10;}
          if((row.imageSources.length&&!exportedUrlsUnchanged)||!existing){
            const {error}=await db.rpc('set_product_gallery_for_admin',{p_product_id:saved.id,p_image_paths:imagePaths,p_primary_path:imagePaths[0]});if(error)throw error;
            if(existing&&row.imageSources.length&&!exportedUrlsUnchanged){
              const removable=previousImagePaths.filter(path=>isStoragePath(path)&&!imagePaths.includes(path)&&!storagePathUsedByOtherProduct(path,saved.id));
              if(removable.length){try{await db.storage.from(bucket).remove([...new Set(removable.flatMap(productStoragePairPaths))]);}catch(_){}}
            }
          }
          idMap.set(String(saved.id),saved);if(importText(saved.model))codeMap.set(importKey(saved.model),saved);if(!existing)products.push(saved);
        }catch(error){failed++;errors.push(`${section.name} / ${row.name}${row.model?` (${row.model})`:''}: ${error?.message||error}`);if(createdId){try{await db.from('products').delete().eq('id',createdId);}catch(_){}}if(uploaded.length){try{await db.storage.from(bucket).remove(uploaded);}catch(_){}}}
        await new Promise(resolve=>setTimeout(resolve,20));
      }
    }
    try{await loadCatalogAdminData();syncPublicProductsFromAdminCache();}catch(error){console.warn('[Excel import] catalog refresh failed',error);}
    const result=`<div class="fl-import-summary"><div><strong>${created}</strong><span>تمت إضافتها</span></div><div><strong>${updated}</strong><span>تم تحديثها</span></div><div><strong>${skipped}</strong><span>تم تخطيها</span></div><div><strong>${failed}</strong><span>فشل</span></div></div>${errors.length?`<div class="fl-cloud-note bad"><b>تفاصيل الأخطاء:</b><br>${errors.slice(0,15).map(esc).join('<br>')}${errors.length>15?'<br>…':''}</div>`:'<div class="fl-cloud-note good">تم الاستيراد بنجاح.</div>'}<div class="fl-cloud-dialog-actions"><button class="fl-cloud-btn primary" id="flExcelImportDone" type="button">عرض المنتجات</button></div>`;
    modalBody.innerHTML=result;document.getElementById('flExcelImportDone')?.addEventListener('click',()=>{closeModal();core.renderProducts();});notify(`اكتمل الاستيراد: ${created} جديد، ${updated} تحديث`);
  }


  window.FL_ADMIN_IMPORT={downloadExcelTemplate,downloadImportPackageTemplate,openProductExcelImport,runProductExcelImport};
})();
