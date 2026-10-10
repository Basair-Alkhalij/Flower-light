// Flower Light admin — product add/edit form (v100 module split)
(() => {
  'use strict';
  const core=window.FL_ADMIN_CORE;
  if(!core){console.error('[admin-product-form] FL_ADMIN_CORE missing');return;}
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
  const productImages=liveArray('productImages');
  const { esc,notify,imageUrl,openModal,closeModal,modal,adminGalleryRows,nextProductSort,productSpecsFormHtml,productPricingEditorHtml,productWhatsAppOption,WHATSAPP_META_SHOW_DESCRIPTION,productSpecEditorRowHtml,pricingTierEditorRowHtml,syncPriceTierRow,collectProductPricingTiers,collectProductSpecifications,uploadProductImagePair,uploadProductCatalogPdf,storagePathUsedByOtherProduct,isStoragePath,bucket,MAX_PRODUCT_IMAGES,syncPublicProductsFromAdminCache,productStoragePairPaths }=core;
  function openProductForm(prod=null){
    if(!categories.length){notify('أضف قسمًا أولًا');return;}
    const cid=prod?.category_id||core.selectedCategory||categories[0].id;
    const options=categories.map(c=>`<option value="${c.id}" ${c.id===cid?'selected':''}>${esc(c.name)}</option>`).join('');
    const originalRows=prod ? adminGalleryRows(prod) : [];
    let galleryEntries=originalRows.map((row,index)=>({
      token:`existing-${row.id||index}-${crypto.randomUUID?.()||index}`,
      path:row.image_path,
      preview:imageUrl(row.image_path),
      file:null,
      objectUrl:'',
      original:true
    }));
    const defaultSort=prod ? Number(prod.sort_order||0) : nextProductSort(cid);
    const availability=['available','out_of_stock','coming_soon'].includes(String(prod?.availability||''))?String(prod.availability):'available';

    openModal(prod?'تعديل المنتج':'إضافة منتج',`<form id="flProductForm"><div class="fl-cloud-form">
      <div class="fl-cloud-field"><label>القسم</label><select id="flProdCat">${options}</select></div>
      <div class="fl-cloud-field"><label>الترتيب</label><input id="flProdSort" type="number" min="0" step="1" value="${defaultSort}"><small class="fl-field-help">يمكنك أيضًا تغييره لاحقًا بالسحب.</small></div>
      <div class="fl-cloud-field"><label>اسم المنتج</label><input id="flProdName" required value="${esc(prod?.name||'')}" placeholder="مثال: جدارية LED"></div>
      <div class="fl-cloud-field"><label>رقم المنتج / الكود</label><input id="flProdModel" value="${esc(prod?.model||'')}" placeholder="مثال: 1010 أو WL-205"></div>
      <div class="fl-cloud-field"><label for="flProdAvailability">حالة التوفر</label><select id="flProdAvailability"><option value="available" ${availability==='available'?'selected':''}>متوفر</option><option value="out_of_stock" ${availability==='out_of_stock'?'selected':''}>نفد</option><option value="coming_soon" ${availability==='coming_soon'?'selected':''}>قريبًا</option></select><small class="fl-field-help">المنتج غير المتوفر يبقى ظاهرًا لكن لا يمكن إضافته لقائمة الطلب.</small></div>
      <div class="fl-cloud-field full"><div class="fl-field-label-inline"><label for="flProdCaption">الوصف</label><label class="fl-whatsapp-include-toggle"><input id="flProdWhatsAppShowDescription" type="checkbox" ${productWhatsAppOption(prod?.specifications,WHATSAPP_META_SHOW_DESCRIPTION)?'checked':''}><span>إظهار في رسالة واتساب</span></label></div><textarea id="flProdCaption" placeholder="وصف مختصر">${esc(prod?.caption||'')}</textarea></div>
      ${productPricingEditorHtml(prod)}
      ${productSpecsFormHtml(prod)}
      <section class="fl-product-gallery-editor full">
        <div class="fl-product-gallery-head"><div><strong>صور المنتج</strong><small>حتى 4 صور فقط. الصورة الأولى هي الأساسية وتظهر في بطاقة المنتج وPDF.</small></div><span id="flProdGalleryCount">0 / ${MAX_PRODUCT_IMAGES}</span></div>
        <div id="flProductGalleryGrid" class="fl-product-gallery-grid"></div>
        <label class="fl-product-gallery-add" for="flProdImages"><strong>+ إضافة صور</strong><small>يمكن اختيار عدة صور دفعة واحدة، والحد الإجمالي 4.</small></label>
        <input id="flProdImages" class="fl-product-gallery-input" type="file" accept="image/*" multiple>
      </section>
      <label class="fl-cloud-check full"><input id="flProdVisible" type="checkbox" ${prod?.is_visible===false?'':'checked'}> إظهار المنتج للزوار</label>
    </div><div class="fl-cloud-dialog-actions"><button class="fl-cloud-btn primary" id="flProdSave" type="submit">حفظ</button><button class="fl-cloud-btn" id="flProdCancel" type="button">إلغاء</button></div></form>`);
    modal.querySelector('.fl-cloud-dialog')?.classList.add('fl-product-dialog');

    const flexibleSpecs=document.getElementById('flFlexibleSpecs');
    const addProductSpec=document.getElementById('flAddProductSpec');
    const syncSpecRow=row=>{
      if(!row) return;
      const type=row.querySelector('[data-flex-spec-type]');
      const custom=row.querySelector('[data-flex-spec-label]');
      if(!type || !custom) return;
      const isCustom=type.value==='__custom__';
      custom.hidden=!isCustom;
      custom.setAttribute('aria-hidden',isCustom?'false':'true');
    };
    const refreshSpecRemoveButtons=()=>{
      if(!flexibleSpecs) return;
      const rows=[...flexibleSpecs.querySelectorAll('[data-flex-spec-row]')];
      rows.forEach(row=>{
        syncSpecRow(row);
        const button=row.querySelector('[data-flex-spec-remove]');
        if(button) button.hidden=rows.length<=1;
      });
    };
    addProductSpec?.addEventListener('click',()=>{
      if(!flexibleSpecs) return;
      const count=flexibleSpecs.querySelectorAll('[data-flex-spec-row]').length;
      if(count>=30){notify('الحد الأقصى 30 صفة للمنتج');return;}
      flexibleSpecs.insertAdjacentHTML('beforeend',productSpecEditorRowHtml(null));
      refreshSpecRemoveButtons();
      flexibleSpecs.lastElementChild?.querySelector('[data-flex-spec-type]')?.focus();
    });
    flexibleSpecs?.addEventListener('change',event=>{
      if(!event.target.matches?.('[data-flex-spec-type]')) return;
      const row=event.target.closest('[data-flex-spec-row]');
      syncSpecRow(row);
      if(event.target.value==='__custom__') row?.querySelector('[data-flex-spec-label]')?.focus();
    });
    flexibleSpecs?.addEventListener('click',event=>{
      const button=event.target.closest?.('[data-flex-spec-remove]');
      if(!button) return;
      button.closest('[data-flex-spec-row]')?.remove();
      if(!flexibleSpecs.querySelector('[data-flex-spec-row]')) flexibleSpecs.insertAdjacentHTML('beforeend',productSpecEditorRowHtml(null));
      refreshSpecRemoveButtons();
    });
    refreshSpecRemoveButtons();

    const priceTierList=document.getElementById('flPriceTierList');
    const addPriceTier=document.getElementById('flAddPriceTier');
    const refreshPriceTiers=()=>priceTierList?.querySelectorAll('[data-price-tier-row]').forEach(syncPriceTierRow);
    addPriceTier?.addEventListener('click',()=>{
      if(!priceTierList) return;
      const count=priceTierList.querySelectorAll('[data-price-tier-row]').length;
      if(count>=12){notify('الحد الأقصى 12 خانة سعر للمنتج');return;}
      priceTierList.insertAdjacentHTML('beforeend',pricingTierEditorRowHtml({type:count===0?'retail':count===1?'wholesale':'bulk',price:null,min_qty:null,max_qty:null}));
      const row=priceTierList.lastElementChild;
      syncPriceTierRow(row);
      row?.querySelector('[data-price-tier-price]')?.focus();
    });
    priceTierList?.addEventListener('change',event=>{
      if(event.target.matches?.('[data-price-tier-type]')) syncPriceTierRow(event.target.closest('[data-price-tier-row]'));
    });
    priceTierList?.addEventListener('click',event=>{
      const button=event.target.closest?.('[data-price-tier-remove]');
      if(!button) return;
      button.closest('[data-price-tier-row]')?.remove();
      if(!priceTierList.querySelector('[data-price-tier-row]')){
        priceTierList.insertAdjacentHTML('beforeend',pricingTierEditorRowHtml({type:'retail',price:null,min_qty:null,max_qty:null}));
      }
      refreshPriceTiers();
    });
    refreshPriceTiers();

    const galleryGrid=document.getElementById('flProductGalleryGrid');
    const galleryCount=document.getElementById('flProdGalleryCount');
    const imageInput=document.getElementById('flProdImages');
    const addLabel=document.querySelector('label[for="flProdImages"]');
    const cleanupPreviewUrls=()=>galleryEntries.forEach(entry=>{if(entry.objectUrl){try{URL.revokeObjectURL(entry.objectUrl);}catch(_){}}});

    function renderGalleryEditor(){
      if(!galleryGrid) return;
      galleryGrid.innerHTML=galleryEntries.map((entry,index)=>`<article class="fl-product-gallery-item ${index===0?'is-primary':''}" data-gallery-token="${esc(entry.token)}">
        <div class="fl-product-gallery-thumb"><img src="${esc(entry.preview)}" alt="صورة المنتج ${index+1}" decoding="async"><span>${index===0?'أساسية':`صورة ${index+1}`}</span></div>
        <div class="fl-product-gallery-controls">
          ${index===0?'':`<button type="button" class="fl-gallery-primary-btn" data-gallery-primary="${esc(entry.token)}">اجعلها الأساسية</button>`}
          <div class="fl-gallery-order-buttons">
            <button type="button" data-gallery-move="up" data-gallery-token="${esc(entry.token)}" ${index<=1?'disabled':''} aria-label="تقديم الصورة">↑</button>
            <button type="button" data-gallery-move="down" data-gallery-token="${esc(entry.token)}" ${index===0||index>=galleryEntries.length-1?'disabled':''} aria-label="تأخير الصورة">↓</button>
            <button type="button" class="red" data-gallery-remove="${esc(entry.token)}">حذف</button>
          </div>
        </div>
      </article>`).join('');
      if(!galleryEntries.length) galleryGrid.innerHTML='<div class="fl-product-gallery-empty">أضف من صورة واحدة إلى 4 صور. أول صورة ستكون الأساسية.</div>';
      if(galleryCount) galleryCount.textContent=`${galleryEntries.length} / ${MAX_PRODUCT_IMAGES}`;
      const full=galleryEntries.length>=MAX_PRODUCT_IMAGES;
      if(imageInput) imageInput.disabled=full;
      if(addLabel) addLabel.classList.toggle('disabled',full);

      galleryGrid.querySelectorAll('[data-gallery-primary]').forEach(button=>button.addEventListener('click',()=>{
        const index=galleryEntries.findIndex(entry=>entry.token===button.dataset.galleryPrimary);
        if(index<=0) return;
        const [entry]=galleryEntries.splice(index,1);galleryEntries.unshift(entry);renderGalleryEditor();
      }));
      galleryGrid.querySelectorAll('[data-gallery-remove]').forEach(button=>button.addEventListener('click',()=>{
        const index=galleryEntries.findIndex(entry=>entry.token===button.dataset.galleryRemove);
        if(index<0) return;
        const [removed]=galleryEntries.splice(index,1);
        if(removed?.objectUrl){try{URL.revokeObjectURL(removed.objectUrl);}catch(_){}}
        renderGalleryEditor();
      }));
      galleryGrid.querySelectorAll('[data-gallery-move]').forEach(button=>button.addEventListener('click',()=>{
        const token=button.dataset.galleryToken;
        const index=galleryEntries.findIndex(entry=>entry.token===token);
        if(index<=0) return;
        const nextIndex=button.dataset.galleryMove==='up' ? Math.max(1,index-1) : Math.min(galleryEntries.length-1,index+1);
        if(nextIndex===index) return;
        const [entry]=galleryEntries.splice(index,1);galleryEntries.splice(nextIndex,0,entry);renderGalleryEditor();
      }));
    }

    imageInput?.addEventListener('change',()=>{
      const files=[...(imageInput.files||[])].filter(file=>String(file.type||'').startsWith('image/'));
      const remaining=Math.max(0,MAX_PRODUCT_IMAGES-galleryEntries.length);
      if(!remaining){notify('الحد الأقصى 4 صور للمنتج');imageInput.value='';return;}
      if(files.length>remaining) notify(`تم اختيار أول ${remaining} صورة فقط لأن الحد الأقصى ${MAX_PRODUCT_IMAGES}`);
      files.slice(0,remaining).forEach(file=>{
        const objectUrl=URL.createObjectURL(file);
        galleryEntries.push({token:`new-${crypto.randomUUID?.()||Date.now()+Math.random()}`,path:'',preview:objectUrl,file,objectUrl,original:false});
      });
      imageInput.value='';
      renderGalleryEditor();
    });

    document.getElementById('flProdCat')?.addEventListener('change',event=>{
      if(!prod) document.getElementById('flProdSort').value=String(nextProductSort(event.target.value));
    });

    renderGalleryEditor();

    document.getElementById('flProdCancel').addEventListener('click',()=>{cleanupPreviewUrls();closeModal();});
    document.getElementById('flProductForm').addEventListener('submit',async e=>{
      e.preventDefault();
      const save=document.getElementById('flProdSave');
      const name=document.getElementById('flProdName').value.trim();
      if(!name){notify('اكتب اسم المنتج');return;}
      if(!galleryEntries.length){notify('أضف صورة واحدة على الأقل للمنتج');return;}
      if(galleryEntries.length>MAX_PRODUCT_IMAGES){notify('الحد الأقصى 4 صور');return;}
      save.disabled=true;save.textContent='جاري حفظ المنتج والصور...';
      const uploadedPaths=[];
      let createdProductId='';
      let saveCommitted=false;
      try{
        const category_id=document.getElementById('flProdCat').value;
        const finalEntries=[];
        for(const entry of galleryEntries){
          if(entry.file){
            const pair=await uploadProductImagePair(entry.file,category_id);
            uploadedPaths.push(...pair.paths);
            finalEntries.push({...entry,path:pair.largePath});
          }else if(entry.path){
            finalEntries.push(entry);
          }
        }
        const imagePaths=finalEntries.map(entry=>entry.path).filter(Boolean);
        if(!imagePaths.length) throw new Error('أضف صورة واحدة على الأقل');
        if(imagePaths.length>MAX_PRODUCT_IMAGES) throw new Error('الحد الأقصى 4 صور');
        const primaryPath=imagePaths[0];
        const pricingTiers=collectProductPricingTiers();
        const firstRetail=pricingTiers.find(row=>row.type==='retail');
        const firstWholesale=pricingTiers.find(row=>row.type==='wholesale');
        const payload={
          category_id,
          name,
          model:document.getElementById('flProdModel').value.trim(),
          caption:document.getElementById('flProdCaption').value.trim(),
          specifications:collectProductSpecifications(pricingTiers),
          price:firstRetail?.price??null,
          wholesale_price:firstWholesale?.price??null,
          wholesale_min_qty:firstWholesale?.min_qty??null,
          availability:document.getElementById('flProdAvailability')?.value || 'available',
          limited_offer:document.getElementById('flProdLimitedOffer')?.checked===true,
          sort_order:Number(document.getElementById('flProdSort').value)||0,
          is_visible:document.getElementById('flProdVisible').checked
        };
        let savedProduct;
        if(prod){
          const {data,error}=await db.from('products').update(payload).eq('id',prod.id).select().single();
          if(error) throw error;savedProduct=data;
        }else{
          const {data,error}=await db.from('products').insert({...payload,image_path:primaryPath}).select().single();
          if(error) throw error;savedProduct=data;createdProductId=data.id;
        }

        const {error:galleryError}=await db.rpc('set_product_gallery_for_admin',{
          p_product_id:savedProduct.id,
          p_image_paths:imagePaths,
          p_primary_path:primaryPath
        });
        if(galleryError) throw new Error((String(galleryError.code)==='PGRST202'||String(galleryError.code)==='42883') ? 'شغّل ملف SUPABASE_SETUP.sql في Supabase أولًا.' : (galleryError.message||galleryError));
        // From this point the database save is committed; a later UI refresh failure must not roll it back.
        saveCommitted=true;
        createdProductId='';

        const removedPaths=originalRows.map(row=>row.image_path).filter(path=>path && !imagePaths.includes(path) && isStoragePath(path));
        const safeToDelete=removedPaths.filter(path=>!storagePathUsedByOtherProduct(path,savedProduct.id));
        if(safeToDelete.length) await db.storage.from(bucket).remove([...new Set(safeToDelete.flatMap(productStoragePairPaths))]);

        savedProduct={...savedProduct,...payload,image_path:primaryPath};
        if(prod)core.products=products.map(row=>row.id===savedProduct.id?savedProduct:row);else products.push(savedProduct);
        core.productImages=productImages.filter(row=>row.product_id!==savedProduct.id);
        productImages.push(...imagePaths.map((path,index)=>({id:`local-${savedProduct.id}-${index}`,product_id:savedProduct.id,image_path:path,sort_order:index*10,is_primary:index===0,created_at:savedProduct.updated_at||savedProduct.created_at||new Date().toISOString()})));
        core.selectedCategory=category_id;core.selectedProductNode=`category:${category_id}`;
        cleanupPreviewUrls();closeModal();syncPublicProductsFromAdminCache();core.renderProducts();notify(`تم حفظ المنتج (${imagePaths.length} صور)`);
      }catch(err){
        if(saveCommitted){
          cleanupPreviewUrls();closeModal();
          notify('تم حفظ المنتج، لكن تعذر تحديث الشاشة. حدّث الصفحة لرؤية التغيير.');
          return;
        }
        if(createdProductId) await db.from('products').delete().eq('id',createdProductId);
        if(uploadedPaths.length) await db.storage.from(bucket).remove(uploadedPaths);
        notify('تعذر الحفظ: '+(err.message||err));save.disabled=false;save.textContent='حفظ';
      }
    });
  }


  window.FL_ADMIN_PRODUCT_FORM={openProductForm};
})();
