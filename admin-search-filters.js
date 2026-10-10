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
    {key:'availability',label:'حالة التوفر',hint:'متوفر / نفد / قريبًا'},
    ...(core.PRODUCT_SPEC_FIELDS||[]).map(field=>({key:field.key,label:field.label,hint:'القيم الموجودة فعليًا في المنتجات'}))
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
  const allKeys=()=>new Set([...standardOptions().map(row=>row.key),...customFilters.map(row=>row.key)]);
  const normalizeSelected=value=>{
    const allowed=allKeys();
    return Array.isArray(value)?[...new Set(value.map(String).filter(key=>allowed.has(key)))]:DEFAULT_KEYS.filter(key=>allowed.has(key));
  };
  function publish(){
    window.FLOWER_LIGHT_CUSTOM_FILTERS=customFilters.map(row=>({...row}));
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

  function optionsHtml(){
    const rows=[...standardOptions(),...customFilters.map(row=>({key:row.key,label:row.label,hint:'فلتر خاص أضفته أنت',custom:true}))];
    return rows.map(row=>`<div class="fl-permission-row" data-filter-option="${esc(row.key)}">
      <span class="fl-permission-copy"><strong>${esc(row.label)}</strong><small>${esc(row.hint)}</small></span>
      <label class="fl-cloud-check" style="margin:0"><input type="checkbox" data-search-filter-key="${esc(row.key)}" ${selectedKeys.includes(row.key)?'checked':''} ${settingError?'disabled':''}> إظهار</label>
      ${row.custom?`<button class="fl-cloud-btn secondary" type="button" data-delete-custom-filter="${esc(row.key)}" ${settingError?'disabled':''}>حذف</button>`:''}
    </div>`).join('');
  }

  function render(){
    if(!isPrimaryAdmin)return;
    layout(`<div class="fl-cloud-head"><div><h2>فلاتر البحث</h2><p>اختر الفلاتر التي تظهر للزائر، وأضف فلاتر خاصة بك. خيارات كل فلتر تتغير تلقائيًا حسب الفلاتر الأخرى المختارة في الكتالوج.</p></div></div>
      ${settingError?`<div class="fl-cloud-note bad">تعذر قراءة إعداد فلاتر البحث. شغّل <b>supabase/UPGRADE_EXISTING_V111.sql</b> في Supabase ثم حدّث الصفحة.</div>`:''}
      <section class="fl-cloud-card">
        <div class="fl-credentials-card-head"><div><span class="fl-account-badge owner">الفلاتر الظاهرة</span><h3>اختيار فلاتر البحث</h3></div></div>
        <p>فعّل أي عدد من الفلاتر. إذا ألغيت الجميع سيبقى البحث النصي فقط.</p>
        <div class="fl-catalog-filter-options">${optionsHtml()}</div>
        <div class="fl-cloud-actions"><button class="fl-cloud-btn primary" id="flSearchFiltersSave" type="button" ${settingError?'disabled':''}>حفظ الفلاتر</button></div>
      </section>
      <section class="fl-cloud-card">
        <div class="fl-credentials-card-head"><div><span class="fl-account-badge owner">فلتر خاص</span><h3>إضافة فلتر جديد</h3></div></div>
        <p>مثال: نوع العدسة، طريقة التركيب، شكل الإضاءة. بعد الحفظ سيظهر هذا الفلتر أيضًا ضمن أنواع المواصفات في إضافة/تعديل المنتج.</p>
        <div class="fl-cloud-form"><label class="fl-cloud-field full"><span>اسم الفلتر</span><input id="flCustomFilterLabel" type="text" maxlength="50" placeholder="مثال: نوع العدسة" ${settingError?'disabled':''}><small>أضف قيمة هذا الفلتر لكل منتج من قسم المنتجات، ثم سيعرض الموقع القيم الموجودة تلقائيًا.</small></label></div>
        <div class="fl-cloud-actions"><button class="fl-cloud-btn secondary" id="flCustomFilterAdd" type="button" ${settingError?'disabled':''}>+ إضافة الفلتر</button></div>
      </section>`);
    bind();
  }

  function collectSelected(){
    selectedKeys=[...document.querySelectorAll('[data-search-filter-key]:checked')].map(input=>String(input.dataset.searchFilterKey||'')).filter(key=>allKeys().has(key));
  }

  async function save(){
    if(settingError)return;
    collectSelected();
    const button=document.getElementById('flSearchFiltersSave');
    if(button){button.disabled=true;button.textContent='جاري الحفظ...';}
    try{
      const payload={id:1,catalog_filter_keys:selectedKeys,catalog_custom_filters:customFilters};
      const {error}=await db.from('site_settings').upsert(payload,{onConflict:'id'});
      if(error)throw error;
      publish();
      notify(selectedKeys.length?'تم حفظ فلاتر البحث':'تم إخفاء الفلاتر؛ البحث النصي فقط سيبقى ظاهرًا');
      render();
    }catch(error){
      notify(/42703|PGRST204|PGRST205|42P01/i.test(String(error?.code||''))?'شغّل supabase/UPGRADE_EXISTING_V111.sql في Supabase أولًا.':'تعذر حفظ الفلاتر: '+(error?.message||error));
      if(button){button.disabled=false;button.textContent='حفظ الفلاتر';}
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
    collectSelected();
    customFilters.push({key,label});
    selectedKeys.push(key);
    publish();
    render();
    notify('تمت إضافة الفلتر محليًا؛ اضغط «حفظ الفلاتر» لتثبيته');
  }

  function deleteCustomFilter(key){
    const row=customFilters.find(item=>item.key===key);
    if(!row)return;
    if(!confirm(`حذف الفلتر «${row.label}» من قائمة الفلاتر؟ لن تُحذف القيم المحفوظة داخل المنتجات.`))return;
    collectSelected();
    customFilters=customFilters.filter(item=>item.key!==key);
    selectedKeys=selectedKeys.filter(item=>item!==key);
    publish();
    render();
  }

  function bind(){
    document.getElementById('flSearchFiltersSave')?.addEventListener('click',save);
    document.getElementById('flCustomFilterAdd')?.addEventListener('click',addCustomFilter);
    document.getElementById('flCustomFilterLabel')?.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();addCustomFilter();}});
    document.querySelectorAll('[data-delete-custom-filter]').forEach(button=>button.addEventListener('click',()=>deleteCustomFilter(String(button.dataset.deleteCustomFilter||''))));
  }

  window.FL_ADMIN_SEARCH_FILTERS={load,render};
})();
