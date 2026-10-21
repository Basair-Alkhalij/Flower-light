import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const base=process.env.FL_SITE_URL||'http://127.0.0.1:4173/';

// Browser smoke tests intentionally bypass the page CSP so Playwright can inject
// test-only fixtures/mocks. Production CSP remains unchanged and is still checked
// structurally by the static/build checks.
test.use({ bypassCSP: true });


const supabaseMockScript=String.raw`
window.supabase={createClient(){
  const makeQuery=(table)=>{
    const q={
      select(){return q;},eq(){return q;},neq(){return q;},order(){return q;},limit(){return q;},range(){return q;},delete(){return q;},update(){return q;},
      insert(){return Promise.resolve({data:null,error:null});},
      upsert(){return Promise.resolve({data:null,error:null});},
      single(){return Promise.resolve({data:null,error:null});},
      maybeSingle(){
        if(table==='site_settings')return Promise.resolve({data:{require_customer_lead:true,pwa_install_enabled:true},error:null});
        if(table==='site_profile')return Promise.resolve({data:{},error:null});
        if(table==='site_catalog')return Promise.resolve({data:{},error:null});
        return Promise.resolve({data:null,error:null});
      },
      then(resolve){return Promise.resolve({data:[],error:null}).then(resolve);}
    };
    return q;
  };
  return {
    auth:{
      getSession:async()=>({data:{session:null},error:null}),
      onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),
      signOut:async()=>({error:null}),signInWithPassword:async()=>({data:{session:null},error:null}),
      resetPasswordForEmail:async()=>({error:null}),signInWithOtp:async()=>({error:null}),updateUser:async()=>({error:null})
    },
    from:makeQuery,
    rpc:async()=>({data:null,error:null}),
    storage:{from:()=>({getPublicUrl:(path)=>({data:{publicUrl:path||''}}),remove:async()=>({error:null}),upload:async()=>({error:null})})},
    functions:{invoke:async()=>({data:null,error:null})}
  };
}};`;

async function installSupabaseMock(page){
  const fulfill=route=>route.fulfill({status:200,contentType:'application/javascript',body:supabaseMockScript});
  await page.route('https://cdn.jsdelivr.net/npm/@supabase/**',fulfill);
  await page.route('**/supabase-vendor.js*',fulfill);
}

