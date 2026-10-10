// Flower Light multi-product quote list (v111 task 4)
(() => {
  'use strict';

  const STORAGE_KEY = 'fl_quote_list_v1';
  const MAX_ITEMS = 30;
  const MAX_QTY = 9999;
  const MAX_NAME = 80;
  const MAX_NOTES = 500;
  const MAX_URL_LENGTH = 1800;
  const state = new Map();
  let lastFocus = null;

  const doc = typeof document !== 'undefined' ? document : null;
  const isEnabled = () => window.FLOWER_LIGHT_SITE_SETTINGS?.quote_list_enabled !== false;
  const clampQty = value => Math.max(1, Math.min(MAX_QTY, Math.trunc(Number(value) || 1)));
  const cleanText = (value, max) => Array.from(String(value ?? '').trim()).slice(0, max).join('');
  const AVAILABILITY_LABELS = Object.freeze({ available: 'متوفر', out_of_stock: 'نفد', coming_soon: 'قريبًا' });
  const normalizeAvailability = value => Object.hasOwn(AVAILABILITY_LABELS, String(value || '').trim()) ? String(value).trim() : 'available';
  const cleanItem = (item, qty = 1) => {
    const id = cleanText(item?.id || item?.model || item?.name || '', 120);
    if (!id) return null;
    return {
      id,
      name: cleanText(item?.name || item?.caption || item?.alt || 'منتج', MAX_NAME) || 'منتج',
      model: cleanText(item?.model || '', 80),
      availability: normalizeAvailability(item?.availability),
      qty: clampQty(qty)
    };
  };

  function safeLoad() {
    try {
      const raw = window.localStorage?.getItem(STORAGE_KEY);
      const rows = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(rows)) return;
      rows.slice(0, MAX_ITEMS).forEach(row => {
        const item = cleanItem(row, row?.qty);
        if (item) state.set(item.id, item);
      });
    } catch (_) {}
  }

  function safeSave() {
    try {
      window.localStorage?.setItem(STORAGE_KEY, JSON.stringify(Array.from(state.values())));
    } catch (_) {}
  }

  function toast(message) {
    if (typeof window.flShowPublicToast === 'function') window.flShowPublicToast(message);
  }

  function track(name) {
    if (typeof window.flTrack === 'function') window.flTrack(name, { item_count: state.size });
  }

  function normalizeWhatsAppNumber(value) {
    if (typeof window.flNormalizeWhatsAppNumber === 'function') return window.flNormalizeWhatsAppNumber(value);
    let digits = String(value || '').replace(/\D/g, '');
    if (digits.startsWith('00')) digits = digits.slice(2);
    if (/^05\d{8}$/.test(digits)) return `966${digits.slice(1)}`;
    if (/^5\d{8}$/.test(digits)) return `966${digits}`;
    if (/^96605\d{8}$/.test(digits)) return `966${digits.slice(4)}`;
    return digits;
  }

  function primaryWhatsAppNumber() {
    if (typeof window.flPrimaryWhatsAppNumber === 'function') return window.flPrimaryWhatsAppNumber();
    const list = Array.isArray(window.FLOWER_LIGHT_CONTACTS) ? window.FLOWER_LIGHT_CONTACTS : [];
    const value = list.find(row => row?.type === 'whatsapp' && row?.is_visible !== false)?.value || '';
    return normalizeWhatsAppNumber(value);
  }

  function quoteListWhatsAppMessage(items, { name = '', notes = '' } = {}) {
    const rows = Array.isArray(items) ? items : [];
    const lines = ['السلام عليكم، أرغب بعرض سعر للمنتجات التالية:'];
    rows.forEach((row, index) => {
      const item = cleanItem(row, row?.qty);
      if (!item) return;
      const hasDistinctModel = item.model && item.model !== item.name;
      const code = hasDistinctModel ? ` — ${item.model}` : '';
      const productLine = `${item.name}${code} * ${item.qty}`;
      lines.push(`${index + 1}) \u2066${productLine}\u2069`);
    });
    const cleanName = cleanText(name, 80);
    const cleanNotes = cleanText(notes, MAX_NOTES);
    if (cleanName) lines.push(`الاسم: ${cleanName}`);
    if (cleanNotes) lines.push(`ملاحظات: ${cleanNotes}`);
    const profile = window.FLOWER_LIGHT_PROFILE || {};
    const brand = cleanText(profile.brand_name || profile.company_name || '', 100);
    if (brand) lines.push(`العلامة التجارية: ${brand}`);
    return lines.join('\n');
  }

  function currentItems() {
    return Array.from(state.values()).map(row => ({ ...row }));
  }

  function syncProductControls() {
    if (!doc?.querySelectorAll) return;
    doc.querySelectorAll('[data-quote-control-id]').forEach(control => {
      const id = control.dataset.quoteControlId || '';
      renderProductControl(control, id);
    });
  }

  function emit() {
    safeSave();
    renderFloatingBar();
    syncProductControls();
    if (doc?.getElementById('flQuoteModal')?.classList.contains('open')) renderModalList();
  }

  function add(item, qty = 1) {
    if (!isEnabled()) return false;
    const clean = cleanItem(item, qty);
    if (!clean) return false;
    if (clean.availability !== 'available') {
      toast(`هذا المنتج ${AVAILABILITY_LABELS[clean.availability]} ولا يمكن إضافته لقائمة الطلب حاليًا`);
      return false;
    }
    const current = state.get(clean.id);
    if (!current && state.size >= MAX_ITEMS) {
      toast(`الحد الأقصى ${MAX_ITEMS} صنفًا في قائمة الطلب`);
      return false;
    }
    state.set(clean.id, {
      ...clean,
      qty: current ? Math.min(MAX_QTY, current.qty + clampQty(qty)) : clampQty(qty)
    });
    emit();
    track('quote_list_add');
    return true;
  }

  function setQty(id, qty) {
    const key = String(id || '');
    const current = state.get(key);
    if (!current) return false;
    const number = Math.trunc(Number(qty));
    if (!Number.isFinite(number) || number <= 0) {
      state.delete(key);
      emit();
      return true;
    }
    current.qty = Math.min(MAX_QTY, number);
    state.set(key, current);
    emit();
    return true;
  }

  function remove(id) {
    const changed = state.delete(String(id || ''));
    if (changed) emit();
    return changed;
  }

  function clear() {
    if (!state.size) return;
    state.clear();
    emit();
  }

  function createButton(className, label, text) {
    const button = doc.createElement('button');
    button.type = 'button';
    button.className = className;
    button.setAttribute('aria-label', label);
    button.textContent = text;
    return button;
  }
  function createQuantityInput(item, className) {
    const input = doc.createElement('input');
    input.type = 'number';
    input.className = className;
    input.min = '1';
    input.max = String(MAX_QTY);
    input.step = '1';
    input.inputMode = 'numeric';
    input.value = String(item.qty);
    input.setAttribute('aria-label', `كمية ${item.name}`);
    input.setAttribute('autocomplete', 'off');
    input.addEventListener('focus', () => input.select());
    input.addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        input.blur();
      }
    });
    input.addEventListener('change', () => {
      const raw = String(input.value || '').trim();
      if (!raw) {
        input.value = String(state.get(item.id)?.qty || item.qty || 1);
        return;
      }
      const parsed = Number(raw);
      if (!Number.isFinite(parsed)) {
        input.value = String(state.get(item.id)?.qty || item.qty || 1);
        return;
      }
      const next = Math.max(1, Math.min(MAX_QTY, Math.trunc(parsed)));
      input.value = String(next);
      setQty(item.id, next);
    });
    return input;
  }


  function renderProductControl(control, id) {
    if (!control || !doc) return;
    const enabled = isEnabled();
    control.hidden = !enabled;
    control.closest('.product-card-actions')?.classList.toggle('has-quote-list', enabled);
    control.replaceChildren();
    if (!enabled) return;
    const item = control._quoteItem;
    const current = state.get(String(id || ''));
    const availability = normalizeAvailability(item?.availability);
    if (availability !== 'available') {
      if (current) {
        state.delete(current.id);
        safeSave();
        renderFloatingBar();
        if (doc?.getElementById('flQuoteModal')?.classList.contains('open')) renderModalList();
      }
      const unavailable = createButton('quote-list-add-button is-unavailable', `${item?.name || 'المنتج'} غير متاح للطلب`, AVAILABILITY_LABELS[availability]);
      unavailable.disabled = true;
      unavailable.dataset.availability = availability;
      control.append(unavailable);
      return;
    }
    if (!current) {
      const addButton = createButton('quote-list-add-button', `أضف ${item?.name || 'المنتج'} لقائمة الطلب`, 'أضف لقائمة الطلب');
      addButton.setAttribute('aria-pressed', 'false');
      addButton.addEventListener('click', () => add(item, 1));
      control.append(addButton);
      return;
    }
    const group = doc.createElement('div');
    group.className = 'quote-list-qty-control';
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', `كمية ${current.name}`);
    const minus = createButton('quote-list-qty-button', `إنقاص كمية ${current.name}`, '−');
    const value = createQuantityInput(current, 'quote-list-qty-value');
    const plus = createButton('quote-list-qty-button', `زيادة كمية ${current.name}`, '+');
    plus.setAttribute('aria-pressed', 'true');
    minus.addEventListener('click', () => setQty(current.id, current.qty - 1));
    plus.addEventListener('click', () => setQty(current.id, current.qty + 1));
    group.append(minus, value, plus);
    control.append(group);
  }

  function createAddControl(item) {
    if (!doc?.createElement) return null;
    const clean = cleanItem(item, 1);
    if (!clean) return null;
    const control = doc.createElement('div');
    control.className = 'quote-list-product-control';
    control.dataset.quoteControlId = clean.id;
    control._quoteItem = clean;
    renderProductControl(control, clean.id);
    return control;
  }

  function ensureUi() {
    if (!doc?.body || doc.getElementById('flQuoteBar')) return;
    const bar = doc.createElement('button');
    bar.type = 'button';
    bar.id = 'flQuoteBar';
    bar.className = 'fl-quote-bar';
    bar.hidden = true;
    bar.setAttribute('aria-haspopup', 'dialog');
    bar.setAttribute('aria-controls', 'flQuoteModal');
    bar.innerHTML = '<span>قائمة الطلب</span><strong id="flQuoteCount">0</strong>';
    bar.addEventListener('click', openModal);

    const modal = doc.createElement('div');
    modal.id = 'flQuoteModal';
    modal.className = 'fl-quote-modal';
    modal.setAttribute('aria-hidden', 'true');
    modal.innerHTML = `
      <section class="fl-quote-dialog" role="dialog" aria-modal="true" aria-labelledby="flQuoteTitle">
        <div class="fl-quote-head">
          <div><h2 id="flQuoteTitle">قائمة طلب عرض السعر</h2><p>عدّل الكميات ثم أرسل الطلب إلى واتساب.</p></div>
          <button type="button" class="fl-quote-close" id="flQuoteClose" aria-label="إغلاق قائمة الطلب">×</button>
        </div>
        <div class="fl-quote-items" id="flQuoteItems"></div>
        <label class="fl-quote-field"><span>الاسم <small>(اختياري)</small></span><input id="flQuoteName" maxlength="80" autocomplete="name"></label>
        <label class="fl-quote-field"><span>ملاحظات <small>(حتى 500 حرف)</small></span><textarea id="flQuoteNotes" maxlength="500" rows="3"></textarea></label>
        <div class="fl-quote-actions">
          <button type="button" class="fl-quote-send" id="flQuoteSend">إرسال عبر واتساب</button>
          <button type="button" class="fl-quote-clear" id="flQuoteClear">مسح القائمة</button>
        </div>
      </section>`;
    modal.addEventListener('click', event => { if (event.target === modal) closeModal(); });
    doc.body.append(bar, modal);
    doc.getElementById('flQuoteClose')?.addEventListener('click', closeModal);
    doc.getElementById('flQuoteClear')?.addEventListener('click', () => {
      clear();
      closeModal();
      toast('تم مسح قائمة الطلب');
    });
    doc.getElementById('flQuoteSend')?.addEventListener('click', sendToWhatsApp);
    doc.addEventListener('keydown', event => {
      if (!modal.classList.contains('open')) return;
      if (event.key === 'Escape') { event.preventDefault(); closeModal(); return; }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(modal.querySelectorAll('button:not([disabled]),input:not([disabled]),textarea:not([disabled])')).filter(el => !el.hidden);
      if (!focusable.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && doc.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && doc.activeElement === last) { event.preventDefault(); first.focus(); }
    });
    renderFloatingBar();
  }

  function renderFloatingBar() {
    const bar = doc?.getElementById('flQuoteBar');
    if (!bar) return;
    const count = state.size;
    const enabled = isEnabled();
    bar.hidden = !enabled || count === 0;
    const badge = doc.getElementById('flQuoteCount');
    if (badge) badge.textContent = String(count);
    doc.body?.classList.toggle('fl-has-quote-bar', enabled && count > 0);
  }

  function renderModalList() {
    const host = doc?.getElementById('flQuoteItems');
    if (!host) return;
    host.replaceChildren();
    currentItems().forEach(item => {
      const row = doc.createElement('article');
      row.className = 'fl-quote-item';
      const copy = doc.createElement('div');
      copy.className = 'fl-quote-item-copy';
      const name = doc.createElement('strong');
      name.textContent = item.name;
      const model = doc.createElement('small');
      model.textContent = item.model ? `الكود: ${item.model}` : 'بدون كود';
      copy.append(name, model);
      const qty = doc.createElement('div');
      qty.className = 'fl-quote-item-qty';
      const minus = createButton('fl-quote-mini', `إنقاص كمية ${item.name}`, '−');
      const value = createQuantityInput(item, 'fl-quote-item-qty-input');
      const plus = createButton('fl-quote-mini', `زيادة كمية ${item.name}`, '+');
      minus.addEventListener('click', () => setQty(item.id, item.qty - 1));
      plus.addEventListener('click', () => setQty(item.id, item.qty + 1));
      qty.append(minus, value, plus);
      const del = createButton('fl-quote-remove', `حذف ${item.name} من قائمة الطلب`, 'حذف');
      del.addEventListener('click', () => remove(item.id));
      row.append(copy, qty, del);
      host.append(row);
    });
  }

  function openModal() {
    ensureUi();
    if (!isEnabled() || !state.size) return;
    const modal = doc?.getElementById('flQuoteModal');
    if (!modal) return;
    lastFocus = doc.activeElement;
    renderModalList();
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    doc.body?.classList.add('fl-quote-open');
    window.requestAnimationFrame(() => doc.getElementById('flQuoteClose')?.focus());
  }

  function closeModal() {
    const modal = doc?.getElementById('flQuoteModal');
    if (!modal?.classList.contains('open')) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    doc.body?.classList.remove('fl-quote-open');
    if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
  }

  function sendToWhatsApp() {
    if (!isEnabled()) return false;
    const items = currentItems();
    if (!items.length) return false;
    const number = primaryWhatsAppNumber();
    if (!number) {
      toast('لا يوجد رقم واتساب متاح حاليًا');
      return false;
    }
    const name = doc?.getElementById('flQuoteName')?.value || '';
    const notes = doc?.getElementById('flQuoteNotes')?.value || '';
    const message = quoteListWhatsAppMessage(items, { name, notes });
    const url = `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
    if (url.length > MAX_URL_LENGTH) {
      toast('الطلب طويل جدًا لواتساب. قلّل عدد الأصناف أو الملاحظات.');
      return false;
    }
    track('quote_list_send');
    window.open(url, '_blank', 'noopener');
    return true;
  }

  function applyVisibility() {
    if (!doc) return;
    const enabled = isEnabled();
    if (!enabled) closeModal();
    syncProductControls();
    renderFloatingBar();
    doc.getElementById('flQuoteModal')?.toggleAttribute('data-quote-disabled', !enabled);
  }

  safeLoad();
  if (doc) {
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', () => { ensureUi(); applyVisibility(); }, { once: true });
    else { ensureUi(); applyVisibility(); }
    window.addEventListener('flowerlight:site-settings', applyVisibility);
  }

  window.FL_QUOTE_LIST = Object.freeze({
    storageKey: STORAGE_KEY,
    limits: Object.freeze({ maxItems: MAX_ITEMS, maxQty: MAX_QTY, maxName: MAX_NAME, maxNotes: MAX_NOTES, maxUrlLength: MAX_URL_LENGTH }),
    items: currentItems,
    add,
    setQty,
    remove,
    clear,
    createAddControl,
    isEnabled,
    applyVisibility,
    open: openModal,
    close: closeModal,
    quoteListWhatsAppMessage,
    _sendToWhatsApp: sendToWhatsApp
  });
})();
