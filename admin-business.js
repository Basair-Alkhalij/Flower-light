// Owner-only editing. Hidden values remain readable only by the owner.
(() => {
  'use strict';
  const core=window.FL_ADMIN_CORE;
  if(!core)return;
  const fields=[['legal_name','الاسم التجاري',200],['commercial_registration','رقم السجل التجاري',40],['tax_number','الرقم الضريبي',40],['contact_phone','وسيلة التواصل',40],['retention_days','مدة الاحتفاظ بالبيانات (بالأيام)',5]];
  let settings={},error='',loaded=false;
  async function load(){
    if(!core.isPrimaryAdmin)return;
    loaded=false;error='';
    try{
      const result=await core.db.from('business_privacy_settings').select('*').eq('id',1).maybeSingle();
      if(result.error)throw result.error;
      if(!result.data)throw new Error('Missing settings');
      settings=result.data;loaded=true;
    }catch(e){error='تعذر تحميل البيانات. شغّل UPGRADE_V102.sql ثم حدّث الصفحة.';}
  }
  function cardsHtml(){
    if(!core.isPrimaryAdmin)return '';
    const esc=core.esc;
    return `<form id="flBusinessSettingsForm" class="fl-cloud-card"><h3>البيانات التجارية وسياسة الخصوصية</h3>
      <p>تظهر البيانات المختارة أسفل الموقع وفي سياسة الخصوصية. يمكنك إخفاء الجميع أو كل بيان على حدة دون مسح قيمته.</p>
      ${error?`<p role="alert">${esc(error)}</p>`:''}
      <fieldset ${loaded?'':'disabled'}><label class="fl-cloud-check"><input id="flBusinessShowAll" type="checkbox" ${settings.show_all?'checked':''}> إظهار بيانات الشركة للزوار</label>
      ${fields.map(([key,label,max])=>`<div class="fl-cloud-field"><label for="flBusiness_${key}">${label}</label><input id="flBusiness_${key}" ${key==='retention_days'?'type="number" min="1" max="36500" required':'type="text"'} maxlength="${max}" value="${esc(settings[key]??'')}" ${key==='legal_name'?'':'dir="ltr"'}><label class="fl-cloud-check"><input id="flBusiness_show_${key}" type="checkbox" ${settings['show_'+key]?'checked':''}> إظهار هذا البيان</label></div>`).join('')}
      <button id="flBusinessSave" class="fl-cloud-btn primary" type="submit">حفظ بيانات الشركة</button></fieldset></form>`;
  }
  function bind(renderOverview){
    if(!core.isPrimaryAdmin)return;
    document.getElementById('flBusinessSettingsForm')?.addEventListener('submit',async event=>{
      event.preventDefault();if(!loaded)return;
      const button=document.getElementById('flBusinessSave');button.disabled=true;
      try{
        const payload={id:1,show_all:document.getElementById('flBusinessShowAll').checked};
        for(const [key,,max] of fields){
          const text=document.getElementById('flBusiness_'+key).value.trim();
          if(key==='retention_days'){
            const value=Number(text);if(!Number.isInteger(value)||value<1||value>36500)throw new Error('مدة الاحتفاظ يجب أن تكون عدد أيام صحيحاً بين 1 و36500.');
            payload[key]=value;
          }else{if(text.length>max)throw new Error('أحد الحقول يتجاوز الطول المسموح');payload[key]=text;}
          payload['show_'+key]=document.getElementById('flBusiness_show_'+key).checked;
        }
        const result=await core.db.from('business_privacy_settings').upsert(payload,{onConflict:'id'});
        if(result.error)throw result.error;
        settings=payload;
        try{await core.db.rpc('purge_expired_customer_leads');}catch(_){}
        core.notify('تم حفظ بيانات الشركة وإعدادات ظهورها');await renderOverview();
      }catch(e){core.notify('تعذر الحفظ: '+(e.message||e));}finally{button.disabled=false;}
    });
  }
  window.FL_ADMIN_BUSINESS={load,cardsHtml,bind};
})();
