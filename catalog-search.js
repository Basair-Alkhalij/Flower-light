// Flower Light / Basair Gulf — global catalog search + dynamic filters
(() => {
  'use strict';

  function normalize(text) {
    return String(text || '').toLowerCase()
      .replace(/[\u064B-\u0652]/g, '').replace(/[إأآا]/g, 'ا')
      .replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/\s+/g, ' ').trim();
  }

  function filterTokens(value, unit) {
    const text=String(value||'').trim();
    if(!text) return [];
    const numbers=text.match(/\d+(?:[.,]\d+)?/g);
    if(numbers?.length) return [...new Set(numbers.map(raw=>{
      const n=Number(raw.replace(',','.'));
      return `${Number.isFinite(n)?n:raw}${unit}`;
    }))];
    return [...new Set(text.split(/[/|,،]+/).map(v=>v.trim()).filter(Boolean))];
  }

  function init() {
    const input=document.getElementById('catalogSearchInput');
    const countLabel=document.getElementById('catalogSearchCount');
    const tabsHost=document.querySelector('.catalog-tabs');
    const sheet=document.querySelector('.catalog-sheet');
    if(!input||!countLabel||!tabsHost||!sheet) return;

    const searchWrap=input.closest('.catalog-search-wrap');
    const filterWrap=document.createElement('div');
    filterWrap.id='catalogFilterWrap';
    filterWrap.className='catalog-search-wrap';
    filterWrap.dir='rtl';
    Object.assign(filterWrap.style,{flexWrap:'wrap',alignItems:'center'});
    searchWrap?.insertAdjacentElement('afterend',filterWrap);

    function makeSelect(id,allLabel,ariaLabel){
      const select=document.createElement('select');
      select.id=id;select.className='catalog-search-input';select.setAttribute('aria-label',ariaLabel);
      Object.assign(select.style,{flex:'1 1 150px',maxWidth:'240px'});
      const option=document.createElement('option');option.value='';option.textContent=allLabel;select.appendChild(option);
      filterWrap.appendChild(select);
      return select;
    }

    const availabilityFilter=makeSelect('catalogAvailabilityFilter','كل حالات التوفر','فلترة حسب حالة التوفر');
    [['available','متوفر'],['out_of_stock','نفد'],['coming_soon','قريبًا']].forEach(([value,label])=>{
      const option=document.createElement('option');option.value=value;option.textContent=label;availabilityFilter.appendChild(option);
    });
    const wattageFilter=makeSelect('catalogWattageFilter','كل القدرات','فلترة حسب القدرة');
    const cctFilter=makeSelect('catalogCctFilter','كل درجات اللون','فلترة حسب حرارة اللون');
    const clearButton=document.createElement('button');
    clearButton.id='catalogFilterClear';clearButton.type='button';clearButton.className='catalog-download';
    clearButton.textContent='مسح الفلاتر';clearButton.style.display='none';filterWrap.appendChild(clearButton);

    function productPanels(){return Array.from(sheet.querySelectorAll('.extra-section-panel'));}
    function tabForPanel(panel){return Array.from(tabsHost.querySelectorAll('.extra-section-tab')).find(tab=>tab.dataset.target===panel.id)||null;}
    function sectionName(panel){return tabForPanel(panel)?.querySelector('strong')?.textContent?.trim()||'قسم';}
    function cardTokens(card,kind){return filterTokens(kind==='wattage'?card.dataset.filterWattage:card.dataset.filterCct,kind==='wattage'?'W':'K');}

    function setDynamicOptions(select,values,allLabel){
      const previous=select.value;
      select.replaceChildren();
      const all=document.createElement('option');all.value='';all.textContent=allLabel;select.appendChild(all);
      values.forEach(value=>{const option=document.createElement('option');option.value=value;option.textContent=value;select.appendChild(option);});
      select.value=values.includes(previous)?previous:'';
      select.style.display=values.length?'':'none';
    }

    function syncDynamicOptions(){
      const cards=productPanels().flatMap(panel=>Array.from(panel.querySelectorAll('.chandelier-card')));
      const sortValues=values=>[...values].sort((a,b)=>{
        const an=parseFloat(a),bn=parseFloat(b);
        return Number.isFinite(an)&&Number.isFinite(bn)?an-bn:a.localeCompare(b,'ar');
      });
      const watts=new Set(),ccts=new Set();
      cards.forEach(card=>{cardTokens(card,'wattage').forEach(v=>watts.add(v));cardTokens(card,'cct').forEach(v=>ccts.add(v));});
      setDynamicOptions(wattageFilter,sortValues(watts),'كل القدرات');
      setDynamicOptions(cctFilter,sortValues(ccts),'كل درجات اللون');
      filterWrap.style.display=cards.length?'flex':'none';
    }

    function clearSectionMarker(card){
      card.querySelector('.catalog-search-section-label')?.remove();
      const caption=card.querySelector('figcaption[data-search-created-caption="1"]');
      if(caption&&!caption.childElementCount&&!caption.textContent.trim()) caption.remove();
    }

    function showSectionMarker(card,name){
      let caption=card.querySelector('figcaption.product-card-info');
      if(!caption){
        caption=document.createElement('figcaption');caption.className='product-card-info';caption.dataset.searchCreatedCaption='1';
        card.insertBefore(caption,card.children[1]||null);
      }
      let row=caption.querySelector('.catalog-search-section-label');
      if(!row){
        row=document.createElement('div');row.className='product-code-row catalog-search-section-label';
        const label=document.createElement('span');label.textContent='القسم';
        const value=document.createElement('strong');row.append(label,value);caption.prepend(row);
      }
      row.querySelector('strong').textContent=name;
    }

    function resetView(){
      tabsHost.querySelectorAll('.catalog-tab').forEach(tab=>tab.classList.remove('catalog-search-hidden'));
      productPanels().forEach(panel=>panel.querySelectorAll('.chandelier-card').forEach(card=>{
        card.classList.remove('catalog-search-hidden');clearSectionMarker(card);
      }));
    }

    function activateTab(tab){if(tab&&!tab.classList.contains('active')) tab.click();}

    function applyFilter(){
      const panels=productPanels();
      const query=normalize(input.value);
      const availability=availabilityFilter.value;
      const wattage=wattageFilter.value;
      const cct=cctFilter.value;
      const filterActive=Boolean(availability||wattage||cct);
      const active=Boolean(query||filterActive);
      const hasProducts=panels.length>0;

      input.disabled=!hasProducts;
      input.placeholder=hasProducts?'ابحث في جميع الأقسام (الاسم أو الكود أو المواصفات)…':'لا توجد أقسام منتجات قابلة للبحث';
      clearButton.style.display=filterActive?'inline-flex':'none';

      if(!hasProducts){countLabel.hidden=true;return;}
      if(!active){resetView();countLabel.hidden=true;return;}

      let totalMatches=0,matchingSections=0,firstMatchingTab=null;
      tabsHost.querySelectorAll('.site-catalog-tab').forEach(tab=>tab.classList.add('catalog-search-hidden'));

      panels.forEach(panel=>{
        const tab=tabForPanel(panel),name=sectionName(panel);
        let sectionMatches=0;
        panel.querySelectorAll('.chandelier-card').forEach(card=>{
          const searchable=normalize([card.dataset.productName,card.dataset.productModel,card.textContent,name].join(' '));
          const matchQuery=!query||searchable.includes(query);
          const matchAvailability=!availability||card.dataset.availability===availability;
          const matchWattage=!wattage||cardTokens(card,'wattage').includes(wattage);
          const matchCct=!cct||cardTokens(card,'cct').includes(cct);
          const match=matchQuery&&matchAvailability&&matchWattage&&matchCct;
          card.classList.toggle('catalog-search-hidden',!match);
          if(match){sectionMatches++;totalMatches++;showSectionMarker(card,name);}else clearSectionMarker(card);
        });
        if(tab){
          tab.classList.toggle('catalog-search-hidden',sectionMatches===0);
          if(sectionMatches&&!firstMatchingTab) firstMatchingTab=tab;
        }
        if(sectionMatches) matchingSections++;
      });

      const activeTab=tabsHost.querySelector('.catalog-tab.active');
      if(totalMatches>0&&(!activeTab||activeTab.classList.contains('catalog-search-hidden'))) activateTab(firstMatchingTab);
      else if(totalMatches===0&&activeTab?.classList.contains('site-catalog-tab')) activateTab(tabsHost.querySelector('.extra-section-tab'));

      countLabel.hidden=false;
      countLabel.textContent=totalMatches?`${totalMatches} نتيجة · ${matchingSections} قسم`:'لا توجد نتائج مطابقة للبحث والفلاتر';
    }

    let debounceTimer=0;
    input.addEventListener('input',()=>{window.clearTimeout(debounceTimer);debounceTimer=window.setTimeout(applyFilter,120);});
    [availabilityFilter,wattageFilter,cctFilter].forEach(select=>select.addEventListener('change',applyFilter));
    clearButton.addEventListener('click',()=>{availabilityFilter.value='';wattageFilter.value='';cctFilter.value='';applyFilter();});

    tabsHost.addEventListener('click',event=>{
      if(event.target.closest('.catalog-tab')&&(input.value||availabilityFilter.value||wattageFilter.value||cctFilter.value)) window.setTimeout(applyFilter,0);
    });

    const observer=new MutationObserver(()=>{
      input.value='';availabilityFilter.value='';wattageFilter.value='';cctFilter.value='';
      syncDynamicOptions();applyFilter();
    });
    observer.observe(tabsHost,{childList:true});

    syncDynamicOptions();applyFilter();
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init);
  else init();
})();
