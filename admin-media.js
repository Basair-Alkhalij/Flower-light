// Flower Light admin — product media helpers (v100 module split)
(() => {
  'use strict';
  const core=window.FL_ADMIN_CORE;
  if(!core){console.error('[admin-media] FL_ADMIN_CORE missing');return;}
  const db = new Proxy({}, { get: (_, prop) => { const real=core.db; const value=real[prop]; return typeof value==='function'?value.bind(real):value; } });
  function liveArray(key){
    return new Proxy([], {
      get(_target,prop){ const arr=core[key]||[]; const value=arr[prop]; return typeof value==='function'?value.bind(arr):value; },
      set(_target,prop,value){ const arr=core[key]||[]; arr[prop]=value; return true; },
      ownKeys(){ return Reflect.ownKeys(core[key]||[]); },
      getOwnPropertyDescriptor(){ return { configurable:true, enumerable:true }; }
    });
  }
  const { bucket }=core;
  const products=liveArray('products');
  const productImages=liveArray('productImages');

  async function loadImageElement(file){
    if(!file) throw new Error('اختر صورة أولًا');
    const dataUrl=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=reject;reader.onload=()=>resolve(reader.result);reader.readAsDataURL(file);});
    return await new Promise((resolve,reject)=>{const image=new Image();image.onerror=()=>reject(new Error('تعذر قراءة الصورة'));image.onload=()=>resolve(image);image.src=dataUrl;});
  }

  async function resizeToWebp(file,maxSize=1400,quality=.82){
    const image=await loadImageElement(file);
    const scale=Math.min(1,maxSize/Math.max(image.width||1,image.height||1));
    const width=Math.max(1,Math.round((image.width||1)*scale));
    const height=Math.max(1,Math.round((image.height||1)*scale));
    const canvas=document.createElement('canvas');
    canvas.width=width;canvas.height=height;
    const ctx=canvas.getContext('2d',{alpha:true});
    ctx.drawImage(image,0,0,width,height);
    const blob=await new Promise(resolve=>canvas.toBlob(value=>resolve(value||file),'image/webp',quality));
    canvas.width=1;canvas.height=1;
    return blob;
  }

  async function fileToOptimizedBlob(file){ return resizeToWebp(file,1400,.82); }

  async function uploadBlob(blob,categoryId){
    const ext=(blob.type||'image/webp').includes('png')?'png':(blob.type||'').includes('jpeg')?'jpg':'webp';
    const path=`${categoryId}/${crypto.randomUUID()}.${ext}`;
    const {error}=await db.storage.from(bucket).upload(path,blob,{contentType:blob.type||'image/webp',upsert:false,cacheControl:'31536000'});
    if(error)throw error;
    return path;
  }

  function productThumbnailPath(path){
    const value=String(path||'');
    return /\.l\.webp(?:$|\?)/i.test(value)?value.replace(/\.l\.webp(?=$|\?)/i,'.s.webp'):value;
  }

  function productLargePath(path){
    const value=String(path||'');
    return /\.s\.webp(?:$|\?)/i.test(value)?value.replace(/\.s\.webp(?=$|\?)/i,'.l.webp'):value;
  }

  function productStoragePairPaths(path){
    const value=String(path||'').split('?')[0];
    if(!value)return [];
    if(/\.[ls]\.webp$/i.test(value)){
      const large=productLargePath(value);
      const small=productThumbnailPath(large);
      return large===small?[large]:[large,small];
    }
    return [value];
  }

  async function uploadProductImagePair(file,categoryId){
    if(!file)throw new Error('اختر صورة أولًا');
    const [largeBlob,smallBlob]=await Promise.all([resizeToWebp(file,1400,.84),resizeToWebp(file,480,.78)]);
    const id=crypto.randomUUID();
    const largePath=`${categoryId}/${id}.l.webp`;
    const smallPath=`${categoryId}/${id}.s.webp`;
    const uploaded=[];
    try{
      let result=await db.storage.from(bucket).upload(largePath,largeBlob,{contentType:'image/webp',upsert:false,cacheControl:'31536000'});
      if(result.error)throw result.error;uploaded.push(largePath);
      result=await db.storage.from(bucket).upload(smallPath,smallBlob,{contentType:'image/webp',upsert:false,cacheControl:'31536000'});
      if(result.error)throw result.error;uploaded.push(smallPath);
      return {largePath,smallPath,paths:[largePath,smallPath]};
    }catch(error){
      if(uploaded.length){try{await db.storage.from(bucket).remove(uploaded);}catch(_){}}
      throw error;
    }
  }

  async function uploadProductCatalogPdf(file,categoryId){
    if(!file)return '';
    const isPdf=String(file.type||'').toLowerCase()==='application/pdf'||/\.pdf$/i.test(String(file.name||''));
    if(!isPdf)throw new Error('اختر ملف PDF فقط');
    if(Number(file.size||0)>30*1024*1024)throw new Error('حجم ملف PDF يجب ألا يتجاوز 30 MB');
    const path=`${categoryId}/catalog-pdf/${crypto.randomUUID()}.pdf`;
    const {error}=await db.storage.from(bucket).upload(path,file,{contentType:'application/pdf',upsert:false,cacheControl:'31536000'});
    if(error)throw error;
    return path;
  }

  function storagePathUsedByOtherProduct(path,productId){
    if(!path)return false;
    const canonical=productLargePath(String(path).split('?')[0]);
    return products.some(p=>p.id!==productId&&[p.image_path,p.catalog_pdf_path].some(value=>productLargePath(String(value||'').split('?')[0])===canonical))
      || productImages.some(row=>row.product_id!==productId&&productLargePath(String(row.image_path||'').split('?')[0])===canonical);
  }

  let migrationBusy=false;
  function legacyImagePlan(){
    const paths=[...products.map(p=>p.image_path),...productImages.map(p=>p.image_path)];
    return [...new Set(paths.filter(p=>typeof p==='string' && p && !/^https?:|^data:|^blob:/i.test(p) && !/\.[ls]\.webp(?:$|\?)/i.test(p)))];
  }
  async function optimizeLegacyImages(){
    if(migrationBusy)return;
    const paths=legacyImagePlan();
    if(!paths.length){core.notify('لا توجد صور قديمة ضمن المنتجات المحمّلة');return;}
    if(!confirm(`سيتم تحسين ${paths.length} صورة قديمة وإضافة صور مصغرة، مع الاحتفاظ بالأصول.\nيلزم تطبيق ترحيل v101 الخاص بالصور أولًا. متابعة؟`))return;
    migrationBusy=true;
    const report=[];
    try{
      for(const oldPath of paths){
        let uploaded=null;
        try{
          core.notify(`تحسين الصور ${report.length+1} / ${paths.length}`);
          const response=await fetch(core.imageUrl(oldPath));
          if(!response.ok)throw new Error('تعذر تنزيل الصورة');
          const blob=await response.blob();
          const category=products.find(p=>p.image_path===oldPath)?.category_id || products.find(p=>productImages.some(row=>row.image_path===oldPath&&row.product_id===p.id))?.category_id;
          if(!category)throw new Error('تعذر تحديد قسم الصورة');
          uploaded=await uploadProductImagePair(blob,category);
          // A transaction changes all matching references, including shared images.
          // Never delete uploads on RPC/network errors: commit status can be unknown.
          const result=await db.rpc('replace_legacy_product_image_for_owner',{p_old_path:oldPath,p_new_path:uploaded.largePath});
          if(result.error)throw result.error;
          report.push({oldPath,newPath:uploaded.largePath,status:'updated',rows:result.data});
        }catch(error){
          report.push({oldPath,newPath:uploaded?.largePath||'',status:'check-required',error:String(error.message||error)});
          break;
        }
      }
      const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));
      const link=document.createElement('a');link.href=url;link.download='image-migration-report.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
      await core.loadCatalogAdminData();core.syncPublicProductsFromAdminCache();window.FL_ADMIN_PRODUCTS?.renderProducts();
      core.notify(report.some(r=>r.status!=='updated')?'توقفت العملية عند خطأ؛ راجع التقرير المحمّل قبل إعادة المحاولة.':'اكتمل تحسين الصور؛ تم الاحتفاظ بالصور الأصلية وتنزيل تقرير المسارات.');
    }catch(error){core.notify('تعذر تحديث الشاشة: '+(error.message||error));}
    finally{migrationBusy=false;}
  }

  window.FL_ADMIN_MEDIA={legacyImagePlan,optimizeLegacyImages,fileToOptimizedBlob,uploadBlob,uploadProductImagePair,productThumbnailPath,productStoragePairPaths,uploadProductCatalogPdf,storagePathUsedByOtherProduct};
})();
