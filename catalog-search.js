// Flower Light / Basair Gulf — in-catalog search/filter
//
// Design goal: add zero risk to the existing rendering pipeline in app.js.
// This file does NOT modify renderExtraSections / createProductCard / the
// tab-switching logic at all. It only:
//   1. Reads already-rendered DOM (product cards inside the active panel).
//   2. Hides/shows them by text match.
//   3. Resets itself automatically whenever the catalog re-renders (e.g.
//      after the admin edits products and the public page reloads live
//      data), via a MutationObserver — so it can never show a stale filter
//      over fresh data.
//
// Scope: searches text already visible on the card (name, model, specs,
// price labels) within the CURRENTLY OPEN category tab. It intentionally
// does not search across tabs or inside uploaded PDF catalog panels, to
// keep behavior predictable and match what the user sees on screen.

(() => {
  'use strict';

  function normalize(text) {
    return String(text || '')
      .toLowerCase()
      // Normalize common Arabic letter variants so "اناره"/"إنارة" style
      // differences don't hide obvious matches.
      .replace(/[\u064B-\u0652]/g, '')      // strip tashkeel
      .replace(/[إأآا]/g, 'ا')
      .replace(/ى/g, 'ي')
      .replace(/ة/g, 'ه')
      .trim();
  }

  function init() {
    const input = document.getElementById('catalogSearchInput');
    const countLabel = document.getElementById('catalogSearchCount');
    const tabsHost = document.querySelector('.catalog-tabs');
    const sheet = document.querySelector('.catalog-sheet');
    if (!input || !countLabel || !tabsHost || !sheet) return;

    function activePanel() {
      return sheet.querySelector('.catalog-panel.active');
    }

    function applyFilter() {
      const panel = activePanel();
      const query = normalize(input.value);

      // Search only applies to product-grid panels (extra-section-panel).
      // Uploaded PDF catalog panels (site-catalog-panel) have no product
      // cards to filter, so the box is simply inert there.
      const isSearchablePanel = !!panel && panel.classList.contains('extra-section-panel');
      input.disabled = !isSearchablePanel;
      input.placeholder = isSearchablePanel
        ? 'ابحث داخل هذا القسم (الاسم أو الموديل)…'
        : 'البحث غير متاح لملفات PDF المرفوعة';

      if (!isSearchablePanel) {
        countLabel.hidden = true;
        return;
      }

      const cards = panel.querySelectorAll('.chandelier-card');
      if (!query) {
        cards.forEach((card) => card.classList.remove('catalog-search-hidden'));
        countLabel.hidden = true;
        return;
      }

      let visible = 0;
      cards.forEach((card) => {
        const match = normalize(card.textContent).includes(query);
        card.classList.toggle('catalog-search-hidden', !match);
        if (match) visible += 1;
      });

      countLabel.hidden = false;
      countLabel.textContent = visible
        ? `${visible} نتيجة`
        : 'لا توجد نتائج مطابقة في هذا القسم';
    }

    let debounceTimer = 0;
    input.addEventListener('input', () => {
      window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(applyFilter, 120);
    });

    // Re-apply the current query when the visitor switches tabs. Tabs are
    // (re)created dynamically by app.js, but this delegated listener on the
    // static .catalog-tabs container keeps working across re-renders, and
    // runs after the tab's own click handler has already swapped the
    // active panel.
    tabsHost.addEventListener('click', (event) => {
      if (event.target.closest('.catalog-tab')) {
        window.setTimeout(applyFilter, 0);
      }
    });

    // If the catalog data reloads (admin changed products, or a scheduled
    // refresh runs), clear any stale search rather than risk hiding newly
    // added products behind an old query.
    const observer = new MutationObserver(() => {
      if (input.value) {
        input.value = '';
      }
      applyFilter();
    });
    observer.observe(tabsHost, { childList: true });

    applyFilter();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
