import { chromium } from '@playwright/test';
const url='https://basair-alkhalij.github.io/Flower-light/';
const browser=await chromium.launch({headless:true});
try{
 for(const reserve of [0,520,610,700]){
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true,locale:'ar-SA',serviceWorkers:'block'});
  const page=await context.newPage();
  await page.addInitScript(()=>{
   window.__flShifts=[];
   try{new PerformanceObserver(list=>{for(const e of list.getEntries())if(!e.hadRecentInput){window.__flShifts.push({t:Math.round(e.startTime),v:e.value,source:(e.sources||[]).map(s=>({id:s.node?.id||s.node?.className||'',from:s.previousRect,to:s.currentRect})).slice(0,3)});}}).observe({type:'layout-shift',buffered:true})}catch{}
  });
  if(reserve){
   await page.route('**/style.css*',async route=>{
    const res=await route.fetch();
    await route.fulfill({response:res,body:await res.text()+`\n@media(max-width:760px){.hero{min-height:${reserve}px!important;}}\n`});
   });
  }
  const cdp=await context.newCDPSession(page);
  await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
  await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:150,downloadThroughput:200000,uploadThroughput:90000});
  await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
  const start=Date.now();await page.goto(url,{waitUntil:'load',timeout:60000});await page.waitForTimeout(2500);
  const result=await page.evaluate(()=>({heroHeight:Math.round(document.getElementById('siteHero').getBoundingClientRect().height),bodyTop:Math.round(document.querySelector('#publicCard>.body').getBoundingClientRect().top),identityShown:!document.getElementById('siteIdentity').hidden,brandShown:!document.getElementById('siteBrandRow').hidden,cls:Number(window.__flShifts.reduce((n,e)=>n+e.v,0).toFixed(4)),shifts:window.__flShifts.sort((a,b)=>b.v-a.v).slice(0,2)}));
  console.log('HERO_PROBE',JSON.stringify({reserve,seconds:(Date.now()-start)/1000,...result}));
  await context.close();
 }
} finally{await browser.close();}
