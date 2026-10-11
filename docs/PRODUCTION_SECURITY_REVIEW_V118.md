# مراجعة أمان الإنتاج — Flower Light v118

## تحديث التحقق الفعلي من Supabase — 2026-10-11

**تم الاتصال المباشر بمشروع Supabase الإنتاجي ومراجعة الصلاحيات للقراءة فقط، دون أي DDL أو تعديل للبيانات.** هذا التحقق يستكمل — ولا يمحو — القيود التاريخية الواردة في الأقسام أدناه.

- المشروع `Basair-Alkhalij-Flower-Light`: الحالة `ACTIVE_HEALTHY`.
- `customer_leads`: RLS مفعل، ونتيجة منح `INSERT` الفعلية هي `anon=false` و`authenticated=false` و`service_role=true`. سياسة العملاء الموجودة مقتصرة على حسابات الإدارة المخولة؛ لا توجد سياسة إدخال عامة. **لا تُشغّل ترقية `UPGRADE_CUSTOMER_LEADS_EDGE_ONLY_V118.sql` ما دامت هذه النتيجة صحيحة؛ فهي معالجة احتياطية فقط.**
- RPC `consume_customer_lead_rate_limit`: لا يمكن تنفيذه بواسطة `anon` أو `authenticated`، وتستطيع وظيفة `service_role` تنفيذه.
- الوظائف المنشورة `submit-customer-lead` (ACTIVE; `verify_jwt=false` لخدمة نموذج الزوار) و`manage-admin-account` (ACTIVE; `verify_jwt=true`). ملف وظيفة العملاء المنشور **مطابق نصيًا** للموجود في GitHub ويحتوي على التحقق من Turnstile و`action` و`hostname` وضوابط المعدل.
- البيانات الخاصة، ومنها `admin_users` و`admin_recovery_settings` و`business_bank_accounts` و`business_privacy_settings` و`customer_leads`: RLS مفعل ولا تظهر منح قراءة أو كتابة مباشرة للزائر `anon`. القراءة العامة المقصودة للمنتجات والفئات ومعلومات التواصل متاحة بسياسات محددة. وتعمل سياسة تخزين المنتجات حسب صلاحيات الدور.
- توجد أعمدة اللغة الإنجليزية الثمانية المطلوبة في `v116` و`v117`. يوجد حساب واحد بدور `owner` وآخر بدور `subadmin` دون قراءة بيانات هوياتهما.
- الاحتفاظ ببيانات العملاء مضبوط على **180 يومًا**، وامتداد `pg_cron` ودالة حذف السجلات المنتهية موجودان. مشغل الحد القديم لجدول العملاء غير موجود.
- مفتاح `Supabase` في كود الموقع هو مفتاح نشر عام وليس مفتاح `service_role`. لم تُقرأ قيم أسرار الخادم.

**تحذيرات Supabase Advisor التي تستحق المتابعة:**
1. [حماية كلمات المرور المسربة معطلة](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). يجب مراجعة إمكانية تفعيلها في Auth من لوحة المشروع؛ لا يوجد في هذا الفحص تعديل لإعدادات المصادقة.
2. [`set_updated_at` بدون `search_path` ثابت](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable): ملاحظة تقوية للدالة، وليس دليلًا على تسريب.
3. [ثلاث دوال عامة ذات `SECURITY DEFINER`](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable): `get_public_bank_accounts` و`get_public_business_privacy` تُخرج الحقول المرئية المقصودة فقط؛ `log_site_event` مخصصة لتسجيل أحداث زوار محدودة. لا تسحب صلاحياتها عشوائيًا قبل اختبار وظيفتها.
4. [17 دالة `SECURITY DEFINER` متاحة لحسابات مسجلة](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable): هذا تحذير لمراجعة صلاحيات وتحقق كل دالة داخليًا، لا إثبات ثغرة. مثال مؤكد: `owner_set_admin2_settings` يتحقق من `is_site_owner()`.
5. `customer_lead_rate_limits` و`quote_requests` لديهما RLS دون سياسات؛ هذا مقصود للجداول المقفلة، وليس طلبًا لفتحها.

