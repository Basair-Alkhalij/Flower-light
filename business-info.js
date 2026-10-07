(() => {
  'use strict';
  const container=document.getElementById('flBusinessInfo');
  const status=document.getElementById('flBusinessStatus');
  if(!container || new URLSearchParams(location.search).has('admin'))return;
  const fields=[['legal_name','الاسم التجاري'],['commercial_registration','السجل التجاري'],['tax_number','الرقم الضريبي'],['contact_phone','للتواصل'],['retention_days','مدة الاحتفاظ بالبيانات']];
  let pending=false;
  async function refresh(){
    if(pending)return;pending=true;
    // No stale cache/fallback: an owner-hidden value must not reappear offline.
    container.replaceChildren();container.hidden=true;
    try{
      const cfg=window.FLOWER_LIGHT_SUPABASE;
      const response=await fetch(`${cfg.url}/rest/v1/rpc/get_public_business_privacy`,{method:'POST',headers:{apikey:cfg.anonKey,'Content-Type':'application/json'},body:'{}',cache:'no-store'});
      if(!response.ok)throw new Error('Settings unavailable');
      const data=await response.json();
      for(const [key,label] of fields){
        if(data?.[key]==null || String(data[key]).trim()==='')continue;
        const row=document.createElement('p'),title=document.createElement('b'),value=document.createElement('span');
        row.dataset.businessField=key;title.textContent=label+':';
        value.textContent=String(data[key])+(key==='retention_days'?' يوم':'');
        if(key!=='legal_name')value.dir='ltr';
        row.append(title,value);container.append(row);
      }
      container.hidden=!container.childElementCount;
      if(status){status.textContent='';status.hidden=true;}
    }catch(e){if(status){status.textContent='تعذر تحميل بيانات المنشأة حالياً. أعد المحاولة لاحقاً.';status.hidden=false;}}
    finally{pending=false;}
  }
  void refresh();window.addEventListener('pageshow',()=>void refresh());
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refresh();});
})();
