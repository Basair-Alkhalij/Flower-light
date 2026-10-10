import assert from 'node:assert/strict';

import fs from 'node:fs';
const BASE_URL=process.env.FL_SITE_URL||JSON.parse(fs.readFileSync(new URL('../site-settings.json',import.meta.url))).siteUrl;
const MAX_ATTEMPTS=6;
const RETRY_MS=10000;
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function get(path=''){
  let lastError;
  for(let attempt=1;attempt<=MAX_ATTEMPTS;attempt++){
    try{
      const url=new URL(path,BASE_URL);
      url.searchParams.set('_livecheck',`${Date.now()}-${attempt}`);
      const response=await fetch(url,{redirect:'follow',headers:{'cache-control':'no-cache',pragma:'no-cache'}});
      if(response.ok)return response;
      lastError=new Error(`${path||'index.html'} returned ${response.status}`);
    }catch(error){lastError=error;}
    if(attempt<MAX_ATTEMPTS){console.log(`Retry ${attempt}/${MAX_ATTEMPTS}: ${path||'index.html'}`);await sleep(RETRY_MS);}
  }
  throw lastError;
}

function quotedAsset(html,file){
  const escaped=file.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const match=html.match(new RegExp(`["']([^"']*${escaped}(?:\\?[^"']*)?)["']`,'i'));
  assert.ok(match?.[1],`Could not find ${file} in live index.html`);
  return match[1];
}

const html=await (await get('')).text();
assert.match(html,/Basair Gulf Flower Light/i);
assert.doesNotMatch(html,/[?&]admin=/i);
assert.match(html,/share-image\.jpg/i);
assert.doesNotMatch(html,/https:\/\/basairalkhalij\.github\.io/i);

const publicAssets={
  app:quotedAsset(html,'app.js'),
  pwa:quotedAsset(html,'pwa-install.js'),
  loader:quotedAsset(html,'site-loader.js'),
  quote:quotedAsset(html,'quote-list.js'),
  css:quotedAsset(html,'style.css'),
  manifest:quotedAsset(html,'manifest.webmanifest'),
};
console.log('Detected live public assets',publicAssets);

const publicResponses=await Promise.all(Object.values(publicAssets).map(path=>get(path)));
const publicTexts=await Promise.all(publicResponses.map(response=>response.text()));
const [app,pwa,loader,quoteList,css,manifestText]=publicTexts;

const adminAssets={
  admin:quotedAsset(loader,'admin.js'),
  searchFilters:quotedAsset(loader,'admin-search-filters.js'),
  media:quotedAsset(loader,'admin-media.js'),
  products:quotedAsset(loader,'admin-products.js'),
  form:quotedAsset(loader,'admin-product-form.js'),
  import:quotedAsset(loader,'admin-import.js'),
};
console.log('Detected live admin assets',adminAssets);

const adminResponses=await Promise.all(Object.values(adminAssets).map(path=>get(path)));
const adminTexts=await Promise.all(adminResponses.map(response=>response.text()));
const [admin,searchFilters,media,products,form,importJs]=adminTexts;

assert.ok(app.length>1000);
assert.match(pwa,/beforeinstallprompt/);
assert.match(loader,/URLSearchParams\(location\.search\)/);
assert.match(loader,/admin\.js\?v=/);
assert.match(loader,/public-sync\.js\?v=/);
assert.match(quoteList,/fl_quote_list_v1/);
assert.match(quoteList,/quote_list_send/);
assert.match(quoteList,/quote_list_enabled/);
assert.match(quoteList,/flowerlight:site-settings/);
assert.match(admin,/FL_ADMIN_CORE/);
assert.match(admin,/createClient/);
assert.match(searchFilters,/window\.FL_ADMIN_SEARCH_FILTERS\s*=/);
assert.match(searchFilters,/catalog_custom_filters/);
assert.doesNotMatch(admin,/const XLSX_IMPORT_CDN/);
assert.match(media,/window\.FL_ADMIN_MEDIA\s*=/);
assert.match(media,/\.l\.webp/);
assert.match(media,/\.s\.webp/);
assert.match(products,/window\.FL_ADMIN_PRODUCTS\s*=/);
assert.match(form,/window\.FL_ADMIN_PRODUCT_FORM\s*=/);
assert.match(importJs,/window\.FL_ADMIN_IMPORT\s*=/);
assert.match(importJs,/uploadProductImagePair/);
assert.match(app,/image_thumb/);

assert.doesNotMatch(css,/\\n\\n/);
const normalize=value=>value.trim().replace(/\s+/g,' ').replace(/\s*:\s*/g,':');
const queries=[...css.matchAll(/@media\s*([^\{]+)\{/g)].map(match=>normalize(match[1]));
for(const expected of ['(max-width:760px)','(max-width:430px)','(min-width:761px)','(prefers-reduced-motion:reduce)']){
  assert.ok(queries.includes(expected),`Missing responsive media query: ${expected}`);
}

const manifest=JSON.parse(manifestText);
assert.equal(manifest.display,'standalone');
assert.ok(manifest.icons?.some(icon=>String(icon.sizes||'').includes('512x512')));
const share=await get('share-image.jpg');
assert.match(share.headers.get('content-type')||'',/image\/jpeg/i);

const sitemapText=await (await get('sitemap.xml')).text();
assert.match(sitemapText,/\/p\/[^<]+\//);
assert.match(sitemapText,/\/c\/[^<]+\//);
const firstStaticPath=sitemapText.match(/<loc>(https:\/\/[^<]+\/(?:p|c)\/[^<]+\/)<\/loc>/)?.[1];
assert.ok(firstStaticPath,'No generated product/category page found in sitemap.xml');
const staticHtml=await (await get(firstStaticPath)).text();
assert.match(staticHtml,/<meta property="og:title"/i);
assert.match(staticHtml,/<meta property="og:image"/i);
assert.match(staticHtml,/<link rel="canonical"/i);

console.log('FLOWER_LIGHT_FINAL_LIVE_OK');
