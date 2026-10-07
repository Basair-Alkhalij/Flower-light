// Flower Light / Basair Gulf — cross-device install prompt (v100; install behavior introduced in v99)
(() => {
  'use strict';

  const params = new URLSearchParams(location.search);
  if (params.get('admin') === '1' || params.get('admin') === '2') return;

  const reminder = document.getElementById('pwaInstallReminder');
  const reminderAction = document.getElementById('pwaInstallReminderAction');
  const reminderClose = document.getElementById('pwaInstallReminderClose');
  if (!reminder || !reminderAction) return;

  const KEY_DISMISSED_UNTIL = 'flower_light_pwa_dismissed_until_v3';
  const KEY_INSTALLED_AT = 'flower_light_pwa_installed_at_v3';
  const ua = navigator.userAgent || '';
  const isIOS = /iPad|iPhone|iPod/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
  const isIOSSafari = isIOS && /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|OPT\//i.test(ua);

  // v99: any browser that emits the real `beforeinstallprompt` event (Chrome,
  // Edge, Samsung Internet, Opera on Android and desktop) gets the native
  // install flow. iOS has no such event, so it gets a short Share -> Add to
  // Home Screen guide instead (iOS home-screen apps never carry a browser badge).
  // No "Add to Home screen" shortcut fallback is offered on Android.

  let installOptionEnabled = window.FLOWER_LIGHT_SITE_SETTINGS?.pwa_install_enabled === true;
  let deferredPrompt = null;
  let revealTimer = 0;

  function isStandalone() {
    return window.matchMedia?.('(display-mode: standalone)').matches === true ||
      window.matchMedia?.('(display-mode: fullscreen)').matches === true ||
      window.navigator.standalone === true;
  }

  function readNumber(key) {
    try {
      const value = Number(localStorage.getItem(key));
      return Number.isFinite(value) ? value : 0;
    } catch (_) {
      return 0;
    }
  }

  function store(key, value) {
    try { localStorage.setItem(key, String(value)); } catch (_) {}
  }

  function dismissedForNow() {
    return Date.now() < readNumber(KEY_DISMISSED_UNTIL);
  }

  function hideReminder() {
    window.clearTimeout(revealTimer);
    reminder.classList.remove('show');
    window.setTimeout(() => { reminder.hidden = true; }, 180);
  }

  function mayOfferInstall() {
    return installOptionEnabled && (Boolean(deferredPrompt) || isIOS) && !isStandalone() && !dismissedForNow();
  }

  function showReminder() {
    if (!mayOfferInstall()) return;
    if (document.visibilityState === 'hidden') return;
    reminder.hidden = false;
    requestAnimationFrame(() => reminder.classList.add('show'));
  }

  function scheduleReminder() {
    window.clearTimeout(revealTimer);
    if (!mayOfferInstall()) {
      hideReminder();
      return;
    }
    prepareIOSCopy();
    revealTimer = window.setTimeout(showReminder, 1800);
  }

  function applySiteSettings(settings) {
    installOptionEnabled = settings?.pwa_install_enabled === true;
    if (!installOptionEnabled) {
      hideReminder();
      return;
    }
    scheduleReminder();
  }

  const reminderText = document.getElementById('pwaInstallReminderText');
  let iosGuideOpen = false;

  function prepareIOSCopy() {
    if (!isIOS || deferredPrompt) return;
    if (reminderText) reminderText.textContent = isIOSSafari
      ? 'لتثبيته على الآيفون: اضغط زر المشاركة ثم «إضافة إلى الشاشة الرئيسية».'
      : 'على الآيفون افتح الرابط في متصفح Safari ثم اختر المشاركة ثم «إضافة إلى الشاشة الرئيسية».';
    reminderAction.textContent = 'كيف؟';
  }

  async function requestInstall() {
    if (!mayOfferInstall()) {
      hideReminder();
      return;
    }

    if (!deferredPrompt && isIOS) {
      if (!iosGuideOpen) {
        iosGuideOpen = true;
        if (reminderText) reminderText.textContent = isIOSSafari
          ? '١) اضغط زر المشاركة أسفل الشاشة  ٢) اختر «إضافة إلى الشاشة الرئيسية»  ٣) اضغط «إضافة».'
          : 'افتح هذا الرابط في Safari ثم: المشاركة ← «إضافة إلى الشاشة الرئيسية» ← «إضافة».';
        reminderAction.textContent = 'تم';
        return;
      }
      store(KEY_DISMISSED_UNTIL, Date.now() + 7 * 24 * 60 * 60 * 1000);
      hideReminder();
      return;
    }

    const promptEvent = deferredPrompt;
    deferredPrompt = null;
    hideReminder();

    try {
      // Browser security requires this native confirmation to follow a user tap.
      await promptEvent.prompt();
      const result = await promptEvent.userChoice;
      if (result?.outcome === 'accepted') {
        store(KEY_INSTALLED_AT, Date.now());
      } else {
        store(KEY_DISMISSED_UNTIL, Date.now() + 7 * 24 * 60 * 60 * 1000);
      }
    } catch (error) {
      console.warn('[PWA] Native install prompt failed.', error);
      store(KEY_DISMISSED_UNTIL, Date.now() + 7 * 24 * 60 * 60 * 1000);
    }
  }

  // The notice is revealed only if the Owner enabled it in site settings AND
  // either the browser emitted a real install prompt or the device is an iPhone/iPad.
  window.addEventListener('beforeinstallprompt', (event) => {
    if (isStandalone()) return;
    event.preventDefault();
    deferredPrompt = event;
    scheduleReminder();
  });

  window.addEventListener('flowerlight:site-settings', (event) => {
    applySiteSettings(event.detail || window.FLOWER_LIGHT_SITE_SETTINGS || {});
  });

  window.addEventListener('appinstalled', () => {
    store(KEY_INSTALLED_AT, Date.now());
    deferredPrompt = null;
    hideReminder();
  });

  reminderAction.addEventListener('click', requestInstall);
  reminderClose?.addEventListener('click', () => {
    store(KEY_DISMISSED_UNTIL, Date.now() + 7 * 24 * 60 * 60 * 1000);
    hideReminder();
  });

  if (isStandalone() || !installOptionEnabled) hideReminder();

  window.FL_PWA_INSTALL = {
    requestInstall,
    showReminder,
    hideReminder,
    isStandalone,
    isEligibleDevice: () => isIOS || Boolean(deferredPrompt),
    isEnabled: () => installOptionEnabled,
    hasNativePrompt: () => Boolean(deferredPrompt)
  };
})();