**ما لم يُثبت بعد:** تفعيل MFA لكل مستخدم، نجاح تجربة Turnstile مع زائر حقيقي، جدول تشغيل مهمة الاحتفاظ، نجاح نشر Pages النهائي على الرابط، فحص HTTP headers الخارجية، والتحقق من الأداء الفعلي على الإنتاج. لا تُعد النتائج اختبار اختراق شاملًا.

---


**نطاق الفحص:** كود GitHub، صلاحيات SQL الموثقة، Edge Functions، CSP، Google Analytics، واختبارات GitHub Actions.  
**حدود الفحص:** لم تُقرأ قاعدة Supabase الحية، ولم تُفحص إعدادات Auth/MFA أو Secrets أو النشر الفعلي لوظائف Edge. لا يعني نجاح اختبارات المحاكاة نجاح إعدادات الإنتاج.

## نتيجة مراجعة الكود

| الموضوع | ما تحقق في المستودع | ما يتطلب تحققًا حيًا |
|---|---|---|
| مفاتيح Supabase | `config.js` يحمل مفتاح publishable مخصصًا للمتصفح، ولا يحوي مفتاح `service_role` | التأكد من Secrets وعدم تسرب أي مفتاح خاص في المستودع أو إعدادات المتصفح |
| سياسة RLS | ملفات SQL تفعّل RLS وتحتوي على سياسات للأدوار Owner / Sub-admin | مطابقة السياسات والصلاحيات المفعّلة فعلًا في PostgreSQL |
| حفظ العملاء | وظيفة `submit-customer-lead` تتحقق من Turnstile hostname/action والحد من الطلبات عبر hash | نشر الوظيفة، وجود الأسرار، صلاحيات `service_role`، والتأكد من فشل الإدخال المباشر |
| حماية تسجيل الدخول | توجد مصادقة Supabase وتحقق من أدوار المدير، واستعمال خادمي لعمليات الحسابات الحساسة | تفعيل MFA للمالك، منع التسجيل العام إذا كان غير مطلوب، قواعد البريد والاستعادة |
| المتصفح | CSP وReferrer Policy في HTML وتهيئة `noindex` للوحة المدير | إعدادات ترويسات HTTP وCSP الفعلية؛ لا يعمل `frame-ancestors` داخل `meta` CSP |
| مراقبة الأخطاء | حدث `js_error` يرسل تصنيفًا منقحًا وبحد خمسة بلاغات لكل جلسة | وصول الأحداث إلى GA4 وموافقة سياسة الخصوصية |
| GitHub Actions | CI يبني المشروع ويفحص الوحدات والمتصفح قبل Pages | نجاح بناء ونشر النسخة المدمجة، وصحة الموقع الحي |
| البيانات القديمة | الاستعلامات الجديدة لا تقرأ أسماء العملاء أو أرقامهم | مراجعة جدول `quote_requests` القديم وحذفه فقط بعد تقييم العدد والحاجة إليه |

## ما أصلحناه في v118

1. إزالة المسار القديم الذي كان يسمح للمتصفح بإرسال `customer_leads` مباشرة عند غياب Turnstile؛ النتيجة الآن فشل آمن ورسالة واضحة. ولا يزال إرسال العملاء يعمل عبر `submit-customer-lead` بعد تحقق الرمز على الخادم.
2. تحديد نقص في صلاحيات SQL: كان `authenticated` قادرًا على `INSERT` بسبب `GRANT` وسياسة عامة، حتى بعد سحب حق `anon` في ترقية v104. أُنشئ `supabase/UPGRADE_CUSTOMER_LEADS_EDGE_ONLY_V118.sql` لسحب إدخال العملاء المباشر من **كلا الدورين**، مع منح وظيفة `service_role` حق الكتابة. لا يغير أي صف من البيانات.
3. تحديث الحماية في ملف التهيئة الكامل وترقية Turnstile التاريخية للحالات الجديدة. تحديث هذه الملفات في GitHub **لا يغيّر قاعدة الإنتاج تلقائيًا**.
4. إضافة اختبار للرفض عند غياب Turnstile واستعلام SQL مستقل **للقراءة فقط**.