async function injectCatalogFixtures(page){
  await page.waitForFunction(()=>typeof window.flRenderProducts==='function');
  await page.evaluate(()=>{
    localStorage.setItem('flower_light_customer_access_v1','1');
    window.FLOWER_LIGHT_SITE_SETTINGS={require_customer_lead:false};
    window.FLOWER_LIGHT_PROFILE={brand_name:'Flower Light',company_name:'بصائر الخليج'};
    window.FLOWER_LIGHT_CONTACTS=[{type:'whatsapp',value:'0570372763',is_visible:true}];
    const svg=(label,bg)=>`data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="500" height="500"><rect width="500" height="500" fill="${bg}"/><text x="250" y="260" text-anchor="middle" font-size="38">${label}</text></svg>`)}`;
    const image1=svg('ONE','#eeeeee');
    const image2=svg('TWO','#dddddd');
    const thumb1=svg('THUMB-ONE','#f6f6f6');
    const thumb2=svg('THUMB-TWO','#e8e8e8');
    window.FLOWER_LIGHT_SITE_CATALOGS=[{id:'cat-test',name:'كتالوج تجريبي',description:'اختبار الكتالوج',pdf_url:'https://example.com/catalog.pdf',sort_order:20,is_visible:true}];
    window.FLOWER_LIGHT_PRODUCTS={catalog:[],chandeliers:[],balfon:[],extraSections:[{
      id:'sec-test',slug:'wall-lights',name:'جداريات',description:'قسم تجريبي',sort_order:0,items:[{
        id:'prod-test',name:'جداري تجريبي',model:'WL-TEST',caption:'منتج تجريبي',alt:'جداري تجريبي',category:'جداريات',category_id:'sec-test',category_slug:'wall-lights',
        image:image1,image_thumb:thumb1,image_path:'one',gallery:[{image:image1,thumb:thumb1,image_path:'one'},{image:image2,thumb:thumb2,image_path:'two'}],
        specifications:[{key:'custom_1',label:'الواط',value:'12W',unit:''},{key:'custom_2',label:'حرارة اللون',value:'3000K',unit:''},{key:'color',label:'اللون',value:'أسود',unit:''},{key:'custom_filter_mount',label:'نوع التركيب',value:'جداري',unit:''}],price:100,wholesale_price:80,wholesale_min_qty:10,availability:'available',is_visible:true
      }]
    }]};
    window.flRenderProducts();
  });
}

test('system light and dark modes keep readable contrast and produce review screenshots',async({page})=>{
  fs.mkdirSync('test-results/theme-screens',{recursive:true});
  await installSupabaseMock(page);
  await page.emulateMedia({colorScheme:'light'});
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await injectCatalogFixtures(page);
  await page.locator('#openProducts').click();
  await expect(page.locator('#catalogModal')).toHaveClass(/open/);

  const contrastRatio=async(selector)=>{
    return page.locator(selector).evaluate(node=>{
      const parse=value=>{
        const m=String(value||'').match(/rgba?\((\d+)[, ]+(\d+)[, ]+(\d+)/i);
        return m?[Number(m[1]),Number(m[2]),Number(m[3])]:[0,0,0];
      };
      const lum=rgb=>{
        const values=rgb.map(v=>{const s=v/255;return s<=.04045?s/12.92:((s+.055)/1.055)**2.4;});
        return .2126*values[0]+.7152*values[1]+.0722*values[2];
      };
      const style=getComputedStyle(node),fg=lum(parse(style.color)),bg=lum(parse(style.backgroundColor));
      return (Math.max(fg,bg)+.05)/(Math.min(fg,bg)+.05);
    });
  };

  expect(await contrastRatio('body')).toBeGreaterThanOrEqual(4.5);
  expect(await contrastRatio('#catalogSearchInput')).toBeGreaterThanOrEqual(4.5);
  await page.locator('.catalog-sheet').screenshot({path:'test-results/theme-screens/catalog-light.png'});

  await page.emulateMedia({colorScheme:'dark'});
  await expect.poll(()=>contrastRatio('body')).toBeGreaterThanOrEqual(4.5);
  expect(await contrastRatio('#catalogSearchInput')).toBeGreaterThanOrEqual(4.5);
  await expect.poll(()=>page.evaluate(()=>getComputedStyle(document.documentElement).colorScheme),{timeout:10000}).toContain('dark');
  await page.locator('.catalog-sheet').screenshot({path:'test-results/theme-screens/catalog-dark.png'});

  const colors=await page.evaluate(()=>({
    body:getComputedStyle(document.body).backgroundColor,
    sheet:getComputedStyle(document.querySelector('.catalog-sheet')).backgroundColor,
    search:getComputedStyle(document.querySelector('#catalogSearchInput')).backgroundColor
  }));
  expect(colors.body).not.toBe('rgb(247, 247, 245)');
  expect(colors.sheet).not.toBe('rgb(247, 246, 243)');
  expect(colors.search).not.toBe('rgb(255, 255, 255)');
});


test('catalog PDF renderer disables evaluated font code and renders pages',async({page})=>{
  await installSupabaseMock(page);
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>Boolean(window.FL_CATALOG_PDF_VIEWER?.render));
  await page.evaluate(()=>{
    window.__pdfReaderOptions=null;
    window.pdfjsLib={
      GlobalWorkerOptions:{},
      getDocument(options){
        window.__pdfReaderOptions=options;
        const fakePage={
          getViewport({scale}){return {width:200*scale,height:280*scale};},
          render({canvasContext}){canvasContext.fillStyle='#fff';canvasContext.fillRect(0,0,20,20);return {promise:Promise.resolve()};},
          cleanup(){}
        };
        return {promise:Promise.resolve({numPages:2,getPage:async()=>fakePage,cleanup(){},destroy(){}})};
      }
    };
    const panel=document.createElement('section');
    panel.id='flPdfSecurityTest';
    panel.innerHTML='<div class="site-catalog-pages"></div>';
    document.body.appendChild(panel);
    window.FL_CATALOG_PDF_VIEWER.render(panel,'https://example.com/catalog-test.pdf');
  });
  await expect.poll(()=>page.evaluate(()=>window.__pdfReaderOptions?.isEvalSupported)).toBe(false);
  expect(await page.evaluate(()=>window.__pdfReaderOptions.url)).toBe('https://example.com/catalog-test.pdf');
  await expect(page.locator('#flPdfSecurityTest .site-catalog-page')).toHaveCount(2);
  await expect(page.locator('#flPdfSecurityTest .site-catalog-page[data-rendered="1"]')).toHaveCount(2);
});


// Small valid one-page PDF, built in-memory to exercise the actual ESM parser/worker.
function catalogPdfFixture(){
  const contents='BT /F1 18 Tf 22 245 Td (Flower Light Catalog) Tj ET';
  const objects=[
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Count 1 /Kids [3 0 R] >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 300] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(contents)} >>\nstream\n${contents}\nendstream`
  ];
  let pdf='%PDF-1.4\n';const offsets=[0];
  objects.forEach((obj,i)=>{offsets.push(Buffer.byteLength(pdf,'latin1'));pdf+=`${i+1} 0 obj\n${obj}\nendobj\n`;});
  const xref=Buffer.byteLength(pdf,'latin1');
  pdf+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;
  for(let i=1;i<offsets.length;i++)pdf+=`${String(offsets[i]).padStart(10,'0')} 00000 n \n`;
  pdf+=`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf,'latin1');
}
test('built PDF.js 4 ESM parses and renders a real PDF using its local worker',async({page})=>{
  test.skip(process.env.FL_TEST_DIST!=='1','Production-only self-hosted module assets');
  await installSupabaseMock(page);
  await page.route('**/fl-reader-fixture.pdf',route=>route.fulfill({status:200,contentType:'application/pdf',body:catalogPdfFixture()}));
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>Boolean(window.FL_CATALOG_PDF_VIEWER?.render));
  await page.evaluate(()=>{
    const panel=document.createElement('section');
    panel.id='flPdfRealTest';
    panel.innerHTML='<div class="site-catalog-pages"></div>';
    document.body.appendChild(panel);
    window.FL_CATALOG_PDF_VIEWER.render(panel,new URL('fl-reader-fixture.pdf',location.href).href);
  });
  await expect(page.locator('#flPdfRealTest .site-catalog-page')).toHaveCount(1,{timeout:20000});
  await expect(page.locator('#flPdfRealTest .site-catalog-page[data-rendered="1"]')).toHaveCount(1,{timeout:30000});
  await expect(page.locator('#flPdfRealTest img.site-catalog-page-image')).toBeVisible();
  const workerSrc=await page.evaluate(()=>window.__pdfReaderOptions?.workerSrc);
  expect(workerSrc).toBeUndefined(); // This test loads the real PDF.js, not a mock.
});

test('customer gate can be enabled and disabled',async({page})=>{
  await installSupabaseMock(page);
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof window.flBeforeProductsOpen==='function');
  await page.evaluate(()=>{localStorage.removeItem('flower_light_customer_access_v1');window.FLOWER_LIGHT_SITE_SETTINGS={require_customer_lead:true};});
  const pending=page.evaluate(()=>window.flBeforeProductsOpen());
  await expect(page.locator('#flLeadGate')).toHaveClass(/open/);
  await expect(page.locator('#flLeadName')).toBeVisible();
  await expect(page.locator('#flLeadMobile')).toBeVisible();
  await page.locator('#flLeadClose').click();
  expect(await pending).toBe(false);
  await page.evaluate(()=>{window.FLOWER_LIGHT_SITE_SETTINGS={require_customer_lead:false};});
  expect(await page.evaluate(()=>window.flBeforeProductsOpen())).toBe(true);
  await expect(page.locator('#flLeadGate')).not.toHaveClass(/open/);
});

test('main catalog, product actions, lightbox navigation and catalog tab work',async({page})=>{
  await installSupabaseMock(page);
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await injectCatalogFixtures(page);
  await page.locator('#openProducts').click();
  await expect(page.locator('#catalogModal')).toHaveClass(/open/);
  await expect(page.locator('.extra-section-tab').filter({hasText:'جداريات'})).toBeVisible();
  await expect(page.locator('.chandelier-card')).toHaveCount(1);
  await expect(page.locator('.product-image-button img')).toHaveAttribute('src',/THUMB-ONE/);
  await expect(page.locator('.product-image-button img')).toHaveAttribute('loading','lazy');
  await expect(page.locator('.product-image-button img')).toHaveAttribute('decoding','async');
  await expect(page.locator('.product-spec-label').first()).toHaveText('القدرة');

  const whatsapp=page.locator('.product-whatsapp-button');
  await expect(whatsapp).toBeVisible();
  await expect(whatsapp).toHaveAttribute('href',/^https:\/\/wa\.me\/966570372763\?text=/);

  await page.locator('.product-download-pdf-button').click();
  await expect(page.locator('#exportChoiceModal')).toHaveClass(/open/);
  await expect(page.locator('#exportChoicePdf')).toBeVisible();
  await expect(page.locator('#exportChoiceJpg')).toBeVisible();
  await page.locator('#closeExportChoice').click();

  await page.locator('.category-download-button').click();
  await expect(page.locator('#exportChoiceModal')).toHaveClass(/open/);
  await page.locator('#closeExportChoice').click();

  await page.locator('.product-image-button').click();
  await expect(page.locator('#imageLightbox')).toHaveClass(/open/);
  await expect(page.locator('#imageLightboxCounter')).toContainText('1 / 2');
  await page.locator('#imageLightboxNext').click();
  await expect(page.locator('#imageLightboxCounter')).toContainText('2 / 2');
  await page.locator('#imageLightboxPrev').click();
  await expect(page.locator('#imageLightboxCounter')).toContainText('1 / 2');
  await page.locator('#closeImageLightbox').click();
  await expect(page.locator('#imageLightbox')).not.toHaveClass(/open/);

  const catalogTab=page.locator('.site-catalog-tab').filter({hasText:'كتالوج تجريبي'});
  await expect(catalogTab).toBeVisible();
  await catalogTab.click();
  await expect(page.locator('.site-catalog-panel.active .site-catalog-download')).toHaveAttribute('href','https://example.com/catalog.pdf');

  await page.locator('#closeProducts').click();
  await expect(page.locator('#catalogModal')).not.toHaveClass(/open/);
});




test('public quote list follows the owner visibility setting without losing saved items',async({page})=>{
  await installSupabaseMock(page);
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.evaluate(()=>localStorage.removeItem('fl_quote_list_v1'));
  await injectCatalogFixtures(page);
  await page.locator('#openProducts').click();

  const control=page.locator('.quote-list-product-control').first();
  const actions=page.locator('.product-card-actions').first();
  const whatsapp=actions.locator('.product-whatsapp-button');
  const download=actions.locator('.product-download-pdf-button');
  await expect(control).toBeVisible();
  await expect(actions).toHaveClass(/has-quote-list/);
  const shownLayout=await actions.evaluate(node=>{
    const rect=selector=>node.querySelector(selector).getBoundingClientRect();
    const d=rect('.product-download-pdf-button');
    const s=rect('.product-share-button');
    const w=rect('.product-whatsapp-button');
    const q=rect('.quote-list-product-control');
    return {download:d,share:s,whatsapp:w,quote:q};
  });
  expect(Math.abs(shownLayout.download.top-shownLayout.share.top)).toBeLessThan(3);
  expect(Math.abs(shownLayout.whatsapp.top-shownLayout.quote.top)).toBeLessThan(3);
  expect(Math.abs(shownLayout.whatsapp.width-shownLayout.quote.width)).toBeLessThan(6);
  expect(shownLayout.whatsapp.top).toBeGreaterThan(shownLayout.download.top+8);

  await control.locator('.quote-list-add-button').click();
  await expect(page.locator('#flQuoteBar')).toBeVisible();

  expect(await page.evaluate(()=>{
    const settings={...(window.FLOWER_LIGHT_SITE_SETTINGS||{}),quote_list_enabled:false};
    window.FLOWER_LIGHT_SITE_SETTINGS=settings;
    window.dispatchEvent(new CustomEvent('flowerlight:site-settings',{detail:settings}));
    return window.FL_QUOTE_LIST.add({id:'blocked-product',name:'لا يجب إضافته'},1);
  })).toBe(false);
  await expect(control).toBeHidden();
  await expect(page.locator('#flQuoteBar')).toBeHidden();
  await expect(actions).not.toHaveClass(/has-quote-list/);
  const hiddenLayout=await actions.evaluate(node=>{
    const d=node.querySelector('.product-download-pdf-button').getBoundingClientRect();
    const s=node.querySelector('.product-share-button').getBoundingClientRect();
    const w=node.querySelector('.product-whatsapp-button').getBoundingClientRect();
    return {download:d,share:s,whatsapp:w};
  });
  expect(Math.abs(hiddenLayout.download.top-hiddenLayout.share.top)).toBeLessThan(3);
  expect(hiddenLayout.whatsapp.top).toBeGreaterThan(hiddenLayout.download.top+8);
  expect(hiddenLayout.whatsapp.width).toBeGreaterThan(hiddenLayout.download.width*1.8);

  await page.evaluate(()=>{
    const settings={...(window.FLOWER_LIGHT_SITE_SETTINGS||{}),quote_list_enabled:true};
    window.FLOWER_LIGHT_SITE_SETTINGS=settings;
    window.dispatchEvent(new CustomEvent('flowerlight:site-settings',{detail:settings}));
  });
  await expect(control).toBeVisible();
  await expect(page.locator('#flQuoteBar')).toBeVisible();
  await expect(actions).toHaveClass(/has-quote-list/);
  expect(await page.evaluate(()=>window.FL_QUOTE_LIST.items().length)).toBe(1);
});


test('product availability badge disables quote-list additions when unavailable',async({page})=>{
  await installSupabaseMock(page);
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.evaluate(()=>localStorage.removeItem('fl_quote_list_v1'));
  await injectCatalogFixtures(page);
  await page.locator('#openProducts').click();

  await expect(page.locator('.product-availability-badge').first()).toHaveText('متوفر');
  await expect(page.locator('.quote-list-add-button').first()).toBeEnabled();

  await page.evaluate(()=>{
    const item=window.FLOWER_LIGHT_PRODUCTS.extraSections[0].items[0];
    item.availability='out_of_stock';
    window.flRenderProducts();
  });
  await expect(page.locator('.product-availability-badge').first()).toHaveText('نفد');
  await expect(page.locator('.quote-list-add-button').first()).toBeDisabled();

  await page.evaluate(()=>{
    const item=window.FLOWER_LIGHT_PRODUCTS.extraSections[0].items[0];
    item.availability='coming_soon';
    window.flRenderProducts();
  });
  await expect(page.locator('.product-availability-badge').first()).toHaveText('قريبًا');
  await expect(page.locator('.quote-list-add-button').first()).toBeDisabled();
});

test('quote list keeps quantities after reload and sends two products to WhatsApp',async({page})=>{
  await page.addInitScript(()=>{
    window.__quoteOpened=[];
    Object.defineProperty(window,'open',{configurable:true,writable:true,value:(...args)=>{window.__quoteOpened.push(args);return null;}});
  });
  await installSupabaseMock(page);
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.evaluate(()=>localStorage.removeItem('fl_quote_list_v1'));
  await injectCatalogFixtures(page);
  await page.evaluate(()=>{
    const section=window.FLOWER_LIGHT_PRODUCTS.extraSections[0];
    const first=section.items[0];
    section.items.push({...first,id:'prod-two',name:'منتج ثان',model:'WL-TWO',caption:'منتج تجريبي ثان',image_path:'two',gallery:[first.gallery[1]]});
    window.flRenderProducts();
  });
  await page.locator('#openProducts').click();
  await expect(page.locator('.quote-list-product-control')).toHaveCount(2);
  await expect(page.locator('.quote-list-add-button')).toHaveCount(2);

  await page.locator('.quote-list-product-control[data-quote-control-id="prod-test"] .quote-list-add-button').click();
  await page.locator('.quote-list-product-control[data-quote-control-id="prod-two"] .quote-list-add-button').click();
  const cardQty=page.locator('.quote-list-product-control[data-quote-control-id="prod-test"] .quote-list-qty-value');
  await expect(cardQty).toHaveAttribute('type','number');
  await expect(cardQty).toHaveAttribute('min','1');
  await expect(cardQty).toHaveAttribute('max','9999');
  await cardQty.fill('25');
  await cardQty.press('Enter');
  await expect(page.locator('.quote-list-product-control[data-quote-control-id="prod-test"] .quote-list-qty-value')).toHaveValue('25');
  await expect(page.locator('#flQuoteBar')).toBeVisible();
  await expect(page.locator('#flQuoteCount')).toHaveText('2');

  await page.reload({waitUntil:'domcontentloaded'});
  await injectCatalogFixtures(page);
  await expect(page.locator('#flQuoteBar')).toBeVisible();
  await expect(page.locator('#flQuoteCount')).toHaveText('2');
  await page.locator('#flQuoteBar').click();
  await expect(page.locator('#flQuoteModal')).toHaveClass(/open/);
  await expect(page.locator('#flQuoteItems .fl-quote-item')).toHaveCount(2);
  await expect(page.locator('#flQuoteItems .fl-quote-item').nth(0).locator('.fl-quote-item-qty-input')).toHaveValue('25');
  const modalQty=page.locator('#flQuoteItems .fl-quote-item').nth(1).locator('.fl-quote-item-qty-input');
  await modalQty.fill('7');
  await modalQty.press('Enter');
  await expect(page.locator('#flQuoteItems .fl-quote-item').nth(1).locator('.fl-quote-item-qty-input')).toHaveValue('7');
  await page.locator('#flQuoteName').fill('محمد');
  await page.locator('#flQuoteNotes').fill('فضلاً إرسال أفضل سعر');
  await page.locator('#flQuoteSend').click();

  const opened=await page.evaluate(()=>window.__quoteOpened.at(-1));
  expect(opened).toBeTruthy();
  expect(opened[1]).toBe('_blank');
  expect(opened[2]).toBe('noopener');
  const url=new URL(opened[0]);
  expect(url.origin).toBe('https://wa.me');
  expect(url.pathname).toBe('/966570372763');
  const message=url.searchParams.get('text');
  const plainMessage=message.replace(/[\u2066\u2069]/g,'');
  expect(plainMessage).toContain('1) جداري تجريبي — WL-TEST * 25');
  expect(plainMessage).toContain('2) منتج ثان — WL-TWO * 7');
  expect(plainMessage).not.toContain(' × ');
  expect(plainMessage).toContain('الاسم: محمد');
  expect(plainMessage).toContain('ملاحظات: فضلاً إرسال أفضل سعر');
});

test('public product and category share URLs use static SEO paths',async({page})=>{
  await page.addInitScript(()=>{
    window.__flSharedPayloads=[];
    Object.defineProperty(navigator,'share',{configurable:true,value:async payload=>{window.__flSharedPayloads.push(payload);}});
  });
  await installSupabaseMock(page);
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await injectCatalogFixtures(page);
  await page.locator('#openProducts').click();
  await expect(page.locator('#catalogModal')).toHaveClass(/open/);

  await page.locator('.product-share-button').click();
  const productPayload=await page.evaluate(()=>window.__flSharedPayloads.at(-1));
  const productUrl=new URL(productPayload.url);
  expect(productUrl.pathname).toMatch(/\/p\/prod-test\/$/);
  expect(productUrl.search).toBe('');

  await page.locator('.category-share-button').first().click();
  const categoryPayload=await page.evaluate(()=>window.__flSharedPayloads.at(-1));
  const categoryUrl=new URL(categoryPayload.url);
  expect(categoryUrl.pathname).toMatch(/\/c\/wall-lights\/$/);
  expect(categoryUrl.search).toBe('');
});

test('legacy query deep links still open product and category targets',async({page})=>{
  await installSupabaseMock(page);
  await page.goto(`${base}?product=prod-test`,{waitUntil:'load'});
  await injectCatalogFixtures(page);
  await expect(page.locator('#catalogModal')).toHaveClass(/open/);
  await expect(page.locator('#imageLightbox')).toHaveClass(/open/);
  await page.locator('#closeImageLightbox').click();
  await page.locator('#closeProducts').click();

  await page.goto(`${base}?category=wall-lights`,{waitUntil:'load'});
  // Wait for the initial Supabase synchronization. A second RPC can race and
  // overwrite fixtures AFTER the tab is already correctly displayed.
  await page.waitForFunction(()=>Boolean(window.flPublicCatalogReady));
  await page.evaluate(()=>window.flPublicCatalogReady);
  await injectCatalogFixtures(page);
  // Fixtures load after app bootstrap; restore the intended query if initial routing ran too early.
  await page.evaluate(()=>{
    const url=new URL(location.href);
    url.searchParams.set('category','wall-lights');
    url.searchParams.delete('product');
    history.replaceState({},'',url.pathname+url.search);
    window.flRenderProducts();
  });
  await expect(page.locator('#catalogModal')).toHaveClass(/open/);
  await expect(page.locator('.extra-section-tab').filter({hasText:'جداريات'})).toHaveClass(/active/);
});



test('catalog search finds product names across all sections and shows the section',async({page})=>{
  await installSupabaseMock(page);
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await injectCatalogFixtures(page);
  await page.evaluate(()=>{
    const first=window.FLOWER_LIGHT_PRODUCTS.extraSections[0].items[0];
    window.FLOWER_LIGHT_PRODUCTS.extraSections.push({
      id:'sec-outdoor',slug:'outdoor-lights',name:'كشافات خارجية',description:'قسم خارجي',sort_order:10,items:[{
        ...first,
        id:'prod-outdoor',
        name:'كشاف خارجي مميز',
        model:'OUT-200',
        caption:'إنارة خارجية قوية',
        category:'كشافات خارجية',
        category_id:'sec-outdoor',
        category_slug:'outdoor-lights'
      }]
    });
    window.flRenderProducts();
  });
  await page.locator('#openProducts').click();

  await expect(page.locator('.extra-section-tab').filter({hasText:'جداريات'})).toBeVisible();
  await expect(page.locator('.extra-section-tab').filter({hasText:'كشافات خارجية'})).toBeVisible();

  await page.locator('#catalogSearchInput').fill('كشاف خارجي مميز');
  await expect(page.locator('#catalogSearchCount')).toHaveText('1 نتيجة · 1 قسم');
  await expect(page.locator('.extra-section-tab').filter({hasText:'جداريات'})).toBeHidden();
  await expect(page.locator('.extra-section-tab').filter({hasText:'كشافات خارجية'})).toHaveClass(/active/);
  await expect(page.locator('.catalog-panel.active .catalog-search-section-label')).toContainText('كشافات خارجية');
  await expect(page.locator('.catalog-panel.active .chandelier-card:not(.catalog-search-hidden)')).toHaveCount(1);

  await page.locator('#catalogSearchInput').fill('');
  await expect(page.locator('#catalogSearchCount')).toBeHidden();
  await expect(page.locator('.extra-section-tab').filter({hasText:'جداريات'})).toBeVisible();
  await expect(page.locator('.extra-section-tab').filter({hasText:'كشافات خارجية'})).toBeVisible();
  await expect(page.locator('.catalog-search-section-label')).toHaveCount(0);
});


test('catalog filters combine availability, wattage, CCT and search on mobile',async({page})=>{
  await page.setViewportSize({width:360,height:800});
  await installSupabaseMock(page);
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await injectCatalogFixtures(page);
  await page.evaluate(()=>{
    const first=window.FLOWER_LIGHT_PRODUCTS.extraSections[0].items[0];
    window.FLOWER_LIGHT_PRODUCTS.extraSections.push({
      id:'sec-outdoor-filter',slug:'outdoor-filter',name:'كشافات خارجية',description:'قسم خارجي',sort_order:10,items:[{
        ...first,
        id:'prod-filter-24',
        name:'كشاف خارجي 24 وات',
        model:'OUT-24',
        caption:'كشاف بقدرة مختلفة',
        availability:'out_of_stock',
        category:'كشافات خارجية',
        category_id:'sec-outdoor-filter',
        category_slug:'outdoor-filter',
        specifications:[
          {key:'wattage',label:'القدرة',value:'24',unit:'W'},
          {key:'cct',label:'حرارة اللون',value:'4000',unit:'K'},
          {key:'custom_filter_mount',label:'نوع التركيب',value:'سطحي',unit:''}
        ]
      }]
    });
    window.flRenderProducts();
  });
  await page.locator('#openProducts').click();

  await expect(page.locator('#catalogFilter_availability')).toBeVisible();
  await expect(page.locator('#catalogFilter_wattage')).toBeVisible();
  await expect(page.locator('#catalogFilter_cct')).toBeVisible();
  await expect(page.locator('#catalogFilter_wattage option[value="12W"]')).toHaveCount(1);
  await expect(page.locator('#catalogFilter_wattage option[value="24W"]')).toHaveCount(1);
  await expect(page.locator('#catalogFilter_cct option[value="3000K"]')).toHaveCount(1);
  await expect(page.locator('#catalogFilter_cct option[value="4000K"]')).toHaveCount(1);

  // Dependent choices: choosing 24W must narrow CCT to the compatible value.
  await page.locator('#catalogFilter_wattage').selectOption('24W');
  await expect(page.locator('#catalogFilter_cct option[value="4000K"]')).toHaveCount(1);
  await expect(page.locator('#catalogFilter_cct option[value="3000K"]')).toHaveCount(0);

  await expect(page.locator('#catalogSearchCount')).toHaveText('1 نتيجة · 1 قسم');
  await expect(page.locator('.extra-section-tab').filter({hasText:'كشافات خارجية'})).toHaveClass(/active/);

  await page.locator('#catalogFilter_availability').selectOption('out_of_stock');
  await page.locator('#catalogFilter_cct').selectOption('4000K');
  await expect(page.locator('#catalogSearchCount')).toHaveText('1 نتيجة · 1 قسم');
  await expect(page.locator('.catalog-panel.active .chandelier-card:not(.catalog-search-hidden)')).toHaveCount(1);

  await page.locator('#catalogSearchInput').fill('جداري');
  await expect(page.locator('#catalogSearchCount')).toHaveText('لا توجد نتائج مطابقة للبحث والفلاتر');
  await page.locator('#catalogSearchInput').fill('كشاف');
  await expect(page.locator('#catalogSearchCount')).toHaveText('1 نتيجة · 1 قسم');

  await page.locator('#catalogFilterClear').click();
  await expect(page.locator('#catalogFilter_wattage')).toHaveValue('');
  await expect(page.locator('#catalogFilter_cct')).toHaveValue('');
  await expect(page.locator('#catalogFilter_availability')).toHaveValue('');
  await expect(page.locator('#catalogSearchInput')).toHaveValue('كشاف');
  await expect(page.locator('#catalogSearchCount')).toHaveText('1 نتيجة · 1 قسم');

  await page.evaluate(()=>{
    window.FLOWER_LIGHT_SITE_SETTINGS={
      ...(window.FLOWER_LIGHT_SITE_SETTINGS||{}),
      catalog_filter_keys:['custom_filter_mount'],
      catalog_custom_filters:[{key:'custom_filter_mount',label:'نوع التركيب'}]
    };
    window.dispatchEvent(new CustomEvent('flowerlight:site-settings',{detail:window.FLOWER_LIGHT_SITE_SETTINGS}));
  });
  await expect(page.locator('#catalogFilter_custom_filter_mount')).toBeVisible();
  // The text query "كشاف" is still active, so the custom filter must also depend on it.
  await expect(page.locator('#catalogFilter_custom_filter_mount option[value="سطحي"]')).toHaveCount(1);
  await expect(page.locator('#catalogFilter_custom_filter_mount option[value="جداري"]')).toHaveCount(0);
  await page.locator('#catalogSearchInput').fill('');
  await expect(page.locator('#catalogFilter_custom_filter_mount option[value="جداري"]')).toHaveCount(1);
  await expect(page.locator('#catalogFilter_custom_filter_mount option[value="سطحي"]')).toHaveCount(1);
  await expect(page.locator('#catalogFilter_wattage')).toHaveCount(0);
  await expect(page.locator('#catalogFilter_availability')).toHaveCount(0);

  const fit=await page.locator('#catalogFilterWrap').evaluate(el=>({scroll:el.scrollWidth,client:el.clientWidth}));
  expect(fit.scroll).toBeLessThanOrEqual(fit.client+1);
});

test('laptop product dialog and lightbox stay inside the viewport',async({page})=>{
  await page.setViewportSize({width:1366,height:768});
  await installSupabaseMock(page);
  await page.goto(base,{waitUntil:'domcontentloaded'});

  await page.evaluate(()=>{
    const modal=document.getElementById('flCloudModal');
    const dialog=modal?.querySelector('.fl-cloud-dialog');
    const body=document.getElementById('flCloudModalBody');
    dialog?.classList.add('fl-product-dialog');
    if(body) body.innerHTML=`<form id="flProductForm"><div class="fl-cloud-form">
      <div class="fl-cloud-field"><label>القسم</label><select><option>كشافات</option></select></div>
      <div class="fl-cloud-field"><label>الترتيب</label><input value="0"></div>
      <section class="fl-pricing-editor full"><div class="fl-price-tier-list"><div class="fl-price-tier-row" data-price-tier-row>
        <div class="fl-cloud-field"><label>نوع السعر</label><select><option>جملة</option></select></div>
        <div class="fl-cloud-field"><label>السعر</label><input value="35"></div>
        <div class="fl-price-tier-range"><div class="fl-cloud-field"><label>الأدنى</label><input value="10"></div><div class="fl-cloud-field"><label>الأعلى</label><input value="49"></div></div>
        <button class="fl-price-tier-remove" type="button">حذف</button>
      </div></div></section></div></form>`;
    modal?.classList.add('open');
  });

  const dialogBox=await page.locator('.fl-cloud-dialog.fl-product-dialog').boundingBox();
  const priceBox=await page.locator('.fl-price-tier-row').boundingBox();
  expect(dialogBox).toBeTruthy();
  expect(priceBox).toBeTruthy();
  expect(dialogBox.width).toBeGreaterThan(850);
  expect(dialogBox.x).toBeGreaterThanOrEqual(0);
  expect(dialogBox.x+dialogBox.width).toBeLessThanOrEqual(1366);
  expect(priceBox.x).toBeGreaterThanOrEqual(dialogBox.x-1);
  expect(priceBox.x+priceBox.width).toBeLessThanOrEqual(dialogBox.x+dialogBox.width+1);

  await page.evaluate(()=>{
    document.getElementById('flCloudModal')?.classList.remove('open');
    const box=document.getElementById('imageLightbox');
    const image=document.getElementById('imageLightboxImage');
    const specs=document.getElementById('imageLightboxSpecs');
    const actions=box?.querySelector('.image-lightbox-actions');
    if(image) image.src=`data:image/svg+xml;charset=UTF-8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="700" height="900"><rect width="700" height="900" fill="white"/><rect x="10" y="10" width="680" height="880" fill="none" stroke="orange" stroke-width="20"/><text x="350" y="70" text-anchor="middle" font-size="44">TOP</text></svg>')}`;
    if(specs){specs.hidden=false;specs.innerHTML='<div class="product-spec">قدرة 200W</div><div class="product-spec">لون 6500K</div><div class="product-spec">IP66</div>';}
    actions?.querySelectorAll('[hidden]').forEach(el=>el.hidden=false);
    box?.classList.add('open');
    if(box){box.scrollTop=0;box.scrollLeft=0;}
  });
  await page.locator('#imageLightboxImage').evaluate(img=>img.complete ? true : new Promise(resolve=>img.addEventListener('load',()=>resolve(true),{once:true})));
  const imageBox=await page.locator('#imageLightboxImage').boundingBox();
  expect(imageBox).toBeTruthy();
  expect(imageBox.y).toBeGreaterThanOrEqual(0);
  expect(imageBox.y).toBeLessThan(80);
  expect(imageBox.y+imageBox.height).toBeLessThanOrEqual(768);
  expect(await page.locator('#imageLightbox').evaluate(el=>el.scrollTop)).toBe(0);
});

