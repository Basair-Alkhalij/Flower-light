# تقرير فحص Flower Light v111B — المهمة 3

النطاق: تنفيذ **المهمة 3: صفحات ثابتة لكل منتج وقسم لتحسين SEO ومعاينات المشاركة** فوق v111A، بدون تعديل قاعدة البيانات وبدون رفع إلى GitHub.

## ما تم تنفيذه

- إضافة `scripts/generate-static-pages.mjs`.
- المولّد يستخدم REST العام لـSupabase وبنفس منطق البيانات العامة في `public-sync.js`:
  - `categories`: `is_visible = true` وترتيب `sort_order, created_at, id`.
  - `products`: `is_visible = true` وترتيب `sort_order, created_at, id`.
  - `product_images`: نفس الأعمدة والترتيب المستخدم في الموقع العام.
- لا تُنشأ صفحة منتج إذا كان قسمه مخفيًا، حتى لو كان المنتج نفسه ظاهرًا.
- لكل منتج ظاهر يتم توليد `dist/p/<id>/index.html` وفيها:
  - title وdescription (حتى 160 حرفًا).
  - canonical.
  - Open Graph وTwitter Card.
  - صورة المنتج العامة من bucket `product-images` مع fallback للصورة العامة.
  - JSON-LD من نوع `Product` مع `sku` من `model` عند توفره.
  - محتوى HTML بسيط يمكن للزاحف قراءته بلا JavaScript.
  - تحويل الزائر البشري إلى `?product=<id>` مع بقاء noscript link.
- لكل قسم ظاهر يتم توليد `dist/c/<slug>/index.html` مع canonical/OG/Twitter وCollectionPage JSON-LD ثم التحويل إلى `?category=<slug>`.
- `dist/sitemap.xml` يُولّد من الصفحة الرئيسية وprivacy وكل `/p/` و`/c/` الظاهرة، مع `lastmod` من `updated_at` متى توفر.
- روابط المشاركة في `app.js` أصبحت `/p/<id>/` و`/c/<slug>/`.
- دعم `?product=` و`?category=` القديم بقي بدون حذف.
- Service Worker يتجاهل مسارات `/p/` و`/c/` ولا يخزنها ضمن app shell.
- `.github/workflows/pages.yml` أصبح يعيد البناء كل 6 ساعات ويحتفظ بـ`workflow_dispatch`.
- `validate.yml` يفحص المولّد واختباره الجديد.
- `tests/local-server.mjs` أصبح يخدم `index.html` تلقائيًا للمجلدات حتى يحاكي سلوك GitHub Pages في الاختبار المحلي.
- لا توجد migration أو SQL جديدة في v111B.

## سلوك فشل البناء

بناء الإنتاج يشغّل المولّد بعد إنشاء `dist`. إذا فشل جلب Supabase يفشل `npm run build` برسالة واضحة ولا يواصل النشر. يوجد `FL_SKIP_STATIC_PAGES=1` للاختبارات المحلية فقط ولا يُستخدم في GitHub Pages.

## الاختبارات المنفذة في بيئة التجميع

- `node --check scripts/generate-static-pages.mjs`: PASS.
- `node --check app.js`: PASS.
- `node --check sw.js`: PASS.
- `node --check tests/browser-smoke.spec.mjs`: PASS.
- `npm run build:check`: **PASS — BUILD_CHECK_OK v111**.
- `npm run test:static`: **PASS**:
  - `FLOWER_LIGHT_FINAL_SMOKE_OK`
  - `LEADS_MODULE_RUNTIME_OK`
  - `PERMISSIONS_MODULE_RUNTIME_OK`
  - `SETTINGS_MODULE_RUNTIME_OK`
  - `PRODUCT_MODULES_RUNTIME_OK`
  - `THUMBNAILS_OK`
  - `DUPLICATE_PRODUCT_SUCCESS_AND_ROLLBACK_OK`
  - `STATIC_PAGES_OK`

`tests/static-pages.mjs` يتحقق من:
- وجود صفحة المنتج والقسم.
- canonical الصحيح.
- `og:image` من Supabase Storage.
- Product JSON-LD وSKU.
- هروب نص يحتوي `<script>` وعدم إدخاله كـHTML تنفيذي.
- عدم توليد المنتج المخفي.
- عدم توليد منتج ظاهر داخل قسم مخفي.
- وجود الصفحات الصحيحة فقط في sitemap.
- فشل المولّد صراحة عند HTTP 503 بدل المتابعة.

## ما لم يمكن تشغيله داخل بيئة التجميع

- `npm ci` انتهى بمهلة شبكة، وبالتالي لم تتوفر نسخة كاملة من esbuild/Playwright داخل البيئة.
- البيئة لا تستطيع الوصول إلى Supabase عبر Node fetch، لذلك لم يمكن تنفيذ build الحي الذي يجلب المنتجات الفعلية.
- لهذا السبب يجب تشغيل `npm run build` وPlaywright على جهاز الاختبار أو GitHub Actions قبل الدمج.
- v111A المرجعية كانت قد اجتازت على جهاز المستخدم Playwright **17/17 passed** قبل بدء المهمة 3.

## الفحص المطلوب قبل الدمج

على Windows PowerShell:

```powershell
npm.cmd ci --no-audit --no-fund
npm.cmd run build:check
npm.cmd run test:static
npm.cmd run build
npx.cmd playwright install chromium
$env:FL_TEST_DIST="1"
npm.cmd run test:browser
```

بعد `npm run build` تحقق أيضًا من وجود:

- `dist/p/<product-id>/index.html`
- `dist/c/<category-slug>/index.html`
- روابط `/p/` و`/c/` داخل `dist/sitemap.xml`

بعد النشر اختبر رابط منتج في واتساب/تيليجرام، ثم Google Search Console URL Inspection.
