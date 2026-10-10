// Flower Light admin — dedicated search/filter configuration.
(() => {
  'use strict';
  const core=window.FL_ADMIN_CORE;
  if(!core){console.error('[admin-search-filters] FL_ADMIN_CORE missing');return;}
  const {esc,notify,layout,isPrimaryAdmin}=core;
  const db=new Proxy({}, {get:(_,prop)=>{const real=core.db;const value=real[prop];return typeof value==='function'?value.bind(real):value;}});
  const DEFAULT_KEYS=['availability','wattage','cct'];
  const MAX_CUSTOM_FILTERS=20;
  let selectedKeys=DEFAULT_KEYS.slice();
  let customFilters=[];
  let settingError='';

  const standardOptions=()=>[
    {key:'availability',label:'حالة التوفر',hint:'متوفر · نفد · قريبًا'},
    ...(core.PRODUCT_SPEC_FIELDS||[]).map(field=>({key:field.key,label:field.label,hint:'حسب قيم المنتجات'}))
  ];
  const normalizeLabel=value=>String(value||'').trim().replace(/\s+/g,' ');
  const labelToken=value=>normalizeLabel(value).toLowerCase().replace(/[\u064B-\u0652]/g,'').replace(/[إأآا]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه');
  const normalizeCustomFilters=value=>{
    if(!Array.isArray(value))return[];
    const seen=new Set(),out=[];
    for(const row of value){
      const key=String(row?.key||'').trim();
      const label=normalizeLabel(row?.label);
      if(!/^custom_filter_[a-z0-9]+$/i.test(key)||!label||seen.has(key))continue;
      seen.add(key);out.push({key,label});
      if(out.length>=MAX_CUSTOM_FILTERS)break;
    }
    return out;
  };
  const allRows=()=>[
    ...standardOptions(),
    ...customFilters.map(row=>({key:row.key,label:row.label,hint:'فلتر خاص',custom:true}))
  ];
  const allKeys=()=>new Set(allRows().map(row=>row.key));
  const normalizeSelected=value=>{
    const allowed=allKeys();
    return Array.isArray(value)?[...new Set(value.map(String).filter(key=>allowed.has(key)))]:DEFAULT_KEYS.filter(key=>allowed.has(key));
  };
  const orderedRows=()=>{
    const rows=allRows(),byKey=new Map(rows.map(row=>[row.key,row]));
    const active=selectedKeys.map(key=>byKey.get(key)).filter(Boolean);
    const activeSet=new Set(active.map(row=>row.key));
    return [...active,...rows.filter(row=>!activeSet.has(row.key))];
  };
  function publishCustomDefinitions(){
    window.FLOWER_LIGHT_CUSTOM_FILTERS=customFilters.map(row=>({...row}));
  }
  function publish(){
    publishCustomDefinitions();
    window.FLOWER_LIGHT_SITE_SETTINGS={
      ...(window.FLOWER_LIGHT_SITE_SETTINGS||{}),
      catalog_filter_keys:selectedKeys.slice(),
      catalog_custom_filters:customFilters.map(row=>({...row}))
    };
    try{window.dispatchEvent(new CustomEvent('flowerlight:site-settings',{detail:window.FLOWER_LIGHT_SITE_SETTINGS}));}catch(_){}
  }

  async function load(){
    if(!isPrimaryAdmin)return;
    settingError='';
    try{
      const {data,error}=await db.from('site_settings').select('catalog_filter_keys,catalog_custom_filters').eq('id',1).maybeSingle();
      if(error)throw error;
      customFilters=normalizeCustomFilters(data?.catalog_custom_filters);
      selectedKeys=normalizeSelected(data?.catalog_filter_keys);
      publish();
    }catch(error){
      customFilters=[];
      selectedKeys=DEFAULT_KEYS.slice();
      publish();
      settingError=String(error?.message||error||'');
    }
  }

  function toggleStyle(on){
    return `position:relative;width:44px;height:26px;border:0;border-radius:999px;padding:0;background:${on?'#f0a915':'#dbe1e8'};cursor:pointer;box-shadow:inset 0 0 0 1px ${on?'rgba(154,101,0,.12)':'rgba(100,116,139,.14)'};transition:background .18s ease;flex:0 0 44px`;
  }
  function toggleLabel(on){
    return `<span aria-hidden="true" style="position:absolute;top:3px;${on?'left:3px':'right:3px'};width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 1px 4px rgba(15,23,42,.2)"></span>`;
  }
  function orderButton(id,label,disabled,symbol){
    return `<button id="${id}" type="button" aria-label="${esc(label)}" title="${esc(label)}" ${disabled?'disabled':''} style="width:32px;height:32px;border:1px solid #dfe5ed;border-radius:9px;background:#fff;color:#56647a;font-size:14px;font-weight:900;display:grid;place-items:center;padding:0;cursor:pointer">${symbol}</button>`;
  }
  function filterRowHtml(row,on,position,activeCount){
    const controls=on?`<div style="display:flex;gap:4px;align-items:center;flex:0 0 auto">
      <span aria-label="الترتيب ${position+1}" title="الترتيب ${position+1}" style="width:27px;height:27px;border-radius:8px;background:#fff8ec;color:#9a6500;border:1px solid #efd39a;display:grid;place-items:center;font-size:11px;font-weight:900">${position+1}</span>
      ${orderButton(`flSearchFilterUp_${esc(row.key)}`,`تحريك ${row.label} للأعلى`,position<=0,'▲')}
      ${orderButton(`flSearchFilterDown_${esc(row.key)}`,`تحريك ${row.label} للأسفل`,position<0||position>=activeCount-1,'▼')}
    </div>`:'';
    return `<div class="fl-permission-row" data-filter-option="${esc(row.key)}" style="min-height:56px;padding:8px 10px;cursor:default;flex-wrap:wrap;background:${on?'#fffdf8':'#fbfcfe'};border-color:${on?'#f0ddb8':'#e7ebf1'}">
      <span class="fl-permission-copy" style="min-width:120px;flex:1 1 150px"><strong>${esc(row.label)}</strong><small>${esc(row.hint)}</small></span>
      <div style="display:flex;gap:6px;align-items:center;justify-content:flex-end;flex:0 0 auto">
        ${controls}
        <button id="flSearchFilterToggle_${esc(row.key)}" type="button" role="switch" aria-checked="${on?'true':'false'}" aria-label="${on?'إيقاف':'تشغيل'} ${esc(row.label)}" ${settingError?'disabled':''} style="${toggleStyle(on)}">${toggleLabel(on)}</button>
        ${row.custom?`<button id="flDeleteCustomFilter_${esc(row.key)}" type="button" aria-label="حذف ${esc(row.label)}" title="حذف" ${settingError?'disabled':''} style="height:32px;border:1px solid #efd0d0;border-radius:9px;background:#fff;color:#a33b3b;padding:0 9px;font:inherit;font-size:11px;font-weight:850;cursor:pointer">حذف</button>`:''}
      </div>
    </div>`;
  }
  function filterGroupHtml(title,rows,on){
    if(!rows.length)return'';
    return `<div style="display:grid;gap:7px">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:2px 2px 0;color:${on?'#8f5b00':'#7b8598'}">
        <strong style="font-size:12px">${title}</strong><span style="font-size:11px;font-weight:800">${rows.length}</span>
      </div>
      <div style="display:grid;gap:7px">${rows.map(row=>filterRowHtml(row,on,selectedKeys.indexOf(row.key),selectedKeys.length)).join('')}</div>
    </div>`;
  }
  function optionsHtml(){
    const rows=orderedRows(),active=rows.filter(row=>selectedKeys.includes(row.key)),inactive=rows.filter(row=>!selectedKeys.includes(row.key));
    return `<div style="display:grid;gap:14px">${filterGroupHtml('مفعلة',active,true)}${filterGroupHtml('متوقفة',inactive,false)}</div>`;
  }

  function render(){
    if(!isPrimaryAdmin)return;
    layout(`<div class="fl-cloud-head"><div><h2>فلاتر البحث</h2><p>تحكم بما يظهر للزائر ورتّب الفلاتر المفعلة كما تريد.</p></div></div>
      ${settingError?`<div class="fl-cloud-note bad">تعذر قراءة إعداد فلاتر البحث. شغّل <b>supabase/UPGRADE_EXISTING_V111.sql</b> في Supabase ثم حدّث الصفحة.</div>`:''}
      <section class="fl-cloud-card">
        <div class="fl-credentials-card-head"><div><span class="fl-account-badge owner">الفلاتر الظاهرة</span><h3>تشغيل وترتيب الفلاتر</h3></div></div>
        <p>الفلاتر المفعلة في الأعلى. استخدم السويتش للتشغيل والإيقاف، والسهمين لتغيير ترتيب الظهور.</p>
        <div class="fl-catalog-filter-options">${optionsHtml()}</div>
        <div class="fl-cloud-actions"><button class="fl-cloud-btn primary" id="flSearchFiltersSave" type="button" ${settingError?'disabled':''}>حفظ الفلاتر والترتيب</button></div>
      </section>
      <section class="fl-cloud-card">
        <div class="fl-credentials-card-head"><div><span class="fl-account-badge owner">فلتر خاص</span><h3>إضافة فلتر جديد</h3></div></div>
        <p>مثال: نوع العدسة، طريقة التركيب، شكل الإضاءة. بعد الحفظ سيظهر هذا الفلتر أيضًا ضمن أنواع المواصفات في إضافة/تعديل المنتج.</p>
        <div class="fl-cloud-form"><label class="fl-cloud-field full"><span>اسم الفلتر</span><input id="flCustomFilterLabel" type="text" maxlength="50" placeholder="مثال: نوع العدسة" ${settingError?'disabled':''}><small>أضف قيمة هذا الفلتر لكل منتج من قسم المنتجات، ثم سيعرض الموقع القيم الموجودة تلقائيًا.</small></label></div>
        <div class="fl-cloud-actions"><button class="fl-cloud-btn secondary" id="flCustomFilterAdd" type="button" ${settingError?'disabled':''}>+ إضافة الفلتر</button></div>
      </section>`);
    bind();
  }

  function toggleFilter(key){
    if(settingError||!allKeys().has(key))return;
    const index=selectedKeys.indexOf(key);
    if(index>=0)selectedKeys.splice(index,1);
    else selectedKeys.push(key);
    render();
  }
  function moveFilter(key,delta){
    const index=selectedKeys.indexOf(key),next=index+delta;
    if(index<0||next<0||next>=selectedKeys.length)return;
    [selectedKeys[index],selectedKeys[next]]=[selectedKeys[next],selectedKeys[index]];
    render();
  }

  async function save(){
    if(settingError)return;
    const button=document.getElementById('flSearchFiltersSave');
    if(button){button.disabled=true;button.textContent='جاري الحفظ...';}
    try{
      const payload={id:1,catalog_filter_keys:selectedKeys.slice(),catalog_custom_filters:customFilters};
      const {error}=await db.from('site_settings').upsert(payload,{onConflict:'id'});
      if(error)throw error;
      publish();
      notify(selectedKeys.length?'تم حفظ تشغيل الفلاتر وترتيبها':'تم إيقاف جميع الفلاتر؛ البحث النصي فقط سيبقى ظاهرًا');
      render();
    }catch(error){
      notify(/42703|PGRST204|PGRST205|42P01/i.test(String(error?.code||''))?'شغّل supabase/UPGRADE_EXISTING_V111.sql في Supabase أولًا.':'تعذر حفظ الفلاتر: '+(error?.message||error));
      if(button){button.disabled=false;button.textContent='حفظ الفلاتر والترتيب';}
    }
  }

  function addCustomFilter(){
    if(settingError)return;
    const input=document.getElementById('flCustomFilterLabel');
    const label=normalizeLabel(input?.value);
    if(!label){notify('اكتب اسم الفلتر أولًا');return;}
    if(customFilters.length>=MAX_CUSTOM_FILTERS){notify('الحد الأقصى 20 فلترًا خاصًا');return;}
    const token=labelToken(label);
    const duplicate=[...standardOptions(),...customFilters].some(row=>labelToken(row.label)===token);
    if(duplicate){notify('يوجد فلتر بهذا الاسم مسبقًا');return;}
    const key=`custom_filter_${(crypto.randomUUID?.()||String(Date.now())).replace(/-/g,'').slice(0,16).toLowerCase()}`;
    customFilters.push({key,label});
    selectedKeys.push(key);
    publishCustomDefinitions();
    render();
    notify('تمت إضافة الفلتر وتشغيله؛ رتّبه ثم اضغط «حفظ الفلاتر والترتيب»');
  }

  function deleteCustomFilter(key){
    const row=customFilters.find(item=>item.key===key);
    if(!row)return;
    if(!confirm(`حذف الفلتر «${row.label}» من قائمة الفلاتر؟ لن تُحذف القيم المحفوظة داخل المنتجات.`))return;
    customFilters=customFilters.filter(item=>item.key!==key);
    selectedKeys=selectedKeys.filter(item=>item!==key);
    publishCustomDefinitions();
    render();
  }

  function bind(){
    document.getElementById('flSearchFiltersSave')?.addEventListener('click',save);
    document.getElementById('flCustomFilterAdd')?.addEventListener('click',addCustomFilter);
    document.getElementById('flCustomFilterLabel')?.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();addCustomFilter();}});
    orderedRows().forEach(row=>{
      document.getElementById(`flSearchFilterToggle_${row.key}`)?.addEventListener('click',()=>toggleFilter(row.key));
      document.getElementById(`flSearchFilterUp_${row.key}`)?.addEventListener('click',()=>moveFilter(row.key,-1));
      document.getElementById(`flSearchFilterDown_${row.key}`)?.addEventListener('click',()=>moveFilter(row.key,1));
      if(row.custom)document.getElementById(`flDeleteCustomFilter_${row.key}`)?.addEventListener('click',()=>deleteCustomFilter(row.key));
    });
  }

  window.FL_ADMIN_SEARCH_FILTERS={load,render};
})();
