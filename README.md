# بصائر الخليج — Flower Light v111A

موقع GitHub Pages ثابت لإدارة وعرض منتجات Flower Light، مع Supabase للمصادقة والبيانات والتخزين وEdge Functions.

**الإصدار الحالي:** v111A (`package.json` = `1.1.1`).


## ما الجديد في v111A — المهمة 1 + المهمة 2

- تجهيز إعداد GA4 في `config.js` بدل إبقاء المعرّف الوهمي داخل `analytics.js`. التحليلات تبقى معطلة حتى إضافة Measurement ID حقيقي بصيغة `G-...`.
- تحديث سياسة الخصوصية لتذكر Google Analytics 4 صراحةً عند تفعيله.
- إضافة فحص ثابت يثبت أن `share-image.jpg` بأبعاد **1200×630**.
- تثبيت فحص إنتاج Turnstile على hostname الحالي `basair-alkhalij.github.io` داخل الاختبارات.
- إزالة المعامل القديم `v=87` من روابط مشاركة المنتجات والأقسام، مع إبقاء تنظيف المعامل `v` من الروابط القديمة.
- لا توجد تغييرات قاعدة بيانات في v111A؛ قاعدة v110 الحالية تبقى كما هي.
- المهام 3 وما بعدها ليست ضمن هذه النسخة.

> **GA4:** يلزم تزويد `config.js` بمعرّف Measurement ID الحقيقي ثم التحقق من Realtime بعد النشر. لم يتم وضع معرّف تخميني.

## ما الجديد في v110

- تقسيم `app.js`: نقل GA4 إلى `analytics.js` ونقل عارض كتالوج PDF الكسول إلى `catalog-pdf-viewer.js`.
- تقسيم `admin.js`: نقل مصمم الداتا شيت إلى `admin-datasheet.js` باستخدام `FL_ADMIN_CORE` مثل بقية وحدات المدير.
- تقسيم `style.css` إلى وحدات داخل `styles/` مع إبقاء `style.css` كنقطة دخول واحدة؛ عملية build تجمعها إلى ملف CSS واحد داخل `dist`.
- إنتاج نسخة Supabase ذاتية الاستضافة: أثناء `npm run build` يتم تنزيل الإصدار المثبت `@supabase/supabase-js@2.57.4` مرة واحدة إلى `dist/supabase-vendor.js`، ويُعاد ربط `index.html` به. لذلك الموقع المنشور لا يعتمد على CDN لـSupabase وقت التشغيل.
- توحيد ترقية قاعدة البيانات بعد v105 في ملف واحد: `supabase/UPGRADE_EXISTING_V110.sql`.
- ملفات الترقية المتكررة القديمة v106/v108 نُقلت إلى `legacy/sql/`، بينما بقيت migrations الأصلية داخل `supabase/migrations/` كسجل تاريخي واضح.
- تحديث ميزانيات أحجام الملفات وفحوصات GitHub Actions لتشمل الوحدات الجديدة.

## النشر على GitHub Pages

استخدم **GitHub Actions فقط**:

`Settings → Pages → Build and deployment → Source → GitHub Actions`

Source = GitHub Actions

لا تستخدم **Deploy from a branch**، ولا ترفع `dist` أو `node_modules` يدويًا. Workflow `pages.yml` يقوم بـ:

1. `npm ci`
2. `npm run test:static`
3. `npm run build`
4. تثبيت Chromium
5. `npm run test:browser` على `dist`
6. نشر `dist` إلى GitHub Pages

## الترقية من قاعدة موجودة

### إذا كانت القاعدة على v105 أو أحدث

شغّل **ملفًا واحدًا فقط** في Supabase SQL Editor:

`supabase/UPGRADE_EXISTING_V110.sql`

والنتيجة النهائية المتوقعة:

`UPGRADE_EXISTING_V110_OK`

الملف يجمع تغييرات الخانات المرنة لبيانات المنشأة والحسابات البنكية. لا تشغّل `SUPABASE_SETUP.sql` مرة أخرى على قاعدة حية موجودة.

### إذا كانت القاعدة أقدم من v105

طبّق أولًا `supabase/UPGRADE_EXISTING_V105.sql`، ثم `supabase/UPGRADE_EXISTING_V110.sql`.

## Turnstile وحماية نموذج العملاء

الإعداد الإنتاجي يستخدم:

- `turnstileSiteKey` في `config.js` — مفتاح عام.
- `TURNSTILE_SECRET_KEY` في Supabase Edge Function Secrets — سري.
- `LEAD_RATE_LIMIT_PEPPER` في Supabase Edge Function Secrets — سري.
- Edge Function: `submit-customer-lead`.

