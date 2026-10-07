// Flower Light admin — owner-managed bank transfer accounts (v108)
(() => {
  'use strict';
  const core=window.FL_ADMIN_CORE;
  if(!core)return;
  const db=new Proxy({}, {get:(_,prop)=>{const real=core.db;const value=real[prop];return typeof value==='function'?value.bind(real):value;}});
  let accounts=[];
  let loadedIds=new Set();
  let loaded=false;
  let error='';

  const cleanIban=value=>String(value||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
  const cleanCompact=value=>String(value||'').trim().replace(/\s+/g,' ');
  function validIban(value){
    const iban=cleanIban(value);
    if(!iban)return true;
    if(!/^[A-Z]{2}[0-9A-Z]{13,32}$/.test(iban))return false;
    if(iban.startsWith('SA')&&iban.length!==24)return false;
    const rearranged=iban.slice(4)+iban.slice(0,4);
    let remainder=0;
    for(const ch of rearranged){
      const part=/\d/.test(ch)?ch:String(ch.charCodeAt(0)-55);
      for(const digit of part)remainder=(remainder*10+Number(digit))%97;
    }
    return remainder===1;
  }
  function normalize(account,index=0){
    return {
      id:String(account?.id||crypto.randomUUID()),
      bank_name:String(account?.bank_name||'').slice(0,80),
      beneficiary_name:String(account?.beneficiary_name||'').slice(0,120),
      iban:cleanIban(account?.iban||'').slice(0,34),
      account_number:String(account?.account_number||'').replace(/[^0-9A-Za-z-]/g,'').slice(0,80),
      swift_code:String(account?.swift_code||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,20),
      note:String(account?.note||'').slice(0,240),
      is_visible:account?.is_visible!==false,
      is_primary:account?.is_primary===true,
      sort_order:Number.isInteger(Number(account?.sort_order))?Number(account.sort_order):index
    };
  }

  async function load(){
    if(!core.isPrimaryAdmin)return;
    loaded=false;error='';
    try{
      const result=await db.from('business_bank_accounts').select('id,bank_name,beneficiary_name,iban,account_number,swift_code,note,is_visible,is_primary,sort_order').order('is_primary',{ascending:false}).order('sort_order',{ascending:true}).order('created_at',{ascending:true});
      if(result.error)throw result.error;
      accounts=(result.data||[]).map(normalize);
      loadedIds=new Set(accounts.map(account=>account.id));
      loaded=true;
    }catch(e){
      error=/business_bank_accounts|42P01|PGRST205/i.test(String(e?.message||e?.code||''))
        ?'يلزم تشغيل ترقية v108 في Supabase لتفعيل الحسابات البنكية.'
        :'تعذر تحميل الحسابات البنكية: '+String(e?.message||e||'خطأ غير معروف');
    }
  }

  function rowHtml(account,index,total){
    const esc=core.esc;
    return `<div class="fl-bank-editor-row" data-bank-row data-bank-id="${esc(account.id)}">
      <div class="fl-bank-editor-head">
        <div><strong>${esc(account.bank_name||`حساب بنكي ${index+1}`)}</strong><small>${account.is_primary?'الحساب الرئيسي':'حساب إضافي'}</small></div>
        <label class="fl-bank-primary"><input data-bank-primary type="checkbox" ${account.is_primary?'checked':''}> الحساب الرئيسي</label>
      </div>
      <div class="fl-bank-editor-grid">
        <label class="fl-cloud-field"><span>اسم البنك</span><input data-bank-name type="text" maxlength="80" required value="${esc(account.bank_name)}" placeholder="مثال: مصرف الراجحي"></label>
        <label class="fl-cloud-field"><span>اسم المستفيد</span><input data-bank-beneficiary type="text" maxlength="120" value="${esc(account.beneficiary_name)}" placeholder="مثال: شركة بصائر الخليج"></label>
        <label class="fl-cloud-field fl-bank-wide"><span>IBAN</span><input data-bank-iban type="text" maxlength="42" dir="ltr" value="${esc(account.iban)}" placeholder="SA00 0000 0000 0000 0000 0000"><small>تُزال المسافات تلقائيًا عند الحفظ ويتم التحقق من صحة IBAN.</small></label>
        <label class="fl-cloud-field"><span>رقم الحساب <small>اختياري</small></span><input data-bank-account-number type="text" maxlength="80" dir="ltr" value="${esc(account.account_number)}"></label>
        <label class="fl-cloud-field"><span>SWIFT / BIC <small>اختياري</small></span><input data-bank-swift type="text" maxlength="20" dir="ltr" value="${esc(account.swift_code)}"></label>
        <label class="fl-cloud-field fl-bank-wide"><span>ملاحظة للعميل <small>اختياري</small></span><input data-bank-note type="text" maxlength="240" value="${esc(account.note)}" placeholder="مثال: للحوالات البنكية فقط"></label>
      </div>
      <div class="fl-bank-editor-controls">
        <label class="fl-cloud-check"><input data-bank-visible type="checkbox" ${account.is_visible?'checked':''}> ظاهر للزوار</label>
        <div class="fl-business-order-actions" aria-label="ترتيب الحساب">
          <button class="fl-cloud-mini" data-bank-action="up" type="button" ${index===0?'disabled':''} aria-label="نقل الحساب للأعلى">↑</button>
          <button class="fl-cloud-mini" data-bank-action="down" type="button" ${index===total-1?'disabled':''} aria-label="نقل الحساب للأسفل">↓</button>
          <button class="fl-cloud-mini red" data-bank-action="delete" type="button">حذف</button>
        </div>
      </div>
    </div>`;
  }

  function cardsHtml(){
    if(!core.isPrimaryAdmin)return '';
    const esc=core.esc;
    return `<form id="flBankAccountsForm" class="fl-cloud-card fl-bank-settings-card">
      <div class="fl-credentials-card-head"><div><span class="fl-account-badge owner">الحسابات البنكية</span><h3>بيانات استقبال الحوالات</h3></div></div>
      <p>أضف حسابًا واحدًا أو أكثر. سيظهر للعميل اسم البنك والمستفيد وبيانات التحويل مع زر نسخ مباشر. لا تضف بيانات البطاقة أو PIN أو CVV أو OTP.</p>
      ${error?`<div class="fl-cloud-note bad" role="alert">${esc(error)}</div>`:''}
      <fieldset ${loaded?'':'disabled'}>
        <div class="fl-bank-admin-toolbar"><div><strong>الحسابات</strong><small>يمكنك ترتيبها وإخفاؤها وتحديد حساب رئيسي واحد.</small></div><button id="flBankAdd" class="fl-cloud-btn" type="button">+ إضافة حساب بنكي</button></div>
        <div id="flBankAccountsList" class="fl-bank-editor-list">${accounts.map((account,index)=>rowHtml(account,index,accounts.length)).join('')}</div>
        <div id="flBankEmpty" class="fl-cloud-empty" ${accounts.length?'hidden':''}>لا توجد حسابات بنكية مضافة حتى الآن.</div>
        <div class="fl-cloud-actions"><button id="flBankSave" class="fl-cloud-btn primary" type="submit">حفظ الحسابات البنكية</button></div>
      </fieldset>
    </form>`;
  }

  function bind(renderPage){
    if(!core.isPrimaryAdmin)return;
    const list=document.getElementById('flBankAccountsList');
    const empty=document.getElementById('flBankEmpty');
    if(!list)return;

    function sync(){
      accounts=[...list.querySelectorAll('[data-bank-row]')].map((row,index)=>normalize({
        id:row.dataset.bankId,
        bank_name:row.querySelector('[data-bank-name]')?.value||'',
        beneficiary_name:row.querySelector('[data-bank-beneficiary]')?.value||'',
        iban:row.querySelector('[data-bank-iban]')?.value||'',
        account_number:row.querySelector('[data-bank-account-number]')?.value||'',
        swift_code:row.querySelector('[data-bank-swift]')?.value||'',
        note:row.querySelector('[data-bank-note]')?.value||'',
        is_visible:Boolean(row.querySelector('[data-bank-visible]')?.checked),
        is_primary:Boolean(row.querySelector('[data-bank-primary]')?.checked),
        sort_order:index
      },index));
    }
    function render(){
      list.innerHTML=accounts.map((account,index)=>rowHtml(account,index,accounts.length)).join('');
      if(empty)empty.hidden=accounts.length>0;
    }

    document.getElementById('flBankAdd')?.addEventListener('click',()=>{
      sync();
      accounts.push(normalize({bank_name:'',beneficiary_name:'شركة بصائر الخليج',is_visible:true,is_primary:accounts.length===0,sort_order:accounts.length},accounts.length));
      render();
      list.querySelector('[data-bank-row]:last-child [data-bank-name]')?.focus();
    });

    list.addEventListener('change',event=>{
      if(!event.target.matches('[data-bank-primary]')||!event.target.checked)return;
      list.querySelectorAll('[data-bank-primary]').forEach(input=>{if(input!==event.target)input.checked=false;});
    });
    list.addEventListener('click',event=>{
      const button=event.target.closest('[data-bank-action]');if(!button)return;
      const row=button.closest('[data-bank-row]');if(!row)return;
      sync();
      const index=accounts.findIndex(account=>account.id===row.dataset.bankId);if(index<0)return;
      const action=button.dataset.bankAction;
      if(action==='delete')accounts.splice(index,1);
      if(action==='up'&&index>0)[accounts[index-1],accounts[index]]=[accounts[index],accounts[index-1]];
      if(action==='down'&&index<accounts.length-1)[accounts[index+1],accounts[index]]=[accounts[index],accounts[index+1]];
      if(accounts.length&&!accounts.some(account=>account.is_primary))accounts[0].is_primary=true;
      accounts.forEach((account,i)=>account.sort_order=i);
      render();
    });

    document.getElementById('flBankAccountsForm')?.addEventListener('submit',async event=>{
      event.preventDefault();if(!loaded)return;
      sync();
      const save=document.getElementById('flBankSave');save.disabled=true;save.textContent='جاري الحفظ...';
      try{
        let primarySeen=false;
        for(const [index,account] of accounts.entries()){
          account.bank_name=cleanCompact(account.bank_name);account.beneficiary_name=cleanCompact(account.beneficiary_name);account.note=cleanCompact(account.note);
          account.iban=cleanIban(account.iban);account.account_number=String(account.account_number||'').replace(/\s+/g,'');account.swift_code=String(account.swift_code||'').toUpperCase().replace(/\s+/g,'');account.sort_order=index;
          if(!account.bank_name)throw new Error(`اكتب اسم البنك للحساب رقم ${index+1}.`);
          if(!account.iban&&!account.account_number)throw new Error(`أدخل IBAN أو رقم الحساب في «${account.bank_name}».`);
          if(account.iban&&!validIban(account.iban))throw new Error(`IBAN غير صحيح في «${account.bank_name}». راجع الرقم ثم حاول مرة أخرى.`);
          if(account.is_primary){if(primarySeen)account.is_primary=false;else primarySeen=true;}
        }
        if(accounts.length&&!primarySeen)accounts[0].is_primary=true;

        const currentIds=new Set(accounts.map(account=>account.id));
        const removed=[...loadedIds].filter(id=>!currentIds.has(id));
        if(removed.length){const result=await db.from('business_bank_accounts').delete().in('id',removed);if(result.error)throw result.error;}
        if(accounts.length){
          let result=await db.from('business_bank_accounts').update({is_primary:false,updated_at:new Date().toISOString()}).eq('is_primary',true);
          if(result.error)throw result.error;
          result=await db.from('business_bank_accounts').upsert(accounts.map(account=>({...account,updated_at:new Date().toISOString()})),{onConflict:'id'});
          if(result.error)throw result.error;
        }
        loadedIds=new Set(accounts.map(account=>account.id));
        core.notify('تم حفظ الحسابات البنكية');
        await renderPage();
      }catch(e){
        core.notify('تعذر الحفظ: '+(e?.message||e));
        save.disabled=false;save.textContent='حفظ الحسابات البنكية';
      }
    });
  }

  window.FL_ADMIN_BANKS={load,cardsHtml,bind,validIban};
})();
