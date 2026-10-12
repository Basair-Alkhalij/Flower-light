// Synthetic mobile performance audit of the *published* GitHub Pages site.
// A headless Chromium phone profile + explicit throttling is NOT a physical-phone measurement.
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const url=process.env.FL_LIVE_URL||'https://basair-alkhalij.github.io/Flower-light/';
const browser=await chromium.launch({headless:true});
const trials=[];
try{
  for(let i=0;i<3;i++){
    const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true,locale:'ar-SA',serviceWorkers:'block'});
    const page=await context.newPage();
    await page.addInitScript(()=>{
      window.__flVitals={lcp:0,cls:0,shifts:[]};
      try{new PerformanceObserver(list=>{for(const e of list.getEntries())window.__flVitals.lcp=e.startTime;}).observe({type:'largest-contentful-paint',buffered:true});}catch(_){ }
      try{new PerformanceObserver(list=>{for(const e of list.getEntries())if(!e.hadRecentInput){window.__flVitals.cls+=e.value;window.__flVitals.shifts.push({ms:Math.round(e.startTime),value:Number(e.value.toFixed(4)),sources:(e.sources||[]).slice(0,3).map(src=>{const n=src.node;return n?String(n.tagName||'').toLowerCase()+(n.id?'#'+n.id:'')+(n.classList?.length?'.'+[...n.classList].slice(0,2).join('.'):''):'unknown';})});}}).observe({type:'layout-shift',buffered:true});}catch(_){ }
    });
    const cdp=await context.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
    await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:150,downloadThroughput:200_000,uploadThroughput:90_000});
    await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
    const response=await page.goto(url,{waitUntil:'load',timeout:60000});
    if(!response?.ok())throw new Error('Published URL returned HTTP '+(response?.status()??'unknown'));
    await page.waitForTimeout(1800);
    const metrics=await page.evaluate(()=>{
      const nav=performance.getEntriesByType('navigation')[0];
      const fcp=performance.getEntriesByType('paint').find(e=>e.name==='first-contentful-paint');
      return {fcpMs:Math.round(fcp?.startTime??0),lcpMs:Math.round(window.__flVitals?.lcp??0),cls:Number((window.__flVitals?.cls??0).toFixed(4)),domContentLoadedMs:Math.round(nav?.domContentLoadedEventEnd??0),loadMs:Math.round(nav?.loadEventEnd??0),resources:performance.getEntriesByType('resource').length,largestShifts:(window.__flVitals?.shifts||[]).sort((a,b)=>b.value-a.value).slice(0,6)};
    });
    trials.push(metrics);
    console.log('MOBILE_LAB_TRIAL',i+1,JSON.stringify(metrics));
    await context.close();
  }
  const sortedMedian=key=>[...trials.map(x=>x[key])].sort((a,b)=>a-b)[1];
  const report={url,date:new Date().toISOString(),method:'Chromium mobile emulation: 390x844, 3x DPR, 4x CPU slowdown, 150ms RTT, 1.6Mbps down, no browser cache/service worker',notPhysicalDevice:true,numberOfTrials:trials.length,median:{fcpMs:sortedMedian('fcpMs'),lcpMs:sortedMedian('lcpMs'),cls:sortedMedian('cls'),domContentLoadedMs:sortedMedian('domContentLoadedMs'),loadMs:sortedMedian('loadMs')},trials};
  const filename=path.resolve('test-results','mobile-live-performance.json');
  fs.mkdirSync(path.dirname(filename),{recursive:true});
  fs.writeFileSync(filename,JSON.stringify(report,null,2)+'\n');
  console.log('MOBILE_LAB_REPORT',JSON.stringify(report));
}finally{await browser.close();}
