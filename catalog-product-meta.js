// Flower Light public product display and availability helpers.
(()=>{
'use strict';
  function productDisplayName(item) {
    return item?.name || item?.caption || item?.alt || 'منتج';
  }

  const PRODUCT_AVAILABILITY_LABELS = Object.freeze({ available: 'متوفر', out_of_stock: 'نفد', coming_soon: 'قريبًا' });
  function normalizeProductAvailability(value) {
    const key = String(value || '').trim();
    return Object.hasOwn(PRODUCT_AVAILABILITY_LABELS, key) ? key : 'available';
  }
  function productAvailabilityLabel(value) {
    return PRODUCT_AVAILABILITY_LABELS[normalizeProductAvailability(value)];
  }


  // Localize technical units only when presenting values; never modify saved specifications.
  const PRODUCT_SPEC_UNIT_LABELS={
    wattage:{tokens:['W','واط','وات'],ar:'واط',en:'W'},
    lumens:{tokens:['lm','لومن'],ar:'لومن',en:'lm'},
    voltage:{tokens:['V','فولت','فولط'],ar:'فولت',en:'V'},
    cct:{tokens:['K','كلفن','كيلفن'],ar:'كلفن',en:'K'},
    frequency:{tokens:['Hz','هرتز','هيرتز'],ar:'هرتز',en:'Hz'},
    beam_angle:{tokens:['°','درجة','درجات'],ar:'°',en:'°'}
  };
  function formatProductSpecValue(spec,language='ar'){
    const value=String(spec?.value??'').trim();
    if(!value)return '';
    const key=String(spec?.key||'').trim();
    const label=String(spec?.label||'').trim();
    const unit=String(spec?.unit||'').trim();
    const known=PRODUCT_SPEC_UNIT_LABELS[key];
    const tokens=known?[...known.tokens,...(unit?[unit]:[])]:unit?[unit]:[];
    let clean=value;
    if(tokens.length){
      const escaped=tokens.map(token=>token.replace(/[\^$.*+?()[\]{}|\\]/g,'\\$&')).join('|');
      clean=value.replace(new RegExp('(?:\\s*(?:'+escaped+'))+\\s*$','i'),'').trim();
    }
    if(!clean)return value;
    const ar=language!=='en';
    const outputUnit=known?(ar?known.ar:known.en):unit;
    if(ar&&key==='lumens'&&/لومن/.test(label))return clean;
    if(ar&&key==='voltage'&&/فولت|فولط/.test(label))return clean;
    if(ar&&key==='wattage'&&/^(?:الواط|الوات|واط|وات)$/.test(label))return clean;
    if(!outputUnit)return clean;
    return clean+(outputUnit==='°'?'°':' '+outputUnit);
  }

window.FL_CATALOG_PRODUCT_META=Object.freeze({productDisplayName,normalizeProductAvailability,productAvailabilityLabel,formatProductSpecValue});
})();
