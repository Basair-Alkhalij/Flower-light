// Flower Light catalog technical specifications — normalized keys, filters and display.
// Loaded after catalog-pricing.js and catalog-product-meta.js, before app.js.
(() => {
  'use strict';
  const {PRICING_META_KEY}=window.FL_CATALOG_PRICING;
  const {formatProductSpecValue}=window.FL_CATALOG_PRODUCT_META;

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


  window.FL_CATALOG_SPECIFICATIONS=Object.freeze({
    WHATSAPP_META_SHOW_DESCRIPTION,WHATSAPP_META_SHOW_SPECS,
    productWhatsAppOption,canonicalProductSpecKey,normalizeProductSpecifications,
    productSpecifications,specificationDisplayValue,productSpecsText,createProductSpecsElement
  });
})();
