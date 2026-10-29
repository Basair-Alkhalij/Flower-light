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

// GitHub Pages may briefly serve the legacy source (unreplaced __FL_VERSION__)
// during a branch/Jekyll deployment before the built Actions artifact propagates.
// Retry *readiness*, not only HTTP errors, and require the exact current release.
const releaseVersion=JSON.parse(fs.readFileSync(new URL('../package.json',import.meta.url),'utf8')).version.split('.').join('');
async function waitForPublishedBuild(){
  for(let attempt=1;attempt<=10;attempt++){
    const html=await (await get('')).text();
    if(!html.includes('__FL_VERSION__') && !html.includes('__FL_JSONLD_CSP_HASH__') && html.includes('app.js?v='+releaseVersion))return html;
    if(attempt<10){console.log(`Published Pages version not ready (attempt ${attempt}/10); expecting ${releaseVersion}`);await sleep(RETRY_MS);}
  }
  throw new Error(`Published Pages still serves an unbuilt/stale index after readiness retries; expected v${releaseVersion}. Check Settings > Pages deployment source.`);
}
const html=await waitForPublishedBuild();
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
// The ordered runtime loader declares names once and appends a version
// to each URL when creating scripts; minification no longer inlines ?v on names.
assert.ok(loader.includes('admin.js') && loader.includes('public-sync.js'));
assert.match(loader,/\?v=[0-9a-z-]+/);
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
assert.ok(app.includes('jspdf-vendor.js?v='),'Published export must load local jsPDF');
const pdfVendor=await get('jspdf-vendor.js?v='+releaseVersion);
const jsPdfBytes=Buffer.from(await pdfVendor.arrayBuffer());
assert.ok(jsPdfBytes.length>150_000,'Published jsPDF vendor is missing or incomplete');
const {createHash}=await import('node:crypto');
assert.equal(createHash('sha256').update(jsPdfBytes).digest('base64'),'5lUfzcMvCdaFOyxRJtGNAdlEfg2mGKQaEevu4PbCDVQ=','Published jsPDF hash mismatch');
console.log('LIVE_JSPDF_VENDOR_OK',jsPdfBytes.length);

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
