// Flower Light public application
// Main catalog/product UI; analytics and PDF viewer are split modules.

// Product/catalog data. Add, remove, or reorder items here without editing index.html.
window.FLOWER_LIGHT_PRODUCTS = { catalog: [], chandeliers: [], balfon: [], extraSections: [] };

(() => {
  'use strict';

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));
  const esc = value => String(value ?? '').replace(/[&<>\"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[ch]));

  function trackEvent(eventName, params = {}) {
    if (typeof window.flTrack === 'function') window.flTrack(eventName, params);
  }

  function analyticsProductParams(item, extra = {}) {
    return {
      product_name: productDisplayName(item),
      product_category: item?.category || (String(item?.caption || '').startsWith('صفحة') ? 'الكتالوج' : 'غير مصنف'),
      product_model: item?.model || '',
      product_reference: item?.caption || '',
      ...extra
    };
  }

  const {productDisplayName,normalizeProductAvailability,productAvailabilityLabel,formatProductSpecValue}=window.FL_CATALOG_PRODUCT_META;

  const {PRICING_META_KEY,validPriceNumber,validPriceQty,formatPriceNumber,productPricingTiers,priceTierRangeNote,productPricingLines}=window.FL_CATALOG_PRICING;

  const PRODUCT_SPEC_LABELS = {
    sku: 'كود المنتج',
    wattage: 'القدرة',
    lumens: 'اللومن',
    cct: 'حرارة اللون',
    cri: 'CRI',
    voltage: 'الفولت',
    ip_rating: 'درجة الحماية',
    dimensions: 'المقاس',
    color: 'اللون',
    material: 'الخامة',
    beam_angle: 'زاوية الإضاءة',
    frequency: 'التردد',
    warranty: 'الضمان',
    bulb_base: 'قاعدة اللمبة',
    bulb_count: 'عدد اللمبات'
  };

  const PRODUCT_SPEC_ALIAS_KEYS = new Map([
    ['القدرة','wattage'],['القدره','wattage'],['الواط','wattage'],['وات','wattage'],['power','wattage'],['watt','wattage'],['w','wattage'],
    ['اللومن','lumens'],['لومن','lumens'],['lumen','lumens'],['lm','lumens'],['التدفق الضوئي','lumens'],['شدة الاضاءة','lumens'],['شدة الإضاءة','lumens'],
    ['حرارة اللون','cct'],['حراره اللون','cct'],['درجة حرارة اللون','cct'],['درجه حراره اللون','cct'],['كلفن','cct'],['kelvin','cct'],['k','cct'],
    ['الفولت','voltage'],['الجهد','voltage'],['فولت','voltage'],['volt','voltage'],['v','voltage'],
    ['درجة الحماية ip','ip_rating'],['درجه الحمايه ip','ip_rating'],['درجة الحماية','ip_rating'],['درجه الحمايه','ip_rating'],['ip','ip_rating'],
    ['المقاس','dimensions'],['المقاسات','dimensions'],['الأبعاد','dimensions'],['الابعاد','dimensions'],['size','dimensions'],['dimension','dimensions'],
    ['اللون','color'],['colour','color'],['الخامة','material'],['الخامه','material'],
    ['زاوية الإضاءة','beam_angle'],['زاويه الاضاءه','beam_angle'],['beam angle','beam_angle'],
    ['التردد','frequency'],['hz','frequency'],['الضمان','warranty'],
    ['قاعدة اللمبة','bulb_base'],['قاعده اللمبه','bulb_base'],['bulb base','bulb_base'],['سوكت','bulb_base'],['socket','bulb_base'],
    ['عدد اللمبات','bulb_count'],['عدد اللمبة','bulb_count'],['عدد اللمبه','bulb_count'],['bulb count','bulb_count'],
    ['كود المنتج','sku'],['رقم المنتج','sku'],['رمز المنتج','sku']
  ]);
  function normalizeProductSpecAlias(value) {
    return String(value || '').trim().toLowerCase()
      .replace(/[\u064B-\u0652]/g, '').replace(/[إأآا]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
      .replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  }
  const PRODUCT_SPEC_ALIAS_LOOKUP = (() => {
    const map = new Map();
    Object.keys(PRODUCT_SPEC_LABELS).forEach(key => map.set(normalizeProductSpecAlias(key), key));
    Object.entries(PRODUCT_SPEC_LABELS).forEach(([key, label]) => map.set(normalizeProductSpecAlias(label), key));
    PRODUCT_SPEC_ALIAS_KEYS.forEach((key, alias) => map.set(normalizeProductSpecAlias(alias), key));
    return map;
  })();
  function canonicalProductSpecKey(rawKey, label) {
    const direct = String(rawKey || '').trim();
    // Explicit custom-filter keys are stable identifiers: never remap them by label.
    if (/^custom_filter_[a-z0-9]+$/i.test(direct)) return direct;
    if (Object.hasOwn(PRODUCT_SPEC_LABELS, direct)) return direct;
    const known = PRODUCT_SPEC_ALIAS_LOOKUP.get(normalizeProductSpecAlias(direct))
      || PRODUCT_SPEC_ALIAS_LOOKUP.get(normalizeProductSpecAlias(label));
    if (known) return known;
    // Legacy custom_1/unnamed specifications can match an owner-defined filter by label.
    // Ambiguous labels are intentionally left as-is.
    const customFilters = window.FLOWER_LIGHT_SITE_SETTINGS?.catalog_custom_filters;
    if (Array.isArray(customFilters)) {
      const token=normalizeProductSpecAlias(label||direct);
      const matches=customFilters.filter(row=>/^custom_filter_[a-z0-9]+$/i.test(String(row?.key||''))
        && token && normalizeProductSpecAlias(row.label)===token);
      if (matches.length===1)return String(matches[0].key);
    }
    return direct;
  }

  const WHATSAPP_META_SHOW_DESCRIPTION = '__whatsapp_show_description';
  const WHATSAPP_META_SHOW_SPECS = '__whatsapp_show_specifications';

  function productWhatsAppOption(raw, key) {
    if (!Array.isArray(raw)) return false;
    const row = raw.find(item => item && typeof item === 'object' && String(item.key || '').trim() === key);
    if (!row) return false;
    return ['1', 'true', 'yes', 'on'].includes(String(row.value ?? '').trim().toLowerCase());
  }

  function normalizeProductSpecifications(raw) {
    let rows = [];
    if (Array.isArray(raw)) rows = raw;
    else if (raw && typeof raw === 'object') {
      rows = Object.entries(raw).map(([key, value]) => ({ key, value }));
    }
    return rows.map((row, index) => {
      if (!row || typeof row !== 'object') return null;
      const rawKey = String(row.key || `custom_${index + 1}`).trim();
      if (rawKey === WHATSAPP_META_SHOW_DESCRIPTION || rawKey === WHATSAPP_META_SHOW_SPECS || rawKey === PRICING_META_KEY) return null;
      const key = canonicalProductSpecKey(rawKey, row.label);
      const rawLabel = String(PRODUCT_SPEC_LABELS[key] || row.label || key).trim();
      const label = window.FL_I18N?.lang==='en' ? String(window.FL_I18N.translate(row.label||rawLabel)||rawLabel) : rawLabel;
      const value = String(row.value ?? '').trim();
      const unit = String(row.unit || '').trim();
      if (!label || !value) return null;
      return { key, label, value, unit };
    }).filter(Boolean).slice(0, 30);
  }

  function productSpecifications(item) {
    return normalizeProductSpecifications(item?.specifications);
  }

  function specificationDisplayValue(spec) {
    return formatProductSpecValue(spec,window.FL_I18N?.lang==='en'?'en':'ar');
  }

  function productSpecsText(item, limit = 5) {
    const specs = productSpecifications(item);
    return specs
      .slice(0, limit)
      .map(spec => `${spec.label}: ${specificationDisplayValue(spec)}`);
  }

  function createProductSpecsElement(item, { compact = false, limit = 30 } = {}) {
    const specs = productSpecifications(item).slice(0, limit);
    if (!specs.length) return null;

    if (compact) {
      const section = document.createElement('section');
      section.className = 'product-specs-carousel';
      section.setAttribute('aria-label', 'المواصفات الفنية');

      const head = document.createElement('div');
      head.className = 'product-specs-carousel-head';

      const title = document.createElement('strong');
      title.textContent = 'المواصفات الفنية';

      const nav = document.createElement('div');
      nav.className = 'product-specs-carousel-nav';
      nav.dir = 'ltr';

      // The strip starts beside the Arabic heading on the right. The left arrow
      // advances through the information toward the opposite side.
      const forward = document.createElement('button');
      forward.type = 'button';
      forward.className = 'product-specs-nav-button forward';
      forward.setAttribute('aria-label', 'المعلومة التالية');
      forward.textContent = '‹';

      const count = document.createElement('span');
      count.className = 'product-specs-count';
      count.textContent = `${specs.length} معلومات`;

      const back = document.createElement('button');
      back.type = 'button';
      back.className = 'product-specs-nav-button back';
      back.setAttribute('aria-label', 'المعلومة السابقة');
      back.textContent = '›';

      nav.append(forward, count, back);
      head.append(title, nav);

      const track = document.createElement('div');
      track.className = 'product-specs-track';
      track.dir = 'rtl';

      specs.forEach(spec => {
        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'product-spec product-spec-slide';
        row.setAttribute('aria-label', `${spec.label}: ${specificationDisplayValue(spec)}`);

        const label = document.createElement('span');
        label.className = 'product-spec-label';
        label.textContent = spec.label;

        const value = document.createElement('strong');
        value.className = 'product-spec-value';
        value.textContent = specificationDisplayValue(spec);

        row.append(label, value);
        track.appendChild(row);
      });

      const cards = [...track.querySelectorAll('.product-spec-slide')];
      let activeIndex = 0;
      let syncTimer = 0;

      const updateButtons = () => {
        back.disabled = activeIndex <= 0;
        forward.disabled = activeIndex >= cards.length - 1;
      };
      const goTo = (index, behavior = 'smooth') => {
        if (!cards.length) return;
        activeIndex = Math.min(Math.max(0, index), cards.length - 1);
        cards[activeIndex].scrollIntoView({ behavior, block: 'nearest', inline: activeIndex === 0 ? 'start' : 'center' });
        updateButtons();
      };
      const syncIndexFromScroll = () => {
        if (!cards.length) return;
        const trackRect = track.getBoundingClientRect();
        // In RTL, information starts at the right edge beside the heading.
        const targetX = trackRect.right - Math.min(70, trackRect.width * .18);
        let best = 0;
        let distance = Infinity;
        cards.forEach((card, index) => {
          const rect = card.getBoundingClientRect();
          const cardX = rect.right;
          const d = Math.abs(cardX - targetX);
          if (d < distance) { distance = d; best = index; }
        });
        activeIndex = best;
        updateButtons();
      };

      cards.forEach((row, index) => row.addEventListener('click', () => goTo(index)));
      forward.addEventListener('click', () => goTo(activeIndex + 1));
      back.addEventListener('click', () => goTo(activeIndex - 1));
      track.addEventListener('scroll', () => {
        window.clearTimeout(syncTimer);
        syncTimer = window.setTimeout(syncIndexFromScroll, 80);
      }, { passive: true });

      window.requestAnimationFrame(() => goTo(0, 'auto'));

      // Native touch swipe works automatically. Add mouse/pen drag for desktop/tablet.
      let dragging = false;
      let dragStartX = 0;
      let dragStartScroll = 0;
      track.addEventListener('pointerdown', event => {
        if (event.pointerType === 'touch' || event.button !== 0) return;
        dragging = true;
        dragStartX = event.clientX;
        dragStartScroll = track.scrollLeft;
        track.classList.add('is-dragging');
        try { track.setPointerCapture(event.pointerId); } catch (_) {}
      });
      track.addEventListener('pointermove', event => {
        if (!dragging) return;
        event.preventDefault();
        // RTL scrollLeft is negative in modern browsers, hence the + sign here.
        track.scrollLeft = dragStartScroll + (event.clientX - dragStartX);
      });
      const finishDrag = event => {
        if (!dragging) return;
        dragging = false;
        track.classList.remove('is-dragging');
        syncIndexFromScroll();
        try { track.releasePointerCapture(event.pointerId); } catch (_) {}
      };
      track.addEventListener('pointerup', finishDrag);
      track.addEventListener('pointercancel', finishDrag);

      section.append(head, track);
      return section;
    }

    const wrap = document.createElement('div');
    wrap.className = 'product-specs';
    specs.forEach(spec => {
      const row = document.createElement('div');
      row.className = 'product-spec';
      const label = document.createElement('span');
      label.className = 'product-spec-label';
      label.textContent = spec.label;
      const value = document.createElement('strong');
      value.className = 'product-spec-value';
      value.textContent = specificationDisplayValue(spec);
      row.append(label, value);
      wrap.appendChild(row);
    });
    return wrap;
  }

  function normalizeWhatsAppNumber(value) {
    let digits = String(value || '').replace(/\D/g, '');
    if (digits.startsWith('00')) digits = digits.slice(2);
    if (/^05\d{8}$/.test(digits)) return `966${digits.slice(1)}`;
    if (/^5\d{8}$/.test(digits)) return `966${digits}`;
    if (/^96605\d{8}$/.test(digits)) return `966${digits.slice(4)}`;
    return digits;
  }
  window.flNormalizeWhatsAppNumber = normalizeWhatsAppNumber;

  function primaryWhatsAppNumber() {
    const list = Array.isArray(window.FLOWER_LIGHT_CONTACTS) ? window.FLOWER_LIGHT_CONTACTS : [];
    const value = list.find(item => item?.type === 'whatsapp' && item?.is_visible !== false)?.value || '';
    return normalizeWhatsAppNumber(value);
  }
  window.flPrimaryWhatsAppNumber = primaryWhatsAppNumber;

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

  // Localized presentation is derived from source fields; never overwrite Supabase Arabic records.
  const englishCatalog=()=>window.FL_I18N?.lang==='en';
  const localizedProduct=item=>{
    if(!englishCatalog())return item;
    const enSpecs=Array.isArray(item?.specifications_en)?item.specifications_en:[];
    const arabicSpecs=Array.isArray(item?.specifications)?item.specifications:[];
    const specs=arabicSpecs.map(spec=>{
      const translated=enSpecs.find(row=>String(row?.key||'')===String(spec?.key||''));
      return translated?.label&&translated?.value?{...spec,label:translated.label,value:translated.value,unit:translated.unit||''} : spec;
    });
    return {...item,name_ar:item.name,name:item.name_en||item.name,caption:item.caption_en||item.caption,alt:item.caption_en||item.caption||item.name_en||item.name,specifications:specs};
  };
  const localizedSection=section=>{
    if(!englishCatalog())return section;
    return {...section,name_ar:section.name,name:section.name_en||section.name,description:section.description_en||section.description,items:(section.items||[]).map(localizedProduct)};
  };

  function categoryDisplayDescription(section) {
    const name = String(section?.name || 'القسم').trim() || 'القسم';
    const description = String(section?.description || '').trim();
    const legacyImportDescription = /^تم\s+(?:إنشاؤه|انشاؤه|إنشاءة|انشاءة)\s+من\s+استيراد\s+(?:excel|إكسل|اكسل)$/i;
    return !description || legacyImportDescription.test(description)
      ? (englishCatalog()?`Products in ${name}`:`منتجات قسم ${name}`)
      : description;
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

  async function copyText(value) {
    const text = String(value || '');
    if (!text) return false;
    try {
      if (navigator.clipboard?.writeText && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (_) {}
    try {
      const area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand('copy');
      area.remove();
      return ok;
    } catch (_) {
      return false;
    }
  }

  async function shareLink({ title = '', text = '', url = '', copiedMessage = 'تم نسخ الرابط' } = {}) {
    if (!url) return;
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch (error) {
        if (error?.name === 'AbortError') return;
      }
    }
    const copied = await copyText(url);
    showPublicToast(copied ? copiedMessage : 'تعذر النسخ. انسخ الرابط من شريط العنوان.');
  }

  function shareIconSvg() {
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="2.5"></circle><circle cx="6" cy="12" r="2.5"></circle><circle cx="18" cy="19" r="2.5"></circle><path d="m8.2 10.9 7.5-4.5M8.2 13.1l7.5 4.5"></path></svg>`;
  }

  function createProductShareButton(item) {
    const button = document.createElement('button');
    button.className = 'product-share-button';
    button.type = 'button';
    button.setAttribute('aria-label', `مشاركة ${productDisplayName(item)}`);
    button.innerHTML = `${shareIconSvg()}<span>مشاركة المنتج</span>`;
    button.addEventListener('click', async () => {
      await shareLink({
        title: productDisplayName(item),
        text: item?.model ? `${productDisplayName(item)} - ${item.model}` : productDisplayName(item),
        url: productShareUrl(item),
        copiedMessage: 'تم نسخ رابط المنتج'
      });
    });
    return button;
  }

  function productPdfIconSvg() {
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h7l4 4v14H7z"></path><path d="M14 3v5h5"></path><path d="M9 15h6M9 18h4"></path><path d="M12 10v3M9.8 11.7 12 13.8l2.2-2.1"></path></svg>`;
  }

  function createProductPdfButton(item) {
    const button = document.createElement('button');
    button.className = 'product-download-pdf-button';
    button.type = 'button';
    button.setAttribute('aria-label', `تحميل ${productDisplayName(item)} كملف PDF أو صورة JPG عالية الدقة`);
    button.innerHTML = `${productPdfIconSvg()}<span>تحميل</span>`;
    button.addEventListener('click', async () => {
      const choice = await askExportChoice({
        title: 'تحميل المنتج',
        subtitle: 'اختر تنزيل المنتج كملف PDF أو كصورة JPG عالية الدقة.',
        pdfLabel: 'تحميل PDF',
        jpgLabel: 'تحميل JPG'
      });
      if (choice === 'jpg') return downloadProductOverviewJpg(item, button);
      if (choice === 'pdf') return downloadProductOverviewPdf(item, button);
    });
    return button;
  }

  function createCategoryShareButton(section) {
    const button = document.createElement('button');
    button.className = 'category-share-button';
    button.type = 'button';
    button.setAttribute('aria-label', englishCatalog()?`Share category ${section?.name||'Products'}`:`مشاركة قسم ${section?.name || 'المنتجات'}`);
    button.innerHTML = `${shareIconSvg()}<span>مشاركة القسم</span>`;
    button.addEventListener('click', async () => {
      await shareLink({
        title: section?.name || 'قسم المنتجات',
        text: `منتجات قسم ${section?.name || 'المنتجات'}`,
        url: categoryShareUrl(section),
        copiedMessage: 'تم نسخ رابط القسم'
      });
    });
    return button;
  }

  function categoryDownloadIconSvg() {
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12"></path><path d="m7 10 5 5 5-5"></path><path d="M5 21h14"></path></svg>`;
  }

  function createCategoryDownloadButton(section) {
    const name = String(section?.name || 'المنتجات').trim() || 'المنتجات';
    const button = document.createElement('button');
    const hasProducts = sectionPdfEntries(section).length > 0;
    button.className = 'category-download-button';
    button.type = 'button';
    button.disabled = !hasProducts;
    button.dataset.hasProducts = hasProducts ? 'true' : 'false';
    button.setAttribute('aria-label', englishCatalog()?`Download category ${name} as PDF or JPG`:`تحميل قسم ${name} بصيغة PDF أو صور JPG`);
    button.innerHTML = `${categoryDownloadIconSvg()}<span>${englishCatalog()?'Download category':'تحميل قسم'} ${esc(name)}</span>`;
    button.addEventListener('click', () => handleSectionDownloadChoice(section, button));
    return button;
  }

  function createProductCatalogPdfLink(item, className='product-catalog-pdf-button') {
    const url=String(item?.catalog_pdf_url||'').trim();
    if(!url) return null;
    const link=document.createElement('a');
    link.className=className;
    link.href=url;
    link.target='_blank';
    link.rel='noopener noreferrer';
    link.setAttribute('aria-label',`فتح كتالوج PDF لـ ${productDisplayName(item)}`);
    link.innerHTML=`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 2h8l4 4v16H6z"></path><path d="M14 2v5h5"></path><path d="M9 13h6M9 17h6"></path></svg><span>تحميل كتالوج PDF</span>`;
    link.addEventListener('click',()=>trackEvent('catalog_download',analyticsProductParams(item,{label:'uploaded_product_catalog_pdf'})));
    return link;
  }

  function createProductWhatsAppLink(item, className = 'product-whatsapp-button') {
    const link = document.createElement('a');
    link.className = className;
    const whatsAppUrl = productWhatsAppUrl(item);
    link.href = whatsAppUrl;
    link.hidden = whatsAppUrl === '#';
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.setAttribute('aria-label', `استفسار واتساب عن ${productDisplayName(item)}${item?.model ? ` كود ${item.model}` : ''}`);
    link.addEventListener('click', () => {
      trackEvent('product_whatsapp_click', analyticsProductParams(item, { source: 'product_card' }));
    });
    link.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.206-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.371-.272.297-1.04 1.016-1.04 2.479s1.065 2.875 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.981.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.9 6.988c-.002 5.45-4.436 9.884-9.888 9.884m8.413-18.297A11.815 11.815 0 0 0 12.055 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.689 1.448h.005c6.557 0 11.893-5.335 11.896-11.893a11.82 11.82 0 0 0-3.488-8.413Z"></path>
      </svg>
      <span>استفسار عبر واتساب</span>
    `;
    return link;
  }

  // Pure gallery normalization lives in catalog-gallery.js.
  const normalizedProductGallery = window.FL_CATALOG_GALLERY?.normalizedProductGallery;
  if (typeof normalizedProductGallery !== 'function') throw new Error('Catalog gallery module not loaded');

  function createZoomButton(item, imageLoading = 'lazy', collection = [item], index = 0) {
    const button = document.createElement('button');
    button.className = 'product-image-button';
    button.type = 'button';
    const gallery = normalizedProductGallery(item);
    button.setAttribute('aria-label', gallery.length > 1
      ? `فتح ${gallery.length} صور لـ ${item.caption || item.alt || 'المنتج'}`
      : `تكبير صورة ${item.caption || item.alt || 'المنتج'}`);

    const image = document.createElement('img');
    image.alt = item.alt;
    image.loading = imageLoading;
    image.decoding = 'async';
    // Configure lazy loading and priority BEFORE assigning src so the request
    // does not start eagerly while the card is being built.
    if (index >= 4) image.fetchPriority = 'low';
    image.src = item.image_thumb || item.image;

    const badge = document.createElement('span');
    badge.className = 'image-zoom-badge';
    badge.setAttribute('aria-hidden', 'true');
    badge.innerHTML = '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6"></circle><path d="m16 16 4 4"></path><path d="M11 8v6M8 11h6"></path></svg>';

    button.append(image, badge);
    if (item?.limited_offer === true) {
      const offerBadge = document.createElement('span');
      offerBadge.className = 'product-limited-offer-badge';
      offerBadge.textContent = 'عرض لفترة محدودة';
      offerBadge.setAttribute('aria-label', 'عرض لفترة محدودة');
      button.appendChild(offerBadge);
    }
    if (gallery.length > 1) {
      const galleryCount = document.createElement('span');
      galleryCount.className = 'product-gallery-count';
      galleryCount.textContent = `${gallery.length} صور`;
      galleryCount.setAttribute('aria-hidden', 'true');
      button.appendChild(galleryCount);
    }
    button.dataset.cardGalleryIndex = '0';
    button.addEventListener('click', () => {
      if (button.dataset.suppressOpen === '1') {
        delete button.dataset.suppressOpen;
        return;
      }
      const startImageIndex = Math.max(0, Number(button.dataset.cardGalleryIndex) || 0);
      openImageLightbox(item, button, collection, index, startImageIndex);
    });
    return button;
  }

  function attachProductCardGalleryNavigation(thumb, imageButton, item) {
    const gallery = normalizedProductGallery(item);
    if (!thumb || !imageButton || gallery.length <= 1) return;

    const image = imageButton.querySelector('img');
    const count = imageButton.querySelector('.product-gallery-count');
    if (!image) return;

    let activeIndex = Math.max(0, Math.min(gallery.length - 1, Number(imageButton.dataset.cardGalleryIndex) || 0));
    let touchStartX = 0;
    let touchStartY = 0;

    const updateImage = (nextIndex, direction = 0, method = 'card_button') => {
      activeIndex = (nextIndex + gallery.length) % gallery.length;
      const target = gallery[activeIndex];
      if (!target?.image) return;
      imageButton.dataset.cardGalleryIndex = String(activeIndex);
      image.src = target.thumb || target.image;
      if (count) count.textContent = `${activeIndex + 1} / ${gallery.length}`;
      image.classList.remove('card-slide-from-left','card-slide-from-right');
      void image.offsetWidth;
      if (direction < 0) image.classList.add('card-slide-from-left');
      if (direction > 0) image.classList.add('card-slide-from-right');
      trackEvent('product_gallery_navigation', analyticsProductParams(item, {
        direction: direction < 0 ? 'previous' : 'next',
        method
      }));
    };

    if (count) count.textContent = `1 / ${gallery.length}`;

    const makeNav = (side, label, delta, svgPath) => {
      const nav = document.createElement('button');
      nav.type = 'button';
      nav.className = `product-card-gallery-nav is-${side}`;
      nav.setAttribute('aria-label', label);
      nav.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${svgPath}"></path></svg>`;
      nav.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        updateImage(activeIndex + delta, delta, 'card_button');
      });
      return nav;
    };

    const prev = makeNav('left', 'الصورة السابقة', -1, 'M15 18l-6-6 6-6');
    const next = makeNav('right', 'الصورة التالية', 1, 'M9 18l6-6-6-6');
    thumb.append(prev, next);

    thumb.addEventListener('touchstart', event => {
      const touch = event.touches?.[0];
      if (!touch) return;
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
    }, { passive: true });

    thumb.addEventListener('touchend', event => {
      const touch = event.changedTouches?.[0];
      if (!touch) return;
      const dx = touch.clientX - touchStartX;
      const dy = touch.clientY - touchStartY;
      if (Math.abs(dx) < 42 || Math.abs(dx) <= Math.abs(dy) * 1.15) return;
      imageButton.dataset.suppressOpen = '1';
      updateImage(activeIndex + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1, 'card_swipe');
      window.setTimeout(() => { if (imageButton.dataset.suppressOpen === '1') delete imageButton.dataset.suppressOpen; }, 450);
    }, { passive: true });
  }

  function createProductCard(item, type, collection, index) {
    const figure = document.createElement('figure');
    figure.className = `${type}-card`;
    figure.dataset.productId = String(item?.id || '');
    figure.dataset.productName = [item?.name_ar,item?.name,item?.name_en].filter(Boolean).join(' ');
    figure.dataset.productModel = String(item?.model || '');
    figure.dataset.filterSpecs=JSON.stringify(Object.fromEntries(productSpecifications(item).map(spec=>[spec.key,specificationDisplayValue(spec)])));

    const thumb = document.createElement('div');
    thumb.className = `${type}-thumb`;

    const imageButton = createZoomButton(item, 'lazy', collection, index);
    imageButton.querySelector('.image-zoom-badge')?.remove();
    const availability = normalizeProductAvailability(item?.availability);
    figure.dataset.availability = availability;
    const availabilityBadge = document.createElement('span');
    availabilityBadge.className = `product-availability-badge is-${availability}`;
    availabilityBadge.textContent = productAvailabilityLabel(availability);
    availabilityBadge.setAttribute('aria-label', `حالة التوفر: ${productAvailabilityLabel(availability)}`);
    imageButton.appendChild(availabilityBadge);
    thumb.appendChild(imageButton);
    attachProductCardGalleryNavigation(thumb, imageButton, item);
    figure.appendChild(thumb);

    const details = document.createElement('figcaption');
    details.className = 'product-card-info';

    if (item?.model) {
      const codeRow = document.createElement('div');
      codeRow.className = 'product-code-row';
      const label = document.createElement('span');
      label.textContent = 'رقم المنتج / الكود';
      const value = document.createElement('strong');
      value.textContent = String(item.model);
      codeRow.append(label, value);
      details.appendChild(codeRow);
    }

    if (item?.caption) {
      const description = document.createElement('p');
      description.className = 'product-description';
      description.textContent = item.caption;
      details.appendChild(description);
    }

    const pricingLines = productPricingLines(item);
    if (pricingLines.length) {
      const pricingBlock = document.createElement('div');
      pricingBlock.className = `product-pricing-block${item?.limited_offer===true?' is-offer':''}`;
      pricingLines.forEach(price => {
        const priceRow = document.createElement('div');
        priceRow.className = `product-price-row is-${price.key}`;
        const labelWrap = document.createElement('span');
        labelWrap.className = 'product-price-label';
        const label = document.createElement('b');
        label.textContent = price.label;
        labelWrap.appendChild(label);
        if (price.note) {
          const note = document.createElement('small');
          note.textContent = price.note;
          labelWrap.appendChild(note);
        }
        const value = document.createElement('strong');
        value.textContent = price.value;
        priceRow.append(labelWrap, value);
        pricingBlock.appendChild(priceRow);
      });
      details.appendChild(pricingBlock);
    }

    if (details.childNodes.length) figure.appendChild(details);

    // Show every filled specification. The strip supports arrow clicks,
    // tapping a specification to center it, touch swipe, and mouse drag.
    const specs = createProductSpecsElement(item, { compact: true, limit: 30 });
    if (specs) figure.appendChild(specs);

    const pdfButton = createProductPdfButton(item);
    const whatsappLink = createProductWhatsAppLink(item);
    const shareButton = createProductShareButton(item);
    const actions = document.createElement('div');
    actions.className = 'product-card-actions';
    actions.append(pdfButton, shareButton, whatsappLink);
    const quoteControl = window.FL_QUOTE_LIST?.createAddControl?.(item);
    if (quoteControl) {
      actions.appendChild(quoteControl);
      actions.classList.toggle('has-quote-list', !quoteControl.hidden);
    }
    figure.appendChild(actions);
    return figure;
  }

  const SITE_CATALOG_PANEL_ID='siteCatalogPanel';
  const catalogPdfViewer=window.FL_CATALOG_PDF_VIEWER;
  function disposeSiteCatalogRenderer(pages,options){ return catalogPdfViewer?.dispose?.(pages,options); }
  function renderSiteCatalogPages(panel,url){ return catalogPdfViewer?.render?.(panel,url); }

  function createSiteCatalogTabAndPanel(tabsHost,sheet,catalog,index,active=false){
    const url=String(catalog?.pdf_url||'').trim();if(!url) return null;
    const idToken=String(catalog?.id||index).replace(/[^a-zA-Z0-9_-]/g,'');
    const panelId=`siteCatalogPanel${idToken||index}`;
    const key=`catalog-${String(catalog?.id||index)}`;
    const tab=document.createElement('button');
    tab.className=`catalog-tab site-catalog-tab${active?' active':''}`;
    tab.type='button';tab.dataset.target=panelId;tab.dataset.categoryKey=key;tab.setAttribute('aria-pressed',active?'true':'false');
    tab.innerHTML='<strong></strong><small>كتالوج PDF</small>';
    tab.querySelector('strong').textContent=String(catalog?.name||'كتالوج');
    tabsHost.appendChild(tab);
    const panel=document.createElement('section');panel.id=panelId;panel.className=`catalog-panel site-catalog-panel${active?' active':''}`;panel.dataset.catalogUrl=url;panel.dataset.catalogId=String(catalog?.id||'');
    let safeUrl='';
    try{const parsed=new URL(url,location.href);if(parsed.protocol==='https:' || (parsed.protocol==='http:' && ['localhost','127.0.0.1'].includes(location.hostname)))safeUrl=parsed.href;}catch{}
    if(!safeUrl) return null;
    const title=String(catalog?.name||'كتالوج Flower Light');
    const description=String(catalog?.description||'تصفح جميع صفحات الكتالوج داخل الموقع.');
    panel.innerHTML='<div class="site-catalog-head"><div><h3></h3><p></p></div><a class="site-catalog-download" target="_blank" rel="noopener noreferrer" download>تحميل PDF</a></div><div class="site-catalog-pages"></div>';
    panel.querySelector('h3').textContent=title;panel.querySelector('p').textContent=description;panel.querySelector('.site-catalog-download').href=safeUrl;sheet.appendChild(panel);
    tab.addEventListener('click',()=>{setCatalogPanel(panelId);updatePublicUrl({category:key});trackEvent('product_category_view',{category:title,panel_id:panelId,catalog_id:String(catalog?.id||'')});renderSiteCatalogPages(panel,url);});
    return {tab,panel,panelId};
  }

  function renderExtraSections(data) {
    const tabsHost = $('.catalog-tabs');
    const sheet = $('.catalog-sheet');
    const empty = $('#dynamicCatalogEmpty');
    if (!tabsHost || !sheet) return;

    tabsHost.replaceChildren();
    $$('.site-catalog-panel', sheet).forEach((node) => {
      disposeSiteCatalogRenderer(node.querySelector('.site-catalog-pages'));
      node.remove();
    });
    $$('.extra-section-panel', sheet).forEach((node) => node.remove());

    const sections = (Array.isArray(data.extraSections) ? data.extraSections : []).map(localizedSection);
    const siteCatalogs=(Array.isArray(window.FLOWER_LIGHT_SITE_CATALOGS)?window.FLOWER_LIGHT_SITE_CATALOGS:[]).filter(c=>String(c?.pdf_url||'').trim());
    const combined=[
      ...sections.map((section,index)=>({type:'section',data:section,index,sort_order:Number(section?.sort_order)||0,created_at:String(section?.created_at||'')})),
      ...siteCatalogs.map((catalog,index)=>({type:'catalog',data:catalog,index,sort_order:Number(catalog?.sort_order)||0,created_at:String(catalog?.created_at||'')}))
    ].sort((a,b)=>a.sort_order-b.sort_order || a.created_at.localeCompare(b.created_at) || a.index-b.index);

    if (empty) empty.style.display = combined.length ? 'none' : 'block';

    combined.forEach((entry, combinedIndex) => {
      const active=combinedIndex===0;
      if(entry.type==='catalog'){
        createSiteCatalogTabAndPanel(tabsHost,sheet,entry.data,entry.index,active);
        return;
      }

      const section=entry.data;
      const safeToken=String(section?.id||section?.slug||entry.index).replace(/[^a-zA-Z0-9_-]/g,'');
      const safeId = `extraSectionPanel${safeToken||entry.index}`;
      const tab = document.createElement('button');
      tab.className = `catalog-tab extra-section-tab${active?' active':''}`;
      tab.type = 'button';
      tab.dataset.target = safeId;
      tab.dataset.categoryKey = categoryKey(section);
      tab.setAttribute('aria-pressed', active ? 'true' : 'false');
      tab.innerHTML = `<strong></strong><small></small>`;
      tab.querySelector('strong').textContent = section.name || 'قسم';
      tab.querySelector('small').textContent = englishCatalog()?`${Array.isArray(section.items) ? section.items.length : 0} products`:`${Array.isArray(section.items) ? section.items.length : 0} منتج`;
      tab.addEventListener('click', () => {
        setCatalogPanel(safeId);
        updatePublicUrl({ category: categoryKey(section) });
        trackEvent('product_category_view', { category: section.name || 'قسم', panel_id: safeId });
      });
      tabsHost.appendChild(tab);

      const panel = document.createElement('section');
      panel.className = `catalog-panel extra-section-panel${active?' active':''}`;
      panel.id = safeId;
      panel.dataset.categorySearch=[section.name_ar,section.name,section.name_en,section.description,section.description_en].filter(Boolean).join(' ');

      const sectionHeader = document.createElement('div');
      sectionHeader.className = 'extra-section-head';

      const intro = document.createElement('p');
      intro.className = 'extra-section-intro';
      intro.textContent = categoryDisplayDescription(section);

      const categoryShareButton = createCategoryShareButton(section);
      const categoryDownloadButton = createCategoryDownloadButton(section);
      const sectionActions = document.createElement('div');
      sectionActions.className = 'extra-section-actions';
      sectionActions.append(categoryDownloadButton, categoryShareButton);
      sectionHeader.append(intro, sectionActions);

      const grid = document.createElement('div');
      grid.className = 'extra-section-grid';
      grid.dir = 'rtl';
      const items = Array.isArray(section.items) ? section.items : [];
      const fragment = document.createDocumentFragment();
      items.forEach((item, index) => fragment.appendChild(createProductCard(item, 'chandelier', items, index)));
      grid.appendChild(fragment);
      panel.append(sectionHeader, grid);
      sheet.appendChild(panel);
    });
  }

  const catalogDownloadPdf = $('#catalogDownloadPdf');
  const catalogDownloadPdfLabel = $('#catalogDownloadPdfLabel');
  let catalogPdfBusy = false;
  let publicToastTimer = 0;

  function showPublicToast(message, duration = 3000) {
    const toast = $('#toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    window.clearTimeout(publicToastTimer);
    publicToastTimer = window.setTimeout(() => toast.classList.remove('show'), duration);
  }
  window.flShowPublicToast = showPublicToast;

  // -------------------------------------------------------------------------
  // Image decoding, canvas drawing, templates, and branded PDF page layouts
  // are kept in catalog-pdf-renderer.js, loaded immediately before app.js.
  const pdfRenderer = window.FL_CATALOG_PDF_RENDERER?.create({
    productDisplayName,
    productPricingLines,
    productSpecifications,
    specificationDisplayValue,
    normalizedProductGallery
  });
  if (!pdfRenderer) throw new Error('Catalog PDF renderer module not loaded');
  const {
    sectionPdfEntries,
    catalogPdfEntries,
    createBrandedProductPdfPage,
    createProductOverviewPdfPage,
    PDF_EXPORT_SCALE,
    JPG_EXPORT_SCALE,
    PDF_IMAGE_QUALITY,
    JPG_IMAGE_QUALITY,
    exportCanvasToBlob,
    triggerBlobDownload
  } = pdfRenderer;

  const exportChoiceModal = $('#exportChoiceModal');
  const exportChoiceTitle = $('#exportChoiceTitle');
  const exportChoiceSubtitle = $('#exportChoiceSubtitle');
  const exportChoicePdf = $('#exportChoicePdf');
  const exportChoiceJpg = $('#exportChoiceJpg');
  const exportChoiceClose = $('#closeExportChoice');
  let exportChoiceResolver = null;

  function closeExportChoice(choice = null) {
    if (!exportChoiceModal) return;
    exportChoiceModal.classList.remove('open');
    exportChoiceModal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('export-choice-open');
    const resolver = exportChoiceResolver;
    exportChoiceResolver = null;
    if (resolver) resolver(choice);
  }

  function askExportChoice({ title = 'اختر نوع الملف', subtitle = '', pdfLabel = 'تحميل PDF', jpgLabel = 'تحميل JPG عالي الدقة' } = {}) {
    if (!exportChoiceModal || !exportChoicePdf || !exportChoiceJpg) return Promise.resolve('pdf');
    exportChoiceTitle.textContent = title;
    exportChoiceSubtitle.textContent = subtitle;
    exportChoicePdf.querySelector('span').textContent = pdfLabel;
    exportChoiceJpg.querySelector('span').textContent = jpgLabel;
    exportChoiceModal.classList.add('open');
    exportChoiceModal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('export-choice-open');
    return new Promise(resolve => {
      exportChoiceResolver = resolve;
      window.requestAnimationFrame(() => exportChoicePdf.focus());
    });
  }

  exportChoicePdf?.addEventListener('click', () => closeExportChoice('pdf'));
  exportChoiceJpg?.addEventListener('click', () => closeExportChoice('jpg'));
  exportChoiceClose?.addEventListener('click', () => closeExportChoice(null));
  exportChoiceModal?.addEventListener('click', event => {
    if (event.target === exportChoiceModal) closeExportChoice(null);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && exportChoiceModal?.classList.contains('open')) closeExportChoice(null);
  });

  async function downloadCanvasAsJpg(canvas, filename, quality = JPG_IMAGE_QUALITY) {
    const blob = await exportCanvasToBlob(canvas, 'image/jpeg', quality);
    triggerBlobDownload(blob, filename);
  }

  async function downloadProductOverviewJpg(item, button) {
    const busyKey = String(item?.id || item?.model || productDisplayName(item));
    if (productOverviewPdfBusy.has(`jpg:${busyKey}`)) return;
    productOverviewPdfBusy.add(`jpg:${busyKey}`);
    const label = button?.querySelector('span');
    const originalLabel = label?.textContent || 'تحميل';
    if (button) button.disabled = true;
    if (label) label.textContent = 'جاري تجهيز JPG…';
    try {
      try {
        await document.fonts?.load('800 40px Tajawal');
        await document.fonts?.load('700 20px Tajawal');
      } catch (_) {}
      const { canvas, failedImages, imageCount } = await createProductOverviewPdfPage(item, { scale: JPG_EXPORT_SCALE });
      const fileBase = safePdfFilePart(item?.model || productDisplayName(item));
      await downloadCanvasAsJpg(canvas, `${fileBase}-product.jpg`);
      trackEvent('catalog_download', analyticsProductParams(item, { label: 'product_jpg', images_count: imageCount, failed_images: failedImages }));
      showPublicToast(failedImages ? `تم تحميل JPG عالي الدقة، وتعذر إدراج ${failedImages} صورة.` : 'تم تحميل صورة JPG عالية الدقة.', 4000);
    } catch (error) {
      console.warn('[Product JPG] generation failed', error);
      showPublicToast('تعذر تجهيز صورة JPG للمنتج. أعد المحاولة بعد التأكد من اتصال الإنترنت.', 4500);
    } finally {
      productOverviewPdfBusy.delete(`jpg:${busyKey}`);
      if (button) button.disabled = false;
      if (label) label.textContent = originalLabel;
    }
  }

  const productOverviewPdfBusy = new Set();
  async function downloadProductOverviewPdf(item, button) {
    const busyKey = String(item?.id || item?.model || productDisplayName(item));
    if (productOverviewPdfBusy.has(busyKey)) return;
    productOverviewPdfBusy.add(busyKey);
    const label = button?.querySelector('span');
    const originalLabel = label?.textContent || 'تحميل';
    if (button) button.disabled = true;
    if (label) label.textContent = 'جاري تجهيز PDF…';
    try {
      const JsPdf = await loadJsPdfOnDemand();
      try {
        await document.fonts?.load('800 40px Tajawal');
        await document.fonts?.load('700 20px Tajawal');
      } catch (_) {}
      const { canvas, failedImages, imageCount } = await createProductOverviewPdfPage(item, { scale: PDF_EXPORT_SCALE });
      const pdf = new JsPdf({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
      pdf.addImage(canvas.toDataURL('image/jpeg', PDF_IMAGE_QUALITY), 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
      const blob = pdf.output('blob');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const fileBase = safePdfFilePart(item?.model || productDisplayName(item));
      a.href = url;
      a.download = `${fileBase}-product.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 5000);
      trackEvent('catalog_download', analyticsProductParams(item, { label: 'product_pdf', images_count: imageCount, failed_images: failedImages }));
      showPublicToast(failedImages ? `تم إنشاء PDF، وتعذر إدراج ${failedImages} صورة.` : `تم تحميل PDF ويحتوي ${imageCount} ${imageCount === 1 ? 'صورة' : 'صور'}.`, 4000);
    } catch (error) {
      console.warn('[Product PDF] generation failed', error);
      showPublicToast('تعذر تجهيز PDF للمنتج. أعد المحاولة بعد التأكد من اتصال الإنترنت.', 4500);
    } finally {
      productOverviewPdfBusy.delete(busyKey);
      if (button) button.disabled = false;
      if (label) label.textContent = originalLabel;
    }
  }

  async function createSingleProductImagePdfPage(item, imageSrc, imageIndex = 0, totalImages = 1, { scale = 1 } = {}) {
    return createBrandedProductPdfPage(item, {
      images: [{ image: imageSrc, image_path: '' }],
      singleMode: true,
      currentIndex: imageIndex,
      totalImages,
      scale
    });
  }

  function safePdfFilePart(value) {
    return String(value || 'product')
      .trim()
      .replace(/[\\/:*?"<>|]+/g, '-')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 70) || 'product';
  }

  let singleImagePdfBusy = false;
  let singleImageJpgBusy = false;
  async function downloadCurrentProductImageJpg() {
    if (singleImageJpgBusy) return;
    const item = currentLightboxProduct();
    const gallery = currentLightboxGallery();
    const galleryImage = gallery[lightboxImageIndex];
    if (!item || !galleryImage?.image) return;

    singleImageJpgBusy = true;
    const button = imageLightboxDownloadPdf;
    const label = button?.querySelector('span');
    const originalLabel = label?.textContent || 'تحميل';
    if (button) button.disabled = true;
    if (label) label.textContent = 'جاري تجهيز JPG…';
    try {
      try {
        await document.fonts?.load('800 38px Tajawal');
        await document.fonts?.load('600 22px Tajawal');
      } catch (_) {}
      const { canvas, imageFailed } = await createSingleProductImagePdfPage(item, galleryImage.image, lightboxImageIndex, gallery.length, { scale: JPG_EXPORT_SCALE });
      const fileBase = safePdfFilePart(item?.model || productDisplayName(item));
      await downloadCanvasAsJpg(canvas, `${fileBase}-image-${lightboxImageIndex + 1}.jpg`);
      showPublicToast(imageFailed ? 'تم تحميل JPG لكن تعذر إدراج الصورة الأصلية.' : `تم تحميل JPG عالي الدقة للصورة ${lightboxImageIndex + 1}.`, 3600);
    } catch (error) {
      console.warn('[Product image JPG] generation failed', error);
      showPublicToast('تعذر تجهيز صورة JPG. أعد المحاولة بعد التأكد من اتصال الإنترنت.', 4500);
    } finally {
      singleImageJpgBusy = false;
      if (button) button.disabled = false;
      if (label) label.textContent = originalLabel;
    }
  }

  async function downloadCurrentProductImagePdf() {
    if (singleImagePdfBusy) return;
    const item = currentLightboxProduct();
    const gallery = currentLightboxGallery();
    const galleryImage = gallery[lightboxImageIndex];
    if (!item || !galleryImage?.image) return;

    singleImagePdfBusy = true;
    const button = imageLightboxDownloadPdf;
    const label = button?.querySelector('span');
    const originalLabel = label?.textContent || 'تحميل';
    if (button) button.disabled = true;
    if (label) label.textContent = 'جاري تجهيز PDF…';
    try {
      const JsPdf = await loadJsPdfOnDemand();
      try {
        await document.fonts?.load('800 38px Tajawal');
        await document.fonts?.load('600 22px Tajawal');
      } catch (_) {}
      const { canvas, imageFailed } = await createSingleProductImagePdfPage(item, galleryImage.image, lightboxImageIndex, gallery.length, { scale: PDF_EXPORT_SCALE });
      const pdf = new JsPdf({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
      pdf.addImage(canvas.toDataURL('image/jpeg', PDF_IMAGE_QUALITY), 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
      const blob = pdf.output('blob');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const fileBase = safePdfFilePart(item?.model || productDisplayName(item));
      a.href = url;
      a.download = `${fileBase}-image-${lightboxImageIndex + 1}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 5000);
      showPublicToast(imageFailed ? 'تم إنشاء PDF لكن تعذر إدراج الصورة الأصلية.' : `تم تحميل PDF للصورة ${lightboxImageIndex + 1}.`, 3600);
    } catch (error) {
      console.warn('[Product image PDF] generation failed', error);
      showPublicToast('تعذر تجهيز PDF للصورة. أعد المحاولة بعد التأكد من اتصال الإنترنت.', 4500);
    } finally {
      singleImagePdfBusy = false;
      if (button) button.disabled = false;
      if (label) label.textContent = originalLabel;
    }
  }

  const JSPDF_CDN_URL = 'https://cdn.jsdelivr.net/npm/jspdf@4.2.1/dist/jspdf.umd.min.js';
  const JSPDF_SRI = 'sha256-5lUfzcMvCdaFOyxRJtGNAdlEfg2mGKQaEevu4PbCDVQ=';
  // Built Pages use the verified same-origin vendor. Unbuilt development pages
  // still load the pinned CDN asset because jspdf-vendor.js exists only in dist.
  const JSPDF_PRIMARY_URL = '__FL_VERSION__'.startsWith('__FL_')
    ? JSPDF_CDN_URL : 'jspdf-vendor.js?v=__FL_VERSION__';
  let jsPdfLoadPromise = null;

  function loadJsPdfOnDemand() {
    if (window.jspdf?.jsPDF) return Promise.resolve(window.jspdf.jsPDF);
    if (jsPdfLoadPromise) return jsPdfLoadPromise;

    jsPdfLoadPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-fl-jspdf]');
      const finish = () => {
        const JsPdf = window.jspdf?.jsPDF;
        if (JsPdf) resolve(JsPdf);
        else reject(new Error('jsPDF loaded but the constructor is unavailable.'));
      };
      const fail = () => reject(new Error('تعذر تحميل أداة PDF. حدّث الموقع وتحقق من الاتصال ثم حاول مجددًا.'));

      if (existing) {
        existing.addEventListener('load', finish, { once: true });
        existing.addEventListener('error', fail, { once: true });
        return;
      }

      const script = document.createElement('script');
      script.src = JSPDF_PRIMARY_URL;
      script.async = true;
      script.dataset.flJspdf = '1';
      script.integrity = JSPDF_SRI;
      script.crossOrigin = 'anonymous';
      script.referrerPolicy = 'no-referrer';
      script.addEventListener('load', finish, { once: true });
      script.addEventListener('error', fail, { once: true });
      document.head.appendChild(script);
    }).catch(error => {
      jsPdfLoadPromise = null;
      document.querySelector('script[data-fl-jspdf]')?.remove();
      throw error;
    });

    return jsPdfLoadPromise;
  }

  // Reuse the exact public product-PDF renderer inside the admin datasheet tool.
  // This keeps manually designed datasheets visually identical to the approved
  // "download image with technical information" output.
  window.flDatasheetPdf = Object.freeze({
    createPage: createBrandedProductPdfPage,
    createSinglePage: createSingleProductImagePdfPage,
    loadJsPdf: loadJsPdfOnDemand,
    safeFilePart: safePdfFilePart,
    askExportChoice,
    downloadCanvasAsJpg,
    exportCanvasToBlob,
    triggerBlobDownload,
    scales: Object.freeze({ pdf: PDF_EXPORT_SCALE, jpg: JPG_EXPORT_SCALE }),
    qualities: Object.freeze({ pdf: PDF_IMAGE_QUALITY, jpg: JPG_IMAGE_QUALITY })
  });

  function catalogExportLabelNode(button) {
    return button === catalogDownloadPdf ? catalogDownloadPdfLabel : button?.querySelector('span');
  }

  function setCatalogExportBusy(busy) {
    [catalogDownloadPdf, ...$$('.category-download-button')].filter(Boolean).forEach(button => {
      if (busy) button.disabled = true;
      else if (button === catalogDownloadPdf) button.disabled = catalogPdfEntries().length === 0;
      else button.disabled = button.dataset.hasProducts !== 'true';
    });
  }

  async function downloadCatalogJpg(entriesArg = null, options = {}) {
    if (catalogPdfBusy) return;
    const entries = Array.isArray(entriesArg) ? entriesArg : catalogPdfEntries();
    if (!entries.length) {
      showPublicToast('لا توجد منتجات ظاهرة للتحميل.');
      return;
    }
    const button = options.button || catalogDownloadPdf;
    const labelNode = catalogExportLabelNode(button);
    const originalLabel = labelNode?.textContent || options.defaultLabel || 'تنزيل جميع المنتجات';
    const scopeName = String(options.scopeName || 'جميع المنتجات');
    const jpgPrefix = options.jpgPrefix ? `${safePdfFilePart(options.jpgPrefix)}-` : '';
    catalogPdfBusy = true;
    setCatalogExportBusy(true);
    let failedImages = 0;
    try {
      try {
        await document.fonts?.load('800 42px Tajawal');
        await document.fonts?.load('500 24px Tajawal');
      } catch (_) {}
      for (let index = 0; index < entries.length; index += 1) {
        if (labelNode) labelNode.textContent = `جاري تجهيز الصور ${index + 1}/${entries.length}`;
        const { item } = entries[index];
        // Export every product with the exact approved datasheet/product template.
        const { canvas, failedImages: pageFailedImages } = await createProductOverviewPdfPage(item, { scale: JPG_EXPORT_SCALE });
        if (pageFailedImages) failedImages += pageFailedImages;
        const base = safePdfFilePart(item?.model || productDisplayName(item) || `catalog-${index + 1}`);
        await downloadCanvasAsJpg(canvas, `${jpgPrefix}${String(index + 1).padStart(2, '0')}-${base}.jpg`);
        await new Promise(resolve => setTimeout(resolve, 160));
      }
      trackEvent('catalog_download', { label: `${scopeName} JPG`, category: options.category || '', products_count: entries.length, failed_images: failedImages });
      showPublicToast(failedImages ? `تم تحميل صور ${scopeName}، وتعذر إدراج ${failedImages} صورة.` : `تم تحميل ${entries.length} صورة من ${scopeName}.`, 4300);
    } catch (error) {
      console.warn('[Catalog JPG] generation failed', error);
      showPublicToast(`تعذر تجهيز صور ${scopeName}. أعد المحاولة بعد التأكد من اتصال الإنترنت.`, 4500);
    } finally {
      catalogPdfBusy = false;
      if (labelNode) labelNode.textContent = originalLabel;
      setCatalogExportBusy(false);
    }
  }

  async function downloadCatalogPdf(entriesArg = null, options = {}) {
    if (catalogPdfBusy) return;
    const entries = Array.isArray(entriesArg) ? entriesArg : catalogPdfEntries();
    if (!entries.length) {
      showPublicToast('لا توجد منتجات ظاهرة للتحميل.');
      return;
    }
    const button = options.button || catalogDownloadPdf;
    const labelNode = catalogExportLabelNode(button);
    const originalLabel = labelNode?.textContent || options.defaultLabel || 'تنزيل جميع المنتجات';
    const scopeName = String(options.scopeName || 'جميع المنتجات');
    const pdfFilename = String(options.pdfFilename || 'flower-light-products-datasheet.pdf');
    catalogPdfBusy = true;
    setCatalogExportBusy(true);
    let failedImages = 0;
    try {
      if (labelNode) labelNode.textContent = 'جاري تحميل أداة PDF…';
      const JsPdf = await loadJsPdfOnDemand();
      try {
        await document.fonts?.load('800 42px Tajawal');
        await document.fonts?.load('500 24px Tajawal');
      } catch (_) {}

      const pdf = new JsPdf({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
      for (let index = 0; index < entries.length; index += 1) {
        if (labelNode) labelNode.textContent = `جاري التجهيز ${index + 1}/${entries.length}`;
        const { item } = entries[index];
        // Export every product with the exact approved datasheet/product template.
        const { canvas, failedImages: pageFailedImages } = await createProductOverviewPdfPage(item, { scale: PDF_EXPORT_SCALE });
        if (pageFailedImages) failedImages += pageFailedImages;
        if (index > 0) pdf.addPage('a4', 'portrait');
        const pageImage = canvas.toDataURL('image/jpeg', PDF_IMAGE_QUALITY);
        pdf.addImage(pageImage, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
        await new Promise(resolve => window.requestAnimationFrame(resolve));
      }

      const blob = pdf.output('blob');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = pdfFilename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 5000);
      trackEvent('catalog_download', { label: `${scopeName} PDF`, category: options.category || '', products_count: entries.length, failed_images: failedImages });
      showPublicToast(failedImages ? `تم تجهيز ${scopeName}، وتعذر إدراج ${failedImages} صورة.` : `تم تحميل ${scopeName}: ${entries.length} منتج.` , 4200);
    } catch (error) {
      console.warn('[Catalog PDF] generation failed', error);
      showPublicToast(`تعذر تجهيز ملف PDF لـ ${scopeName}. أعد المحاولة بعد التأكد من اتصال الإنترنت.`, 4500);
    } finally {
      catalogPdfBusy = false;
      if (labelNode) labelNode.textContent = originalLabel;
      setCatalogExportBusy(false);
    }
  }

  async function handleCatalogDownloadChoice() {
    const choice = await askExportChoice({
      title: 'تنزيل جميع المنتجات',
      subtitle: 'يتم تنزيل جميع المنتجات بنفس قالب الداتا شيت المعتمد، كملف PDF واحد أو صور عالية الدقة.',
      pdfLabel: 'تنزيل جميع المنتجات PDF',
      jpgLabel: 'تنزيل جميع المنتجات صور'
    });
    const options = { button: catalogDownloadPdf, scopeName: 'جميع المنتجات' };
    if (choice === 'jpg') return downloadCatalogJpg(catalogPdfEntries(), options);
    if (choice === 'pdf') return downloadCatalogPdf(catalogPdfEntries(), options);
  }

  async function handleSectionDownloadChoice(section, button) {
    const name = String(section?.name || 'المنتجات').trim() || 'المنتجات';
    const entries = sectionPdfEntries(section);
    if (!entries.length) {
      showPublicToast(`لا توجد منتجات ظاهرة في قسم ${name} للتحميل.`);
      return;
    }
    const choice = await askExportChoice({
      title: `تحميل قسم ${name}`,
      subtitle: `اختر تحميل منتجات قسم ${name} كملف PDF واحد أو صور عالية الدقة.`,
      pdfLabel: `تحميل قسم ${name} PDF`,
      jpgLabel: `تحميل قسم ${name} صور`
    });
    const safeName = safePdfFilePart(name);
    const options = {
      button,
      scopeName: `قسم ${name}`,
      category: name,
      pdfFilename: `flower-light-${safeName}-datasheet.pdf`,
      jpgPrefix: safeName
    };
    if (choice === 'jpg') return downloadCatalogJpg(entries, options);
    if (choice === 'pdf') return downloadCatalogPdf(entries, options);
  }

  catalogDownloadPdf?.addEventListener('click', handleCatalogDownloadChoice);

  // Do not construct all catalog product cards until the catalog is requested.
  // This reduces initial DOM work for visitors who only need the company card.
  let catalogRenderPending = false;
  function renderProducts(force = false) {
    if (!force && !isAdminUrl() && !catalogModal?.classList.contains('open')) {
      catalogRenderPending = true;
      scheduleDeepLinkResolution(); // Direct /p/ and /c/ links must still open.
      return;
    }
    catalogRenderPending = false;
    const data = window.FLOWER_LIGHT_PRODUCTS || {extraSections:[]};
    renderExtraSections(data);
    if (catalogDownloadPdf) catalogDownloadPdf.disabled = catalogPdfBusy || catalogPdfEntries().length === 0;
    scheduleDeepLinkResolution();
  }

  window.flRenderProducts = renderProducts;
  window.addEventListener('flowerlight:language-change',()=>renderProducts());


  const imageLightbox = $('#imageLightbox');
  const imageLightboxImage = $('#imageLightboxImage');
  const imageLightboxCaption = $('#imageLightboxCaption');
  const imageLightboxSpecs = $('#imageLightboxSpecs');
  const imageLightboxCounter = $('#imageLightboxCounter');
  const imageLightboxWhatsApp = $('#imageLightboxWhatsApp');
  const imageLightboxShare = $('#imageLightboxShare');
  const imageLightboxDownloadPdf = $('#imageLightboxDownloadPdf');
  const imageLightboxCatalogPdf = $('#imageLightboxCatalogPdf');
  const imageLightboxStage = $('#imageLightboxStage');
  const closeImageLightboxButton = $('#closeImageLightbox');
  const prevImageLightboxButton = $('#imageLightboxPrev');
  const nextImageLightboxButton = $('#imageLightboxNext');
  let lightboxLastFocus = null;
  let lightboxProducts = [];
  let lightboxProductIndex = 0;
  let lightboxImageIndex = 0;
  let touchStartX = 0;
  let touchStartY = 0;

  function normalizeLightboxProductIndex(index) {
    if (!lightboxProducts.length) return 0;
    return (index + lightboxProducts.length) % lightboxProducts.length;
  }

  function currentLightboxProduct() {
    return lightboxProducts[normalizeLightboxProductIndex(lightboxProductIndex)] || null;
  }

  function currentLightboxGallery() {
    const product = currentLightboxProduct();
    return product ? normalizedProductGallery(product) : [];
  }

  function lightboxNavigationAvailable() {
    return lightboxProducts.length > 1 || currentLightboxGallery().length > 1;
  }

  function neighborLightboxImage(direction) {
    if (!lightboxProducts.length) return '';
    let pIndex = lightboxProductIndex;
    let iIndex = lightboxImageIndex;
    let gallery = normalizedProductGallery(lightboxProducts[pIndex]);
    if (direction > 0) {
      if (iIndex < gallery.length - 1) iIndex += 1;
      else {
        pIndex = normalizeLightboxProductIndex(pIndex + 1);
        gallery = normalizedProductGallery(lightboxProducts[pIndex]);
        iIndex = 0;
      }
    } else {
      if (iIndex > 0) iIndex -= 1;
      else {
        pIndex = normalizeLightboxProductIndex(pIndex - 1);
        gallery = normalizedProductGallery(lightboxProducts[pIndex]);
        iIndex = Math.max(0, gallery.length - 1);
      }
    }
    return gallery[iIndex]?.image || '';
  }

  function preloadLightboxNeighbors() {
    if (!lightboxNavigationAvailable() || navigator.connection?.saveData) return;
    [neighborLightboxImage(-1), neighborLightboxImage(1)].forEach(src => {
      if (!src) return;
      const image = new Image();
      image.fetchPriority = 'low';
      image.decoding = 'async';
      image.src = src;
    });
  }

  function showLightboxState(direction = 0) {
    if (!imageLightboxImage || !lightboxProducts.length) return;
    lightboxProductIndex = normalizeLightboxProductIndex(lightboxProductIndex);
    const item = currentLightboxProduct();
    const gallery = currentLightboxGallery();
    if (!item || !gallery.length) return;
    lightboxImageIndex = Math.min(Math.max(0, lightboxImageIndex), gallery.length - 1);
    const galleryImage = gallery[lightboxImageIndex];

    if (direction) {
      imageLightboxImage.classList.remove('slide-from-left', 'slide-from-right');
      void imageLightboxImage.offsetWidth;
      imageLightboxImage.classList.add(direction > 0 ? 'slide-from-right' : 'slide-from-left');
    }

    imageLightboxImage.src = galleryImage.image;
    imageLightboxImage.alt = item.alt || item.caption || 'صورة المنتج';
    // Runtime safeguard against stale/cascading crop styles.
    imageLightboxImage.style.setProperty('width','auto','important');
    imageLightboxImage.style.setProperty('height','auto','important');
    imageLightboxImage.style.setProperty('max-width','min(94vw, 1080px)','important');
    imageLightboxImage.style.setProperty('max-height','72vh','important');
    imageLightboxImage.style.setProperty('object-fit','contain','important');
    imageLightboxImage.style.setProperty('object-position','center center','important');
    if (imageLightboxCaption) {
      const parts = [];
      if (item?.model) parts.push(`رقم المنتج / الكود: ${item.model}`);
      if (item?.caption) parts.push(item.caption);
      productPricingLines(item).forEach(price => {
        const note = price.note ? ` (${price.note})` : '';
        parts.push(`${price.label}: ${price.value}${note}`);
      });
      if (item?.limited_offer===true && productPricingLines(item).length) parts.push('عرض لفترة محدودة');
      imageLightboxCaption.textContent = parts.join(' — ') || item.alt || '';
    }
    if (imageLightboxSpecs) {
      const specsElement = createProductSpecsElement(item, { compact: false, limit: 30 });
      imageLightboxSpecs.replaceChildren(...(specsElement ? Array.from(specsElement.childNodes) : []));
      imageLightboxSpecs.hidden = !specsElement;
    }
    if (imageLightboxCounter) {
      const imagePart = gallery.length > 1 ? `صورة ${lightboxImageIndex + 1} / ${gallery.length}` : '';
      const productPart = lightboxProducts.length > 1 ? `منتج ${lightboxProductIndex + 1} / ${lightboxProducts.length}` : '';
      imageLightboxCounter.textContent = [imagePart, productPart].filter(Boolean).join(' · ') || '1 / 1';
    }

    const isProduct = Boolean(item?.id && (item?.category || item?.model || item?.name));
    if (imageLightboxWhatsApp) {
      const hasWhatsApp = Boolean(primaryWhatsAppNumber());
      imageLightboxWhatsApp.hidden = !(isProduct && hasWhatsApp);
      if (isProduct && hasWhatsApp) {
        imageLightboxWhatsApp.href = productWhatsAppUrl(item);
        imageLightboxWhatsApp.setAttribute('aria-label', `استفسار واتساب عن ${productDisplayName(item)}${item?.model ? ` كود ${item.model}` : ''}`);
      }
    }
    if (imageLightboxDownloadPdf) {
      imageLightboxDownloadPdf.hidden = !isProduct;
      if (isProduct) {
        const downloadLabel = imageLightboxDownloadPdf.querySelector('span');
        if (downloadLabel && !singleImagePdfBusy && !singleImageJpgBusy) downloadLabel.textContent = gallery.length > 1
          ? `تحميل الصورة ${lightboxImageIndex + 1}`
          : 'تحميل هذه الصورة';
        imageLightboxDownloadPdf.setAttribute('aria-label', `تحميل الصورة ${lightboxImageIndex + 1} من ${gallery.length} بصيغة PDF أو JPG مع المواصفات`);
      }
    }
    if (imageLightboxCatalogPdf) {
      const catalogUrl=String(item?.catalog_pdf_url||'').trim();
      imageLightboxCatalogPdf.hidden=!(isProduct && catalogUrl);
      if(isProduct && catalogUrl){
        imageLightboxCatalogPdf.href=catalogUrl;
        imageLightboxCatalogPdf.setAttribute('aria-label',`فتح كتالوج PDF لـ ${productDisplayName(item)}`);
      }else{
        imageLightboxCatalogPdf.removeAttribute('href');
      }
    }
    if (imageLightboxShare) {
      imageLightboxShare.hidden = !isProduct;
      if (isProduct) imageLightboxShare.setAttribute('aria-label', `مشاركة ${productDisplayName(item)}`);
    }
    if (isProduct) updatePublicUrl({ product: item.id });

    const hasMultiple = lightboxNavigationAvailable();
    prevImageLightboxButton?.toggleAttribute('hidden', !hasMultiple);
    nextImageLightboxButton?.toggleAttribute('hidden', !hasMultiple);
    preloadLightboxNeighbors();
  }

  function openImageLightbox(item, trigger, collection = [item], index = 0, startImageIndex = 0) {
    if (!imageLightbox || !imageLightboxImage) return;
    trackEvent('product_image_open', analyticsProductParams(item));
    lightboxLastFocus = trigger || document.activeElement;
    lightboxProducts = (Array.isArray(collection) && collection.length ? collection : [item]).filter(product => product?.image);
    let exactIndex = lightboxProducts.indexOf(item);
    if (exactIndex < 0 && item?.id) exactIndex = lightboxProducts.findIndex(product => product?.id === item.id);
    lightboxProductIndex = exactIndex >= 0 ? exactIndex : Math.min(Math.max(0,index),Math.max(0,lightboxProducts.length-1));
    const openingGallery = currentLightboxGallery();
    lightboxImageIndex = Math.max(0, Math.min(Math.max(0, openingGallery.length - 1), Number(startImageIndex) || 0));
    showLightboxState();
    imageLightbox.classList.add('open');
    imageLightbox.setAttribute('aria-hidden', 'false');
    document.body.classList.add('image-lightbox-open');
    // Always open from the top. A vertically centered dialog taller than the laptop viewport
    // can otherwise start above the visible area and make the top of the image look cropped.
    imageLightbox.scrollTop = 0;
    imageLightbox.scrollLeft = 0;
    window.setTimeout(() => {
      imageLightbox.scrollTop = 0;
      closeImageLightboxButton?.focus({ preventScroll: true });
    }, 0);
  }

  function showPreviousLightboxItem(method = 'button_or_keyboard') {
    if (!lightboxNavigationAvailable()) return;
    let gallery = currentLightboxGallery();
    if (lightboxImageIndex > 0) {
      lightboxImageIndex -= 1;
    } else {
      lightboxProductIndex = normalizeLightboxProductIndex(lightboxProductIndex - 1);
      gallery = currentLightboxGallery();
      lightboxImageIndex = Math.max(0, gallery.length - 1);
    }
    showLightboxState(-1);
    const item = currentLightboxProduct();
    if (item) trackEvent('product_gallery_navigation', analyticsProductParams(item, { direction: 'previous', method }));
  }

  function showNextLightboxItem(method = 'button_or_keyboard') {
    if (!lightboxNavigationAvailable()) return;
    const gallery = currentLightboxGallery();
    if (lightboxImageIndex < gallery.length - 1) {
      lightboxImageIndex += 1;
    } else {
      lightboxProductIndex = normalizeLightboxProductIndex(lightboxProductIndex + 1);
      lightboxImageIndex = 0;
    }
    showLightboxState(1);
    const item = currentLightboxProduct();
    if (item) trackEvent('product_gallery_navigation', analyticsProductParams(item, { direction: 'next', method }));
  }

  function closeImageLightbox() {
    if (!imageLightbox?.classList.contains('open')) return;
    const currentItem = currentLightboxProduct();
    imageLightbox.classList.remove('open');
    imageLightbox.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('image-lightbox-open');
    imageLightboxImage?.removeAttribute('src');
    imageLightboxImage?.classList.remove('slide-from-left', 'slide-from-right');
    lightboxProducts = [];
    lightboxProductIndex = 0;
    lightboxImageIndex = 0;
    if (catalogModal?.classList.contains('open') && currentItem?.category_slug) {
      updatePublicUrl({ category: currentItem.category_slug });
    } else if (!catalogModal?.classList.contains('open')) {
      updatePublicUrl({});
    }
    if (lightboxLastFocus && typeof lightboxLastFocus.focus === 'function') lightboxLastFocus.focus();
  }

  if (closeImageLightboxButton) closeImageLightboxButton.addEventListener('click', closeImageLightbox);
  prevImageLightboxButton?.addEventListener('click', (event) => {
    event.stopPropagation();
    showPreviousLightboxItem('button');
  });
  nextImageLightboxButton?.addEventListener('click', (event) => {
    event.stopPropagation();
    showNextLightboxItem('button');
  });

  imageLightboxWhatsApp?.addEventListener('click', () => {
    const item = currentLightboxProduct();
    if (item) trackEvent('product_whatsapp_click', analyticsProductParams(item, { source: 'image_lightbox' }));
  });

  imageLightboxDownloadPdf?.addEventListener('click', async () => {
    const gallery = currentLightboxGallery();
    const choice = await askExportChoice({
      title: 'تحميل الصورة الحالية',
      subtitle: `اختر تنزيل الصورة الحالية من المنتج بصيغة PDF أو JPG عالية الدقة${gallery.length > 1 ? ` — الصورة ${lightboxImageIndex + 1} من ${gallery.length}` : ''}.`,
      pdfLabel: 'تحميل PDF',
      jpgLabel: 'تحميل JPG'
    });
    if (choice === 'jpg') return downloadCurrentProductImageJpg();
    if (choice === 'pdf') return downloadCurrentProductImagePdf();
  });

  imageLightboxCatalogPdf?.addEventListener('click',()=>{
    const item=currentLightboxProduct();
    if(item) trackEvent('catalog_download',analyticsProductParams(item,{label:'uploaded_product_catalog_pdf_lightbox'}));
  });

  imageLightboxShare?.addEventListener('click', async () => {
    const item = currentLightboxProduct();
    if (!item?.id) return;
    await shareLink({
      title: productDisplayName(item),
      text: item?.model ? `${productDisplayName(item)} - ${item.model}` : productDisplayName(item),
      url: productShareUrl(item),
      copiedMessage: 'تم نسخ رابط المنتج'
    });
  });

  if (imageLightbox) {
    imageLightbox.addEventListener('click', (event) => {
      if (event.target === imageLightbox) closeImageLightbox();
    });
  }

  if (imageLightboxStage) {
    imageLightboxStage.addEventListener('touchstart', (event) => {
      if (event.touches.length !== 1) return;
      touchStartX = event.touches[0].clientX;
      touchStartY = event.touches[0].clientY;
    }, { passive: true });

    imageLightboxStage.addEventListener('touchend', (event) => {
      if (!event.changedTouches.length || !lightboxNavigationAvailable()) return;
      const deltaX = event.changedTouches[0].clientX - touchStartX;
      const deltaY = event.changedTouches[0].clientY - touchStartY;
      const horizontalSwipe = Math.abs(deltaX) > 45 && Math.abs(deltaX) > Math.abs(deltaY) * 1.15;
      if (!horizontalSwipe) return;
      if (deltaX < 0) showNextLightboxItem('swipe');
      else showPreviousLightboxItem('swipe');
    }, { passive: true });
  }

  const catalogModal = $('#catalogModal');
  const openProducts = $('#openProducts');
  const closeProducts = $('#closeProducts');
  let catalogLastFocus = null;

  let deepLinkTimer = 0;
  let deepLinkBusy = false;
  let lastAutoDeepLink = '';

  function updatePublicUrl(params = {}) {
    if (isAdminUrl()) return;
    const url = new URL(window.location.href);
    url.hash = '';
    url.searchParams.delete('category');
    url.searchParams.delete('product');
    Object.entries(params).forEach(([key, value]) => {
      const clean = String(value || '').trim();
      if (clean) url.searchParams.set(key, clean);
    });
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  }

  function resolveDeepLinkTarget() {
    if (isAdminUrl()) return null;
    const params = new URLSearchParams(window.location.search);
    const productId = String(params.get('product') || '').trim();
    const categoryToken = String(params.get('category') || '').trim();
    if (!productId && !categoryToken) return null;

    const data = window.FLOWER_LIGHT_PRODUCTS || { extraSections: [] };
    const sections = Array.isArray(data.extraSections) ? data.extraSections : [];
    const siteCatalogs=(Array.isArray(window.FLOWER_LIGHT_SITE_CATALOGS)?window.FLOWER_LIGHT_SITE_CATALOGS:[]).filter(c=>String(c?.pdf_url||'').trim());
    if(!productId && categoryToken.startsWith('catalog-')){
      const catalogId=categoryToken.slice(8);
      const catalogIndex=siteCatalogs.findIndex(c=>String(c?.id||'')===catalogId);
      if(catalogIndex>=0){
        const catalog=siteCatalogs[catalogIndex];
        const idToken=String(catalog?.id||catalogIndex).replace(/[^a-zA-Z0-9_-]/g,'');
        return {kind:'category',key:`catalog:${catalogId}`,panelId:`siteCatalogPanel${idToken||catalogIndex}`,section:{name:catalog.name||'كتالوج'},items:[],catalog};
      }
    }
    // Backward-compatible old deep link opens the first catalog.
    if(!productId && categoryToken==='catalog' && siteCatalogs.length){
      const catalog=siteCatalogs[0];const idToken=String(catalog?.id||0).replace(/[^a-zA-Z0-9_-]/g,'');
      return {kind:'category',key:'category:catalog',panelId:`siteCatalogPanel${idToken||0}`,section:{name:catalog.name||'الكتالوج'},items:[],catalog};
    }
    if (!sections.length && !siteCatalogs.length) return null;

    if (productId) {
      for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex += 1) {
        const section = sections[sectionIndex];
        const items = Array.isArray(section.items) ? section.items : [];
        const itemIndex = items.findIndex(item => String(item?.id || '') === productId);
        if (itemIndex >= 0) {
          const safeToken=String(section?.id||section?.slug||sectionIndex).replace(/[^a-zA-Z0-9_-]/g,'');
          return {
            kind: 'product',
            key: `product:${productId}`,
            panelId: `extraSectionPanel${safeToken||sectionIndex}`,
            section,
            items,
            item: items[itemIndex],
            itemIndex
          };
        }
      }
      return null;
    }

    const sectionIndex = sections.findIndex(section => {
      const slug = String(section?.slug || '');
      const id = String(section?.id || '');
      return slug === categoryToken || id === categoryToken;
    });
    if (sectionIndex < 0) return null;
    const section = sections[sectionIndex];
    const safeToken=String(section?.id||section?.slug||sectionIndex).replace(/[^a-zA-Z0-9_-]/g,'');
    return {
      kind: 'category',
      key: `category:${categoryToken}`,
      panelId: `extraSectionPanel${safeToken||sectionIndex}`,
      section,
      items: Array.isArray(section.items) ? section.items : []
    };
  }

  async function ensureProductsAccess() {
    if (typeof window.flBeforeProductsOpen !== 'function') return true;
    try {
      return Boolean(await window.flBeforeProductsOpen());
    } catch (error) {
      console.warn('[Site] Products access check failed.', error);
      return false;
    }
  }

  async function openCatalogToPanel(panelId = '', source = 'button') {
    if (!catalogModal) return false;
    const allowed = await ensureProductsAccess();
    if (!allowed) return false;
    // Create the fresh catalog BEFORE selecting the requested tab/deep link.
    if (catalogRenderPending) renderProducts(true);

    catalogLastFocus = document.activeElement;
    const targetTab = panelId
      ? $$('.catalog-tab').find(tab => tab.dataset.target === panelId)
      : $('.catalog-tab');
    if (targetTab?.dataset.target) {
      setCatalogPanel(targetTab.dataset.target);
      const key = targetTab.dataset.categoryKey;
      if (key) updatePublicUrl({ category: key });
      const selectedPanel=document.getElementById(targetTab.dataset.target);
      if(selectedPanel?.classList.contains('site-catalog-panel')){
        const url=String(selectedPanel.dataset.catalogUrl||'').trim();
        if(url) renderSiteCatalogPages(selectedPanel,url);
      }
    }
    catalogModal.classList.add('open');
    catalogModal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('catalog-open');
    trackEvent('products_open', source === 'deep_link' ? { source: 'deep_link' } : {});
    window.setTimeout(() => closeProducts?.focus(), 0);
    return true;
  }

  async function openResolvedDeepLink(target, automatic = false) {
    if (!target || deepLinkBusy) return false;
    deepLinkBusy = true;
    try {
      const opened = await openCatalogToPanel(target.panelId, automatic ? 'deep_link' : 'button');
      if (!opened) return false;
      if (target.kind === 'product' && target.item) {
        openImageLightbox(target.item, null, target.items, target.itemIndex);
      }
      return true;
    } finally {
      deepLinkBusy = false;
    }
  }

  function scheduleDeepLinkResolution() {
    if (isAdminUrl()) return;
    window.clearTimeout(deepLinkTimer);
    deepLinkTimer = window.setTimeout(async () => {
      const target = resolveDeepLinkTarget();
      if (!target || target.key === lastAutoDeepLink) return;
      const opened = await openResolvedDeepLink(target, true);
      if (opened) lastAutoDeepLink = target.key;
    }, 40);
  }

  function setCatalogPanel(panelId) {
    const tabs = $$('.catalog-tab');
    const panels = $$('.catalog-panel', catalogModal || document);
    tabs.forEach(tab => {
      const active = tab.dataset.target === panelId;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    panels.forEach(panel => panel.classList.toggle('active', panel.id === panelId));
  }

  async function openCatalog() {
    const target = resolveDeepLinkTarget();
    if (target) {
      await openResolvedDeepLink(target, false);
      return;
    }
    await openCatalogToPanel('', 'button');
  }

  function closeCatalog() {
    if (!catalogModal?.classList.contains('open')) return;
    catalogModal.classList.remove('open');
    catalogModal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('catalog-open');
    updatePublicUrl({});
    lastAutoDeepLink = '';
    if (catalogLastFocus && typeof catalogLastFocus.focus === 'function') catalogLastFocus.focus();
  }

  openProducts?.addEventListener('click', () => openCatalog());
  closeProducts?.addEventListener('click', closeCatalog);
  catalogModal?.addEventListener('click', event => {
    if (event.target === catalogModal) closeCatalog();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      if (imageLightbox?.classList.contains('open')) closeImageLightbox();
      else if (catalogModal?.classList.contains('open')) closeCatalog();
    }
  });

  renderProducts();
})();
