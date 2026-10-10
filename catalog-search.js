// Flower Light / Basair Gulf — global catalog search + owner-selected dependent filters
(() => {
  'use strict';

  const DEFAULT_FILTERS=['availability','wattage','cct'];
  const BASE_FILTER_DEFS={
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
  function filterDefinitions(){
    const defs={...BASE_FILTER_DEFS};
    const custom=window.FLOWER_LIGHT_SITE_SETTINGS?.catalog_custom_filters;
    if(Array.isArray(custom))custom.forEach(row=>{
      const key=String(row?.key||'').trim(),label=String(row?.label||'').trim();
      if(/^custom_filter_[a-z0-9]+$/i.test(key)&&label&&!defs[key])defs[key]={label,all:`كل ${label}`};
    });
    return defs;
  }
  function selectedFilterKeys(){
    const defs=filterDefinitions();
    const raw=window.FLOWER_LIGHT_SITE_SETTINGS?.catalog_filter_keys;
    const keys=Array.isArray(raw)?raw:DEFAULT_FILTERS;
    return [...new Set(keys.map(String).filter(key=>defs[key]))];
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
    function allCards(){return productPanels().flatMap(panel=>Array.from(panel.querySelectorAll('.chandelier-card')));}
    function tabForPanel(panel){return Array.from(tabsHost.querySelectorAll('.extra-section-tab')).find(tab=>tab.dataset.target===panel.id)||null;}
    function sectionName(panel){return tabForPanel(panel)?.querySelector('strong')?.textContent?.trim()||'قسم';}
    function cardSpecs(card){try{return JSON.parse(card.dataset.filterSpecs||'{}')||{};}catch(_){return{};}}
    function cardValues(card,key){
      if(key==='availability')return[String(card.dataset.availability||'')].filter(Boolean);
      const def=filterDefinitions()[key];return valueTokens(cardSpecs(card)[key],def?.unit||'');
    }
    function cardMatchesSearch(card){
      const panel=card.closest('.extra-section-panel'),name=panel?sectionName(panel):'';
      const query=normalize(input.value);
      return !query||normalize([card.dataset.productName,card.dataset.productModel,card.textContent,name].join(' ')).includes(query);
    }
    function cardMatchesFilters(card,exceptKey=''){
      for(const [key,select] of filterControls){
        if(key===exceptKey||!select.value)continue;
        if(!cardValues(card,key).includes(select.value))return false;
      }
      return true;
    }
    function sortedValues(values){
      return [...values].sort((a,b)=>{const an=parseFloat(a),bn=parseFloat(b);return Number.isFinite(an)&&Number.isFinite(bn)?an-bn:a.localeCompare(b,'ar');});
    }
    function choicesFor(key,def,cards,current=''){
      const possible=new Set();
      cards.filter(card=>cardMatchesSearch(card)&&cardMatchesFilters(card,key)).forEach(card=>cardValues(card,key).forEach(value=>possible.add(value)));
      let rows=def.fixed?def.fixed.filter(([value])=>possible.has(value)||value===current):sortedValues(possible).map(value=>[value,value]);
      if(current&&!rows.some(([value])=>value===current)){
        const fixedLabel=def.fixed?.find(([value])=>value===current)?.[1]||current;
        rows=[...rows,[current,fixedLabel]];
      }
      return rows;
    }
    function setOptions(select,def,rows,current){
      select.replaceChildren();
      const all=document.createElement('option');all.value='';all.textContent=def.all;select.appendChild(all);
      rows.forEach(([value,label])=>{const option=document.createElement('option');option.value=value;option.textContent=label;select.appendChild(option);});
      select.value=rows.some(([value])=>value===current)?current:'';
      select.style.display=def.fixed||rows.length?'':'none';
    }
    function syncDependentOptions(){
      const defs=filterDefinitions(),cards=allCards();
      for(const [key,select] of filterControls){
        const def=defs[key];if(!def)continue;
        const current=select.value;
        setOptions(select,def,choicesFor(key,def,cards,current),current);
      }
    }

    function buildFilters(){
      const previous=new Map([...filterControls].map(([key,select])=>[key,select.value]));
      filterControls=new Map();filterWrap.replaceChildren();
      const defs=filterDefinitions(),keys=selectedFilterKeys(),cards=allCards();
      keys.forEach(key=>{
        const def=defs[key],select=document.createElement('select');
        select.id=`catalogFilter_${key}`;select.className='catalog-search-input';select.setAttribute('aria-label',`فلترة حسب ${def.label}`);
        Object.assign(select.style,{flex:'1 1 150px',maxWidth:'240px'});
        filterControls.set(key,select);filterWrap.appendChild(select);
        setOptions(select,def,choicesFor(key,def,cards,previous.get(key)||''),previous.get(key)||'');
        select.addEventListener('change',applyFilter);
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
    function syncClearButton(){const clear=document.getElementById('catalogFilterClear');if(clear)clear.style.display=filtersActive()?'inline-flex':'none';}

    function applyFilter(){
      const panels=productPanels(),query=normalize(input.value),active=Boolean(query||filtersActive()),hasProducts=panels.length>0;
      input.disabled=!hasProducts;input.placeholder=hasProducts?'ابحث في جميع الأقسام (الاسم أو الكود أو المواصفات)…':'لا توجد أقسام منتجات قابلة للبحث';
      syncDependentOptions();syncClearButton();
      if(!hasProducts){countLabel.hidden=true;return;}
      if(!active){resetView();countLabel.hidden=true;return;}

      let totalMatches=0,matchingSections=0,firstMatchingTab=null;
      tabsHost.querySelectorAll('.site-catalog-tab').forEach(tab=>tab.classList.add('catalog-search-hidden'));
      panels.forEach(panel=>{
        const tab=tabForPanel(panel),name=sectionName(panel);let sectionMatches=0;
        panel.querySelectorAll('.chandelier-card').forEach(card=>{
          const match=cardMatchesSearch(card)&&cardMatchesFilters(card);
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