test('master barcode appears in the shared datasheet template only when configured',async({page})=>{
  await installSupabaseMock(page);
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.flDatasheetPdf?.createPage);
  const result=await page.evaluate(async()=>{
    const productImage=`data:image/svg+xml;charset=UTF-8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600"><rect width="600" height="600" fill="#eeeeee"/></svg>')}`;
    const barcode=`data:image/svg+xml;charset=UTF-8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="180"><rect width="400" height="180" fill="#ff0000"/></svg>')}`;
    const item={name:'منتج اختبار',model:'BAR-1',caption:'',image:productImage,image_path:'',gallery:[{image:productImage,image_path:''}],specifications:[{key:'custom_1',label:'القدرة',value:'20W',unit:''}]};
    window.FLOWER_LIGHT_SITE_SETTINGS={require_customer_lead:false,master_barcode_path:'test',master_barcode_url:barcode};
    const redPixels=canvas=>{
      const data=canvas.getContext('2d').getImageData(45,850,220,350).data;
      let count=0;
      for(let i=0;i<data.length;i+=4)if(data[i]>220&&data[i+1]<80&&data[i+2]<80&&data[i+3]>0)count++;
      return count;
    };
    const withBarcode=await window.flDatasheetPdf.createPage(item,{images:item.gallery,scale:1});
    const withCount=redPixels(withBarcode.canvas);
    window.FLOWER_LIGHT_SITE_SETTINGS={require_customer_lead:false,master_barcode_path:'',master_barcode_url:''};
    const withoutBarcode=await window.flDatasheetPdf.createPage(item,{images:item.gallery,scale:1});
    const withoutCount=redPixels(withoutBarcode.canvas);
    return {withCount,withoutCount};
  });
  expect(result.withCount).toBeGreaterThan(1000);
  expect(result.withoutCount).toBe(0);
});

