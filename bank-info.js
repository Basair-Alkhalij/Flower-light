// Flower Light public bank transfer information (v109)
(() => {
  'use strict';
  const container=document.getElementById('flBankAccounts');
  if(!container || new URLSearchParams(location.search).has('admin'))return;
  let pending=false;
  const formatIban=value=>String(value||'').replace(/\s+/g,'').replace(/(.{4})/g,'$1 ').trim();

  async function copyText(value,button){
    const text=String(value||'').replace(/\s+/g,'');if(!text)return;
    try{
      if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(text);
      else{
        const area=document.createElement('textarea');area.value=text;area.setAttribute('readonly','');area.style.position='fixed';area.style.opacity='0';document.body.append(area);area.select();document.execCommand('copy');area.remove();
      }
      const old=button.textContent;button.textContent='تم النسخ ✓';button.classList.add('copied');setTimeout(()=>{button.textContent=old;button.classList.remove('copied');},1500);
    }catch(_){button.textContent='تعذر النسخ';setTimeout(()=>{button.textContent='نسخ';},1500);}
  }

  function detailRow(label,value,{copy=false,iban=false}={}){
    if(!value)return null;
    const row=document.createElement('div');row.className='fl-bank-detail';
    const copyWrap=document.createElement('div');copyWrap.className='fl-bank-detail-copy';
    const title=document.createElement('span');title.className='fl-bank-detail-label';title.textContent=label;
    const text=document.createElement('strong');text.className='fl-bank-detail-value';text.textContent=iban?formatIban(value):String(value);text.dir='ltr';
    copyWrap.append(title,text);row.append(copyWrap);
    if(copy){const button=document.createElement('button');button.type='button';button.className='fl-bank-copy';button.textContent='نسخ';button.addEventListener('click',()=>copyText(value,button));row.append(button);}
    return row;
  }

  function render(rows){
    container.replaceChildren();
    const accounts=Array.isArray(rows)?rows.filter(row=>row&&row.bank_name&&(row.iban||row.account_number)):[];
    if(!accounts.length){container.hidden=true;return;}
    const toggle=document.createElement('button');toggle.type='button';toggle.className='fl-bank-toggle';toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-controls','flBankAccountsPanel');
    const left=document.createElement('span');left.className='fl-bank-toggle-left';
    const icon=document.createElement('span');icon.className='fl-bank-public-icon';icon.setAttribute('aria-hidden','true');icon.innerHTML='<svg viewBox="0 0 24 24"><path d="M3 9h18M5 9v8M9 9v8M15 9v8M19 9v8M3 20h18M12 3l9 4H3l9-4Z"></path></svg>';
    const copy=document.createElement('span');copy.className='fl-bank-toggle-copy';const title=document.createElement('strong');title.textContent='الحسابات البنكية';const sub=document.createElement('small');sub.textContent=accounts.length===1?'حساب بنكي واحد':`${accounts.length} حسابات بنكية`;copy.append(title,sub);left.append(icon,copy);
    const arrow=document.createElement('svg');arrow.className='fl-bank-toggle-arrow';arrow.setAttribute('viewBox','0 0 24 24');arrow.setAttribute('aria-hidden','true');arrow.innerHTML='<path d="m9 18 6-6-6-6"></path>';
    toggle.append(left,arrow);
    const panel=document.createElement('div');panel.className='fl-bank-panel';panel.id='flBankAccountsPanel';panel.hidden=true;
    const list=document.createElement('div');list.className='fl-bank-public-list';
    accounts.forEach(account=>{
      const card=document.createElement('article');card.className='fl-bank-public-card'+(account.is_primary?' is-primary':'');card.dataset.bankAccount=account.id||'';
      const top=document.createElement('div');top.className='fl-bank-card-title';const bank=document.createElement('strong');bank.textContent=account.bank_name;top.append(bank);
      if(account.is_primary){const badge=document.createElement('span');badge.textContent='الرئيسي';top.append(badge);}
      card.append(top);
      if(account.beneficiary_name){const beneficiary=document.createElement('div');beneficiary.className='fl-bank-beneficiary';beneficiary.innerHTML='<span>المستفيد</span>';const value=document.createElement('strong');value.textContent=account.beneficiary_name;beneficiary.append(value);card.append(beneficiary);}
      const iban=detailRow('IBAN',account.iban,{copy:true,iban:true});if(iban)card.append(iban);
      const number=detailRow('رقم الحساب',account.account_number,{copy:true});if(number)card.append(number);
      const swift=detailRow('SWIFT / BIC',account.swift_code,{copy:true});if(swift)card.append(swift);
      if(account.note){const note=document.createElement('p');note.className='fl-bank-note';note.textContent=account.note;card.append(note);}
      list.append(card);
    });
    panel.append(list);container.append(toggle,panel);container.hidden=false;
    toggle.addEventListener('click',()=>{
      const expanded=toggle.getAttribute('aria-expanded')==='true';
      toggle.setAttribute('aria-expanded',String(!expanded));
      panel.hidden=expanded;
      container.classList.toggle('is-open',!expanded);
    });
  }

  async function refresh(){
    if(pending)return;pending=true;container.hidden=true;container.replaceChildren();
    try{
      const cfg=window.FLOWER_LIGHT_SUPABASE;
      const response=await fetch(`${cfg.url}/rest/v1/rpc/get_public_bank_accounts`,{method:'POST',headers:{apikey:cfg.anonKey,'Content-Type':'application/json'},body:'{}',cache:'no-store'});
      if(!response.ok)throw new Error('Bank accounts unavailable');
      render(await response.json());
    }catch(_){container.hidden=true;}
    finally{pending=false;}
  }
  void refresh();window.addEventListener('pageshow',()=>void refresh());
})();
