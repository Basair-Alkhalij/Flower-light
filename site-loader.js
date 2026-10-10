// Flower Light runtime loader — public/admin modules and service worker.
(() => {
  const adminPanel = new URLSearchParams(location.search).get('admin');
  const isAdminPage = adminPanel === '1' || adminPanel === '2';
  // On the assistant URL, remove the Owner panel button before the admin bundle runs.
  if (adminPanel === '2') document.getElementById('flCloudPrimaryAdmin')?.remove();
  const script = document.createElement('script');
  script.src = isAdminPage ? 'admin.js?v=__FL_VERSION__' : 'public-sync.js?v=__FL_VERSION__';
  script.async = false;
  document.body.appendChild(script);

  if (isAdminPage) {
    // Final release module split: must load after admin.js, which sets up
    // window.FL_ADMIN_CORE that this (and future split-out sections) rely on.
    const analyticsScript = document.createElement('script');
    analyticsScript.src = 'admin-analytics.js?v=__FL_VERSION__';
    analyticsScript.async = false;
    document.body.appendChild(analyticsScript);

    const datasheetScript = document.createElement('script');
    datasheetScript.src = 'admin-datasheet.js?v=__FL_VERSION__';
    datasheetScript.async = false;
    document.body.appendChild(datasheetScript);

    // Module split part 2: customer leads section (also needs admin.js first).
    const leadsScript = document.createElement('script');
    leadsScript.src = 'admin-leads.js?v=__FL_VERSION__';
    leadsScript.async = false;
    document.body.appendChild(leadsScript);

    // Module split part 3: admin-permissions screen (Owner only).
    const permissionsScript = document.createElement('script');
    permissionsScript.src = 'admin-permissions.js?v=__FL_VERSION__';
    permissionsScript.async = false;
    document.body.appendChild(permissionsScript);

    const businessScript = document.createElement('script');
    businessScript.src = 'admin-business.js?v=__FL_VERSION__';
    businessScript.async = false;
    document.body.appendChild(businessScript);

    const banksScript = document.createElement('script');
    banksScript.src = 'admin-banks.js?v=__FL_VERSION__';
    banksScript.async = false;
    document.body.appendChild(banksScript);

    // Module split part 4: Owner site-settings cards (lead gate, barcode, footer number).
    const settingsScript = document.createElement('script');
    settingsScript.src = 'admin-settings.js?v=__FL_VERSION__';
    settingsScript.async = false;
    document.body.appendChild(settingsScript);

    const searchFiltersScript = document.createElement('script');
    searchFiltersScript.src = 'admin-search-filters.js?v=__FL_VERSION__';
    searchFiltersScript.async = false;
    document.body.appendChild(searchFiltersScript);


    // Product-area module split (v100): media, list/order, form, and Excel import/export.
    const mediaScript = document.createElement('script');
    mediaScript.src = 'admin-media.js?v=__FL_VERSION__';
    mediaScript.async = false;
    document.body.appendChild(mediaScript);

    const productsScript = document.createElement('script');
    productsScript.src = 'admin-products.js?v=__FL_VERSION__';
    productsScript.async = false;
    document.body.appendChild(productsScript);

    const productFormScript = document.createElement('script');
    productFormScript.src = 'admin-product-form.js?v=__FL_VERSION__';
    productFormScript.async = false;
    document.body.appendChild(productFormScript);

    const importScript = document.createElement('script');
    importScript.src = 'admin-import.js?v=__FL_VERSION__';
    importScript.async = false;
    document.body.appendChild(importScript);
  }

  if (!isAdminPage) {
    const searchScript = document.createElement('script');
    searchScript.src = 'catalog-search.js?v=__FL_VERSION__';
    searchScript.async = false;
    document.body.appendChild(searchScript);
  }

  // Offline/installable support for visitors only — never for the admin panel,
  // so the admin always runs the latest code with nothing cached.
  if (!isAdminPage && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch((err) => {
        console.warn('[Site] Service worker registration failed.', err);
      });
    });
  }
})();
