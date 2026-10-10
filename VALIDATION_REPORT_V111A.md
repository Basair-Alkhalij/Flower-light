# تقرير فحص Flower Light v111A — 8 أكتوبر 2026

النطاق: تنفيذ **المهمة 1 (إعدادات الإنتاج)** و**المهمة 2 (تنظيف الروابط المباشرة)** فقط، فوق v110 النهائية المستقرة بدون تعديلها.

## ما تم تنفيذه

- `package.json` و`package-lock.json` إلى `1.1.1` (release token = v111).
- نقل إعداد GA4 إلى `config.js` وإزالة `G-XXXXXXXXXX` من `analytics.js`.
- GA4 يبقى معطلاً إذا كانت `measurementId` فارغة أو غير صالحة.
- تحديث `privacy.html` لذكر Google Analytics 4 صراحة عند تفعيله.
- إضافة فحص ثابت لأبعاد `share-image.jpg` = **1200×630**.
- تأكيد hostname الإنتاجي `basair-alkhalij.github.io` في Edge Function الخاصة بـ Turnstile ضمن الفحص الثابت.
- إزالة السطر القديم الذي يضيف `v=87` إلى روابط المشاركة.
- إبقاء `v` ضمن مفاتيح التنظيف حتى تنظف الروابط القديمة تلقائيًا.
- إضافة Browser test جديد يتحقق من أن روابط مشاركة المنتج والقسم لا تحتوي `v` ولا `admin` وتحمل `product`/`category` الصحيحين.
- لا توجد تغييرات قاعدة بيانات في v111A، لذلك لا توجد migration جديدة.

## نتائج الفحص داخل بيئة التجميع

- `node --check config.js`: **PASS**.
- `node --check analytics.js`: **PASS**.
- `node --check app.js`: **PASS**.
- `npm run build:check`: **PASS — BUILD_CHECK_OK v111**.
- `npm run test:static`: **PASS**:
  - `FLOWER_LIGHT_FINAL_SMOKE_OK`
  - `LEADS_MODULE_RUNTIME_OK`
  - `PERMISSIONS_MODULE_RUNTIME_OK`
  - `SETTINGS_MODULE_RUNTIME_OK`
  - `PRODUCT_MODULES_RUNTIME_OK`
  - `THUMBNAILS_OK`
  - `DUPLICATE_PRODUCT_SUCCESS_AND_ROLLBACK_OK`
- `npm ci --no-audit --no-fund`: لم يكتمل بسبب مهلة شبكة في بيئة التجميع، لذلك لم تتوفر حزم esbuild/Playwright محليًا لإعادة `npm run build` و`npm run test:browser` هنا.
- محاولة تحقق Browser بديلة باستخدام Chromium النظامي تعذر تنفيذها لأن سياسة البيئة تمنع Chromium من فتح `127.0.0.1` (`ERR_BLOCKED_BY_ADMINISTRATOR`).

## ما يزال مطلوبًا لإغلاق معيار قبول المهمة 1

1. GA4 Measurement ID تم ضبطه في `config.js`: `G-WQRZWGY367`.
2. بعد النشر: التحقق من ظهور زيارة في GA4 Realtime.
4. اختبار معاينة رابط الموقع في واتساب/تيليجرام.

`share-image.jpg` نفسها مؤكدة بأبعاد 1200×630، وسيمنع `test:static` أي تغيير مستقبلي للأبعاد.

## إعدادات خارج الملفات

- Turnstile Site Key موجود في `config.js`، وEdge Function تقبل hostname الإنتاجي الحالي.
- Sign-ups = OFF وMFA/TOTP للمالك كانا قد تم تأكيدهما يدويًا ضمن إعداد v110. يجب إبقاؤهما كما هما.

## بوابة النشر

قبل دمج v111A يجب تشغيل على جهاز التطوير أو GitHub Actions:

```powershell
npm.cmd ci --no-audit --no-fund
npm.cmd run build:check
npm.cmd run test:static
npm.cmd run build
npx.cmd playwright install chromium
$env:FL_TEST_DIST="1"
npm.cmd run test:browser
```

ولا يعتمد الإصدار إذا فشل build أو Playwright.
