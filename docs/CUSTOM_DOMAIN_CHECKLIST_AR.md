# خطوات تفعيل نطاق خاص لبصائر الخليج

الموقع الحالي يعمل على https://basair-alkhalij.github.io/Flower-light/ ولا حاجة إلى تفعيل نطاق جديد الآن.

1. اختر اسم النطاق وتأكد من ملكيته.
2. اضبط سجلات DNS المناسبة وفق تعليمات GitHub Pages للنطاق الرئيسي أو الفرعي.
3. في GitHub → Settings → Pages أدخل Custom domain وفعّل HTTPS عندما يصبح جاهزًا.
4. يأخذ بناء GitHub Actions قيمة عنوان Pages في متغير SITE_URL ويحدّث الروابط وصفحات المنتجات والفئات وملفات sitemap وrobots.
5. أضف إلى أسرار Supabase إعداد ALLOWED_ORIGINS اختياريًا بقيم HTTPS خالصة مفصولة بفواصل، مثل https://example.com,https://www.example.com.
6. بعد دمج التعديلات أعد نشر وظيفتي submit-customer-lead وmanage-admin-account من مجلد supabase/functions حتى تدعما أسماء النطاقات الجديدة.
7. حدّث قائمة المضيفين المسموحين في Cloudflare Turnstile، ثم اختبر نموذج العميل ودخول المدير وروابط واتساب.
8. اختبر روابط /p/ و/c/ وPWA وGoogle Analytics وSearch Console بعد التحويل.

لا حاجة لإضافة ملف CNAME في المستودع لمجرد تفعيل هذه العملية عبر GitHub Actions؛ يعتمد النطاق على إعدادات Pages.
