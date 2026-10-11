# بصائر الخليج — Flower Light v118a

موقع GitHub Pages ثابت للبطاقة الرقمية وكتالوج منتجات Flower Light، مع Supabase للمصادقة والبيانات والتخزين.

**الإصدار التقني الحالي:** 1.1.8. حزمة v118a للصيانة والتنظيم ولا تغيّر قاعدة الإنتاج.

| المهمة | المرجع |
|---|---|
| البدء والتشغيل | `START_HERE_AR.txt` |
| ترقية قاعدة بيانات قديمة | `supabase/README.md` |
| قائمة النطاق الخاص | `docs/CUSTOM_DOMAIN_CHECKLIST_AR.md` |
| سجل التغييرات | `CHANGELOG.md` |
| تفاصيل الإصدارات القديمة | `docs/RELEASE_NOTES_AR.md` |
| تقرير الأمان | `docs/PRODUCTION_SECURITY_REVIEW_V118.md` |

## تشغيل محلي

```bash
npm ci
npm run build:check
npm run test:static
npm run build
npm run test:browser
```

الملفات الناتجة تنشرها GitHub Actions إلى Pages. يتم بناء `dist` تلقائيًا، وليس مطلوبًا رفعه يدويًا.

## ملاحظات

- قاعدة إنتاج المشروع الحالية تحقق ترقيات v118، ولا تحتاج تشغيل SQL الموحد مجددًا.
- دعم نطاق خاص عبر `ALLOWED_ORIGINS` اختياري؛ يجب نشر وظيفتي Edge بعد الدمج وقبل الانتقال للنطاق الجديد.
- MFA الخاص بلوحة Supabase لا يثبت أن حسابي المدير والأدمن في الموقع لديهما MFA.
- أسرار الخادم لا توضع في ملفات الموقع العام.

## إعداد نشر GitHub Pages

في **Settings → Pages** اختر **Source = GitHub Actions**. لا تستخدم **Deploy from a branch** لهذا المشروع، لأن البناء عبر Actions يولّد الملفات المُحسنة والصفحات الثابتة الخاصة بالمنتجات.

بعد نجاح فحوص البناء والمتصفح، راجع مهمة `deploy` في ملف `.github/workflows/pages.yml` قبل اختبار الروابط المنشورة.
