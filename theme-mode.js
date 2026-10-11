/* Visitor theme selection. Default follows system; manual choice persists locally. */
(()=>{
  'use strict';
  const key='flowerlight:public-theme';
  const darkLink=document.getElementById('flDarkThemeCss');
  const meta=document.getElementById('flThemeColor');
  const valid=new Set(['auto','light','dark']);
  const system=window.matchMedia('(prefers-color-scheme: dark)');
  let choice='auto';
  try{const saved=localStorage.getItem(key);if(valid.has(saved))choice=saved;}catch{}
  const effective=()=>choice==='auto'?(system.matches?'dark':'light'):choice;
  const apply=()=>{
    const resolved=effective();
    darkLink.media=choice==='auto'?'(prefers-color-scheme: dark)':(choice==='dark'?'all':'not all');
    document.documentElement.style.colorScheme=resolved;
    if(meta)meta.content=resolved==='dark'?'#111827':'#ff9f0a';
    const button=document.getElementById('flThemeSwitch');
    if(button){
      const labels={auto:'تلقائي',light:'فاتح',dark:'داكن'};
      button.setAttribute('aria-label','مظهر الموقع: '+labels[choice]+'، اضغط للتغيير');
      button.title='مظهر الموقع: '+labels[choice];
      const label=button.querySelector('[data-theme-label]');if(label)label.textContent=labels[choice];
    }
  };
  apply();
  system.addEventListener?.('change',()=>{if(choice==='auto')apply();});
  document.addEventListener('DOMContentLoaded',()=>{
    const button=document.getElementById('flThemeSwitch');
    button?.addEventListener('click',()=>{
      choice=choice==='auto'?'light':choice==='light'?'dark':'auto';
      try{if(choice==='auto')localStorage.removeItem(key);else localStorage.setItem(key,choice);}catch{}
      apply();
    });
    apply();
  });
})();
