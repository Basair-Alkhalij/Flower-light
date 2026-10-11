// Flower Light admin navigation — standalone, permission-aware view presentation.
(() => {
  'use strict';
  const mainViews=['sections','products','datasheet'];
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
    if(isPrimaryAdmin){
      result.push(['إعدادات الموقع',ownerSettingsViewItems||[]]);
      result.push(['الحسابات والصلاحيات',[['credentials','بيانات تسجيل الدخول'],['permissions','صلاحيات الأدمن']]]);
    }
    return result.filter(([,items])=>items.length);
  }
  function render(options){
    const groupsData=groups(options);
    const groupHtml=groupsData.map(([label,items])=>
      `<div class="fl-cloud-nav-group"><span class="fl-cloud-nav-label">${esc(label)}</span>${items.map(([key,name])=>
        `<button type="button" data-cloud-view="${esc(key)}" class="${options.view===key?'active':''}" ${options.view===key?'aria-current="page"':''}>${esc(name)}</button>`).join('')}</div>`).join('');
    const selected=groupsData.flatMap(([,items])=>items).find(([key])=>key===options.view);
    const mobileOptions=groupsData.map(([label,items])=>
      `<optgroup label="${esc(label)}">${items.map(([key,name])=>`<option value="${esc(key)}" ${key===options.view?'selected':''}>${esc(name)}</option>`).join('')}</optgroup>`).join('');
    return `<div class="fl-admin-nav-wrap"><label class="fl-admin-mobile-nav-label" for="flAdminViewSelect">انتقل إلى قسم</label><select id="flAdminViewSelect" class="fl-admin-mobile-nav" aria-label="انتقل إلى قسم">${mobileOptions}</select><nav class="fl-cloud-nav" aria-label="أقسام الإدارة">${groupHtml}</nav></div>`;
  }
  window.FL_ADMIN_NAV=Object.freeze({render,groups});
})();
