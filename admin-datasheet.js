// Flower Light admin datasheet designer module.
(() => {
  'use strict';
  const core=window.FL_ADMIN_CORE;
  if(!core)return;
  const {esc,notify,layout,body,isPrimaryAdmin}=core;
  const db=core.db;
  let datasheetFields=null;
  let datasheetLoadPromise=null;
  let datasheetLoadError='';

  const DEFAULT_DATASHEET_FIELDS=[
    {key:'datasheet_1',label:'القدرة',unit:'W'},
    {key:'datasheet_2',label:'اللومن',unit:'lm'},
    {key:'datasheet_3',label:'المقاس',unit:''},
    {key:'datasheet_4',label:'اللون',unit:''}
  ];

  function normalizeDatasheetFields(value){
    const source=Array.isArray(value) ? value : (Array.isArray(value?.fields) ? value.fields : []);
    return source.map((field,index)=>{
      if(!field || typeof field!=='object') return null;
      const label=String(field.label||'').trim();
      if(!label) return null;
      return {
        key:String(field.key||`datasheet_${index+1}`).trim()||`datasheet_${index+1}`,
        label:label.slice(0,80),
        unit:String(field.unit||'').trim().slice(0,20)
      };
    }).filter(Boolean).slice(0,15);
  }

  async function loadDatasheetSettings(force=false){
    if(datasheetLoadPromise && !force) return datasheetLoadPromise;
    datasheetLoadError='';
    datasheetLoadPromise=(async()=>{
      const {data,error}=await db.rpc('get_datasheet_settings');
      if(error){
        const missing=String(error.code)==='PGRST202'||String(error.code)==='42883'||String(error.code)==='42703';
        throw new Error(missing?'شغّل ملف SUPABASE_SETUP.sql في Supabase أولًا.':(error.message||error));
      }
      datasheetFields=normalizeDatasheetFields(data);
      return datasheetFields;
    })().catch(error=>{
      datasheetFields=null;
      datasheetLoadError=error?.message||String(error);
      throw error;
    }).finally(()=>{datasheetLoadPromise=null;});
    return datasheetLoadPromise;
  }

  function datasheetConfigRowHtml(field={}){
    return `<div class="fl-datasheet-config-row" data-datasheet-config-row>
      <div class="fl-cloud-field"><label>اسم المعلومة الفنية</label><input data-datasheet-config-label value="${esc(field.label||'')}" placeholder="مثال: القدرة"></div>
      <div class="fl-cloud-field fl-datasheet-unit-field"><label>الوحدة <small>(اختياري)</small></label><input data-datasheet-config-unit value="${esc(field.unit||'')}" placeholder="W / lm / V"></div>
      <button class="fl-cloud-mini red fl-datasheet-remove-field" data-datasheet-remove-field type="button">حذف</button>
    </div>`;
  }

  function datasheetValueFieldsHtml(fields){
    if(!fields.length) return '<div class="fl-cloud-empty full">لم يحدد المدير أي مواصفات فنية بعد.</div>';
    return fields.map((field,index)=>`<div class="fl-cloud-field">
      <label>${esc(field.label)}${field.unit?` <span class="fl-datasheet-unit">(${esc(field.unit)})</span>`:''}</label>
      <input data-datasheet-value="${index}" autocomplete="off" placeholder="أدخل القيمة فقط${field.unit?` — مثال: 30`:''}">
    </div>`).join('');
  }

  function fileAsDataUrl(file){
    return new Promise((resolve,reject)=>{
      const reader=new FileReader();
      reader.onload=()=>resolve(String(reader.result||''));
      reader.onerror=()=>reject(reader.error||new Error('تعذر قراءة الصورة.'));
      reader.readAsDataURL(file);
    });
  }

  async function createAdminDatasheetExport(event){
    event.preventDefault();
    const button=document.getElementById('flDatasheetCreate');
    const imageInput=document.getElementById('flDatasheetImage');
    const imageFile=imageInput?.files?.[0];
    const name=document.getElementById('flDatasheetName')?.value.trim()||'';
    const model=document.getElementById('flDatasheetCode')?.value.trim()||'';
    const caption=document.getElementById('flDatasheetCaption')?.value.trim()||'';
    if(!imageFile){notify('اختر صورة المنتج أولًا');return;}
    if(!name){notify('اكتب اسم المنتج');return;}
    const renderer=window.flDatasheetPdf;
    if(!(renderer?.createSinglePage||renderer?.createPage) || !renderer?.loadJsPdf){notify('أداة إنشاء PDF غير جاهزة. حدّث الصفحة وحاول مرة أخرى.');return;}
    button.disabled=true;button.textContent='جاري تصميم الداتا شيت…';
    try{
      const specifications=(datasheetFields||[]).map((field,index)=>{
        const value=String(body.querySelector(`[data-datasheet-value="${index}"]`)?.value||'').trim();
        if(!value) return null;
        const warranty=/ضمان|warranty/i.test(field.label);
        return {key:warranty?'warranty':field.key,label:field.label,value,unit:field.unit||''};
      }).filter(Boolean);
      const image=await fileAsDataUrl(imageFile);
      try{
        await document.fonts?.load('800 40px Tajawal');
        await document.fonts?.load('700 20px Tajawal');
      }catch(_){}
      const item={name,model,caption,specifications,image,image_path:'',gallery:[{image,image_path:'',is_primary:true,sort_order:0}]};
      const choice=await (renderer.askExportChoice?renderer.askExportChoice({title:'تحميل الداتا شيت',subtitle:'اختر تنزيل الداتا شيت كملف PDF أو صورة JPG عالية الدقة.',pdfLabel:'تحميل PDF',jpgLabel:'تحميل JPG'}):Promise.resolve('pdf'));
      if(!choice){button.disabled=false;button.textContent='صمّم وتحميل';return;}
      const exportScale=choice==='jpg'?(renderer.scales?.jpg||3):(renderer.scales?.pdf||2);
      const page=renderer.createSinglePage
        ? await renderer.createSinglePage(item,image,0,1,{scale:exportScale})
        : await renderer.createPage(item,{images:[{image,image_path:''}],singleMode:true,currentIndex:0,totalImages:1,scale:exportScale});
      const {canvas,failedImages}=page;
      const fileBase=`${renderer.safeFilePart?.(model||name)||'product'}-datasheet`;
      if(choice==='jpg'){
        await renderer.downloadCanvasAsJpg(canvas,`${fileBase}.jpg`,renderer.qualities?.jpg||0.94);
      }else{
        const JsPdf=await renderer.loadJsPdf();
        const pdf=new JsPdf({orientation:'portrait',unit:'mm',format:'a4',compress:true});
        pdf.addImage(canvas.toDataURL('image/jpeg',renderer.qualities?.pdf||0.94),'JPEG',0,0,210,297,undefined,'FAST');
        const blob=pdf.output('blob');
        renderer.triggerBlobDownload(blob,`${fileBase}.pdf`);
      }
      notify(failedImages?'تم إنشاء الداتا شيت، لكن تعذر إدراج الصورة.':'تم تصميم وتحميل الداتا شيت بنفس القالب المعتمد');
    }catch(error){
      console.warn('[Admin datasheet] generation failed',error);
      notify('تعذر تصميم الداتا شيت: '+(error?.message||error));
    }finally{
      button.disabled=false;button.textContent='صمّم وتحميل';
    }
  }

  function bindDatasheetDesigner(){
    const imageInput=document.getElementById('flDatasheetImage');
    const preview=document.getElementById('flDatasheetImagePreview');
    let previewUrl='';
    imageInput?.addEventListener('change',()=>{
      if(previewUrl){URL.revokeObjectURL(previewUrl);previewUrl='';}
      const file=imageInput.files?.[0];
      if(!file){if(preview){preview.hidden=true;preview.removeAttribute('src');}return;}
      previewUrl=URL.createObjectURL(file);
      if(preview){preview.src=previewUrl;preview.hidden=false;}
    });
    document.getElementById('flDatasheetDesignerForm')?.addEventListener('submit',createAdminDatasheetExport);

    if(!isPrimaryAdmin) return;
    const list=document.getElementById('flDatasheetFieldsList');
    document.getElementById('flDatasheetAddField')?.addEventListener('click',()=>{
      const count=list?.querySelectorAll('[data-datasheet-config-row]').length||0;
      if(count>=15){notify('الحد الأقصى 15 معلومة فنية');return;}
      list?.insertAdjacentHTML('beforeend',datasheetConfigRowHtml({}));
      list?.lastElementChild?.querySelector('[data-datasheet-config-label]')?.focus();
    });
    list?.addEventListener('click',event=>{
      const remove=event.target.closest?.('[data-datasheet-remove-field]');
      if(remove) remove.closest('[data-datasheet-config-row]')?.remove();
    });
    document.getElementById('flDatasheetFieldsForm')?.addEventListener('submit',async event=>{
      event.preventDefault();
      const save=document.getElementById('flDatasheetFieldsSave');
      const fields=[...document.querySelectorAll('[data-datasheet-config-row]')].map((row,index)=>({
        key:`datasheet_${index+1}`,
        label:String(row.querySelector('[data-datasheet-config-label]')?.value||'').trim(),
        unit:String(row.querySelector('[data-datasheet-config-unit]')?.value||'').trim()
      })).filter(field=>field.label).slice(0,15);
      save.disabled=true;save.textContent='جاري الحفظ…';
      try{
        const {data,error}=await db.rpc('owner_set_datasheet_fields',{p_fields:fields});
        if(error){
          const missing=String(error.code)==='PGRST202'||String(error.code)==='42883'||String(error.code)==='42703';
          throw new Error(missing?'شغّل ملف SUPABASE_SETUP.sql في Supabase أولًا.':(error.message||error));
        }
        datasheetFields=normalizeDatasheetFields(data);
        renderDatasheetDesigner();
        notify('تم حفظ المواصفات الثابتة للأدمن');
      }catch(error){
        notify('تعذر حفظ المواصفات: '+(error?.message||error));
        save.disabled=false;save.textContent='حفظ المواصفات الثابتة';
      }
    });
  }

  function renderDatasheetDesigner(){
    if(datasheetFields===null && !datasheetLoadError){
      layout(`<div class="fl-cloud-head"><div><h2>صمّم داتا شيت</h2><p>أداة إدارية خاصة ولا تظهر في واجهة العملاء.</p></div></div>
        <div class="fl-cloud-card fl-datasheet-loading"><strong>جاري تحميل إعدادات الداتا شيت…</strong><small>يتم جلب الحقول التي حددها المدير.</small></div>`);
      void loadDatasheetSettings().then(()=>{if(core.view==='datasheet')renderDatasheetDesigner();}).catch(()=>{if(core.view==='datasheet')renderDatasheetDesigner();});
      return;
    }
    if(datasheetLoadError){
      layout(`<div class="fl-cloud-head"><div><h2>صمّم داتا شيت</h2><p>أداة إدارية خاصة ولا تظهر في واجهة العملاء.</p></div></div>
        <div class="fl-cloud-note bad">${esc(datasheetLoadError)}</div>
        <div class="fl-cloud-actions"><button class="fl-cloud-btn primary" id="flDatasheetRetry" type="button">إعادة المحاولة</button></div>`);
      document.getElementById('flDatasheetRetry')?.addEventListener('click',()=>{datasheetLoadError='';datasheetFields=null;renderDatasheetDesigner();});
      return;
    }
    const fields=Array.isArray(datasheetFields)?datasheetFields:DEFAULT_DATASHEET_FIELDS;
    const ownerSettings=isPrimaryAdmin?`<div class="fl-cloud-card fl-datasheet-settings-card">
      <div class="fl-cloud-head"><div><h2 style="font-size:18px">المواصفات الثابتة للأدمن</h2><p>المدير يحدد أسماء المعلومات ووحداتها مرة واحدة، والأدمن يرى الأسماء فقط ويدخل القيم.</p></div></div>
      <form id="flDatasheetFieldsForm">
        <div id="flDatasheetFieldsList" class="fl-datasheet-config-list">${fields.map(datasheetConfigRowHtml).join('')}</div>
        <div class="fl-cloud-actions fl-datasheet-config-actions"><button class="fl-cloud-btn" id="flDatasheetAddField" type="button">+ إضافة معلومة فنية</button><button class="fl-cloud-btn primary" id="flDatasheetFieldsSave" type="submit">حفظ المواصفات الثابتة</button></div>
      </form>
      <div class="fl-cloud-note">يمكن إضافة حتى 15 معلومة. مثال: القدرة (W)، اللومن (lm)، المقاس، اللون، الضمان.</div>
    </div>`:'';
    layout(`<div class="fl-cloud-head"><div><h2>صمّم داتا شيت</h2><p>ارفع صورة المنتج وأدخل الاسم والكود والقيم؛ ثم اضغط «صمّم» واختر التحميل PDF أو JPG بنفس قالب الداتا شيت المعتمد.</p></div></div>
      ${ownerSettings}
      <div class="fl-cloud-card fl-datasheet-designer-card">
        <form id="flDatasheetDesignerForm">
          <div class="fl-cloud-form fl-datasheet-form">
            <div class="fl-cloud-field full fl-datasheet-image-field"><label>صورة المنتج</label><input id="flDatasheetImage" type="file" accept="image/*" required><div class="fl-datasheet-preview-wrap"><img id="flDatasheetImagePreview" class="fl-datasheet-preview" alt="معاينة صورة المنتج" hidden></div></div>
            <div class="fl-cloud-field"><label>اسم المنتج</label><input id="flDatasheetName" required placeholder="مثال: كشاف LED جداري"></div>
            <div class="fl-cloud-field"><label>كود / رقم المنتج</label><input id="flDatasheetCode" placeholder="مثال: WL-205"></div>
            <div class="fl-cloud-field full"><label>وصف مختصر <small>(اختياري)</small></label><input id="flDatasheetCaption" placeholder="سطر مختصر يظهر أسفل اسم المنتج"></div>
            <div class="fl-datasheet-section-title full"><strong>المعلومات الفنية</strong>${isPrimaryAdmin?'<small>هذه نفس الحقول التي حددتها بالأعلى.</small>':''}</div>
            ${datasheetValueFieldsHtml(fields)}
          </div>
          <div class="fl-cloud-dialog-actions"><button class="fl-cloud-btn primary fl-datasheet-create" id="flDatasheetCreate" type="submit">صمّم وتحميل</button></div>
        </form>
      </div>
      <div class="fl-cloud-note ok">القالب المستخدم هنا هو نفس قالب «تحميل الصورة مع المعلومات الفنية» الموجود في المنتجات، بما فيه الرأس والتذييل وجدول المواصفات والضمان.</div>`);
    bindDatasheetDesigner();
  }

  window.FL_ADMIN_DATASHEET={renderDatasheetDesigner};
})();
