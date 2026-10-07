(() => {
  'use strict';
  const container=document.getElementById('flBusinessInfo');
  const status=document.getElementById('flBusinessStatus');
  if(!container || new URLSearchParams(location.search).has('admin'))return;
  const legacyFields=[['legal_name','الاسم التجاري'],['commercial_registration','السجل التجاري'],['tax_number','الرقم الضريبي'],['contact_phone','للتواصل']];
  const onPrivacy=/\/privacy\.html$/i.test(location.pathname);
  let pending=false;

  function normalizedFields(data){
    if(Array.isArray(data?.fields)){
      return data.fields
        .filter(field=>field && String(field.label||'').trim() && String(field.value||'').trim())
        .map((field,index)=>({id:String(field.id||`field-${index}`),label:String(field.label).trim(),value:String(field.value).trim(),sort_order:Number(field.sort_order)||index}));
    }
    return legacyFields.flatMap(([key,label])=>data?.[key]==null||String(data[key]).trim()===''?[]:[{id:key,label,value:String(data[key]).trim()}]);
  }

  function render(data){
    const fields=normalizedFields(data);
    if(onPrivacy && data?.retention_days!=null && String(data.retention_days).trim()!==''){
      fields.push({id:'retention_days',label:'مدة الاحتفاظ بالبيانات',value:`${data.retention_days} يوم`});
    }
    container.replaceChildren();
    container.classList.toggle('is-privacy',onPrivacy);
    container.classList.toggle('is-inline',!onPrivacy);
    if(!fields.length){container.hidden=true;return;}

    if(!onPrivacy){
      const inline=document.createElement('div');inline.className='fl-business-info-inline';
      fields.forEach(field=>{
        const item=document.createElement('span');item.className='fl-business-info-item';item.dataset.businessField=field.id;
        const label=document.createElement('span');label.className='fl-business-info-label';label.textContent=`${field.label}:`;
        const value=document.createElement('strong');value.className='fl-business-info-value';value.textContent=field.value;value.dir='auto';
        item.append(label,value);inline.append(item);
      });
      container.append(inline);container.hidden=false;return;
    }

    const head=document.createElement('div');head.className='fl-business-info-head';
    const icon=document.createElement('span');icon.className='fl-business-info-icon';icon.setAttribute('aria-hidden','true');
    icon.innerHTML='<svg viewBox="0 0 24 24"><path d="M4 21V6.5L12 3l8 3.5V21"></path><path d="M8 10h2M14 10h2M8 14h2M14 14h2M9 21v-3h6v3"></path></svg>';
    const copy=document.createElement('div');
    const title=document.createElement('strong');title.textContent='بيانات المنشأة';
    const subtitle=document.createElement('small');subtitle.textContent='معلومات رسمية ومحدثة';
    copy.append(title,subtitle);head.append(icon,copy);

    const grid=document.createElement('div');grid.className='fl-business-info-grid';
    fields.forEach((field,index)=>{
      const item=document.createElement('div');item.className='fl-business-info-item'+(index===0?' is-primary':'');item.dataset.businessField=field.id;
      const label=document.createElement('span');label.className='fl-business-info-label';label.textContent=field.label;
      const value=document.createElement('strong');value.className='fl-business-info-value';value.textContent=field.value;value.dir='auto';
      item.append(label,value);grid.append(item);
    });

    container.append(head,grid);container.hidden=false;
  }

  async function refresh(){
    if(pending)return;pending=true;
    // No stale cache/fallback: an owner-hidden value must not reappear offline.
    container.replaceChildren();container.hidden=true;
    try{
      const cfg=window.FLOWER_LIGHT_SUPABASE;
      const response=await fetch(`${cfg.url}/rest/v1/rpc/get_public_business_privacy`,{method:'POST',headers:{apikey:cfg.anonKey,'Content-Type':'application/json'},body:'{}',cache:'no-store'});
      if(!response.ok)throw new Error('Settings unavailable');
      render(await response.json());
      if(status){status.textContent='';status.hidden=true;}
    }catch(e){if(status){status.textContent='تعذر تحميل بيانات المنشأة حالياً. أعد المحاولة لاحقاً.';status.hidden=false;}}
    finally{pending=false;}
  }
  void refresh();window.addEventListener('pageshow',()=>void refresh());
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refresh();});
})();
