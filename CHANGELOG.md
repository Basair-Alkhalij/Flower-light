## v109 — 2026-10-07

- Public bank accounts are now collapsed by default behind a single **الحسابات البنكية** row, matching the compact public-card controls.
- Clicking the row expands/collapses the bank-account cards without changing copy actions or admin management.
- Added accessible `aria-expanded` / `aria-controls` behavior and browser coverage for the accordion.

# Changelog

## v108

- إضافة قسم مستقل للحسابات البنكية في لوحة المدير.
- دعم عدة بنوك مع اسم البنك، اسم المستفيد، IBAN، رقم الحساب، SWIFT وملاحظة اختيارية.
- تحديد حساب رئيسي واحد، ترتيب الحسابات، إظهار/إخفاء وحذف.
- التحقق من IBAN قبل الحفظ، بما في ذلك طول IBAN السعودي وchecksum.
- عرض الحسابات البنكية للزوار ببطاقات بسيطة مع أزرار نسخ مباشرة.
- إضافة migration وملف ترقية مستقل `UPGRADE_EXISTING_V108.sql`.


## v107

- دمج بيانات المنشأة داخل بطاقة الموقع مباشرة أسفل عبارة `DIGITAL BUSINESS CARD` بدل عرضها كبطاقة مستقلة.
- جعل بيانات المنشأة العامة بسيطة ومرنة كسطر/أسطر صغيرة متجاوبة مع الجوال، مع الإبقاء على الخانات الديناميكية من لوحة المدير.
- الإبقاء على العرض التفصيلي لبيانات المنشأة داخل صفحة سياسة الخصوصية.
- تحسين بطاقة **تحسين الصور القديمة** بإضافة أيقونة وهوية لونية ووصف مختصر متناسق مع بقية أدوات المنتجات.
- جعل شبكة أدوات المنتجات تتوزع تلقائيًا حسب المساحة المتاحة مع الحفاظ على تخطيطات الجوال الحالية.

## v106 — 2026-10-07
- Redesigned the public business/company details as an integrated card aligned with the main site instead of detached footer lines.
- Replaced fixed company display fields with owner-managed dynamic rows: add, rename, edit, show/hide, reorder and delete.
- Kept customer-lead retention as a separate operational privacy setting while optionally showing it on the privacy page.
- Added `business_public_fields` with owner-only RLS and a filtered public RPC payload.
- Added `UPGRADE_EXISTING_V106.sql` and migration seeding existing company name/CR/VAT/contact into dynamic rows once.
- Included a catch-up definition of `replace_legacy_product_image_for_owner` so legacy WebP conversion works even on databases that missed the older v101 migration.
- Improved the legacy-image tool copy and shows the number of old images eligible for optimization.

## v105 — 2026-10-06
- Added paged public loading for categories, products and product gallery rows to avoid PostgREST row-limit truncation.
- Fixed service-worker admin isolation by detecting the requesting admin client, and added missing bootstrap/loader/business-info files to the shell cache.
- Added build-generated CSP hash for inline JSON-LD and tightened production catalog URLs to HTTPS.
- Hardened the customer-lead Edge Function with JSON/body-size checks, no-store responses and trusted gateway IP headers.
- Added explicit `supabase/config.toml` function auth configuration.
- Enforced configurable customer-lead retention with daily pg_cron when available plus application fallbacks.
- Added a single `supabase/UPGRADE_EXISTING_V105.sql` path for upgrading an existing v103 database without relying on inconsistent historical migration tracking.

## v104 — 2026-10-06
- Unified GitHub Pages deployment on GitHub Actions / generated `dist`.
- Added build-generated release token from `package.json` and made missing esbuild a hard failure.
- Added Turnstile-protected customer-lead Edge Function and per-network salted-hash rate limiting migration.
- Removed the legacy whole-site customer lead rate trigger in the v104 migration and revoked anonymous direct inserts after activation.
- Added CSP, SRI for SheetJS/PDF.js/jsPDF/JSZip paths, and upgraded SheetJS to 0.20.3.
- Hardened catalog download URL validation and switched navigation HTML in the service worker to network-first.
- Replaced the privacy draft with an operational privacy notice and moved obsolete upgrade docs to `legacy/`.
- Added `site-bootstrap.js` and `site-loader.js` to separate bootstrap/loading logic from HTML.

# v103 — reorganized owner dashboard and responsive pricing editor