test('design footer label and number replace website URL and hide when empty',async({page})=>{
  await installSupabaseMock(page);
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.flDatasheetPdf?.createPage);
  const result=await page.evaluate(async()=>{
    const productImage=`data:image/svg+xml;charset=UTF-8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600"><rect width="600" height="600" fill="#eeeeee"/></svg>')}`;
    const item={name:'منتج اختبار',model:'FOOT-1',caption:'',image:productImage,image_path:'',gallery:[{image:productImage,image_path:''}],specifications:[]};
    const original=CanvasRenderingContext2D.prototype.fillText;
    const captured=[];
    CanvasRenderingContext2D.prototype.fillText=function(text,...args){captured.push(String(text));return original.call(this,text,...args);};
    try{
      window.FLOWER_LIGHT_SITE_SETTINGS={require_customer_lead:false,master_barcode_path:'',master_barcode_url:'',design_footer_number:'+966500001111',design_footer_label:'مندوب الجملة'};
      await window.flDatasheetPdf.createPage(item,{images:item.gallery,scale:1});
      const withNumber=captured.slice();
      captured.length=0;
      window.FLOWER_LIGHT_SITE_SETTINGS={require_customer_lead:false,master_barcode_path:'',master_barcode_url:'',design_footer_number:'',design_footer_label:''};
      await window.flDatasheetPdf.createPage(item,{images:item.gallery,scale:1});
      return {withNumber,withoutNumber:captured.slice()};
    }finally{CanvasRenderingContext2D.prototype.fillText=original;}
  });
  expect(result.withNumber).toContain('+966500001111');
  expect(result.withNumber).toContain('مندوب الجملة');
  expect(result.withNumber.some(text=>text.includes('github.io'))).toBeFalsy();
  expect(result.withoutNumber).not.toContain('+966500001111');
  expect(result.withoutNumber).not.toContain('مندوب الجملة');
});

test('acceptance: Excel export contains all 1005 product rows and preserves identifiers',async({page})=>{
  await installSupabaseMock(page);
  await page.goto(new URL('?admin=1',base).href,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>Boolean(window.FL_ADMIN_CORE&&window.FL_ADMIN_IMPORT));
  const result=await page.evaluate(async()=>{
    const core=window.FL_ADMIN_CORE;
    core.categories=[{id:'section-large',name:'Large Section',sort_order:1,is_visible:true}];
    core.productImages=[];
    core.products=Array.from({length:1005},(_,i)=>({
      id:'id-'+i,category_id:'section-large',name:'Product '+i,model:'SKU-'+i,
      caption:'Description '+i,price:100+i,sort_order:i,is_visible:true,specifications:[]
    }));
    const sheets={};
    window.JSZip={};
    window.XLSX={utils:{
      book_new:()=>({SheetNames:[],Sheets:{}}),
      aoa_to_sheet:rows=>({rows}),
      book_append_sheet:(wb,ws,name)=>{wb.SheetNames.push(name);wb.Sheets[name]=ws;sheets[name]=ws.rows;},
      encode_col:n=>{let out='';for(let k=n+1;k;k=Math.floor((k-1)/26))out=String.fromCharCode(65+(k-1)%26)+out;return out;}
    },writeFile:(wb,name)=>{window.__excelExport={sheets:wb.Sheets,name};}};
    await window.FL_ADMIN_IMPORT.downloadExcelTemplate();
    const all=window.__excelExport?.sheets?.['Large Section']?.rows||[];
    return {count:all.length-1,first:all[1]?.slice(0,4),last:all[1005]?.slice(0,4),fileName:window.__excelExport?.name||''};
  });
  expect(result.count).toBe(1005);
  expect(result.first).toEqual(['id-0','Product 0','','SKU-0']);
  expect(result.last).toEqual(['id-1004','Product 1004','','SKU-1004']);
  expect(result.fileName).toMatch(/Flower-Light-Products-.*\.xlsx$/);
});

test('admin routes are isolated and noindex',async({page})=>{
  await installSupabaseMock(page);
  await page.goto(new URL('?admin=1',base).href,{waitUntil:'domcontentloaded'});
  await expect(page).toHaveTitle('لوحة المدير | بصائر الخليج');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content','noindex,nofollow');
  await expect(page.locator('#flCloudPrimaryAdmin')).toHaveCount(1);
  await expect(page.locator('#flCloudAssistantAdmin')).toHaveCount(1);
  await page.waitForFunction(()=>Boolean(window.FL_ADMIN_MEDIA&&window.FL_ADMIN_PRODUCTS&&window.FL_ADMIN_PRODUCT_FORM&&window.FL_ADMIN_IMPORT));
  expect(await page.evaluate(()=>({
    media:typeof window.FL_ADMIN_MEDIA?.uploadProductImagePair,
    products:typeof window.FL_ADMIN_PRODUCTS?.renderProducts,
    form:typeof window.FL_ADMIN_PRODUCT_FORM?.openProductForm,
    importModule:typeof window.FL_ADMIN_IMPORT?.openProductExcelImport,
  }))).toEqual({media:'function',products:'function',form:'function',importModule:'function'});

  await page.goto(new URL('?admin=2',base).href,{waitUntil:'domcontentloaded'});
  await expect(page).toHaveTitle('لوحة الأدمن | بصائر الخليج');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content','noindex,nofollow');
  await expect(page.locator('#flCloudPrimaryAdmin')).toHaveCount(0);
  await expect(page.locator('#flCloudAssistantAdmin')).toHaveCount(1);
});

test('iPhone gets guidance, not a fake one-click native install', async ({ browser }) => {
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true
  });
  const page = await context.newPage();
  await installSupabaseMock(page);
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.FLOWER_LIGHT_SITE_SETTINGS?.pwa_install_enabled === true);
  await expect(page.locator('#pwaInstallReminder')).toHaveClass(/show/, { timeout: 4000 });
  await expect(page.locator('#pwaInstallReminderAction')).toHaveText('كيف؟');
  await page.locator('#pwaInstallReminderAction').click();
  await expect(page.locator('#pwaInstallReminderText')).toContainText('إضافة إلى الشاشة الرئيسية');
  await expect(page.locator('#pwaInstallReminderAction')).toHaveText('تم');
  await context.close();
});

test('Android native install event drives the one-tap install notice', async ({ browser }) => {
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36',
    viewport: { width: 412, height: 915 },
    isMobile: true,
    hasTouch: true
  });
  const page = await context.newPage();
  await installSupabaseMock(page);
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.FLOWER_LIGHT_SITE_SETTINGS?.pwa_install_enabled === true);
  await page.evaluate(() => {
    window.__flInstallPromptCalled = false;
    const event = new Event('beforeinstallprompt');
    Object.defineProperty(event, 'prompt', { value: async () => { window.__flInstallPromptCalled = true; } });
    Object.defineProperty(event, 'userChoice', { value: Promise.resolve({ outcome: 'accepted' }) });
    window.dispatchEvent(event);
  });
  await expect(page.locator('#pwaInstallReminder')).toHaveClass(/show/, { timeout: 4000 });
  await page.locator('#pwaInstallReminderAction').click();
  await expect.poll(() => page.evaluate(() => window.__flInstallPromptCalled)).toBe(true);
  await context.close();
});

test('Android without a native install event sees no install notice', async ({ browser }) => {
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36',
    viewport: { width: 412, height: 915 },
    isMobile: true,
    hasTouch: true
  });
  const page = await context.newPage();
  await installSupabaseMock(page);
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.FLOWER_LIGHT_SITE_SETTINGS?.pwa_install_enabled === true);
  await page.waitForTimeout(2200);
  await expect(page.locator('#pwaInstallReminder')).toBeHidden();
  await context.close();
});

test('duplicate product runs in Chromium and opens its editor',async({page})=>{
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.addScriptTag({path:'tests/duplicate-fixture.js'});
  await page.evaluate(()=>{window.setupDuplicateFixture();window.confirm=()=>true;});
  // Load the files served by the same source/dist server as the site.
  await page.addScriptTag({url:new URL('admin-media.js?v=__FL_VERSION__',base).href});
  await page.evaluate(()=>Object.assign(window.FL_ADMIN_CORE,window.FL_ADMIN_MEDIA));
  await page.addScriptTag({url:new URL('admin-products.js?v=__FL_VERSION__',base).href});
  await page.evaluate(()=>window.FL_ADMIN_PRODUCTS.duplicateProduct('p1'));
  const state=await page.evaluate(()=>window.__duplicateState);
  expect(state.opened).toEqual(['p2']);
  expect(state.payload.is_visible).toBe(false);
  expect(state.copies).toHaveLength(2);
  expect(state.messages.at(-1)).toContain('تم إنشاء');
});

for(const rpcFails of [false,true]){
  test(`legacy images generate actual WebP pairs; RPC failure=${rpcFails}`,async({page})=>{
    await installSupabaseMock(page);
    await page.goto(base,{waitUntil:'domcontentloaded'});
    await page.addScriptTag({path:'tests/duplicate-fixture.js'});
    await page.evaluate(()=>{window.setupDuplicateFixture();window.confirm=()=>true;});
    await page.addScriptTag({url:new URL('admin-media.js?v=__FL_VERSION__',base).href});
    const result=await page.evaluate(async fails=>{
      const core=window.FL_ADMIN_CORE;
      core.products[0].image_path='c1/legacy.jpg';
      core.productImages=[{product_id:'p1',image_path:'c1/legacy.jpg'}];
      const canvas=document.createElement('canvas');canvas.width=1800;canvas.height=900;
      canvas.getContext('2d').fillRect(0,0,1800,900);
      core.imageUrl=()=>canvas.toDataURL('image/png');
      const uploads=[];let deleted=0;
      core.db.storage.from=()=>({upload:async(path,blob)=>{
        const bitmap=await createImageBitmap(blob);
        uploads.push({path,type:blob.type,width:bitmap.width,height:bitmap.height});bitmap.close();return {error:null};
      },remove:async()=>{deleted++;return {error:null};}});
      core.db.rpc=async()=>({data:2,error:fails?new Error('simulated network failure'):null});
      core.loadCatalogAdminData=async()=>{};
      const plan=window.FL_ADMIN_MEDIA.legacyImagePlan();
      await window.FL_ADMIN_MEDIA.optimizeLegacyImages();
      return {plan,uploads,deleted,messages:window.__duplicateState.messages};
    },rpcFails);
    expect(result.plan).toEqual(['c1/legacy.jpg']);
    expect(result.uploads.map(x=>x.type)).toEqual(['image/webp','image/webp']);
    expect(result.uploads.map(x=>x.width)).toEqual([1400,480]);
    expect(result.deleted).toBe(0);
    expect(result.messages.at(-1)).toContain(rpcFails?'توقفت':'اكتمل');
  });
}

