# تدقيق دوال Supabase ذات الصلاحيات المرتفعة — 29 أكتوبر 2026

## النطاق وطريقة التحقق
- جردنا **31 دالة SECURITY DEFINER** في مخطط public باستخدام `pg_proc` و`has_function_privilege`، وراجعنا `pg_policies` و`cron.job` ووظائف Edge والشفرة المنشورة على GitHub.
- نُفّذ تدقيق قراءة فقط قبل أي تغيير. أي اختبار كتابة للمنتجات أو العملاء أو منح الصلاحيات يحتاج حساب اختبار معزول، وليس بيانات الإنتاج.
- تحذيرات Supabase Security Advisor ليست ثغرات مؤكدة بمجرد ظهورها؛ الدوال التي تستخدم SECURITY DEFINER يجب أن توثّق سبب صلاحية التنفيذ وتحمي المدخلات/الهوية داخل الوظيفة.

## ما تأكدنا منه
| المجال | النتيجة | الإجراء |
|---|---|---|
| `purge_expired_customer_leads()` | كانت متاحة لدور `authenticated` رغم أن المستدعي الفعلي هو Edge service_role ومهمة pg_cron تحت postgres | حصر EXECUTE في service_role ومالك قاعدة البيانات، بدون تشغيل الحذف |
| `consume_customer_lead_rate_limit()` | الخدمة فقط؛ anon/authenticated بلا EXECUTE | الحفاظ على الوضع |
| `maintain_analytics_retention()` | الخدمة فقط؛ cron يعمل تحت postgres | الحفاظ على الوضع |
| `get_current_admin_access()` | authenticated فقط، ويرفض جلسات المدير غير المكتملة MFA قبل إعادة أي تفاصيل | الحفاظ على الوضع |
| دوال تعديل الإدارة | تتطلب `is_site_owner()` أو `has_admin_permission()` المرتبطتين بتدقيق MFA؛ ممنوعة على anon | لا سحب عشوائي للامتيازات |
| `get_public_bank_accounts()` | تعرض الحسابات المصرفية الموسومة `is_visible=true` فقط، ويستخدمها الجمهور | الإبقاء على وصول anon/authenticated المقصود |
| `get_public_business_privacy()` | تعرض حقول الشركة المسموح بعرضها فقط | الإبقاء على الوصول المقصود |
| `log_site_event()` | وظيفة قياس عامة ترفض أسماء أحداث غير معرّفة ولديها سقوف عامة للاستخدام وفحص لحجم البيانات | الإبقاء على الوصول العام المقصود، مع مراقبة إساءة الاستخدام |
| `customer_lead_rate_limits` و`quote_requests` | RLS مفعلة بلا سياسات، وعليه لا تسمح هذه الجداول بالقراءة المباشرة للأدوار العامة | لا إضافة سياسة عامة لإزالة التحذير |

## التغيير المحدود
ملف `supabase/RESTRICT_LEAD_RETENTION_RPC_20261029.sql` يسحب صلاحية EXECUTE على `purge_expired_customer_leads()` من `PUBLIC` و`anon` و`authenticated` ويبقي/يمنح `service_role` صلاحية الاستدعاء. لا يتضمن DELETE أو DROP أو تحديثًا لبيانات العملاء. لا تتأثر دالة Edge أو مهمة الاحتفاظ المجدولة لأنها تستخدم service_role وpostgres.

**التحقق المطلوب بعد التطبيق**: `anon=false` و`authenticated=false` و`service_role=true`، ثم التأكد من استمرار آخر نشر ومهمة الاحتفاظ. ملف التراجع: `supabase/ROLLBACK_LEAD_RETENTION_RPC_20261029.sql`.

## أعمال لاحقة قبل إغلاق التدقيق الأمني
1. اختبار API حقيقي من حساب إدارة تجريبي: JWT AAL1 مقابل AAL2، مع طلبات قراءة آمنة ثم اختبارات كتابة ببيانات اختبارية فقط.
2. فحص كامل لصلاحيات تنفيذ الدوال بعد أي ترحيل أو تعديل للسياسات، وتحليل سجلات الرفض والأخطاء.
3. دراسة نقل الدوال العامة الآمنة تدريجيًا إلى SECURITY INVOKER مع واجهات عرض محدّدة، **فقط** إذا أمكن الحفاظ على RLS وعدم كشف أعمدة خاصة. عدم تنفيذ ذلك لمجرد إزالة تحذير linter.
4. مراجعة استعادة قاعدة البيانات والنسخ الاحتياطية وملفات Storage بصورة منفصلة.

مراجع توثيق Supabase:
- https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable
- https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
