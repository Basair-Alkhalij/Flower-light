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
      const displayLabels=await readAccountLabels(db.auth).catch(()=>({}));
      for(const [index,factor] of current.factors.entries()){
        const option=document.createElement('option');
        option.value=factor.id;
        option.textContent=normalizeName(displayLabels[factor.id])||factor.friendly_name||'تطبيق المصادقة '+(index+1);
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

  // Names stored in user_metadata are presentation-only aliases, not authorization.
  // Supabase Auth does not expose a client-side rename operation for verified factors.
  const aliasKey='flower_light_mfa_labels';
  const normalizeName=value=>String(value||'').trim();
  const acceptableName=value=>{
    const name=normalizeName(value);
    return name.length>=2 && name.length<=48 && !/[\u0000-\u001f\u007f]/.test(name);
  };
  async function readAccountLabels(auth) {
    if(typeof auth?.getUser!=='function')return {};
    const {data,error}=await auth.getUser();
    if(error)throw error;
    const labels=data?.user?.user_metadata?.[aliasKey];
    return labels && typeof labels==='object' && !Array.isArray(labels) ? {...labels} : {};
  }
  async function saveAccountLabel(auth,factorId,label) {
    if(typeof auth?.updateUser!=='function'||typeof auth?.getUser!=='function')throw new Error('خدمة تعديل اسم الجهاز غير متاحة.');
    const existing=await readAccountLabels(auth);
    if(label)existing[factorId]=label;
    else delete existing[factorId];
    await resultOf(auth.updateUser({data:{[aliasKey]:existing}}));
  }
  function renderSettings(db,host,role) {
    if(!host)return;
    host.innerHTML='<section class="fl-cloud-card fl-mfa-card"><h3>التحقق بخطوتين (MFA)</h3><p>يمكنك ربط تطبيق المصادقة باسم تختاره، أو إلغاء الربط عندما تريد. الإلغاء الكامل يجعل تسجيل الدخول بكلمة المرور فقط، ويقلل حماية الحساب.</p><p class="fl-cloud-note">بريد الاستعادة لا يتجاوز MFA، ولا يوفر Supabase رموز استرداد مستقلة. يُفضّل إضافة جهاز احتياطي.</p><p id="flMfaStatus" role="status" aria-live="polite">جاري التحقق...</p><div id="flMfaFactors"></div><div class="fl-cloud-field"><label for="flMfaNewName">اسم جهاز المصادقة الجديد</label><input id="flMfaNewName" maxlength="48" autocomplete="off" placeholder="مثال: هاتفي الأساسي" type="text"><small>اختر اسمًا من 2 إلى 48 حرفًا، مختلفًا عن أسماء الأجهزة المرتبطة.</small></div><button id="flMfaEnroll" class="fl-cloud-btn primary" type="button" hidden>إضافة تطبيق مصادقة</button><section id="flMfaSetup" hidden><h4>ربط تطبيق مصادقة</h4><p>امسح الرمز في تطبيق المصادقة أو أدخل المفتاح يدويًا. لا تشارك المفتاح مع أحد.</p><img id="flMfaQr" alt="رمز QR الخاص بإعداد تطبيق المصادقة" style="max-width:180px;max-height:180px" hidden><p>المفتاح اليدوي: <code id="flMfaSecret" dir="ltr"></code></p><form id="flMfaSetupForm"><div class="fl-cloud-field"><label for="flMfaSetupOtp">رمز التحقق من التطبيق</label><input id="flMfaSetupOtp" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" minlength="6" dir="ltr" required></div><button class="fl-cloud-btn primary" id="flMfaSetupVerify" type="submit">تأكيد الربط</button><button class="fl-cloud-btn secondary" id="flMfaSetupCancel" type="button">إلغاء الربط قبل التفعيل</button></form></section></section>';
    const status=get('flMfaStatus'), factorList=get('flMfaFactors'), enrollBtn=get('flMfaEnroll');
    const setup=get('flMfaSetup'),qr=get('flMfaQr'),secret=get('flMfaSecret'),nameInput=get('flMfaNewName');
    const mfa=requireApi(db);
    let pending=null,verified=[],unfinished=[],labels={};
    function clearSetup(){
      pending=null;setup.hidden=true;qr.hidden=true;qr.removeAttribute('src');
      secret.textContent='';get('flMfaSetupOtp').value='';
    }
    function labelledFactor(factor,index){
      return normalizeName(labels[factor.id])||normalizeName(factor.friendly_name)||'تطبيق '+(index+1);
    }
    async function reload(){
      const info=await state(mfa);
      verified=info.factors;
      unfinished=info.unfinished;
      try{labels=await readAccountLabels(db.auth);}
      catch(_){labels={};}
      factorList.replaceChildren();
      status.textContent=unfinished.length
        ? 'توجد محاولة ربط غير مكتملة؛ ألغِها قبل ربط جهاز آخر.'
        : verified.length
          ? 'التحقق بخطوتين مفعّل ('+verified.length+' جهاز). مستوى الجلسة: '+info.level+'.'
          : 'التحقق بخطوتين غير مفعّل لهذا الحساب.';
      verified.forEach((factor,index)=>{
        const row=document.createElement('div');
        row.className='fl-mfa-factor-row fl-mfa-manage-row';
        const name=document.createElement('div');
        name.className='fl-mfa-factor-name';
        name.textContent=labelledFactor(factor,index);
        row.appendChild(name);

        const editForm=document.createElement('form');
        editForm.className='fl-mfa-edit-form';
        const editLabel=document.createElement('label');
        editLabel.textContent='الاسم الذي يظهر لك في لوحة الإدارة';
        const editInput=document.createElement('input');
        editInput.type='text';editInput.maxLength=48;editInput.required=true;
        editInput.value=labelledFactor(factor,index);
        editLabel.appendChild(editInput);
        const save=document.createElement('button');
        save.type='submit';save.className='fl-cloud-btn secondary';save.textContent='حفظ الاسم';
        editForm.append(editLabel,save);
        editForm.addEventListener('submit',async event=>{
          event.preventDefault();
          const chosen=normalizeName(editInput.value);
          if(!acceptableName(chosen)){status.textContent='أدخل اسمًا من 2 إلى 48 حرفًا.';return;}
          save.disabled=true;
          try{
            await saveAccountLabel(db.auth,factor.id,chosen);
            labels[factor.id]=chosen;
            name.textContent=chosen;
            status.textContent='تم حفظ الاسم الظاهر لهذا الجهاز في حسابك.';
          }catch(_){status.textContent='تعذر حفظ الاسم. تحقق من جلسة الدخول وحاول مجددًا.';}
          finally{save.disabled=false;}
        });
        row.appendChild(editForm);

        if(info.level==='aal2'){
          const details=document.createElement('details');
          details.className='fl-mfa-remove-section';
          const summary=document.createElement('summary');
          summary.textContent=verified.length===1?'إلغاء التحقق بخطوتين':'إلغاء ربط هذا الجهاز';
          details.appendChild(summary);
          const warning=document.createElement('p');
          warning.textContent=verified.length===1
            ? 'تحذير: هذا آخر جهاز مفعّل. عند إلغائه ستتمكن من تسجيل الدخول بكلمة المرور فقط. أدخل رمز الجهاز الحالي لتأكيد الإلغاء.'
            : 'لن يؤثر هذا على أجهزة المصادقة الأخرى. أدخل رمز هذا الجهاز لتأكيد الإلغاء.';
          details.appendChild(warning);
          const form=document.createElement('form');
          form.className='fl-mfa-remove-form';
          const codeLabel=document.createElement('label');
          codeLabel.textContent='رمز المصادقة الحالي (6 أرقام)';
          const codeInput=document.createElement('input');
          codeInput.type='text';codeInput.inputMode='numeric';
          codeInput.autocomplete='one-time-code';codeInput.maxLength=6;
          codeInput.required=true;codeInput.pattern='[0-9]{6}';codeInput.dir='ltr';
          codeLabel.appendChild(codeInput);
          const confirm=document.createElement('button');
          confirm.type='submit';confirm.className='fl-cloud-btn secondary';
          confirm.textContent=verified.length===1?'تأكيد إلغاء التحقق بخطوتين':'تأكيد إلغاء ربط الجهاز';
          form.append(codeLabel,confirm);
          form.addEventListener('submit',async event=>{
            event.preventDefault();
            const code=normalizeName(codeInput.value);
            if(!validCode(code)){status.textContent='أدخل رمز المصادقة الصحيح من ستة أرقام.';return;}
            const last=verified.length===1;
            if(!window.confirm(last
              ? 'هل تريد إيقاف التحقق بخطوتين لهذا الحساب؟ ستنخفض الحماية وسيصبح الدخول بكلمة المرور فقط.'
              : 'هل تريد إزالة هذا الجهاز من وسائل المصادقة؟'))return;
            confirm.disabled=true;
            try{
              const fresh=await state(mfa);
              if(fresh.level!=='aal2'||!fresh.factors.some(item=>item.id===factor.id))
                throw new Error('AAL2 session required');
              await resultOf(mfa.challengeAndVerify({factorId:factor.id,code}));
              await resultOf(mfa.unenroll({factorId:factor.id}));
              // When the last factor goes away, remove stale AAL2 claims promptly.
              if(last && typeof db.auth.refreshSession==='function'){
                try{await db.auth.refreshSession();}catch(_){}
              }
              await reload();
              status.textContent=last
                ? 'تم إلغاء التحقق بخطوتين لهذا الحساب. يمكنك تفعيله مجددًا وقتما تريد.'
                : 'تم إلغاء ربط الجهاز، وبقيت أجهزة المصادقة الأخرى مفعّلة.';
            }catch(_){
              status.textContent='تعذر إلغاء الربط. تأكد من رمز الجهاز الحالي ومن حالة جلسة التحقق.';
              confirm.disabled=false;
            }
          });
          details.appendChild(form);
          row.appendChild(details);
        }else{
          const note=document.createElement('small');
          note.textContent='يلزم إكمال التحقق بخطوتين قبل إزالة جهاز مفعّل.';
          row.appendChild(note);
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
          if(!window.confirm('إلغاء محاولة الربط غير المكتملة؟ لن تتأثر أجهزة المصادقة المفعّلة.'))return;
          cancel.disabled=true;
          try{
            await resultOf(mfa.unenroll({factorId:factor.id}));
            await reload();
          }catch(_){
            status.textContent='تعذر إلغاء المحاولة غير المكتملة.';
            cancel.disabled=false;
          }
        });
        row.appendChild(cancel);factorList.appendChild(row);
      });
      enrollBtn.hidden=verified.length+unfinished.length>=10 || unfinished.length>0;
      nameInput.disabled=verified.length+unfinished.length>=10 || unfinished.length>0;
      enrollBtn.textContent=verified.length?'ربط جهاز مصادقة إضافي':'تفعيل التحقق بخطوتين';
    }
    enrollBtn.addEventListener('click',async()=>{
      const chosen=normalizeName(nameInput.value);
      if(!acceptableName(chosen)){status.textContent='اكتب اسم الجهاز أولًا (من 2 إلى 48 حرفًا).';nameInput.focus();return;}
      // A name conflict should be corrected by the user, not hidden with random suffixes.
      if([...verified,...unfinished].some(f=>normalizeName(f.friendly_name).toLowerCase()===chosen.toLowerCase())){
        status.textContent='اسم الجهاز مستخدم بالفعل. اختر اسمًا مختلفًا.';nameInput.focus();return;
      }
      enrollBtn.disabled=true;status.textContent='جاري إنشاء رمز الربط...';
      try{
        const data=await resultOf(mfa.enroll({factorType:'totp',friendlyName:chosen}));
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
        clearSetup();nameInput.value='';
        await reload();
        status.textContent='تم تفعيل تطبيق المصادقة بهذا الاسم. يُفضّل إضافة جهاز احتياطي.';
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