test('business privacy renders dynamic fields and honors all hiding',async({page})=>{
  let data={fields:[
    {id:'legal',label:'الاسم التجاري',label_en:'Legal business name',value:'شركة بصائر الخليج',value_en:'Basair Gulf Company',sort_order:0},
    {id:'cr',label:'السجل التجاري',value:'1010230086',sort_order:1},
    {id:'tax',label:'الرقم الضريبي',value:'311199840200003',sort_order:2},
    {id:'contact',label:'للتواصل',value:'0560933353',sort_order:3}
  ],retention_days:180};
  await page.route('**/rest/v1/rpc/get_public_business_privacy',route=>route.fulfill({contentType:'application/json',body:JSON.stringify(data)}));
  await page.goto(new URL('privacy.html',base).href);
  await expect(page.locator('[data-business-field="legal"]')).toContainText('شركة بصائر الخليج');
  await expect(page.locator('[data-business-field="contact"]')).toContainText('0560933353');
  await expect(page.locator('[data-business-field="retention_days"]')).toContainText('180 يوم');
  await page.goto(new URL('privacy-en.html',base).href);
  await expect(page.locator('[data-business-field="legal"]')).toContainText('Legal business name');
  await expect(page.locator('[data-business-field="legal"]')).toContainText('Basair Gulf Company');
  await expect(page.locator('[data-business-field="retention_days"]')).toContainText('180 days');
  await page.goto(new URL('privacy.html',base).href);
  await expect(page.locator('.fl-business-info-head')).toContainText('بيانات المنشأة');
  data={fields:[{id:'legal',label:'الاسم الرسمي',value:'شركة معدلة',sort_order:0}],retention_days:90};
  await page.reload();
  await expect(page.locator('[data-business-field="legal"]')).toContainText('الاسم الرسمي');
  await expect(page.locator('[data-business-field="legal"]')).toContainText('شركة معدلة');
  await expect(page.locator('[data-business-field="tax"]')).toHaveCount(0);
  data={};await page.reload();
  await expect(page.locator('#flBusinessStatus')).toBeHidden();
  await expect(page.locator('#flBusinessInfo')).toBeHidden();
  await expect(page.locator('body')).not.toContainText('311199840200003');
});

test('company footer shows configurable WhatsApp names as safe clickable links',async({page})=>{
  let data={fields:[
    {id:'company',label:'الاسم التجاري',label_en:'Legal business name',value:'شركة بصائر الخليج',value_en:'Basair Gulf Company',sort_order:0},
    {id:'wa',label:'مندوب الجملة',label_en:'Wholesale Representative',value:'whatsapp:966501234567',sort_order:1}
  ]};
  await page.route('**/rest/v1/rpc/get_public_business_privacy',route=>route.fulfill({contentType:'application/json',body:JSON.stringify(data)}));
  await page.goto(base);
  const link=page.locator('#flBusinessInfo [data-business-field="wa"]');
  await expect(link).toBeVisible();
  await expect(link).toContainText('مندوب الجملة');
  await expect(link).toHaveAttribute('href','https://wa.me/966501234567');
  await expect(link).toHaveAttribute('rel','noopener noreferrer');
  await expect(page.locator('#flBusinessInfo')).not.toContainText('966501234567');
  await expect(page.locator('#flBusinessInfo [data-business-field="company"]')).toContainText('شركة بصائر الخليج');
  await page.locator('#flLanguageSwitch').click();
  await expect(link).toContainText('Wholesale Representative');
  await expect(link).toHaveAttribute('href','https://wa.me/966501234567');
  await expect(page.locator('#flBusinessInfo [data-business-field="company"]')).toContainText('Legal business name');
  await expect(page.locator('#flBusinessInfo [data-business-field="company"]')).toContainText('Basair Gulf Company');
  await page.locator('#flLanguageSwitch').click();
  await expect(link).toContainText('مندوب الجملة');
  await expect(page.locator('#flBusinessInfo [data-business-field="company"]')).toContainText('شركة بصائر الخليج');
  // The owner can turn visibility off; no stale link is rendered on refresh.
  data={fields:[{id:'company',label:'الاسم التجاري',value:'شركة بصائر الخليج',sort_order:0}]};
  await page.reload();
  await expect(page.locator('#flBusinessInfo [data-business-field="wa"]')).toHaveCount(0);
  await expect(page.locator('#flBusinessInfo [data-business-field="company"]')).toBeVisible();
});

