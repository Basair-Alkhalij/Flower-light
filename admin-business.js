// Flower Light admin — owner-managed public business information (v106)
(() => {
  'use strict';
  const core=window.FL_ADMIN_CORE;
  if(!core)return;
  const db=new Proxy({}, {get:(_,prop)=>{const real=core.db;const value=real[prop];return typeof value==='function'?value.bind(real):value;}});
  let settings={id:1,show_all:true,retention_days:180,show_retention_days:true};
  let publicFields=[];
  let loadedFieldIds=new Set();
  let error='';
  let loaded=false;

  function normalizeField(field,index=0){
    return {
      id:String(field?.id||crypto.randomUUID()),
      label:String(field?.label||'').slice(0,80),
      value:String(field?.value||'').slice(0,300),
      is_visible:field?.is_visible!==false,
      sort_order:Number.isInteger(Number(field?.sort_order))?Number(field.sort_order):index
    };
  }

  async function load(){
    if(!core.isPrimaryAdmin)return;
    loaded=false;error='';
    try{
      const settingsResult=await db.from('business_privacy_settings').select('id,show_all,retention_days,show_retention_days').eq('id',1).maybeSingle();
      if(settingsResult.error)throw settingsResult.error;
      if(!settingsResult.data)throw new Error('Missing business privacy settings');
      settings={...settings,...settingsResult.data};

      const fieldsResult=await db.from('business_public_fields').select('id,label,value,is_visible,sort_order').order('sort_order',{ascending:true});
      if(fieldsResult.error)throw fieldsResult.error;
      publicFields=(fieldsResult.data||[]).map(normalizeField);
      loadedFieldIds=new Set(publicFields.map(field=>field.id));
      loaded=true;
    }catch(e){
      error=/business_public_fields|42P01|PGRST205/i.test(String(e?.message||e?.code||''))
        ?'يلزم تشغيل ترقية v106 في Supabase لتفعيل الخانات المرنة.'
        :'تعذر تحميل بيانات المنشأة: '+String(e?.message||e||'خطأ غير معروف');
    }
  }

  function fieldRowHtml(field,index,total){
    const esc=core.esc;
    return `<div class="fl-business-editor-row" data-business-row data-field-id="${esc(field.id)}">
      <div class="fl-business-editor-main">
        <label class="fl-cloud-field"><span>اسم الخانة</span><input data-business-label type="text" maxlength="80" value="${esc(field.label)}" placeholder="مثال: السجل التجاري"></label>
        <label class="fl-cloud-field"><span>القيمة</span><input data-business-value type="text" maxlength="300" value="${esc(field.value)}" placeholder="اكتب القيمة التي ستظهر للزائر" dir="auto"></label>
      </div>
      <div class="fl-business-editor-controls">
        <label class="fl-cloud-check fl-business-visible"><input data-business-visible type="checkbox" ${field.is_visible?'checked':''}> ظاهر للزوار</label>
        <div class="fl-business-order-actions" aria-label="ترتيب الخانة">
          <button class="fl-cloud-mini" data-business-action="up" type="button" ${index===0?'disabled':''} aria-label="نقل الخانة للأعلى">↑</button>
          <button class="fl-cloud-mini" data-business-action="down" type="button" ${index===total-1?'disabled':''} aria-label="نقل الخانة للأسفل">↓</button>
          <button class="fl-cloud-mini red" data-business-action="delete" type="button" aria-label="حذف الخانة">حذف</button>
        </div>
      </div>
    </div>`;
  }

  function cardsHtml(){
    if(!core.isPrimaryAdmin)return '';
    const esc=core.esc;
    return `<form id="flBusinessSettingsForm" class="fl-cloud-card fl-business-settings-card">
      <div class="fl-credentials-card-head"><div><span class="fl-account-badge owner">بيانات المنشأة</span><h3>بطاقة بيانات الشركة أسفل الموقع</h3></div></div>
      <p>أضف أي عدد من الخانات التي تحتاجها، واكتب اسم كل خانة وقيمتها ورتبها وأخفِ ما لا تريد إظهاره. لم تعد الخانات ثابتة بالسجل والضريبة والتواصل فقط.</p>
      ${error?`<div class="fl-cloud-note bad" role="alert">${esc(error)}</div>`:''}
      <fieldset ${loaded?'':'disabled'}>
        <label class="fl-permission-row fl-business-master-toggle">
          <span class="fl-permission-copy"><strong>إظهار بطاقة بيانات المنشأة</strong><small>${settings.show_all?'مفعلة الآن: ستظهر الخانات المعلّمة «ظاهر للزوار».':'مخفية الآن: لن تظهر بطاقة بيانات المنشأة للزوار.'}</small></span>
          <input id="flBusinessShowAll" type="checkbox" ${settings.show_all?'checked':''}>
          <span class="fl-permission-check" aria-hidden="true">✓</span>
        </label>

        <div class="fl-business-editor-head"><div><strong>الخانات الظاهرة أسفل الموقع</strong><small>يمكنك إضافة وحذف وتغيير ترتيب الخانات بحرية.</small></div><button id="flBusinessAddField" class="fl-cloud-btn" type="button">+ إضافة خانة</button></div>
        <div id="flBusinessFieldsList" class="fl-business-editor-list">${publicFields.map((field,index)=>fieldRowHtml(field,index,publicFields.length)).join('')}</div>
        <div id="flBusinessEmptyFields" class="fl-cloud-empty" ${publicFields.length?'hidden':''}>لا توجد خانات. اضغط «إضافة خانة» لإنشاء أول خانة.</div>

        <div class="fl-business-privacy-box">
          <div><strong>إعداد الخصوصية</strong><small>هذا الإعداد مستقل عن الخانات أعلاه ويحدد مدة الاحتفاظ ببيانات العملاء فعليًا.</small></div>
          <label class="fl-cloud-field"><span>مدة الاحتفاظ ببيانات العملاء (بالأيام)</span><input id="flBusiness_retention_days" type="number" min="1" max="36500" required value="${esc(settings.retention_days??180)}" dir="ltr"></label>
          <label class="fl-cloud-check"><input id="flBusiness_show_retention_days" type="checkbox" ${settings.show_retention_days!==false?'checked':''}> إظهار مدة الاحتفاظ داخل صفحة سياسة الخصوصية</label>
        </div>

        <div class="fl-cloud-actions"><button id="flBusinessSave" class="fl-cloud-btn primary" type="submit">حفظ بيانات المنشأة</button></div>
      </fieldset>
    </form>`;
  }

  function bind(renderOverview){
    if(!core.isPrimaryAdmin)return;
    const list=document.getElementById('flBusinessFieldsList');
    const empty=document.getElementById('flBusinessEmptyFields');
    if(!list)return;

    function syncFromDom(){
      publicFields=[...list.querySelectorAll('[data-business-row]')].map((row,index)=>normalizeField({
        id:row.dataset.fieldId,
        label:row.querySelector('[data-business-label]')?.value||'',
        value:row.querySelector('[data-business-value]')?.value||'',
        is_visible:Boolean(row.querySelector('[data-business-visible]')?.checked),
        sort_order:index
      },index));
    }
    function renderRows(){
      list.innerHTML=publicFields.map((field,index)=>fieldRowHtml(field,index,publicFields.length)).join('');
      if(empty)empty.hidden=publicFields.length>0;
    }

    document.getElementById('flBusinessAddField')?.addEventListener('click',()=>{
      syncFromDom();
      publicFields.push(normalizeField({label:'',value:'',is_visible:true,sort_order:publicFields.length},publicFields.length));
      renderRows();
      list.querySelector('[data-business-row]:last-child [data-business-label]')?.focus();
    });

    list.addEventListener('click',event=>{
      const button=event.target.closest('[data-business-action]');
      if(!button)return;
      const row=button.closest('[data-business-row]');
      if(!row)return;
      syncFromDom();
      const index=publicFields.findIndex(field=>field.id===row.dataset.fieldId);
      if(index<0)return;
      const action=button.dataset.businessAction;
      if(action==='delete')publicFields.splice(index,1);
      if(action==='up'&&index>0)[publicFields[index-1],publicFields[index]]=[publicFields[index],publicFields[index-1]];
      if(action==='down'&&index<publicFields.length-1)[publicFields[index+1],publicFields[index]]=[publicFields[index],publicFields[index+1]];
      publicFields.forEach((field,i)=>field.sort_order=i);
      renderRows();
    });

    document.getElementById('flBusinessSettingsForm')?.addEventListener('submit',async event=>{
      event.preventDefault();if(!loaded)return;
      syncFromDom();
      const button=document.getElementById('flBusinessSave');button.disabled=true;button.textContent='جاري الحفظ...';
      try{
        const retentionDays=Number(document.getElementById('flBusiness_retention_days').value);
        if(!Number.isInteger(retentionDays)||retentionDays<1||retentionDays>36500)throw new Error('مدة الاحتفاظ يجب أن تكون عدد أيام صحيحًا بين 1 و36500.');
        for(const [index,field] of publicFields.entries()){
          field.label=field.label.trim();field.value=field.value.trim();field.sort_order=index;
          if(!field.label)throw new Error(`اكتب اسم الخانة رقم ${index+1} أو احذفها.`);
          if(!field.value)throw new Error(`اكتب قيمة الخانة «${field.label}» أو احذفها.`);
          if(field.label.length>80||field.value.length>300)throw new Error('إحدى الخانات تتجاوز الطول المسموح.');
        }

        const settingsPayload={
          id:1,
          show_all:Boolean(document.getElementById('flBusinessShowAll').checked),
          retention_days:retentionDays,
          show_retention_days:Boolean(document.getElementById('flBusiness_show_retention_days').checked)
        };
        let result=await db.from('business_privacy_settings').upsert(settingsPayload,{onConflict:'id'});
        if(result.error)throw result.error;

        const currentIds=new Set(publicFields.map(field=>field.id));
        const removed=[...loadedFieldIds].filter(id=>!currentIds.has(id));
        if(removed.length){
          result=await db.from('business_public_fields').delete().in('id',removed);
          if(result.error)throw result.error;
        }
        if(publicFields.length){
          result=await db.from('business_public_fields').upsert(publicFields.map(field=>({id:field.id,label:field.label,value:field.value,is_visible:field.is_visible,sort_order:field.sort_order})),{onConflict:'id'});
          if(result.error)throw result.error;
        }

        settings={...settings,...settingsPayload};
        loadedFieldIds=new Set(publicFields.map(field=>field.id));
        try{await db.rpc('purge_expired_customer_leads');}catch(_){ }
        core.notify('تم حفظ بطاقة بيانات المنشأة وترتيب الخانات');
        await renderOverview();
      }catch(e){
        core.notify('تعذر الحفظ: '+(e?.message||e));
        button.disabled=false;button.textContent='حفظ بيانات المنشأة';
      }
    });
  }

  window.FL_ADMIN_BUSINESS={load,cardsHtml,bind};
})();
