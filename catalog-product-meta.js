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


  // Display only: keep original values and units intact for English and Excel.
  function formatProductSpecValue(spec,language='ar'){
    const value=String(spec?.value??'').trim();
    if(!value)return '';
    const key=String(spec?.key||'').trim();
    const label=String(spec?.label||'').trim();
    const unit=String(spec?.unit||'').trim();
    const standardUnit=key==='wattage'?'W':key==='lumens'?'lm':unit;
    let clean=value;
    if(key==='wattage')clean=value.replace(/\s*(?:W|واط|وات)\s*$/i,'').trim();
    else if(key==='lumens')clean=value.replace(/\s*(?:lm|لومن)\s*$/i,'').trim();
    else if(unit){
      const escaped=unit.replace(/[\^$.*+?()[\]{}|]/g,'\\window.FL_CATALOG_PRODUCT_META=Object.freeze({productDisplayName,normalizeProductAvailability,productAvailabilityLabel});');
      clean=value.replace(new RegExp('\\s*'+escaped+'\\s*
})();
,'i'),'').trim();
    }
    if(!clean)return value;
    if(language!=='en'&&key==='lumens')return clean;
    if(language!=='en'&&key==='wattage'){
      const labelHasUnit=/^(?:الواط|الوات|واط|وات)$/.test(label);
      return labelHasUnit?clean:clean+' واط';
    }
    return clean+(standardUnit?' '+standardUnit:'');
  }

window.FL_CATALOG_PRODUCT_META=Object.freeze({productDisplayName,normalizeProductAvailability,productAvailabilityLabel,formatProductSpecValue});
})();