test('owner can add rename reorder hide and delete flexible business fields',async({page})=>{
  await installSupabaseMock(page);await page.goto(base);
  await page.evaluate(()=>{
    window.__businessSaved=null;window.__businessFieldsSaved=null;window.__businessDeleted=[];
    const privacy={id:1,retention_days:180,show_all:true,show_retention_days:true};
    const fields=[
      {id:'11111111-1111-4111-8111-111111111111',label:'الاسم التجاري',value:'شركة بصائر الخليج',is_visible:true,sort_order:0},
      {id:'22222222-2222-4222-8222-222222222222',label:'السجل التجاري',value:'1010230086',is_visible:true,sort_order:1}
    ];
    function table(name){
      if(name==='business_privacy_settings')return {
        select:()=>({eq:()=>({maybeSingle:async()=>({data:privacy,error:null})})}),
        upsert:async row=>{window.__businessSaved=row;Object.assign(privacy,row);return {error:null};}
      };
      if(name==='business_public_fields')return {
        select:()=>({order:async()=>({data:fields,error:null})}),
        upsert:async rows=>{window.__businessFieldsSaved=rows;return {error:null};},
        delete:()=>({in:async (column,ids)=>{window.__businessDeleted=ids;return {error:null};}})
      };
      throw new Error('Unexpected table '+name);
    }
    window.FL_ADMIN_CORE={isPrimaryAdmin:true,canManageSection:()=>window.FL_ADMIN_CORE.isPrimaryAdmin,esc:s=>String(s??'').replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;'),notify(){},db:{from:table,rpc:async()=>({data:0,error:null})}};
  });
  await page.addScriptTag({url:new URL('admin-business.js?v=__FL_VERSION__',base).href});
  await page.evaluate(async()=>{await window.FL_ADMIN_BUSINESS.load();const render=()=>{document.body.innerHTML=window.FL_ADMIN_BUSINESS.cardsHtml();window.FL_ADMIN_BUSINESS.bind(render);};render();});
  await expect(page.locator('[data-business-row]')).toHaveCount(2);
  await page.locator('[data-business-row]').nth(0).locator('[data-business-label]').fill('الاسم الرسمي');
  await page.locator('[data-business-row]').nth(0).locator('[data-business-label-en]').fill('Registered name');
  await page.locator('[data-business-row]').nth(0).locator('[data-business-value]').fill('شركة بصائر الخليج الجديدة');
  await page.locator('[data-business-row]').nth(0).locator('[data-business-value-en]').fill('Basair Gulf Updated');
  await page.locator('#flBusinessAddField').click();
  await page.locator('[data-business-row]').nth(2).locator('[data-business-label]').fill('خدمة العملاء');
  await page.locator('[data-business-row]').nth(2).locator('[data-business-label-en]').fill('Customer service');
  await page.locator('[data-business-row]').nth(2).locator('[data-business-value]').fill('0500000000');
  await page.locator('[data-business-row]').nth(1).locator('[data-business-action="delete"]').click();
  await expect(page.locator('[data-business-row]')).toHaveCount(2);
  await page.locator('#flBusinessAddWhatsApp').click();
  await expect(page.locator('[data-business-row]')).toHaveCount(3);
  const whatsappRow=page.locator('[data-business-row]').nth(2);
  await whatsappRow.locator('[data-business-label]').fill('مندوب الجملة');
  await whatsappRow.locator('[data-business-label-en]').fill('Wholesale Representative');
  await expect(whatsappRow.locator('[data-business-value-en]')).toHaveCount(0);
  await whatsappRow.locator('[data-business-value]').fill('not-a-number');
  await page.locator('#flBusinessSave').click();
  expect(await page.evaluate(()=>window.__businessFieldsSaved)).toBeNull();
  await whatsappRow.locator('[data-business-value]').fill('0501234567');
  await page.locator('#flBusiness_retention_days').fill('90');
  await page.locator('#flBusinessSave').click();
  await expect.poll(()=>page.evaluate(()=>window.__businessSaved?.retention_days)).toBe(90);
  const saved=await page.evaluate(()=>({settings:window.__businessSaved,fields:window.__businessFieldsSaved,deleted:window.__businessDeleted}));
  expect(saved.settings.show_all).toBe(true);
  expect(saved.fields.map(x=>x.label)).toEqual(['الاسم الرسمي','خدمة العملاء','مندوب الجملة']);
  expect(saved.fields.map(x=>x.sort_order)).toEqual([0,1,2]);
  expect(saved.fields[0].label_en).toBe('Registered name');
  expect(saved.fields[0].value_en).toBe('Basair Gulf Updated');
  expect(saved.fields[1].label_en).toBe('Customer service');
  expect(saved.fields[1].value_en).toBe('');
  expect(saved.fields[2].label_en).toBe('Wholesale Representative');
  expect(saved.fields[2].value_en).toBe('');
  expect(saved.fields[2].value).toBe('whatsapp:966501234567');
  expect(saved.deleted).toEqual(['22222222-2222-4222-8222-222222222222']);
  await page.locator('.fl-business-master-toggle').click();
  await expect(page.locator('#flBusinessShowAll')).not.toBeChecked();
  await page.locator('#flBusinessSave').click();
  await expect.poll(()=>page.evaluate(()=>window.__businessSaved?.show_all)).toBe(false);
  const hidden=await page.evaluate(()=>{window.FL_ADMIN_CORE.isPrimaryAdmin=false;return window.FL_ADMIN_BUSINESS.cardsHtml();});
  expect(hidden).toBe('');
});

test('public bank accounts render and expose copy actions',async({page})=>{
  await installSupabaseMock(page);
  await page.route('**/rest/v1/rpc/get_public_business_privacy',route=>route.fulfill({contentType:'application/json',body:'{}'}));
  await page.route('**/rest/v1/rpc/get_public_bank_accounts',route=>route.fulfill({contentType:'application/json',body:JSON.stringify([{id:'bank-1',bank_name:'مصرف الراجحي',beneficiary_name:'شركة بصائر الخليج',iban:'SA0380000000608010167519',account_number:'608010167519',swift_code:'RJHISARI',note:'للحوالات البنكية فقط',is_primary:true,sort_order:0}])}));
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await expect(page.locator('#flBankAccounts')).toBeVisible();
  const bankToggle=page.locator('#flBankAccounts .fl-bank-toggle');
  await expect(bankToggle).toHaveAttribute('aria-expanded','false');
  await expect(page.locator('#flBankAccountsPanel')).toBeHidden();
  await bankToggle.click();
  await expect(bankToggle).toHaveAttribute('aria-expanded','true');
  await expect(page.locator('#flBankAccountsPanel')).toBeVisible();
  await expect(page.locator('[data-bank-account="bank-1"]')).toContainText('مصرف الراجحي');
  await expect(page.locator('[data-bank-account="bank-1"]')).toContainText('شركة بصائر الخليج');
  await expect(page.locator('[data-bank-account="bank-1"]')).toContainText('SA03 8000 0000 6080 1016 7519');
  await expect(page.locator('[data-bank-account="bank-1"] .fl-bank-copy')).toHaveCount(3);
  await bankToggle.click();
  await expect(page.locator('#flBankAccountsPanel')).toBeHidden();
});

test('owner can manage bank accounts and validate Saudi IBAN',async({page})=>{
  await installSupabaseMock(page);
  await page.route('**/rest/v1/rpc/get_public_business_privacy',route=>route.fulfill({contentType:'application/json',body:'{}'}));
  await page.route('**/rest/v1/rpc/get_public_bank_accounts',route=>route.fulfill({contentType:'application/json',body:'[]'}));
  await page.goto(base);
  await page.evaluate(()=>{
    window.__bankSaved=null;window.__bankDeleted=[];
    const accounts=[{id:'11111111-1111-4111-8111-111111111111',bank_name:'مصرف الراجحي',beneficiary_name:'شركة بصائر الخليج',iban:'SA0380000000608010167519',account_number:'',swift_code:'',note:'',is_visible:true,is_primary:true,sort_order:0}];
    const table=()=>({
      select(){return this;},order(){return this;},then(resolve){return Promise.resolve({data:accounts,error:null}).then(resolve);},
      delete(){return {in:async ids=>{window.__bankDeleted=ids;return {error:null};}};},
      update(){return {eq:async()=>({error:null})};},
      upsert:async rows=>{window.__bankSaved=rows;return {error:null};}
    });
    window.FL_ADMIN_CORE={isPrimaryAdmin:true,canManageSection:()=>window.FL_ADMIN_CORE.isPrimaryAdmin,esc:s=>String(s??'').replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;'),notify(){},db:{from:table}};
  });
  await page.addScriptTag({url:new URL('admin-banks.js?v=__FL_VERSION__',base).href});
  await page.evaluate(async()=>{await window.FL_ADMIN_BANKS.load();document.body.innerHTML=window.FL_ADMIN_BANKS.cardsHtml();window.FL_ADMIN_BANKS.bind(()=>{});});
  await expect(page.locator('[data-bank-row]')).toHaveCount(1);
  await page.locator('#flBankAdd').click();
  await page.locator('[data-bank-row]').nth(1).locator('[data-bank-name]').fill('بنك إضافي');
  await page.locator('[data-bank-row]').nth(1).locator('[data-bank-account-number]').fill('1234567890');
  await page.locator('[data-bank-row]').nth(1).locator('[data-bank-primary]').check();
  await page.locator('#flBankSave').click();
  await expect.poll(()=>page.evaluate(()=>window.__bankSaved?.length||0)).toBe(2);
  const saved=await page.evaluate(()=>window.__bankSaved);
  expect(saved.filter(x=>x.is_primary)).toHaveLength(1);
  expect(await page.evaluate(()=>window.FL_ADMIN_BANKS.validIban('SA0380000000608010167519'))).toBe(true);
  expect(await page.evaluate(()=>window.FL_ADMIN_BANKS.validIban('SA1500000000000000000000'))).toBe(false);
});


test('visitor can override system theme and saved choice survives reload',async({page})=>{
  await installSupabaseMock(page);
  await page.emulateMedia({colorScheme:'dark'});
  await page.goto(base,{waitUntil:'domcontentloaded'});
  const toggle=page.locator('#flThemeSwitch');
  await expect(toggle).toContainText('تلقائي');
  await expect(page.locator('#flDarkThemeCss')).toHaveAttribute('media','(prefers-color-scheme: dark)');
  await toggle.click();
  await expect(toggle).toContainText('فاتح');
  await expect(page.locator('#flDarkThemeCss')).toHaveAttribute('media','not all');
  await page.reload();
  await expect(toggle).toContainText('فاتح');
  await toggle.click();
  await expect(toggle).toContainText('داكن');
  await expect(page.locator('#flDarkThemeCss')).toHaveAttribute('media','all');
  await page.reload();
  await expect(toggle).toContainText('داكن');
  await toggle.click();
  await expect(toggle).toContainText('تلقائي');
  expect(await page.evaluate(()=>localStorage.getItem('flowerlight:public-theme'))).toBeNull();
});


test('theme toggle stays at upper-right of card on phone and desktop',async({page})=>{
  await installSupabaseMock(page);
  for(const width of [390,1280]){
    await page.setViewportSize({width,height:900});
    await page.goto(base,{waitUntil:'domcontentloaded'});
    const button=page.locator('#flThemeSwitch');
    await expect(page.locator('#siteHero > #flThemeSwitch')).toBeVisible();
    const card=await page.locator('#publicCard').boundingBox();
    const hero=await page.locator('#siteHero').boundingBox();
    const toggle=await button.boundingBox();
    expect(card).not.toBeNull();
    expect(hero).not.toBeNull();
    expect(toggle).not.toBeNull();
    expect(toggle.x).toBeGreaterThan(card.x+card.width/2);
    expect(Math.abs((toggle.x+toggle.width)-(hero.x+hero.width))).toBeLessThan(45);
    expect(toggle.y).toBeGreaterThanOrEqual(hero.y);
    expect(toggle.y+toggle.height).toBeLessThan(hero.y+hero.height);
    const brand=await page.locator('#siteBrandRow').boundingBox();
    if(brand)expect(Math.abs((toggle.y+toggle.height/2)-(brand.y+brand.height/2))).toBeLessThan(35);
    const logo=await page.locator('#siteLogo').boundingBox();
    if(logo)expect(toggle.x).toBeGreaterThan(logo.x+logo.width+8);
  }
});


test('visitor switches Arabic and English, preserving products and language choice',async({page})=>{
  await installSupabaseMock(page);
  await page.setViewportSize({width:390,height:844});
  await page.goto(base,{waitUntil:'domcontentloaded'});
  const switcher=page.locator('#flLanguageSwitch');
  await expect(switcher).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang','ar');
  await expect(page.locator('#openProducts strong')).toHaveText('منتجاتنا');
  await switcher.click();
  await expect(page.locator('html')).toHaveAttribute('lang','en');
  await expect(page.locator('html')).toHaveAttribute('dir','ltr');
  await expect(page.locator('#openProducts strong')).toHaveText('Our Products');
  await expect(page.locator('#productsButtonSubtitle')).toHaveText('Browse categories and products');
  await expect(switcher).toHaveText('العربية');
  await injectCatalogFixtures(page);
  await page.locator('#openProducts').click();
  await expect(page.locator('#catalogModal')).toHaveClass(/open/);
  await expect(page.locator('#catalogSearchInput')).toHaveAttribute('placeholder','Search categories (name, code or specifications)…');
  await expect(page.locator('#catalogTitle')).toHaveText('Our Products');
  // Content authored only in Arabic remains as supplied, never machine-invented.
  await expect(page.locator('#catalogModal')).toContainText('منتج تجريبي');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang','en');
  await expect(page.locator('#openProducts strong')).toHaveText('Our Products');
  await page.locator('#flLanguageSwitch').click();
  await expect(page.locator('html')).toHaveAttribute('lang','ar');
  await expect(page.locator('#openProducts strong')).toHaveText('منتجاتنا');
});

test('language and appearance controls remain separated on mobile and desktop',async({page})=>{
  await installSupabaseMock(page);
  for(const width of [390,1280]){
    await page.setViewportSize({width,height:900});
    await page.goto(base,{waitUntil:'domcontentloaded'});
    const language=await page.locator('#flLanguageSwitch').boundingBox();
    const theme=await page.locator('#flThemeSwitch').boundingBox();
    const hero=await page.locator('#siteHero').boundingBox();
    expect(language).not.toBeNull();
    expect(theme).not.toBeNull();
    expect(hero).not.toBeNull();
    expect(language.y).toBeGreaterThanOrEqual(theme.y+theme.height);
    expect(language.x+language.width).toBeLessThanOrEqual(hero.x+hero.width+1);
    expect(language.y+language.height).toBeLessThan(hero.y+hero.height);
  }
});


test('privacy policy uses the selected language and links to the other language',async({page})=>{
  await installSupabaseMock(page);
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.locator('#flLanguageSwitch').click();
  const englishHref=await page.locator('#flLeadGate a[href$="privacy-en.html"]').getAttribute('href');
  expect(englishHref).toBe('privacy-en.html');
  await page.goto(new URL('privacy-en.html',base).href,{waitUntil:'domcontentloaded'});
  await expect(page.locator('html')).toHaveAttribute('lang','en');
  await expect(page.locator('h1')).toHaveText('Privacy Policy');
  await expect(page.locator('.language-nav a')).toHaveAttribute('href','privacy.html');
  await page.goto(new URL('privacy.html',base).href,{waitUntil:'domcontentloaded'});
  await expect(page.locator('html')).toHaveAttribute('lang','ar');
  await expect(page.locator('h1')).toHaveText('سياسة الخصوصية');
  await expect(page.locator('.language-nav a')).toHaveAttribute('href','privacy-en.html');
});


test('v116 bilingual category, product name and technical specs follow visitor language',async({page})=>{
  await installSupabaseMock(page);
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await injectCatalogFixtures(page);
  await page.evaluate(()=>{
    const section=window.FLOWER_LIGHT_PRODUCTS.extraSections[0];
    section.name_en='Wall Lighting';
    section.description_en='English section description';
    section.items[0].name_en='Sample Wall Light';
    section.items[0].caption_en='English product description';
    section.items[0].specifications_en=[
      {key:'custom_1',label:'Wattage',value:'12W',unit:''},
      {key:'custom_2',label:'Color temperature',value:'3000K',unit:''},
      {key:'color',label:'Color',value:'Black',unit:''}
    ];
    window.flRenderProducts();
  });
  await page.locator('#openProducts').click();
  await expect(page.locator('.extra-section-tab strong')).toContainText('جداريات');
  await expect(page.locator('.extra-section-panel .extra-section-intro')).toContainText('قسم تجريبي');
  await page.locator('#closeProducts').click();
  await page.locator('#flLanguageSwitch').click();
  await page.locator('#openProducts').click();
  await expect(page.locator('.extra-section-tab strong')).toHaveText('Wall Lighting');
  await expect(page.locator('.extra-section-panel .extra-section-intro')).toHaveText('English section description');
  await expect(page.locator('.chandelier-card')).toContainText('Wattage');
  await expect(page.locator('.chandelier-card')).toContainText('Black');
  await expect(page.locator('.category-download-button')).toContainText('Download category Wall Lighting');
  await page.locator('#catalogSearchInput').fill('Sample Wall Light');
  await expect(page.locator('.chandelier-card').first()).not.toHaveClass(/catalog-search-hidden/);
  await page.locator('#catalogSearchInput').fill('جداري تجريبي');
  await expect(page.locator('.chandelier-card').first()).not.toHaveClass(/catalog-search-hidden/);
  await page.locator('#catalogSearchInput').fill('');
  await page.locator('#closeProducts').click();
  await page.locator('#flLanguageSwitch').click();
  await page.locator('#openProducts').click();
  await expect(page.locator('.extra-section-tab strong')).toHaveText('جداريات');
  await expect(page.locator('.chandelier-card')).toContainText('أسود');
  await expect(page.locator('.extra-section-panel .extra-section-intro')).toContainText('قسم تجريبي');
});


test('v117 public card localizes profile contacts and marketing lines without losing Arabic',async({page})=>{
  await installSupabaseMock(page);
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof window.flLoadPublicProfile==='function');
  await page.evaluate(()=>{
    window.FLOWER_LIGHT_PROFILE={
      brand_name:'flower light',brand_name_en:'Flower Light',
      company_name:'شركة بصائر الخليج',company_name_en:'Basair Gulf',
      full_name:'Saeed Naji',job_title_ar:'مدير مبيعات',job_title_en:'Sales Manager'
    };
    window.FLOWER_LIGHT_CONTACTS=[
      {type:'phone',label:'فرع الفيصلية',label_en:'Al Faisaliyah branch',value:'0560933353',is_visible:true},
      {type:'whatsapp',label:'فرع الفيصلية',label_en:'Al Faisaliyah branch',value:'0560933353',is_visible:true},
      {type:'location',label:'الفرع الرئيسي',label_en:'Main branch',value:'https://maps.google.com/?q=KSA',is_visible:true}
    ];
    window.dispatchEvent(new CustomEvent('flowerlight:language-change',{detail:{language:'ar'}}));
  });
  await expect(page.locator('#siteCompanyName')).toHaveText('شركة بصائر الخليج');
  await expect(page.locator('#siteJobTitleAr')).toHaveText('مدير مبيعات');
  await expect(page.locator('#productsButtonSubtitle')).toHaveText('كتالوج منتجات flower light');
  await expect(page.locator('#contactInfoList')).toContainText('فرع الفيصلية');
  await page.locator('#flLanguageSwitch').click();
  await expect(page.locator('html')).toHaveAttribute('lang','en');
  await expect(page.locator('#siteCompanyName')).toHaveText('Basair Gulf');
  await expect(page.locator('#siteBrandName')).toHaveText('Flower Light');
  await expect(page.locator('#siteJobTitleAr')).toBeHidden();
  await expect(page.locator('#siteJobTitleEn')).toHaveText('Sales Manager');
  await expect(page.locator('#productsButtonSubtitle')).toHaveText('Explore Flower Light products');
  await expect(page.locator('#catalogNote')).toHaveText('Browse Flower Light categories and products.');
  await expect(page.locator('#contactInfoList')).toContainText('Al Faisaliyah branch');
  await expect(page.locator('#contactInfoList')).toContainText('Call or WhatsApp');
  await expect(page.locator('#quickActions')).toContainText('Al Faisaliyah branch');
  await expect(page.locator('#siteFooter')).toContainText('Flower Light');
  await page.locator('#flLanguageSwitch').click();
  await expect(page.locator('#siteCompanyName')).toHaveText('شركة بصائر الخليج');
  await expect(page.locator('#siteJobTitleAr')).toHaveText('مدير مبيعات');
  await expect(page.locator('#productsButtonSubtitle')).toHaveText('كتالوج منتجات flower light');
});

test('v117 built-in marketing aliases translate without authoring English profile rows',async({page})=>{
  await installSupabaseMock(page);
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof window.flLoadPublicProfile==='function');
  await page.evaluate(()=>{
    window.FLOWER_LIGHT_PROFILE={brand_name:'Flower Light',company_name:'شركة بصائر الخليج',job_title_ar:'مدير مبيعات'};
    window.FLOWER_LIGHT_CONTACTS=[];
    window.dispatchEvent(new CustomEvent('flowerlight:language-change',{detail:{language:'ar'}}));
  });
  await page.locator('#flLanguageSwitch').click();
  await expect(page.locator('#siteCompanyName')).toHaveText('Basair Gulf');
  await expect(page.locator('#siteJobTitleAr')).toHaveText('Sales Manager');
  await expect(page.locator('#productsButtonSubtitle')).toHaveText('Explore Flower Light products');
});


