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

  // Task 8: anonymous, rate-limited JavaScript error monitoring.
  const ERROR_COUNT_KEY = 'flowerlight:js-error-count:v1';
  const MAX_SESSION_ERRORS = 5;
  let sessionErrors = 0;
  let reportingError = false;

  const errorText = value => String(value ?? '');
  const isExtensionError = (...values) => values.some(value => /(?:chrome|moz)-extension:/i.test(errorText(value)));
  const safeErrorMessage = value => {
    const raw = errorText(value);
    const typeMatch = raw.match(/\b(TypeError|ReferenceError|SyntaxError|RangeError|URIError|EvalError|AggregateError|NetworkError)\b/i);
    const type = typeMatch ? typeMatch[1] : 'JavaScript';
    const knownReasons = [
      'Cannot read properties', 'Cannot set properties', 'is not a function',
      'is not defined', 'Failed to fetch', 'Unexpected token',
      'Loading chunk', 'Script error'
    ];
    const reason = knownReasons.find(phrase => raw.toLowerCase().includes(phrase.toLowerCase())) || 'runtime error';
    // Never send raw exception text: it can include names, URLs, or tokens.
    return (type + ': ' + reason).slice(0, 100);
  };
  const safeErrorSource = value => {
    const cleanPath = errorText(value).split(/[?#]/)[0].replaceAll('\\', '/');
    const name = cleanPath.slice(cleanPath.lastIndexOf('/') + 1);
    return /^[a-z\d_.-]{1,80}$/i.test(name) ? name : 'unknown';
  };
  const safeErrorLine = value => {
    const line = Number(value);
    return Number.isInteger(line) && line > 0 ? Math.min(line, 1000000) : 0;
  };
  const currentErrorCount = () => {
    try {
      const value = Number(window.sessionStorage?.getItem(ERROR_COUNT_KEY));
      if (Number.isInteger(value) && value >= 0) sessionErrors = Math.max(sessionErrors, Math.min(value, MAX_SESSION_ERRORS));
    } catch (_) { /* sessionStorage is optional */ }
    return sessionErrors;
  };
  const reportBrowserError = event => {
    if (reportingError || currentErrorCount() >= MAX_SESSION_ERRORS) return;
    // Resource loading errors are not JavaScript exceptions.
    if (event?.type === 'error' && typeof event.message !== 'string' && !event.error) return;
    const failure = event?.reason || event?.error;
    const message = event?.message || failure?.message || failure;
    const source = event?.filename || failure?.fileName || '';
    if (isExtensionError(message, source, failure?.stack)) return;

    reportingError = true;
    try {
      sessionErrors += 1;
      try { window.sessionStorage?.setItem(ERROR_COUNT_KEY, String(sessionErrors)); } catch (_) {}
      window.flTrack('js_error', {
        message: safeErrorMessage(message),
        source: safeErrorSource(source),
        line: safeErrorLine(event?.lineno || failure?.lineNumber)
      });
    } catch (_) {
      // Error reporting must never cause another visible error.
    } finally {
      reportingError = false;
    }
  };
  window.addEventListener('error', reportBrowserError);
  window.addEventListener('unhandledrejection', reportBrowserError);

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
