# دليل ترقية قاعدة بيانات Flower Light

استخدم **Supabase → SQL Editor** بحذر. لا تشغل ملف `SUPABASE_SETUP.sql` على قاعدة بيانات موجودة؛ فهو مخصص للمشروع الجديد الفارغ.

| حالة قاعدة البيانات | الإجراء |
|---|---|
| مشروع جديد فارغ | شغّل `../SUPABASE_SETUP.sql` |
| قاعدة أقدم من v110 | راجع ترقية `UPGRADE_EXISTING_V105.sql` ثم `UPGRADE_EXISTING_V110.sql` والملفات السابقة بحسب حالتها |
| قاعدة v110 أو أحدث ولم تكتمل ترقيات v118 | تأكد أولًا من نشر `submit-customer-lead` واختبارها، ثم شغّل `UPGRADE_TO_V118.sql` |
| قاعدة حية على v118 بالفعل | **لا تشغّل أي ترقية**، استخدم استعلام فحص الصلاحيات للقراءة فقط |

يفحص الملف الموحد `UPGRADE_TO_V118.sql` ست نتائج منطقية. كلها يجب أن تكون `true`، ثم تظهر `UPGRADE_TO_V118_OK`.

ملفات `UPGRADE_EXISTING_V111.sql` و`UPGRADE_EXISTING_V116.sql` و`UPGRADE_EXISTING_V117.sql` و`UPGRADE_CUSTOMER_LEADS_EDGE_ONLY_V118.sql` باقية مستقلة للمراجعة.
