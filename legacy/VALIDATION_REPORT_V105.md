# تقرير الفحص النهائي — Flower Light v105

تاريخ التحقق: 7 أكتوبر 2026

## النتيجة النهائية

تم اختبار النسخة على Windows باستخدام Node.js 24 بعد تثبيت الاعتمادات، وكانت النتائج الفعلية:

- `npm audit`: **PASS — 0 vulnerabilities** بعد تحديث `@playwright/test` إلى `1.55.1`.
- `npm run build:check`: **PASS — `BUILD_CHECK_OK v105`**.
- `npm run test:static`: **PASS** لكل الاختبارات الثابتة ووحدات العملاء والصلاحيات والإعدادات والمنتجات والصور والنسخ.
- `npm run build`: **PASS — `BUILD_OK v105`** وتم إنشاء `dist` المصغر بنجاح.
- Playwright على نسخة `dist` باستخدام `FL_TEST_DIST=1`: **PASS — 14/14 tests passed**.
- فحص ZIP النهائي: **PASS**.

## إصلاحات التوافق التي أضيفت أثناء الفحص النهائي

1. تحديث Playwright من `1.55.0` إلى `1.55.1` لإزالة التنبيه الأمني الذي ظهر في `npm audit`.
2. إضافة موافقة محددة على install script الخاص بـ`esbuild@0.25.10` عبر `allowScripts` بدل السماح العام.
3. جعل فحص Edge Functions TypeScript متوافقًا مع Node.js 24 باستخدام `stripTypeScriptTypes` ثم `node --check`.
4. إصلاح مسارات اختبارات Windows حتى لا تتكرر بادئة القرص مثل `C:\\C:\\...`.
5. تعديل اختبارات Playwright بحيث تتجاوز CSP داخل سياق الاختبار فقط، بدون إضعاف CSP الفعلي للموقع.
6. تعديل fixture الخاص بالكتالوج لاستخدام رابط HTTPS بدل `data:` لأن سياسة الروابط في v105 ترفض `data:` عمدًا.

## إعدادات الإنتاج التي أُنجزت خارج الملفات خلال الإعداد

- Site Key لـCloudflare Turnstile موجود في `config.js`.
- Secret Key و`LEAD_RATE_LIMIT_PEPPER` يجب أن يبقيا في Supabase Secrets فقط، ولا يحتوي ZIP على أي Secret.
- تم نشر Edge Function `submit-customer-lead` على مشروع Supabase أثناء الإعداد.
- تم تطبيق ترقية قاعدة البيانات v105 بنجاح حتى `CUSTOMER_LEAD_RETENTION_V105_OK`.
- تم تعطيل Sign-ups العامة.
- تم تفعيل MFA لحساب Supabase.

## ما بقي قبل جعل الموقع الحي على v105

- رفع هذه النسخة إلى GitHub عندما يقرر المالك ذلك.
- ضبط GitHub Pages على **GitHub Actions** فقط.
- انتظار نجاح workflow على GitHub.
- اختبار Turnstile ونموذج العميل على الرابط الحي بعد النشر.
- عدم رفع `node_modules/` أو `dist/` أو `test-results/` أو `BUILD_SIZES.json`.

## ملاحظات غير مانعة للنشر

- Supabase UMD ما زالت محملة من CDN بإصدار مثبت وبدون SRI؛ bundling محلي تحسين لاحق مستقل.
- الملفات الكبيرة `admin.js` و`app.js` و`style.css` ما زالت تستحق refactor لاحقًا، لكن الاختبارات الحالية ناجحة ولا تمنع النشر.
- سياسة الخصوصية التقنية تحتاج مراجعة قانونية نهائية بما يلائم نشاط المنشأة ونظام حماية البيانات الشخصية السعودي.
