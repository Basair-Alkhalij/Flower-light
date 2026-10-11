# تقرير فحص Flower Light v110 — 7 أكتوبر 2026

## النتيجة الحالية

- `node scripts/build.mjs --check`: **PASS — BUILD_CHECK_OK v110**.
- `npm run test:static`: **PASS** لجميع اختبارات smoke والوحدات.
- فحص صياغة الوحدات الجديدة (`analytics.js`, `catalog-pdf-viewer.js`, `admin-datasheet.js`) ضمن build check: **PASS**.
- أحجام الملفات المركزية بعد التقسيم:
  - `app.js`: 110,197 بايت raw / 25,943 gzip تقريبًا.
  - `admin.js`: 135,707 بايت raw / 31,980 gzip تقريبًا.
  - CSS المصدر مقسم إلى خمس وحدات؛ الإجمالي 122,853 بايت raw / 23,449 gzip تقريبًا.
- `npm ci` داخل بيئة التجهيز: **تعذر بسبب مهلة/شبكة البيئة**، لذلك لم يتوفر `esbuild` ولا `@playwright/test` محليًا هنا لإعادة full build بالطريقة المعتادة.
- محاولة تشغيل Chromium داخل بيئة التجهيز نفسها مُنعت من localhost بسياسة البيئة (`ERR_BLOCKED_BY_ADMINISTRATOR`).
- **Playwright على جهاز Windows الفعلي للمستخدم: PASS — 16/16 passed** بعد دمج تصحيحات mocks الخاصة بخانات بيانات الشركة. هذا هو اختبار المتصفح المرجعي لـ v110 قبل النشر.

## بوابة النشر

Workflow `pages.yml` مضبوط بحيث لا يتم نشر GitHub Pages إلا بعد نجاح التسلسل التالي على GitHub Actions:

1. `npm ci --no-audit --no-fund`
2. `npm run test:static`
3. `npm run build`
4. `npx playwright install --with-deps chromium`
5. `npm run test:browser` مع `FL_TEST_DIST=1`
6. رفع `dist` ثم deploy

بالتالي يجب اعتبار نجاح Job **Build, test and deploy Pages** شرطًا إلزاميًا قبل اعتماد v110 في الإنتاج.

## ما تغير أمنيًا/تقنيًا

- نسخة الإنتاج لا تحمل Supabase من CDN وقت الزيارة؛ build يجهز الإصدار المثبت `@supabase/supabase-js@2.57.4` كملف same-origin باسم `supabase-vendor.js` ويعيد كتابة `index.html` الإنتاجي إليه.
- رابط CDN يبقى فقط في ملف المصدر لتشغيل معاينة المصدر مباشرة؛ لا يبقى في HTML الإنتاجي بعد build.
- مسار SQL بعد v105 موحد في `supabase/UPGRADE_EXISTING_V110.sql`، بينما ملفات v106/v108 المتكررة أصبحت أرشيفية.
- من جلسة إعداد المشروع السابقة تم التحقق يدويًا من أن **Sign-ups = OFF** وأن **MFA/TOTP للمالك مفعّل**. هذه إعدادات خارج المستودع ويجب إعادة التحقق منها إذا تغير مشروع/حساب Supabase.

## نتيجة الاختبار قبل الرفع

تم تشغيل سلسلة الاختبارات على جهاز Windows الفعلي، وانتهى `npm.cmd run test:browser` إلى **16 passed / 0 failed**. عند الرفع يبقى GitHub Actions بوابة تحقق ثانية مستقلة قبل النشر.

لإعادة الفحص يدويًا عند الحاجة:

```powershell
npm.cmd ci
npm.cmd run build:check
npm.cmd run test:static
npm.cmd run build
npx.cmd playwright install chromium
$env:FL_TEST_DIST="1"
npm.cmd run test:browser
```

لا تعتمد v110 إذا فشل Playwright أو build على جهازك/GitHub Actions.
