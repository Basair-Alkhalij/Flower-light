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

window.FL_CATALOG_PRODUCT_META=Object.freeze({productDisplayName,normalizeProductAvailability,productAvailabilityLabel});
})();
