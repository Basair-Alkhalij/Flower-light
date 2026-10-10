// Flower Light / Basair Gulf Supabase public sync — final release.
// ?admin=1 requires the Owner role; ?admin=2 requires the linked Sub-admin role.
// Permissions are enforced in both this interface and Supabase RLS/RPC policies.

// Supabase settings live in config.js (loaded before this file).

(() => {
  'use strict';
  const cfg = window.FLOWER_LIGHT_SUPABASE || {};
  const configured = /^https:\/\/.+\.supabase\.co$/i.test(String(cfg.url || '').trim()) && String(cfg.anonKey || '').trim() && !String(cfg.anonKey).includes('YOUR_');
  let db = null;
  if (configured && window.supabase?.createClient) {
    db = window.supabase.createClient(String(cfg.url).trim(), String(cfg.anonKey).trim(), { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  }
  window.flSupabase = db;

  const adminPanel = new URLSearchParams(location.search).get('admin');
  const adminMode = adminPanel === '1' || adminPanel === '2';
  const isPrimaryAdmin = adminPanel === '1';
  const baseAnalyticsTracker = typeof window.flTrack === 'function' ? window.flTrack : null;
  const analyticsId = (storage,key) => {
    try {
      let value=storage.getItem(key);
      if(!value){value=crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;storage.setItem(key,value);}
      return value;
    } catch (_) {
      return crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }
  };
  const analyticsVisitorId = analyticsId(localStorage,'fl_analytics_visitor_id');
  const analyticsSessionId = analyticsId(sessionStorage,'fl_analytics_session_id');
  const analyticsLabel = (eventName,params={}) => {
    if(eventName==='product_category_view') return String(params.category||'');
    if(eventName==='contact_location') return String(params.label||params.branch||'');
    if(eventName==='product_whatsapp_click' || eventName==='product_image_open') return String(params.product_name||'');
    if(eventName==='catalog_download') return String(params.label||'الكتالوج');
    if(eventName==='contact_phone' || eventName==='contact_whatsapp') return String(params.label||params.source||'');
    return String(params.label||'');
  };
  async function saveAnalyticsEvent(eventName,params={}){
    if(!db || adminMode || !eventName) return;
    try{
      const metadata={};
      ['source','category','panel_id','product_name','product_category','product_model','product_reference','direction','method','label','branch','products_count','failed_images'].forEach(key=>{
        if(params?.[key]!==undefined && params?.[key]!==null) metadata[key]=String(params[key]).slice(0,300);
      });
      const {error}=await db.rpc('log_site_event',{
        p_event_name:String(eventName).slice(0,64),
        p_event_label:analyticsLabel(eventName,params).slice(0,180),
        p_visitor_id:String(analyticsVisitorId).slice(0,80),
        p_session_id:String(analyticsSessionId).slice(0,80),
        p_page_path:String(location.pathname||'/').slice(0,300),
        p_metadata:metadata
      });
      if(error && String(error.code)!=='42883') console.warn('[Site analytics] save failed',error.message||error);
    }catch(error){console.warn('[Site analytics] save failed',error);}
  }
  window.flTrack = function(eventName,params={}){
    // GA4 already sends its automatic page_view; avoid counting it twice there.
    if(eventName!=='page_view'){try{baseAnalyticsTracker?.(eventName,params);}catch(_){}}
    void saveAnalyticsEvent(eventName,params);
  };
  if(db && !adminMode){
    window.setTimeout(()=>window.flTrack('page_view',{source:'public_site'}),0);

    // One delegated listener for every static/dynamic element that declares data-track.
    // Keeping this here makes Supabase analytics work even when GA4 is not configured.
    document.addEventListener('click',event=>{
      const target=event.target.closest?.('[data-track]');
      if(!target)return;
      const params={};
      if(target.dataset.trackLocation)params.location=target.dataset.trackLocation;
      if(target.dataset.trackBranch)params.branch=target.dataset.trackBranch;
      params.label=target.dataset.trackLabel || target.getAttribute('aria-label') || target.textContent?.trim().replace(/\s+/g,' ').slice(0,180) || '';
      if(target.href)params.link_url=target.href;
      window.flTrack(target.dataset.track,params);
    },{capture:true});
  }


  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const leadPhoneDigits = value => String(value || '').replace(/\D/g,'');
  const normalizeLeadPhone = value => {
    let digits=leadPhoneDigits(value);
    if(digits.startsWith('00')) digits=digits.slice(2);
    if(/^05\d{8}$/.test(digits)) return `966${digits.slice(1)}`;
    if(/^5\d{8}$/.test(digits)) return `966${digits}`;
    if(/^96605\d{8}$/.test(digits)) return `966${digits.slice(4)}`;
    return digits;
  };
  const safeFileStem = value => String(value || '').trim().toLowerCase().replace(/[\s_]+/g,'-').replace(/[^a-z0-9\u0600-\u06ff-]/g,'').replace(/-+/g,'-').replace(/^-|-$/g,'') || 'contact';
  const newCategorySlug = () => `section-${(crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`).replace(/-/g,'').slice(0,20)}`;
  const bucket = String(cfg.storageBucket || 'product-images');
  const catalogBucket = 'catalog-files';
  const EMPTY_IMAGE = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800"><rect width="800" height="800" fill="#f2f4f8"/><path d="M210 525l115-125 82 83 85-105 110 147H210z" fill="#c8d0dc"/><circle cx="310" cy="300" r="55" fill="#d8dee7"/><text x="400" y="650" text-anchor="middle" font-family="Arial" font-size="34" fill="#7b8598">No image</text></svg>')}`;
  const isExternalImage = value => /^(https?:|data:|blob:)/i.test(String(value || '').trim());
  const isStoragePath = value => Boolean(value) && !isExternalImage(value);

  const PRODUCT_SPEC_FIELDS = [
    {key:'sku', label:'SKU / كود المنتج', placeholder:'مثال: WL-205'},
    {key:'wattage', label:'القدرة', unit:'W', placeholder:'مثال: 12'},
    {key:'lumens', label:'اللومن', unit:'lm', placeholder:'مثال: 1200'},
    {key:'cct', label:'حرارة اللون', unit:'K', placeholder:'مثال: 3000 / 4000 / 6500'},
    {key:'cri', label:'CRI', placeholder:'مثال: ≥80 أو ≥90'},
    {key:'voltage', label:'الفولت', unit:'V', placeholder:'مثال: 220-240'},
    {key:'ip_rating', label:'درجة الحماية IP', placeholder:'مثال: IP44'},
    {key:'dimensions', label:'المقاس / الأبعاد', placeholder:'مثال: 30 × 12 × 8 سم'},
    {key:'color', label:'اللون', placeholder:'مثال: أسود / ذهبي'},
    {key:'material', label:'الخامة', placeholder:'مثال: ألمنيوم + أكريليك'},
    {key:'beam_angle', label:'زاوية الإضاءة', unit:'°', placeholder:'مثال: 120'},
    {key:'frequency', label:'التردد', unit:'Hz', placeholder:'مثال: 50/60'},
    {key:'warranty', label:'الضمان', placeholder:'مثال: 3 سنوات'},
    {key:'bulb_base', label:'قاعدة اللمبة', placeholder:'مثال: E27 / GU10'},
    {key:'bulb_count', label:'عدد اللمبات', placeholder:'مثال: 6'}
  ];
  const PRODUCT_SPEC_KEYS = new Set(PRODUCT_SPEC_FIELDS.map(field => field.key));

  function normalizeSpecifications(raw){
    let rows=[];
    if(Array.isArray(raw)) rows=raw;
    else if(raw && typeof raw==='object') rows=Object.entries(raw).map(([key,value])=>({key,value}));
    return rows.map((row,index)=>{
      if(!row || typeof row!=='object') return null;
      const key=String(row.key||`custom_${index+1}`).trim();
      const def=PRODUCT_SPEC_FIELDS.find(field=>field.key===key);
      const label=String(row.label||def?.label||key).trim();
      const value=String(row.value??'').trim();
      const unit=String(row.unit||def?.unit||'').trim();
      return label && value ? {key,label,value,unit} : null;
    }).filter(Boolean).slice(0,30);
  }

  function specificationMap(raw){
    const map=new Map();
    normalizeSpecifications(raw).forEach(spec=>map.set(spec.key,spec));
    return map;
  }

  function specificationEditorValue(spec){
    if(!spec) return '';
    return `${String(spec.value||'').trim()}${spec.unit?` ${String(spec.unit).trim()}`:''}`.trim();
  }

  function productSpecEditorRowHtml(spec=null){
    return `<div class="fl-flex-spec-row" data-flex-spec-row>
      <div class="fl-cloud-field"><label>اسم الصفة</label><input data-flex-spec-label value="${esc(spec?.label||'')}" placeholder="مثال: القدرة"></div>
      <div class="fl-cloud-field"><label>القيمة</label><input data-flex-spec-value value="${esc(specificationEditorValue(spec))}" placeholder="مثال: 30W"></div>
      <button class="fl-flex-spec-remove" data-flex-spec-remove type="button" aria-label="حذف الصفة">حذف</button>
    </div>`;
  }

  function productSpecsFormHtml(prod){
    const specs=normalizeSpecifications(prod?.specifications);
    const rows=(specs.length?specs:[null]).map(spec=>productSpecEditorRowHtml(spec)).join('');
    return `<div class="fl-product-spec-section full"><div class="fl-product-spec-head"><div><strong>المواصفات الفنية</strong><small>اكتب اسم الصفة وقيمتها بنفسك، مثل: القدرة — 30W. أضف فقط المواصفات التي تحتاجها.</small></div><button class="fl-cloud-btn fl-add-spec-btn" id="flAddProductSpec" type="button">+ إضافة صفة</button></div><div id="flFlexibleSpecs" class="fl-flex-spec-list">${rows}</div></div>`;
  }

  function collectProductSpecifications(){
    const specs=[];
    document.querySelectorAll('[data-flex-spec-row]').forEach((row,index)=>{
      const label=String(row.querySelector('[data-flex-spec-label]')?.value||'').trim();
      const value=String(row.querySelector('[data-flex-spec-value]')?.value||'').trim();
      if(!label || !value) return;
      specs.push({
        key:`custom_${index+1}`,
        label,
        value,
        unit:'',
      });
    });
    return specs.slice(0,30);
  }

  function productThumbnailPath(path){
    const value=String(path||'');
    return /\.l\.webp(?:$|\?)/i.test(value)?value.replace(/\.l\.webp(?=$|\?)/i,'.s.webp'):value;
  }

  function imageUrl(path){
    if (!path) return EMPTY_IMAGE;
    if (/^(https?:|data:|blob:)/i.test(path)) return path;
    if (!db) return '';
    return db.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  }

  function catalogFileUrl(path){
    const value=String(path||'').trim();
    if(!value) return '';
    if(/^(https?:|data:|blob:)/i.test(value)) return value;
    if(!db) return '';
    return db.storage.from(catalogBucket).getPublicUrl(value).data.publicUrl;
  }

  const contactLabels = {
    phone:'جوال',
    whatsapp:'واتساب',
    website:'الموقع الإلكتروني',
    email:'البريد الإلكتروني',
    location:'الموقع'
  };

  function cleanPhone(value){ return String(value || '').replace(/[^\d+]/g,''); }
  function cleanWhatsApp(value){ return window.flNormalizeWhatsAppNumber ? window.flNormalizeWhatsAppNumber(value) : String(value || '').replace(/\D/g,''); }
  function normalizeWebsite(value){
    const v=String(value||'').trim();
    if(!v) return '';
    return /^https?:\/\//i.test(v) ? v : `https://${v}`;
  }
  function contactHref(item){
    const value=String(item?.value||'').trim();
    if(!value) return '#';
    if(item.type==='phone') return `tel:${cleanPhone(value)}`;
    if(item.type==='whatsapp') return `https://wa.me/${cleanWhatsApp(value)}`;
    if(item.type==='email') return `mailto:${value}`;
    if(item.type==='website' || item.type==='location') return normalizeWebsite(value);
    return '#';
  }
  function contactPhoneKey(value){
    const normalized=cleanWhatsApp(value);
    return normalized || String(value||'').replace(/\D/g,'');
  }
  function groupedPublicContacts(list){
    const result=[];
    const phoneGroups=new Map();
    let locationGroup=null;
    (list||[]).forEach(item=>{
      if(item?.type==='phone' || item?.type==='whatsapp'){
        const key=contactPhoneKey(item.value);
        if(key){
          let group=phoneGroups.get(key);
          if(!group){group={kind:'phone',key,items:[]};phoneGroups.set(key,group);result.push(group);}
          group.items.push(item);
          return;
        }
      }
      if(item?.type==='location'){
        if(!locationGroup){locationGroup={kind:'locations',items:[]};result.push(locationGroup);}
        locationGroup.items.push(item);
        return;
      }
      result.push({kind:'single',item});
    });
    return result;
  }
  const contactChoiceModal=document.getElementById('contactChoiceModal');
  const contactChoiceSubtitle=document.getElementById('contactChoiceSubtitle');
  const contactChoiceCall=document.getElementById('contactChoiceCall');
  const contactChoiceWhatsApp=document.getElementById('contactChoiceWhatsApp');
  const closeContactChoiceButton=document.getElementById('closeContactChoice');
  let contactChoiceLastFocus=null;
  function closeContactChoice(restoreFocus=true){
    if(!contactChoiceModal?.classList.contains('open'))return;
    contactChoiceModal.classList.remove('open');
    contactChoiceModal.setAttribute('aria-hidden','true');
    if(restoreFocus && contactChoiceLastFocus && typeof contactChoiceLastFocus.focus==='function') contactChoiceLastFocus.focus();
  }
  function openContactUrl(url){
    const target=String(url||'').trim();
    if(!target || target==='#') return;
    // Same-tab navigation is the most reliable way to hand tel:, wa.me and maps links to mobile OS/apps.
    window.location.href=target;
  }
  function openContactChoice(group,trigger){
    if(!contactChoiceModal)return;
    const phone=group.items.find(item=>item.type==='phone');
    const whatsapp=group.items.find(item=>item.type==='whatsapp');
    if(!phone || !whatsapp)return;
    const label=phone.label||whatsapp.label||'تواصل';
    const value=phone.value||whatsapp.value||'';
    contactChoiceLastFocus=trigger||document.activeElement;
    if(contactChoiceSubtitle)contactChoiceSubtitle.textContent=`${label} · ${value}`;
    if(contactChoiceCall)contactChoiceCall.href=contactHref(phone);
    if(contactChoiceWhatsApp)contactChoiceWhatsApp.href=contactHref(whatsapp);
    contactChoiceModal.classList.add('open');
    contactChoiceModal.setAttribute('aria-hidden','false');
    window.setTimeout(()=>contactChoiceCall?.focus(),0);
  }
  closeContactChoiceButton?.addEventListener('click',closeContactChoice);
  contactChoiceModal?.addEventListener('click',event=>{if(event.target===contactChoiceModal)closeContactChoice();});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&contactChoiceModal?.classList.contains('open'))closeContactChoice();});
  contactChoiceCall?.addEventListener('click',event=>{
    event.preventDefault();
    const href=contactChoiceCall.getAttribute('href');
    if(typeof window.flTrack==='function')window.flTrack('contact_phone',{source:'combined_contact'});
    closeContactChoice(false);
    openContactUrl(href);
  });
  contactChoiceWhatsApp?.addEventListener('click',event=>{
    event.preventDefault();
    const href=contactChoiceWhatsApp.getAttribute('href');
    if(typeof window.flTrack==='function')window.flTrack('contact_whatsapp',{source:'combined_contact'});
    closeContactChoice(false);
    openContactUrl(href);
  });

  const locationChoiceModal=document.getElementById('locationChoiceModal');
  const locationChoiceList=document.getElementById('locationChoiceList');
  const closeLocationChoiceButton=document.getElementById('closeLocationChoice');
  let locationChoiceLastFocus=null;
  function closeLocationChoice(restoreFocus=true){
    if(!locationChoiceModal?.classList.contains('open'))return;
    locationChoiceModal.classList.remove('open');
    locationChoiceModal.setAttribute('aria-hidden','true');
    if(restoreFocus && locationChoiceLastFocus && typeof locationChoiceLastFocus.focus==='function') locationChoiceLastFocus.focus();
  }
  function openLocationChoice(items,trigger){
    const locations=(items||[]).filter(item=>item?.type==='location' && String(item.value||'').trim());
    if(!locationChoiceModal || !locationChoiceList || !locations.length)return;
    locationChoiceLastFocus=trigger||document.activeElement;
    locationChoiceList.innerHTML=locations.map((item,index)=>`<button class="location-choice-item" type="button" data-location-index="${index}"><span class="location-choice-item-icon">${contactIcon('location')}</span><span><strong>${esc(item.label||`الفرع ${index+1}`)}</strong><small>${esc(item.value)}</small></span><svg class="arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"></path></svg></button>`).join('');
    locationChoiceList.querySelectorAll('[data-location-index]').forEach(button=>{
      button.addEventListener('click',()=>{
        const item=locations[Number(button.dataset.locationIndex)];
        if(!item)return;
        if(typeof window.flTrack==='function')window.flTrack('contact_location',{source:'location_picker',label:item.label||''});
        const href=contactHref(item);
        closeLocationChoice(false);
        openContactUrl(href);
      });
    });
    locationChoiceModal.classList.add('open');
    locationChoiceModal.setAttribute('aria-hidden','false');
    window.setTimeout(()=>locationChoiceList.querySelector('button')?.focus(),0);
  }
  closeLocationChoiceButton?.addEventListener('click',()=>closeLocationChoice());
  locationChoiceModal?.addEventListener('click',event=>{if(event.target===locationChoiceModal)closeLocationChoice();});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&locationChoiceModal?.classList.contains('open'))closeLocationChoice();});

  function contactIcon(type){
    if(type==='phone') return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.69 2.8a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.28-1.28a2 2 0 0 1 2.11-.45c.9.33 1.84.56 2.8.69A2 2 0 0 1 22 16.92z"></path></svg>';
    if(type==='whatsapp') return '<svg viewBox="0 0 24 24" aria-hidden="true" style="fill:currentColor;stroke:none;color:#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.206-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.371-.272.297-1.04 1.016-1.04 2.479s1.065 2.875 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.981.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.9 6.988c-.002 5.45-4.436 9.884-9.888 9.884m8.413-18.297A11.815 11.815 0 0 0 12.055 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.689 1.448h.005c6.557 0 11.893-5.335 11.896-11.893a11.82 11.82 0 0 0-3.488-8.413Z"></path></svg>';
    if(type==='email') return '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"></rect><path d="m3 7 9 6 9-6"></path></svg>';
    if(type==='location') return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"></path><circle cx="12" cy="10" r="2.5"></circle></svg>';
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>';
  }

  function setText(id,value){
    const el=document.getElementById(id); if(!el) return;
    const v=String(value||'').trim(); el.textContent=v; el.hidden=!v;
  }
  function setImage(id,path,alt='',fallback=''){
    const el=document.getElementById(id); if(!el) return;
    if(path){
      el.onerror=fallback?()=>{el.onerror=null;el.src=fallback;el.hidden=false;}:null;
      el.src=imageUrl(path);el.alt=alt;el.hidden=false;
    } else if(fallback){
      el.onerror=null;el.src=fallback;el.alt=alt;el.hidden=false;
    } else {
      el.onerror=null;el.removeAttribute('src');el.alt='';el.hidden=true;
    }
  }

  const BUNDLED_SITE_LOGO=new URL('company-logo.png?v=__FL_VERSION__',document.baseURI).href;
  function bundledSiteLogo(){
    return BUNDLED_SITE_LOGO;
  }

  function renderPublicProfile(){
    const profile=window.FLOWER_LIGHT_PROFILE || {};
    const contacts=(Array.isArray(window.FLOWER_LIGHT_CONTACTS)?window.FLOWER_LIGHT_CONTACTS:[]).filter(c=>c.is_visible!==false && String(c.value||'').trim());
    const brand=String(profile.brand_name||'').trim();
    const company=String(profile.company_name||'').trim();
    const fullName=String(profile.full_name||'').trim();
    const jobAr=String(profile.job_title_ar||'').trim();
    const jobEn=String(profile.job_title_en||'').trim();

    const activeLogo=bundledSiteLogo();
    setImage('siteLogo',activeLogo,brand||company||'Logo');
    setImage('siteWatermark',activeLogo,'');
    setImage('sitePortrait',profile.portrait_path,fullName||'');
    setText('siteBrandName',brand);
    setText('siteCompanyName',company);
    setText('siteFullName',fullName);
    setText('siteJobTitleAr',jobAr);
    setText('siteJobTitleEn',jobEn);

    const brandRow=document.getElementById('siteBrandRow');
    const brandText=document.getElementById('siteBrandText');
    if(brandText) brandText.hidden=!(brand||company);
    if(brandRow) brandRow.hidden=!(brand||company||activeLogo);
    const portraitWrap=document.getElementById('sitePortraitWrap');
    if(portraitWrap) portraitWrap.hidden=!profile.portrait_path;
    const person=document.getElementById('sitePerson');
    if(person) person.hidden=!(fullName||jobAr||jobEn);
    const identity=document.getElementById('siteIdentity');
    if(identity) identity.hidden=!(profile.portrait_path||fullName||jobAr||jobEn);
    const hero=document.getElementById('siteHero');
    if(hero) hero.classList.toggle('profile-empty',!(brand||company||activeLogo||profile.portrait_path||fullName||jobAr||jobEn));

    const displayName=fullName||brand||company||'Digital Business Card';
    document.title=displayName;
    const card=document.getElementById('publicCard');
    if(card) card.setAttribute('aria-label',fullName?`Digital business card for ${fullName}`:'Digital business card');

    const quick=document.getElementById('quickActions');
    if(quick){
      const quickItems=[];
      const firstPhone=contacts.find(c=>c.type==='phone');
      const firstWhatsApp=contacts.find(c=>c.type==='whatsapp');
      const locations=contacts.filter(c=>c.type==='location');
      if(firstPhone)quickItems.push({kind:'direct',item:firstPhone});
      if(firstWhatsApp)quickItems.push({kind:'direct',item:firstWhatsApp});
      if(locations.length)quickItems.push({kind:'locations',items:locations});
      quick.innerHTML=quickItems.map((entry,index)=>{
        if(entry.kind==='locations') return `<button class="action" type="button" data-quick-locations="${index}" aria-label="الموقع الجغرافي، اختر الفرع">${contactIcon('location')}<span>المواقع</span></button>`;
        const item=entry.item;
        return `<a class="action" href="${esc(contactHref(item))}" data-contact-direct="1" data-track="contact_${esc(item.type)}" aria-label="${esc(item.label||contactLabels[item.type]||'Contact')}">${contactIcon(item.type)}<span>${esc(item.label||contactLabels[item.type]||'Contact')}</span></a>`;
      }).join('');
      quick.querySelectorAll('[data-contact-direct]').forEach(link=>link.addEventListener('click',event=>{event.preventDefault();openContactUrl(link.getAttribute('href'));}));
      quick.querySelectorAll('[data-quick-locations]').forEach(button=>button.addEventListener('click',()=>openLocationChoice(locations,button)));
      quick.hidden=!quickItems.length;
    }

    const list=document.getElementById('contactInfoList');
    if(list){
      const displayContacts=groupedPublicContacts(contacts);
      list.innerHTML=displayContacts.map((entry,index)=>{
        if(entry.kind==='locations') {
          const count=entry.items.length;
          return `<button class="info-item" type="button" data-location-choice="${index}" aria-label="الموقع الجغرافي، اختر الفرع"><span class="info-icon">${contactIcon('location')}</span><span class="info-main"><span class="info-label">الموقع الجغرافي</span><span class="info-value">${count>1?`اختر من ${count} فروع`:'اختر الفرع'}</span></span><svg class="arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"></path></svg></button>`;
        }
        if(entry.kind==='single') {
          const item=entry.item;
          return `<a class="info-item" href="${esc(contactHref(item))}" data-contact-direct="1" data-track="contact_${esc(item.type)}"><span class="info-icon">${contactIcon(item.type)}</span><span class="info-main"><span class="info-label">${esc(item.label||contactLabels[item.type]||'Contact')}</span><span class="info-value">${esc(item.value)}</span></span><svg class="arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"></path></svg></a>`;
        }
        const phone=entry.items.find(item=>item.type==='phone');
        const whatsapp=entry.items.find(item=>item.type==='whatsapp');
        if(!(phone&&whatsapp)){
          const item=phone||whatsapp||entry.items[0];
          return `<a class="info-item" href="${esc(contactHref(item))}" ${item.type==='whatsapp'?'target="_blank" rel="noopener noreferrer"':''} data-track="contact_${esc(item.type)}"><span class="info-icon">${contactIcon(item.type)}</span><span class="info-main"><span class="info-label">${esc(item.label||contactLabels[item.type]||'Contact')}</span><span class="info-value">${esc(item.value)}</span></span><svg class="arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"></path></svg></a>`;
        }
        const label=phone.label||whatsapp.label||'تواصل';
        const value=phone.value||whatsapp.value||'';
        return `<button class="info-item" type="button" data-contact-choice="${index}" aria-label="${esc(label)}، اختر اتصال أو واتساب"><span class="info-icon">${contactIcon('phone')}</span><span class="info-main"><span class="info-label">${esc(label)} · اتصال أو واتساب</span><span class="info-value">${esc(value)}</span></span><svg class="arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"></path></svg></button>`;
      }).join('');
      list.querySelectorAll('[data-contact-direct]').forEach(link=>{
        link.addEventListener('click',event=>{event.preventDefault();openContactUrl(link.getAttribute('href'));});
      });
      list.querySelectorAll('[data-location-choice]').forEach(button=>{
        button.addEventListener('click',()=>{const entry=displayContacts[Number(button.dataset.locationChoice)];if(entry?.kind==='locations')openLocationChoice(entry.items,button);});
      });
      list.querySelectorAll('[data-contact-choice]').forEach(button=>{
        button.addEventListener('click',()=>{const entry=displayContacts[Number(button.dataset.contactChoice)];if(entry?.kind==='phone')openContactChoice(entry,button);});
      });
    }
    const title=document.getElementById('contactTitle'); if(title) title.hidden=!contacts.length;

    const save=document.getElementById('saveContact');
    if(save) save.hidden=!(fullName||brand||company||contacts.length);

    const footer=document.getElementById('siteFooter');
    if(footer){const f=[brand||company,'DIGITAL BUSINESS CARD'].filter(Boolean).join(' · ');footer.textContent=f;footer.hidden=!f;}

    const sub=document.getElementById('productsButtonSubtitle');
    if(sub) sub.textContent=(brand||company)?`كتالوج منتجات ${brand||company}`:'تصفح الأقسام والمنتجات';
    const kicker=document.getElementById('catalogKicker');
    if(kicker){kicker.textContent=brand||company;kicker.hidden=!(brand||company);}
    const note=document.getElementById('catalogNote');
    if(note){
      const catalogName=(brand||company)?`أقسام ومنتجات ${brand||company}`:'الأقسام والمنتجات';
      note.textContent=`استعرض ${catalogName}.`;
    }
    window.flRenderProducts?.();
  }


  let publicSiteSettingsPromise=Promise.resolve(false);
  function publishPublicSiteSettings(settings){
    window.FLOWER_LIGHT_SITE_SETTINGS=settings;
    try{window.dispatchEvent(new CustomEvent('flowerlight:site-settings',{detail:settings}));}catch(_){}
  }
  async function loadPublicSiteSettings(){
    const fallback={require_customer_lead:true,master_barcode_path:'',master_barcode_url:'',design_footer_number:'',design_footer_label:'',pwa_install_enabled:false,quote_list_enabled:true};
    if(!db){publishPublicSiteSettings(fallback);return false;}
    try{
      let data=null;
      let result=await db.from('site_settings').select('require_customer_lead,master_barcode_path,design_footer_number,design_footer_label,pwa_install_enabled').eq('id',1).maybeSingle();
      if(result.error&&/42703|PGRST204/i.test(String(result.error?.code||''))){
        // Backward compatibility: keep the site working before the v98 migration is run,
        // but do not show install UI until the new column exists.
        result=await db.from('site_settings').select('require_customer_lead,master_barcode_path,design_footer_number,design_footer_label').eq('id',1).maybeSingle();
        if(result.error)throw result.error;
        data={...(result.data||{}),pwa_install_enabled:false};
      }else{
        if(result.error)throw result.error;
        data=result.data||{};
      }
      let quoteListEnabled=true;
      const quoteResult=await db.from('site_settings').select('quote_list_enabled').eq('id',1).maybeSingle();
      if(quoteResult.error){
        if(!/42703|PGRST204/i.test(String(quoteResult.error?.code||''))){
          console.warn('[Site settings] quote-list visibility load failed; keeping it visible for backward compatibility.',quoteResult.error);
        }
      }else{
        quoteListEnabled=quoteResult.data?.quote_list_enabled!==false;
      }
      const masterBarcodePath=String(data?.master_barcode_path||'').trim();
      publishPublicSiteSettings({
        require_customer_lead:data?.require_customer_lead!==false,
        master_barcode_path:masterBarcodePath,
        master_barcode_url:masterBarcodePath?imageUrl(masterBarcodePath):'',
        design_footer_number:String(data?.design_footer_number||'').trim(),
        design_footer_label:String(data?.design_footer_label||'').trim(),
        pwa_install_enabled:data?.pwa_install_enabled===true,
        quote_list_enabled:quoteListEnabled
      });
      return true;
    }catch(err){
      console.warn('[Site settings] load failed; customer lead gate remains enabled, install prompt hidden, and quote list keeps its backward-compatible default.',err);
      publishPublicSiteSettings(fallback);
      return false;
    }
  }
  window.flLoadPublicSiteSettings=loadPublicSiteSettings;

  async function loadPublicProfile(){
    if(!db){window.FLOWER_LIGHT_PROFILE={};window.FLOWER_LIGHT_CONTACTS=[];renderPublicProfile();return false;}
    try{
      const [{data:profile,error:pe},{data:contacts,error:ce}]=await Promise.all([
        db.from('site_profile').select('*').eq('id',1).maybeSingle(),
        db.from('contact_items').select('*').eq('is_visible',true).order('sort_order',{ascending:true}).order('created_at',{ascending:true})
      ]);
      if(pe||ce) throw pe||ce;
      window.FLOWER_LIGHT_PROFILE=profile||{};
      window.FLOWER_LIGHT_CONTACTS=contacts||[];
      renderPublicProfile();
      return true;
    }catch(err){
      console.warn('[Site profile] load failed',err);
      window.FLOWER_LIGHT_PROFILE={};window.FLOWER_LIGHT_CONTACTS=[];renderPublicProfile();
      return false;
    }
  }
  window.flLoadPublicProfile=loadPublicProfile;

  async function loadPublicSiteCatalog(){
    if(!db){window.FLOWER_LIGHT_SITE_CATALOGS=[];window.FLOWER_LIGHT_SITE_CATALOG={};window.flRenderProducts?.();return false;}
    try{
      const {data,error}=await db.from('site_catalogs').select('*').eq('is_visible',true).order('sort_order',{ascending:true}).order('created_at',{ascending:true});
      if(error) throw error;
      const rows=(Array.isArray(data)?data:[]).map(row=>({
        ...row,
        id:String(row.id||''),
        name:String(row.name||'الكتالوج'),
        description:String(row.description||''),
        pdf_path:String(row.pdf_path||''),
        file_name:String(row.file_name||''),
        pdf_url:row.pdf_path?catalogFileUrl(row.pdf_path):''
      })).filter(row=>row.pdf_url);
      window.FLOWER_LIGHT_SITE_CATALOGS=rows;
      window.FLOWER_LIGHT_SITE_CATALOG=rows[0]||{};
      window.flRenderProducts?.();
      return true;
    }catch(err){
      const code=String(err?.code||'');
      if(code!=='42P01'&&code!=='PGRST205') console.warn('[Site catalogs] load failed',err);
      // Backward-compatible fallback for the legacy single-catalog schema.
      try{
        const {data,error}=await db.from('site_catalog').select('*').eq('id',1).maybeSingle();
        if(error) throw error;
        const row=data||{};
        const legacy=row.pdf_path?{id:'legacy',name:'الكتالوج',description:'',pdf_path:String(row.pdf_path||''),file_name:String(row.file_name||''),pdf_url:catalogFileUrl(row.pdf_path),sort_order:0,is_visible:true}:null;
        window.FLOWER_LIGHT_SITE_CATALOGS=legacy?[legacy]:[];
        window.FLOWER_LIGHT_SITE_CATALOG=legacy||{};
        window.flRenderProducts?.();
        return Boolean(legacy);
      }catch(_){
        window.FLOWER_LIGHT_SITE_CATALOGS=[];window.FLOWER_LIGHT_SITE_CATALOG={};window.flRenderProducts?.();return false;
      }
    }
  }
  window.flLoadPublicSiteCatalog=loadPublicSiteCatalog;

  function vcardEscape(value){return String(value||'').replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');}
  function downloadDynamicVCard(){
    const p=window.FLOWER_LIGHT_PROFILE||{};
    const contacts=(Array.isArray(window.FLOWER_LIGHT_CONTACTS)?window.FLOWER_LIGHT_CONTACTS:[]).filter(c=>c.is_visible!==false&&String(c.value||'').trim());
    const fullName=String(p.full_name||p.brand_name||p.company_name||'Flower Light').trim();
    if(!fullName&&!contacts.length) return;

    const name=vcardEscape(fullName||'Flower Light');
    const lines=['BEGIN:VCARD','VERSION:3.0',`N:;${name};;;`,`FN:${name}`];
    const org=String(p.company_name||p.brand_name||'').trim();
    const title=[p.job_title_ar,p.job_title_en].filter(Boolean).join(' / ').trim();
    if(org) lines.push(`ORG:${vcardEscape(org)}`);
    if(title) lines.push(`TITLE:${vcardEscape(title)}`);

    const seenPhones=new Set();
    contacts.forEach(item=>{
      if(item.type==='phone' || item.type==='whatsapp'){
        let raw=String(item.value||'').trim();
        let digits=raw.replace(/\D/g,'');
        if(digits.startsWith('00')) digits=digits.slice(2);
        if(/^05\d{8}$/.test(digits)) digits=`966${digits.slice(1)}`;
        else if(/^5\d{8}$/.test(digits)) digits=`966${digits}`;
        else if(/^96605\d{8}$/.test(digits)) digits=`966${digits.slice(4)}`;
        if(digits && !seenPhones.has(digits)){
          seenPhones.add(digits);
          lines.push(`TEL;TYPE=CELL:+${digits}`);
        }
      } else if(item.type==='email') {
        lines.push(`EMAIL;TYPE=INTERNET:${vcardEscape(String(item.value||'').trim())}`);
      } else if(item.type==='website') {
        lines.push(`URL:${vcardEscape(normalizeWebsite(item.value))}`);
      }
    });

    lines.push('END:VCARD');
    const content=lines.join('\r\n')+'\r\n';
    const blob=new Blob([content],{type:'text/x-vcard;charset=utf-8'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;
    a.download='flower-light-contact.vcf';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1500);
  }
  document.getElementById('saveContact')?.addEventListener('click',()=>{downloadDynamicVCard();if(typeof window.flTrack==='function')window.flTrack('save_contact',{});});

  const PUBLIC_PAGE_SIZE=500;
  const PUBLIC_MAX_ROWS=50000;
  async function fetchAllRows(queryFactory,label){
    const rows=[];
    for(let from=0;from<PUBLIC_MAX_ROWS;from+=PUBLIC_PAGE_SIZE){
      const {data,error}=await queryFactory().range(from,from+PUBLIC_PAGE_SIZE-1);
      if(error) throw error;
      const batch=Array.isArray(data)?data:[];
      rows.push(...batch);
      if(batch.length<PUBLIC_PAGE_SIZE) return rows;
    }
    throw new Error(`${label||'البيانات'} تجاوزت الحد الآمن للتحميل (${PUBLIC_MAX_ROWS} صف).`);
  }

  async function loadCloudProducts(){
    if (!db) return false;
    try {
      const [visibleCats,visibleProds,galleryResult] = await Promise.all([
        fetchAllRows(()=>db.from('categories').select('*').eq('is_visible',true).order('sort_order',{ascending:true}).order('created_at',{ascending:true}).order('id',{ascending:true}),'التصنيفات'),
        fetchAllRows(()=>db.from('products').select('*').eq('is_visible',true).order('sort_order',{ascending:true}).order('created_at',{ascending:true}).order('id',{ascending:true}),'المنتجات'),
        fetchAllRows(()=>db.from('product_images').select('id,product_id,image_path,sort_order,is_primary,created_at').order('sort_order',{ascending:true}).order('created_at',{ascending:true}).order('id',{ascending:true}),'صور المنتجات')
          .then(data=>({data,error:null})).catch(error=>({data:[],error}))
      ]);
      const galleryRows=galleryResult.data;
      if (galleryResult.error) console.warn('[Site] Product gallery metadata unavailable.', galleryResult.error.message || galleryResult.error);
      const galleryMap = new Map();
      (Array.isArray(galleryRows) ? galleryRows : []).forEach(row=>{
        if(!row?.product_id || !row?.image_path) return;
        if(!galleryMap.has(row.product_id)) galleryMap.set(row.product_id,[]);
        galleryMap.get(row.product_id).push(row);
      });
      const grouped = new Map();
      visibleCats.forEach(c => grouped.set(c.id, []));
      visibleProds.forEach(p => {
        if (!grouped.has(p.category_id)) return;
        let gallery=(galleryMap.get(p.id)||[]).slice().sort((a,b)=>(Number(a.sort_order)||0)-(Number(b.sort_order)||0));
        if(p.image_path && !gallery.some(row=>row.image_path===p.image_path)){
          gallery.unshift({id:'',product_id:p.id,image_path:p.image_path,sort_order:-1,is_primary:true});
        }
        gallery=gallery.slice(0,4);
        let primaryIndex=gallery.findIndex(row=>row.image_path===p.image_path);
        if(primaryIndex<0) primaryIndex=gallery.findIndex(row=>row.is_primary===true);
        if(primaryIndex<0 && gallery.length) primaryIndex=0;
        if(primaryIndex>0){const [primary]=gallery.splice(primaryIndex,1);gallery.unshift(primary);}
        const primaryPath=gallery[0]?.image_path || p.image_path || p.image_url || '';
        grouped.get(p.category_id).push({
          id:p.id, name:p.name || '', model:p.model || '', caption:p.caption || '',
          alt:p.caption || p.name || '', category:'', category_id:p.category_id || '', category_slug:'',
          image:imageUrl(primaryPath), image_thumb:imageUrl(productThumbnailPath(primaryPath)), image_path:primaryPath,
          gallery:gallery.map((row,index)=>({
            id:row.id||'',image_path:row.image_path,image:imageUrl(row.image_path),thumb:imageUrl(productThumbnailPath(row.image_path)),is_primary:index===0,sort_order:index*10
          })),
          specifications:Array.isArray(p.specifications) ? p.specifications : [],
          price:p.price==null?null:Number(p.price),
          wholesale_price:p.wholesale_price==null?null:Number(p.wholesale_price),
          wholesale_min_qty:p.wholesale_min_qty==null?null:Number(p.wholesale_min_qty),
          availability:['available','out_of_stock','coming_soon'].includes(String(p.availability||''))?String(p.availability):'available',
          limited_offer:p.limited_offer===true,
          catalog_pdf_path:'',
          catalog_pdf_url:'',
          sort_order:p.sort_order || 0, is_visible:p.is_visible !== false
        });
      });
      const extraSections = visibleCats.map(c => {
        const items = grouped.get(c.id) || [];
        items.forEach(item => { item.category = c.name; item.category_id = c.id; item.category_slug = c.slug || c.id; });
        return { id:c.id, name:c.name, slug:c.slug, description:c.description || '', sort_order:c.sort_order || 0, items };
      });
      window.FLOWER_LIGHT_PRODUCTS = { catalog: [], chandeliers: [], balfon: [], extraSections };
      window.flRenderProducts?.();
      return true;
    } catch (err) {
      console.warn('[Site] Supabase load failed.', err);
      window.FLOWER_LIGHT_PRODUCTS = { catalog: [], chandeliers: [], balfon: [], extraSections: [] };
      window.flRenderProducts?.();
      return false;
    }
  }
  window.flLoadCloudProducts = loadCloudProducts;

  // Public data starts empty and is populated only from Supabase.
  window.FLOWER_LIGHT_PROFILE = {};
  window.FLOWER_LIGHT_CONTACTS = [];
  window.FLOWER_LIGHT_SITE_CATALOGS = [];
  window.FLOWER_LIGHT_SITE_CATALOG = {};
  window.FLOWER_LIGHT_SITE_SETTINGS = { require_customer_lead: true, master_barcode_path: '', master_barcode_url: '', design_footer_number: '', design_footer_label: '', pwa_install_enabled: false };
  window.FLOWER_LIGHT_PRODUCTS = { catalog: [], chandeliers: [], balfon: [], extraSections: [] };
  renderPublicProfile();
  if (db) { publicSiteSettingsPromise=loadPublicSiteSettings(); loadPublicProfile(); loadPublicSiteCatalog(); loadCloudProducts(); }

  // Customer lead gate: visitors enter their details once before opening products.
  const leadGate=document.getElementById('flLeadGate');
  const leadForm=document.getElementById('flLeadForm');
  const leadClose=document.getElementById('flLeadClose');
  const leadError=document.getElementById('flLeadError');
  const leadSubmit=document.getElementById('flLeadSubmit');
  const leadTurnstile=document.getElementById('flLeadTurnstile');
  const turnstileSiteKey=String(cfg.turnstileSiteKey||'').trim();
  const leadSubmissionFunction=String(cfg.leadSubmissionFunction||'submit-customer-lead').trim()||'submit-customer-lead';
  let leadGatePromise=null;
  let leadGateResolve=null;
  let leadLastFocus=null;
  let turnstileLoadPromise=null;
  let turnstileWidgetId=null;
  let turnstileToken='';
  const leadAccessKey='flower_light_customer_access_v1';
  const leadSubmitKey='flower_light_customer_submit_v1';
  const leadSubmitCooldownMs=30000;
  let leadOpenedAt=0;
  const hasLeadAccess=()=>{try{return localStorage.getItem(leadAccessKey)==='1';}catch(_){return false;}};
  const rememberLeadAccess=()=>{try{localStorage.setItem(leadAccessKey,'1');}catch(_){}};

  function loadTurnstile(){
    if(!turnstileSiteKey)return Promise.resolve(false);
    if(window.turnstile?.render)return Promise.resolve(true);
    if(turnstileLoadPromise)return turnstileLoadPromise;
    turnstileLoadPromise=new Promise((resolve,reject)=>{
      const existing=document.querySelector('script[data-fl-turnstile]');
      const finish=()=>window.turnstile?.render?resolve(true):reject(new Error('Turnstile API unavailable'));
      if(existing){existing.addEventListener('load',finish,{once:true});existing.addEventListener('error',()=>reject(new Error('Turnstile failed to load')),{once:true});return;}
      const script=document.createElement('script');
      script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async=true;script.defer=true;script.dataset.flTurnstile='1';script.referrerPolicy='strict-origin-when-cross-origin';
      script.addEventListener('load',finish,{once:true});script.addEventListener('error',()=>reject(new Error('Turnstile failed to load')),{once:true});
      document.head.appendChild(script);
    }).catch(error=>{turnstileLoadPromise=null;throw error;});
    return turnstileLoadPromise;
  }

  async function ensureTurnstile(){
    if(!turnstileSiteKey||!leadTurnstile)return false;
    leadTurnstile.hidden=false;
    await loadTurnstile();
    if(turnstileWidgetId===null){
      turnstileWidgetId=window.turnstile.render(leadTurnstile,{
        sitekey:turnstileSiteKey,
        action:'customer_lead',
        theme:'auto',
        callback:(token)=>{turnstileToken=String(token||'');leadError?.classList.remove('show');},
        'expired-callback':()=>{turnstileToken='';},
        'error-callback':()=>{turnstileToken='';return true;}
      });
    }
    return true;
  }

  function resetTurnstile(){
    turnstileToken='';
    if(turnstileWidgetId!==null&&window.turnstile?.reset){try{window.turnstile.reset(turnstileWidgetId);}catch(_){}}
  }

  async function edgeFunctionErrorMessage(error){
    let message=String(error?.message||'');
    try{
      const response=error?.context;
      if(response?.clone){
        const payload=await response.clone().json();
        if(payload?.error)message=String(payload.error);
      }
    }catch(_){ }
    return message;
  }

  function finishLeadGate(allowed){
    leadGate?.classList.remove('open');
    leadGate?.setAttribute('aria-hidden','true');
    document.body.classList.remove('fl-lead-open');
    if(leadLastFocus && typeof leadLastFocus.focus==='function') leadLastFocus.focus();
    const resolve=leadGateResolve;
    leadGateResolve=null;leadGatePromise=null;
    if(resolve)resolve(Boolean(allowed));
  }
  async function requestLeadAccess(){
    try{await publicSiteSettingsPromise;}catch(_){ }
    if(window.FLOWER_LIGHT_SITE_SETTINGS?.require_customer_lead===false)return true;
    if(hasLeadAccess())return true;
    if(!db || !leadGate || !leadForm)return false;
    if(leadGatePromise)return leadGatePromise;
    leadLastFocus=document.activeElement;
    leadError?.classList.remove('show');
    if(leadError)leadError.textContent='';
    leadGate.classList.add('open');leadGate.setAttribute('aria-hidden','false');document.body.classList.add('fl-lead-open');
    leadOpenedAt=Date.now();
    if(turnstileSiteKey){
      ensureTurnstile().catch(error=>{
        console.warn('[Site] Turnstile load failed.',error);
        if(leadError){leadError.textContent='تعذر تحميل التحقق الأمني. تحقق من الاتصال ثم أعد المحاولة.';leadError.classList.add('show');}
      });
    }
    window.setTimeout(()=>document.getElementById('flLeadName')?.focus(),50);
    leadGatePromise=new Promise(resolve=>{leadGateResolve=resolve;});
    return leadGatePromise;
  }
  window.flBeforeProductsOpen=()=>{
    if(adminMode)return Promise.resolve(true);
    return requestLeadAccess();
  };
  leadClose?.addEventListener('click',()=>finishLeadGate(false));
  leadGate?.addEventListener('click',e=>{if(e.target===leadGate)finishLeadGate(false);});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&leadGate?.classList.contains('open'))finishLeadGate(false);});
  leadForm?.addEventListener('submit',async e=>{
    e.preventDefault();
    const full_name=document.getElementById('flLeadName').value.trim();
    const company_name=document.getElementById('flLeadCompany').value.trim();
    const mobile=document.getElementById('flLeadMobile').value.trim();
    const honeypot=(document.getElementById('flLeadWebsite')?.value||'').trim();
    const digits=leadPhoneDigits(mobile);
    if(honeypot){rememberLeadAccess();leadForm.reset();finishLeadGate(true);return;}
    if(Date.now()-leadOpenedAt<900){leadError.textContent='انتظر لحظة ثم حاول مرة أخرى.';leadError.classList.add('show');return;}
    try{
      const lastSubmit=Number(localStorage.getItem(leadSubmitKey)||0);
      if(lastSubmit && Date.now()-lastSubmit<leadSubmitCooldownMs){
        rememberLeadAccess();leadForm.reset();finishLeadGate(true);return;
      }
    }catch(_){ }
    if(full_name.length<2){leadError.textContent='اكتب الاسم بشكل صحيح.';leadError.classList.add('show');return;}
    if(company_name && company_name.length<2){leadError.textContent='اكتب اسم الشركة بشكل صحيح أو اتركه فارغًا.';leadError.classList.add('show');return;}
    if(digits.length<9 || digits.length>15){leadError.textContent='اكتب رقم جوال صحيح.';leadError.classList.add('show');return;}
    if(turnstileSiteKey){
      try{await ensureTurnstile();}catch(_){leadError.textContent='تعذر تحميل التحقق الأمني. تحقق من الاتصال وحاول مرة أخرى.';leadError.classList.add('show');return;}
      if(!turnstileToken){leadError.textContent='أكمل التحقق الأمني ثم اضغط متابعة.';leadError.classList.add('show');return;}
    }
    leadError.classList.remove('show');leadError.textContent='';
    leadSubmit.disabled=true;leadSubmit.textContent='جاري الحفظ...';
    try{
      if(turnstileSiteKey){
        const {data,error}=await db.functions.invoke(leadSubmissionFunction,{body:{full_name,company_name,mobile,turnstile_token:turnstileToken}});
        if(error)throw new Error(await edgeFunctionErrorMessage(error));
        if(!data?.ok)throw new Error(String(data?.error||'تعذر حفظ البيانات الآن.'));
      }else{
        // Compatibility path for upgrades. Disable it by configuring Turnstile and applying the v104/v105 protected upgrade.
        const {error}=await db.from('customer_leads').insert({full_name,company_name,mobile});
        if(error)throw error;
      }
      try{localStorage.setItem(leadSubmitKey,String(Date.now()));}catch(_){ }
      rememberLeadAccess();
      if(typeof window.flTrack==='function')window.flTrack('customer_lead_saved',{source:'products_gate',protected:turnstileSiteKey?'turnstile':'legacy'});
      leadForm.reset();
      finishLeadGate(true);
    }catch(err){
      console.warn('[Site] Customer lead save failed.',err);
      const message=String(err?.message||'');
      const rateLimited=/rate_limited|محاولات كثيرة|429/i.test(message);
      const verification=/تحقق الأمني|Turnstile|token/i.test(message);
      leadError.textContent=rateLimited?'محاولات كثيرة من هذا الاتصال. حاول بعد عدة دقائق.':verification?'تعذر التحقق الأمني. أعد المحاولة.':'تعذر حفظ البيانات الآن. تحقق من الاتصال وحاول مرة أخرى.';
      leadError.classList.add('show');
      if(turnstileSiteKey)resetTurnstile();
    }finally{
      leadSubmit.disabled=false;leadSubmit.textContent='متابعة إلى المنتجات';
    }
  });
})();
