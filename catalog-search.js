// Flower Light / Basair Gulf — global catalog search
//
// Searches all rendered product sections without creating a second product renderer.
// Matching product cards stay in their original section. Sections with no matches
// are hidden while searching, and each visible result shows its section name.
// Uploaded PDF catalog tabs are intentionally excluded from product search.

(() => {
  'use strict';

  function normalize(text) {
    return String(text || '')
      .toLowerCase()
      .replace(/[\u064B-\u0652]/g, '')
      .replace(/[إأآا]/g, 'ا')
      .replace(/ى/g, 'ي')
      .replace(/ة/g, 'ه')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function init() {
    const input = document.getElementById('catalogSearchInput');
    const countLabel = document.getElementById('catalogSearchCount');
    const tabsHost = document.querySelector('.catalog-tabs');
    const sheet = document.querySelector('.catalog-sheet');
    if (!input || !countLabel || !tabsHost || !sheet) return;

    function productPanels() {
      return Array.from(sheet.querySelectorAll('.extra-section-panel'));
    }

    function tabForPanel(panel) {
      return Array.from(tabsHost.querySelectorAll('.extra-section-tab'))
        .find(tab => tab.dataset.target === panel.id) || null;
    }

    function sectionName(panel) {
      return tabForPanel(panel)?.querySelector('strong')?.textContent?.trim() || 'قسم';
    }

    function clearSectionMarker(card) {
      card.querySelector('.catalog-search-section-label')?.remove();
      const caption = card.querySelector('figcaption[data-search-created-caption="1"]');
      if (caption && !caption.childElementCount && !caption.textContent.trim()) caption.remove();
    }

    function showSectionMarker(card, name) {
      let caption = card.querySelector('figcaption.product-card-info');
      if (!caption) {
        caption = document.createElement('figcaption');
        caption.className = 'product-card-info';
        caption.dataset.searchCreatedCaption = '1';
        const firstAfterThumb = card.children[1] || null;
        card.insertBefore(caption, firstAfterThumb);
      }
      let row = caption.querySelector('.catalog-search-section-label');
      if (!row) {
        row = document.createElement('div');
        row.className = 'product-code-row catalog-search-section-label';
        const label = document.createElement('span');
        label.textContent = 'القسم';
        const value = document.createElement('strong');
        row.append(label, value);
        caption.prepend(row);
      }
      row.querySelector('strong').textContent = name;
    }

    function resetSearchView() {
      tabsHost.querySelectorAll('.catalog-tab').forEach(tab => tab.classList.remove('catalog-search-hidden'));
      productPanels().forEach(panel => {
        panel.querySelectorAll('.chandelier-card').forEach(card => {
          card.classList.remove('catalog-search-hidden');
          clearSectionMarker(card);
        });
      });
    }

    function activateTab(tab) {
      if (!tab || tab.classList.contains('active')) return;
      tab.click();
    }

    function applyFilter() {
      const panels = productPanels();
      const query = normalize(input.value);
      const hasProducts = panels.length > 0;

      input.disabled = !hasProducts;
      input.placeholder = hasProducts
        ? 'ابحث في جميع الأقسام (الاسم أو الكود أو المواصفات)…'
        : 'لا توجد أقسام منتجات قابلة للبحث';

      if (!hasProducts) {
        countLabel.hidden = true;
        return;
      }

      if (!query) {
        resetSearchView();
        countLabel.hidden = true;
        return;
      }

      let totalMatches = 0;
      let matchingSections = 0;
      let firstMatchingTab = null;

      tabsHost.querySelectorAll('.site-catalog-tab').forEach(tab => tab.classList.add('catalog-search-hidden'));

      panels.forEach(panel => {
        const tab = tabForPanel(panel);
        const name = sectionName(panel);
        let sectionMatches = 0;

        panel.querySelectorAll('.chandelier-card').forEach(card => {
          const searchable = normalize([
            card.dataset.productName,
            card.dataset.productModel,
            card.textContent,
            name
          ].join(' '));
          const match = searchable.includes(query);
          card.classList.toggle('catalog-search-hidden', !match);
          if (match) {
            sectionMatches += 1;
            totalMatches += 1;
            showSectionMarker(card, name);
          } else {
            clearSectionMarker(card);
          }
        });

        if (tab) {
          tab.classList.toggle('catalog-search-hidden', sectionMatches === 0);
          if (sectionMatches && !firstMatchingTab) firstMatchingTab = tab;
        }
        if (sectionMatches) matchingSections += 1;
      });

      const activeTab = tabsHost.querySelector('.catalog-tab.active');
      if (totalMatches > 0 && (!activeTab || activeTab.classList.contains('catalog-search-hidden'))) {
        activateTab(firstMatchingTab);
      } else if (totalMatches === 0 && activeTab?.classList.contains('site-catalog-tab')) {
        activateTab(tabsHost.querySelector('.extra-section-tab'));
      }

      countLabel.hidden = false;
      countLabel.textContent = totalMatches
        ? `${totalMatches} نتيجة · ${matchingSections} قسم`
        : 'لا توجد نتائج مطابقة في جميع الأقسام';
    }

    let debounceTimer = 0;
    input.addEventListener('input', () => {
      window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(applyFilter, 120);
    });

    tabsHost.addEventListener('click', event => {
      if (event.target.closest('.catalog-tab') && input.value) {
        window.setTimeout(applyFilter, 0);
      }
    });

    const observer = new MutationObserver(() => {
      if (input.value) input.value = '';
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
