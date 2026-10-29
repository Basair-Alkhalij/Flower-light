// Flower Light runtime loader — public/admin modules and service worker.
(() => {
  const adminPanel = new URLSearchParams(location.search).get('admin');
  const isAdminPage = adminPanel === '1' || adminPanel === '2';
  // On the assistant URL, remove the Owner panel button before the admin bundle runs.
  if (adminPanel === '2') document.getElementById('flCloudPrimaryAdmin')?.remove();
  // Declare the runtime dependencies once. Dynamic scripts remain classic,
  // ordered scripts (async=false): each module sees the globals of its predecessors.
  const sharedEntry = isAdminPage ? 'admin.js' : 'public-sync.js';
  const adminBefore = [
    'admin-mfa.js', 'admin-navigation.js', 'admin-overview.js',
    'admin-product-specs.js'
  ];
  const adminAfter = [
    'admin-analytics.js', 'admin-datasheet.js', 'admin-leads.js',
    'admin-permissions.js', 'admin-business.js', 'admin-banks.js',
    'admin-settings.js', 'admin-search-filters.js', 'admin-media.js',
    'admin-products.js', 'admin-product-form.js', 'admin-import.js'
  ];
  const scripts = isAdminPage
    ? [...adminBefore, sharedEntry, ...adminAfter]
    : [sharedEntry, 'catalog-search.js'];
  scripts.forEach(path => {
    const script=document.createElement('script');
    script.src=path+'?v=__FL_VERSION__';
    script.async=false;
    document.body.appendChild(script);
  });

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
