// Flower Light admin — Customer leads section (module split, part 2)
//
// Moved verbatim from admin.js (no logic changes): loading, search, pagination,
// VCF export and deletion of customer_leads. Classic script, loaded right after
// admin.js on ?admin= pages only. It needs window.FL_ADMIN_CORE; if that is
// missing it no-ops, so a load-order mistake only disables the leads tab.

(() => {
  'use strict';
  const core = window.FL_ADMIN_CORE;
  if (!core) {
    console.error('[admin-leads] window.FL_ADMIN_CORE is missing — admin.js must load before admin-leads.js.');
    return;
  }
  const { esc, notify, layout, shell, body, allowedAdminViews, leadPhoneDigits, normalizeLeadPhone, vcardEscape } = core;
  const getDb = () => core.db;
  // The code below was written against a `db` constant; this keeps it unchanged and always live.
  const db = new Proxy({}, { get: (_, prop) => { const real = getDb(); const v = real[prop]; return typeof v === 'function' ? v.bind(real) : v; } });

  const LEADS_PAGE_SIZE=100;
  let leads=[];
  let leadsTotalCount=0;
  let leadsAllTotalCount=0;
  let leadsHasMore=false;
  let leadsLoading=false;
  let leadsSearchTerm='';
  let retentionMaintenanceAttempted=false;

  function sanitizeLeadSearch(value){
    return String(value||'').replace(/[,%()*]/g,' ').replace(/\s+/g,' ').trim().slice(0,80);
  }

  function applyLeadSearch(builder,term){
    const q=sanitizeLeadSearch(term);
    if(!q)return builder;
    return builder.or(`full_name.ilike.%${q}%,company_name.ilike.%${q}%,mobile.ilike.%${q}%`);
  }

  async function loadLeadsPage({reset=true,searchTerm=leadsSearchTerm}={}){
    if(!allowedAdminViews().has('leads')){leads=[];leadsTotalCount=0;leadsAllTotalCount=0;leadsHasMore=false;return;}
    if(leadsLoading)return;
    leadsLoading=true;
    try{
      if(!retentionMaintenanceAttempted){
        retentionMaintenanceAttempted=true;
        try{await db.rpc('purge_expired_customer_leads');}catch(_){}
      }
      const normalized=sanitizeLeadSearch(searchTerm);
      if(reset)leadsSearchTerm=normalized;
      const offset=reset?0:leads.length;
      let query=db.from('customer_leads')
        .select('id,full_name,company_name,mobile,created_at',{count:'exact'})
        .order('created_at',{ascending:false})
        .range(offset,offset+LEADS_PAGE_SIZE-1);
      query=applyLeadSearch(query,reset?normalized:leadsSearchTerm);
      const {data,error,count}=await query;
      if(error)throw error;
      const rows=Array.isArray(data)?data:[];
      if(reset)leads=rows;
      else{
        const seen=new Set(leads.map(item=>String(item.id)));
        leads=[...leads,...rows.filter(item=>!seen.has(String(item.id)))];
      }
      leadsTotalCount=Number.isFinite(Number(count))?Number(count):leads.length;
      if(!leadsSearchTerm)leadsAllTotalCount=leadsTotalCount;
      leadsHasMore=leads.length<leadsTotalCount && rows.length>0;
    }finally{leadsLoading=false;}
  }

  function leadDate(value){
    if(!value)return '';
    try{return new Intl.DateTimeFormat('ar-SA',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value));}catch(_){return String(value);}
  }
  function leadVCard(lead){
    const fullName=String(lead.full_name||'').trim() || 'Customer';
    const company=String(lead.company_name||'').trim();
    const phone=normalizeLeadPhone(lead.mobile);
    const tel=phone?`+${phone}`:String(lead.mobile||'').trim();
    const name=vcardEscape(fullName);
    // Minimal vCard 3.0: safest common subset for iPhone, Android and Samsung Contacts.
    return [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `N:;${name};;;`,
      `FN:${name}`,
      company?`ORG:${vcardEscape(company)}`:'',
      tel?`TEL;TYPE=CELL:${vcardEscape(tel)}`:'',
      'END:VCARD'
    ].filter(Boolean).join('\r\n');
  }
  function uniqueLeadsForExport(list){
    const seen=new Set();const out=[];
    (list||[]).forEach(lead=>{const key=normalizeLeadPhone(lead.mobile)||String(lead.id||'');if(seen.has(key))return;seen.add(key);out.push(lead);});
    return out;
  }
  function downloadLeadsVcf(list=leads,filename='flower-light-customers.vcf'){
    const exportList=uniqueLeadsForExport(list);
    if(!exportList.length){notify('لا توجد جهات اتصال للتحميل');return;}
    // No BOM. Keep cards contiguous and terminate the file with CRLF for iOS/Android importers.
    const content=exportList.map(leadVCard).join('\r\n')+'\r\n';
    const blob=new Blob([content],{type:'text/x-vcard;charset=utf-8'});const url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function leadRows(list){
    if(!list.length)return '<div class="fl-cloud-empty">لم يسجل أي عميل بياناته بعد.</div>';
    return `<div class="fl-cloud-list">${list.map(lead=>`<div class="fl-cloud-row"><div class="fl-cloud-row-meta"><strong>${esc(lead.full_name||'بدون اسم')}</strong><span class="fl-lead-company">${esc(lead.company_name||'')}</span><a class="fl-lead-phone" href="tel:${esc(leadPhoneDigits(lead.mobile))}">${esc(lead.mobile||'')}</a><small class="fl-lead-date">${esc(leadDate(lead.created_at))}</small></div><div class="fl-cloud-row-actions"><button class="fl-cloud-mini green" data-lead-vcf="${lead.id}" type="button">VCF</button><button class="fl-cloud-mini red" data-lead-delete="${lead.id}" type="button">حذف</button></div></div>`).join('')}</div>`;
  }
  async function fetchAllLeads({idsOnly=false,searchTerm=''}={}){
    const rows=[];
    const pageSize=1000;
    for(let offset=0;;offset+=pageSize){
      let query=db.from('customer_leads')
        .select(idsOnly?'id':'id,full_name,company_name,mobile,created_at')
        .order('created_at',{ascending:false})
        .range(offset,offset+pageSize-1);
      query=applyLeadSearch(query,searchTerm);
      const {data,error}=await query;
      if(error)throw error;
      const page=Array.isArray(data)?data:[];
      rows.push(...page);
      if(page.length<pageSize)break;
    }
    return rows;
  }

  async function loadMoreLeads(){
    if(leadsLoading||!leadsHasMore)return;
    const button=document.getElementById('flLoadMoreLeads');
    if(button){rememberButtonHtml(button);button.disabled=true;button.innerHTML='<span class="fl-btn-icon">⏳</span><span>جاري التحميل...</span>';}
    const scrollTop=shell.scrollTop;
    try{
      await loadLeadsPage({reset:false});
      renderLeads();
      requestAnimationFrame(()=>{shell.scrollTop=scrollTop;});
    }catch(error){
      notify('تعذر تحميل المزيد: '+(error?.message||error));
      if(button){button.disabled=false;restoreButtonHtml(button,'تحميل المزيد');}
    }
  }

  function rememberButtonHtml(button){
    if(button && !button.dataset.originalHtml)button.dataset.originalHtml=button.innerHTML;
  }
  function restoreButtonHtml(button,fallbackText=""){
    if(!button)return;
    button.innerHTML=button.dataset.originalHtml||fallbackText;
  }

  async function exportAllLeads(){
    const button=document.getElementById('flDownloadAllLeads');
    rememberButtonHtml(button);
    if(button){button.disabled=true;button.innerHTML='<span class="fl-btn-icon">⏳</span><span>جاري تجهيز الملف...</span>';}
    try{
      const all=await fetchAllLeads();
      if(!all.length){notify('لا توجد جهات اتصال للتصدير');return;}
      downloadLeadsVcf(all,`flower-light-customers-${new Date().toISOString().slice(0,10)}.vcf`);
      notify(`تم تجهيز ${all.length} جهة اتصال`);
    }catch(error){notify('تعذر تجهيز ملف جهات الاتصال: '+(error?.message||error));}
    finally{if(button){button.disabled=false;restoreButtonHtml(button,'تحميل الكل VCF');}}
  }

  function renderLeads(){
    const uniqueCount=uniqueLeadsForExport(leads).length;
    const totalAll=leadsAllTotalCount||(!leadsSearchTerm?leadsTotalCount:0);
    const filteredLabel=leadsSearchTerm?`نتائج البحث: ${leadsTotalCount}`:`المعروض: ${leads.length} من ${leadsTotalCount}`;
    const searchNote=leadsSearchTerm?`<div class="fl-cloud-note ok">البحث الحالي: <b>${esc(leadsSearchTerm)}</b> · ${Number(leadsTotalCount).toLocaleString('ar-SA')} نتيجة</div>`:'';
    layout(`<div class="fl-cloud-head fl-lead-toolbar"><div><h2>جهات اتصال العملاء</h2><p>يتم تحميل أحدث ${LEADS_PAGE_SIZE} سجل فقط في البداية لتبقى اللوحة سريعة، ثم يمكنك تحميل المزيد عند الحاجة.</p></div><div class="fl-lead-toolbar-actions"><button class="fl-cloud-btn success" id="flDownloadAllLeads" type="button" ${totalAll?'':'disabled'}><span class="fl-btn-icon">⬇️</span><span>تحميل الكل VCF</span></button><button class="fl-cloud-btn danger" id="flDeleteAllLeads" type="button" ${totalAll?'':'disabled'}><span class="fl-btn-icon">🗑️</span><span>حذف الكل</span></button></div></div>
      <div class="fl-cloud-card fl-lead-search-card"><form id="flLeadSearchForm" class="fl-lead-search-form"><div class="fl-lead-search-input-wrap"><input id="flLeadSearchInput" class="fl-lead-search-input" type="search" inputmode="search" value="${esc(leadsSearchTerm)}" placeholder="ابحث بالاسم أو الشركة أو رقم الجوال"></div><button class="fl-cloud-btn primary" type="submit"><span class="fl-btn-icon">🔎</span><span>بحث</span></button>${leadsSearchTerm?'<button class="fl-cloud-btn secondary" id="flLeadSearchClear" type="button"><span class="fl-btn-icon">✕</span><span>مسح البحث</span></button>':''}</form></div>
      ${searchNote}
      <div class="fl-lead-stats"><div class="fl-lead-stat"><strong>${Number(totalAll).toLocaleString('ar-SA')}</strong><span>إجمالي التسجيلات</span></div><div class="fl-lead-stat"><strong>${Number(leads.length).toLocaleString('ar-SA')}</strong><span>${esc(filteredLabel)}</span></div><div class="fl-lead-stat"><strong>${Number(uniqueCount).toLocaleString('ar-SA')}</strong><span>أرقام فريدة في المعروض</span></div></div>
      <div class="fl-cloud-card">${leadRows(leads)}${leadsHasMore?`<div class="fl-cloud-actions" style="justify-content:center;margin-top:14px"><button class="fl-cloud-btn secondary" id="flLoadMoreLeads" type="button"><span class="fl-btn-icon">＋</span><span>تحميل المزيد (${Math.min(LEADS_PAGE_SIZE,Math.max(0,leadsTotalCount-leads.length))})</span></button></div>`:''}</div>`);
    document.getElementById('flDownloadAllLeads')?.addEventListener('click',exportAllLeads);
    document.getElementById('flDeleteAllLeads')?.addEventListener('click',deleteAllLeads);
    document.getElementById('flLoadMoreLeads')?.addEventListener('click',loadMoreLeads);
    document.getElementById('flLeadSearchForm')?.addEventListener('submit',async event=>{
      event.preventDefault();
      const input=document.getElementById('flLeadSearchInput');
      const term=sanitizeLeadSearch(input?.value||'');
      try{await loadLeadsPage({reset:true,searchTerm:term});renderLeads();}
      catch(error){notify('تعذر البحث: '+(error?.message||error));}
    });
    document.getElementById('flLeadSearchClear')?.addEventListener('click',async()=>{
      try{await loadLeadsPage({reset:true,searchTerm:''});renderLeads();}
      catch(error){notify('تعذر تحديث القائمة: '+(error?.message||error));}
    });
    body.querySelectorAll('[data-lead-vcf]').forEach(b=>b.addEventListener('click',()=>{const lead=leads.find(x=>x.id===b.dataset.leadVcf);if(lead){const phone=normalizeLeadPhone(lead.mobile)||String(lead.id||'').slice(0,8);downloadLeadsVcf([lead],`customer-${phone}.vcf`);}}));
    body.querySelectorAll('[data-lead-delete]').forEach(b=>b.addEventListener('click',()=>deleteLead(b.dataset.leadDelete)));
  }

  async function deleteAllLeads(){
    const total=leadsAllTotalCount||leadsTotalCount;
    if(!total)return;
    if(!confirm(`سيتم حذف جميع جهات اتصال العملاء (${total}) نهائيًا، وليس فقط السجلات المعروضة الآن. هل تريد المتابعة؟`))return;
    const button=document.getElementById('flDeleteAllLeads');
    rememberButtonHtml(button);
    if(button){button.disabled=true;button.innerHTML='<span class="fl-btn-icon">⏳</span><span>جاري الحذف...</span>';}
    try{
      const allIds=await fetchAllLeads({idsOnly:true});
      for(let i=0;i<allIds.length;i+=100){
        const batch=allIds.slice(i,i+100).map(item=>item.id).filter(Boolean);
        if(!batch.length)continue;
        const {error}=await db.from('customer_leads').delete().in('id',batch);
        if(error)throw error;
      }
      leads=[];leadsTotalCount=0;leadsAllTotalCount=0;leadsHasMore=false;leadsSearchTerm='';
      renderLeads();notify('تم حذف جميع جهات اتصال العملاء');
    }catch(error){
      notify('تعذر حذف جهات الاتصال: '+(error?.message||error));
      if(button){button.disabled=false;restoreButtonHtml(button,'حذف الكل');}
    }
  }

  async function deleteLead(id){
    const lead=leads.find(x=>x.id===id);if(!lead||!confirm(`حذف جهة اتصال «${lead.full_name||'العميل'}»؟`))return;
    const {error}=await db.from('customer_leads').delete().eq('id',id);if(error){notify('تعذر الحذف: '+error.message);return;}
    leads=leads.filter(item=>item.id!==id);
    leadsTotalCount=Math.max(0,leadsTotalCount-1);
    leadsAllTotalCount=Math.max(0,leadsAllTotalCount-1);
    leadsHasMore=leads.length<leadsTotalCount;
    renderLeads();notify('تم حذف جهة اتصال العميل');
  }

  window.FL_ADMIN_LEADS = {
    renderLeads,
    loadLeadsPage,
    totalForStats(){ return leadsAllTotalCount||leadsTotalCount; },
  };
})();