## الخطوات المطلوبة لتأكيد الإنتاج — بالترتيب

1. افتح Supabase Dashboard للمشروع المستخدم في `config.js` وتحقق من ظهور Edge Function `submit-customer-lead` في قائمة الوظائف، وأن `TURNSTILE_SECRET_KEY` موجود في Secrets دون نسخ قيمته، وأن إعدادات CORS تتطابق مع رابط GitHub Pages. تأكد أن طلب عميل تجريبي بعد إتمام Turnstile ينجح. لا ترسل بيانات عميل حقيقية في الاختبار.
2. افتح **SQL Editor → New query**، وانسخ محتوى `supabase/SECURITY_AUDIT_READONLY_V117.sql` ثم شغّله. جميع التعليمات `SELECT` ولا تغير البيانات. راجع الجداول والسياسات ولا تشارك أي معلومات شخصية إن ظهرت.
3. نتائج القبول: `customer_leads` موجود وRLS فعّال؛ `anon_can_insert_customer_leads=false` و`authenticated_can_insert_customer_leads=false`؛ `anon_can_execute_rate_limit_rpc=false`؛ `service_role_can_insert_customer_leads=true`؛ لا تظهر صلاحيات تغيير/حذف للجمهور على الجداول الخاصة؛ جميع أعمدة v116 وv117 الثمانية موجودة.
4. إذا كانت نتيجة `authenticated_can_insert_customer_leads` أو `anon_can_insert_customer_leads` = true، **تأكد أولًا من نشر وظيفة Turnstile ونجاح نموذج العميل المحمي**، ثم نفّذ الملف المنفصل `supabase/UPGRADE_CUSTOMER_LEADS_EDGE_ONLY_V118.sql` من SQL Editor. نتيجته المتوقعة `false / false / true` و`CUSTOMER_LEADS_EDGE_ONLY_V118_OK`. هذا ترحيل **صلاحيات فقط** ويحتاج إجراء المالك. لا تنفذ `SUPABASE_SETUP.sql` مجددًا.
5. في Supabase Auth تحقق من مالك الحساب وMFA، ومسار استعادة الحساب، وإغلاق التسجيل العام إن كان هذا هو إعداد الموقع المقصود. لا تشارك كلمات مرور أو رموز وصول.
6. في GitHub Actions تأكد من نشر النسخة بعد الدمج ثم اختبر: نموذج العميل مع Turnstile، دخول Owner/Sub-admin، تغيير المحتوى حسب الصلاحيات، تحميل PDF/JPG، رابط /p/... الحقيقي، وGA4 Realtime.
7. انتبه إلى أن منع عرض لوحة الإدارة بوساطة `?admin` و`noindex` ليس حاجز وصول؛ الحماية الأمنية تعتمد على مصادقة Supabase وRLS. كذلك المفتاح publishable وTurnstile site key ليسا أسرارًا.

## ملاحظات ومخاطر متبقية

- **أولوية مرتفعة:** تأكيد منع `INSERT` من `anon` و`authenticated` على جدول العملاء فعليًا. هذه النقطة لا تؤكدها ملفات GitHub وحدها.
- **أولوية مرتفعة:** إثبات نشر وظائف Edge وإعداد MFA في الإنتاج.
- **أولوية متوسطة:** ترويسات الاستجابة مثل `frame-ancestors` و`X-Content-Type-Options` تحتاج استضافة تسمح بتخصيص HTTP headers؛ سياسة `meta` الحالية لا تضبط `frame-ancestors`. راجع خيارات الاستضافة مستقبلًا عند ربط النطاق.
- **أولوية متوسطة:** مراقبة نسخة إعدادات `SUPABASE_SETUP.sql` القديمة وعدم تشغيلها على قاعدة قائمة، لأنها تحتوي ترحيلات تاريخية متعددة.

**لا تُعدّ هذه الوثيقة شهادة اختبار اختراق أو تدقيقًا قانونيًا.** نفّذت التعديلات البرمجية واختبارات الوحدة والمتصفح، ولم ألمس قاعدة Supabase الحية.
