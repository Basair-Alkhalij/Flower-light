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

  function renderPermissions(){
    const rows=adminViewItems.filter(([key])=>delegatablePermissionKeys.has(key)).map(([key,label])=>`<label class="fl-permission-row"><span class="fl-permission-copy"><strong>${esc(label)}</strong><small>السماح للأدمن بفتح وإدارة هذا الجزء</small></span><input type="checkbox" name="admin2_permission" value="${key}" ${core.managedAdmin2Permissions.has(key)?'checked':''}><span class="fl-permission-check" aria-hidden="true">✓</span></label>`).join('');
    const accountReady=Boolean(core.managedAdmin2Email);
    layout(`<div class="fl-cloud-head"><div><h2>صلاحيات الأدمن</h2><p>حدد الأجزاء التي يستطيع الأدمن إدارتها. الرئيسية تبقى ظاهرة دائمًا، بينما الأقسام والمنتجات للمدير فقط.</p></div></div>
      <div class="fl-cloud-note ok">هذه صلاحيات حقيقية داخل قاعدة البيانات، وليست مجرد إخفاء للأزرار.</div>
      <div class="fl-cloud-note ${accountReady?'ok':'bad'}">${accountReady?`حساب الأدمن المرتبط: <b dir="ltr">${esc(core.managedAdmin2Email)}</b>`:'لم يتم إنشاء حساب الأدمن بعد. أنشئه أولًا من «بيانات تسجيل الدخول».'}</div>
      <form id="flPermissionsForm" class="fl-cloud-card fl-permissions-card">
        <div class="fl-permission-list">${rows}</div>
        <div class="fl-cloud-actions"><button class="fl-cloud-btn primary" id="flPermissionsSave" type="submit" ${accountReady?'':'disabled'}>حفظ الصلاحيات</button><button class="fl-cloud-btn secondary" id="flOpenCredentialsFromPermissions" type="button">بيانات تسجيل الدخول</button></div>
      </form>`);
    document.getElementById('flOpenCredentialsFromPermissions')?.addEventListener('click',()=>{core.view='credentials';core.renderApp();});
    document.getElementById('flPermissionsForm')?.addEventListener('submit',async event=>{
      event.preventDefault();
      const save=document.getElementById('flPermissionsSave');
      const email=core.managedAdmin2Email;
      if(!email){notify('أنشئ حساب الأدمن أولًا من بيانات تسجيل الدخول');return;}
      const selected=[...body.querySelectorAll('input[name="admin2_permission"]:checked')].map(input=>input.value);
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