- Reorganized the Owner dashboard so the overview contains only statistics and shortcuts instead of mixing multiple settings forms into one page.
- Added Owner-only pages for **Site Settings**, **Company Data**, and **Product Template**; these pages are not part of the sub-admin permission list.
- Moved the primary recovery-email settings into **Login Credentials** alongside the Owner/Admin account controls.
- Grouped the side navigation into content management, owner settings, and accounts.
- Fixed product price-tier sizing so wholesale/bulk quantity ranges and the delete button remain inside the editor at laptop, tablet, and mobile widths.
- Raised row edit/delete/drag controls to at least 44px touch targets and kept the add-specification button inside its card.
- Styled company-data fieldsets consistently inside the admin panel.
- Bumped cache/static assets to v103 and package version to 1.0.3.
- Build now falls back to unminified JS/CSS when `esbuild` is unavailable instead of failing; with dependencies installed it still minifies normally.

# v102 — editable company/privacy details

- Add supplied company name, CR, tax ID, phone and 180-day retention default via SQL seed.
- Owner can edit every field, hide fields independently or hide the entire detail block.
- Private RLS table and filtered public RPC; no hidden-value fallback in public HTML/JS.
- Live details shown on catalog footer and privacy page; cache version 102.
- See START_HERE_V102_AR.txt for activation steps.

# v101 — 2026-10-05

- Fix product duplication imports and opening the duplicate editor.
- Fix MAX_PRODUCT_IMAGES temporal-dead-zone crash during admin initialization.
- Add actual esbuild production output, lockfile and tested Pages deployment.
- Update assets and PWA cache to v101.
- Add owner-only legacy image conversion with original preservation and transaction RPC.
- Centralize SEO URL and privacy build fields in site-settings.json.
- Add duplicate regression and WebP browser coverage; 12 Chromium tests passed.
- Include existing-database migration bundle and Arabic installation guide.

## v100 — Product modules, responsive WebP images, and build guardrails
- Split the remaining product-management surface out of `admin.js` into `admin-media.js`, `admin-products.js`, `admin-product-form.js`, and `admin-import.js`; `admin.js` is now about 146 KB / 2206 lines.
- New product image uploads create a 1400px `.l.webp` plus a 480px `.s.webp`; catalog cards use the small image with `loading="lazy"` and `decoding="async"`, while detail/lightbox flows keep the large image. Existing legacy image paths remain compatible.
- Product copy/delete/import/rollback logic now understands the large+thumbnail pair; duplicate products fall back to copying the large WebP into the thumbnail slot if an older pair is incomplete.
- Added product-module runtime tests and thumbnail/source checks; browser smoke now verifies split modules and the small-image path.
- Added `scripts/build.mjs` / `npm run build:check` for JavaScript syntax checks, release references, raw-size budgets, and gzip-size reporting. A homemade JS minifier was deliberately not shipped because it can corrupt valid JavaScript URLs; use a real parser/bundler (e.g. Vite/Terser) in a later build-pipeline migration.
- `live-site-smoke.mjs` is dynamic and discovers the currently deployed asset URLs instead of hard-coding a release number.
- PWA/admin settings copy and browser tests were aligned with the current v99 native-install behavior.
- Fresh Supabase setup now includes the product pricing/promotion columns used by the current UI/importer, plus an idempotent migration for older databases that missed them.
- App shell/cache/assets bumped to v100.

## v99 — Cross-device install
- Removed the Samsung-only restriction. The Owner-enabled install notice now appears on any browser that fires the real `beforeinstallprompt` event (Chrome/Edge/Samsung Internet/Opera, Android and desktop) and uses the native install dialog.
- iPhone/iPad get a short in-notice guide (Share -> Add to Home Screen); iOS home-screen apps carry no browser badge.
- Still no Android "Add to Home screen" shortcut fallback. Cache/assets bumped to v99.

## v98 — Owner-controlled strict PWA install
- Added an Owner setting to show/hide the install option for customers.
- Added `site_settings.pwa_install_enabled` plus an upgrade migration.
- Strict install eligibility now shows the in-site prompt only on Samsung Internet running on a Samsung Android device after `beforeinstallprompt` fires.
- Chrome/Edge/Firefox/Opera/Brave are intentionally hidden in strict mode because a web page cannot reliably verify GMS/WebAPK availability before install, and those paths may fall back to browser-badged shortcuts.
- Bumped app shell/cache/assets to v98.


## v97 — PWA install hardening
- Android installation is offered only through the browser's real `beforeinstallprompt` event; no shortcut fallback is shown.
- Added iOS/Android standalone meta tags and simplified the manifest `start_url`.
- Cached all install icons in the service worker and bumped the app shell cache to v97.
- Dismissing the install reminder now postpones it for 7 days.
## v97 — Native install prompt only