// Final acceptance audit (non-production tests): locale/theme/viewport matrix.
for (const {width,colorScheme,language} of [
  {width:360,colorScheme:'light',language:'ar'},
  {width:390,colorScheme:'dark',language:'en'},
  {width:1280,colorScheme:'light',language:'en'},
  {width:1280,colorScheme:'dark',language:'ar'},
]) {
  test('acceptance: '+width+'px '+language+' '+colorScheme+' catalog and navigation stay usable',async({page})=>{
    await page.setViewportSize({width,height:900});
    await page.emulateMedia({colorScheme});
    await installSupabaseMock(page);
    await page.goto(base,{waitUntil:'domcontentloaded'});
    await injectCatalogFixtures(page);
    await expect(page.locator('#flThemeSwitch')).toBeVisible();
    await expect(page.locator('#flLanguageSwitch')).toBeVisible();
    if(language==='en'){
      await page.locator('#flLanguageSwitch').click();
      await expect(page.locator('#openProducts strong')).toHaveText('Our Products');
    }else await expect(page.locator('#openProducts strong')).toHaveText('منتجاتنا');
    await expect(page.locator('html')).toHaveAttribute('lang',language);
    await expect(page.locator('html')).toHaveAttribute('dir',language==='en'?'ltr':'rtl');
    await expect(page.locator('#flDarkThemeCss')).toHaveAttribute('media','(prefers-color-scheme: dark)');
    await expect.poll(()=>page.evaluate(()=>getComputedStyle(document.documentElement).colorScheme))
      .toContain(colorScheme);
    await page.locator('#openProducts').click();
    await expect(page.locator('#catalogModal')).toHaveClass(/open/);
    await expect(page.locator('#catalogSearchInput')).toBeVisible();
    await page.locator('#catalogSearchInput').fill('WL-TEST');
    await expect(page.locator('.catalog-panel.active .chandelier-card:not(.catalog-search-hidden)')).toHaveCount(1);
    await page.locator('#catalogSearchInput').fill('');
    await expect(page.locator('.product-whatsapp-button')).toHaveAttribute('href',/^https:\/\/wa\.me\/966/);
    const geometry=await page.evaluate(()=>{
      const visible=id=>document.querySelector(id).getBoundingClientRect();
      const toggle=visible('#flThemeSwitch'),locale=visible('#flLanguageSwitch');
      return {
        viewport:innerWidth,
        rootWidth:document.documentElement.scrollWidth,
        toggleInViewport:toggle.right<=innerWidth&&toggle.left>=0,
        localeInViewport:locale.right<=innerWidth&&locale.left>=0,
        noOverlap:toggle.bottom<=locale.top
      };
    });
    expect(geometry.rootWidth).toBeLessThanOrEqual(geometry.viewport+2);
    expect(geometry.toggleInViewport).toBe(true);
    expect(geometry.localeInViewport).toBe(true);
    expect(geometry.noOverlap).toBe(true);
    await page.locator('#closeProducts').click();
    await expect(page.locator('#catalogModal')).not.toHaveClass(/open/);
  });
}

test('acceptance: downloading product JPG produces a valid nonempty JPEG file',async({page})=>{
  await installSupabaseMock(page);
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await injectCatalogFixtures(page);
  await page.locator('#openProducts').click();
  await page.locator('.product-download-pdf-button').click();
  await expect(page.locator('#exportChoiceModal')).toHaveClass(/open/);
  const downloadPromise=page.waitForEvent('download',{timeout:25000});
  await page.locator('#exportChoiceJpg').click();
  const download=await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/-product\.jpg$/);
  const path=await download.path();
  const buffer=fs.readFileSync(path);
  expect(buffer.length).toBeGreaterThan(10000);
  expect([...buffer.subarray(0,3)]).toEqual([255,216,255]);
  expect([...buffer.subarray(-2)]).toEqual([255,217]);
});


test('acceptance: product PDF export produces a real readable PDF header',async({page})=>{
  await installSupabaseMock(page);
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await injectCatalogFixtures(page);
  await page.locator('#openProducts').click();
  await page.locator('.product-download-pdf-button').click();
  await expect(page.locator('#exportChoiceModal')).toHaveClass(/open/);
  const downloadPromise=page.waitForEvent('download',{timeout:26000});
  await page.locator('#exportChoicePdf').click();
  const download=await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/-product\.pdf$/);
  const path=await download.path();
  const bytes=fs.readFileSync(path);
  expect(bytes.length).toBeGreaterThan(10000);
  expect(bytes.subarray(0,5).toString('latin1')).toBe('%PDF-');
});


test('release: PDF downloads still work when the external jsPDF CDN is blocked',async({page})=>{
  test.skip(process.env.FL_TEST_DIST!=='1','Self-hosted vendor is generated only for production builds');
  await installSupabaseMock(page);
  const externalRequests=[];
  await page.route('**/npm/jspdf@*/dist/jspdf.umd.min.js',route=>{
    externalRequests.push(route.request().url());
    return route.abort();
  });
  await page.goto(base,{waitUntil:'load'});
  await injectCatalogFixtures(page);
  await page.locator('#openProducts').click();
  await page.locator('.product-download-pdf-button').click();
  const downloadPromise=page.waitForEvent('download',{timeout:40000});
  await page.locator('#exportChoicePdf').click();
  const download=await downloadPromise;
  const bytes=fs.readFileSync(await download.path());
  expect(bytes.subarray(0,5).toString('latin1')).toBe('%PDF-');
  expect(bytes.length).toBeGreaterThan(10000);
  const vendor=await page.evaluate(()=>document.querySelector('script[data-fl-jspdf]')?.getAttribute('src')||'');
  expect(vendor).toMatch(/^jspdf-vendor\.js\?v=/);
  expect(externalRequests).toHaveLength(0);
});

test('acceptance: multi-product catalog PDF downloads a valid multi-page document',async({page})=>{
  await installSupabaseMock(page);
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await injectCatalogFixtures(page);
  await page.evaluate(()=>{
    const section=window.FLOWER_LIGHT_PRODUCTS.extraSections[0];
    section.items.push({...section.items[0],id:'prod-test-2',model:'WL-TEST-2',name:'جداري تجريبي ثان'});
    window.flRenderProducts();
  });
  await page.locator('#openProducts').click();
  await expect(page.locator('#catalogDownloadPdf')).toBeEnabled();
  await page.locator('#catalogDownloadPdf').click();
  await expect(page.locator('#exportChoiceModal')).toHaveClass(/open/);
  const downloadPromise=page.waitForEvent('download',{timeout:45000});
  await page.locator('#exportChoicePdf').click();
  const download=await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.pdf$/);
  const bytes=fs.readFileSync(await download.path());
  expect(bytes.length).toBeGreaterThan(15000);
  const pdf=bytes.toString('latin1');
  expect(pdf.startsWith('%PDF-')).toBe(true);
  expect((pdf.match(/\/Type \/Page\b/g)||[]).length).toBeGreaterThanOrEqual(2);
});

test('release: admin datasheet PDF submit works without any external jsPDF request',async({page})=>{
  test.skip(process.env.FL_TEST_DIST!=='1','Self-hosted vendor is generated only for production builds');
  await installSupabaseMock(page);
  let externalJsPdfCalls=0;
  await page.route('**/npm/jspdf@*/dist/jspdf.umd.min.js',route=>{externalJsPdfCalls++;return route.abort();});
  await page.goto(new URL('?admin=1',base).href,{waitUntil:'load'});
  await page.waitForFunction(()=>Boolean(window.FL_ADMIN_DATASHEET?.renderDatasheetDesigner));
  await page.evaluate(()=>{
    const core=window.FL_ADMIN_CORE;
    core.view='datasheet';
    core.db.rpc=async()=>({data:[{key:'datasheet_1',label:'القدرة',unit:'W'}],error:null});
    window.FL_ADMIN_DATASHEET.renderDatasheetDesigner();
  });
  await page.waitForSelector('#flDatasheetDesignerForm');
  const pngBytes=await page.evaluate(()=>{
    const c=document.createElement('canvas');
    c.width=200;c.height=200;
    c.getContext('2d').fillStyle='#e62a59';
    c.getContext('2d').fillRect(0,0,c.width,c.height);
    return [...Uint8Array.from(atob(c.toDataURL('image/png').split(',')[1]),s=>s.charCodeAt(0))];
  });
  await page.locator('#flDatasheetImage').setInputFiles({name:'test.png',mimeType:'image/png',buffer:Buffer.from(pngBytes)});
  await page.locator('#flDatasheetName').evaluate(el=>{el.value='اختبار داتا شيت';});
  await page.locator('#flDatasheetCode').evaluate(el=>{el.value='DATASHEET-LOCAL';});
  await page.evaluate(()=>document.getElementById('flDatasheetDesignerForm').requestSubmit());
  await expect.poll(()=>page.evaluate(()=>document.getElementById('exportChoiceModal')?.classList.contains('open'))).toBe(true);
  const downloadPromise=page.waitForEvent('download',{timeout:45000});
  await page.evaluate(()=>document.getElementById('exportChoicePdf')?.click());
  const download=await downloadPromise;
  expect(download.suggestedFilename()).toBe('DATASHEET-LOCAL-datasheet.pdf');
  const bytes=fs.readFileSync(await download.path());
  expect(bytes.subarray(0,5).toString('latin1')).toBe('%PDF-');
  expect(bytes.length).toBeGreaterThan(10000);
  expect(externalJsPdfCalls).toBe(0);
});

