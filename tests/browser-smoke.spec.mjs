import { test, expect } from '@playwright/test';

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
        specifications:[{key:'custom_1',label:'القدرة',value:'12W',unit:''}],price:100,wholesale_price:80,wholesale_min_qty:10,is_visible:true
      }]
    }]};
    window.flRenderProducts();
  });
}

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
  await page.goto(`${base}?product=prod-test`,{waitUntil:'domcontentloaded'});
  await injectCatalogFixtures(page);
  await expect(page.locator('#catalogModal')).toHaveClass(/open/);
  await expect(page.locator('#imageLightbox')).toHaveClass(/open/);
  await page.locator('#closeImageLightbox').click();
  await page.locator('#closeProducts').click();

  await page.goto(`${base}?category=wall-lights`,{waitUntil:'domcontentloaded'});
  await injectCatalogFixtures(page);
  await expect(page.locator('#catalogModal')).toHaveClass(/open/);
  await expect(page.locator('.extra-section-tab').filter({hasText:'جداريات'})).toHaveClass(/active/);
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
    {id:'legal',label:'الاسم التجاري',value:'شركة بصائر الخليج',sort_order:0},
    {id:'cr',label:'السجل التجاري',value:'1010230086',sort_order:1},
    {id:'tax',label:'الرقم الضريبي',value:'311199840200003',sort_order:2},
    {id:'contact',label:'للتواصل',value:'0560933353',sort_order:3}
  ],retention_days:180};
  await page.route('**/rest/v1/rpc/get_public_business_privacy',route=>route.fulfill({contentType:'application/json',body:JSON.stringify(data)}));
  await page.goto(new URL('privacy.html',base).href);
  await expect(page.locator('[data-business-field="legal"]')).toContainText('شركة بصائر الخليج');
  await expect(page.locator('[data-business-field="contact"]')).toContainText('0560933353');
  await expect(page.locator('[data-business-field="retention_days"]')).toContainText('180 يوم');
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
    window.FL_ADMIN_CORE={isPrimaryAdmin:true,esc:s=>String(s??'').replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;'),notify(){},db:{from:table,rpc:async()=>({data:0,error:null})}};
  });
  await page.addScriptTag({url:new URL('admin-business.js?v=__FL_VERSION__',base).href});
  await page.evaluate(async()=>{await window.FL_ADMIN_BUSINESS.load();const render=()=>{document.body.innerHTML=window.FL_ADMIN_BUSINESS.cardsHtml();window.FL_ADMIN_BUSINESS.bind(render);};render();});
  await expect(page.locator('[data-business-row]')).toHaveCount(2);
  await page.locator('[data-business-row]').nth(0).locator('[data-business-label]').fill('الاسم الرسمي');
  await page.locator('[data-business-row]').nth(0).locator('[data-business-value]').fill('شركة بصائر الخليج الجديدة');
  await page.locator('#flBusinessAddField').click();
  await page.locator('[data-business-row]').nth(2).locator('[data-business-label]').fill('خدمة العملاء');
  await page.locator('[data-business-row]').nth(2).locator('[data-business-value]').fill('0500000000');
  await page.locator('[data-business-row]').nth(1).locator('[data-business-action="delete"]').click();
  await expect(page.locator('[data-business-row]')).toHaveCount(2);
  await page.locator('#flBusiness_retention_days').fill('90');
  await page.locator('#flBusinessSave').click();
  await expect.poll(()=>page.evaluate(()=>window.__businessSaved?.retention_days)).toBe(90);
  const saved=await page.evaluate(()=>({settings:window.__businessSaved,fields:window.__businessFieldsSaved,deleted:window.__businessDeleted}));
  expect(saved.settings.show_all).toBe(true);
  expect(saved.fields.map(x=>x.label)).toEqual(['الاسم الرسمي','خدمة العملاء']);
  expect(saved.fields.map(x=>x.sort_order)).toEqual([0,1]);
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
    window.FL_ADMIN_CORE={isPrimaryAdmin:true,esc:s=>String(s??'').replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;'),notify(){},db:{from:table}};
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
