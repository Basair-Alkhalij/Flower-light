// Flower Light admin — Admin-permissions section (module split, part 3)
//
// Moved verbatim from admin.js, only the shared state is now reached through
// window.FL_ADMIN_CORE (managedAdmin2Email / managedAdmin2Permissions / view).
// Owner-only screen; real enforcement stays in Supabase RLS/RPC (owner_set_admin2_settings).
// Classic script loaded right after admin.js on ?admin= pages; no-ops without FL_ADMIN_CORE.

(() => {
  'use strict';
  const core = window.FL_ADMIN_CORE;
  if (!core) {
    console.error('[admin-permissions] window.FL_ADMIN_CORE is missing — admin.js must load before admin-permissions.js.');
    return;
  }
  const { esc, notify, layout, body, adminViewItems, delegatablePermissionKeys, normalizePermissionList } = core;

  // Preview of the full administrative menu. Current database rules support
  // five delegated areas; all other areas remain disabled until the owner
  // approves and applies a complete RLS/RPC permission migration.
  const permissionGroups=[
    ['المنتجات والكتالوج',['sections','products','datasheet']],
    ['المتابعة والتواصل',['leads','contacts','profile','analytics']],
    ['الفلاتر وقوالب المنتجات',['search-filters','template-settings']],
    ['الموقع والمنشأة',['site-settings','business-settings','bank-settings']]
  ];

  function renderPermissions(){
    const labels=new Map([...adminViewItems,...(core.ownerSettingsViewItems||[])]);
    const supported=delegatablePermissionKeys;
    const enabled=core.managedAdmin2Permissions;
    const groups=permissionGroups.map(([title,keys])=>{
      const rows=keys.filter(key=>labels.has(key)).map(key=>{
        const active=supported.has(key);
        const description=active?'السماح للأدمن بفتح وإدارة هذا الجزء':'قيد التجهيز — يحتاج تحديث حماية Supabase قبل تفعيله';
        return `<label class="fl-permission-row" data-permission-key="${esc(key)}"><span class="fl-permission-copy"><strong>${esc(labels.get(key))}</strong><small>${esc(description)}</small></span><input type="checkbox" name="admin2_permission" value="${esc(key)}" ${active&&enabled.has(key)?'checked':''} ${active?'':'disabled'}><span class="fl-permission-check" aria-hidden="true">✓</span></label>`;
      }).join('');
      return `<section class="fl-permission-group"><h3>${esc(title)}</h3><div class="fl-permission-list">${rows}</div></section>`;
    }).join('');
    const accountReady=Boolean(core.managedAdmin2Email);
    layout(`<div class="fl-cloud-head"><div><h2>صلاحيات الأدمن لكل قسم</h2><p>اختر وصول الأدمن بشكل مستقل لكل جزء من لوحة الإدارة. حسابات الدخول والصلاحيات تبقى حصرية للمدير الأساسي.</p></div></div>
      <div class="fl-cloud-note">يمكن تعديل الصلاحيات الحالية. الخيارات الأخرى ظاهرة للمعاينة ولكنها مُعطَّلة حتى اعتماد تحديث حماية قاعدة البيانات؛ لن يتم منح وصول جديد من مجرد تغيير الواجهة.</div>
      <div class="fl-cloud-note ${accountReady?'ok':'bad'}">${accountReady?`حساب الأدمن المرتبط: <b dir="ltr">${esc(core.managedAdmin2Email)}</b>`:'لم يتم إنشاء حساب الأدمن بعد. أنشئه أولًا من «بيانات تسجيل الدخول».'}</div>
      <form id="flPermissionsForm" class="fl-cloud-card fl-permissions-card">
        <div class="fl-permission-groups">${groups}</div>
        <div class="fl-cloud-actions"><button class="fl-cloud-btn primary" id="flPermissionsSave" type="submit" ${accountReady?'':'disabled'}>حفظ الصلاحيات المتاحة</button><button class="fl-cloud-btn secondary" id="flOpenCredentialsFromPermissions" type="button">بيانات تسجيل الدخول</button></div>
      </form>`);
    document.getElementById('flOpenCredentialsFromPermissions')?.addEventListener('click',()=>{core.view='credentials';core.renderApp();});
    document.getElementById('flPermissionsForm')?.addEventListener('submit',async event=>{
      event.preventDefault();
      const save=document.getElementById('flPermissionsSave');
      const email=core.managedAdmin2Email;
      if(!email){notify('أنشئ حساب الأدمن أولًا من بيانات تسجيل الدخول');return;}
      // Ignore forged and disabled keys; only current server-supported permissions
      // may be submitted while the new areas await an audited RLS migration.
      const selected=[...body.querySelectorAll('input[name="admin2_permission"]:checked')]
        .map(input=>input.value).filter(key=>delegatablePermissionKeys.has(key));
      save.disabled=true;save.textContent='جاري الحفظ...';
      try{
        const {data,error}=await core.db.rpc('owner_set_admin2_settings',{p_email:email,p_permissions:selected});
        if(error)throw error;
        core.managedAdmin2Email=String(data?.email||email);
        core.managedAdmin2Permissions=new Set(normalizePermissionList(data));
        renderPermissions();notify('تم حفظ صلاحيات الأدمن');
      }catch(error){
        const message=String(error?.message||error||'');
        const friendly=message.includes('No Supabase Auth user')?'تعذر العثور على حساب الأدمن. حدّث بيانات تسجيل الدخول ثم حاول مجددًا.'
          : message.includes('different Supabase Auth account')?'يجب أن يكون بريد الأدمن مختلفًا عن حساب المدير.'
          : message.includes('Owner access required')?'هذه العملية متاحة للمدير الأساسي Owner فقط.'
          : 'تعذر حفظ الصلاحيات: '+message;
        notify(friendly);
        save.disabled=false;save.textContent='حفظ الصلاحيات';
      }
    });
  }

  window.FL_ADMIN_PERMISSIONS = { renderPermissions };
})();
