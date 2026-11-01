// Temporary read-only audit of the publicly deployed site in a real Chromium browser.
// This script never submits forms, signs in, or changes Supabase data.
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

const base='https://basair-alkhalij.github.io/Flower-light/';
const browser=await chromium.launch({headless:true});
try {
  const context=await browser.newContext({
    viewport:{width:390,height:844},
    locale:'ar-SA',
    serviceWorkers:'block'
  });
  const page=await context.newPage();
  const navigation=await page.goto(base,{waitUntil:'domcontentloaded',timeout:45000});
  assert.equal(navigation?.status(),200,'Live homepage HTTP status');
  await page.waitForFunction(()=>typeof window.flRenderProducts==='function'
    && Boolean(window.FL_CATALOG_EXPORT?.create)
    && Boolean(window.FL_CATALOG_SPECIFICATIONS),{timeout:30000});
  await page.locator('#openProducts').waitFor({state:'visible',timeout:20000});
  const rootWidth=await page.evaluate(()=>document.documentElement.scrollWidth);
  assert.ok(rootWidth<=392,'Homepage overflows mobile width: '+rootWidth);
  console.log('LIVE_BROWSER_PUBLIC_BOOT_OK',rootWidth);
  await page.locator('#openProducts').click();
  await page.waitForFunction(()=>{
    return document.getElementById('catalogModal')?.classList.contains('open')
      || document.getElementById('flLeadGate')?.classList.contains('open');
  },{timeout:15000});
  console.log('LIVE_BROWSER_PUBLIC_PRODUCTS_ENTRY_OK');

  for(const [mode,title] of [['1','تسجيل دخول المدير'],['2','تسجيل دخول الأدمن']]){
    const adminPage=await context.newPage();
    const result=await adminPage.goto(base+'?admin='+mode,{waitUntil:'domcontentloaded',timeout:45000});
    assert.equal(result?.status(),200,'Admin route HTTP status');
    await adminPage.locator('#flLoginForm').waitFor({state:'visible',timeout:30000});
    assert.equal(await adminPage.locator('#flCloudAdminBody h2').first().textContent(),title);
    assert.ok(await adminPage.locator('#flLoginEmail').isVisible());
    assert.ok(await adminPage.locator('#flLoginPassword').isVisible());
    assert.equal(await adminPage.locator('#flCloudAdminBody .fl-cloud-nav').count(),0,
      'Admin navigation must not be available to a signed-out visitor');
    if(mode==='2')assert.equal(await adminPage.locator('#flCloudPrimaryAdmin').count(),0,
      'Sub-admin page must not expose owner navigation button');
    console.log('LIVE_BROWSER_ANONYMOUS_ADMIN_GATE_OK',mode);
    await adminPage.close();
  }
  await context.close();
} finally {
  await browser.close();
}