- Removed the permanent install button and all Android/iPhone instruction sheets.
- Android now shows one compact install notice only when the browser exposes a real native PWA install prompt.
- Tapping «تثبيت» immediately opens the browser/OS native confirmation; no fallback to «Add to Home screen» is used, avoiding browser-shortcut badges where the browser supports true PWA installation.
- iPhone does not show a misleading one-click prompt because iOS does not expose `beforeinstallprompt`.
- Manifest/cache/tests bumped to v97.

# سجل النسخة النهائية

## v95 — PWA install experience
- Added an in-site **Install app** button for Android and iPhone/iPad.
- Android/Chromium uses the native `beforeinstallprompt` flow when available; otherwise device-specific browser instructions are shown.
- iPhone/iPad gets Safari-specific **Share → Add to Home Screen** instructions, with a separate hint when opened in another iOS browser.
- Added a smart install reminder: 45s on first visit, 15s for returning visitors, or 7s after opening products; choosing **Later** snoozes it for 7 days.
- Install UI is suppressed for admin pages and already-installed standalone sessions.
- Added automated PWA UI tests and bumped static/cache assets to v95.

- اعتماد `flower-light-phase3-fixed` كأساس.
- تحديث الهوية إلى بصائر الخليج / Flower Light.
- تحديث رابط GitHub Pages المستهدف.
- تثبيت PWA على مسارات نسبية وإصدار cache جديد.
- تشديد CORS وإصلاح Edge Function.
- إضافة ملفات SEO الأساسية.
- تنظيف أسماء المشروع القديم من ملفات الإصدار والاختبارات.
- الإبقاء على بحث الكتالوج وفصل تحليلات الإدارة.

## v90
- Single `config.js` for Supabase settings (removed duplicate blocks from admin.js and public-sync.js).
- PWA icons: 512x512 `any` plus real `maskable` 192/512 icons.
- Added `404.html` and a draft `privacy.html` (needs legal review and filling the bracketed fields), linked from the lead form.
- Removed the old personal-name example from the admin profile field.
- CI now syntax-checks config.js, admin-analytics.js, catalog-search.js and sw.js; smoke test covers the new files.
- Cache/version bumped to v90 (index.html, manifest, sw.js).

## v91
- Module split part 2: the customer-leads section moved out of `admin.js` into `admin-leads.js` (loading, search, pagination, VCF export, delete). Logic unchanged; `admin.js` shrank by ~180 lines.
- `admin.js` now waits briefly for split-out modules (`whenModule`) before the first data load.
- New `tests/leads-module.mjs` exercises the module with a stubbed database (paging, search, totals, safe no-op without core).
- Cache/version bumped to v91.

## v92
- Module split part 3: the Admin-permissions screen moved from `admin.js` to `admin-permissions.js` (logic unchanged; shared state reached through `FL_ADMIN_CORE`).
- `admin.js` shows a clear "section failed to load, refresh" message instead of a blank panel if any split-out module is missing (`renderSplitSection`, used for analytics, leads and permissions).
- New `tests/permissions-module.mjs` (RPC payload, non-delegatable keys hidden/filtered, no RPC without a linked admin account, safe no-op without core).
- Cache/version bumped to v92.

## v93
- Module split part 4: the Owner site-settings cards (customer-lead gate, master barcode, design footer number/label), their loader and the barcode upload helper moved from `admin.js` to `admin-settings.js` (logic unchanged). The Owner recovery-email card intentionally stays in `admin.js`.
- `admin.js` is now ~3040 lines (from 3406 at the start of the module split).
- New `tests/settings-module.mjs`: loads settings, saves the three cards with the exact database payloads, rejects invalid/oversized barcode files before any database call, sub-admin sees nothing, safe no-op without core.
- `tests/smoke.mjs` now checks the settings UI strings across `admin.js` + `admin-settings.js`.
- Cache/version bumped to v93.

## v94
- Fixed the browser runtime crash in category rendering: `createCategoryDownloadButton()` now has access to the HTML escaping helper in the main app scope.
- Updated the GitHub Pages canonical host to `basair-alkhalij.github.io` across pages, SEO files, tests, and Edge Function CORS.
- Synced `config.js` with the new Supabase project and its browser-safe publishable key.
- Updated live-site smoke checks and all static asset cache-busters to v94; service-worker cache bumped to `flower-light-shell-v94`.
- Updated GitHub Actions checkout/setup-node actions to v5 to avoid the Node 20 deprecation warning.
