// Product specification definitions and alias normalization for the admin product editor.
(()=>{
'use strict';
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
  const PRODUCT_SPEC_ALIAS_GROUPS={sku:['sku','كود المنتج','رقم المنتج','رمز المنتج'],wattage:['wattage','power','watt','w','القدرة','القدره','الواط','وات'],lumens:['lumens','lumen','lm','اللومن','لومن','التدفق الضوئي','شدة الاضاءة','شدة الإضاءة'],cct:['cct','kelvin','k','حرارة اللون','حراره اللون','درجة حرارة اللون','درجه حراره اللون','كلفن'],cri:['cri','مؤشر تجسيد الالوان','مؤشر تجسيد الألوان'],voltage:['voltage','volt','v','الفولت','الجهد','فولت'],ip_rating:['ip_rating','ip rating','ip','درجة الحماية ip','درجه الحمايه ip','درجة الحماية','درجه الحمايه'],dimensions:['dimensions','dimension','size','المقاس','المقاسات','الأبعاد','الابعاد'],color:['color','colour','اللون'],material:['material','الخامة','الخامه'],beam_angle:['beam_angle','beam angle','زاوية الإضاءة','زاويه الاضاءه','زاوية الضوء','زاويه الضوء'],frequency:['frequency','hz','التردد'],warranty:['warranty','الضمان'],bulb_base:['bulb_base','bulb base','socket','قاعدة اللمبة','قاعده اللمبه','سوكت'],bulb_count:['bulb_count','bulb count','عدد اللمبات','عدد اللمبة','عدد اللمبه']};
  function productSpecAliasToken(value){return String(value||'').trim().toLowerCase().replace(/[\u064B-\u0652]/g,'').replace(/[إأآا]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/[_-]+/g,' ').replace(/\s+/g,' ').trim();}
  const PRODUCT_SPEC_ALIAS_MAP=(()=>{const map=new Map();PRODUCT_SPEC_FIELDS.forEach(def=>[def.key,def.label,...(PRODUCT_SPEC_ALIAS_GROUPS[def.key]||[])].forEach(alias=>{const token=productSpecAliasToken(alias);if(token)map.set(token,def.key);}));return map;})();
  function productSpecFields(){const custom=(Array.isArray(window.FLOWER_LIGHT_CUSTOM_FILTERS)?window.FLOWER_LIGHT_CUSTOM_FILTERS:[]).map(row=>({key:String(row?.key||'').trim(),label:String(row?.label||'').trim()})).filter(row=>/^custom_filter_[a-z0-9]+$/i.test(row.key)&&row.label);const seen=new Set(PRODUCT_SPEC_FIELDS.map(field=>field.key));return [...PRODUCT_SPEC_FIELDS,...custom.filter(field=>!seen.has(field.key)&&seen.add(field.key))];}
  function resolveProductSpecDefinition(key,label=''){const direct=String(key||'').trim(),fields=productSpecFields(),found=fields.find(field=>field.key===direct);if(found)return found;const aliasKey=PRODUCT_SPEC_ALIAS_MAP.get(productSpecAliasToken(direct))||PRODUCT_SPEC_ALIAS_MAP.get(productSpecAliasToken(label));if(aliasKey)return PRODUCT_SPEC_FIELDS.find(field=>field.key===aliasKey)||null;const token=productSpecAliasToken(label);return token?(fields.find(field=>productSpecAliasToken(field.label)===token)||null):null;}
  function normalizeKnownSpecValue(value,def,existingUnit=''){let text=String(value??'').trim();let unit=String(existingUnit||'').trim();const canonicalUnit=String(def?.unit||'').trim();if(canonicalUnit){const escaped=canonicalUnit.replace(/[\^$.*+?()[\]{}|\\]/g,'\\$&');text=text.replace(new RegExp(`\\s*${escaped}\\s*$`,'i'),'').trim();unit=canonicalUnit;}return {value:text,unit};}
window.FL_ADMIN_PRODUCT_SPECS=Object.freeze({PRODUCT_SPEC_FIELDS,productSpecFields,resolveProductSpecDefinition,normalizeKnownSpecValue});
})();
