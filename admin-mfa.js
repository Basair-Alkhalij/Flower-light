// Flower Light admin MFA: optional TOTP enrollment and AAL2 sign-in challenge.
// The recovery email can reset passwords but cannot bypass a lost authenticator.
// No TOTP secret or verification code is stored in localStorage or analytics.
(() => {
  'use strict';
  const get = id => document.getElementById(id);
  const validCode = value => /^[0-9]{6}$/.test(String(value || '').trim());
  const validFactor = factor => factor && factor.factor_type === 'totp' && factor.status === 'verified' && typeof factor.id === 'string';
  const verifiedFactors = data => (Array.isArray(data?.totp) ? data.totp : (Array.isArray(data?.all) ? data.all : [])).filter(validFactor);
  const unfinishedFactors = data => (Array.isArray(data?.all) ? data.all : [])
    .filter(factor=>factor?.factor_type==='totp' && factor?.status==='unverified' && typeof factor?.id==='string');
  function enrollmentErrorMessage(error) {
    if(error?.code==='mfa_factor_name_conflict')return 'يوجد جهاز مسجل بالاسم نفسه. ألغِ محاولة الربط غير المكتملة ثم أعد المحاولة.';
    if(error?.code==='mfa_totp_enroll_not_enabled')return 'تسجيل تطبيق المصادقة TOTP معطّل في Supabase Authentication → Multi-Factor Authentication.';
    if(error?.code==='too_many_enrolled_mfa_factors')return 'وصل الحساب إلى الحد الأقصى من أجهزة المصادقة.';
    if(error?.code==='insufficient_aal')return 'تحتاج إلى التحقق باستخدام جهاز مصادقة مسجّل أولًا.';
    return 'تعذر إنشاء عامل المصادقة. تحقق من اتصالك وإعدادات MFA، ثم أعد المحاولة.';
  }
  function requireApi(db) {
    const mfa=db?.auth?.mfa;
    if (!mfa || !['listFactors','getAuthenticatorAssuranceLevel','challengeAndVerify','enroll','unenroll'].every(name=>typeof mfa[name]==='function')) {
      throw new Error('خدمة التحقق بخطوتين غير متاحة. حدّث الصفحة وحاول مجددًا.');
    }
    return mfa;
  }
  async function resultOf(promise) {
    const {data,error}=await promise;
    if(error) throw error;
    return data;
  }
  async function state(mfa) {
    const [factors,assurance]=await Promise.all([
      resultOf(mfa.listFactors()),
      resultOf(mfa.getAuthenticatorAssuranceLevel())
    ]);
    if(!assurance?.currentLevel)throw new Error('تعذر تحديد مستوى حماية جلسة الإدارة.');
    return {factors:verifiedFactors(factors),unfinished:unfinishedFactors(factors),level:assurance.currentLevel,next:assurance.nextLevel};
  }
  async function requireStepUp(db,body,onCancel) {
    const mfa=requireApi(db);
    const current=await state(mfa);
    if(!current.factors.length)return true; // Voluntary enrollment; no silent lockout of existing accounts.
    if(current.level==='aal2')return true;
    if(current.next!=='aal2')throw new Error('لم يتمكن الخادم من طلب تحقق بخطوتين.');
    return new Promise(resolve=>{
      let settled=false;
      const finish=ok=>{if(settled)return;settled=true;resolve(ok);};
      body.innerHTML='<div class="fl-cloud-wrap"><div class="fl-cloud-login" role="region" aria-label="التحقق بخطوتين"><h2>التحقق بخطوتين</h2><p>أدخل رمز تطبيق المصادقة الخاص بحسابك للمتابعة.</p><form id="flMfaChallengeForm"><div class="fl-cloud-field"><label for="flMfaFactor">تطبيق المصادقة</label><select id="flMfaFactor"></select></div><div class="fl-cloud-field"><label for="flMfaOtp">الرمز المكوّن من 6 أرقام</label><input id="flMfaOtp" type="text" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" minlength="6" maxlength="6" dir="ltr" required></div><p id="flMfaChallengeError" role="alert" aria-live="polite"></p><button class="fl-cloud-btn primary" id="flMfaVerify" type="submit">التحقق والمتابعة</button><button class="fl-cloud-btn secondary" id="flMfaCancel" type="button">تسجيل الخروج</button></form></div></div>';
      const select=get('flMfaFactor');
      for(const [index,factor] of current.factors.entries()){
        const option=document.createElement('option');
        option.value=factor.id;
        option.textContent=factor.friendly_name || 'تطبيق المصادقة '+(index+1);
        select.appendChild(option);
      }
      get('flMfaOtp')?.focus();
      get('flMfaCancel')?.addEventListener('click',async()=>{
        try{await onCancel?.();}finally{finish(false);}
      });
      get('flMfaChallengeForm')?.addEventListener('submit',async event=>{
        event.preventDefault();
        const button=get('flMfaVerify');
        const errorArea=get('flMfaChallengeError');
        const code=get('flMfaOtp').value.trim();
        if(!validCode(code)){errorArea.textContent='اكتب ستة أرقام من تطبيق المصادقة.';return;}
        button.disabled=true;
        errorArea.textContent='';
        try {
          const factorId=select.value;
          if(!current.factors.some(factor=>factor.id===factorId))throw new Error('عامل غير معروف');
          await resultOf(mfa.challengeAndVerify({factorId,code}));
          const next=await state(mfa);
          if(next.level!=='aal2')throw new Error('لم تُؤكّد الجلسة بالمستوى المطلوب.');
          finish(true);
        }catch(error){
          errorArea.textContent='رمز غير صحيح أو منتهي الصلاحية. تحقق من وقت جهازك وحاول مجددًا.';
          button.disabled=false;
        }
      });
    });
  }

  function renderSettings(db,host,role) {
    if(!host)return;
    host.innerHTML='<section class="fl-cloud-card fl-mfa-card"><h3>تطبيق المصادقة (MFA)</h3><p>يمكنك ربط حسابك بتطبيق مثل Google Authenticator أو Microsoft Authenticator. عند ربطه سيُطلب رمز بعد كلمة المرور.</p><p class="fl-cloud-note">مهم: بريد الاستعادة لا يتجاوز MFA، ولا يدعم Supabase رموز استرداد منفصلة. سجّل جهازًا احتياطيًا قبل الاعتماد على MFA.</p><p id="flMfaStatus" role="status" aria-live="polite">جاري التحقق...</p><div id="flMfaFactors"></div><button id="flMfaEnroll" class="fl-cloud-btn primary" type="button" hidden>إضافة تطبيق مصادقة</button><section id="flMfaSetup" hidden><h4>ربط تطبيق مصادقة</h4><p>امسح الرمز في تطبيق المصادقة أو أدخل المفتاح يدويًا. لا تشارك المفتاح مع أحد.</p><img id="flMfaQr" alt="رمز QR الخاص بإعداد تطبيق المصادقة" style="max-width:180px;max-height:180px" hidden><p>المفتاح اليدوي: <code id="flMfaSecret" dir="ltr"></code></p><form id="flMfaSetupForm"><div class="fl-cloud-field"><label for="flMfaSetupOtp">رمز التحقق من التطبيق</label><input id="flMfaSetupOtp" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" minlength="6" dir="ltr" required></div><button class="fl-cloud-btn primary" id="flMfaSetupVerify" type="submit">تأكيد الربط</button><button class="fl-cloud-btn secondary" id="flMfaSetupCancel" type="button">إلغاء الربط</button></form></section></section>';
    const status=get('flMfaStatus'), factorList=get('flMfaFactors'), enrollBtn=get('flMfaEnroll');
    const setup=get('flMfaSetup'),qr=get('flMfaQr'),secret=get('flMfaSecret');
    const mfa=requireApi(db);
    let pending=null,verified=[],unfinished=[];
    function clearSetup(){
      pending=null;setup.hidden=true;qr.hidden=true;qr.removeAttribute('src');
      secret.textContent='';get('flMfaSetupOtp').value='';
    }
    async function reload(){
      const info=await state(mfa);
      verified=info.factors;
      unfinished=info.unfinished;
      factorList.replaceChildren();
      status.textContent=unfinished.length
        ? 'هناك محاولة ربط لم تُكتمل. ألغِها من الأسفل قبل إنشاء رمز QR جديد.'
        : verified.length
          ? 'لديك '+verified.length+' تطبيق مصادقة موثّق. مستوى الجلسة الحالي: '+info.level+'.'
          : 'لم يتم ربط تطبيق مصادقة بهذا الحساب بعد.';
      verified.forEach((factor,index)=>{
        const row=document.createElement('div');
        row.className='fl-mfa-factor-row';
        const label=document.createElement('span');
        label.textContent=factor.friendly_name || 'تطبيق '+(index+1);
        row.appendChild(label);
        if(verified.length>1 && info.level==='aal2'){
          const remove=document.createElement('button');
          remove.type='button';remove.className='fl-cloud-btn secondary';
          remove.textContent='إزالة الجهاز';
          remove.addEventListener('click',async()=>{
            if(!window.confirm('هل تأكدت من توفر جهاز مصادقة احتياطي آخر؟'))return;
            remove.disabled=true;
            try{await resultOf(mfa.unenroll({factorId:factor.id}));await reload();}
            catch(_){status.textContent='تعذر إزالة الجهاز. أعد التحقق وسجّل الدخول من جديد إذا لزم الأمر.';remove.disabled=false;}
          });
          row.appendChild(remove);
        }
        factorList.appendChild(row);
      });
      unfinished.forEach(factor=>{
        const row=document.createElement('div');
        row.className='fl-mfa-factor-row';
        const label=document.createElement('span');
        label.textContent='ربط غير مكتمل: '+(factor.friendly_name||'تطبيق المصادقة');
        row.appendChild(label);
        const cancel=document.createElement('button');
        cancel.type='button';cancel.className='fl-cloud-btn secondary';
        cancel.textContent='إلغاء محاولة الربط';
        cancel.addEventListener('click',async()=>{
          if(!window.confirm('هل تريد إلغاء محاولة ربط تطبيق المصادقة غير المكتملة؟ لن تتأثر أجهزة المصادقة المفعّلة.'))return;
          cancel.disabled=true;
          try{
            // Only an unverified factor in the current signed-in user's list.
            await resultOf(mfa.unenroll({factorId:factor.id}));
            await reload();
          }catch(_){
            status.textContent='تعذر إلغاء المحاولة غير المكتملة. أعد تسجيل الدخول وحاول مجددًا.';
            cancel.disabled=false;
          }
        });
        row.appendChild(cancel);factorList.appendChild(row);
      });
      enrollBtn.hidden=verified.length+unfinished.length>=10 || unfinished.length>0;
      enrollBtn.textContent=verified.length?'إضافة جهاز احتياطي':'تفعيل التحقق بخطوتين';
    }
    enrollBtn.addEventListener('click',async()=>{
      enrollBtn.disabled=true;status.textContent='جاري إنشاء رمز الربط...';
      try{
        // Supabase requires unique friendly names even across unfinished enrollments.
        const uniqueName='Flower Light - '+(role==='owner'?'Owner':'Admin')+' - '+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8);
        const data=await resultOf(mfa.enroll({factorType:'totp',friendlyName:uniqueName}));
        if(!data?.id || !data?.totp?.secret)throw new Error('Missing TOTP enrollment');
        pending=data.id;
        setup.hidden=false;
        secret.textContent=data.totp.secret;
        const uri=String(data.totp.qr_code||'');
        if(/^data:image\/svg\+xml(?:;charset=[\w-]+)?;(?:utf8|base64),/i.test(uri)){
          qr.src=uri;qr.hidden=false;
        }
        status.textContent='أدخل الرمز الحالي للتأكيد. احتفظ بجهاز احتياطي.';
      }catch(error){status.textContent=enrollmentErrorMessage(error);}
      finally{enrollBtn.disabled=false;}
    });
    get('flMfaSetupForm').addEventListener('submit',async event=>{
      event.preventDefault();
      const code=get('flMfaSetupOtp').value.trim();
      if(!pending||!validCode(code)){status.textContent='أدخل رمزًا صحيحًا من ستة أرقام.';return;}
      const btn=get('flMfaSetupVerify');btn.disabled=true;
      try{
        await resultOf(mfa.challengeAndVerify({factorId:pending,code}));
        clearSetup();await reload();
        status.textContent='تم تفعيل MFA لهذا الحساب. أضف جهازًا ثانيًا احتياطيًا.';
      }catch(_){status.textContent='تعذر تأكيد الرمز؛ تحقق من الرمز والوقت ثم أعد المحاولة.';}
      finally{btn.disabled=false;}
    });
    get('flMfaSetupCancel').addEventListener('click',async()=>{
      const id=pending;clearSetup();
      if(id){try{await resultOf(mfa.unenroll({factorId:id}));}catch(_){}}
      await reload().catch(()=>{status.textContent='تعذر تحديث حالة MFA.';});
    });
    reload().catch(()=>{status.textContent='تعذر تحميل وسائل MFA. حدّث الصفحة وحاول مجددًا.';enrollBtn.hidden=true;});
  }
  window.FL_ADMIN_MFA=Object.freeze({requireStepUp,renderSettings,validCode});
})();