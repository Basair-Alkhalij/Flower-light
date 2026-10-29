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
    // Keep every shortcut behind the same permission set as the main navigation.
    // The overview is an index of tasks, not a second authorization layer.
    const content=(adminViewItems||[]).filter(([key])=>allowed.has(key));
    const byKeys=keys=>keys.map(key=>content.find(item=>item[0]===key)).filter(Boolean);
    const shortcutRows=(rows,description)=>rows.map(([key,label])=>ownerShortcutButton(key,label,description)).join('');
    const catalogShortcuts=shortcutRows(byKeys(['sections','products','datasheet']),'إدارة القسم');
    const followupShortcuts=shortcutRows(byKeys(['leads','contacts','profile','analytics']),'فتح القسم');
    const settingsList=[
      ['search-filters','فلاتر البحث','اختر فلاتر البحث وترتيبها'],
      ['template-settings','قالب المنتجات','الباركود ورقم التذييل'],
      ['site-settings','إعدادات الموقع','دخول العملاء وتثبيت التطبيق'],
      ['business-settings','بيانات الشركة','البيانات التجارية والخصوصية'],
      ['bank-settings','الحسابات البنكية','حسابات التحويل وأزرار نسخ IBAN']
    ].filter(([key])=>allowed.has(key));
    const settingsKeys=keys=>settingsList.filter(([key])=>keys.includes(key));
    const catalogSettings=shortcutRows(settingsKeys(['search-filters','template-settings']),'إعدادات المنتجات');
    const companySettings=shortcutRows(settingsKeys(['site-settings','business-settings','bank-settings']),'إدارة إعدادات الموقع');
    const securityShortcuts=((isPrimaryAdmin||allowed.has('security'))?ownerShortcutButton('security','التحقق بخطوتين','الأجهزة الموثّقة وحماية تسجيل الدخول'):'')
      +(isPrimaryAdmin?ownerShortcutButton('credentials','بيانات تسجيل الدخول','حسابات المدير والأدمن والاستعادة')
        +ownerShortcutButton('permissions','صلاحيات الأدمن','تحديد ما يستطيع الأدمن الوصول إليه'):'');
    const section=(title,description,shortcuts)=>shortcuts
      ? `<section class="fl-overview-section"><div class="fl-overview-section-head"><h3>${title}</h3><p>${description}</p></div><div class="fl-overview-shortcuts">${shortcuts}</div></section>`
      : '';
    return `<div class="fl-cloud-head"><div><h2>${isPrimaryAdmin?'الرئيسية':'لوحة الأدمن'}</h2><p>${isPrimaryAdmin?'اختر القسم المطلوب من المجموعات التالية.':'تظهر لك الأقسام المسموح بها فقط حسب صلاحيات حسابك.'}</p></div></div>
      ${statsHtml}
      ${section('المنتجات والكتالوج','الأقسام والمنتجات وتصميم الداتا شيت.',catalogShortcuts)}
      ${section('المتابعة والتواصل','بيانات العملاء والتواصل وإحصائيات الزيارات.',followupShortcuts)}
      ${section('الفلاتر وقوالب المنتجات','تخصيص تجربة البحث وقالب المنتجات.',catalogSettings)}
      ${section('الموقع والمنشأة','بيانات الشركة والحسابات البنكية وإعدادات الموقع.',companySettings)}
      ${section('الحساب والأمان','إدارة عوامل المصادقة وحسابات وصلاحيات الإدارة.',securityShortcuts)}
      <div class="fl-cloud-note ok">الحساب الحالي: <b dir="ltr">${esc(currentAdminEmail)}</b> · ${isPrimaryAdmin?'المدير':'الأدمن'}</div>`;  }

window.FL_ADMIN_OVERVIEW=Object.freeze({render});
})();
