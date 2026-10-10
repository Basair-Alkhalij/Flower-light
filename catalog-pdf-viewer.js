// Flower Light standalone lazy PDF catalog viewer.
(() => {
  'use strict';

  const PDFJS_CDN='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
  const PDFJS_SRI='sha384-/1qUCSGwTur9vjf/z9lmu/eCUYbpOTgSjmpbMQZ1/CtX2v/WcAIKqRv+U1DUCG6e';
  const PDFJS_WORKER='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  let pdfJsPromise=null;

  function loadPdfJs(){
    if(window.pdfjsLib?.getDocument){window.pdfjsLib.GlobalWorkerOptions.workerSrc=PDFJS_WORKER;return Promise.resolve(window.pdfjsLib);}
    if(pdfJsPromise) return pdfJsPromise;
    pdfJsPromise=new Promise((resolve,reject)=>{
      const existing=document.querySelector('script[data-fl-pdfjs]');
      const finish=()=>{if(!window.pdfjsLib?.getDocument){reject(new Error('PDF.js غير متاح'));return;}window.pdfjsLib.GlobalWorkerOptions.workerSrc=PDFJS_WORKER;resolve(window.pdfjsLib);};
      if(existing){existing.addEventListener('load',finish,{once:true});existing.addEventListener('error',()=>reject(new Error('تعذر تحميل قارئ PDF')),{once:true});return;}
      const script=document.createElement('script');script.src=PDFJS_CDN;script.async=true;script.dataset.flPdfjs='1';script.integrity=PDFJS_SRI;script.crossOrigin='anonymous';script.referrerPolicy='no-referrer';script.addEventListener('load',finish,{once:true});script.addEventListener('error',()=>reject(new Error('تعذر تحميل قارئ PDF')),{once:true});document.head.appendChild(script);
    }).catch(error=>{pdfJsPromise=null;throw error;});
    return pdfJsPromise;
  }

  let siteCatalogRenderSequence=0;

  function disposeSiteCatalogRenderer(pages,{destroyPdf=true}={}){
    const state=pages?._flCatalogState;
    if(!state) return;
    state.cancelled=true;
    state.observer?.disconnect?.();
    if(Array.isArray(state.cleanupFns)){
      state.cleanupFns.forEach(fn=>{try{fn?.();}catch{}});
      state.cleanupFns.length=0;
    }
    if(Array.isArray(state.queue)) state.queue.length=0;
    state.queued?.clear?.();
    if(destroyPdf){
      try{state.pdf?.cleanup?.();}catch{}
      try{state.pdf?.destroy?.();}catch{}
    }
    pages._flCatalogState=null;
  }

  async function renderSiteCatalogPages(panel,url){
    const pages=panel?.querySelector('.site-catalog-pages');
    if(!pages||!url) return;
    const existingState=pages._flCatalogState;
    if(existingState&&!existingState.cancelled&&existingState.url===url) return;
    if(pages.dataset.loading==='1') return;

    disposeSiteCatalogRenderer(pages);
    pages.dataset.loading='1';
    pages.dataset.renderedUrl='';
    pages.innerHTML='<div class="site-catalog-loading"><strong>جاري فتح الكتالوج…</strong><small>سنحمّل أول صفحتين الآن، وباقي الصفحات عند الوصول إليها لتسريع التصفح.</small></div>';

    try{
      const pdfjs=await loadPdfJs();
      const loadingTask=pdfjs.getDocument({
        url,
        cMapUrl:'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
        cMapPacked:true,
        standardFontDataUrl:'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/standard_fonts/',
        useSystemFonts:true,
        disableFontFace:false
      });
      const pdf=await loadingTask.promise;
      const state={
        id:++siteCatalogRenderSequence,
        url,
        pdf,
        cancelled:false,
        queue:[],
        queued:new Set(),
        rendering:new Set(),
        rendered:new Set(),
        cleanupFns:[],
        observer:null,
        active:0,
        total:pdf.numPages,
        maxConcurrent:window.matchMedia?.('(max-width: 700px)').matches?1:2
      };
      pages._flCatalogState=state;
      pages.dataset.renderedUrl=url;
      pages.innerHTML='';

      let defaultAspect='210 / 297';
      try{
        const firstPage=await pdf.getPage(1);
        const firstViewport=firstPage.getViewport({scale:1});
        if(firstViewport?.width&&firstViewport?.height) defaultAspect=`${firstViewport.width} / ${firstViewport.height}`;
        firstPage.cleanup?.();
      }catch{}

      const status=document.createElement('div');
      status.className='site-catalog-lazy-status';
      status.innerHTML=`<strong>${pdf.numPages} صفحة</strong><small>تحميل ذكي: الصفحات تُجهّز فقط عند اقترابك منها.</small>`;
      pages.appendChild(status);

      for(let number=1;number<=pdf.numPages;number+=1){
        const card=document.createElement('article');
        card.className='site-catalog-page';
        card.dataset.pageNumber=String(number);
        card.dataset.rendered='0';
        card.setAttribute('aria-label',`صفحة ${number} من ${pdf.numPages}`);
        const placeholder=document.createElement('div');
        placeholder.className='site-catalog-page-placeholder';
        placeholder.style.aspectRatio=defaultAspect;
        placeholder.innerHTML=`<span>${number<=2?`جاري تجهيز الصفحة ${number}…`:`الصفحة ${number} — سيتم تحميلها عند الوصول`}</span>`;
        card.appendChild(placeholder);
        pages.appendChild(card);
      }

      const updateStatus=()=>{
        if(state.cancelled||!status.isConnected) return;
        const count=state.rendered.size;
        const small=status.querySelector('small');
        const strong=status.querySelector('strong');
        if(strong) strong.textContent=`${pdf.numPages} صفحة`;
        if(small){
          small.textContent=count>=pdf.numPages
            ?'تم تجهيز جميع الصفحات.'
            :`تم تجهيز ${count} من ${pdf.numPages} — باقي الصفحات تُحمّل تلقائيًا عند الاقتراب منها.`;
        }
      };

      const renderOne=async(number,card)=>{
        if(state.cancelled||!card?.isConnected||card.dataset.rendered==='1') return;
        state.rendering.add(number);
        card.dataset.rendering='1';
        const placeholder=card.querySelector('.site-catalog-page-placeholder');
        if(placeholder) placeholder.innerHTML=`<span>جاري تجهيز الصفحة ${number}…</span>`;
        let page=null;
        let canvas=null;
        try{
          page=await pdf.getPage(number);
          if(state.cancelled||!card.isConnected) return;
          const base=page.getViewport({scale:1});
          if(placeholder&&base?.width&&base?.height) placeholder.style.aspectRatio=`${base.width} / ${base.height}`;

          const cssWidth=Math.max(280,Math.min(980,card.clientWidth||panel.clientWidth||window.innerWidth||980));
          const cssScale=cssWidth/base.width;
          const mobile=window.matchMedia?.('(max-width: 700px)').matches;
          const deviceDpr=Math.max(1,window.devicePixelRatio||1);
          const targetDpr=mobile?Math.min(1.35,deviceDpr):Math.min(1.55,Math.max(1.05,deviceDpr));
          let renderScale=cssScale*targetDpr;
          let viewport=page.getViewport({scale:renderScale});
          const pixelCap=mobile?2200000:4800000;
          const pixels=viewport.width*viewport.height;
          if(pixels>pixelCap){
            renderScale*=Math.sqrt(pixelCap/pixels);
            viewport=page.getViewport({scale:renderScale});
          }

          canvas=document.createElement('canvas');
          canvas.width=Math.max(1,Math.ceil(viewport.width));
          canvas.height=Math.max(1,Math.ceil(viewport.height));
          const ctx=canvas.getContext('2d',{alpha:false});
          ctx.fillStyle='#fff';
          ctx.fillRect(0,0,canvas.width,canvas.height);
          await page.render({canvasContext:ctx,viewport,background:'#ffffff'}).promise;
          if(state.cancelled||!card.isConnected) return;

          const blob=await new Promise((resolve,reject)=>{
            canvas.toBlob(value=>value?resolve(value):reject(new Error('تعذر إنشاء صورة الصفحة')),'image/jpeg',0.90);
          });
          if(state.cancelled||!card.isConnected) return;
          const objectUrl=URL.createObjectURL(blob);
          const img=document.createElement('img');
          img.className='site-catalog-page-image';
          img.alt=`صفحة ${number} من الكتالوج`;
          img.loading='eager';
          img.decoding='async';
          img.src=objectUrl;
          const releaseUrl=()=>URL.revokeObjectURL(objectUrl);
          img.addEventListener('load',releaseUrl,{once:true});
          img.addEventListener('error',releaseUrl,{once:true});
          card.replaceChildren(img);
          card.dataset.rendered='1';
          card.dataset.rendering='0';
          state.rendered.add(number);
          state.observer?.unobserve?.(card);
          updateStatus();
          if(state.rendered.size>=state.total){
            state.observer?.disconnect?.();
            try{pdf.cleanup?.();}catch{}
          }
        }catch(error){
          if(!state.cancelled&&card?.isConnected){
            console.warn(`[Site catalog PDF] page ${number} render failed`,error);
            card.dataset.rendering='0';
            card.innerHTML=`<button class="site-catalog-page-retry" type="button"><strong>تعذر تجهيز الصفحة ${number}</strong><small>اضغط لإعادة المحاولة</small></button>`;
            card.querySelector('button')?.addEventListener('click',()=>{
              card.dataset.rendered='0';
              card.innerHTML=`<div class="site-catalog-page-placeholder" style="aspect-ratio:${defaultAspect}"><span>جاري إعادة تجهيز الصفحة ${number}…</span></div>`;
              enqueue(number,true);
            },{once:true});
          }
        }finally{
          if(canvas){canvas.width=1;canvas.height=1;}
          try{page?.cleanup?.();}catch{}
          state.rendering.delete(number);
        }
      };

      const pump=()=>{
        if(state.cancelled) return;
        while(state.active<state.maxConcurrent&&state.queue.length){
          const number=state.queue.shift();
          state.queued.delete(number);
          if(state.rendered.has(number)||state.rendering.has(number)) continue;
          const card=pages.querySelector(`.site-catalog-page[data-page-number="${number}"]`);
          if(!card||!card.isConnected) continue;
          state.active+=1;
          renderOne(number,card).finally(()=>{
            state.active=Math.max(0,state.active-1);
            pump();
          });
        }
      };

      function enqueue(number,priority=false){
        if(state.cancelled||number<1||number>state.total||state.rendered.has(number)||state.rendering.has(number)||state.queued.has(number)) return;
        state.queued.add(number);
        if(priority) state.queue.unshift(number); else state.queue.push(number);
        pump();
      }

      const cards=[...pages.querySelectorAll('.site-catalog-page')];
      if('IntersectionObserver' in window){
        state.observer=new IntersectionObserver(entries=>{
          entries.forEach(entry=>{
            if(!entry.isIntersecting) return;
            const number=Number(entry.target.dataset.pageNumber||0);
            enqueue(number,false);
          });
        },{root:null,rootMargin:'1600px 0px 1600px 0px',threshold:0.01});
        cards.forEach(card=>state.observer.observe(card));
      }else{
        let ticking=false;
        const scanNearby=()=>{
          ticking=false;
          if(state.cancelled) return;
          const h=window.innerHeight||800;
          cards.forEach(card=>{
            if(card.dataset.rendered==='1') return;
            const rect=card.getBoundingClientRect();
            if(rect.bottom>-1400&&rect.top<h+1400) enqueue(Number(card.dataset.pageNumber||0),false);
          });
        };
        const onScroll=()=>{if(!ticking){ticking=true;requestAnimationFrame(scanNearby);}};
        window.addEventListener('scroll',onScroll,{passive:true});
        window.addEventListener('resize',onScroll,{passive:true});
        state.cleanupFns.push(()=>window.removeEventListener('scroll',onScroll),()=>window.removeEventListener('resize',onScroll));
        scanNearby();
      }

      enqueue(1,true);
      enqueue(2,false);
      updateStatus();
    }catch(error){
      console.warn('[Site catalog PDF] render failed',error);
      disposeSiteCatalogRenderer(pages);
      pages.dataset.renderedUrl='';
      pages.innerHTML='<div class="site-catalog-error"><strong>تعذر تحميل الكتالوج داخل الصفحة.</strong><small>تحقق من الاتصال ثم أعد فتح الكتالوج.</small></div>';
    }finally{
      pages.dataset.loading='0';
    }
  }

  window.FL_CATALOG_PDF_VIEWER = {
    render: renderSiteCatalogPages,
    dispose: disposeSiteCatalogRenderer
  };
})();
