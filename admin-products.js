// Flower Light admin — product list/order/copy/delete (v100 module split)
(() => {
  'use strict';
  const core=window.FL_ADMIN_CORE;
  if(!core){console.error('[admin-products] FL_ADMIN_CORE missing');return;}
  const db = new Proxy({}, { get: (_, prop) => { const real=core.db; const value=real[prop]; return typeof value==='function'?value.bind(real):value; } });
  function liveArray(key){
    return new Proxy([], {
      get(_target,prop){ const arr=core[key]||[]; const value=arr[prop]; return typeof value==='function'?value.bind(arr):value; },
      set(_target,prop,value){ const arr=core[key]||[]; arr[prop]=value; return true; },
      ownKeys(){ return Reflect.ownKeys(core[key]||[]); },
      getOwnPropertyDescriptor(){ return { configurable:true, enumerable:true }; }
    });
  }
  const products=liveArray('products');
  const productImages=liveArray('productImages');
  const categories=liveArray('categories');
  const siteCatalogs=liveArray('siteCatalogs');
  const { WHATSAPP_META_SHOW_DESCRIPTION,WHATSAPP_META_SHOW_SPECS,productWhatsAppOption,pricingMetaRow,esc,notify,layout,body,imageUrl,isStoragePath,bucket,MAX_PRODUCT_IMAGES,syncPublicProductsFromAdminCache,loadCatalogAdminData,normalizeSpecifications,productPricingTiers,PRICE_TIER_TYPE_MAP,catalogAdminCard,openCatalogForm,deleteCatalog,productThumbnailPath,productStoragePairPaths,storagePathUsedByOtherProduct }=core;
  const AVAILABILITY_LABELS=Object.freeze({available:'متوفر',out_of_stock:'نفد',coming_soon:'قريبًا'});
  const productAvailability=value=>Object.hasOwn(AVAILABILITY_LABELS,String(value||''))?String(value):'available';
  function adminGalleryRows(prod){
    if(!prod?.id) return [];
    let rows=productImages.filter(row=>row.product_id===prod.id && row.image_path).slice().sort((a,b)=>(Number(a.sort_order)||0)-(Number(b.sort_order)||0));
    if(prod.image_path && !rows.some(row=>row.image_path===prod.image_path)){
      rows.unshift({id:'',product_id:prod.id,image_path:prod.image_path,sort_order:-1,is_primary:true});
    }
    let primaryIndex=rows.findIndex(row=>row.image_path===prod.image_path);
    if(primaryIndex<0) primaryIndex=rows.findIndex(row=>row.is_primary===true);
    if(primaryIndex<0 && rows.length) primaryIndex=0;
    if(primaryIndex>0){const [primary]=rows.splice(primaryIndex,1);rows.unshift(primary);}
    return rows.slice(0,MAX_PRODUCT_IMAGES).map((row,index)=>({...row,is_primary:index===0,sort_order:index*10}));
  }

  function categoryProductsInOrder(categoryId){
    return products.filter(p=>p.category_id===categoryId).slice().sort((a,b)=>(Number(a.sort_order)||0)-(Number(b.sort_order)||0) || String(a.created_at||'').localeCompare(String(b.created_at||'')));
  }

  function nextProductSort(categoryId){
    const list=categoryProductsInOrder(categoryId);
    if(!list.length) return 0;
    return Math.max(...list.map(p=>Number(p.sort_order)||0))+10;
  }

  async function saveProductOrder(productIds){
    if(!productIds.length) return;
    const {error}=await db.rpc('reorder_products_for_admin',{p_product_ids:productIds});
    if(error) throw new Error((String(error.code)==='PGRST202'||String(error.code)==='42883') ? 'شغّل ملف SUPABASE_SETUP.sql أولًا ثم أعد المحاولة.' : (error.message||error));
  }

  function bindProductDragReorder(){
    const container=body.querySelector('.fl-cloud-products');
    if(!container) return;
    let dragged=null;
    let pointerId=null;
    let moved=false;
    const status=document.getElementById('flProductOrderStatus');

    const finish=async()=>{
      if(!dragged) return;
      dragged.classList.remove('is-dragging');
      dragged=null; pointerId=null;
      if(!moved) return;
      const ids=[...container.querySelectorAll('.fl-cloud-product[data-product-id]')].map(card=>card.dataset.productId).filter(Boolean);
      if(status){status.textContent='جاري حفظ الترتيب...';status.classList.add('saving');}
      try{
        await saveProductOrder(ids);
        const orderMap=new Map(ids.map((id,index)=>[String(id),index*10]));
        core.products=products.map(p=>orderMap.has(String(p.id))?{...p,sort_order:orderMap.get(String(p.id))}:p);
        syncPublicProductsFromAdminCache();
        if(status){status.textContent='تم حفظ الترتيب';status.classList.remove('saving');status.classList.add('saved');}
        notify('تم حفظ ترتيب المنتجات');
        window.setTimeout(()=>renderProducts(),500);
      }catch(err){
        notify('تعذر حفظ الترتيب: '+(err.message||err));
        await loadCatalogAdminData();renderProducts();
      }
    };

    container.querySelectorAll('.fl-product-drag-handle').forEach(handle=>{
      handle.addEventListener('pointerdown',event=>{
        if(event.button!==undefined && event.button!==0) return;
        const card=handle.closest('.fl-cloud-product');
        if(!card) return;
        dragged=card; pointerId=event.pointerId; moved=false;
        try{handle.setPointerCapture(pointerId);}catch(_){}
        card.classList.add('is-dragging');
        event.preventDefault();
      });
      handle.addEventListener('pointermove',event=>{
        if(!dragged || event.pointerId!==pointerId) return;
        const target=document.elementFromPoint(event.clientX,event.clientY)?.closest?.('.fl-cloud-product[data-product-id]');
        if(!target || target===dragged || target.parentElement!==container) return;
        const cards=[...container.querySelectorAll('.fl-cloud-product[data-product-id]')];
        const from=cards.indexOf(dragged), to=cards.indexOf(target);
        if(from<0 || to<0) return;
        if(from<to) target.after(dragged); else target.before(dragged);
        moved=true;
      });
      handle.addEventListener('pointerup',event=>{if(event.pointerId===pointerId) void finish();});
      handle.addEventListener('pointercancel',event=>{if(event.pointerId===pointerId) void finish();});
    });
  }

  async function copyProductStorageImage(path,categoryId){
    if(!isStoragePath(path)) return path;
    const clean=String(path).split('?')[0];
    if(/\.l\.webp$/i.test(clean)){
      const id=crypto.randomUUID();
      const target=`${categoryId}/${id}.l.webp`;
      const thumbTarget=`${categoryId}/${id}.s.webp`;
      const {error}=await db.storage.from(bucket).copy(clean,target);
      if(error)throw error;
      try{
        const thumbSource=productThumbnailPath(clean);
        const thumbCopy=await db.storage.from(bucket).copy(thumbSource,thumbTarget);
        if(thumbCopy?.error) throw thumbCopy.error;
      }catch(_){
        // Keep the duplicated product visually complete even if the source
        // thumbnail is missing: copy the large WebP as a safe thumbnail fallback.
        try{await db.storage.from(bucket).copy(clean,thumbTarget);}catch(__){ }
      }
      return target;
    }
    const match=clean.match(/\.([a-z0-9]{2,5})$/i);
    const ext=match?.[1]?.toLowerCase() || 'webp';
    const target=`${categoryId}/${crypto.randomUUID()}.${ext}`;
    const {error}=await db.storage.from(bucket).copy(clean,target);
    if(error) throw error;
    return target;
  }

  async function duplicateProduct(id){
    const source=products.find(p=>p.id===id);
    if(!source) return;
    if(!confirm(`إنشاء نسخة مستقلة من «${source.name||'المنتج'}» مع المواصفات والصور؟\n\nستُنشأ النسخة مخفية حتى تراجعها ثم تُظهرها.`)) return;
    const sourceGallery=adminGalleryRows(source);
    if(!sourceGallery.length){notify('لا توجد صورة للمنتج لنسخها');return;}
    const copiedStoragePaths=[];
    let createdId='';
    let duplicateCommitted=false;
    try{
      notify('جاري نسخ المنتج والصور...');
      const copiedPaths=[];
      for(const row of sourceGallery){
        const copied=await copyProductStorageImage(row.image_path,source.category_id);
        copiedPaths.push(copied);
        if(copied!==row.image_path && isStoragePath(copied)) copiedStoragePaths.push(...productStoragePairPaths(copied));
      }
      const payload={
        category_id:source.category_id,
        name:`${source.name||'منتج'} - نسخة`,
        model:source.model||'',
        caption:source.caption||'',
        image_path:copiedPaths[0],
        specifications:[
          ...normalizeSpecifications(source.specifications),
          {key:WHATSAPP_META_SHOW_DESCRIPTION,label:'',value:productWhatsAppOption(source.specifications,WHATSAPP_META_SHOW_DESCRIPTION)?'1':'0',unit:''},
          {key:WHATSAPP_META_SHOW_SPECS,label:'',value:productWhatsAppOption(source.specifications,WHATSAPP_META_SHOW_SPECS)?'1':'0',unit:''},
          pricingMetaRow(productPricingTiers(source.specifications,source))
        ],
        price:source.price==null?null:Number(source.price),
        wholesale_price:source.wholesale_price==null?null:Number(source.wholesale_price),
        wholesale_min_qty:source.wholesale_min_qty==null?null:Number(source.wholesale_min_qty),
        availability:productAvailability(source.availability),
        limited_offer:source.limited_offer===true,
        sort_order:(Number(source.sort_order)||0)+1,
        is_visible:false
      };
      const {data:created,error:createError}=await db.from('products').insert(payload).select().single();
      if(createError) throw createError;
      createdId=created.id;
      const {error:galleryError}=await db.rpc('set_product_gallery_for_admin',{
        p_product_id:createdId,
        p_image_paths:copiedPaths,
        p_primary_path:copiedPaths[0]
      });
      if(galleryError) throw galleryError;

      const order=categoryProductsInOrder(source.category_id).map(p=>p.id);
      const sourceIndex=order.indexOf(source.id);
      order.splice(sourceIndex>=0?sourceIndex+1:order.length,0,createdId);
      await saveProductOrder(order);
      duplicateCommitted=true;
      const duplicateId=createdId;
      createdId='';
      await loadCatalogAdminData();syncPublicProductsFromAdminCache();renderProducts();
      const duplicate=products.find(p=>p.id===duplicateId);
      notify('تم إنشاء نسخة مخفية مستقلة؛ عدّلها ثم فعّل إظهارها');
      if(duplicate) window.FL_ADMIN_PRODUCT_FORM?.openProductForm?.(duplicate);
    }catch(err){
      if(!duplicateCommitted){
        if(createdId) await db.from('products').delete().eq('id',createdId);
        if(copiedStoragePaths.length) await db.storage.from(bucket).remove(copiedStoragePaths);
        notify('تعذر نسخ المنتج: '+(err.message||err));
      }else{
        notify('تم نسخ المنتج، لكن تعذر تحديث الشاشة. حدّث الصفحة وستجد النسخة.');
      }
    }
  }


  function renderProducts(){
    const selector=[
      ...categories.map(c=>({type:'category',row:c,sort_order:Number(c.sort_order)||0,created_at:c.created_at||''})),
      ...siteCatalogs.map(c=>({type:'catalog',row:c,sort_order:Number(c.sort_order)||0,created_at:c.created_at||''}))
    ].sort((a,b)=>a.sort_order-b.sort_order || String(a.created_at).localeCompare(String(b.created_at))).map(item=>{
      const c=item.row;
      return item.type==='catalog'
        ? `<option value="catalog:${c.id}" ${core.selectedProductNode===`catalog:${c.id}`?'selected':''}>📕 ${esc(c.name||'كتالوج')}</option>`
        : `<option value="category:${c.id}" ${core.selectedProductNode===`category:${c.id}`?'selected':''}>${esc(c.name)}</option>`;
    }).join('');
    const isCatalog=core.selectedProductNode.startsWith('catalog:');
    const selectedCatalogId=isCatalog?core.selectedProductNode.slice(8):'';
    const selectedCatalog=siteCatalogs.find(c=>String(c.id)===String(selectedCatalogId));
    if(!isCatalog&&core.selectedProductNode.startsWith('category:')) core.selectedCategory=core.selectedProductNode.slice(9);

    const list=isCatalog?[]:categoryProductsInOrder(core.selectedCategory);
    const cards=list.map((p,index)=>{
      const specCount=normalizeSpecifications(p.specifications).length;
      const gallery=adminGalleryRows(p);
      const imagePath=gallery[0]?.image_path||p.image_path||p.image_url||'';
      const availability=productAvailability(p.availability);
      const availabilityLabel=AVAILABILITY_LABELS[availability];
      const pricingSummary=productPricingTiers(p.specifications,p).map(tier=>{
        const label=PRICE_TIER_TYPE_MAP.get(tier.type)?.label||'سعر';
        const price=`${Number(tier.price).toLocaleString('en-US',{maximumFractionDigits:2})} ر.س`;
        const range=tier.min_qty!=null&&tier.max_qty!=null?` ${tier.min_qty}-${tier.max_qty}`:tier.min_qty!=null?` من ${tier.min_qty}+`:tier.max_qty!=null?` حتى ${tier.max_qty}`:'';
        return `${label} ${price}${range}`;
      }).join(' · ');
      return `<article class="fl-cloud-product" data-product-id="${p.id}">
        <button class="fl-product-drag-handle" type="button" aria-label="اسحب لتغيير ترتيب ${esc(p.name||'المنتج')}" title="اسحب لتغيير الترتيب"><span>⋮⋮</span><small>${index+1}</small></button>
        <div class="fl-cloud-product-image-wrap"><img src="${esc(imageUrl(productThumbnailPath(imagePath)))}" alt="${esc(p.name||'منتج')}" loading="lazy" decoding="async"><span class="fl-admin-gallery-count">${gallery.length} / ${MAX_PRODUCT_IMAGES} صور</span></div>
        <div class="fl-cloud-product-body"><strong>${esc(p.name||'منتج بدون اسم')}</strong><small>${esc(p.model?`الكود ${p.model}`:'بدون كود')} · ${availabilityLabel} · ${p.is_visible===false?'مخفي':'ظاهر'}${specCount?` · ${specCount} معلومات`:''}${pricingSummary?` · ${esc(pricingSummary)}`:''}${p.limited_offer===true?' · عرض محدود':''}</small>
        <div class="fl-cloud-product-actions"><button class="fl-cloud-mini" data-prod-edit="${p.id}" type="button">تعديل</button><button class="fl-cloud-mini" data-prod-copy="${p.id}" type="button">نسخ</button><button class="fl-cloud-mini red" data-prod-delete="${p.id}" type="button">حذف</button></div></div></article>`;
    }).join('');

    const content=isCatalog
      ? (selectedCatalog?`<div class="fl-admin-catalog-list">${catalogAdminCard(selectedCatalog)}</div>`:`<div class="fl-cloud-empty">اختر كتالوجًا أو أضف كتالوجًا جديدًا.</div>`)
      : (cards?`<div class="fl-cloud-products">${cards}</div>`:`<div class="fl-cloud-empty">لا توجد منتجات في هذا القسم بعد.</div>`);

    const legacyImageCount=core.isPrimaryAdmin?(window.FL_ADMIN_MEDIA?.legacyImagePlan?.().length||0):0;
    const productTools=`<div class="fl-product-tools" aria-label="أدوات المنتجات والكتالوجات">
      <button ${core.isPrimaryAdmin?'':'hidden'} class="fl-product-tool legacy" id="flOptimizeLegacyImages" type="button"><span class="fl-product-tool-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"></rect><circle cx="9" cy="10" r="2"></circle><path d="m5 17 4-4 3 3 2-2 5 5"></path></svg></span><span class="fl-product-tool-copy"><strong>تحسين الصور القديمة</strong><small>${legacyImageCount?`${legacyImageCount} صورة · `:''}JPG/PNG → WebP مع حفظ الأصل</small></span></button>
      <button class="fl-product-tool excel" id="flDownloadExcelTemplate" type="button"><span class="fl-product-tool-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 3h10l4 4v14H5z"></path><path d="M15 3v5h5"></path><path d="m8 12 5 5m0-5-5 5"></path></svg></span><span class="fl-product-tool-copy"><strong class="fl-product-tool-title">قالب Excel</strong><small>كل المنتجات الحالية جاهزة للتعديل</small></span></button>
      <button class="fl-product-tool import" id="flImportProductsExcel" type="button"><span class="fl-product-tool-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 3v12"></path><path d="m8 11 4 4 4-4"></path><path d="M5 19h14"></path></svg></span><span class="fl-product-tool-copy"><strong>استيراد Excel</strong><small>تحديث أو إضافة منتجات دفعة واحدة</small></span></button>
      <button class="fl-product-tool catalog" id="flAddCatalog" type="button"><span class="fl-product-tool-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 3h10l4 4v14H5z"></path><path d="M15 3v5h5"></path><path d="M8 13h8M8 17h6"></path></svg></span><span class="fl-product-tool-copy"><strong>كتالوج PDF</strong><small>إضافة كتالوج مستقل جديد</small></span></button>
      <button class="fl-product-tool product" id="flAddProduct" type="button" ${categories.length?'':'disabled'}><span class="fl-product-tool-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"></path></svg></span><span class="fl-product-tool-copy"><strong>منتج جديد</strong><small>إضافة منتج يدويًا داخل قسم</small></span></button>
    </div>`;
    layout(`<div class="fl-cloud-head"><div><h2>المنتجات والكتالوجات</h2><p>الأقسام والكتالوجات موجودة معًا هنا. يمكنك إضافة أكثر من كتالوج PDF، وكل كتالوج يظهر للزوار كخيار مستقل بجانب ثريات وجداريات وبلفون وغيرها.</p></div></div><div class="fl-cloud-card"><div class="fl-products-toolbar"><div class="fl-cloud-field"><label>القسم / الكتالوج</label><select id="flCategorySelect">${selector}</select></div><div class="fl-product-order-status" id="flProductOrderStatus">${isCatalog?'هذا كتالوج PDF مستقل':'اسحب المنتجات لترتيبها تلقائيًا'}</div></div>${content}</div>`,productTools);
    document.getElementById('flOptimizeLegacyImages')?.addEventListener('click',()=>window.FL_ADMIN_MEDIA?.optimizeLegacyImages());
    const sel=document.getElementById('flCategorySelect');
    if(sel) sel.addEventListener('change',e=>{
      core.selectedProductNode=e.target.value;
      if(core.selectedProductNode.startsWith('category:')) core.selectedCategory=core.selectedProductNode.slice(9);
      renderProducts();
    });
    document.getElementById('flDownloadExcelTemplate')?.addEventListener('click',event=>window.FL_ADMIN_IMPORT?.downloadExcelTemplate?.(event));
    document.getElementById('flAddCatalog')?.addEventListener('click',()=>openCatalogForm());
    document.getElementById('flImportProductsExcel')?.addEventListener('click',()=>window.FL_ADMIN_IMPORT?.openProductExcelImport?.());
    document.getElementById('flAddProduct')?.addEventListener('click',()=>window.FL_ADMIN_PRODUCT_FORM?.openProductForm?.());
    body.querySelectorAll('[data-prod-edit]').forEach(b=>b.addEventListener('click',()=>window.FL_ADMIN_PRODUCT_FORM?.openProductForm?.(products.find(p=>p.id===b.dataset.prodEdit))));
    body.querySelectorAll('[data-prod-copy]').forEach(b=>b.addEventListener('click',()=>duplicateProduct(b.dataset.prodCopy)));
    body.querySelectorAll('[data-prod-delete]').forEach(b=>b.addEventListener('click',()=>deleteProduct(b.dataset.prodDelete)));
    body.querySelectorAll('[data-catalog-edit]').forEach(b=>b.addEventListener('click',()=>openCatalogForm(siteCatalogs.find(c=>String(c.id)===String(b.dataset.catalogEdit)))));
    body.querySelectorAll('[data-catalog-delete]').forEach(b=>b.addEventListener('click',()=>deleteCatalog(b.dataset.catalogDelete)));
    if(!isCatalog) bindProductDragReorder();
  }


  async function deleteProduct(id){
    const p=products.find(x=>x.id===id);
    if(!p||!confirm(`حذف «${p.name||'المنتج'}» وجميع صوره؟`))return;
    const paths=new Set(adminGalleryRows(p).map(row=>row.image_path));
    if(p.image_path) paths.add(p.image_path);
    if(p.catalog_pdf_path) paths.add(p.catalog_pdf_path);
    const removable=[...new Set([...paths].filter(path=>isStoragePath(path)&&!storagePathUsedByOtherProduct(path,p.id)).flatMap(productStoragePairPaths))];
    const {error}=await db.from('products').delete().eq('id',id);
    if(error){notify('تعذر الحذف: '+error.message);return;}
    if(removable.length) await db.storage.from(bucket).remove(removable);
    core.products=products.filter(row=>row.id!==id);core.productImages=productImages.filter(row=>row.product_id!==id);syncPublicProductsFromAdminCache();renderProducts();notify('تم حذف المنتج وصوره');
  }

  window.FL_ADMIN_PRODUCTS={adminGalleryRows,categoryProductsInOrder,nextProductSort,duplicateProduct,renderProducts,deleteProduct};
})();