test('acceptance: admin datasheet shared renderer downloads a real PDF with embedded image',async({page})=>{
  await installSupabaseMock(page);
  await page.goto(base,{waitUntil:'load'});
  await page.waitForFunction(()=>Boolean(window.flDatasheetPdf?.loadJsPdf && window.flDatasheetPdf?.createSinglePage));
  const downloadPromise=page.waitForEvent('download',{timeout:40000});
  const result=await page.evaluate(async()=>{
    const renderer=window.flDatasheetPdf;
    const swatch=document.createElement('canvas');
    swatch.width=200;swatch.height=200;
    const ctx=swatch.getContext('2d');
    ctx.fillStyle='#e62a59';ctx.fillRect(0,0,200,200);
    const img=swatch.toDataURL('image/png');
    const item={name:'منتج اختبار الداتا شيت',model:'DS-PDF-TEST',specifications:[{key:'wattage',label:'القدرة',value:'12',unit:'W'}],image:img,gallery:[{image:img,image_path:''}]};
    const {canvas,failedImages}=await renderer.createSinglePage(item,img,0,1,{scale:1});
    if(failedImages)throw new Error('Datasheet image was not rendered');
    const JsPdf=await renderer.loadJsPdf();
    const pdf=new JsPdf({orientation:'portrait',unit:'mm',format:'a4',compress:true});
    pdf.addImage(canvas.toDataURL('image/jpeg',renderer.qualities?.pdf||0.94),'JPEG',0,0,210,297,undefined,'FAST');
    renderer.triggerBlobDownload(pdf.output('blob'),'DS-PDF-TEST-datasheet.pdf');
    return {failedImages};
  });
  expect(result.failedImages).toBe(0);
  const download=await downloadPromise;
  expect(download.suggestedFilename()).toBe('DS-PDF-TEST-datasheet.pdf');
  const bytes=fs.readFileSync(await download.path());
  expect(bytes.length).toBeGreaterThan(10000);
  expect(bytes.subarray(0,5).toString('latin1')).toBe('%PDF-');
});

test('security: missing Turnstile site key must never fall back to direct customer insert',async({page})=>{
  await installSupabaseMock(page);
  const configSource=fs.readFileSync(new URL('../config.js',import.meta.url),'utf8');
  const testConfig=configSource.replace(/turnstileSiteKey:\s*'[^']*'/,"turnstileSiteKey: ''");
  expect(testConfig).not.toBe(configSource);
  await page.route('**/config.js*',route=>route.fulfill({status:200,contentType:'application/javascript',body:testConfig}));
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof window.flBeforeProductsOpen==='function');
  await page.evaluate(()=>{
    localStorage.removeItem('flower_light_customer_access_v1');
    window.FLOWER_LIGHT_SITE_SETTINGS={require_customer_lead:true};
  });
  const pending=page.evaluate(()=>window.flBeforeProductsOpen());
  await expect(page.locator('#flLeadGate')).toHaveClass(/open/);
  await page.locator('#flLeadName').fill('Secure customer');
  await page.locator('#flLeadMobile').fill('0501234567');
  // Exercise the app's submit listener directly. Native HTML constraint checks
  // are a separate browser concern and could block the event before the
  // Turnstile fail-closed logic under test runs.
  await page.waitForTimeout(1100);
  await page.locator('#flLeadForm').evaluate(form=>{
    form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
  });
  await expect(page.locator('#flLeadError')).toContainText('التحقق الأمني غير مهيأ');
  await expect(page.locator('#flLeadGate')).toHaveClass(/open/);
  await expect.poll(()=>page.evaluate(()=>localStorage.getItem('flower_light_customer_access_v1'))).toBeNull();
  await page.locator('#flLeadClose').click();
  expect(await pending).toBe(false);
});


test.describe('datasheet local images with real production CSP',()=>{
  // Production CSP permits data: in img-src but NOT connect-src.
  // Prior code used fetch(data:image/...) and silently exported a placeholder.
  test.use({bypassCSP:false});

  test('an uploaded image is actually drawn into the JPG/PDF datasheet template',async({page})=>{
    await installSupabaseMock(page);
    await page.goto(base,{waitUntil:'load'});
    await page.waitForFunction(()=>Boolean(window.flDatasheetPdf?.createSinglePage));
    const result=await page.evaluate(async()=>{
      const csp=document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.content||'';
      const swatch=document.createElement('canvas');
      swatch.width=120;swatch.height=120;
      swatch.getContext('2d').fillStyle='#ec136a';
      swatch.getContext('2d').fillRect(0,0,120,120);
      const image=swatch.toDataURL('image/png');
      const source={name:'منتج اختبار صورة',model:'DS-IMG',caption:'',specifications:[]};
      const {canvas,failedImages}=await window.flDatasheetPdf.createSinglePage(source,image,0,1,{scale:1});
      const rgba=[...canvas.getContext('2d').getImageData(500,480,1,1).data];
      return {failedImages,rgba,csp};
    });
    expect(result.csp).toMatch(/img-src[^;]*data:/);
    expect(result.csp.match(/connect-src\s+([^;]+)/)?.[1]).not.toContain('data:');
    expect(result.failedImages).toBe(0);
    expect(result.rgba[0]).toBeGreaterThan(210);
    expect(result.rgba[1]).toBeLessThan(65);
    expect(result.rgba[2]).toBeGreaterThan(80);
    expect(result.rgba[2]).toBeLessThan(150);
  });
});


test('performance: visible logo priority and lazy offscreen product thumbnails',async({page})=>{
  await installSupabaseMock(page);
  await page.goto(base,{waitUntil:'load'});
  await injectCatalogFixtures(page);
  await expect(page.locator('#siteWatermark')).toHaveAttribute('loading','lazy');
  await expect(page.locator('#siteWatermark')).toHaveAttribute('fetchpriority','low');
  await expect(page.locator('#siteLogo')).toHaveAttribute('fetchpriority','high');
  await expect(page.locator('#siteWatermark')).toHaveAttribute('src',/company-watermark\.svg\?v=/);
  // The new watermark must genuinely have a transparent background; the header
  // keeps its original opaque logo while the dark card uses this isolated asset.
  const watermarkAlpha=await page.locator('#siteWatermark').evaluate(async image=>{
    await image.decode();
    const canvas=document.createElement('canvas');canvas.width=380;canvas.height=380;
    canvas.getContext('2d').drawImage(image,0,0,380,380);
    return canvas.getContext('2d').getImageData(0,0,1,1).data[3];
  });
  expect(watermarkAlpha).toBe(0);
  await expect(page.locator('link[rel="preload"][as="image"][href^="company-logo.png"]')).toHaveCount(1);
  await expect(page.locator('#sitePortrait')).toHaveAttribute('fetchpriority','high');
  await page.evaluate(()=>{
    const items=window.FLOWER_LIGHT_PRODUCTS.extraSections[0].items;
    for(let index=1;index<8;index++)items.push({...items[0],id:'prod-test-'+index,name:'جداري '+index});
    window.flRenderProducts();
  });
  await page.locator('#openProducts').click();
  const gallery=page.locator('.product-image-button img');
  await expect(gallery).toHaveCount(8);
  expect(await gallery.nth(0).evaluate(img=>({loading:img.loading,decoding:img.decoding,priority:img.fetchPriority})))
    .toEqual({loading:'lazy',decoding:'async',priority:'auto'});
  expect(await gallery.nth(6).evaluate(img=>({loading:img.loading,decoding:img.decoding,priority:img.fetchPriority})))
    .toEqual({loading:'lazy',decoding:'async',priority:'low'});
});

test('performance: catalog product cards are built on first open rather than the company-card load',async({page})=>{
  await installSupabaseMock(page);
  await page.goto(base,{waitUntil:'load'});
  await injectCatalogFixtures(page);
  expect(await page.locator('.chandelier-card').count()).toBe(0);
  await page.locator('#openProducts').click();
  await expect(page.locator('#catalogModal')).toHaveClass(/open/);
  await expect(page.locator('.chandelier-card')).toHaveCount(1);
  await expect(page.locator('.product-image-button img')).toHaveAttribute('loading','lazy');
});

test('admin navigation: mobile section chooser respects permissions and replaces scroll menu',async({page})=>{
  await installSupabaseMock(page);
  await page.setViewportSize({width:390,height:844});
  await page.goto(new URL('?admin=1',base).href,{waitUntil:'load'});
  await page.waitForFunction(()=>Boolean(window.FL_ADMIN_NAV?.render));
  const count=await page.evaluate(()=>{
    const nav=window.FL_ADMIN_NAV.render({
      view:'products',isPrimaryAdmin:false,
      allowed:new Set(['overview','products','leads']),
      adminViewItems:[['products','المنتجات'],['leads','جهات اتصال العملاء'],['sections','الأقسام']],
      ownerSettingsViewItems:[['site-settings','إعدادات الموقع']]
    });
    const host=document.createElement('div');
    host.innerHTML=nav;
    document.body.appendChild(host);
    return host.querySelectorAll('#flAdminViewSelect option').length;
  });
  expect(count).toBe(3);
  await expect(page.locator('#flAdminViewSelect')).toBeVisible();
  await expect(page.locator('.fl-admin-nav-wrap .fl-cloud-nav')).toBeHidden();
  await expect(page.locator('#flAdminViewSelect option[value="site-settings"]')).toHaveCount(0);
  await page.locator('#flAdminViewSelect').selectOption('leads');
  await expect(page.locator('#flAdminViewSelect')).toHaveValue('leads');
});


test('mobile catalog defers offscreen card painting without hiding products',async({page})=>{
  await installSupabaseMock(page);
  await page.setViewportSize({width:390,height:844});
  await page.goto(base,{waitUntil:'load'});
  await injectCatalogFixtures(page);
  await page.locator('#openProducts').click();
  await expect(page.locator('.extra-section-grid .chandelier-card')).toHaveCount(1);
  const mobile=await page.locator('.extra-section-grid .chandelier-card').first().evaluate(node=>({
    visibility:getComputedStyle(node).contentVisibility,
    minHeight:getComputedStyle(node).containIntrinsicSize,
    nativeLazy:node.querySelector('.product-image-button img')?.loading,
    decoding:node.querySelector('.product-image-button img')?.decoding
  }));
  expect(mobile.visibility).toBe('auto');
  expect(mobile.minHeight).toContain('450px');
  expect(mobile.nativeLazy).toBe('lazy');
  expect(mobile.decoding).toBe('async');
  await page.locator('#closeProducts').click();
  await page.setViewportSize({width:1280,height:800});
  await page.locator('#openProducts').click();
  const desktop=await page.locator('.extra-section-grid .chandelier-card').first().evaluate(node=>getComputedStyle(node).contentVisibility);
  expect(desktop).toBe('visible');
});

// A delayed mock simulates the cloud profile response while checking temporary space.
test('mobile profile loading reserves hero and contact actions until data arrives',async({page})=>{
  const slowProfile=supabaseMockScript
    .replace("if(table==='site_profile')return Promise.resolve({data:{},error:null});",
      "if(table==='site_profile')return new Promise(resolve=>setTimeout(()=>resolve({data:{brand_name:'Flower Light',company_name:'بصائر الخليج',full_name:'موظف المبيعات',job_title_ar:'مسؤول المبيعات'},error:null}),2500));")
    .replace("then(resolve){return Promise.resolve({data:[],error:null}).then(resolve);}",
      "then(resolve){if(table==='contact_items')return Promise.resolve({data:[{type:'whatsapp',value:'0560933353',is_visible:true}],error:null}).then(resolve);return Promise.resolve({data:[],error:null}).then(resolve);}");
  const fulfill=route=>route.fulfill({status:200,contentType:'application/javascript',body:slowProfile});
  await page.route('https://cdn.jsdelivr.net/npm/@supabase/**',fulfill);
  await page.route('**/supabase-vendor.js*',fulfill);
  await page.setViewportSize({width:390,height:844});
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await expect(page.locator('#publicCard')).toHaveClass(/fl-profile-pending/);
  const reserved=await page.evaluate(()=>{
    const hero=document.getElementById('siteHero'),save=document.getElementById('saveContact'),quick=document.getElementById('quickActions');
    return {hero:hero.getBoundingClientRect().height,save:save.getBoundingClientRect().height,quick:quick.getBoundingClientRect().height,
      saveHidden:save.hidden,quickHidden:quick.hidden,saveVisibility:getComputedStyle(save).visibility,quickVisibility:getComputedStyle(quick).visibility};
  });
  expect(reserved.hero).toBeGreaterThanOrEqual(500);
  expect(reserved.save).toBeGreaterThanOrEqual(58);
  expect(reserved.quick).toBeGreaterThanOrEqual(70);
  expect(reserved.saveHidden&&reserved.quickHidden).toBe(true);
  expect(reserved.saveVisibility).toBe('hidden');
  expect(reserved.quickVisibility).toBe('hidden');
  await expect(page.locator('#publicCard')).not.toHaveClass(/fl-profile-pending/, {timeout:10000});
  await expect(page.locator('#saveContact')).toBeVisible();
  await expect(page.locator('#quickActions')).toBeVisible();
  await expect(page.locator('#siteHero')).toBeVisible();
});
