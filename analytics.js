// Flower Light public application
// Extracted from index.html without changing runtime behavior.

// Google Analytics 4 is configured in config.js.
// Analytics stays disabled until a real Measurement ID (G-...) is supplied there.

(() => {
  'use strict';

  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

  const config = window.FLOWER_LIGHT_ANALYTICS_CONFIG || {};
  const measurementId = String(config.measurementId || '').trim();
  const validMeasurementId = /^G-[A-Z0-9]+$/i.test(measurementId) ;

  // Always expose a safe tracking function so the rest of the site never breaks
  // if Analytics is not configured or is blocked by the browser.
  window.flTrack = function flTrack(eventName, params = {}) {
    if (!eventName) return;
    if (!validMeasurementId || typeof window.gtag !== 'function') {
      if (config.debug) console.info('[Flower Light analytics]', eventName, params);
      return;
    }
    try {
      window.gtag('event', eventName, {
        ...params,
        transport_type: 'beacon'
      });
    } catch (error) {
      if (config.debug) console.warn('[Flower Light analytics] event failed', error);
    }
  };

  if (!validMeasurementId) {
    if (config.debug) console.info('[Flower Light analytics] Add a GA4 Measurement ID in FLOWER_LIGHT_ANALYTICS_CONFIG');
    return;
  }

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function gtag(){ window.dataLayer.push(arguments); };

  window.gtag('js', new Date());
  window.gtag('config', measurementId, {
    send_page_view: true
  });

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  script.referrerPolicy = 'strict-origin-when-cross-origin';
  document.head.appendChild(script);

})();
