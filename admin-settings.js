// Flower Light admin — Site settings cards (module split, part 4)
//
// Moved verbatim from admin.js: the Owner-only cards shown on the overview page
// (customer-lead gate toggle, master barcode, design footer number/label) together
// with their loader and the barcode upload helper. The Owner recovery-email card stays
// in admin.js on purpose (it is part of the account-recovery flow).
// Classic script loaded right after admin.js on ?admin= pages; no-ops without FL_ADMIN_CORE.

(() => {
  'use strict';
  const core = window.FL_ADMIN_CORE;
  if (!core) {
    console.error('[admin-settings] window.FL_ADMIN_CORE is missing — admin.js must load before admin-settings.js.');
    return;
  }
  const { esc, notify, imageUrl, isStoragePath, bucket, isPrimaryAdmin } = core;
  // The code below was written against a `db` constant; this keeps it unchanged and always live.
  const db = new Proxy({}, { get: (_, prop) => { const real = core.db; const v = real[prop]; return typeof v === 'function' ? v.bind(real) : v; } });

  let customerLeadGateEnabled=window.FLOWER_LIGHT_SITE_SETTINGS?.require_customer_lead!==false;
  let customerLeadGateSettingError='';
  let masterBarcodePath=String(window.FLOWER_LIGHT_SITE_SETTINGS?.master_barcode_path||'').trim();
  let masterBarcodeSettingError='';
  let designFooterNumber=String(window.FLOWER_LIGHT_SITE_SETTINGS?.design_footer_number||'').trim();
  let designFooterLabel=String(window.FLOWER_LIGHT_SITE_SETTINGS?.design_footer_label||'').trim();
  let designFooterNumberSettingError='';
  let pwaInstallEnabled=window.FLOWER_LIGHT_SITE_SETTINGS?.pwa_install_enabled===true;
  let pwaInstallSettingError='';

  async function load(){
    if(!isPrimaryAdmin)return;
    await window.FL_ADMIN_BUSINESS?.load();
    customerLeadGateSettingError='';
    masterBarcodeSettingError='';
    designFooterNumberSettingError='';
    pwaInstallSettingError='';
    try{
      const {data,error}=await db.from('site_settings').select('require_customer_lead,master_barcode_path,design_footer_number,design_footer_label').eq('id',1).maybeSingle();
      if(error)throw error;
      customerLeadGateEnabled=data?.require_customer_lead!==false;
      masterBarcodePath=String(data?.master_barcode_path||'').trim();
      designFooterNumber=String(data?.design_footer_number||'').trim();
      designFooterLabel=String(data?.design_footer_label||'').trim();
      const pwaResult=await db.from('site_settings').select('pwa_install_enabled').eq('id',1).maybeSingle();
      if(pwaResult.error){
        pwaInstallEnabled=false;
        pwaInstallSettingError=String(pwaResult.error?.message||pwaResult.error||'');
      }else{
        pwaInstallEnabled=pwaResult.data?.pwa_install_enabled===true;
      }
      window.FLOWER_LIGHT_SITE_SETTINGS={
        require_customer_lead:customerLeadGateEnabled,
        master_barcode_path:masterBarcodePath,
        master_barcode_url:masterBarcodePath?imageUrl(masterBarcodePath):'',
        design_footer_number:designFooterNumber,
        design_footer_label:designFooterLabel,
        pwa_install_enabled:pwaInstallEnabled
      };
    }catch(error){
      customerLeadGateEnabled=true;
      masterBarcodePath='';
      designFooterNumber='';
      pwaInstallEnabled=false;
      const message=String(error?.message||error||'');
      customerLeadGateSettingError=message;
      masterBarcodeSettingError=message;
      designFooterNumberSettingError=message;
      pwaInstallSettingError=message;
    }
  }

  async function uploadMasterBarcodeFile(file){
    if(!file) return '';
    const type=String(file.type||'').toLowerCase();
    const name=String(file.name||'');
    const allowed=type.startsWith('image/')||/\.(png|jpe?g|webp|svg)$/i.test(name);
    if(!allowed)throw new Error('اختر ملف صورة للباركود فقط');
    if(Number(file.size||0)>5*1024*1024)throw new Error('حجم صورة الباركود يجب ألا يتجاوز 5 MB');
    const ext=type.includes('png')?'png':type.includes('svg')?'svg':type.includes('webp')?'webp':type.includes('jpeg')||type.includes('jpg')?'jpg':((name.split('.').pop()||'png').toLowerCase().replace('jpeg','jpg'));
    const safeExt=/^(png|jpg|webp|svg)$/.test(ext)?ext:'png';
    const path=`site-settings/master-barcode-${crypto.randomUUID()}.${safeExt}`;
    const {error}=await db.storage.from(bucket).upload(path,file,{contentType:type||'image/png',upsert:false,cacheControl:'31536000'});
    if(error)throw error;
    return path;
  }

  // Returns the Owner site-setting cards as one HTML string (empty for the sub-admin).
  function cardsHtml(scope='all'){
    const leadGateCard=isPrimaryAdmin?`<form id="flCustomerLeadGateSettingsForm" class="fl-cloud-card fl-lead-gate-settings-card">
      <div class="fl-credentials-card-head"><div><span class="fl-account-badge owner">دخول المنتجات</span><h3>طلب بيانات العميل قبل عرض المنتجات</h3></div></div>
      <p>تحكم من هنا في ظهور نموذج الاسم ورقم الجوال للعميل عند فتح قسم المنتجات.</p>
      ${customerLeadGateSettingError?`<div class="fl-cloud-note bad">تعذر قراءة الإعداد. شغّل <b>SUPABASE_SETUP.sql</b> في Supabase مرة واحدة ثم أعد تحميل الصفحة.</div>`:''}
      <label class="fl-permission-row fl-lead-gate-setting-row">
        <span class="fl-permission-copy"><strong>طلب الاسم ورقم الجوال</strong><small>${customerLeadGateEnabled?'مفعّل الآن: سيُطلب من العميل إدخال بياناته مرة واحدة قبل فتح المنتجات.':'متوقف الآن: سيدخل العميل إلى المنتجات مباشرة بدون طلب الاسم أو رقم الجوال.'}</small></span>
        <input id="flRequireCustomerLead" type="checkbox" ${customerLeadGateEnabled?'checked':''} ${customerLeadGateSettingError?'disabled':''}>
        <span class="fl-permission-check" aria-hidden="true">✓</span>
      </label>
      <div class="fl-cloud-actions"><button class="fl-cloud-btn primary" id="flCustomerLeadGateSave" type="submit" ${customerLeadGateSettingError?'disabled':''}>حفظ الإعداد</button></div>
    </form>`:'';
    const pwaInstallCard=isPrimaryAdmin?`<form id="flPwaInstallSettingsForm" class="fl-cloud-card fl-pwa-install-settings-card">
      <div class="fl-credentials-card-head"><div><span class="fl-account-badge owner">تطبيق الجوال</span><h3>إظهار خيار تثبيت التطبيق للعملاء</h3></div></div>
      <p>تحكم في ظهور تنبيه التثبيت للعملاء. على أندرويد والكمبيوتر لا يظهر التنبيه إلا بعد أن يعلن المتصفح نفسه عن توفر نافذة تثبيت أصلية عبر beforeinstallprompt؛ ولا نعرض مسار «إنشاء اختصار» يدويًا. على iPhone/iPad تظهر إرشادات Safari لإضافة تطبيق الويب إلى الشاشة الرئيسية.</p>
      ${pwaInstallSettingError?`<div class="fl-cloud-note bad">تعذر قراءة إعداد تثبيت التطبيق. شغّل ملف الهجرة <b>2026-10-05_pwa_install_toggle.sql</b> في Supabase ثم أعد تحميل الصفحة.</div>`:''}
      <label class="fl-permission-row fl-pwa-install-setting-row">
        <span class="fl-permission-copy"><strong>إظهار خيار التثبيت للعملاء</strong><small>${pwaInstallEnabled?'مفعّل: يظهر للعملاء على أندرويد والكمبيوتر (تثبيت مباشر) وعلى الآيفون (شرح الإضافة للشاشة الرئيسية).':'متوقف: لن يظهر تنبيه تثبيت التطبيق لأي عميل.'}</small></span>
        <input id="flPwaInstallEnabled" type="checkbox" ${pwaInstallEnabled?'checked':''} ${pwaInstallSettingError?'disabled':''}>
        <span class="fl-permission-check" aria-hidden="true">✓</span>
      </label>
      <div class="fl-cloud-actions"><button class="fl-cloud-btn primary" id="flPwaInstallSettingsSave" type="submit" ${pwaInstallSettingError?'disabled':''}>حفظ الإعداد</button></div>
    </form>`:'';
    const barcodePreviewUrl=masterBarcodePath?imageUrl(masterBarcodePath):'';
    const masterBarcodeCard=isPrimaryAdmin?`<form id="flMasterBarcodeSettingsForm" class="fl-cloud-card fl-master-barcode-card">
      <div class="fl-credentials-card-head"><div><span class="fl-account-badge owner">قالب المنتجات</span><h3>الباركود الرئيسي</h3></div></div>
      <p>ارفع باركودًا واحدًا للموقع. عند وجوده سيظهر تلقائيًا في القالب المعتمد للداتا شيت وصور/PDF المنتجات والأقسام. إذا لم تضف باركودًا فلن يظهر شيء.</p>
      ${masterBarcodeSettingError?`<div class="fl-cloud-note bad">تعذر قراءة إعداد الباركود. شغّل <b>SUPABASE_SETUP.sql</b> في Supabase مرة واحدة ثم أعد تحميل الصفحة.</div>`:''}
      <div class="fl-master-barcode-editor">
        <div class="fl-master-barcode-preview" id="flMasterBarcodePreviewWrap" ${barcodePreviewUrl?'':'data-empty="true"'}>
          ${barcodePreviewUrl?`<img id="flMasterBarcodePreview" src="${esc(barcodePreviewUrl)}" alt="معاينة الباركود الرئيسي">`:`<div id="flMasterBarcodeEmpty" class="fl-master-barcode-empty">لا يوجد باركود رئيسي حاليًا</div><img id="flMasterBarcodePreview" alt="معاينة الباركود الرئيسي" hidden>`}
        </div>
        <div class="fl-master-barcode-controls">
          <label class="fl-cloud-field"><span>صورة الباركود</span><input id="flMasterBarcodeFile" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" ${masterBarcodeSettingError?'disabled':''}><small>يفضل PNG أو JPG واضح بخلفية بيضاء. الحد الأقصى 5 MB.</small></label>
          ${masterBarcodePath?'<label class="fl-cloud-check"><input id="flRemoveMasterBarcode" type="checkbox"> حذف الباركود الحالي</label>':''}
        </div>
      </div>
      <div class="fl-cloud-actions"><button class="fl-cloud-btn primary" id="flMasterBarcodeSave" type="submit" ${masterBarcodeSettingError?'disabled':''}>حفظ الباركود</button></div>
    </form>`:'';
    const designFooterNumberCard=isPrimaryAdmin?`<form id="flDesignFooterNumberSettingsForm" class="fl-cloud-card fl-design-footer-number-card">
      <div class="fl-credentials-card-head"><div><span class="fl-account-badge owner">قالب المنتجات</span><h3>رقم التذييل في التصاميم</h3></div></div>
      <p>يمكنك تحديد تسمية لهذا الرقم مثل "مندوب الجملة" أو "خدمة العملاء" مع الرقم نفسه. سيظهران بدل رابط الموقع الإلكتروني في أسفل القالب المعتمد للداتا شيت وصور/PDF المنتجات والأقسام. إذا تركت الرقم فارغًا فلن يظهر شيء في هذا الموضع.</p>
      ${designFooterNumberSettingError?`<div class="fl-cloud-note bad">تعذر قراءة إعداد رقم التذييل. شغّل <b>SUPABASE_SETUP.sql</b> في Supabase مرة واحدة ثم أعد تحميل الصفحة.</div>`:''}
      <label class="fl-cloud-field"><span>التسمية التي تظهر فوق الرقم</span><input id="flDesignFooterLabel" type="text" maxlength="40" value="${esc(designFooterLabel)}" placeholder="مثال: مندوب الجملة أو خدمة العملاء" ${designFooterNumberSettingError?'disabled':''}><small>اختياري. إذا تركته فارغًا سيظهر الرقم فقط بعنوان افتراضي.</small></label>
      <label class="fl-cloud-field"><span>الرقم الذي يظهر في التذييل</span><input id="flDesignFooterNumber" type="text" inputmode="tel" dir="ltr" maxlength="40" value="${esc(designFooterNumber)}" placeholder="مثال: 0501234567 أو +966501234567" ${designFooterNumberSettingError?'disabled':''}><small>يمكن أن يكون رقم جوال أو رقمًا موحدًا. ترك الحقل فارغًا يخفي هذا الجزء من التذييل بالكامل.</small></label>
      <div class="fl-cloud-actions"><button class="fl-cloud-btn primary" id="flDesignFooterNumberSave" type="submit" ${designFooterNumberSettingError?'disabled':''}>حفظ البيانات</button></div>
    </form>`:'';
    const businessCard=window.FL_ADMIN_BUSINESS?.cardsHtml()||'';
    if(scope==='site') return `${leadGateCard}${pwaInstallCard}`;
    if(scope==='business') return businessCard;
    if(scope==='template') return `${masterBarcodeCard}${designFooterNumberCard}`;
    return `${businessCard}${leadGateCard}${pwaInstallCard}${masterBarcodeCard}${designFooterNumberCard}`;
  }

  // Wires the cards' forms; `renderOverview` is re-run after each successful save.
  function bind(renderOverview){
    if(!isPrimaryAdmin)return;
    window.FL_ADMIN_BUSINESS?.bind(renderOverview);
    document.getElementById('flPwaInstallSettingsForm')?.addEventListener('submit',async event=>{
      event.preventDefault();
      const toggle=document.getElementById('flPwaInstallEnabled');
      const save=document.getElementById('flPwaInstallSettingsSave');
      if(!toggle||!save)return;
      const enabled=Boolean(toggle.checked);
      save.disabled=true;save.textContent='جاري الحفظ...';
      try{
        const {error}=await db.from('site_settings').upsert({id:1,pwa_install_enabled:enabled},{onConflict:'id'});
        if(error)throw error;
        pwaInstallEnabled=enabled;
        pwaInstallSettingError='';
        window.FLOWER_LIGHT_SITE_SETTINGS={...(window.FLOWER_LIGHT_SITE_SETTINGS||{}),pwa_install_enabled:enabled};
        notify(enabled?'تم تفعيل خيار تثبيت التطبيق للعملاء على الأجهزة المتوافقة فقط':'تم إخفاء خيار تثبيت التطبيق عن جميع العملاء');
        renderOverview();
      }catch(error){
        notify(/42703|PGRST204|PGRST205|42P01/i.test(String(error?.code||''))?'شغّل ملف هجرة إعداد تثبيت التطبيق في Supabase أولًا.':'تعذر حفظ إعداد التثبيت: '+(error?.message||error));
        save.disabled=false;save.textContent='حفظ الإعداد';
      }
    });

    document.getElementById('flCustomerLeadGateSettingsForm')?.addEventListener('submit',async event=>{
      event.preventDefault();
      const toggle=document.getElementById('flRequireCustomerLead');
      const save=document.getElementById('flCustomerLeadGateSave');
      if(!toggle||!save)return;
      const enabled=Boolean(toggle.checked);
      save.disabled=true;save.textContent='جاري الحفظ...';
      try{
        const {error}=await db.from('site_settings').upsert({id:1,require_customer_lead:enabled},{onConflict:'id'});
        if(error)throw error;
        customerLeadGateEnabled=enabled;
        customerLeadGateSettingError='';
        window.FLOWER_LIGHT_SITE_SETTINGS={...(window.FLOWER_LIGHT_SITE_SETTINGS||{}),require_customer_lead:enabled,master_barcode_path:masterBarcodePath,master_barcode_url:masterBarcodePath?imageUrl(masterBarcodePath):'',design_footer_number:designFooterNumber,design_footer_label:designFooterLabel};
        notify(enabled?'تم تفعيل طلب بيانات العميل قبل المنتجات':'تم إيقاف طلب البيانات؛ العميل سيدخل المنتجات مباشرة');
        renderOverview();
      }catch(error){
        notify(/42P01|PGRST205/i.test(String(error?.code||''))?'شغّل SUPABASE_SETUP.sql في Supabase أولًا.':'تعذر حفظ الإعداد: '+(error?.message||error));
        save.disabled=false;save.textContent='حفظ الإعداد';
      }
    });

    const barcodeFileInput=document.getElementById('flMasterBarcodeFile');
    const barcodePreview=document.getElementById('flMasterBarcodePreview');
    const barcodeEmpty=document.getElementById('flMasterBarcodeEmpty');
    let barcodePreviewObjectUrl='';
    barcodeFileInput?.addEventListener('change',()=>{
      if(barcodePreviewObjectUrl){URL.revokeObjectURL(barcodePreviewObjectUrl);barcodePreviewObjectUrl='';}
      const file=barcodeFileInput.files?.[0];
      if(!file)return;
      barcodePreviewObjectUrl=URL.createObjectURL(file);
      if(barcodePreview){barcodePreview.src=barcodePreviewObjectUrl;barcodePreview.hidden=false;}
      if(barcodeEmpty)barcodeEmpty.hidden=true;
    });
    document.getElementById('flMasterBarcodeSettingsForm')?.addEventListener('submit',async event=>{
      event.preventDefault();
      const save=document.getElementById('flMasterBarcodeSave');
      if(!save)return;
      const file=barcodeFileInput?.files?.[0]||null;
      const remove=Boolean(document.getElementById('flRemoveMasterBarcode')?.checked);
      if(!file&&!remove&&!masterBarcodePath){notify('اختر صورة باركود أولًا');return;}
      save.disabled=true;save.textContent='جاري الحفظ...';
      const oldPath=masterBarcodePath;
      let uploadedPath='';
      try{
        let nextPath=oldPath;
        if(remove)nextPath='';
        if(file){uploadedPath=await uploadMasterBarcodeFile(file);nextPath=uploadedPath;}
        const {error}=await db.from('site_settings').upsert({id:1,master_barcode_path:nextPath},{onConflict:'id'});
        if(error)throw error;
        masterBarcodePath=nextPath;
        masterBarcodeSettingError='';
        window.FLOWER_LIGHT_SITE_SETTINGS={...(window.FLOWER_LIGHT_SITE_SETTINGS||{}),require_customer_lead:customerLeadGateEnabled,master_barcode_path:masterBarcodePath,master_barcode_url:masterBarcodePath?imageUrl(masterBarcodePath):'',design_footer_number:designFooterNumber,design_footer_label:designFooterLabel};
        if(oldPath&&oldPath!==masterBarcodePath&&isStoragePath(oldPath))await db.storage.from(bucket).remove([oldPath]);
        notify(masterBarcodePath?'تم حفظ الباركود الرئيسي وسيظهر في القوالب':'تم حذف الباركود الرئيسي من القوالب');
        if(barcodePreviewObjectUrl){URL.revokeObjectURL(barcodePreviewObjectUrl);barcodePreviewObjectUrl='';}
        renderOverview();
      }catch(error){
        if(uploadedPath&&uploadedPath!==oldPath)await db.storage.from(bucket).remove([uploadedPath]);
        notify(/42703|PGRST204|PGRST205|42P01/i.test(String(error?.code||''))?'شغّل SUPABASE_SETUP.sql في Supabase أولًا.':'تعذر حفظ الباركود: '+(error?.message||error));
        save.disabled=false;save.textContent='حفظ الباركود';
      }
    });

    document.getElementById('flDesignFooterNumberSettingsForm')?.addEventListener('submit',async event=>{
      event.preventDefault();
      const input=document.getElementById('flDesignFooterNumber');
      const labelInput=document.getElementById('flDesignFooterLabel');
      const save=document.getElementById('flDesignFooterNumberSave');
      if(!input||!save)return;
      const next=String(input.value||'').trim().slice(0,40);
      const nextLabel=String(labelInput?.value||'').trim().slice(0,40);
      save.disabled=true;save.textContent='جاري الحفظ...';
      try{
        const {error}=await db.from('site_settings').upsert({id:1,design_footer_number:next,design_footer_label:nextLabel},{onConflict:'id'});
        if(error)throw error;
        designFooterNumber=next;
        designFooterLabel=nextLabel;
        designFooterNumberSettingError='';
        window.FLOWER_LIGHT_SITE_SETTINGS={...(window.FLOWER_LIGHT_SITE_SETTINGS||{}),require_customer_lead:customerLeadGateEnabled,master_barcode_path:masterBarcodePath,master_barcode_url:masterBarcodePath?imageUrl(masterBarcodePath):'',design_footer_number:designFooterNumber,design_footer_label:designFooterLabel};
        notify(designFooterNumber?'تم حفظ رقم التذييل وسيظهر بدل رابط الموقع في التصاميم':'تم إخفاء رقم التذييل من التصاميم');
        renderOverview();
      }catch(error){
        notify(/42703|PGRST204|PGRST205|42P01/i.test(String(error?.code||''))?'شغّل SUPABASE_SETUP.sql في Supabase أولًا.':'تعذر حفظ رقم التذييل: '+(error?.message||error));
        save.disabled=false;save.textContent='حفظ الرقم';
      }
    });
  }

  window.FL_ADMIN_SETTINGS = { load, cardsHtml, bind };
})();
