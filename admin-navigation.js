// Flower Light admin navigation — standalone, permission-aware view presentation.
(() => {
  'use strict';
  const mainViews=['sections','products','datasheet'];
  const catalogSettings=['search-filters','template-settings'];
  const companySettings=['site-settings','business-settings','bank-settings'];
  const contactViews=['leads','contacts','profile','analytics'];
  function esc(value){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function groups({view,allowed,adminViewItems,ownerSettingsViewItems,isPrimaryAdmin}){
    const permit=new Set(allowed||[]);
    const content=(adminViewItems||[]).filter(([key])=>permit.has(key));
    const from=keys=>keys.map(key=>content.find(row=>row[0]===key)).filter(Boolean);
    const result=[
      ['الرئيسية',[['overview','الرئيسية']]],
      ['المنتجات والكتالوج',from(mainViews)],
      ['المتابعة والتواصل',from(contactViews)]
    ];
    const settings=(ownerSettingsViewItems||[]).filter(([key])=>permit.has(key));
    const settingsFrom=keys=>keys.map(key=>settings.find(row=>row[0]===key)).filter(Boolean);
    result.push(['الفلاتر وقوالب المنتجات',settingsFrom(catalogSettings)]);
    result.push(['الموقع والمنشأة',settingsFrom(companySettings)]);
    const known=new Set([...catalogSettings,...companySettings]);
    const other=settings.filter(([key])=>!known.has(key));
    if(other.length)result.push(['إعدادات إضافية',other]);
    if(isPrimaryAdmin || permit.has('security'))result.push(['الحساب والأمان',isPrimaryAdmin
      ? [['security','التحقق بخطوتين'],['credentials','بيانات تسجيل الدخول'],['permissions','صلاحيات الأدمن']]
      : [['security','التحقق بخطوتين']]]);
    return result.filter(([,items])=>items.length);
  }
  function render(options){
    const groupsData=groups(options);
    const expanded=new Set(options.expandedGroups||[]);
    const groupHtml=groupsData.map(([label,items])=>{
      const active=items.some(([key])=>key===options.view);
      const open=active||expanded.has(label);
      return `<details class="fl-cloud-nav-group" data-nav-group="${esc(label)}" ${open?'open':''}>
        <summary class="fl-cloud-nav-heading"><span>${esc(label)}</span><small aria-label="${items.length} أقسام">${items.length}</small></summary>
        <div class="fl-cloud-nav-items">${items.map(([key,name])=>
          `<button type="button" data-cloud-view="${esc(key)}" class="${options.view===key?'active':''}" ${options.view===key?'aria-current="page"':''}>${esc(name)}</button>`).join('')}</div>
      </details>`;
    }).join('');
    const mobileOptions=groupsData.map(([label,items])=>
      `<optgroup label="${esc(label)}">${items.map(([key,name])=>`<option value="${esc(key)}" ${key===options.view?'selected':''}>${esc(name)}</option>`).join('')}</optgroup>`).join('');
    return `<div class="fl-admin-nav-wrap">
      <div class="fl-admin-mobile-controls"><div class="fl-admin-mobile-select"><label class="fl-admin-mobile-nav-label" for="flAdminViewSelect">انتقل إلى قسم</label><select id="flAdminViewSelect" class="fl-admin-mobile-nav" aria-label="انتقل إلى قسم">${mobileOptions}</select></div><button type="button" class="fl-admin-mobile-home" data-cloud-view="overview" ${options.view==='overview'?'disabled':''}>الرئيسية</button></div>
      <div class="fl-admin-nav-search"><label for="flAdminNavSearch">البحث في الأقسام</label><input id="flAdminNavSearch" type="search" autocomplete="off" placeholder="ابحث عن قسم..." aria-controls="flAdminSidebarNav"></div>
      <nav class="fl-cloud-nav" id="flAdminSidebarNav" aria-label="أقسام الإدارة">${groupHtml}<p class="fl-admin-nav-empty" id="flAdminNavEmpty" hidden>لا يوجد قسم مطابق للبحث.</p></nav>
    </div>`;
  }
  window.FL_ADMIN_NAV=Object.freeze({render,groups});
})();
