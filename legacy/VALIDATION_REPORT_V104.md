# تقرير فحص v104 — 6 أكتوبر 2026

## النتيجة

- `npm run build:check`: PASS (`BUILD_CHECK_OK v104`).
- `npm run test:static`: PASS لجميع اختبارات smoke والوحدات.
- فحص JavaScript وEdge Functions: PASS ضمن build check.
- لم يُنفذ build المصغر ولا Playwright داخل بيئة التجهيز لأن `npm ci` لم يكتمل بسبب انقطاع/مهلة شبكة بيئة التنفيذ. GitHub Actions يقوم بـ `npm ci` ثم build ثم Playwright، وأصبح build يفشل صراحة إذا غاب esbuild بدلاً من إنتاج dist غير مصغر.

## الإصلاحات الرئيسية

1. GitHub Pages موحد على GitHub Actions؛ README يمنع Branch/root deployment.
2. رقم الإصدار يولد من `package.json` ويستبدل `__FL_VERSION__` أثناء build في HTML/JS/CSS/manifest/SW.
3. Turnstile + Edge Function + تحقق Siteverify + hostname/action + حد 8/5 دقائق لكل معرف شبكة SHA-256 مملح.
4. migration v104 تلغي حد 20/5 دقائق العام وتلغي `anon insert` المباشر بعد تفعيل الحماية.
5. CSP على index/privacy/404، وSRI لمسارات SheetJS/PDF.js/jsPDF/JSZip.
6. SheetJS محدثة إلى 0.20.3 من CDN الرسمي.
7. safe URL للكتالوج يقبل http/https فقط ولا يضع URL خام داخل innerHTML.
8. Service Worker يستخدم network-first لطلبات HTML/navigation.
9. سياسة الخصوصية أصبحت صفحة تشغيلية مع بيان Turnstile والاحتفاظ والحقوق.
10. ملفات الترقية القديمة نقلت إلى `legacy/`، والمهاجرات الجديدة في `supabase/migrations/`.

## خطوات يدوية لازمة قبل تفعيل v104 بالكامل

- GitHub: Pages Source = GitHub Actions.
- Cloudflare: إنشاء Turnstile وأخذ Site key + Secret key.
- `config.js`: وضع Site key في `turnstileSiteKey`.
- Supabase Secrets: `TURNSTILE_SECRET_KEY` و`LEAD_RATE_LIMIT_PEPPER`.
- نشر `submit-customer-lead` ثم تطبيق migration v104 بالترتيب الموضح في README.
- Supabase Auth: تعطيل Sign-ups العامة وتفعيل MFA/TOTP للمالك.
- مراجعة سياسة الخصوصية نظاميًا وفق نشاط المنشأة.

## نقاط مؤجلة عمدًا

- Supabase UMD ما زالت CDN مثبتة بإصدار محدد ومقيدة بـ CSP، لكنها بلا SRI؛ الأفضل لاحقًا bundling محلي ضمن build.
- `loadCloudProducts()` ما زالت تجلب المنتجات في استعلام واحد؛ إضافة pagination تصبح مهمة عند الاقتراب من حدود الصفوف الكبيرة.
- تحويل الملفات الكبيرة إلى ES Modules/TypeScript وإضافة lint/formatter مشروع refactor مستقل لتقليل مخاطرة كسر النسخة الحالية.
