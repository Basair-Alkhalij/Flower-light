// Flower Light — public catalog pricing. Pure helpers shared with the catalog.
(()=>{
'use strict';
  const PRICING_META_KEY = '__pricing_tiers_v2';
  const PRICE_TIER_LABELS = {
    retail: 'سعر المفرق',
    wholesale: 'سعر الجملة',
    bulk: 'سعر جملة الجملة'
  };

  function validPriceNumber(value) {
    if (value == null || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? number : null;
  }

  function validPriceQty(value) {
    if (value == null || value === '') return null;
    const qty = Math.trunc(Number(value));
    return Number.isFinite(qty) && qty >= 1 ? qty : null;
  }

  function formatPriceNumber(value) {
    const number = validPriceNumber(value);
    if (number == null) return '';
    return `${number.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ر.س`;
  }

  function productPricingTiers(item) {
    let parsed = [];
    if (Array.isArray(item?.specifications)) {
      const meta = item.specifications.find(row => row && typeof row === 'object' && String(row.key || '').trim() === PRICING_META_KEY);
      if (meta) {
        try {
          const value = typeof meta.value === 'string' ? JSON.parse(meta.value) : meta.value;
          if (Array.isArray(value)) parsed = value;
        } catch (_) {}
      }
    }

    const tiers = parsed.map(row => {
      if (!row || typeof row !== 'object') return null;
      const type = String(row.type || '').trim();
      if (!PRICE_TIER_LABELS[type]) return null;
      const price = validPriceNumber(row.price);
      if (price == null) return null;
      let minQty = type === 'retail' ? null : validPriceQty(row.min_qty);
      let maxQty = type === 'retail' ? null : validPriceQty(row.max_qty);
      if (minQty != null && maxQty != null && maxQty < minQty) [minQty, maxQty] = [maxQty, minQty];
      return { type, price, min_qty: minQty, max_qty: maxQty };
    }).filter(Boolean).slice(0, 12);

    if (tiers.length) return tiers;

    const legacy = [];
    const retail = validPriceNumber(item?.price);
    const wholesale = validPriceNumber(item?.wholesale_price);
    const wholesaleMin = validPriceQty(item?.wholesale_min_qty);
    if (retail != null) legacy.push({ type: 'retail', price: retail, min_qty: null, max_qty: null });
    if (wholesale != null) legacy.push({ type: 'wholesale', price: wholesale, min_qty: wholesaleMin, max_qty: null });
    return legacy;
  }

  function priceTierRangeNote(tier) {
    const minQty = validPriceQty(tier?.min_qty);
    const maxQty = validPriceQty(tier?.max_qty);
    if (minQty != null && maxQty != null) return `من ${minQty.toLocaleString('en-US')} إلى ${maxQty.toLocaleString('en-US')} قطعة`;
    if (minQty != null) return `من ${minQty.toLocaleString('en-US')} قطعة فأكثر`;
    if (maxQty != null) return `حتى ${maxQty.toLocaleString('en-US')} قطعة`;
    return '';
  }

  function productPricingLines(item) {
    return productPricingTiers(item).map(tier => ({
      key: tier.type,
      label: PRICE_TIER_LABELS[tier.type] || 'السعر',
      value: formatPriceNumber(tier.price),
      note: tier.type === 'retail' ? '' : priceTierRangeNote(tier)
    })).filter(row => row.value);
  }

window.FL_CATALOG_PRICING=Object.freeze({PRICING_META_KEY,validPriceNumber,validPriceQty,formatPriceNumber,productPricingTiers,priceTierRangeNote,productPricingLines});
})();
