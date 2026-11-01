// Visitor catalog links and WhatsApp messages. Stable URL/phone behavior.
// Factory dependencies are supplied by app.js after catalog metadata modules load.
(() => {
  'use strict';
  function create({productDisplayName,productWhatsAppOption,productSpecsText,
    WHATSAPP_META_SHOW_DESCRIPTION,WHATSAPP_META_SHOW_SPECS}){
  function normalizeWhatsAppNumber(value) {
    let digits = String(value || '').replace(/\D/g, '');
    if (digits.startsWith('00')) digits = digits.slice(2);
    if (/^05\d{8}$/.test(digits)) return `966${digits.slice(1)}`;
    if (/^5\d{8}$/.test(digits)) return `966${digits}`;
    if (/^96605\d{8}$/.test(digits)) return `966${digits.slice(4)}`;
    return digits;
  }

  function primaryWhatsAppNumber() {
    const list = Array.isArray(window.FLOWER_LIGHT_CONTACTS) ? window.FLOWER_LIGHT_CONTACTS : [];
    const value = list.find(item => item?.type === 'whatsapp' && item?.is_visible !== false)?.value || '';
    return normalizeWhatsAppNumber(value);
  }

  function productWhatsAppMessage(item) {
    const profile = window.FLOWER_LIGHT_PROFILE || {};
    const brand = profile.brand_name || profile.company_name || '';
    const name = String(item?.name || productDisplayName(item) || '').trim();
    const model = String(item?.model || '').trim();
    const description = String(item?.caption || '').trim();
    const lines = [
      brand ? `السلام عليكم، أريد الاستفسار عن منتج من ${brand}:` : 'السلام عليكم، أريد الاستفسار عن منتج:'
    ];
    if (name) lines.push(`اسم المنتج: ${name}`);
    if (model) lines.push(`رقم المنتج / الكود: ${model}`);
    const showDescription = productWhatsAppOption(item?.specifications, WHATSAPP_META_SHOW_DESCRIPTION);
    if (showDescription && description) lines.push(`الوصف: ${description}`);
    const showSpecs = productWhatsAppOption(item?.specifications, WHATSAPP_META_SHOW_SPECS);
    if (showSpecs) {
      const specLines = productSpecsText(item, 30);
      if (specLines.length) {
        lines.push('المواصفات الفنية:');
        specLines.forEach(line => lines.push(`• ${line}`));
      }
    }
    lines.push('هل يمكن تزويدي بالتفاصيل والسعر؟');
    return lines.join('\n');
  }

  function productWhatsAppUrl(item) {
    const number = primaryWhatsAppNumber();
    return number ? `https://wa.me/${number}?text=${encodeURIComponent(productWhatsAppMessage(item))}` : '#';
  }

  function isAdminUrl() {
    const panel = new URLSearchParams(window.location.search).get('admin');
    return panel === '1' || panel === '2';
  }

  function buildPublicShareUrl(params = {}) {
    const url = new URL(window.location.href);
    url.hash = '';
    ['admin','category','product','v'].forEach(key => url.searchParams.delete(key));
    Object.entries(params).forEach(([key, value]) => {
      const clean = String(value || '').trim();
      if (clean) url.searchParams.set(key, clean);
    });
    return url.toString();
  }

  function categoryKey(section) {
    return String(section?.slug || section?.id || '').trim();
  }

  function publicSiteBaseUrl() {
    const url = new URL(window.location.href);
    url.search = '';
    url.hash = '';
    if (/\/index\.html$/i.test(url.pathname)) url.pathname = url.pathname.replace(/index\.html$/i, '');
    if (!url.pathname.endsWith('/')) url.pathname = url.pathname.replace(/[^/]*$/, '');
    return url.href.replace(/\/?$/, '/');
  }

  function categoryShareUrl(section) {
    const key = categoryKey(section);
    return key ? new URL(`c/${encodeURIComponent(key)}/`, publicSiteBaseUrl()).toString() : buildPublicShareUrl();
  }

  function productShareUrl(item) {
    const id = String(item?.id || '').trim();
    return id ? new URL(`p/${encodeURIComponent(id)}/`, publicSiteBaseUrl()).toString() : buildPublicShareUrl();
  }

    return Object.freeze({
      normalizeWhatsAppNumber,primaryWhatsAppNumber,productWhatsAppMessage,
      productWhatsAppUrl,isAdminUrl,buildPublicShareUrl,categoryKey,
      publicSiteBaseUrl,categoryShareUrl,productShareUrl
    });
  }
  window.FL_CATALOG_LINKS=Object.freeze({create});
})();
