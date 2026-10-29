// Flower Light / Basair Gulf — single Supabase configuration.
// Edit ONLY this file when the Supabase project changes (admin.js and public-sync.js read it).
// The anonKey is a Publishable/Anon key meant for browsers. NEVER put a secret server key here.
window.FLOWER_LIGHT_SUPABASE = {
  url: 'https://quwqffoomwujqhcxhjnx.supabase.co',
  anonKey: 'sb_publishable_qMpOoYpst_F1eVMIfFOF_A_wfIViNss',
  storageBucket: 'product-images',
  // Public Cloudflare Turnstile site key. The secret belongs only in Supabase.
  // If Turnstile is unavailable, customer submissions fail closed; there is no direct database insert fallback.
  turnstileSiteKey: '0x4AAAAAAFQBEMBlCMKy0NKI',
  leadSubmissionFunction: 'submit-customer-lead'
};


// Google Analytics 4 is optional. Paste the Web data stream Measurement ID (G-...) here.
// Leave blank to keep analytics fully disabled. This ID is public and is safe in browser code.
window.FLOWER_LIGHT_ANALYTICS_CONFIG = {
  measurementId: 'G-WQRZWGY367',
  debug: false
};