لا تضع أي Secret داخل GitHub أو `config.js`.

## Supabase Auth

في إعداد الإنتاج الحالي تم تأكيد ما يلي أثناء الإعداد اليدوي:

- التسجيل العام **Sign-ups = OFF**.
- MFA/TOTP مفعّل لحساب مالك Supabase.

هذه إعدادات حساب/مشروع في Supabase وليست ملفات داخل المستودع؛ افحصها يدويًا إذا نُقل المشروع إلى حساب أو مشروع Supabase جديد.

## حالة التحقق قبل النشر

- v111A: `build:check` و`test:static` ناجحان محليًا بعد تنفيذ المهمة 1 والمهمة 2.
- أضيف اختبار Browser جديد يؤكد أن روابط مشاركة المنتج والقسم لا تحتوي `v=87`.
- البناء الكامل وPlaywright لـv111A يجب أن ينجحا على جهاز الاختبار أو GitHub Actions قبل الدمج؛ بيئة التجميع الحالية لم تستطع إكمال `npm ci` بسبب مهلة شبكة.
- v110 المستقرة المرجعية كانت قد اجتازت Playwright **16/16 passed** قبل بدء هذه النسخة.
- GitHub Actions تبقى بوابة تحقق إلزامية قبل نشر `dist`.

## بناء واختبار محلي

على Windows PowerShell:

```powershell
npm.cmd ci
npm.cmd run build:check
npm.cmd run test:static
npm.cmd run build
npx.cmd playwright install chromium
$env:FL_TEST_DIST="1"
npm.cmd run test:browser
```

`npm run build` يحتاج اتصالًا بالإنترنت وقت البناء فقط لتحضير نسخة Supabase المثبتة إلى `dist/supabase-vendor.js`. ملف المصدر `index.html` يبقي رابط CDN المثبت لتسهيل المعاينة المباشرة غير المبنية، لكن build يستبدله بملف محلي ويزيل jsDelivr من CSP الإنتاجي؛ لذلك الزيارة المنشورة لا تعتمد على CDN لـSupabase وقت التشغيل.

## هيكل الملفات الرئيسي

- `app.js` — واجهة المنتجات الأساسية.
- `analytics.js` — GA4.
- GA4 Measurement ID مضبوط حاليًا في `config.js`: `G-WQRZWGY367`. بعد النشر تحقّق من Realtime.
- `catalog-pdf-viewer.js` — عرض PDF داخل الموقع بتحميل كسول.
- `public-sync.js` — مزامنة البيانات العامة مع Supabase.
- `admin.js` — النواة والتنقل والمصادقة في لوحة المدير.
- `admin-*.js` — وحدات لوحة المدير، ومنها `admin-datasheet.js`.
- `style.css` — نقطة دخول CSS.
- `styles/` — وحدات CSS المصدرية.
- `supabase/UPGRADE_EXISTING_V110.sql` — مسار الترقية الموحد من v105+.
- `supabase/migrations/` — سجل migrations التاريخي/القابل للتتبع.
- `legacy/` — ملفات الإصدارات القديمة للرجوع فقط؛ لا تستخدمها في نشر جديد.
- `scripts/build.mjs` — الفحص والبناء والتصغير وتوليد الإصدار وCSP وربط Supabase المحلي للإنتاج.
- `tests/` — اختبارات static وPlaywright.

## ملاحظات أمنية

- رابط `?admin=1` ليس سرًا؛ الحماية الحقيقية هي Supabase Auth + RLS.
- لا تضع `service_role` أو Turnstile Secret في ملفات الواجهة.
- سياسة الخصوصية موجودة في `privacy.html` ويجب مراجعتها قانونيًا حسب نشاط المنشأة.
- مكتبات PDF/Excel الخارجية مثبتة بإصدارات محددة وSRI حيث يدعم أسلوب التحميل ذلك.
- Supabase في **نسخة الإنتاج** يصبح أصلًا محليًا `supabase-vendor.js` بدل تحميله من CDN وقت زيارة المستخدم.

## ملاحظة الصيانة

v111A تبني على تنظيف v110 وتضيف فقط إعدادات الإنتاج وتنظيف روابط المشاركة؛ v110 قلّلت حجم الملفات المركزية ويواصل الانتقال التدريجي إلى وحدات منفصلة بدون إعادة كتابة خطرة للمشروع دفعة واحدة. يمكن لاحقًا نقل أقسام إضافية من `app.js` و`admin.js` إلى وحدات، لكن هذا الإصدار يركّز على الانقسامات الأقل مخاطرة مع الحفاظ على السلوك الحالي.
