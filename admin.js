// Flower Light / Basair Gulf Supabase admin controller — final release.
// ?admin=1 requires the Owner role; ?admin=2 requires the linked Sub-admin role.
// Permissions are enforced in both this interface and Supabase RLS/RPC policies.

// Supabase settings live in config.js (loaded before this file).

(() => {
  'use strict';
  const MAX_PRODUCT_IMAGES = 4;
  const cfg = window.FLOWER_LIGHT_SUPABASE || {};
  const configured = /^https:\/\/.+\.supabase\.co$/i.test(String(cfg.url || '').trim()) && String(cfg.anonKey || '').trim() && !String(cfg.anonKey).includes('YOUR_');
  let db = null;
  if (configured && window.supabase?.createClient) {
    db = window.supabase.createClient(String(cfg.url).trim(), String(cfg.anonKey).trim(), { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  }
  window.flSupabase = db;

  const adminQuery = new URLSearchParams(location.search);
  const adminPanel = adminQuery.get('admin');
  const adminMode = adminPanel === '1' || adminPanel === '2';
  const isPrimaryAdmin = adminPanel === '1';
  const recoveryPortalRequested = adminMode && adminQuery.get('recovery') === '1';
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
  const PRODUCT_SPEC_ALIAS_GROUPS={sku:['sku','كود المنتج','رقم المنتج','رمز المنتج'],wattage:['wattage','power','watt','w','القدرة','القدره','الواط','وات'],lumens:['lumens','lumen','lm','اللومن','لومن','التدفق الضوئي','شدة الاضاءة','شدة الإضاءة'],cct:['cct','kelvin','k','حرارة اللون','حراره اللون','درجة حرارة اللون','درجه حراره اللون','كلفن'],cri:['cri','مؤشر تجسيد الالوان','مؤشر تجسيد الألوان'],voltage:['voltage','volt','v','الفولت','الجهد','فولت'],ip_rating:['ip_rating','ip rating','ip','درجة الحماية ip','درجه الحمايه ip','درجة الحماية','درجه الحمايه'],dimensions:['dimensions','dimension','size','المقاس','المقاسات','الأبعاد','الابعاد'],color:['color','colour','اللون'],material:['material','الخامة','الخامه'],beam_angle:['beam_angle','beam angle','زاوية الإضاءة','زاويه الاضاءه','زاوية الضوء','زاويه الضوء'],frequency:['frequency','hz','التردد'],warranty:['warranty','الضمان'],bulb_base:['bulb_base','bulb base','socket','قاعدة اللمبة','قاعده اللمبه','سوكت'],bulb_count:['bulb_count','bulb count','عدد اللمبات','عدد اللمبة','عدد اللمبه']};
  function productSpecAliasToken(value){return String(value||'').trim().toLowerCase().replace(/[\u064B-\u0652]/g,'').replace(/[إأآا]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/[_-]+/g,' ').replace(/\s+/g,' ').trim();}
  const PRODUCT_SPEC_ALIAS_MAP=(()=>{const map=new Map();PRODUCT_SPEC_FIELDS.forEach(def=>[def.key,def.label,...(PRODUCT_SPEC_ALIAS_GROUPS[def.key]||[])].forEach(alias=>{const token=productSpecAliasToken(alias);if(token)map.set(token,def.key);}));return map;})();
  function productSpecFields(){
    const custom=(Array.isArray(window.FLOWER_LIGHT_CUSTOM_FILTERS)?window.FLOWER_LIGHT_CUSTOM_FILTERS:[]).map(row=>({
      key:String(row?.key||'').trim(),label:String(row?.label||'').trim(),placeholder:String(row?.placeholder||'مثال: قيمة المواصفة').trim()
    })).filter(row=>/^custom_filter_[a-z0-9]+$/i.test(row.key)&&row.label);
    const seen=new Set(PRODUCT_SPEC_FIELDS.map(field=>field.key));
    return [...PRODUCT_SPEC_FIELDS,...custom.filter(field=>!seen.has(field.key)&&seen.add(field.key))];
  }
  function resolveProductSpecDefinition(key,label=''){
    const direct=String(key||'').trim();
    const fields=productSpecFields();
    const directDef=fields.find(field=>field.key===direct);
    if(directDef)return directDef;
    const aliasKey=PRODUCT_SPEC_ALIAS_MAP.get(productSpecAliasToken(direct))||PRODUCT_SPEC_ALIAS_MAP.get(productSpecAliasToken(label));
    if(aliasKey)return PRODUCT_SPEC_FIELDS.find(field=>field.key===aliasKey)||null;
    const labelToken=productSpecAliasToken(label);
    return labelToken?(fields.find(field=>productSpecAliasToken(field.label)===labelToken)||null):null;
  }
  function normalizeKnownSpecValue(value,def,existingUnit=''){let text=String(value??'').trim();let unit=String(existingUnit||'').trim();const canonicalUnit=String(def?.unit||'').trim();if(canonicalUnit){const escaped=canonicalUnit.replace(/[\^$.*+?()[\]{}|\\]/g,'\\$&');text=text.replace(new RegExp(`\\s*${escaped}\\s*$`,'i'),'').trim();unit=canonicalUnit;}return {value:text,unit};}
  const WHATSAPP_META_SHOW_DESCRIPTION='__whatsapp_show_description';
  const WHATSAPP_META_SHOW_SPECS='__whatsapp_show_specifications';
  const PRICING_META_KEY='__pricing_tiers_v2';
  const PRICE_TIER_TYPES=[
    {key:'retail',label:'مفرق',needsRange:false},
    {key:'wholesale',label:'جملة',needsRange:true},
    {key:'bulk',label:'جملة الجملة',needsRange:true}
  ];
  const PRICE_TIER_TYPE_MAP=new Map(PRICE_TIER_TYPES.map(item=>[item.key,item]));

  function normalizePriceTierNumber(value){
    if(value==null || value==='') return null;
    const n=Number(value);
    return Number.isFinite(n) && n>=0 ? n : null;
  }

  function normalizePriceTierQty(value){
    if(value==null || value==='') return null;
    const n=Math.trunc(Number(value));
    return Number.isFinite(n) && n>=1 ? n : null;
  }

  function legacyPricingTiers(product){
    const tiers=[];
    const retail=normalizePriceTierNumber(product?.price);
    const wholesale=normalizePriceTierNumber(product?.wholesale_price);
    const wholesaleMin=normalizePriceTierQty(product?.wholesale_min_qty);
    if(retail!=null) tiers.push({type:'retail',price:retail,min_qty:null,max_qty:null});
    if(wholesale!=null) tiers.push({type:'wholesale',price:wholesale,min_qty:wholesaleMin,max_qty:null});
    return tiers;
  }

  function productPricingTiers(rawSpecifications,legacyProduct=null){
    let parsed=[];
    if(Array.isArray(rawSpecifications)){
      const meta=rawSpecifications.find(item=>item && typeof item==='object' && String(item.key||'').trim()===PRICING_META_KEY);
      if(meta){
        try{
          const value=typeof meta.value==='string'?JSON.parse(meta.value):meta.value;
          if(Array.isArray(value)) parsed=value;
        }catch(_){}
      }
    }
    const tiers=parsed.map(row=>{
      if(!row || typeof row!=='object') return null;
      const type=String(row.type||'').trim();
      if(!PRICE_TIER_TYPE_MAP.has(type)) return null;
      const price=normalizePriceTierNumber(row.price);
      if(price==null) return null;
      const needsRange=PRICE_TIER_TYPE_MAP.get(type)?.needsRange===true;
      let min_qty=needsRange?normalizePriceTierQty(row.min_qty):null;
      let max_qty=needsRange?normalizePriceTierQty(row.max_qty):null;
      if(min_qty!=null && max_qty!=null && max_qty<min_qty)[min_qty,max_qty]=[max_qty,min_qty];
      return {type,price,min_qty,max_qty};
    }).filter(Boolean).slice(0,12);
    return tiers.length?tiers:legacyPricingTiers(legacyProduct);
  }

  function pricingMetaRow(tiers){
    return {key:PRICING_META_KEY,label:'',value:JSON.stringify(Array.isArray(tiers)?tiers:[]),unit:''};
  }

  function pricingTierEditorRowHtml(tier=null){
    const type=PRICE_TIER_TYPE_MAP.has(tier?.type)?tier.type:'retail';
    const options=PRICE_TIER_TYPES.map(item=>`<option value="${item.key}" ${item.key===type?'selected':''}>${item.label}</option>`).join('');
    return `<div class="fl-price-tier-row" data-price-tier-row>
      <div class="fl-cloud-field"><label>نوع السعر</label><select data-price-tier-type>${options}</select></div>
      <div class="fl-cloud-field"><label>السعر (ر.س)</label><input data-price-tier-price type="number" min="0" step="0.01" inputmode="decimal" value="${tier?.price==null?'':esc(tier.price)}" placeholder="مثال: 35"></div>
      <div class="fl-price-tier-range" data-price-tier-range>
        <div class="fl-cloud-field"><label>العدد الأدنى</label><input data-price-tier-min type="number" min="1" step="1" inputmode="numeric" value="${tier?.min_qty==null?'':esc(tier.min_qty)}" placeholder="مثال: 10"></div>
        <div class="fl-cloud-field"><label>العدد الأعلى</label><input data-price-tier-max type="number" min="1" step="1" inputmode="numeric" value="${tier?.max_qty==null?'':esc(tier.max_qty)}" placeholder="مثال: 49"></div>
      </div>
      <button class="fl-price-tier-remove" data-price-tier-remove type="button">حذف</button>
    </div>`;
  }

  function productPricingEditorHtml(prod){
    const tiers=productPricingTiers(prod?.specifications,prod);
    const rows=(tiers.length?tiers:[{type:'retail',price:null,min_qty:null,max_qty:null}]).map(pricingTierEditorRowHtml).join('');
    return `<section class="fl-pricing-editor full">
      <div class="fl-pricing-editor-head">
        <div><strong>الأسعار</strong><small>أضف مفرق أو جملة أو جملة الجملة. في الجملة وجملة الجملة يمكنك تحديد العدد الأدنى والأعلى.</small></div>
        <button class="fl-cloud-btn fl-add-price-tier-btn" id="flAddPriceTier" type="button">+ إضافة خانة سعر</button>
      </div>
      <div id="flPriceTierList" class="fl-price-tier-list">${rows}</div>
      <label class="fl-cloud-check fl-limited-offer-check"><input id="flProdLimitedOffer" type="checkbox" ${prod?.limited_offer===true?'checked':''}> <span><strong>عرض لفترة محدودة</strong><small>عند تفعيله تظهر شارة على زاوية صورة المنتج.</small></span></label>
    </section>`;
  }

  function syncPriceTierRow(row){
    if(!row) return;
    const type=String(row.querySelector('[data-price-tier-type]')?.value||'retail');
    const needsRange=PRICE_TIER_TYPE_MAP.get(type)?.needsRange===true;
    row.classList.toggle('is-retail',!needsRange);
    const range=row.querySelector('[data-price-tier-range]');
    if(range) range.hidden=!needsRange;
  }

  function collectProductPricingTiers(){
    const tiers=[];
    document.querySelectorAll('[data-price-tier-row]').forEach((row,index)=>{
      const type=String(row.querySelector('[data-price-tier-type]')?.value||'retail').trim();
      const def=PRICE_TIER_TYPE_MAP.get(type);
      if(!def) return;
      const rawPrice=String(row.querySelector('[data-price-tier-price]')?.value||'').trim();
      const rawMin=String(row.querySelector('[data-price-tier-min]')?.value||'').trim();
      const rawMax=String(row.querySelector('[data-price-tier-max]')?.value||'').trim();
      if(rawPrice==='' && rawMin==='' && rawMax==='') return;
      const price=normalizePriceTierNumber(rawPrice);
      if(price==null) throw new Error(`أدخل سعرًا صحيحًا في خانة السعر رقم ${index+1}`);
      let min_qty=def.needsRange?normalizePriceTierQty(rawMin):null;
      let max_qty=def.needsRange?normalizePriceTierQty(rawMax):null;
      if(def.needsRange && rawMin!=='' && min_qty==null) throw new Error(`العدد الأدنى في خانة السعر رقم ${index+1} غير صحيح`);
      if(def.needsRange && rawMax!=='' && max_qty==null) throw new Error(`العدد الأعلى في خانة السعر رقم ${index+1} غير صحيح`);
      if(min_qty!=null && max_qty!=null && max_qty<min_qty) throw new Error(`في خانة السعر رقم ${index+1}: العدد الأعلى يجب أن يكون أكبر من أو يساوي العدد الأدنى`);
      tiers.push({type,price,min_qty,max_qty});
    });
    return tiers.slice(0,12);
  }

  function productWhatsAppOption(raw,key){
    if(!Array.isArray(raw)) return false;
    const row=raw.find(item=>item && typeof item==='object' && String(item.key||'').trim()===key);
    if(!row) return false;
    return ['1','true','yes','on'].includes(String(row.value??'').trim().toLowerCase());
  }

  function productWhatsAppMetaRows(){
    return [
      {key:WHATSAPP_META_SHOW_DESCRIPTION,label:'',value:document.getElementById('flProdWhatsAppShowDescription')?.checked?'1':'0',unit:''},
      {key:WHATSAPP_META_SHOW_SPECS,label:'',value:document.getElementById('flProdWhatsAppShowSpecs')?.checked?'1':'0',unit:''}
    ];
  }

  function normalizeSpecifications(raw){
    let rows=[];
    if(Array.isArray(raw)) rows=raw;
    else if(raw && typeof raw==='object') rows=Object.entries(raw).map(([key,value])=>({key,value}));
    return rows.map((row,index)=>{
      if(!row || typeof row!=='object') return null;
      const rawKey=String(row.key||`custom_${index+1}`).trim();
      if(rawKey===WHATSAPP_META_SHOW_DESCRIPTION || rawKey===WHATSAPP_META_SHOW_SPECS || rawKey===PRICING_META_KEY) return null;
      const rawLabel=String(row.label||'').trim();
      const def=resolveProductSpecDefinition(rawKey,rawLabel);
      const key=def?.key||rawKey;
      const label=String(def?.label||rawLabel||key).trim();
      const normalized=normalizeKnownSpecValue(row.value,def,row.unit);
      return label && normalized.value ? {key,label,value:normalized.value,unit:normalized.unit} : null;
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
    const def=resolveProductSpecDefinition(spec?.key,spec?.label);
    const selectedKey=def?.key||'__custom__';
    const options=productSpecFields().map(field=>`<option value="${field.key}" ${field.key===selectedKey?'selected':''}>${field.label}</option>`).join('');
    const customLabel=def?'':String(spec?.label||'');
    return `<div class="fl-flex-spec-row" data-flex-spec-row>
      <div class="fl-cloud-field"><label>نوع المواصفة</label><select data-flex-spec-type>${options}<option value="__custom__" ${selectedKey==='__custom__'?'selected':''}>مواصفة أخرى</option></select><input data-flex-spec-label value="${esc(customLabel)}" placeholder="اكتب اسم المواصفة" ${selectedKey==='__custom__'?'':'hidden'}></div>
      <div class="fl-cloud-field"><label>القيمة</label><input data-flex-spec-value value="${esc(specificationEditorValue(spec))}" placeholder="${esc(def?.placeholder||'مثال: قيمة المواصفة')}"></div>
      <button class="fl-flex-spec-remove" data-flex-spec-remove type="button" aria-label="حذف الصفة">حذف</button>
    </div>`;
  }

  function productSpecsFormHtml(prod){
    const specs=normalizeSpecifications(prod?.specifications);
    const rows=(specs.length?specs:[null]).map(spec=>productSpecEditorRowHtml(spec)).join('');
    const showInWhatsApp=productWhatsAppOption(prod?.specifications,WHATSAPP_META_SHOW_SPECS);
    return `<div class="fl-product-spec-section full"><div class="fl-product-spec-head"><div><div class="fl-field-label-inline"><strong>المواصفات الفنية</strong><label class="fl-whatsapp-include-toggle"><input id="flProdWhatsAppShowSpecs" type="checkbox" ${showInWhatsApp?'checked':''}><span>إظهار في رسالة واتساب</span></label></div><small>اختر نوع المواصفة من القائمة لتوحيدها بين المنتجات. استخدم «مواصفة أخرى» فقط عند الحاجة.</small></div><button class="fl-cloud-btn fl-add-spec-btn" id="flAddProductSpec" type="button">+ إضافة صفة</button></div><div id="flFlexibleSpecs" class="fl-flex-spec-list">${rows}</div></div>`;
  }

  function collectProductSpecifications(pricingTiers=[]){
    const specs=[];
    const usedCanonicalKeys=new Set();
    document.querySelectorAll('[data-flex-spec-row]').forEach((row,index)=>{
      const type=String(row.querySelector('[data-flex-spec-type]')?.value||'__custom__').trim();
      const customLabel=String(row.querySelector('[data-flex-spec-label]')?.value||'').trim();
      const rawValue=String(row.querySelector('[data-flex-spec-value]')?.value||'').trim();
      if(!rawValue) return;
      const def=type==='__custom__'?resolveProductSpecDefinition('',customLabel):resolveProductSpecDefinition(type,'');
      const key=def?.key||`custom_${index+1}`;
      const label=def?.label||customLabel;
      if(!label) return;
      if(def){
        if(usedCanonicalKeys.has(key)) throw new Error(`المواصفة «${label}» مضافة أكثر من مرة. اجمع القيم في خانة واحدة.`);
        usedCanonicalKeys.add(key);
      }
      const normalized=normalizeKnownSpecValue(rawValue,def,'');
      if(!normalized.value) return;
      specs.push({key,label,value:normalized.value,unit:normalized.unit});
    });
    return [...specs.slice(0,30),...productWhatsAppMetaRows(),pricingMetaRow(pricingTiers)];
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

    document.title=isPrimaryAdmin?'لوحة المدير | بصائر الخليج':'لوحة الأدمن | بصائر الخليج';
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
  async function loadPublicSiteSettings(){
    const fallback={require_customer_lead:true,master_barcode_path:'',master_barcode_url:'',design_footer_number:'',design_footer_label:''};
    if(!db){window.FLOWER_LIGHT_SITE_SETTINGS=fallback;return false;}
    try{
      const {data,error}=await db.from('site_settings').select('require_customer_lead,master_barcode_path,design_footer_number,design_footer_label').eq('id',1).maybeSingle();
      if(error)throw error;
      const masterBarcodePath=String(data?.master_barcode_path||'').trim();
      window.FLOWER_LIGHT_SITE_SETTINGS={
        require_customer_lead:data?.require_customer_lead!==false,
        master_barcode_path:masterBarcodePath,
        master_barcode_url:masterBarcodePath?imageUrl(masterBarcodePath):''
      };
      return true;
    }catch(err){
      console.warn('[Site settings] load failed; customer lead gate remains enabled for safety.',err);
      window.FLOWER_LIGHT_SITE_SETTINGS=fallback;
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

  async function loadCloudProducts(){
    if (!db) return false;
    try {
      const [{data:cats,error:ce},{data:prods,error:pe},{data:galleryRows,error:ge}] = await Promise.all([
        db.from('categories').select('*').eq('is_visible',true).order('sort_order',{ascending:true}).order('created_at',{ascending:true}),
        db.from('products').select('*').eq('is_visible',true).order('sort_order',{ascending:true}).order('created_at',{ascending:true}),
        db.from('product_images').select('id,product_id,image_path,sort_order,is_primary,created_at').order('sort_order',{ascending:true}).order('created_at',{ascending:true})
      ]);
      if (ce || pe) throw ce || pe;
      if (ge) console.warn('[Site] Product gallery metadata unavailable.', ge.message || ge);
      const visibleCats = Array.isArray(cats) ? cats : [];
      const visibleProds = Array.isArray(prods) ? prods : [];
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
          image:imageUrl(primaryPath), image_path:primaryPath,
          gallery:gallery.map((row,index)=>({
            id:row.id||'',image_path:row.image_path,image:imageUrl(row.image_path),is_primary:index===0,sort_order:index*10
          })),
          specifications:Array.isArray(p.specifications) ? p.specifications : [],
          price:p.price==null?null:Number(p.price),
          wholesale_price:p.wholesale_price==null?null:Number(p.wholesale_price),
          wholesale_min_qty:p.wholesale_min_qty==null?null:Number(p.wholesale_min_qty),
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
  window.FLOWER_LIGHT_SITE_SETTINGS = { require_customer_lead: true, master_barcode_path: '', master_barcode_url: '', design_footer_number: '', design_footer_label: '' };
  window.FLOWER_LIGHT_PRODUCTS = { catalog: [], chandeliers: [], balfon: [], extraSections: [] };
  renderPublicProfile();
  if (db) { publicSiteSettingsPromise=loadPublicSiteSettings(); loadPublicProfile(); loadPublicSiteCatalog(); loadCloudProducts(); }

  // Customer lead gate: visitors enter their details once before opening products.
  const leadGate=document.getElementById('flLeadGate');
  const leadForm=document.getElementById('flLeadForm');
  const leadClose=document.getElementById('flLeadClose');
  const leadError=document.getElementById('flLeadError');
  const leadSubmit=document.getElementById('flLeadSubmit');
  let leadGatePromise=null;
  let leadGateResolve=null;
  let leadLastFocus=null;
  const leadAccessKey='flower_light_customer_access_v1';
  const leadSubmitKey='flower_light_customer_submit_v1';
  const leadSubmitCooldownMs=30000;
  let leadOpenedAt=0;
  const hasLeadAccess=()=>{try{return localStorage.getItem(leadAccessKey)==='1';}catch(_){return false;}};
  const rememberLeadAccess=()=>{try{localStorage.setItem(leadAccessKey,'1');}catch(_){}};
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
    try{await publicSiteSettingsPromise;}catch(_){}
    if(window.FLOWER_LIGHT_SITE_SETTINGS?.require_customer_lead===false)return true;
    if(hasLeadAccess())return true;
    if(!db || !leadGate || !leadForm)return false;
    if(leadGatePromise)return leadGatePromise;
    leadLastFocus=document.activeElement;
    leadError?.classList.remove('show');
    if(leadError)leadError.textContent='';
    leadGate.classList.add('open');leadGate.setAttribute('aria-hidden','false');document.body.classList.add('fl-lead-open');
    leadOpenedAt=Date.now();
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
    }catch(_){}
    if(full_name.length<2){leadError.textContent='اكتب الاسم بشكل صحيح.';leadError.classList.add('show');return;}
    if(company_name && company_name.length<2){leadError.textContent='اكتب اسم الشركة بشكل صحيح أو اتركه فارغًا.';leadError.classList.add('show');return;}
    if(digits.length<9 || digits.length>15){leadError.textContent='اكتب رقم جوال صحيح.';leadError.classList.add('show');return;}
    leadError.classList.remove('show');leadError.textContent='';
    leadSubmit.disabled=true;leadSubmit.textContent='جاري الحفظ...';
    try{
      const {error}=await db.from('customer_leads').insert({full_name,company_name,mobile});
      if(error)throw error;
      try{localStorage.setItem(leadSubmitKey,String(Date.now()));}catch(_){}
      rememberLeadAccess();
      if(typeof window.flTrack==='function')window.flTrack('customer_lead_saved',{source:'products_gate'});
      leadForm.reset();
      finishLeadGate(true);
    }catch(err){
      console.warn('[Site] Customer lead save failed.',err);
      const rateLimited=String(err?.message||'').includes('rate_limited');
      leadError.textContent=rateLimited?'الموقع مشغول حالياً، حاول خلال دقائق قليلة.':'تعذر حفظ البيانات الآن. تحقق من الاتصال وحاول مرة أخرى.';
      leadError.classList.add('show');
    }finally{
      leadSubmit.disabled=false;leadSubmit.textContent='متابعة إلى المنتجات';
    }
  });

  if (!adminMode) return;

  const shell = document.getElementById('flCloudAdmin');
  const body = document.getElementById('flCloudAdminBody');
  const logoutBtn = document.getElementById('flCloudLogout');
  const modal = document.getElementById('flCloudModal');
  const modalTitle = document.getElementById('flCloudModalTitle');
  const modalBody = document.getElementById('flCloudModalBody');
  const toast = document.getElementById('flCloudToast');
  const adminTitle = document.getElementById('flCloudAdminTitle');
  const adminSubtitle = document.getElementById('flCloudAdminSubtitle');
  const primaryAdminBtn = document.getElementById('flCloudPrimaryAdmin');
  const assistantAdminBtn = document.getElementById('flCloudAssistantAdmin');
  if(adminTitle) adminTitle.textContent = isPrimaryAdmin ? 'لوحة المدير' : 'لوحة الأدمن';
  if(adminSubtitle) adminSubtitle.textContent = isPrimaryAdmin ? 'جميع أدوات الموقع والصلاحيات' : 'إدارة الصلاحيات المتاحة';
  if(primaryAdminBtn) primaryAdminBtn.hidden = !isPrimaryAdmin;
  primaryAdminBtn?.classList.toggle('active',isPrimaryAdmin);
  assistantAdminBtn?.classList.toggle('active',!isPrimaryAdmin);
  shell.classList.add('open'); shell.setAttribute('aria-hidden','false'); document.body.style.overflow='hidden';
  let view='overview'; let categories=[]; let products=[]; let productImages=[]; let siteCatalogs=[]; let profile={}; let contacts=[]; let selectedCategory=''; let selectedProductNode=''; let cloudNavScrollLeft=0;
  let passwordRecoveryMode=/(?:^|[#&?])type=recovery(?:&|$)/i.test(`${location.search}${location.hash}`);
  const adminViewItems = [
    ['analytics','الإحصائيات'],
    ['datasheet','صمّم داتا شيت'],
    ['sections','الأقسام'],
    ['products','المنتجات'],
    ['profile','البيانات الشخصية'],
    ['contacts','وسائل التواصل'],
    ['leads','جهات اتصال العملاء']
  ];
  const ownerSettingsViewItems = [
    ['search-filters','فلاتر البحث'],
    ['site-settings','إعدادات الموقع'],
    ['business-settings','بيانات الشركة'],
    ['bank-settings','الحسابات البنكية'],
    ['template-settings','قالب المنتجات']
  ];
  const validPermissionKeys = new Set(adminViewItems.map(([key])=>key));
  const delegatablePermissionKeys = new Set([...validPermissionKeys].filter(key=>!['sections','products'].includes(key)));
  let currentAdminRole='';
  let currentAdminEmail='';
  let currentAdminPermissions=new Set();
  let managedAdmin2Email='';
  let managedAdmin2Permissions=new Set();
  let primaryRecoveryEmail='';
  let recoveryContext=null;
  let recoveryPortalRendered=false;
  const allowedAdminViews = () => new Set(isPrimaryAdmin
    ? ['overview',...validPermissionKeys,...ownerSettingsViewItems.map(([key])=>key),'credentials','permissions']
    : ['overview',...currentAdminPermissions]);
  const normalizeAdminView = candidate => allowedAdminViews().has(candidate) ? candidate : 'overview';
  let toastTimer;
  const notify = msg => { toast.textContent=msg; toast.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>toast.classList.remove('show'),2600); };
  const openModal = (title, html) => {
    modal.querySelector('.fl-cloud-dialog')?.classList.remove('fl-product-dialog');
    modalTitle.textContent=title;
    modalBody.innerHTML=html;
    modal.classList.add('open');
    modal.setAttribute('aria-hidden','false');
  };
  const closeModal = () => { modal.classList.remove('open'); modal.setAttribute('aria-hidden','true'); modalBody.innerHTML=''; };
  document.getElementById('flCloudModalClose').addEventListener('click',closeModal);
  modal.addEventListener('click',e=>{ if(e.target===modal) closeModal(); });
  document.getElementById('flCloudPreview').addEventListener('click',()=>{ location.href=location.pathname; });
  async function switchAdminPanel(mode){
    if((mode===1&&isPrimaryAdmin)||(mode===2&&!isPrimaryAdmin))return;
    try{if(db)await db.auth.signOut();}catch{}
    const url=new URL(location.href);
    url.searchParams.set('admin',String(mode));
    url.hash='';
    location.href=url.pathname+url.search;
  }
  primaryAdminBtn?.addEventListener('click',()=>switchAdminPanel(1));
  assistantAdminBtn?.addEventListener('click',()=>switchAdminPanel(2));
  logoutBtn.addEventListener('click', async()=>{
    if(db) await db.auth.signOut();
    if(recoveryPortalRequested){
      location.href=`${location.pathname}?admin=1`;
      return;
    }
    renderLogin();
  });

  function normalizePermissionList(value){
    const list=Array.isArray(value) ? value : (Array.isArray(value?.permissions) ? value.permissions : []);
    return [...new Set(list.map(String).filter(key=>delegatablePermissionKeys.has(key)))];
  }

  async function loadCurrentAdminAccess(){
    const {data,error}=await db.rpc('get_current_admin_access');
    if(error)throw new Error((String(error.code)==='PGRST202'||String(error.code)==='42883') ? 'شغّل ملف SUPABASE_SETUP.sql في Supabase أولًا.' : (error.message||error));
    currentAdminRole=String(data?.role||'');
    currentAdminEmail=String(data?.email||'');
    currentAdminPermissions=new Set(normalizePermissionList(data));
    const expectedRole=isPrimaryAdmin?'owner':'subadmin';
    if(currentAdminRole!==expectedRole){
      throw new Error(isPrimaryAdmin
        ? 'هذا الرابط مخصص لحساب المدير الأساسي Owner فقط.'
        : 'هذا الرابط مخصص لحساب الأدمن فقط.');
    }
    if(primaryAdminBtn) primaryAdminBtn.hidden = currentAdminRole !== 'owner';
    if(isPrimaryAdmin){
      const {data:settings,error:settingsError}=await db.rpc('owner_get_admin2_settings');
      if(settingsError)throw settingsError;
      managedAdmin2Email=String(settings?.email||'');
      managedAdmin2Permissions=new Set(normalizePermissionList(settings));
    }
  }

  function renderSetup(){
    logoutBtn.hidden=true;
    body.innerHTML=`<div class="fl-cloud-wrap"><div class="fl-cloud-login fl-cloud-setup"><h2>ربط Supabase مرة واحدة</h2><p>أدخل عنوان مشروع Supabase والمفتاح العام Publishable/Anon في ملف <b>config.js</b> (مكان واحد فقط).</p><div class="fl-cloud-note">افتح <b>config.js</b> ثم حدّث حقلي <b>url</b> و <b>anonKey</b> بالقيم من Supabase → Project Settings → API. لا تحتاج لتعديل <b>index.html</b>.</div><code>url: 'https://YOUR_PROJECT.supabase.co'\nanonKey: 'YOUR_PUBLISHABLE_OR_ANON_KEY'</code><p>بعد رفع الملف يصبح الحفظ والمزامنة مباشرَين عبر Supabase.</p></div></div>`;
  }

  async function getSession(){ const {data} = await db.auth.getSession(); return data.session; }

  function passwordResetRedirect(mode=isPrimaryAdmin?1:2){
    const url=new URL(location.origin+location.pathname);
    url.searchParams.set('admin',String(mode));
    return url.toString();
  }

  async function sendPasswordResetEmail(email,mode=isPrimaryAdmin?1:2){
    const normalized=String(email||'').trim();
    if(!normalized || !normalized.includes('@'))throw new Error('اكتب البريد الإلكتروني أولًا.');
    const {error}=await db.auth.resetPasswordForEmail(normalized,{redirectTo:passwordResetRedirect(mode)});
    if(error)throw error;
  }

  function primaryRecoveryRedirect(){
    const url=new URL(location.origin+location.pathname);
    url.searchParams.set('admin','1');
    url.searchParams.set('recovery','1');
    return url.toString();
  }

  async function sendPrimaryRecoveryAccessLink(email){
    const normalized=String(email||'').trim().toLowerCase();
    if(!normalized || !normalized.includes('@'))throw new Error('اكتب البريد الأساسي للاستعادة.');
    const {error}=await db.auth.signInWithOtp({
      email:normalized,
      options:{shouldCreateUser:false,emailRedirectTo:primaryRecoveryRedirect()}
    });
    if(error)throw error;
  }

  async function fetchPrimaryRecoverySettings(){
    const {data,error}=await db.functions.invoke('manage-admin-account',{body:{action:'get_recovery_settings'}});
    if(error||data?.error)throw Object.assign(error||new Error(data.error),{functionData:data});
    primaryRecoveryEmail=String(data?.recovery_email||'').trim().toLowerCase();
    return data||{};
  }

  function openPrimaryRecoveryRequest(prefill=''){
    openModal('الاستعادة عبر البريد الأساسي',`<form id="flPrimaryRecoveryRequestForm" class="fl-cloud-form">
      <div class="fl-cloud-note full">اكتب البريد الأساسي الذي حدده المدير. إذا كان مطابقًا، سيصلك رابط محمي لتغيير بريد أو كلمة مرور المدير أو الأدمن.</div>
      <div class="fl-cloud-field full"><label for="flRecoveryRequestEmail">البريد الأساسي للاستعادة</label><input id="flRecoveryRequestEmail" type="email" autocomplete="email" dir="ltr" required value="${esc(prefill)}" placeholder="recovery@example.com"></div>
      <div class="fl-cloud-actions full"><button class="fl-cloud-btn primary" id="flRecoveryRequestSubmit" type="submit">إرسال رابط الاستعادة</button></div>
    </form>`);
    document.getElementById('flPrimaryRecoveryRequestForm')?.addEventListener('submit',async event=>{
      event.preventDefault();
      const email=document.getElementById('flRecoveryRequestEmail').value.trim();
      const submit=document.getElementById('flRecoveryRequestSubmit');
      submit.disabled=true;submit.textContent='جاري الإرسال...';
      try{
        await sendPrimaryRecoveryAccessLink(email);
        closeModal();
        notify('إذا كان البريد مطابقًا فسيصل إليه رابط الاستعادة');
      }catch(error){
        notify(authErrorMessage(error,'تعذر إرسال رابط الاستعادة'));
        submit.disabled=false;submit.textContent='إرسال رابط الاستعادة';
      }
    });
  }

  function authErrorMessage(error,fallback='تعذر تنفيذ العملية'){
    const message=String(error?.message||error||'');
    if(/invalid login credentials/i.test(message))return 'كلمة المرور الحالية غير صحيحة.';
    if(/password should be at least|weak password/i.test(message))return 'كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل.';
    if(/email.*already|already.*registered|user already registered/i.test(message))return 'هذا البريد مرتبط بحساب آخر بالفعل.';
    if(/same password|different from the old/i.test(message))return 'اختر كلمة مرور جديدة مختلفة عن الحالية.';
    if(/reauthentication|reauthenticate|nonce/i.test(message))return 'انتهت مهلة التحقق الأمني. سجّل الخروج ثم ادخل مجددًا وحاول مرة أخرى.';
    if(/rate limit|too many/i.test(message))return 'تم إرسال محاولات كثيرة. انتظر قليلًا ثم حاول مجددًا.';
    return message?`${fallback}: ${message}`:fallback;
  }

  function renderPasswordRecovery(){
    passwordRecoveryMode=true;
    logoutBtn.hidden=true;
    body.innerHTML=`<div class="fl-cloud-wrap"><div class="fl-cloud-login"><h2>تعيين كلمة مرور جديدة</h2><p>اكتب كلمة مرور جديدة للحساب. بعد الحفظ ستعود إلى شاشة تسجيل الدخول.</p><form id="flRecoveryForm"><div class="fl-cloud-field"><label>كلمة المرور الجديدة</label><input id="flRecoveryPassword" type="password" autocomplete="new-password" minlength="8" required></div><div class="fl-cloud-field"><label>تأكيد كلمة المرور</label><input id="flRecoveryConfirm" type="password" autocomplete="new-password" minlength="8" required></div><button class="fl-cloud-btn primary" id="flRecoverySubmit" type="submit">حفظ كلمة المرور</button></form></div></div>`;
    document.getElementById('flRecoveryForm')?.addEventListener('submit',async event=>{
      event.preventDefault();
      const password=document.getElementById('flRecoveryPassword').value;
      const confirmation=document.getElementById('flRecoveryConfirm').value;
      const submit=document.getElementById('flRecoverySubmit');
      if(password.length<8){notify('كلمة المرور يجب أن تكون 8 أحرف على الأقل');return;}
      if(password!==confirmation){notify('تأكيد كلمة المرور غير مطابق');return;}
      submit.disabled=true;submit.textContent='جاري الحفظ...';
      try{
        const {error}=await db.auth.updateUser({password});
        if(error)throw error;
        await db.auth.signOut();
        passwordRecoveryMode=false;
        history.replaceState(null,'',`${location.pathname}?admin=${isPrimaryAdmin?'1':'2'}`);
        renderLogin();
        notify('تم تغيير كلمة المرور. سجّل الدخول بالكلمة الجديدة');
      }catch(error){
        notify(authErrorMessage(error,'تعذر تغيير كلمة المرور'));
        submit.disabled=false;submit.textContent='حفظ كلمة المرور';
      }
    });
  }

  async function renderLogin(){
    logoutBtn.hidden=true;
    body.innerHTML=`<div class="fl-cloud-wrap"><div class="fl-cloud-login"><h2>${isPrimaryAdmin?'تسجيل دخول المدير':'تسجيل دخول الأدمن'}</h2><p>استخدم البريد الإلكتروني وكلمة المرور الخاصة بهذا الحساب.</p><form id="flLoginForm"><div class="fl-cloud-field"><label>البريد الإلكتروني</label><input id="flLoginEmail" type="email" autocomplete="username" required></div><div class="fl-cloud-field"><label>كلمة المرور</label><input id="flLoginPassword" type="password" autocomplete="current-password" required></div><button class="fl-cloud-btn primary" id="flLoginSubmit" type="submit">تسجيل الدخول</button><button class="fl-login-forgot" id="flForgotPassword" type="button">نسيت البريد أو كلمة المرور؟</button></form></div></div>`;
    document.getElementById('flForgotPassword')?.addEventListener('click',()=>openPrimaryRecoveryRequest());
    document.getElementById('flLoginForm').addEventListener('submit',async e=>{
      e.preventDefault();
      const submit=document.getElementById('flLoginSubmit');
      submit.disabled=true;submit.textContent='جاري الدخول...';
      const email=document.getElementById('flLoginEmail').value.trim();
      const password=document.getElementById('flLoginPassword').value;
      try{
        const {error}=await db.auth.signInWithPassword({email,password});
        if(error)throw error;
        await loadCurrentAdminAccess();
        await refresh();
        renderApp();
      }catch(accessError){
        await db.auth.signOut();
        console.warn('[Admin] Sign-in failed.',accessError);
        notify('تعذر تسجيل الدخول. تحقق من البريد الإلكتروني وكلمة المرور.');
      }finally{
        submit.disabled=false;submit.textContent='تسجيل الدخول';
      }
    });
  }

  db?.auth.onAuthStateChange(event=>{
    if(event==='PASSWORD_RECOVERY'){
      passwordRecoveryMode=true;
      window.setTimeout(()=>renderPasswordRecovery(),0);
    }
  });

  function normalizeCatalogSelections(){
    if(!selectedCategory && categories[0]) selectedCategory=categories[0].id;
    if(selectedCategory && !categories.some(c=>c.id===selectedCategory)) selectedCategory=categories[0]?.id||'';
    const validProductNodes=new Set([
      ...categories.map(c=>`category:${c.id}`),
      ...siteCatalogs.map(c=>`catalog:${c.id}`)
    ]);
    if(!selectedProductNode || !validProductNodes.has(selectedProductNode)){
      selectedProductNode=categories[0]?`category:${categories[0].id}`:(siteCatalogs[0]?`catalog:${siteCatalogs[0].id}`:'');
    }
    if(selectedProductNode.startsWith('category:')) selectedCategory=selectedProductNode.slice(9);
  }

  async function loadCatalogAdminData(){
    const allowed=allowedAdminViews();
    const needCatalog=allowed.has('sections') || allowed.has('products');
    if(!needCatalog){categories=[];products=[];productImages=[];siteCatalogs=[];normalizeCatalogSelections();return;}
    const [{data:c,error:ce},{data:p,error:pe},{data:pi,error:pie},{data:sc,error:sce}] = await Promise.all([
      db.from('categories').select('*').order('sort_order',{ascending:true}).order('created_at',{ascending:true}),
      db.from('products').select('*').order('sort_order',{ascending:true}).order('created_at',{ascending:true}),
      db.from('product_images').select('id,product_id,image_path,sort_order,is_primary,created_at').order('sort_order',{ascending:true}).order('created_at',{ascending:true}),
      db.from('site_catalogs').select('*').order('sort_order',{ascending:true}).order('created_at',{ascending:true})
    ]);
    if(ce||pe||pie) throw ce||pe||pie;
    const catalogMissing=sce && ['42P01','PGRST205'].includes(String(sce?.code||''));
    if(sce && !catalogMissing) throw sce;
    categories=c||[];products=p||[];productImages=pi||[];siteCatalogs=catalogMissing?[]:(sc||[]);
    normalizeCatalogSelections();
  }

  async function loadProfileAdminData(){
    const allowed=allowedAdminViews();
    if(allowed.has('profile')){
      const {data,error}=await db.from('site_profile').select('*').eq('id',1).maybeSingle();
      if(error)throw error;profile=data||{};return;
    }
    profile={};
  }

  async function loadContactsAdminData(){
    if(!allowedAdminViews().has('contacts')){contacts=[];return;}
    const {data,error}=await db.from('contact_items').select('*').order('sort_order',{ascending:true}).order('created_at',{ascending:true});
    if(error)throw error;contacts=data||[];
  }

  async function refresh(){
    await Promise.all([
      loadCatalogAdminData(),
      loadProfileAdminData(),
      loadContactsAdminData(),
      whenModule('FL_ADMIN_LEADS').then(m=>m?m.loadLeadsPage({reset:true}):null),
      whenModule('FL_ADMIN_SETTINGS').then(m=>m?m.load():null),
      whenModule('FL_ADMIN_SEARCH_FILTERS').then(m=>m?m.load():null),
      whenModule('FL_ADMIN_BANKS').then(m=>m?m.load():null)
    ]);
  }

  function syncPublicProductsFromAdminCache(){
    const visibleCats=categories.filter(c=>c.is_visible!==false).slice().sort((a,b)=>(Number(a.sort_order)||0)-(Number(b.sort_order)||0)||String(a.created_at||'').localeCompare(String(b.created_at||'')));
    const visibleCatIds=new Set(visibleCats.map(c=>c.id));
    const visibleProds=products.filter(p=>p.is_visible!==false&&visibleCatIds.has(p.category_id)).slice().sort((a,b)=>(Number(a.sort_order)||0)-(Number(b.sort_order)||0)||String(a.created_at||'').localeCompare(String(b.created_at||'')));
    const galleryMap=new Map();
    productImages.forEach(row=>{
      if(!row?.product_id||!row?.image_path)return;
      if(!galleryMap.has(row.product_id))galleryMap.set(row.product_id,[]);
      galleryMap.get(row.product_id).push(row);
    });
    const grouped=new Map(visibleCats.map(c=>[c.id,[]]));
    visibleProds.forEach(p=>{
      let gallery=(galleryMap.get(p.id)||[]).slice().sort((a,b)=>(Number(a.sort_order)||0)-(Number(b.sort_order)||0));
      if(p.image_path&&!gallery.some(row=>row.image_path===p.image_path))gallery.unshift({id:'',product_id:p.id,image_path:p.image_path,sort_order:-1,is_primary:true});
      gallery=gallery.slice(0,MAX_PRODUCT_IMAGES);
      let primaryIndex=gallery.findIndex(row=>row.image_path===p.image_path);
      if(primaryIndex<0)primaryIndex=gallery.findIndex(row=>row.is_primary===true);
      if(primaryIndex<0&&gallery.length)primaryIndex=0;
      if(primaryIndex>0){const [primary]=gallery.splice(primaryIndex,1);gallery.unshift(primary);}
      const primaryPath=gallery[0]?.image_path||p.image_path||p.image_url||'';
      grouped.get(p.category_id)?.push({
        id:p.id,name:p.name||'',model:p.model||'',caption:p.caption||'',alt:p.caption||p.name||'',category:'',category_id:p.category_id||'',category_slug:'',
        image:imageUrl(primaryPath),image_thumb:imageUrl(productThumbnailPath(primaryPath)),image_path:primaryPath,
        gallery:gallery.map((row,index)=>({id:row.id||'',image_path:row.image_path,image:imageUrl(row.image_path),thumb:imageUrl(productThumbnailPath(row.image_path)),is_primary:index===0,sort_order:index*10})),
        specifications:Array.isArray(p.specifications)?p.specifications:[],price:p.price==null?null:Number(p.price),wholesale_price:p.wholesale_price==null?null:Number(p.wholesale_price),
        wholesale_min_qty:p.wholesale_min_qty==null?null:Number(p.wholesale_min_qty),availability:['available','out_of_stock','coming_soon'].includes(String(p.availability||''))?String(p.availability):'available',limited_offer:p.limited_offer===true,catalog_pdf_path:'',catalog_pdf_url:'',sort_order:p.sort_order||0,is_visible:true
      });
    });
    const extraSections=visibleCats.map(c=>{
      const items=grouped.get(c.id)||[];
      items.forEach(item=>{item.category=c.name;item.category_id=c.id;item.category_slug=c.slug||c.id;});
      return {id:c.id,name:c.name,slug:c.slug,description:c.description||'',sort_order:c.sort_order||0,items};
    });
    window.FLOWER_LIGHT_PRODUCTS={catalog:[],chandeliers:[],balfon:[],extraSections};
    window.flRenderProducts?.();
  }

  function syncPublicCatalogFromAdminCache(){
    const rows=siteCatalogs.filter(row=>row.is_visible!==false&&row.pdf_path).slice().sort((a,b)=>(Number(a.sort_order)||0)-(Number(b.sort_order)||0)||String(a.created_at||'').localeCompare(String(b.created_at||''))).map(row=>({
      ...row,id:String(row.id||''),name:String(row.name||'الكتالوج'),description:String(row.description||''),pdf_path:String(row.pdf_path||''),file_name:String(row.file_name||''),pdf_url:catalogFileUrl(row.pdf_path)
    })).filter(row=>row.pdf_url);
    window.FLOWER_LIGHT_SITE_CATALOGS=rows;
    window.FLOWER_LIGHT_SITE_CATALOG=rows[0]||{};
    window.flRenderProducts?.();
  }

  function navGroupHtml(label,items){
    if(!items.length)return '';
    return `<div class="fl-cloud-nav-group"><span class="fl-cloud-nav-label">${label}</span>${items.map(([key,text])=>`<button data-cloud-view="${key}" class="${view===key?'active':''}">${text}</button>`).join('')}</div>`;
  }

  function navHtml(){
    const allowed=allowedAdminViews();
    const contentItems=[['overview','الرئيسية'],...adminViewItems.filter(([key])=>allowed.has(key))];
    const ownerItems=isPrimaryAdmin?ownerSettingsViewItems:[];
    const accountItems=isPrimaryAdmin?[['credentials','بيانات تسجيل الدخول'],['permissions','صلاحيات الأدمن']]:[];
    return `<nav class="fl-cloud-nav">${navGroupHtml('إدارة المحتوى',contentItems)}${navGroupHtml('إعدادات المالك',ownerItems)}${navGroupHtml('الحسابات',accountItems)}</nav>`;
  }

  function layout(content,topTools=''){
    const previousNav=body.querySelector('.fl-cloud-nav');
    if(previousNav) cloudNavScrollLeft=previousNav.scrollLeft;
    body.innerHTML=`<div class="fl-cloud-wrap">${topTools?`<div class="fl-cloud-top-tools">${topTools}</div>`:''}<div class="fl-cloud-grid">${navHtml()}<main class="fl-cloud-main">${content}</main></div></div>`;
    const currentNav=body.querySelector('.fl-cloud-nav');
    if(currentNav){
      currentNav.scrollLeft=cloudNavScrollLeft;
      currentNav.addEventListener('scroll',()=>{cloudNavScrollLeft=currentNav.scrollLeft;},{passive:true});
      requestAnimationFrame(()=>{currentNav.scrollLeft=cloudNavScrollLeft;});
    }
    body.querySelectorAll('[data-cloud-view]').forEach(button=>button.addEventListener('click',()=>{
      const nav=body.querySelector('.fl-cloud-nav');
      if(nav) cloudNavScrollLeft=nav.scrollLeft;
      const nextView=normalizeAdminView(button.dataset.cloudView);
      view=nextView;
      renderApp();
    }));
  }

  // Shared surface for split-out admin modules (STAGE88 module split, part 1).
  // Exposed here, after esc/notify/layout/db all exist and before renderApp's
  // first call, so any module file loaded right after admin.js can use it.
  // `view` and `db` are exposed via getters so modules always see the live
  // value instead of a one-time snapshot.
  window.FL_ADMIN_CORE = {
    esc,
    notify,
    layout,
    get db(){ return db; },
    get view(){ return view; },
    // Added for the leads module (module split, part 2).
    shell,
    body,
    allowedAdminViews,
    leadPhoneDigits,
    normalizeLeadPhone,
    vcardEscape,
    // Added for the permissions module (module split, part 3).
    adminViewItems,
    delegatablePermissionKeys,
    normalizePermissionList,
    renderApp,
    get managedAdmin2Email(){ return managedAdmin2Email; },
    set managedAdmin2Email(value){ managedAdmin2Email=value; },
    get managedAdmin2Permissions(){ return managedAdmin2Permissions; },
    set managedAdmin2Permissions(value){ managedAdmin2Permissions=value; },
    set view(value){ view=value; },
    // Added for the settings module (module split, part 4).
    imageUrl,
    isStoragePath,
    bucket,
    isPrimaryAdmin,
    modal,
    modalBody,
    openModal,
    closeModal,
    MAX_PRODUCT_IMAGES,
    PRODUCT_SPEC_FIELDS,
    productSpecFields,
    resolveProductSpecDefinition,
    normalizeKnownSpecValue,
    WHATSAPP_META_SHOW_DESCRIPTION,
    WHATSAPP_META_SHOW_SPECS,
    PRICE_TIER_TYPE_MAP,
    normalizeSpecifications,
    productPricingTiers,
    productWhatsAppOption,
    pricingMetaRow,
    productSpecsFormHtml,
    productPricingEditorHtml,
    productSpecEditorRowHtml,
    pricingTierEditorRowHtml,
    syncPriceTierRow,
    collectProductPricingTiers,
    collectProductSpecifications,
    newCategorySlug,
    syncPublicProductsFromAdminCache,
    loadCatalogAdminData,
    normalizeCatalogSelections,
    adminGalleryRows,
    nextProductSort,
    renderProducts,
    fileToOptimizedBlob,
    uploadBlob,
    uploadProductImagePair,
    productThumbnailPath,
    productStoragePairPaths,
    uploadProductCatalogPdf,
    storagePathUsedByOtherProduct,
    catalogAdminCard,
    openCatalogForm,
    deleteCatalog,
    get categories(){ return categories; },
    set categories(value){ categories=Array.isArray(value)?value:[]; },
    get products(){ return products; },
    set products(value){ products=Array.isArray(value)?value:[]; },
    get productImages(){ return productImages; },
    set productImages(value){ productImages=Array.isArray(value)?value:[]; },
    get siteCatalogs(){ return siteCatalogs; },
    set siteCatalogs(value){ siteCatalogs=Array.isArray(value)?value:[]; },
    get selectedCategory(){ return selectedCategory; },
    set selectedCategory(value){ selectedCategory=String(value||''); },
    get selectedProductNode(){ return selectedProductNode; },
    set selectedProductNode(value){ selectedProductNode=String(value||''); },
  };

  // Render a split-out section; if its script failed to load, say so instead of showing a blank panel.
  function renderSplitSection(globalName,method){
    const fn=window[globalName]?.[method];
    if(typeof fn==='function')return fn();
    layout('<div class="fl-cloud-note bad">تعذر تحميل هذا القسم. حدّث الصفحة وحاول مرة أخرى.</div>');
    console.error('[admin] split module unavailable: '+globalName+'.'+method);
  }

  // Split-out modules load right after admin.js; wait (briefly) for one to register
  // itself before using it, so a slow script never breaks the first data load.
  function whenModule(name,timeoutMs=5000){
    return new Promise(resolve=>{
      const started=Date.now();
      (function poll(){
        if(window[name])return resolve(window[name]);
        if(Date.now()-started>timeoutMs){console.error('[admin] module not loaded: '+name);return resolve(null);}
        setTimeout(poll,50);
      })();
    });
  }

  function renderApp(){
    logoutBtn.hidden=false;
    view=normalizeAdminView(view);
    if(view==='analytics') renderSplitSection('FL_ADMIN_ANALYTICS','renderAnalytics');
    else if(view==='datasheet') renderSplitSection('FL_ADMIN_DATASHEET','renderDatasheetDesigner');
    else if(view==='sections') renderSections();
    else if(view==='products') renderProducts();
    else if(view==='profile') renderProfile();
    else if(view==='contacts') renderContacts();
    else if(view==='leads') renderSplitSection('FL_ADMIN_LEADS','renderLeads');
    else if(view==='search-filters' && isPrimaryAdmin) renderSplitSection('FL_ADMIN_SEARCH_FILTERS','render');
    else if(view==='site-settings' && isPrimaryAdmin) renderOwnerSettingsPage('site');
    else if(view==='business-settings' && isPrimaryAdmin) renderOwnerSettingsPage('business');
    else if(view==='bank-settings' && isPrimaryAdmin) renderOwnerSettingsPage('banks');
    else if(view==='template-settings' && isPrimaryAdmin) renderOwnerSettingsPage('template');
    else if(view==='credentials' && isPrimaryAdmin) renderCredentials();
    else if(view==='permissions' && isPrimaryAdmin) renderSplitSection('FL_ADMIN_PERMISSIONS','renderPermissions');
    else renderOverview();
  }

  function ownerShortcutButton(key,label,description){
    return `<button class="fl-overview-shortcut" type="button" data-overview-view="${key}"><strong>${label}</strong><small>${description}</small><span aria-hidden="true">←</span></button>`;
  }

  function renderOwnerSettingsPage(scope){
    const config={
      site:{title:'إعدادات الموقع',description:'إعدادات دخول العملاء وتثبيت تطبيق الموقع.',view:'site-settings'},
      business:{title:'بيانات الشركة',description:'البيانات التجارية وسياسة الخصوصية وما يظهر منها للزوار.',view:'business-settings'},
      banks:{title:'الحسابات البنكية',description:'بيانات استقبال الحوالات التي تظهر للعملاء مع أزرار نسخ مباشرة.',view:'bank-settings'},
      template:{title:'قالب المنتجات',description:'الباركود الرئيسي ورقم التذييل المستخدمان في تصاميم المنتجات.',view:'template-settings'}
    }[scope];
    if(!config){view='overview';renderOverview();return;}
    const module=scope==='banks'?window.FL_ADMIN_BANKS:window.FL_ADMIN_SETTINGS;
    const cards=scope==='banks'?module?.cardsHtml():module?.cardsHtml(scope);
    layout(`<div class="fl-cloud-head"><div><h2>${config.title}</h2><p>${config.description}</p></div></div>${cards||'<div class="fl-cloud-note bad">تعذر تحميل الإعدادات. حدّث الصفحة وحاول مرة أخرى.</div>'}`);
    module?.bind(()=>renderOwnerSettingsPage(scope));
  }

  function renderOverview(){
    const allowed=allowedAdminViews();
    const visible=products.filter(p=>p.is_visible!==false).length;
    const profileReady=Boolean(profile.full_name||profile.brand_name||profile.company_name||profile.logo_path||profile.portrait_path);
    const statCards=[];
    if(allowed.has('sections'))statCards.push([categories.length,'الأقسام']);
    if(allowed.has('products'))statCards.push([products.length,'إجمالي المنتجات'],[visible,'المنتجات الظاهرة']);
    if(allowed.has('datasheet'))statCards.push(['✓','صمّم داتا شيت']);
    if(allowed.has('profile'))statCards.push([profileReady?'✓':'—','بيانات البطاقة']);
    if(allowed.has('contacts'))statCards.push([contacts.length,'وسائل التواصل']);
    if(allowed.has('leads'))statCards.push([window.FL_ADMIN_LEADS?.totalForStats()||0,'جهات اتصال العملاء']);
    const statsHtml=statCards.length?`<div class="fl-cloud-stats">${statCards.map(([value,label])=>`<div class="fl-cloud-stat"><strong>${value}</strong><span>${label}</span></div>`).join('')}</div>`:'';
    const contentShortcuts=adminViewItems.filter(([key])=>allowed.has(key)).map(([key,label])=>ownerShortcutButton(key,label,'فتح القسم وإدارته')).join('');
    const ownerShortcuts=isPrimaryAdmin?`${ownerShortcutButton('search-filters','فلاتر البحث','اختر الفلاتر وأضف فلاتر خاصة بك')}${ownerShortcutButton('site-settings','إعدادات الموقع','دخول العملاء وتثبيت التطبيق')}${ownerShortcutButton('business-settings','بيانات الشركة','خانات مرنة لبيانات المنشأة وإعدادات الخصوصية')}${ownerShortcutButton('bank-settings','الحسابات البنكية','إدارة حسابات التحويل ونسخ IBAN')}${ownerShortcutButton('template-settings','قالب المنتجات','الباركود ورقم التذييل')}${ownerShortcutButton('credentials','بيانات تسجيل الدخول','حسابات المدير والأدمن والاستعادة')}${ownerShortcutButton('permissions','صلاحيات الأدمن','تحديد ما يستطيع الأدمن الوصول إليه')}`:'';
    layout(`<div class="fl-cloud-head"><div><h2>${isPrimaryAdmin?'الرئيسية':'لوحة الأدمن'}</h2><p>${isPrimaryAdmin?'ملخص سريع للموقع. كل نوع من الإعدادات أصبح في صفحته الخاصة لتبقى اللوحة مرتبة وواضحة.':'الأقسام المتاحة لحسابك حسب الصلاحيات المحددة.'}</p></div></div>
      ${statsHtml}
      ${contentShortcuts?`<section class="fl-overview-section"><div class="fl-overview-section-head"><h3>إدارة المحتوى</h3><p>الأقسام التشغيلية للموقع.</p></div><div class="fl-overview-shortcuts">${contentShortcuts}</div></section>`:''}
      ${ownerShortcuts?`<section class="fl-overview-section"><div class="fl-overview-section-head"><h3>الإعدادات والحسابات</h3><p>إعدادات المالك فقط، ولا تظهر للأدمن الفرعي.</p></div><div class="fl-overview-shortcuts">${ownerShortcuts}</div></section>`:''}
      <div class="fl-cloud-note ok">الحساب الحالي: <b dir="ltr">${esc(currentAdminEmail)}</b> · ${isPrimaryAdmin?'المدير':'الأدمن'}</div>`);
    body.querySelectorAll('[data-overview-view]').forEach(button=>button.addEventListener('click',()=>{view=normalizeAdminView(button.dataset.overviewView);renderApp();}));
  }

  function primaryRecoverySettingsCardHtml(){
    return `<form id="flPrimaryRecoverySettingsForm" class="fl-cloud-card fl-primary-recovery-card">
      <div class="fl-credentials-card-head"><div><span class="fl-account-badge recovery">البريد الأساسي</span><h3>البريد الأساسي للاستعادة</h3></div></div>
      <p>هذا البريد يستقبل رابطًا محميًا تستطيع من خلاله تغيير بريد أو كلمة مرور المدير والأدمن، حتى عند نسيان كلمة المرور القديمة.</p>
      <div class="fl-cloud-field"><label for="flPrimaryRecoveryEmail">البريد الأساسي للاستعادة</label><input id="flPrimaryRecoveryEmail" type="email" autocomplete="email" dir="ltr" required value="${esc(primaryRecoveryEmail)}" placeholder="recovery@example.com"><small id="flPrimaryRecoveryStatus">جاري التحقق من الإعداد الحالي...</small></div>
      <div class="fl-cloud-field"><label for="flPrimaryRecoveryCurrentPassword">كلمة مرور المدير الحالية</label><input id="flPrimaryRecoveryCurrentPassword" type="password" autocomplete="current-password" required><small>مطلوبة فقط عند حفظ أو استبدال البريد الأساسي.</small></div>
      <div class="fl-cloud-actions fl-credentials-actions"><button class="fl-cloud-btn primary" id="flPrimaryRecoverySave" type="submit">حفظ البريد الأساسي</button><button class="fl-cloud-btn secondary" id="flPrimaryRecoveryTest" type="button">إرسال رابط اختبار</button></div>
    </form>`;
  }

  function bindPrimaryRecoverySettings(){
    const recoveryInput=document.getElementById('flPrimaryRecoveryEmail');
    const recoveryStatus=document.getElementById('flPrimaryRecoveryStatus');
    const testButton=document.getElementById('flPrimaryRecoveryTest');
    if(!recoveryInput)return;
    fetchPrimaryRecoverySettings().then(data=>{
      if(recoveryInput&&!recoveryInput.value)recoveryInput.value=primaryRecoveryEmail;
      if(recoveryStatus)recoveryStatus.textContent=data?.configured?'تم ربط هذا البريد بنظام الاستعادة.':'لم يتم تحديد بريد أساسي بعد.';
      if(testButton)testButton.disabled=!primaryRecoveryEmail;
    }).catch(async error=>{
      if(recoveryStatus)recoveryStatus.textContent=await edgeFunctionErrorMessage(error,error?.functionData);
      if(testButton)testButton.disabled=true;
    });

    document.getElementById('flPrimaryRecoverySettingsForm')?.addEventListener('submit',async event=>{
      event.preventDefault();
      const email=recoveryInput.value.trim().toLowerCase();
      const currentPassword=document.getElementById('flPrimaryRecoveryCurrentPassword').value;
      const save=document.getElementById('flPrimaryRecoverySave');
      if(!email){notify('اكتب البريد الأساسي للاستعادة');return;}
      save.disabled=true;save.textContent='جاري الحفظ...';
      try{
        const {error:verifyError}=await db.auth.signInWithPassword({email:currentAdminEmail,password:currentPassword});
        if(verifyError)throw verifyError;
        const {data,error}=await db.functions.invoke('manage-admin-account',{body:{action:'save_recovery_email',email}});
        if(error||data?.error)throw Object.assign(error||new Error(data.error),{functionData:data});
        primaryRecoveryEmail=String(data?.recovery_email||email);
        recoveryInput.value=primaryRecoveryEmail;
        document.getElementById('flPrimaryRecoveryCurrentPassword').value='';
        if(recoveryStatus)recoveryStatus.textContent='تم ربط هذا البريد بنظام الاستعادة.';
        if(testButton)testButton.disabled=false;
        await sendPrimaryRecoveryAccessLink(primaryRecoveryEmail);
        notify('تم حفظ البريد الأساسي وإرسال رابط اختبار إليه');
      }catch(error){
        const message=error?.functionData?await edgeFunctionErrorMessage(error,error.functionData):authErrorMessage(error,'تعذر حفظ البريد الأساسي');
        notify(message);
      }finally{
        save.disabled=false;save.textContent='حفظ البريد الأساسي';
      }
    });

    testButton?.addEventListener('click',async()=>{
      const email=String(primaryRecoveryEmail||recoveryInput?.value||'').trim();
      if(!primaryRecoveryEmail){notify('احفظ البريد الأساسي أولًا');return;}
      testButton.disabled=true;testButton.textContent='جاري الإرسال...';
      try{await sendPrimaryRecoveryAccessLink(email);notify('تم إرسال رابط الاستعادة إلى البريد الأساسي');}
      catch(error){notify(authErrorMessage(error,'تعذر إرسال رابط الاختبار'));}
      finally{testButton.disabled=false;testButton.textContent='إرسال رابط اختبار';}
    });
  }

  async function edgeFunctionErrorMessage(error,data){
    if(data?.error)return String(data.error);
    try{
      const response=error?.context;
      if(response?.clone){
        const payload=await response.clone().json();
        if(payload?.error)return String(payload.error);
      }
    }catch(_){/* The function response was not JSON. */}
    const message=String(error?.message||error||'');
    if(/Failed to send|not found|404|FunctionsFetchError/i.test(message))return 'وظيفة إدارة الحساب غير مفعلة بعد في Supabase. انشر manage-admin-account ثم حاول مجددًا.';
    return message||'تعذر الاتصال بوظيفة إدارة الحساب.';
  }

  async function renderPrimaryRecoveryPortal(){
    if(recoveryPortalRendered)return;
    recoveryPortalRendered=true;
    logoutBtn.hidden=false;
    if(primaryAdminBtn)primaryAdminBtn.hidden=true;
    if(assistantAdminBtn)assistantAdminBtn.hidden=true;
    if(adminTitle)adminTitle.textContent='استعادة حسابات الإدارة';
    if(adminSubtitle)adminSubtitle.textContent='تغيير آمن عبر البريد الأساسي';
    body.innerHTML=`<div class="fl-cloud-wrap"><div class="fl-cloud-login"><h2>جاري التحقق من رابط الاستعادة...</h2><p>انتظر لحظة.</p></div></div>`;
    try{
      const {data,error}=await db.functions.invoke('manage-admin-account',{body:{action:'get_recovery_context'}});
      if(error||data?.error)throw Object.assign(error||new Error(data.error),{functionData:data});
      recoveryContext=data||{};
    }catch(error){
      const message=await edgeFunctionErrorMessage(error,error?.functionData);
      body.innerHTML=`<div class="fl-cloud-wrap"><div class="fl-cloud-login"><h2>تعذر فتح الاستعادة</h2><p>${esc(message)}</p><button class="fl-cloud-btn secondary" id="flRecoveryPortalExit" type="button">العودة لتسجيل الدخول</button></div></div>`;
      document.getElementById('flRecoveryPortalExit')?.addEventListener('click',()=>logoutBtn.click());
      return;
    }

    const hasAdmin=Boolean(recoveryContext?.has_admin);
    body.innerHTML=`<div class="fl-cloud-wrap"><div class="fl-recovery-portal">
      <div class="fl-cloud-head"><div><h2>استعادة حسابات الإدارة</h2><p>تم التحقق من البريد الأساسي. يمكنك الآن تغيير البريد الإلكتروني أو كلمة المرور للمدير أو الأدمن.</p></div></div>
      <div class="fl-cloud-note ok">البريد الأساسي الموثّق: <b dir="ltr">${esc(recoveryContext?.recovery_email||'')}</b></div>
      <form id="flRecoveryAccountsForm" class="fl-cloud-card fl-recovery-account-form">
        <div class="fl-cloud-field"><label for="flRecoveryTargetRole">الحساب المطلوب تعديله</label><select id="flRecoveryTargetRole"><option value="owner">المدير</option>${hasAdmin?'<option value="subadmin">الأدمن</option>':''}</select></div>
        <div class="fl-cloud-field"><label for="flRecoveryTargetEmail">البريد الإلكتروني</label><input id="flRecoveryTargetEmail" type="email" autocomplete="off" dir="ltr" required></div>
        <div class="fl-cloud-field"><label for="flRecoveryTargetPassword">كلمة مرور جديدة <small>(اختياري)</small></label><input id="flRecoveryTargetPassword" type="password" autocomplete="new-password" minlength="8" placeholder="اتركها فارغة إذا أردت تغيير البريد فقط"></div>
        <div class="fl-cloud-field"><label for="flRecoveryTargetConfirm">تأكيد كلمة المرور الجديدة</label><input id="flRecoveryTargetConfirm" type="password" autocomplete="new-password" minlength="8"></div>
        <div class="fl-cloud-note">يمكنك تغيير البريد فقط، أو كلمة المرور فقط، أو كليهما. لا تحتاج إلى معرفة كلمة المرور القديمة.</div>
        <div class="fl-cloud-actions fl-credentials-actions"><button class="fl-cloud-btn primary" id="flRecoveryAccountSave" type="submit">حفظ بيانات الحساب</button><button class="fl-cloud-btn secondary" id="flRecoveryPortalExit" type="button">إنهاء الاستعادة</button></div>
      </form>
    </div></div>`;

    const roleSelect=document.getElementById('flRecoveryTargetRole');
    const emailInput=document.getElementById('flRecoveryTargetEmail');
    const fillTargetEmail=()=>{
      emailInput.value=roleSelect.value==='owner'?String(recoveryContext?.owner_email||''):String(recoveryContext?.admin_email||'');
    };
    roleSelect.addEventListener('change',fillTargetEmail);
    fillTargetEmail();
    document.getElementById('flRecoveryPortalExit')?.addEventListener('click',()=>logoutBtn.click());
    document.getElementById('flRecoveryAccountsForm')?.addEventListener('submit',async event=>{
      event.preventDefault();
      const role=roleSelect.value;
      const email=emailInput.value.trim();
      const password=document.getElementById('flRecoveryTargetPassword').value;
      const confirmation=document.getElementById('flRecoveryTargetConfirm').value;
      const currentEmail=role==='owner'?String(recoveryContext?.owner_email||''):String(recoveryContext?.admin_email||'');
      const save=document.getElementById('flRecoveryAccountSave');
      if(password && password.length<8){notify('كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل');return;}
      if(password!==confirmation){notify('تأكيد كلمة المرور الجديدة غير مطابق');return;}
      if(email.toLowerCase()===currentEmail.toLowerCase()&&!password){notify('غيّر البريد أو أدخل كلمة مرور جديدة');return;}
      save.disabled=true;save.textContent='جاري الحفظ...';
      try{
        const {data,error}=await db.functions.invoke('manage-admin-account',{body:{action:'recovery_update_credentials',role,email,password:password||null}});
        if(error||data?.error)throw Object.assign(error||new Error(data.error),{functionData:data});
        if(role==='owner')recoveryContext.owner_email=String(data?.email||email);
        else recoveryContext.admin_email=String(data?.email||email);
        document.getElementById('flRecoveryTargetPassword').value='';
        document.getElementById('flRecoveryTargetConfirm').value='';
        fillTargetEmail();
        notify(`تم تحديث بيانات ${role==='owner'?'المدير':'الأدمن'} بنجاح`);
      }catch(error){
        const message=await edgeFunctionErrorMessage(error,error?.functionData);
        notify(message);
      }finally{
        save.disabled=false;save.textContent='حفظ بيانات الحساب';
      }
    });
  }

  function renderCredentials(){
    const hasAdmin=Boolean(managedAdmin2Email);
    const adminCard=hasAdmin?`<div class="fl-cloud-card fl-credentials-card">
          <div class="fl-credentials-card-head"><div><span class="fl-account-badge admin">الأدمن</span><h3>حساب الأدمن</h3></div></div>
          <div class="fl-account-current-email"><small>البريد الحالي</small><strong dir="ltr">${esc(managedAdmin2Email)}</strong></div>
          <p>لتغيير بريد الأدمن أو كلمة مروره، أرسل رابطًا إلى البريد الأساسي ثم أكمل التغيير من الصفحة المحمية.</p>
          <button class="fl-cloud-btn primary" id="flAdminRecoveryLink" type="button">إرسال رابط تغيير بيانات الأدمن</button>
        </div>`:`<form id="flAdminCredentialsForm" class="fl-cloud-card fl-credentials-card">
          <div class="fl-credentials-card-head"><div><span class="fl-account-badge admin">الأدمن</span><h3>إنشاء حساب الأدمن</h3></div></div>
          <div class="fl-cloud-field"><label for="flManagedAdminEmail">بريد الأدمن</label><input id="flManagedAdminEmail" type="email" autocomplete="off" dir="ltr" required placeholder="admin@example.com"></div>
          <div class="fl-cloud-field"><label for="flManagedAdminPassword">كلمة المرور</label><input id="flManagedAdminPassword" type="password" autocomplete="new-password" minlength="8" required placeholder="8 أحرف على الأقل"></div>
          <div class="fl-cloud-field"><label for="flManagedAdminConfirm">تأكيد كلمة المرور</label><input id="flManagedAdminConfirm" type="password" autocomplete="new-password" minlength="8" required></div>
          <button class="fl-cloud-btn primary" id="flAdminCredentialsSave" type="submit">إنشاء حساب الأدمن</button>
        </form>`;
    layout(`<div class="fl-cloud-head"><div><h2>بيانات تسجيل الدخول</h2><p>إدارة حسابي المدير والأدمن والبريد الأساسي للاستعادة من مكان واحد.</p></div></div>
      ${primaryRecoverySettingsCardHtml()}
      <div class="fl-cloud-note ok" id="flCredentialsRecoveryStatus">جاري تحميل البريد الأساسي...</div>
      <div class="fl-credentials-grid">
        <div class="fl-cloud-card fl-credentials-card">
          <div class="fl-credentials-card-head"><div><span class="fl-account-badge owner">المدير</span><h3>حساب المدير</h3></div></div>
          <div class="fl-account-current-email"><small>البريد الحالي</small><strong dir="ltr">${esc(currentAdminEmail)}</strong></div>
          <p>يمكنك تغيير بريد المدير أو كلمة مروره حتى لو نسيت كلمة المرور القديمة.</p>
          <button class="fl-cloud-btn primary" id="flOwnerRecoveryLink" type="button">إرسال رابط تغيير بيانات المدير</button>
        </div>
        ${adminCard}
      </div>`);

    const status=document.getElementById('flCredentialsRecoveryStatus');
    fetchPrimaryRecoverySettings().then(data=>{
      status.innerHTML=data?.configured?`ترسل جميع روابط الاستعادة إلى: <b dir="ltr">${esc(primaryRecoveryEmail)}</b>`:'لم تحدد البريد الأساسي بعد. انتقل إلى الرئيسية وحدده أولًا.';
    }).catch(async error=>{status.classList.remove('ok');status.classList.add('bad');status.textContent=await edgeFunctionErrorMessage(error,error?.functionData);});

    const sendLink=async button=>{
      if(!primaryRecoveryEmail){
        try{await fetchPrimaryRecoverySettings();}catch(error){notify(await edgeFunctionErrorMessage(error,error?.functionData));return;}
      }
      if(!primaryRecoveryEmail){notify('حدد البريد الأساسي من الصفحة الرئيسية أولًا');return;}
      button.disabled=true;const oldText=button.textContent;button.textContent='جاري الإرسال...';
      try{await sendPrimaryRecoveryAccessLink(primaryRecoveryEmail);notify('تم إرسال رابط التغيير إلى البريد الأساسي');}
      catch(error){notify(authErrorMessage(error,'تعذر إرسال رابط الاستعادة'));}
      finally{button.disabled=false;button.textContent=oldText;}
    };
    bindPrimaryRecoverySettings();
    document.getElementById('flOwnerRecoveryLink')?.addEventListener('click',event=>sendLink(event.currentTarget));
    document.getElementById('flAdminRecoveryLink')?.addEventListener('click',event=>sendLink(event.currentTarget));

    document.getElementById('flAdminCredentialsForm')?.addEventListener('submit',async event=>{
      event.preventDefault();
      const email=document.getElementById('flManagedAdminEmail').value.trim();
      const password=document.getElementById('flManagedAdminPassword').value;
      const confirmation=document.getElementById('flManagedAdminConfirm').value;
      const save=document.getElementById('flAdminCredentialsSave');
      if(password.length<8){notify('كلمة المرور يجب أن تكون 8 أحرف على الأقل');return;}
      if(password!==confirmation){notify('تأكيد كلمة المرور الجديدة غير مطابق');return;}
      save.disabled=true;save.textContent='جاري الحفظ...';
      try{
        const {data,error}=await db.functions.invoke('manage-admin-account',{body:{action:'save_admin_credentials',email,password:password||null,permissions:[...managedAdmin2Permissions]}});
        if(error||data?.error)throw Object.assign(error||new Error(data.error),{functionData:data});
        managedAdmin2Email=String(data?.email||email);
        managedAdmin2Permissions=new Set(normalizePermissionList(data));
        renderCredentials();
        notify('تم إنشاء حساب الأدمن بنجاح');
      }catch(error){
        const message=await edgeFunctionErrorMessage(error,error?.functionData);
        notify(message);
        save.disabled=false;save.textContent='إنشاء حساب الأدمن';
      }
    });
  }


  function profileImagePreview(path,kind){
    if(!path) return '<div class="fl-cloud-empty" style="padding:18px 8px">لا توجد صورة</div>';
    return `<img class="${kind==='logo'?'logo-preview':''}" src="${esc(imageUrl(path))}" alt="">`;
  }

  function renderProfile(){
    layout(`<div class="fl-cloud-head"><div><h2>البيانات الشخصية</h2><p>كل الحقول اختيارية. إذا تركت الحقل فارغًا فلن يظهر في الموقع.</p></div></div>
      <div class="fl-cloud-card">
        <form id="flProfileForm">
          <div class="fl-cloud-form">
            <div class="fl-cloud-field"><label>اسم الشخص</label><input id="flProfileName" value="${esc(profile.full_name||'')}" placeholder="مثال: محمد أحمد"></div>
            <div class="fl-cloud-field"><label>اسم العلامة / المتجر</label><input id="flProfileBrand" value="${esc(profile.brand_name||'')}" placeholder="مثال: اسم المتجر أو العلامة"></div>
            <div class="fl-cloud-field"><label>المسمى الوظيفي بالعربي</label><input id="flProfileJobAr" value="${esc(profile.job_title_ar||'')}" placeholder="مثال: مدير مبيعات"></div>
            <div class="fl-cloud-field"><label>المسمى الوظيفي بالإنجليزي</label><input id="flProfileJobEn" value="${esc(profile.job_title_en||'')}" placeholder="مثال: Sales Manager"></div>
            <div class="fl-cloud-field full"><label>اسم الشركة / السطر الثاني</label><input id="flProfileCompany" value="${esc(profile.company_name||'')}" placeholder="مثال: اسم الشركة"></div>
            <div class="fl-cloud-field full">
              <div class="fl-profile-images">
                <div class="fl-profile-image-card">${profileImagePreview(profile.logo_path,'logo')}<label><b>شعار الشركة</b><input id="flProfileLogo" type="file" accept="image/*"></label>${profile.logo_path?'<label class="fl-cloud-check"><input id="flRemoveLogo" type="checkbox"> حذف الشعار الحالي</label>':''}</div>
                <div class="fl-profile-image-card">${profileImagePreview(profile.portrait_path,'portrait')}<label><b>الصورة الشخصية</b><input id="flProfilePortrait" type="file" accept="image/*"></label>${profile.portrait_path?'<label class="fl-cloud-check"><input id="flRemovePortrait" type="checkbox"> حذف الصورة الحالية</label>':''}</div>
              </div>
            </div>
          </div>
          <div class="fl-cloud-dialog-actions"><button class="fl-cloud-btn primary" id="flProfileSave" type="submit">حفظ البيانات</button></div>
        </form>
      </div>`);
    document.getElementById('flProfileForm').addEventListener('submit',saveProfile);
  }

  async function saveProfile(e){
    e.preventDefault();
    const btn=document.getElementById('flProfileSave');btn.disabled=true;btn.textContent='جاري الحفظ...';
    const oldLogo=profile.logo_path||'';
    const oldPortrait=profile.portrait_path||'';
    const uploaded=[];
    const deleteAfterSave=[];
    try{
      let logo_path=oldLogo, portrait_path=oldPortrait;
      const logoFile=document.getElementById('flProfileLogo').files?.[0];
      const portraitFile=document.getElementById('flProfilePortrait').files?.[0];
      const removeLogo=Boolean(document.getElementById('flRemoveLogo')?.checked);
      const removePortrait=Boolean(document.getElementById('flRemovePortrait')?.checked);

      if(removeLogo){if(isStoragePath(oldLogo))deleteAfterSave.push(oldLogo);logo_path='';}
      if(removePortrait){if(isStoragePath(oldPortrait))deleteAfterSave.push(oldPortrait);portrait_path='';}
      if(logoFile){
        const next=await uploadBlob(await fileToOptimizedBlob(logoFile),'site-assets');uploaded.push(next);
        if(isStoragePath(oldLogo) && !deleteAfterSave.includes(oldLogo)) deleteAfterSave.push(oldLogo);
        logo_path=next;
      }
      if(portraitFile){
        const next=await uploadBlob(await fileToOptimizedBlob(portraitFile),'site-assets');uploaded.push(next);
        if(isStoragePath(oldPortrait) && !deleteAfterSave.includes(oldPortrait)) deleteAfterSave.push(oldPortrait);
        portrait_path=next;
      }

      const payload={
        id:1,
        full_name:document.getElementById('flProfileName').value.trim(),
        brand_name:document.getElementById('flProfileBrand').value.trim(),
        company_name:document.getElementById('flProfileCompany').value.trim(),
        job_title_ar:document.getElementById('flProfileJobAr').value.trim(),
        job_title_en:document.getElementById('flProfileJobEn').value.trim(),
        logo_path,portrait_path
      };
      const {error}=await db.from('site_profile').upsert(payload,{onConflict:'id'});
      if(error) throw error;
      if(deleteAfterSave.length) await db.storage.from(bucket).remove([...new Set(deleteAfterSave)]);
      profile={...profile,...payload};await loadPublicProfile();renderProfile();notify('تم حفظ البيانات وظهرت على الموقع');
    }catch(err){
      if(uploaded.length) await db.storage.from(bucket).remove(uploaded);
      notify('تعذر الحفظ: '+(err.message||err));btn.disabled=false;btn.textContent='حفظ البيانات';
    }
  }

  function contactTypeName(type){return contactLabels[type]||type||'وسيلة تواصل';}
  function contactRows(list){
    if(!list.length)return '<div class="fl-cloud-empty">لا توجد وسائل تواصل بعد.</div>';
    return `<div class="fl-cloud-list">${list.map(item=>`<div class="fl-cloud-row"><div class="fl-cloud-row-meta"><div style="display:flex;gap:7px;align-items:center;flex-wrap:wrap"><strong>${esc(item.label||contactTypeName(item.type))}</strong><span class="fl-contact-type">${esc(contactTypeName(item.type))}</span></div><small dir="ltr">${esc(item.value||'')}</small><small>${item.is_visible===false?'مخفي':'ظاهر'} · ترتيب ${Number(item.sort_order||0)}</small></div><div class="fl-cloud-row-actions"><button class="fl-cloud-mini" data-contact-edit="${item.id}" type="button">تعديل</button><button class="fl-cloud-mini red" data-contact-delete="${item.id}" type="button">حذف</button></div></div>`).join('')}</div>`;
  }

  function renderContacts(){
    layout(`<div class="fl-cloud-head"><div><h2>وسائل التواصل</h2><p>يمكنك إضافة أكثر من رقم جوال، وأكثر من واتساب، وأكثر من موقع إلكتروني.</p></div><button class="fl-cloud-btn primary" id="flAddContact" type="button">+ إضافة وسيلة</button></div><div class="fl-cloud-card">${contactRows(contacts)}</div>`);
    document.getElementById('flAddContact').addEventListener('click',()=>openContactForm());
    bindContactActions();
  }
  function bindContactActions(){
    body.querySelectorAll('[data-contact-edit]').forEach(b=>b.addEventListener('click',()=>openContactForm(contacts.find(c=>c.id===b.dataset.contactEdit))));
    body.querySelectorAll('[data-contact-delete]').forEach(b=>b.addEventListener('click',()=>deleteContact(b.dataset.contactDelete)));
  }
  function openContactForm(item=null){
    const type=item?.type||'phone';
    openModal(item?'تعديل وسيلة التواصل':'إضافة وسيلة تواصل',`<form id="flContactForm"><div class="fl-cloud-form">
      <div class="fl-cloud-field"><label>النوع</label><select id="flContactType"><option value="phone" ${type==='phone'?'selected':''}>جوال</option><option value="whatsapp" ${type==='whatsapp'?'selected':''}>واتساب</option><option value="website" ${type==='website'?'selected':''}>موقع إلكتروني</option><option value="email" ${type==='email'?'selected':''}>بريد إلكتروني</option><option value="location" ${type==='location'?'selected':''}>رابط موقع / خرائط</option></select></div>
      <div class="fl-cloud-field"><label>الترتيب</label><input id="flContactSort" type="number" min="0" step="1" value="${Number(item?.sort_order||0)}"></div>
      <div class="fl-cloud-field full"><label>الاسم الظاهر (اختياري)</label><input id="flContactLabel" value="${esc(item?.label||'')}" placeholder="مثال: جوال المبيعات، واتساب الطلبات، الموقع الرسمي"></div>
      <div class="fl-cloud-field full"><label>الرقم أو الرابط</label><input id="flContactValue" required value="${esc(item?.value||'')}" placeholder="مثال: 0570000000 أو https://example.com"></div>
      <label class="fl-cloud-check full"><input id="flContactVisible" type="checkbox" ${item?.is_visible===false?'':'checked'}> إظهار للزوار</label>
      </div><div class="fl-cloud-dialog-actions"><button class="fl-cloud-btn primary" type="submit">حفظ</button><button class="fl-cloud-btn" id="flContactCancel" type="button">إلغاء</button></div></form>`);
    document.getElementById('flContactCancel').addEventListener('click',closeModal);
    document.getElementById('flContactForm').addEventListener('submit',async e=>{
      e.preventDefault();
      const payload={type:document.getElementById('flContactType').value,label:document.getElementById('flContactLabel').value.trim(),value:document.getElementById('flContactValue').value.trim(),sort_order:Number(document.getElementById('flContactSort').value)||0,is_visible:document.getElementById('flContactVisible').checked};
      const res=item?await db.from('contact_items').update(payload).eq('id',item.id):await db.from('contact_items').insert(payload);
      if(res.error){notify('تعذر الحفظ: '+res.error.message);return;}
      closeModal();await loadContactsAdminData();await loadPublicProfile();renderContacts();notify('تم حفظ وسيلة التواصل');
    });
  }
  async function deleteContact(id){
    const item=contacts.find(c=>c.id===id);if(!item||!confirm(`حذف «${item.label||contactTypeName(item.type)}»؟`))return;
    const {error}=await db.from('contact_items').delete().eq('id',id);if(error){notify('تعذر الحذف: '+error.message);return;}
    contacts=contacts.filter(c=>c.id!==id);await loadPublicProfile();renderContacts();notify('تم حذف وسيلة التواصل');
  }

  function vcardEscape(value){return String(value||'').replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');}
  function sectionAdminRows(){
    const combined=[
      ...categories.map(c=>({type:'category',sort_order:Number(c.sort_order)||0,created_at:c.created_at||'',row:c})),
      ...siteCatalogs.map(c=>({type:'catalog',sort_order:Number(c.sort_order)||0,created_at:c.created_at||'',row:c}))
    ].sort((a,b)=>a.sort_order-b.sort_order || String(a.created_at).localeCompare(String(b.created_at)));
    if(!combined.length) return `<div class="fl-cloud-empty">لا توجد أقسام أو كتالوجات بعد.</div>`;
    return `<div class="fl-cloud-list">${combined.map(item=>{
      if(item.type==='catalog'){
        const c=item.row;
        return `<div class="fl-cloud-row"><div class="fl-cloud-row-meta"><strong>${esc(c.name||'كتالوج')}</strong><small>كتالوج PDF · الترتيب ${Number(c.sort_order)||0} · ${c.is_visible===false?'مخفي':'ظاهر'}</small></div><div class="fl-cloud-row-actions"><button class="fl-cloud-mini" data-section-catalog-open="${c.id}" type="button">فتح</button><button class="fl-cloud-mini" data-section-catalog-edit="${c.id}" type="button">تعديل</button><button class="fl-cloud-mini red" data-section-catalog-delete="${c.id}" type="button">حذف</button></div></div>`;
      }
      const c=item.row;const count=products.filter(p=>p.category_id===c.id).length;
      return `<div class="fl-cloud-row"><div class="fl-cloud-row-meta"><strong>${esc(c.name)}</strong><small>${count} منتج · الترتيب ${Number(c.sort_order)||0} · ${c.is_visible===false?'مخفي':'ظاهر'}</small></div><div class="fl-cloud-row-actions"><button class="fl-cloud-mini" data-cat-products="${c.id}" type="button">المنتجات</button><button class="fl-cloud-mini" data-cat-edit="${c.id}" type="button">تعديل</button><button class="fl-cloud-mini red" data-cat-delete="${c.id}" type="button">حذف</button></div></div>`;
    }).join('')}</div>`;
  }

  function renderSections(){
    layout(`<div class="fl-cloud-head"><div><h2>الأقسام والكتالوجات</h2><p>الأقسام والكتالوجات PDF تستخدم نفس رقم الترتيب. مثال: إذا كان الكتالوج ترتيبه 1 والبلفون 2 فسيظهر الكتالوج قبله للزوار.</p></div><div class="fl-cloud-head-actions"><button class="fl-cloud-btn" id="flAddCatalogFromSections" type="button">+ كتالوج PDF</button><button class="fl-cloud-btn primary" id="flAddCategory" type="button">+ قسم جديد</button></div></div><div class="fl-cloud-card">${sectionAdminRows()}</div>`);
    document.getElementById('flAddCategory')?.addEventListener('click',()=>openCategoryForm());
    document.getElementById('flAddCatalogFromSections')?.addEventListener('click',()=>openCatalogForm());
    bindCategoryActions();
  }
  function bindCategoryActions(){
    body.querySelectorAll('[data-cat-products]').forEach(b=>b.addEventListener('click',()=>{selectedCategory=b.dataset.catProducts;selectedProductNode=`category:${b.dataset.catProducts}`;view='products';renderProducts();}));
    body.querySelectorAll('[data-cat-edit]').forEach(b=>b.addEventListener('click',()=>openCategoryForm(categories.find(c=>c.id===b.dataset.catEdit))));
    body.querySelectorAll('[data-cat-delete]').forEach(b=>b.addEventListener('click',()=>deleteCategory(b.dataset.catDelete)));
    body.querySelectorAll('[data-section-catalog-open]').forEach(b=>b.addEventListener('click',()=>{selectedProductNode=`catalog:${b.dataset.sectionCatalogOpen}`;view='products';renderProducts();}));
    body.querySelectorAll('[data-section-catalog-edit]').forEach(b=>b.addEventListener('click',()=>openCatalogForm(siteCatalogs.find(c=>String(c.id)===String(b.dataset.sectionCatalogEdit)))));
    body.querySelectorAll('[data-section-catalog-delete]').forEach(b=>b.addEventListener('click',()=>deleteCatalog(b.dataset.sectionCatalogDelete)));
  }


  function adminGalleryRows(prod){ return window.FL_ADMIN_PRODUCTS?.adminGalleryRows(prod) || []; }
  function categoryProductsInOrder(categoryId){ return window.FL_ADMIN_PRODUCTS?.categoryProductsInOrder(categoryId) || []; }
  function nextProductSort(categoryId){ return window.FL_ADMIN_PRODUCTS?.nextProductSort(categoryId) ?? 0; }
  async function duplicateProduct(id){
    const fn=window.FL_ADMIN_PRODUCTS?.duplicateProduct;
    if(typeof fn!=='function'){notify('تعذر تحميل وحدة المنتجات. حدّث الصفحة وحاول مرة أخرى.');return;}
    return fn(id);
  }

  async function downloadExcelTemplate(event){
    const fn=window.FL_ADMIN_IMPORT?.downloadExcelTemplate;
    if(typeof fn!=='function'){notify('تعذر تحميل وحدة الاستيراد والتصدير. حدّث الصفحة وحاول مرة أخرى.');return;}
    return fn(event);
  }
  function openProductExcelImport(){
    const fn=window.FL_ADMIN_IMPORT?.openProductExcelImport;
    if(typeof fn!=='function'){notify('تعذر تحميل وحدة الاستيراد والتصدير. حدّث الصفحة وحاول مرة أخرى.');return;}
    return fn();
  }

  async function uploadSiteCatalogPdf(file){
    if(!file) throw new Error('اختر ملف PDF');
    const type=String(file.type||'').toLowerCase();
    if(type!=='application/pdf'&&!/\.pdf$/i.test(String(file.name||''))) throw new Error('الملف يجب أن يكون PDF');
    if(Number(file.size||0)>50*1024*1024) throw new Error('حجم ملف الكتالوج يجب ألا يتجاوز 50 MB');
    const path=`catalogs/${crypto.randomUUID()}.pdf`;
    const {error}=await db.storage.from(catalogBucket).upload(path,file,{contentType:'application/pdf',upsert:false,cacheControl:'3600'});
    if(error) throw error;
    return path;
  }

  function nextCatalogSort(){
    if(!siteCatalogs.length) return 0;
    return Math.max(...siteCatalogs.map(row=>Number(row.sort_order)||0))+10;
  }

  function catalogAdminCard(catalog){
    if(!catalog) return '';
    const url=catalog.pdf_path?catalogFileUrl(catalog.pdf_path):'';
    return `<article class="fl-admin-catalog-card">
      <div class="fl-admin-catalog-icon">PDF</div>
      <div class="fl-admin-catalog-body">
        <strong>${esc(catalog.name||'كتالوج')}</strong>
        <small>${esc(catalog.file_name||'بدون ملف')} · ${catalog.is_visible===false?'مخفي':'ظاهر'}</small>
        ${catalog.description?`<p>${esc(catalog.description)}</p>`:''}
        <div class="fl-admin-catalog-actions">${url?`<a class="fl-cloud-mini" href="${esc(url)}" target="_blank" rel="noopener noreferrer">فتح PDF</a>`:''}<button class="fl-cloud-mini" data-catalog-edit="${catalog.id}" type="button">تعديل</button><button class="fl-cloud-mini red" data-catalog-delete="${catalog.id}" type="button">حذف</button></div>
      </div>
    </article>`;
  }

  async function openCatalogForm(catalog=null){
    const currentPath=String(catalog?.pdf_path||'');
    const currentName=String(catalog?.file_name||'');
    const defaultSort=catalog?Number(catalog.sort_order||0):nextCatalogSort();
    openModal(catalog?'تعديل الكتالوج':'إضافة كتالوج',`<form id="flCatalogForm">
      <div class="fl-cloud-form">
        <div class="fl-cloud-field"><label>اسم الكتالوج</label><input id="flCatalogName" required value="${esc(catalog?.name||'')}" placeholder="مثال: كتالوج الثريات 2026"></div>
        <div class="fl-cloud-field"><label>الترتيب</label><input id="flCatalogSort" type="number" min="0" step="1" value="${defaultSort}"></div>
        <div class="fl-cloud-field full"><label>وصف اختياري</label><input id="flCatalogDescription" value="${esc(catalog?.description||'')}" placeholder="مثال: أحدث موديلات الثريات"></div>
        <section class="fl-site-catalog-admin full">
          <div class="fl-site-catalog-admin-head"><span class="fl-pdf-badge">PDF</span><div><strong>${currentPath?'استبدال ملف PDF':'رفع ملف PDF'}</strong><small>يظهر هذا الكتالوج كخيار مستقل بجانب أقسام المنتجات، وعند فتحه تُعرض كل صفحات PDF.</small></div></div>
          ${currentPath?`<div class="fl-site-catalog-current"><div><strong>${esc(currentName||'catalog.pdf')}</strong><small>الملف الحالي</small></div><a class="fl-cloud-btn" href="${esc(catalogFileUrl(currentPath))}" target="_blank" rel="noopener noreferrer">فتح الحالي</a></div>`:''}
          <label class="fl-site-catalog-drop" for="flCatalogPdf"><strong>${currentPath?'اختر PDF جديدًا للاستبدال':'اختر ملف PDF'}</strong><small>PDF فقط — حتى 50 MB</small></label>
          <input id="flCatalogPdf" type="file" accept="application/pdf,.pdf" hidden ${currentPath?'':'required'}>
          <div id="flCatalogFileName" class="fl-product-pdf-name"></div>
        </section>
        <label class="fl-cloud-check full"><input id="flCatalogVisible" type="checkbox" ${catalog?.is_visible===false?'':'checked'}> إظهار الكتالوج للزوار</label>
      </div>
      <div class="fl-cloud-dialog-actions"><button class="fl-cloud-btn primary" id="flCatalogSave" type="submit">حفظ</button><button class="fl-cloud-btn" id="flCatalogCancel" type="button">إلغاء</button></div>
    </form>`);
    const input=document.getElementById('flCatalogPdf');
    const fileName=document.getElementById('flCatalogFileName');
    input?.addEventListener('change',()=>{
      const file=input.files?.[0];
      if(!file){if(fileName)fileName.textContent='';return;}
      const isPdf=String(file.type||'').toLowerCase()==='application/pdf'||/\.pdf$/i.test(String(file.name||''));
      if(!isPdf){notify('اختر ملف PDF فقط');input.value='';return;}
      if(Number(file.size||0)>50*1024*1024){notify('حجم الملف يجب ألا يتجاوز 50 MB');input.value='';return;}
      if(fileName)fileName.textContent=`تم اختيار: ${file.name} (${(file.size/1024/1024).toFixed(1)} MB)`;
    });
    document.getElementById('flCatalogCancel')?.addEventListener('click',closeModal);
    document.getElementById('flCatalogForm')?.addEventListener('submit',async event=>{
      event.preventDefault();
      const save=document.getElementById('flCatalogSave');
      const name=String(document.getElementById('flCatalogName')?.value||'').trim();
      const description=String(document.getElementById('flCatalogDescription')?.value||'').trim();
      const file=input?.files?.[0]||null;
      if(!name){notify('اكتب اسم الكتالوج');return;}
      if(!catalog&&!file){notify('اختر ملف PDF للكتالوج');return;}
      save.disabled=true;save.textContent='جاري حفظ الكتالوج...';
      let uploadedPath='';
      try{
        let pdfPath=currentPath;
        let nextFileName=currentName;
        if(file){uploadedPath=await uploadSiteCatalogPdf(file);pdfPath=uploadedPath;nextFileName=file.name||'catalog.pdf';}
        const payload={
          name,
          description,
          pdf_path:pdfPath,
          file_name:nextFileName,
          sort_order:Number(document.getElementById('flCatalogSort')?.value)||0,
          is_visible:document.getElementById('flCatalogVisible')?.checked===true,
          updated_at:new Date().toISOString()
        };
        let saved;
        if(catalog){
          const {data,error}=await db.from('site_catalogs').update(payload).eq('id',catalog.id).select().single();
          if(error) throw error;saved=data;
        }else{
          const {data,error}=await db.from('site_catalogs').insert(payload).select().single();
          if(error) throw error;saved=data;
        }
        if(currentPath&&uploadedPath&&currentPath!==uploadedPath){try{await db.storage.from(catalogBucket).remove([currentPath]);}catch(_){}}
        closeModal();
        if(catalog)siteCatalogs=siteCatalogs.map(row=>String(row.id)===String(saved.id)?saved:row);else siteCatalogs.push(saved);
        siteCatalogs.sort((a,b)=>(Number(a.sort_order)||0)-(Number(b.sort_order)||0)||String(a.created_at||'').localeCompare(String(b.created_at||'')));
        selectedProductNode=`catalog:${saved.id}`;normalizeCatalogSelections();syncPublicCatalogFromAdminCache();
        if(view==='sections') renderSections(); else renderProducts();
        notify('تم حفظ الكتالوج وسيظهر حسب ترتيبه مع الأقسام');
      }catch(error){
        if(uploadedPath){try{await db.storage.from(catalogBucket).remove([uploadedPath]);}catch(_){}}
        notify('تعذر حفظ الكتالوج: '+(error?.message||error));save.disabled=false;save.textContent='حفظ';
      }
    });
  }

  async function deleteCatalog(id){
    const catalog=siteCatalogs.find(row=>String(row.id)===String(id));
    if(!catalog||!confirm(`حذف الكتالوج «${catalog.name||'الكتالوج'}»؟`)) return;
    const path=String(catalog.pdf_path||'');
    const {error}=await db.from('site_catalogs').delete().eq('id',catalog.id);
    if(error){notify('تعذر حذف الكتالوج: '+error.message);return;}
    if(path){try{await db.storage.from(catalogBucket).remove([path]);}catch(_){}}
    siteCatalogs=siteCatalogs.filter(row=>String(row.id)!==String(catalog.id));normalizeCatalogSelections();syncPublicCatalogFromAdminCache();if(view==='sections') renderSections(); else renderProducts();notify('تم حذف الكتالوج');
  }

  function renderProducts(){
    const fn=window.FL_ADMIN_PRODUCTS?.renderProducts;
    if(typeof fn==='function')return fn();
    layout('<div class="fl-cloud-note bad">تعذر تحميل وحدة المنتجات. حدّث الصفحة وحاول مرة أخرى.</div>');
  }

  async function openCategoryForm(cat=null){
    openModal(cat?'تعديل القسم':'إضافة قسم',`<form id="flCategoryForm"><div class="fl-cloud-form"><div class="fl-cloud-field"><label>اسم القسم</label><input id="flCatName" required value="${esc(cat?.name||'')}" placeholder="مثال: جداريات"></div><div class="fl-cloud-field"><label>الترتيب</label><input id="flCatSort" type="number" min="0" step="1" value="${Number(cat?.sort_order||0)}"></div><div class="fl-cloud-field full"><label>الوصف</label><input id="flCatDesc" value="${esc(cat?.description||'')}" placeholder="وصف قصير اختياري"></div><label class="fl-cloud-check full"><input id="flCatVisible" type="checkbox" ${cat?.is_visible===false?'':'checked'}> إظهار القسم للزوار</label></div><div class="fl-cloud-dialog-actions"><button class="fl-cloud-btn primary" id="flCatSave" type="submit">حفظ</button><button class="fl-cloud-btn" id="flCatCancel" type="button">إلغاء</button></div></form>`);
    document.getElementById('flCatCancel').addEventListener('click',closeModal);
    document.getElementById('flCategoryForm').addEventListener('submit',async e=>{
      e.preventDefault();
      const save=document.getElementById('flCatSave');
      const name=document.getElementById('flCatName').value.trim();
      if(!name){notify('اكتب اسم القسم');return;}
      const duplicate=categories.some(c=>c.id!==cat?.id && String(c.name||'').trim().toLowerCase()===name.toLowerCase());
      if(duplicate){notify('يوجد قسم بهذا الاسم مسبقًا');return;}
      save.disabled=true;save.textContent='جاري الحفظ...';
      const payload={name,description:document.getElementById('flCatDesc').value.trim(),sort_order:Number(document.getElementById('flCatSort').value)||0,is_visible:document.getElementById('flCatVisible').checked};
      if(!cat) payload.slug=newCategorySlug();
      const res=cat?await db.from('categories').update(payload).eq('id',cat.id).select().single():await db.from('categories').insert(payload).select().single();
      if(res.error){
        const message=String(res.error.code)==='23505'?'تعذر الحفظ بسبب تعارض داخلي. أعد المحاولة.':res.error.message;
        notify('خطأ: '+message);save.disabled=false;save.textContent='حفظ';return;
      }
      const saved=res.data;
      if(cat)categories=categories.map(row=>row.id===saved.id?saved:row);else categories.push(saved);
      categories.sort((a,b)=>(Number(a.sort_order)||0)-(Number(b.sort_order)||0)||String(a.created_at||'').localeCompare(String(b.created_at||'')));
      normalizeCatalogSelections();closeModal();syncPublicProductsFromAdminCache();renderApp();notify('تم حفظ القسم');
    });
  }

  async function deleteCategory(id){
    const cat=categories.find(c=>c.id===id);
    if(!cat||!confirm(`حذف قسم «${cat.name}» وكل منتجاته وصورها؟`))return;
    const productIds=new Set(products.filter(p=>p.category_id===id).map(p=>p.id));
    const candidatePaths=new Set();
    products.filter(p=>productIds.has(p.id)).forEach(p=>{if(isStoragePath(p.image_path))candidatePaths.add(p.image_path);if(isStoragePath(p.catalog_pdf_path))candidatePaths.add(p.catalog_pdf_path);});
    productImages.filter(row=>productIds.has(row.product_id)).forEach(row=>{if(isStoragePath(row.image_path))candidatePaths.add(row.image_path);});
    const paths=[...candidatePaths].filter(path=>{
      const usedByOtherProduct=products.some(p=>!productIds.has(p.id) && (p.image_path===path || p.catalog_pdf_path===path)) || productImages.some(row=>!productIds.has(row.product_id) && row.image_path===path);
      return !usedByOtherProduct;
    });
    const {error}=await db.from('categories').delete().eq('id',id);
    if(error){notify('تعذر الحذف: '+error.message);return;}
    if(paths.length) await db.storage.from(bucket).remove([...new Set(paths.flatMap(productStoragePairPaths))]);
    categories=categories.filter(row=>row.id!==id);products=products.filter(row=>row.category_id!==id);productImages=productImages.filter(row=>!productIds.has(row.product_id));
    normalizeCatalogSelections();syncPublicProductsFromAdminCache();renderApp();notify('تم حذف القسم ومنتجاته');
  }

  async function fileToOptimizedBlob(file){
    const fn=window.FL_ADMIN_MEDIA?.fileToOptimizedBlob;
    if(typeof fn!=='function')throw new Error('تعذر تحميل وحدة الصور');
    return fn(file);
  }
  async function uploadBlob(blob,categoryId){
    const fn=window.FL_ADMIN_MEDIA?.uploadBlob;
    if(typeof fn!=='function')throw new Error('تعذر تحميل وحدة الصور');
    return fn(blob,categoryId);
  }
  async function uploadProductImagePair(file,categoryId){
    const fn=window.FL_ADMIN_MEDIA?.uploadProductImagePair;
    if(typeof fn!=='function')throw new Error('تعذر تحميل وحدة الصور');
    return fn(file,categoryId);
  }
  function productThumbnailPath(path){ return window.FL_ADMIN_MEDIA?.productThumbnailPath(path) || path || ''; }
  function productStoragePairPaths(path){ return window.FL_ADMIN_MEDIA?.productStoragePairPaths(path) || (path?[path]:[]); }
  async function uploadProductCatalogPdf(file,categoryId){
    const fn=window.FL_ADMIN_MEDIA?.uploadProductCatalogPdf;
    if(typeof fn!=='function')throw new Error('تعذر تحميل وحدة الصور');
    return fn(file,categoryId);
  }
  function storagePathUsedByOtherProduct(path,productId){
    const fn=window.FL_ADMIN_MEDIA?.storagePathUsedByOtherProduct;
    return typeof fn==='function'?fn(path,productId):false;
  }

  function openProductForm(prod=null){
    const fn=window.FL_ADMIN_PRODUCT_FORM?.openProductForm;
    if(typeof fn!=='function'){notify('تعذر تحميل نموذج المنتجات. حدّث الصفحة وحاول مرة أخرى.');return;}
    return fn(prod);
  }

  async function deleteProduct(id){
    const fn=window.FL_ADMIN_PRODUCTS?.deleteProduct;
    if(typeof fn!=='function'){notify('تعذر تحميل وحدة المنتجات. حدّث الصفحة وحاول مرة أخرى.');return;}
    return fn(id);
  }

  (async()=>{
    if(!configured || !db){renderSetup();return;}
    if(passwordRecoveryMode){renderPasswordRecovery();return;}
    const session=await getSession();
    if(passwordRecoveryMode){renderPasswordRecovery();return;}
    if(!session){renderLogin();return;}
    if(recoveryPortalRequested){await renderPrimaryRecoveryPortal();return;}
    try{
      await loadCurrentAdminAccess();
      await refresh();renderApp();
    }catch(err){
      await db.auth.signOut();
      renderLogin();
    }
  })();
})();
