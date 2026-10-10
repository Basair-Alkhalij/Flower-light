// Flower Light / Basair Gulf — global catalog search + owner-selected filters
(() => {
  'use strict';

  const DEFAULT_FILTERS=['availability','wattage','cct'];
  const FILTER_DEFS={
    availability:{label:'حالة التوفر',all:'كل حالات التوفر',fixed:[['available','متوفر'],['out_of_stock','نفد'],['coming_soon','قريبًا']]},
    sku:{label:'كود المنتج',all:'كل الأكواد'},
    wattage:{label:'القدرة',all:'كل القدرات',unit:'W'},
    lumens:{label:'اللومن',all:'كل قيم اللومن',unit:'lm'},
    cct:{label:'حرارة اللون',all:'كل درجات اللون',unit:'K'},
    cri:{label:'CRI',all:'كل قيم CRI'},
    voltage:{label:'الفولت',all:'كل قيم الفولت',unit:'V'},
    ip_rating:{label:'درجة الحماية IP',all:'كل درجات الحماية'},
    dimensions:{label:'المقاس / الأبعاد',all:'كل المقاسات'},
    color:{label:'اللون',all:'كل الألوان'},
    material:{label:'الخامة',all:'كل الخامات'},
    beam_angle:{label:'زاوية الإضاءة',all:'كل الزوايا',unit:'°'},
    frequency:{label:'التردد',all:'كل الترددات',unit:'Hz'},
    warranty:{label:'الضمان',all:'كل مدد الضمان'},
    bulb_base:{label:'قاعدة اللمبة',all:'كل القواعد'},
    bulb_count:{label:'عدد اللمبات',all:'كل الأعداد'}
  };

  function normalize(text){
    return String(text||'').toLowerCase().replace(/[\u064B-\u0652]/g,'').replace(/[إأآا]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/\s+/g,' ').trim();
  }
  function valueTokens(value,unit=''){
    const text=String(value||'').trim();if(!text)return[];
    if(unit){
      const numbers=text.match(/\d+(?:[.,]\d+)?/g);
      if(numbers?.length)return[...new Set(numbers.map(raw=>{const n=Number(raw.replace(',','.'));return`${Number.isFinite(n)?n:raw}${unit}`;}))];
    }
    return [...new Set(text.split(/[/|,،]+/).map(v=>v.trim()).filter(Boolean))];
  }
  function selectedFilterKeys(){
    const raw=window.FLOWER_LIGHT_SITE_SETTINGS?.catalog_filter_keys;
    const keys=Array.isArray(raw)?raw:DEFAULT_FILTERS;
    return [...new Set(keys.map(String).filter(key=>FILTER_DEFS[key]))];
  }

  function init(){
    const input=document.getElementById('catalogSearchInput');
    const countLabel=document.getElementById('catalogSearchCount');
    const tabsHost=document.querySelector('.catalog-tabs');
    const sheet=document.querySelector('.catalog-sheet');
    if(!input||!countLabel||!tabsHost||!sheet)return;

    const searchWrap=input.closest('.catalog-search-wrap');
    const filterWrap=document.createElement('div');
    filterWrap.id='catalogFilterWrap';filterWrap.className='catalog-search-wrap';filterWrap.dir='rtl';
    Object.assign(filterWrap.style,{flexWrap:'wrap',alignItems:'center'});
    searchWrap?.insertAdjacentElement('afterend',filterWrap);

    let filterControls=new Map();

    function productPanels(){return Array.from(sheet.querySelectorAll('.extra-section-panel'));}
    function tabForPanel(panel){return Array.from(tabsHost.querySelectorAll('.extra-section-tab')).find(tab=>tab.dataset.target===panel.id)||null;}
    function sectionName(panel){return tabForPanel(panel)?.querySelector('strong')?.textContent?.trim()||'قسم';}
    function cardSpecs(card){try{return JSON.parse(card.dataset.filterSpecs||'{}')||{};}catch(_){return{};}}
    function cardValues(card,key){
      if(key==='availability')return [String(card.dataset.availability||'')].filter(Boolean);
      const def=FILTER_DEFS[key];return valueTokens(cardSpecs(card)[key],def?.unit||'');
    }

    function buildFilters(){
      const previous=new Map([...filterControls].map(([key,select])=>[key,select.value]));
      filterControls=new Map();filterWrap.replaceChildren();
      const cards=productPanels().flatMap(panel=>Array.from(panel.querySelectorAll('.chandelier-card')));
      const keys=selectedFilterKeys();

      keys.forEach(key=>{
        const def=FILTER_DEFS[key],select=document.createElement('select');
        select.id=`catalogFilter_${key}`;select.className='catalog-search-input';select.setAttribute('aria-label',`فلترة حسب ${def.label}`);
        Object.assign(select.style,{flex:'1 1 150px',maxWidth:'240px'});
        const all=document.createElement('option');all.value='';all.textContent=def.all;select.appendChild(all);
        let values=[];
        if(def.fixed) values=def.fixed;
        else{
          const set=new Set();cards.forEach(card=>cardValues(card,key).forEach(value=>set.add(value)));
          values=[...set].sort((a,b)=>{const an=parseFloat(a),bn=parseFloat(b);return Number.isFinite(an)&&Number.isFinite(bn)?an-bn:a.localeCompare(b,'ar');}).map(v=>[v,v]);
        }
        values.forEach(([value,label])=>{const option=document.createElement('option');option.value=value;option.textContent=label;select.appendChild(option);});
        select.value=values.some(([value])=>value===previous.get(key))?previous.get(key):'';
        if(!def.fixed&&!values.length)select.style.display='none';
        select.addEventListener('change',applyFilter);filterControls.set(key,select);filterWrap.appendChild(select);
      });

      const clear=document.createElement('button');clear.id='catalogFilterClear';clear.type='button';clear.className='catalog-download';clear.textContent='مسح الفلاتر';
      clear.addEventListener('click',()=>{filterControls.forEach(select=>{select.value='';});applyFilter();});
      filterWrap.appendChild(clear);
      filterWrap.style.display=keys.length&&cards.length?'flex':'none';
      syncClearButton();
    }

    function clearSectionMarker(card){
      card.querySelector('.catalog-search-section-label')?.remove();
      const caption=card.querySelector('figcaption[data-search-created-caption="1"]');
      if(caption&&!caption.childElementCount&&!caption.textContent.trim())caption.remove();
    }
    function showSectionMarker(card,name){
      let caption=card.querySelector('figcaption.product-card-info');
      if(!caption){caption=document.createElement('figcaption');caption.className='product-card-info';caption.dataset.searchCreatedCaption='1';card.insertBefore(caption,card.children[1]||null);}
      let row=caption.querySelector('.catalog-search-section-label');
      if(!row){row=document.createElement('div');row.className='product-code-row catalog-search-section-label';const label=document.createElement('span');label.textContent='القسم';const value=document.createElement('strong');row.append(label,value);caption.prepend(row);}
      row.querySelector('strong').textContent=name;
    }
    function resetView(){
      tabsHost.querySelectorAll('.catalog-tab').forEach(tab=>tab.classList.remove('catalog-search-hidden'));
      productPanels().forEach(panel=>panel.querySelectorAll('.chandelier-card').forEach(card=>{card.classList.remove('catalog-search-hidden');clearSectionMarker(card);}));
    }
    function activateTab(tab){if(tab&&!tab.classList.contains('active'))tab.click();}
    function filtersActive(){return[...filterControls.values()].some(select=>select.value);}
    function syncClearButton(){
      const clear=document.getElementById('catalogFilterClear');if(clear)clear.style.display=filtersActive()?'inline-flex':'none';
    }
    function cardMatchesFilters(card){
      for(const [key,select] of filterControls){if(select.value&&!cardValues(card,key).includes(select.value))return false;}
      return true;
    }

    function applyFilter(){
      const panels=productPanels(),query=normalize(input.value),active=Boolean(query||filtersActive()),hasProducts=panels.length>0;
      input.disabled=!hasProducts;input.placeholder=hasProducts?'ابحث في جميع الأقسام (الاسم أو الكود أو المواصفات)…':'لا توجد أقسام منتجات قابلة للبحث';syncClearButton();
      if(!hasProducts){countLabel.hidden=true;return;}
      if(!active){resetView();countLabel.hidden=true;return;}

      let totalMatches=0,matchingSections=0,firstMatchingTab=null;
      tabsHost.querySelectorAll('.site-catalog-tab').forEach(tab=>tab.classList.add('catalog-search-hidden'));
      panels.forEach(panel=>{
        const tab=tabForPanel(panel),name=sectionName(panel);let sectionMatches=0;
        panel.querySelectorAll('.chandelier-card').forEach(card=>{
          const searchable=normalize([card.dataset.productName,card.dataset.productModel,card.textContent,name].join(' '));
          const match=(!query||searchable.includes(query))&&cardMatchesFilters(card);
          card.classList.toggle('catalog-search-hidden',!match);
          if(match){sectionMatches++;totalMatches++;showSectionMarker(card,name);}else clearSectionMarker(card);
        });
        if(tab){tab.classList.toggle('catalog-search-hidden',sectionMatches===0);if(sectionMatches&&!firstMatchingTab)firstMatchingTab=tab;}
        if(sectionMatches)matchingSections++;
      });
      const activeTab=tabsHost.querySelector('.catalog-tab.active');
      if(totalMatches>0&&(!activeTab||activeTab.classList.contains('catalog-search-hidden')))activateTab(firstMatchingTab);
      else if(totalMatches===0&&activeTab?.classList.contains('site-catalog-tab'))activateTab(tabsHost.querySelector('.extra-section-tab'));
      countLabel.hidden=false;countLabel.textContent=totalMatches?`${totalMatches} نتيجة · ${matchingSections} قسم`:'لا توجد نتائج مطابقة للبحث والفلاتر';
    }

    let debounceTimer=0;
    input.addEventListener('input',()=>{window.clearTimeout(debounceTimer);debounceTimer=window.setTimeout(applyFilter,120);});
    tabsHost.addEventListener('click',event=>{if(event.target.closest('.catalog-tab')&&(input.value||filtersActive()))window.setTimeout(applyFilter,0);});
    const observer=new MutationObserver(()=>{input.value='';buildFilters();applyFilter();});
    observer.observe(tabsHost,{childList:true});
    window.addEventListener('flowerlight:site-settings',()=>{buildFilters();applyFilter();});

    buildFilters();applyFilter();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
