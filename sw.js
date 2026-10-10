// Flower Light / Basair Gulf service worker — final release
//
// Scope: caches ONLY the static "app shell" (HTML/CSS/JS/icons) so the card
// opens instantly and works offline after a first visit. It deliberately does
// NOT touch:
//   - admin.js or any ?admin= request (the admin panel must always be fresh)
//   - Supabase / API / CDN requests (products, images, auth — always live)
// This keeps product data and the admin panel from ever going stale, which
// matters more for a live catalog than offline support does.
//
// CACHE_VERSION is generated automatically from package.json during build.
// Do not edit the release number here by hand.

const CACHE_VERSION = 'flower-light-shell-v__FL_VERSION__';

const SHELL_URLS = [
  './',
  './index.html',
  './style.css?v=__FL_VERSION__',
  './analytics.js?v=__FL_VERSION__',
  './catalog-pdf-viewer.js?v=__FL_VERSION__',
  './app.js?v=__FL_VERSION__',
  './site-bootstrap.js?v=__FL_VERSION__',
  './site-loader.js?v=__FL_VERSION__',
  './business-info.js?v=__FL_VERSION__',
  './bank-info.js?v=__FL_VERSION__',
  './pwa-install.js?v=__FL_VERSION__',
  './config.js?v=__FL_VERSION__',
  './public-sync.js?v=__FL_VERSION__',
  './catalog-search.js?v=__FL_VERSION__',
  './company-logo.png?v=__FL_VERSION__',
  './manifest.webmanifest',
  './favicon-32.png?v=__FL_VERSION__',
  './favicon-192.png?v=__FL_VERSION__',
  './icon-512.png?v=__FL_VERSION__',
  './icon-192-maskable.png?v=__FL_VERSION__',
  './icon-512-maskable.png?v=__FL_VERSION__',
  './apple-touch-icon.png?v=__FL_VERSION__',
  './404.html',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(SHELL_URLS))
      .catch((err) => console.warn('[SW] Shell precache failed (non-fatal).', err))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

function isShellRequest(url) {
  if (url.origin !== self.location.origin) return false;
  if (url.search.includes('admin=')) return false;
  const path = url.pathname;
  if (path.endsWith('/admin.js')) return false;
  return (
    path.endsWith('/') ||
    path.endsWith('/index.html') ||
    path.endsWith('/style.css') ||
    path.endsWith('/analytics.js') ||
    path.endsWith('/catalog-pdf-viewer.js') ||
    path.endsWith('/app.js') ||
    path.endsWith('/site-bootstrap.js') ||
    path.endsWith('/site-loader.js') ||
    path.endsWith('/business-info.js') ||
    path.endsWith('/bank-info.js') ||
    path.endsWith('/pwa-install.js') ||
    path.endsWith('/config.js') ||
    path.endsWith('/public-sync.js') ||
    path.endsWith('/catalog-search.js') ||
    path.endsWith('/company-logo.png') ||
    path.endsWith('/manifest.webmanifest') ||
    path.endsWith('/favicon-32.png') ||
    path.endsWith('/favicon-192.png') ||
    path.endsWith('/icon-512.png') ||
    path.endsWith('/icon-192-maskable.png') ||
    path.endsWith('/icon-512-maskable.png') ||
    path.endsWith('/apple-touch-icon.png')
  );
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (!isShellRequest(url)) return;

  event.respondWith((async () => {
    // An already-installed service worker can still control an admin tab. Detect
    // the requesting client itself so admin assets always bypass the public cache.
    const client = event.clientId ? await self.clients.get(event.clientId) : null;
    if (client) {
      try {
        const clientUrl = new URL(client.url);
        if (clientUrl.searchParams.has('admin')) return fetch(request);
      } catch (_) {}
    }

    const isNavigation = request.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('/index.html');
    if (isNavigation) {
      try {
        const response = await fetch(request);
        if (response && response.ok) {
          const cache = await caches.open(CACHE_VERSION);
          await cache.put(request, response.clone());
        }
        return response;
      } catch (_) {
        return (await caches.match(request)) || caches.match('./index.html');
      }
    }

    const cached = await caches.match(request);
    const network = fetch(request)
      .then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => cached);
    return cached || network;
  })());
});
