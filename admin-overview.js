// Flower Light admin dashboard overview: presentation only; access checked in admin.js.
(()=>{
'use strict';
  function ownerShortcutButton(key,label,description){
    return `<button class="fl-overview-shortcut" type="button" data-overview-view="${key}"><strong>${label}</strong><small>${description}</small><span aria-hidden="true">←</span></button>`;
  }

  function render({allowed,products,profile,categories,contacts,adminViewItems,isPrimaryAdmin,currentAdminEmail,esc}){
    const visible=products.filter(p=>p.is_visible!==false).length;
    const profileReady=Boolean(profile.full_name||profile.brand_name||profile.company_name||profile.logo_path||profile.portrait_path);
    const statCards=[];
    if(allowed.has('sections'))statCards.push([categories.length,'الأقسام']);
    if(allowed.has('products'))statCards.push([products.length,'إجمالي المنتجات'],[visible,'المنتجات الظاهرة']);
    if(allowed.has('datasheet'))statCards.push(['✓','صمّم داتا شيت']);
    if(allowed.has('profile'))statCards.push([profileReady?'✓':'—','بيانات البطاقة']);
    if(allowed.has('contacts'))statCards.push([contacts.length,'وسائل التواصل']);
    if(allowed.has('leads'))statCards.push([window.FL_ADMIN_LEADS?.totalForStats()||0,'جهات اتصال العملاء']);
    const statsHtml=statCards.length?`<div class="fl-cloud-stats">${statCards.map(([value,label])=>`<div class="fl-cloud-stat"><strong>${value}</strong><span>${label}</span></div>`).join('')}</div>`:'';
    const contentShortcuts=adminViewItems.filter(([key])=>allowed.has(key)).map(([key,label])=>ownerShortcutButton(key,label,'فتح القسم وإدارته')).join('');
    const ownerShortcuts=isPrimaryAdmin?`${ownerShortcutButton('search-filters','فلاتر البحث','اختر الفلاتر وأضف فلاتر خاصة بك')}${ownerShortcutButton('site-settings','إعدادات الموقع','دخول العملاء وتثبيت التطبيق')}${ownerShortcutButton('business-settings','بيانات الشركة','خانات مرنة لبيانات المنشأة وإعدادات الخصوصية')}${ownerShortcutButton('bank-settings','الحسابات البنكية','إدارة حسابات التحويل ونسخ IBAN')}${ownerShortcutButton('template-settings','قالب المنتجات','الباركود ورقم التذييل')}${ownerShortcutButton('credentials','بيانات تسجيل الدخول','حسابات المدير والأدمن والاستعادة')}${ownerShortcutButton('permissions','صلاحيات الأدمن','تحديد ما يستطيع الأدمن الوصول إليه')}`:'';
    return `<div class="fl-cloud-head"><div><h2>${isPrimaryAdmin?'الرئيسية':'لوحة الأدمن'}</h2><p>${isPrimaryAdmin?'ملخص سريع للموقع. كل نوع من الإعدادات أصبح في صفحته الخاصة لتبقى اللوحة مرتبة وواضحة.':'الأقسام المتاحة لحسابك حسب الصلاحيات المحددة.'}</p></div></div>
      ${statsHtml}
      ${contentShortcuts?`<section class="fl-overview-section"><div class="fl-overview-section-head"><h3>إدارة المحتوى</h3><p>الأقسام التشغيلية للموقع.</p></div><div class="fl-overview-shortcuts">${contentShortcuts}</div></section>`:''}
      ${ownerShortcuts?`<section class="fl-overview-section"><div class="fl-overview-section-head"><h3>الإعدادات والحسابات</h3><p>إعدادات المالك فقط، ولا تظهر للأدمن الفرعي.</p></div><div class="fl-overview-shortcuts">${ownerShortcuts}</div></section>`:''}
      <div class="fl-cloud-note ok">الحساب الحالي: <b dir="ltr">${esc(currentAdminEmail)}</b> · ${isPrimaryAdmin?'المدير':'الأدمن'}</div>`;  }

window.FL_ADMIN_OVERVIEW=Object.freeze({render});
})();
