// Flower Light / Basair Gulf — single Supabase configuration.
// Edit ONLY this file when the Supabase project changes (admin.js and public-sync.js read it).
// The anonKey is a Publishable/Anon key meant for browsers. NEVER put a secret server key here.
window.FLOWER_LIGHT_SUPABASE = {
  url: 'https://quwqffoomwujqhcxhjnx.supabase.co',
  anonKey: 'sb_publishable_qMpOoYpst_F1eVMIfFOF_A_wfIViNss',
  storageBucket: 'product-images',
  // Set this to your Cloudflare Turnstile site key after deploying submit-customer-lead.
  // Leave blank until the server-side setup is complete; the site will keep the legacy direct insert path.
  turnstileSiteKey: '0x4AAAAAAFQBEMBlCMKy0NKI',
  leadSubmissionFunction: 'submit-customer-lead'
};
