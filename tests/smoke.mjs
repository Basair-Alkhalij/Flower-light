import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { stripTypeScriptTypes } from 'node:module';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const index = read('index.html');
const app = read('app.js');
const catalogPdfViewer = read('catalog-pdf-viewer.js');
const catalogPdfRenderer = read('catalog-pdf-renderer.js');
const admin = read('admin.js');
const adminMedia = read('admin-media.js');
const adminProducts = read('admin-products.js');
const adminProductForm = read('admin-product-form.js');
const adminImport = read('admin-import.js');
const adminDatasheet = read('admin-datasheet.js');
const adminProductBundle = [admin,adminMedia,adminProducts,adminProductForm,adminImport].join('\n');
const sync = read('public-sync.js');
assert.match(sync,/window\.flPublicCatalogReady\s*=\s*initialCatalogLoad/);
const siteBootstrap = read('site-bootstrap.js');
const siteLoader = read('site-loader.js');
const submitLead = read('supabase/functions/submit-customer-lead/index.ts');
const turnstileMigration = read('supabase/migrations/2026-10-06_turnstile_customer_leads.sql');
// Owner site-settings cards moved to admin-settings.js (module split part 4); their UI strings are checked across both files.
const adminWithSettings = `${admin}\n${read('admin-settings.js')}`;
const cssEntry = read('style.css');
const css = ['styles/core.css','styles/products.css','styles/responsive.css','styles/admin.css','styles/business-bank.css'].map(read).join('\n');

const cssComparable = css.replace(/\s*([{};,])\s*/g,'$1');
const cssComparableFile = file => read(file).replace(/\s*([{};,])\s*/g,'$1');

const manageAdmin = read('supabase/functions/manage-admin-account/index.ts');
const sql = read('SUPABASE_SETUP.sql');

// Step 15 follow-up: PDF export must not depend on a third-party CDN at runtime.
{
  const build=read('scripts/build.mjs');
  const sw=read('sw.js');
  const live=read('tests/live-site-smoke.mjs');
  assert.match(build,/jspdf@4\.2\.1\/dist\/jspdf\.umd\.min\.js/);
  assert.match(build,/Pinned jsPDF SHA-256 mismatch/);
  assert.match(build,/jspdf-vendor\.js/);
  assert.match(app,/jspdf-vendor\.js\?v=__FL_VERSION__/);
  assert.match(app,/script\.src = JSPDF_PRIMARY_URL/);
  assert.match(sw,/path\.endsWith\('\/jspdf-vendor\.js'\)/);
  assert.match(live,/LIVE_JSPDF_VENDOR_OK/);
  assert.match(adminDatasheet,/choice==='pdf'\?await renderer\.loadJsPdf\(\):null/);
}

// Step 15: a new GitHub Pages commit must invalidate the public shell cache.
{
  const buildScript=read('scripts/build.mjs');
  const releaseExpression=buildScript.match(/^const releaseVersion=(.+);$/m)?.[1];
  assert.ok(releaseExpression,'Missing release version formula');
  assert.match(buildScript,/process\.env\.GITHUB_SHA/,'CI build must be commit-specific');
  const makeVersion=buildCommit=>vm.runInNewContext('('+releaseExpression+')',{
    versionParts:['1','1','26'],buildCommit
  });
  const versionA=makeVersion('a'.repeat(40));
  const versionB=makeVersion('b'.repeat(40));
  assert.match(versionA,/^1126-a{12}$/);
  assert.match(versionB,/^1126-b{12}$/);
  assert.notEqual(versionA,versionB,'Different releases cannot share one cache key');
  assert.equal(makeVersion(''), '1126','Local build without CI SHA must retain release number');
  assert.match(read('sw.js'),/flower-light-shell-v__FL_VERSION__/);
  assert.match(index,/app\.js\?v=__FL_VERSION__/);
  assert.equal(JSON.parse(read('package-lock.json')).version,JSON.parse(read('package.json')).version);
}


assert.match(index, /Basair Gulf Flower Light/);
assert.doesNotMatch(index, /\?v=70/);
assert.doesNotMatch(index, /\?v=78/);
assert.doesNotMatch(index, /\?v=79/);
assert.match(index, /style\.css\?v=__FL_VERSION__/);
// The public hero's static logo is discoverable before JavaScript boots;
// keep the portrait high priority when Supabase supplies its dynamic URL.
assert.match(index, /<link rel="preload" as="image" href="company-logo\.png\?v=__FL_VERSION__" fetchpriority="high">/);
assert.match(index, /id="siteLogo" src="company-logo\.png\?v=__FL_VERSION__"[^>]*fetchpriority="high"/);
assert.match(index, /id="sitePortrait"[^>]*decoding="async" fetchpriority="high"/);
assert.match(read('scripts/measure-mobile-performance.mjs'), /lcpElement/);
// The watermark is a standalone transparent SVG, never the white-backed header logo.
const watermarkSvg=read('company-watermark.svg');
assert.match(watermarkSvg,/<svg[\s\S]*viewBox="0 0 380 380"/);
assert.match(watermarkSvg,/fill-rule="evenodd"/);
assert.doesNotMatch(watermarkSvg,/<(?:image|rect|foreignObject|script)\b/i);
assert.doesNotMatch(watermarkSvg,/data:image\/|company-logo\.png|<style/i);
assert.match(sync,/const BUNDLED_SITE_WATERMARK=new URL\('company-watermark\.svg\?v=__FL_VERSION__'/);
assert.match(sync,/setImage\('siteWatermark',BUNDLED_SITE_WATERMARK,''\)/);
assert.match(sync,/setImage\('siteLogo',activeLogo,/);
assert.match(read('scripts/build.mjs'),/svg\|ico\|webmanifest/);
assert.match(read('sw.js'),/company-watermark\.svg\?v=__FL_VERSION__/);
assert.match(read('sw.js'),/path\.endsWith\('\/company-watermark\.svg'\)/);
assert.match(read('theme-dark.css'),/\.watermark\{filter:none;mix-blend-mode:screen;opacity:\.045\}/);
assert.match(read('tests/local-server.mjs'),/\.svg':'image\/svg\+xml/);
// Admin-configurable name-only WhatsApp links reuse business_public_fields;
// visitors see an allowlisted wa.me link, never the stored special marker.
const whatsappBusinessAdmin=read('admin-business.js');
const businessPublic=read('business-info.js');
assert.match(whatsappBusinessAdmin,/flBusinessAddWhatsApp/);
assert.match(whatsappBusinessAdmin,/whatsappDigits\(field\.value\.slice/);
assert.match(businessPublic,/https:\/\/wa\.me\//);
assert.match(businessPublic,/fl-business-whatsapp-links/);
assert.match(businessPublic,/noopener noreferrer/);
assert.match(whatsappBusinessAdmin,/data-business-label-en/);
assert.match(whatsappBusinessAdmin,/data-business-value-en/);
assert.match(whatsappBusinessAdmin,/label_en:field\.label_en/);
assert.match(businessPublic,/field\.label_en\|\|translateLabel/);
assert.match(businessPublic,/field\.value_en\|\|field\.value/);
const companyBilingualMigration=read('supabase/migrations/20261021183000_bilingual_business_public_fields.sql');
assert.match(companyBilingualMigration,/add column if not exists label_en text not null default ''/i);
assert.match(companyBilingualMigration,/add column if not exists value_en text not null default ''/i);
assert.match(companyBilingualMigration,/'label_en',f\.label_en/);
assert.match(companyBilingualMigration,/'value_en',f\.value_en/);
assert.match(companyBilingualMigration,/where f\.is_visible=true and btrim\(f\.label\)<>'' and btrim\(f\.value\)<>''/);
assert.match(companyBilingualMigration,/revoke all on function public\.get_public_business_privacy\(\) from public/);
assert.doesNotMatch(companyBilingualMigration,/\b(?:drop table|truncate|delete from|update public\.business_public_fields)\b/i);
assert.match(css,/\.fl-business-whatsapp-link\{/);
assert.match(index, /share-image\.jpg/);
const shareTitle = 'بصائر الخليج | منتجات فلور لايت';
const shareDescription = 'بصائر الخليج — منتجات فلور لايت للإنارة والكهرباء.';
const shareMeta = Object.fromEntries([...index.matchAll(/<meta (?:property|name)="(og:title|og:description|twitter:title|twitter:description)" content="([^"]+)"/g)].map(m=>[m[1],m[2]]));
assert.deepEqual(shareMeta, {'og:title':shareTitle,'og:description':shareDescription,'twitter:title':shareTitle,'twitter:description':shareDescription});
assert.match(index, /<title>بصائر الخليج \| منتجات فلور لايت<\/title>/);
assert.match(index, /"description": "بصائر الخليج — منتجات فلور لايت للإنارة والكهرباء\."/);
assert.equal(JSON.parse(read('manifest.webmanifest')).description,shareDescription);
assert.doesNotMatch([index,read('manifest.webmanifest'),read('privacy.html'),read('site-i18n.js')].join('\n'),/مستودع|والكتالوجات/);
assert.match(index, /<meta id="robotsMeta" name="robots" content="index,follow,max-image-preview:large"/);
assert.match(siteBootstrap, /'1': 'لوحة المدير \| بصائر الخليج'/);
assert.match(siteBootstrap, /'2': 'لوحة الأدمن \| بصائر الخليج'/);
assert.match(siteBootstrap, /setAttribute\('content', 'noindex,nofollow'\)/);
assert.match(admin, /document\.title=isPrimaryAdmin\?'لوحة المدير \| بصائر الخليج':'لوحة الأدمن \| بصائر الخليج'/);
assert.doesNotMatch(admin, /document\.title=displayName/);
assert.match(sync, /document\.title=displayName/);

const seoScript = siteBootstrap;
assert.ok(seoScript.includes('noindex,nofollow'), 'admin SEO bootstrap was not found');
const evaluateSeo = search => {
  let robots = 'index,follow,max-image-preview:large';
  const document = {
    title: 'بصائر الخليج | منتجات فلور لايت',
    getElementById: id => id === 'robotsMeta'
      ? { setAttribute: (name, value) => { if (name === 'content') robots = value; } }
      : null,
  };
  vm.runInNewContext(seoScript, { document, location: { search }, URLSearchParams });
  return { title: document.title, robots };
};
assert.deepEqual(evaluateSeo(''), {
  title: 'بصائر الخليج | منتجات فلور لايت',
  robots: 'index,follow,max-image-preview:large',
});
assert.deepEqual(evaluateSeo('?admin=1'), {
  title: 'لوحة المدير | بصائر الخليج',
  robots: 'noindex,nofollow',
});
assert.deepEqual(evaluateSeo('?admin=2'), {
  title: 'لوحة الأدمن | بصائر الخليج',
  robots: 'noindex,nofollow',
});
assert.match(adminDatasheet, /createAdminDatasheetExport/);
assert.match(adminDatasheet, /if\(failedImages\)throw new Error/);
assert.ok(catalogPdfRenderer.includes("if (/^data:image\\//i.test"),'uploaded image data URLs must decode directly without fetch');

assert.match(adminDatasheet, /flDatasheetDesignerForm[\s\S]*createAdminDatasheetExport/);
assert.doesNotMatch(admin, /createAdminDatasheetPdf/);
assert.doesNotMatch(app, /requestAnimationFrame\(\(\)=>renderSiteCatalogPages/);
assert.doesNotMatch(`${index}\n${app}\n${admin}\n${sync}`, /quote_service_visible|quoteModal|paperQuote|عرض عرض سعر|طلب عرض سعر|flSubmitImageQuoteRequest|quoteBucket/i);
assert.doesNotMatch(css, /\\n\\n/);
const responsiveQueries = [...css.matchAll(/@media\s*([^\{]+)\{/g)]
  .map(match => match[1].trim().replace(/\s+/g, ' '));
assert.deepEqual(responsiveQueries, [
  '(max-width:520px)',
  '(max-width:760px)',
  '(max-width: 760px)',
  '(max-width: 430px)',
  '(min-width: 761px)',
  '(prefers-reduced-motion: reduce)',
  '(min-width:720px)',
  '(max-width:420px)',
  '(prefers-reduced-motion:reduce)',
  '(max-width:420px)',
  '(max-width:420px)',
  '(max-width: 760px)',
  '(max-width: 520px)',
  '(max-width:760px)',
  '(max-width:520px)',
]);
assert.match(cssComparable, /Consolidated responsive architecture/);
assert.match(admin, /ownerSettingsViewItems/);
assert.match(admin, /site-settings/);
assert.match(admin, /business-settings/);
assert.match(admin, /template-settings/);
assert.match(read('admin-navigation.js'), /fl-cloud-nav-group/);
assert.match(read('admin-navigation.js'), /flAdminViewSelect/);
assert.match(app, /catalogRenderPending/);
assert.match(read('catalog-gallery.js'), /normalizedProductGallery/);
assert.match(admin, /primaryRecoverySettingsCardHtml\(\)/);
assert.match(cssComparable, /\.fl-overview-shortcuts/);
assert.match(cssComparable, /\.fl-price-tier-row\{[\s\S]*?grid-template-columns:minmax\(96px,1\.05fr\)/);
assert.match(cssComparable, /\.fl-cloud-mini\{min-height:44px\}/);
assert.match(cssComparable, /\.fl-cloud-dialog\.fl-product-dialog\{[\s\S]*?width:min\(980px,calc\(100vw - 32px\)\)/);
assert.match(cssComparable, /\.image-lightbox\{[\s\S]*?align-items:flex-start!important/);
assert.match(adminProductBundle, /classList\.add\('fl-product-dialog'\)/);
assert.match(app, /imageLightbox\.scrollTop = 0/);
assert.match(app, /actions\.append\(pdfButton, shareButton, whatsappLink\)/);
assert.match(cssComparable, /\.product-card-actions \.product-whatsapp-button\{[\s\S]*?grid-column:1\/-1!important;/);
assert.match(cssComparable, /\.image-lightbox-actions \.image-lightbox-whatsapp\{[\s\S]*?grid-column:1\/-1!important;/);
assert.match(index, /imageLightboxDownloadPdf[\s\S]*imageLightboxShare[\s\S]*imageLightboxWhatsApp/);
assert.ok(fs.statSync(path.join(root, 'share-image.jpg')).size > 1000, 'share image is missing or empty');
const jpegDimensions=file=>{
  const data=fs.readFileSync(path.join(root,file));
  if(data[0]!==0xff||data[1]!==0xd8) throw new Error(`${file} is not a JPEG`);
  let offset=2;
  while(offset+9<data.length){
    if(data[offset]!==0xff){offset++;continue;}
    const marker=data[offset+1];
    offset+=2;
    if(marker===0xd8||marker===0xd9) continue;
    const length=data.readUInt16BE(offset);
    if(length<2||offset+length>data.length) break;
    if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)){
      return {height:data.readUInt16BE(offset+3),width:data.readUInt16BE(offset+5)};
    }
    offset+=length;
  }
  throw new Error(`Unable to read JPEG dimensions for ${file}`);
};
assert.deepEqual(jpegDimensions('share-image.jpg'),{width:1200,height:630});
assert.ok(fs.existsSync(path.join(root, 'supabase/functions/manage-admin-account/index.ts')));
assert.doesNotMatch(manageAdmin, /['"]quotes['"]|['"]services['"]/i);

const sw=read('sw.js');
assert.match(sw, /catalog-search\.js\?v=__FL_VERSION__/);
assert.match(sw, /company-logo\.png\?v=__FL_VERSION__/);
assert.match(manageAdmin, /https:\/\/basair-alkhalij\.github\.io/);
assert.match(manageAdmin, /Origin not allowed/);
assert.doesNotMatch(manageAdmin, /Access-Control-Allow-Origin': '\*'/);

for (const file of ['app.js','quote-list.js','admin.js','admin-media.js','admin-products.js','admin-product-form.js','admin-import.js','public-sync.js','site-bootstrap.js','site-loader.js']) {
  execFileSync(process.execPath, ['--check', file], { cwd: root, stdio: 'ignore' });
}
for (const file of ['supabase/functions/manage-admin-account/index.ts','supabase/functions/submit-customer-lead/index.ts']) {
  const source=fs.readFileSync(path.join(root,file),'utf8');
  const stripped=stripTypeScriptTypes(source,{mode:'strip'});
  const tempName=`.fl-test-ts-check-${path.basename(file,'.ts')}-${process.pid}.mjs`;
  const tempPath=path.join(root,tempName);
  try {
    fs.writeFileSync(tempPath,stripped);
    execFileSync(process.execPath,['--check',tempName],{cwd:root,stdio:'ignore'});
  } finally {
    fs.rmSync(tempPath,{force:true});
  }
}


assert.match(app, /اسم المنتج:/);
assert.match(app, /رقم المنتج \/ الكود:/);
assert.match(app, /الوصف:/);
assert.match(app, /المواصفات الفنية:/);

assert.match(adminProductBundle, /flProdWhatsAppShowDescription/);
assert.match(adminProductBundle, /flProdWhatsAppShowSpecs/);
assert.match(app, /WHATSAPP_META_SHOW_DESCRIPTION/);
assert.match(app, /WHATSAPP_META_SHOW_SPECS/);
assert.match(app, /showDescription && description/);
assert.match(app, /if \(showSpecs\)/);
assert.match(adminProductBundle, /flAddPriceTier/);
assert.match(adminProductBundle, /جملة الجملة/);
assert.match(adminProductBundle, /data-price-tier-min/);
assert.match(adminProductBundle, /data-price-tier-max/);
assert.match(fs.readFileSync('catalog-pricing.js','utf8'), /سعر جملة الجملة/);
assert.match(app, /priceTierRangeNote/);
assert.doesNotMatch(app, /url\.searchParams\.set\('v', '87'\)/);
assert.match(app, /\['admin','category','product','v'\]\.forEach\(key => url\.searchParams\.delete\(key\)\)/);
assert.match(index, /flLeadWebsite/);
assert.match(sync, /leadSubmitCooldownMs=30000/);
assert.match(admin, /leadSubmitCooldownMs=30000/);
assert.match(read('SUPABASE_SETUP.sql'), /suppress_recent_duplicate_customer_lead/);
assert.match(turnstileMigration, /drop function if exists public\.enforce_customer_lead_rate_limit/);
assert.match(turnstileMigration, /revoke insert on table public\.customer_leads from anon/);
assert.match(sql, /TURNSTILE_CUSTOMER_LEADS_V104_OK/);
assert.match(read('SUPABASE_SETUP.sql'), /FLOWER_LIGHT_FINAL_OK/);
assert.match(read('SUPABASE_SETUP.sql'), /create table if not exists public\.site_settings/);
assert.match(read('SUPABASE_SETUP.sql'), /require_customer_lead boolean not null default true/);
assert.match(adminWithSettings, /flCustomerLeadGateSettingsForm/);
assert.match(adminWithSettings, /flRequireCustomerLead/);
assert.match(sync, /FLOWER_LIGHT_SITE_SETTINGS/);
assert.match(sync, /require_customer_lead===false/);

// STAGE88: Owner-managed design footer number replaces the website URL in shared export template.
assert.match(adminWithSettings, /flDesignFooterNumberSettingsForm/);
assert.match(adminWithSettings, /flDesignFooterNumber/);
assert.match(adminWithSettings, /design_footer_number/);
assert.match(adminWithSettings, /design_footer_label/);
assert.match(sync, /design_footer_number/);
assert.match(sync, /design_footer_label/);
assert.match(catalogPdfRenderer, /function catalogDesignFooterNumber\(\)/);
assert.match(catalogPdfRenderer, /رقم التواصل/);
assert.doesNotMatch(app, /زوروا موقعنا الإلكتروني/);
assert.match(read('SUPABASE_SETUP.sql'), /design_footer_number text not null default ''/);
assert.match(read('SUPABASE_SETUP.sql'), /STAGE88_DESIGN_FOOTER_LABEL_OK/);

// STAGE88: one optional Owner-managed barcode is shared by all approved export templates.
assert.match(adminWithSettings, /flMasterBarcodeSettingsForm/);
assert.match(adminWithSettings, /uploadMasterBarcodeFile/);
assert.match(adminWithSettings, /master_barcode_path/);
assert.match(sync, /master_barcode_path/);
assert.match(catalogPdfRenderer, /function masterBarcodeUrl\(\)/);
assert.match(catalogPdfRenderer, /async function drawMasterBarcode/);
assert.match(catalogPdfRenderer, /barcodeDrawn/);
assert.match(read('SUPABASE_SETUP.sql'), /master_barcode_path text not null default ''/);
assert.match(read('SUPABASE_SETUP.sql'), /site-settings/);
assert.match(read('SUPABASE_SETUP.sql'), /STAGE88_MASTER_BARCODE_OK/);
assert.match(read('SUPABASE_SETUP.sql'), /STAGE88_FINAL_OK/);

// STAGE88: Admin 2 permissions must be identical across UI, SQL and Edge Function.
assert.match(admin, /delegatablePermissionKeys=new Set\(\['analytics','datasheet','profile','contacts','leads'\]\)/);
assert.match(admin, /owner_get_delegatable_permissions/);
assert.match(admin, /currentAdminPermissions=new Set\(normalizePermissionList\(data\)\)/);
assert.match(siteLoader, /if \(adminPanel === '2'\) document\.getElementById\('flCloudPrimaryAdmin'\)\?\.remove\(\)/);
const edgeAdmin=read('supabase/functions/manage-admin-account/index.ts');
const edgeAllowed=edgeAdmin.match(/const allowedPermissions = new Set\(\[([\s\S]*?)\]\)/)?.[1]||'';
for(const permission of ['analytics','profile','contacts','leads','datasheet']) assert.match(edgeAllowed,new RegExp(`['\"]${permission}['\"]`));
for(const key of ['sections','products','search-filters','template-settings','site-settings','business-settings','bank-settings']) assert.match(edgeAllowed,new RegExp(`['\"]${key}['\"]`));
for(const forbidden of ['credentials','permissions','quotes','services']) assert.doesNotMatch(edgeAllowed,new RegExp(`['\"]${forbidden}['\"]`));
const hardeningStart=sql.lastIndexOf('STAGE88 ADMIN=2 LEGACY ROLE COMPATIBILITY');
const hardeningEnd=sql.indexOf('STAGE88 GLOBAL MASTER BARCODE',hardeningStart);
const hardening=sql.slice(hardeningStart,hardeningEnd>hardeningStart?hardeningEnd:undefined);
for(const permission of ['analytics','profile','contacts','leads','datasheet']) assert.match(hardening,new RegExp(`['\"]${permission}['\"]`));
for(const permission of ['sections','products','search-filters','template-settings','site-settings','business-settings','bank-settings']) assert.match(hardening,new RegExp(`['\"]${permission}['\"]`));
const stage88Granted=hardening.match(/v_allowed constant text\[\]\s*:=\s*array\[([\s\S]*?)\]::text\[\]/)?.[1]||'';
assert.ok(stage88Granted,'Stage88 owner-only delegation whitelist missing');
for(const forbidden of ['credentials','permissions','quotes','services']) assert.doesNotMatch(stage88Granted,new RegExp(`['\\\"]${forbidden}['\\\"]`));
assert.match(hardening,/where a\.role='subadmin'/);

// STAGE88: every local static reference resolves to a real release file.
const refs=[];
for(const match of index.matchAll(/(?:src|href)=["']([^"']+)["']/g)) refs.push(match[1]);
for(const match of (cssEntry+'\n'+css).matchAll(/url\((?:["']?)([^)"']+)(?:["']?)\)/g)) refs.push(match[1]);
for(const raw of refs){
  const value=String(raw||'').trim();
  if(!value || /^(?:https?:|data:|blob:|mailto:|tel:|#)/i.test(value)) continue;
  const clean=value.split(/[?#]/)[0].replace(/^\.\//,'');
  if(!clean || clean.startsWith('/')) continue;
  assert.ok(fs.existsSync(path.join(root,clean)),`missing local asset: ${clean}`);
}
for(const asset of ['analytics.js','catalog-pdf-viewer.js','catalog-pdf-renderer.js','app.js','site-bootstrap.js','site-loader.js','admin.js','admin-datasheet.js','admin-media.js','admin-products.js','admin-product-form.js','admin-import.js','public-sync.js','style.css' ,'company-logo.png','favicon-32.png','favicon-192.png','apple-touch-icon.png','favicon.ico','share-image.jpg']){
  assert.ok(fs.existsSync(path.join(root,asset)),`required release asset missing: ${asset}`);
}

// STAGE88: release contains only the canonical social preview asset and no obsolete stage files.
assert.ok(fs.existsSync(path.join(root,'share-image.jpg')));
assert.equal(fs.existsSync(path.join(root,'share-image-v78.jpg')),false);
const releaseNames=fs.readdirSync(root);
assert.equal(releaseNames.some(name=>/^README_STAGE/i.test(name)),false);
assert.equal(releaseNames.some(name=>/^FINAL_SQL_STAGE/i.test(name)),false);
const textBundle=[index,app,catalogPdfRenderer,adminProductBundle,sync,css,read('README.md'),read('SUPABASE_SETUP.sql')].join('\n');
assert.match(index, /https:\/\/basair-alkhalij\.github\.io\/Flower-light\//);
assert.match(read('manifest.webmanifest'), /"start_url": "\.\/"/);
assert.ok(fs.existsSync(path.join(root,'robots.txt')));
assert.ok(fs.existsSync(path.join(root,'sitemap.xml')));
assert.doesNotMatch(textBundle,/saeed[- ]naji/i);
assert.doesNotMatch(textBundle,/STAGE(?:7[0-9]|8[0-6])|FINAL_SQL_STAGE(?:7[0-9]|8[0-6])|share-image-v78/i);

// Final polish: shared config, PWA icons, 404/privacy pages, no stale personal-name examples.
const configJs=read('config.js');
assert.match(configJs,/window\.FLOWER_LIGHT_SUPABASE/);
assert.match(configJs,/window\.FLOWER_LIGHT_ANALYTICS_CONFIG/);
assert.doesNotMatch(read('analytics.js'),/G-XXXXXXXXXX/);
assert.match(read('privacy.html'),/Google Analytics 4/);
assert.match(submitLead,/allowedTurnstileHosts[\s\S]*basair-alkhalij\.github\.io/);
assert.doesNotMatch(admin,/window\.FLOWER_LIGHT_SUPABASE\s*=/);
assert.doesNotMatch(sync,/window\.FLOWER_LIGHT_SUPABASE\s*=/);
assert.match(index,/config\.js\?v=__FL_VERSION__[\s\S]*app\.js\?v=__FL_VERSION__/);
assert.doesNotMatch(configJs,/service_role/i);
for (const f of ['icon-512.png','icon-192-maskable.png','icon-512-maskable.png','404.html','privacy.html']) {
  assert.ok(fs.existsSync(path.join(root,f)),`missing ${f}`);
}
const manifestJson=JSON.parse(read('manifest.webmanifest'));
assert.ok(manifestJson.icons.some(i=>i.sizes==='512x512'&&i.purpose==='maskable'),'maskable 512 icon required');
assert.ok(manifestJson.icons.some(i=>i.sizes==='512x512'&&i.purpose==='any'),'any 512 icon required');
assert.doesNotMatch([adminProductBundle,app,index].join('\n'),/سعيد\s*ناجي/);
assert.match(index,/privacy\.html/);
assert.match(sw,/config\.js\?v=__FL_VERSION__/);

// Module split part 2: leads section lives in admin-leads.js and is wired through FL_ADMIN_CORE.
const leadsJs=read('admin-leads.js');
assert.match(siteLoader, /'admin-leads\\.js'/);
assert.match(leadsJs,/window\.FL_ADMIN_LEADS\s*=/);
assert.match(admin,/FL_ADMIN_LEADS/);
assert.doesNotMatch(admin,/function\s+(renderLeads|loadLeadsPage|deleteLead|deleteAllLeads|exportAllLeads)\b/);
assert.match(leadsJs,/customer_leads/);

// Module split part 3: permissions screen lives in admin-permissions.js.
const permsJs=read('admin-permissions.js');

// Draft UI: all 12 admin sections are listed, but sections disallowed by current
// database permissions must stay disabled until RLS/RPC changes are approved.
{
  let preview='';
  const legacy=['analytics','datasheet','profile','contacts','leads'];
  const views=[['analytics','الإحصائيات'],['datasheet','صمّم داتا شيت'],['sections','الأقسام'],['products','المنتجات'],['profile','البيانات الشخصية'],['contacts','وسائل التواصل'],['leads','جهات اتصال العملاء']];
  const settings=[['search-filters','فلاتر البحث'],['site-settings','إعدادات الموقع'],['business-settings','بيانات الشركة'],['bank-settings','الحسابات البنكية'],['template-settings','قالب المنتجات']];
  const core={
    esc:s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;'),
    notify:()=>{},layout:s=>{preview=s;},body:{querySelectorAll:()=>[]},
    adminViewItems:views,ownerSettingsViewItems:settings,
    delegatablePermissionKeys:new Set(legacy),
    normalizePermissionList:v=>v.permissions||[],
    managedAdmin2Email:'test@example.com',
    managedAdmin2Permissions:new Set(['analytics'])
  };
  const context={window:{FL_ADMIN_CORE:core},console,document:{getElementById:()=>({addEventListener(){}})}};
  vm.runInNewContext(permsJs,context);
  context.window.FL_ADMIN_PERMISSIONS.renderPermissions();
  const allKeys=[...views,...settings].map(row=>row[0]);
  for(const key of allKeys){
    const markup=preview.match(new RegExp('<label[^>]*data-permission-key="'+key+'"[^>]*>([\\s\\S]*?)<\\/label>'))?.[1]||'';
    assert.ok(markup,'Missing permission option: '+key);
    if(legacy.includes(key))assert.doesNotMatch(markup,/<input[^>]*disabled/,'Legacy permission must remain selectable: '+key);
    else assert.match(markup,/<input[^>]*disabled/,'New permission must not become active before RLS upgrade: '+key);
  }
  assert.equal((preview.match(/data-permission-key=/g)||[]).length,12);
  assert.doesNotMatch(preview,/data-permission-key="(?:credentials|permissions)"/,'Owner access management is never delegated');
  assert.match(preview,/value="analytics"[^>]*checked/);
}

// Review-only SQL must remain fail-closed until the owner separately authorizes it.
{
  const draft=read('supabase/PROPOSED_ADMIN_12_PERMISSIONS_REVIEW_ONLY.sql');
  const keys=['analytics','datasheet','profile','contacts','leads','sections','products',
    'search-filters','template-settings','site-settings','business-settings','bank-settings'];
  const allowedSection=draft.match(/-- A\. Permission names:[\s\S]*?(?=-- B\. Owner-only RPC)/)?.[0]||'';
  assert.ok(allowedSection,'Missing explicit database permission constraint');
  for(const key of keys)assert.ok(allowedSection.includes("'"+key+"'"),'Missing SQL grant key '+key);
  assert.doesNotMatch(allowedSection,/'(?:credentials|permissions)'/,'No access delegation for owner controls');
  assert.match(draft,/-- DO NOT RUN IN PRODUCTION WITHOUT A SEPARATE, EXPLICIT OWNER APPROVAL/);
  assert.match(draft,/-- No UPDATE to admin_users, no auto-grants/);
  assert.match(draft,/-- F\. Settings all share one row\./);
  assert.match(draft,/create or replace function public\.owner_get_delegatable_permissions\(\)/);
  assert.match(draft,/create or replace function public\.admin_save_template_footer\(/);
  assert.doesNotMatch(draft,/create policy\s+["'][^"']*subadmin[^"']*["']\s+on public\.site_settings/i);
  for(const name of ['admin_set_site_toggle','admin_save_catalog_filters','admin_set_template_field']){
    assert.match(draft,new RegExp('create or replace function public\\.'+name+'\\('));
  }
  for(const section of ['business-settings','bank-settings','search-filters','site-settings','template-settings']){
    assert.match(draft,new RegExp("has_admin_permission\\('"+section+"'\\)"));
  }
  assert.match(draft,/bucket_id='product-images'/);
  assert.match(draft,/storage\.foldername\(name\)/);
  assert.match(draft,/category DELETE requires BOTH/);
  assert.match(draft,/revoke all on function public\.admin_save_catalog_filters\(text\[\],jsonb\) from public,anon/);
}

assert.match(siteLoader, /'admin-permissions\\.js'/);
assert.match(permsJs,/window\.FL_ADMIN_PERMISSIONS\s*=/);
assert.match(permsJs,/owner_set_admin2_settings/);
assert.match(admin,/renderSplitSection\('FL_ADMIN_PERMISSIONS'/);
assert.doesNotMatch(admin,/function\s+renderPermissions\b/);

// Module split part 4: Owner site-settings cards live in admin-settings.js.
const settingsJs=read('admin-settings.js');
assert.match(siteLoader, /'admin-settings\\.js'/);
assert.match(settingsJs,/window\.FL_ADMIN_SETTINGS\s*=/);
assert.match(settingsJs,/site_settings/);
assert.match(settingsJs,/require_customer_lead/);
assert.match(admin,/FL_ADMIN_SETTINGS/);
assert.doesNotMatch(admin,/function\s+uploadMasterBarcodeFile\b/);
assert.doesNotMatch(admin,/flMasterBarcodeSettingsForm'\)\?\.addEventListener/);


// v100: product-area split and responsive WebP thumbnails.
assert.match(siteLoader, /'admin-media\\.js'/);
assert.match(siteLoader, /'admin-products\\.js'/);
assert.match(siteLoader, /'admin-product-form\\.js'/);
assert.match(siteLoader, /'admin-import\\.js'/);
assert.match(adminMedia,/window\.FL_ADMIN_MEDIA\s*=/);
assert.match(adminProducts,/window\.FL_ADMIN_PRODUCTS\s*=/);
assert.match(adminProductForm,/window\.FL_ADMIN_PRODUCT_FORM\s*=/);
assert.match(adminImport,/window\.FL_ADMIN_IMPORT\s*=/);
assert.doesNotMatch(admin,/const XLSX_IMPORT_CDN/);
assert.doesNotMatch(admin,/function\s+openProductForm\(prod=null\)\{[\s\S]{5000,}/);
assert.match(adminMedia,/\.l\.webp/);
assert.match(adminMedia,/\.s\.webp/);
assert.match(adminMedia,/uploadProductImagePair/);
assert.match(adminImport,/uploadProductImagePair/);
assert.match(adminProductForm,/uploadProductImagePair/);
assert.match(sync,/image_thumb/);
assert.match(sync,/productThumbnailPath/);
assert.match(app,/item\.image_thumb \|\| item\.image/);
assert.match(app,/image\.decoding = 'async'/);

// Step 14: image loading attributes must be set before the network request starts.
{
  const from=app.indexOf("  function createZoomButton(");
  const to=app.indexOf("  function attachProductCardGalleryNavigation(",from);
  const createCard=app.slice(from,to);
  assert.ok(from>=0&&to>from,'Product image factory missing');
  const imgAt=createCard.indexOf("const image = document.createElement('img');");
  const loadingAt=createCard.indexOf('image.loading = imageLoading;',imgAt);
  const priorityAt=createCard.indexOf("image.fetchPriority = 'low';",imgAt);
  const srcAt=createCard.indexOf('image.src = item.image_thumb || item.image;',imgAt);
  assert.ok(imgAt>=0&&loadingAt>imgAt&&priorityAt>loadingAt&&srcAt>priorityAt,
    'Apply lazy loading and low fetch priority before starting the thumbnail request');
  const earlyWatermarkTag=index.match(/<img class="watermark"[^>]*>/)?.[0]||'';
  assert.ok(
    earlyWatermarkTag.includes('src="company-watermark.svg?v=__FL_VERSION__"')
    && earlyWatermarkTag.includes('loading="eager"')
    && earlyWatermarkTag.includes('fetchpriority="low"'),
    'Small watermark should be discovered early with low fetch priority'
  );
  assert.match(index,/<img class="brand-logo"[^>]*fetchpriority="high"/,
    'Visible company branding should have high image priority');

  const preloadFrom=app.indexOf('  function preloadLightboxNeighbors()');
  const preloadTo=app.indexOf('  function showLightboxState(',preloadFrom);
  assert.ok(preloadFrom>=0&&preloadTo>preloadFrom,'Lightbox preloading helper missing');
  const helper=app.slice(preloadFrom,preloadTo).trim();
  const loaded=[];
  class MockImage {
    set src(value){loaded.push({url:value,priority:this.fetchPriority,decoding:this.decoding});}
  }
  const makePrefetch=saveData=>vm.runInNewContext('('+helper+')',{
    lightboxNavigationAvailable:()=>true,
    navigator:{connection:{saveData}},
    neighborLightboxImage:direction=>direction<0?'previous.webp':'next.webp',
    Image:MockImage
  });
  makePrefetch(true)();
  assert.equal(loaded.length,0,'Data saver must disable unnecessary neighboring-image prefetch');
  makePrefetch(false)();
  assert.equal(loaded.length,2,'Normal gallery navigation can prefetch adjacent images');
  assert.deepEqual(loaded.map(item=>item.url),['previous.webp','next.webp']);
  assert.ok(loaded.every(item=>item.priority==='low'&&item.decoding==='async'),
    'Neighbor prefetches must be low-priority asynchronous decodes');
}



// v98: Owner-controlled strict WebAPK prompt — no shortcut fallback.
const pwaInstall=read('pwa-install.js');
assert.doesNotMatch(index,/pwaInstallBtn/);
assert.doesNotMatch(index,/pwaInstallModal/);
assert.match(index,/pwaInstallReminder/);
assert.match(index,/pwa-install\.js\?v=__FL_VERSION__/);
assert.match(pwaInstall,/beforeinstallprompt/);
assert.match(pwaInstall,/appinstalled/);
assert.match(pwaInstall,/navigator\.standalone/);
assert.match(pwaInstall,/iPad\|iPhone\|iPod/);
assert.match(pwaInstall,/isLikelyWebApkBrowser/);
assert.match(pwaInstall,/isAndroidChrome/);
assert.match(pwaInstall,/isSamsungBrowserOnSamsung/);
assert.doesNotMatch(pwaInstall,/hasTrustedWebApkPath/);
assert.match(pwaInstall,/pwa_install_enabled/);
assert.match(pwaInstall,/cross-device install prompt/i);
assert.doesNotMatch(pwaInstall,/openInstructions|pwaInstallModal/);
assert.match(settingsJs,/pwa_install_enabled/);
assert.match(sql,/pwa_install_enabled/);
assert.match(sw,/pwa-install\.js\?v=__FL_VERSION__/);
const pwaManifest=JSON.parse(read('manifest.webmanifest'));
assert.equal(pwaManifest.id,'./');
assert.equal(pwaManifest.display,'standalone');
assert.deepEqual(pwaManifest.display_override,['standalone']);
assert.equal(pwaManifest.prefer_related_applications,false);

// v104-v106: deployment, versioning, security and scalability hardening.
assert.match(index, /Content-Security-Policy/);
assert.match(index, /__FL_JSONLD_CSP_HASH__/);
assert.match(index, /site-bootstrap\.js\?v=__FL_VERSION__/);
assert.match(index, /site-loader\.js\?v=__FL_VERSION__/);
assert.match(siteLoader, /'admin-import\.js'/);
assert.match(siteLoader, /script\.src=path\+'\?v=__FL_VERSION__'/);
assert.match(read('admin-import.js'), /xlsx-0\.20\.3/);

// Behavioral matching regression: evaluate the real import resolver in isolation.
{
  const from=adminImport.indexOf('  function resolveImportedProduct(');
  const to=adminImport.indexOf('\n  }\n',from)+5;
  assert.ok(from>=0&&to>from,'Missing product match resolver');
  const source=adminImport.slice(from,to).trim();
  const importKey=value=>String(value||'').trim().toLowerCase().replace(/[\s_\-\/]+/g,' ');
  const resolve=vm.runInNewContext('('+source+')',{importKey});
  const a={id:'a',model:'SAME'},b={id:'b',model:'SAME'},c={id:'c',model:'OTHER'};
  const ids=new Map([['a',a],['b',b],['c',c]]);
  const codes=new Map([['same',[a,b]],['other',[c]]]);
  assert.throws(()=>resolve({model:'same'},ids,codes),/مكرر/);
  assert.equal(resolve({product_id:'a',model:'SAME'},ids,codes).id,'a');
  assert.throws(()=>resolve({product_id:'missing',model:'OTHER'},ids,codes),/غير موجود/);
  assert.throws(()=>resolve({product_id:'a',model:'OTHER'},ids,codes),/منتج آخر/);
  assert.equal(resolve({model:'OTHER'},ids,codes).id,'c');
  assert.equal(resolve({model:'NEW'},ids,codes),null);
}
// Step 13: import preview estimates reflect the selected mode without modifying products.
{
  const source=read('admin-import.js');
  const block=(startMark,endMark)=>{
    const start=source.indexOf(startMark),end=source.indexOf(endMark,start);
    assert.ok(start>=0&&end>start,'Missing import preview logic: '+startMark);
    return source.slice(start,end);
  };
  const resolver=block('  function resolveImportedProduct(', '  async function saveImportedProductGallery(');
  const preview=block('  function previewProductImportCounts(', '  const EMBEDDED_EXCEL_TEMPLATE_B64');
  const existing=[{id:'a',model:'D'},{id:'b',model:'D'},{id:'c',model:'U'}];
  const mod=vm.runInNewContext(resolver+preview+'\n({previewProductImportCounts,productImportPreviewHtml})',{
    products:existing,
    importKey:value=>String(value||'').trim().toLowerCase(),
    esc:value=>String(value??'')
  });
  const makeRow=(name,model,product_id='')=>({name,model,product_id,imageSources:[],unresolvedImages:[]});
  const plan={total:5,resolvedImages:0,missingImages:0,sections:[{
    name:'ثريات',categoryMeta:null,products:[
      makeRow('جديد','N'),makeRow('موجود','U'),makeRow('مكرر','D'),
      makeRow('معرف غير صحيح','U','missing'),makeRow('معرف صحيح','D','a')
    ]
  }]};
  const upsert=mod.previewProductImportCounts(plan,'upsert');
  assert.equal(upsert.created,1);
  assert.equal(upsert.updated,2);
  assert.equal(upsert.skipped,0);
  assert.equal(upsert.conflicts,2);
  const newOnly=mod.previewProductImportCounts(plan,'new_only');
  assert.equal(newOnly.created,1);
  assert.equal(newOnly.updated,0);
  assert.equal(newOnly.skipped,2);
  assert.equal(newOnly.conflicts,2);
  const html=mod.productImportPreviewHtml(plan,'upsert');
  assert.match(html,/تحديث المنتجات المطابقة وإضافة الجديدة/);
  assert.match(html,/مع الاحتفاظ بالمنتجات الأخرى/);
  assert.match(html,/تعارضات تحتاج المراجعة/);
  assert.match(html,/الأعداد تقديرية/);
  assert.match(mod.productImportPreviewHtml(plan,'new_only'),/المنتجات الموجودة لن تُحدّث/);
  assert.match(source,/request!==fileSelection/,'Old file reads must not replace the current preview');
  assert.match(source,/mode\?\.addEventListener\('change'/,'Changing import mode must refresh the preview');
}

// Step 12: preserve owner-managed filter IDs while recognizing legacy specification labels.
{
  const from=app.indexOf('  const PRODUCT_SPEC_LABELS =');
  const to=app.indexOf('\n  function productSpecifications(',from);
  assert.ok(from>=0&&to>from,'Catalog specification normalization not found');
  const siteSettings={catalog_custom_filters:[{key:'custom_filter_test1',label:'إضاءة جانبية'}]};
  const ctx={window:{FLOWER_LIGHT_SITE_SETTINGS:siteSettings},PRICING_META_KEY:'__pricing_tiers'};
  const funcs=vm.runInNewContext(app.slice(from,to)+'\n({canonicalProductSpecKey,normalizeProductSpecifications})',ctx);
  const normalized=row=>funcs.normalizeProductSpecifications([row])[0];
  assert.equal(normalized({key:'custom_1',label:'اضاءه جانبيه',value:'نعم'}).key,'custom_filter_test1');
  assert.equal(normalized({key:'custom_filter_test1',label:'القدرة',value:'خاص'}).key,'custom_filter_test1',
    'Explicit configured keys must not be redirected by aliases');
  assert.equal(normalized({key:'legacy_foo',label:'سوكت',value:'E27'}).key,'bulb_base');
  assert.equal(normalized({key:'legacy_foo',label:'socket',value:'E27'}).key,'bulb_base');
  assert.equal(normalized({key:'legacy_foo',label:'dimension',value:'30 سم'}).key,'dimensions');
  const legacy=normalized({key:'legacy_foo',label:'مواصفة غير معروفة',value:'متاح',unit:'م'});
  assert.equal(legacy.key,'legacy_foo');
  assert.equal(legacy.value,'متاح');
  assert.equal(legacy.unit,'م');
  siteSettings.catalog_custom_filters.push({key:'custom_filter_test2',label:'اضاءة جانبية'});
  assert.equal(normalized({key:'custom_1',label:'اضاءه جانبيه',value:'نعم'}).key,'custom_1',
    'Ambiguous custom labels cannot be guessed');
  delete ctx.window.FLOWER_LIGHT_SITE_SETTINGS;
  assert.equal(normalized({key:'custom_1',label:'اضاءه جانبيه',value:'نعم'}).key,'custom_1',
    'Old specifications must survive absent filter settings');
}

// Step 12: a slow older analytics response must not replace newer dashboard data.
{
  const analyticsSource=read('admin-analytics.js');
  const layouts=[];
  const pending=[];
  const core={
    esc:value=>String(value??''),
    notify:()=>{},
    layout:html=>layouts.push(String(html)),
    view:'analytics',
    db:{rpc:(name,args)=>new Promise(resolve=>pending.push({name,args,resolve}))}
  };
  const scope={window:{FL_ADMIN_CORE:core},document:{getElementById:()=>null},console};
  vm.runInNewContext(analyticsSource,scope);
  const render=scope.window.FL_ADMIN_ANALYTICS.renderAnalytics;
  const older=render();
  const newer=render();
  assert.equal(pending.length,2,'Concurrent analytics requests should both start');
  pending[1].resolve({data:{total_visits:42},error:null});
  await newer;
  const latestLayout=layouts.at(-1);
  assert.ok(latestLayout.includes((42).toLocaleString('ar-SA')),'Newest response should render');
  const renderedCount=layouts.length;
  pending[0].resolve({data:{total_visits:7},error:null});
  await older;
  assert.equal(layouts.length,renderedCount,'Stale analytics response must not render');
  assert.equal(layouts.at(-1),latestLayout,'Newest dashboard must remain visible');
}

// Step 11: public and admin contact links are safe and valid.
{
  for(const [name,source] of [['public-sync.js',sync],['admin.js',admin]]){
    const from=source.indexOf('  function cleanPhone(');
    const to=source.indexOf('  function contactPhoneKey(',from);
    assert.ok(from>=0&&to>from,'Missing contact link functions: '+name);
    const functions=source.slice(from,to);
    const {contactHref}=vm.runInNewContext(functions+'\n({contactHref})',{
      URL,window:{flNormalizeWhatsAppNumber:value=>{
        let digits=String(value||'').replace(/\D/g,'');
        if(digits.startsWith('00'))digits=digits.slice(2);
        if(/^05\d{8}$/.test(digits))return '966'+digits.slice(1);
        if(/^5\d{8}$/.test(digits))return '966'+digits;
        return digits;
      }}
    });
    const link=(type,value)=>contactHref({type,value});
    assert.equal(link('phone','0560933353'),'tel:0560933353',name);
    assert.equal(link('phone','+966 56 093 3353'),'tel:+966560933353',name);
    assert.equal(link('whatsapp','0560933353'),'https://wa.me/966560933353',name);
    assert.equal(link('email','sales@example.com'),'mailto:sales@example.com',name);
    assert.equal(link('website','example.com/contact'),'https://example.com/contact',name);
    assert.equal(link('location','https://maps.app.goo.gl/example'),'https://maps.app.goo.gl/example',name);
    for(const [type,value] of [
      ['phone','123'],['whatsapp','0'],['email','not-an-email'],
      ['website','javascript:alert(1)'],['location','data:text/html,Hello'],
      ['website','https://user:password@example.com'],['website','http://'],
      ['website','https://example.com\nmalformed']
    ])assert.equal(link(type,value),'#',name+': reject '+type+' '+value);
  }
  assert.ok(admin.includes("if(contactHref(payload)==='#')"),'Admin must validate contact before saving');
}

// Step 10: execute real gallery-save/cleanup logic without touching Supabase.
{
  const source=read('admin-import.js');
  const start=source.indexOf('  async function saveImportedProductGallery(');
  const end=source.indexOf('  async function runProductExcelImport(',start);
  assert.ok(start>=0&&end>start,'Excel gallery save helper must exist');
  const helper=source.slice(start,end).trim();
  const handler=source.slice(end,source.indexOf('  window.FL_ADMIN_IMPORT=',end));
  assert.ok(handler.includes('if((row.imageSources.length&&!exportedUrlsUnchanged)||!existing)'), 'Blank image cells must not change an existing gallery');
  assert.ok(handler.includes('await saveImportedProductGallery(saved,imagePaths,previousImagePaths'), 'Importer must await gallery save before continuing');
  const setup=(rpcError=null,shared=[],removeError=null)=>{
    const calls=[];
    const db={
      rpc:async(name,payload)=>{calls.push(['rpc',name,payload.p_product_id]);return {error:rpcError};},
      storage:{from:()=>({remove:async paths=>{calls.push(['remove',...paths]);return {error:removeError};}})}
    };
    const fn=vm.runInNewContext('('+helper+')',{
      db,bucket:'test-images',isStoragePath:path=>path.startsWith('store/'),
      storagePathUsedByOtherProduct:path=>shared.includes(path),
      productStoragePairPaths:path=>[path+'.l.webp',path+'.s.webp'],
      console:{warn:(...args)=>calls.push(['warn',...args])}
    });
    return {fn,calls};
  };
  const saved={id:'product-1'};
  const previous=['store/old','store/shared','store/unchanged','https://external/img.jpg'];
  const newer=['store/new','store/unchanged'];
  const good=setup(null,['store/shared']);
  await good.fn(saved,newer,previous,true);
  assert.equal(good.calls[0][0],'rpc','Gallery must be saved first');
  assert.deepEqual(Array.from(good.calls[1]).slice(1),['store/old.l.webp','store/old.s.webp'],'Only unused old image pair can be removed');
  const failed=setup(new Error('gallery update failed'));
  await assert.rejects(failed.fn(saved,newer,previous,true),/gallery update failed/);
  assert.equal(failed.calls.length,1,'Failed gallery save must never delete old images');
  const keep=setup();
  await keep.fn(saved,newer,previous,false);
  assert.equal(keep.calls.length,1,'No replacement must preserve all previous images');
  const failedCleanup=setup(null,[],new Error('storage cleanup failed'));
  await failedCleanup.fn(saved,newer,['store/old'],true);
  assert.equal(failedCleanup.calls.some(call=>call[0]==='warn'),true,'Storage deletion failure must be logged without failing saved gallery');
}
// Step 9 safety regression: ambiguous codes and conflicting IDs must not update a product.
assert.ok(adminImport.includes('matches.length>1'));
assert.ok(adminImport.includes('if(explicitId&&!byId)'));
assert.ok(adminImport.includes('if(byId&&matches.length'));


assert.match(adminImport,/const unmatched=products\.filter\(/,'Excel export must verify category coverage');
assert.match(adminImport,/exportedProductCount\+=rows\.length/,'Excel export must count generated rows');
assert.match(adminImport,/exportedProductCount!==products\.length/,'Excel export must reject incomplete workbooks');
assert.ok(adminImport.indexOf('exportedProductCount!==products.length')<adminImport.indexOf('window.XLSX.writeFile(wb,'),'Excel row check must precede download');


 // Step 8: do not silently truncate a catalog export at the PostgREST row cap.
 assert.match(admin,/\.range\(start,start\+pageSize-1\)/);
 for(const table of ['categories','products','product_images','site_catalogs']){
   assert.ok(admin.includes("loadAllCatalogRows('"+table+"'"),'Missing paginated catalog load: '+table);
 }
 {
   const start=admin.indexOf('  async function loadAllCatalogRows(');
   const end=admin.indexOf('\n  async function loadCatalogAdminData(',start);
   assert.ok(start>=0&&end>start,'Catalog pagination helper missing');
   const source=admin.slice(start,end).trim().replace(/^async function loadAllCatalogRows/,'async function loadAllCatalogRows');
   const rows=Array.from({length:1005},(_,i)=>({id:String(i),sort_order:i}));
   const ranges=[];
   const db={from:()=>({
     select(){return this;},order(){return this;},
     range(from,to){ranges.push([from,to]);return Promise.resolve({data:rows.slice(from,to+1),error:null});}
   })};
   const load=vm.runInNewContext('('+source+')',{db});
   const result=await load('products');
   assert.equal(result.error,null);
   assert.equal(result.data.length,1005,'All product rows must be loaded');
   assert.deepEqual(ranges,[[0,999],[1000,1999]]);
 }

assert.match(read('admin-import.js'), /integrity/);
assert.match(app, /JSPDF_SRI/);
assert.match(app, /https:\/\/cdn\.jsdelivr\.net\/npm\/jspdf@4\.2\.1\/dist\/jspdf\.umd\.min\.js/, 'Pinned jsPDF 4.2.1 loader missing');
assert.match(app, /sha256-5lUfzcMvCdaFOyxRJtGNAdlEfg2mGKQaEevu4PbCDVQ=/, 'jsPDF 4.2.1 SRI pin missing');
assert.doesNotMatch(app, /jspdf\/2\.5\.1\/jspdf\.umd\.min\.js/, 'Old jsPDF 2.5.1 loader remains');
assert.ok(catalogPdfViewer.includes('pdfjs/pdf.min.mjs?v=__FL_VERSION__'), 'PDF.js 4 ESM loader missing');
assert.ok(catalogPdfViewer.includes('pdfjs/pdf.worker.min.mjs?v=__FL_VERSION__'), 'PDF.js 4 matching worker missing');
assert.ok(catalogPdfViewer.includes('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/'), 'PDF.js 4 font URLs missing');
assert.ok(!catalogPdfViewer.includes('pdf.js/3.11.174'), 'Old vulnerable PDF.js reference remains');
assert.match(read('scripts/build.mjs'), /pdfjsSha256/, 'PDF.js vendor integrity pins missing');
assert.match(read('scripts/build.mjs'), /sha256!==pdfjsSha256\[asset\]/, 'PDF.js checksum verification missing');
assert.match(catalogPdfViewer, /isEvalSupported\s*:\s*false/, 'PDF catalog must disable eval to mitigate CVE-2024-4367');
assert.match(app, /parsed\.protocol==='https:'/);
assert.match(app, /localhost','127\.0\.0\.1/);
assert.match(sync, /challenges\.cloudflare\.com\/turnstile/);
assert.match(sync, /db\.functions\.invoke\(leadSubmissionFunction/);
assert.match(sync, /PUBLIC_PAGE_SIZE=500/);
assert.match(sync, /queryFactory\(\)\.range\(from,from\+PUBLIC_PAGE_SIZE-1\)/);
assert.match(submitLead, /turnstile\/v0\/siteverify/);
assert.match(submitLead, /consume_customer_lead_rate_limit/);
assert.match(submitLead, /crypto\.subtle\.digest/);
assert.match(submitLead, /content-length/);
assert.match(submitLead, /cf-connecting-ip/);
assert.doesNotMatch(submitLead, /x-forwarded-for/);
assert.doesNotMatch(submitLead, /insert\([^)]*ip/i);
assert.match(turnstileMigration, /customer_lead_rate_limits/);
const retentionMigration=read('supabase/migrations/20261006210000_customer_lead_retention.sql');
assert.match(retentionMigration, /purge_expired_customer_leads/);
assert.match(retentionMigration, /retention_days/);
assert.match(retentionMigration, /cron\.schedule/);
assert.match(submitLead, /purge_expired_customer_leads/);
assert.match(submitLead, /Cache-Control/);
const functionConfig=read('supabase/config.toml');
assert.match(functionConfig, /\[functions\.submit-customer-lead\]/);
assert.match(functionConfig, /verify_jwt\s*=\s*false/);
const v105Upgrade=read('supabase/UPGRADE_EXISTING_V105.sql');
assert.match(v105Upgrade, /TURNSTILE_CUSTOMER_LEADS_V104_OK/);
assert.match(v105Upgrade, /CUSTOMER_LEAD_RETENTION_V105_OK/);
assert.match(read('admin-leads.js'), /purge_expired_customer_leads/);
const v106Migration=read('supabase/migrations/20261007153000_dynamic_business_fields.sql');
assert.match(v106Migration, /business_public_fields/);
assert.match(v106Migration, /get_public_business_privacy/);
assert.match(v106Migration, /replace_legacy_product_image_for_owner/);
const v110Upgrade=read('supabase/UPGRADE_EXISTING_V110.sql');
assert.match(v110Upgrade, /BUSINESS_DYNAMIC_FIELDS_V106_OK/);
const businessAdmin=read('admin-business.js');
assert.match(businessAdmin, /flBusinessAddField/);
assert.match(businessAdmin, /business_public_fields/);
assert.match(businessAdmin, /data-business-action=\"delete\"/);
const businessInfo=read('business-info.js');
assert.match(businessInfo, /Array\.isArray\(data\?\.fields\)/);
assert.match(businessInfo, /fl-business-info-grid/);

const bankMigration=read('supabase/migrations/20261007170000_bank_accounts.sql');
assert.match(bankMigration,/business_bank_accounts/);
assert.match(bankMigration,/get_public_bank_accounts/);
assert.match(bankMigration,/BANK_ACCOUNTS_V108_OK/);
assert.match(v110Upgrade,/BANK_ACCOUNTS_V108_OK/);
assert.match(v110Upgrade,/UPGRADE_EXISTING_V110_OK/);
const bankAdmin=read('admin-banks.js');
assert.match(bankAdmin,/flBankAdd/);
assert.match(bankAdmin,/validIban/);
assert.match(bankAdmin,/business_bank_accounts/);
const bankInfo=read('bank-info.js');
assert.match(bankInfo,/get_public_bank_accounts/);
assert.match(bankInfo,/fl-bank-copy/);
assert.match(bankInfo,/pageshow[\s\S]*event\.persisted/);
assert.match(sw,/bank-info\.js\?v=__FL_VERSION__/);

assert.match(turnstileMigration, /updated_at < v_now - interval '7 days'/);
assert.match(sw, /isNavigation[\s\S]*fetch\(request\)/);
assert.match(sw, /clients\.get\(event\.clientId\)/);
assert.match(sw, /site-loader\.js\?v=__FL_VERSION__/);
assert.match(sw, /business-info\.js\?v=__FL_VERSION__/);
assert.match(read('README.md'), /Source = GitHub Actions/);
assert.match(read('README.md'), /لا تستخدم \*\*Deploy from a branch/);

assert.match(sql,/add column if not exists price numeric\(12,2\)/i);
assert.match(sql,/add column if not exists wholesale_price numeric\(12,2\)/i);
assert.match(sql,/add column if not exists wholesale_min_qty integer/i);
assert.match(sql,/add column if not exists limited_offer boolean not null default false/i);
const pricingMigration=read('supabase/migrations/2026-10-05_product_pricing_columns.sql');
assert.match(pricingMigration,/PRODUCT_PRICING_COLUMNS_OK/);


// v111B: static SEO/share pages are generated at build time and are never service-worker shell routes.
const staticGenerator=read('scripts/generate-static-pages.mjs');
assert.match(staticGenerator,/export async function generateStaticPages/);
assert.match(staticGenerator,/table: 'categories'/);
assert.match(staticGenerator,/table: 'products'/);
assert.match(staticGenerator,/table: 'product_images'/);
assert.match(staticGenerator,/is_visible', 'eq\.true'/);
assert.match(staticGenerator,/twitter:card/);
assert.match(staticGenerator,/application\/ld\+json/);
assert.match(staticGenerator,/sitemap\.xml/);
assert.match(read('scripts/build.mjs'),/generateStaticPages/);
assert.match(read('scripts/build.mjs'),/FL_SKIP_STATIC_PAGES/);
assert.ok(sw.includes("/(?:p|c)/") || sw.includes("(?:p|c)"));
assert.match(app,/new URL\(`p\/\$\{encodeURIComponent\(id\)\}\/`/);
assert.match(app,/new URL\(`c\/\$\{encodeURIComponent\(key\)\}\/`/);
const pagesWorkflow=read('.github/workflows/pages.yml');
assert.match(pagesWorkflow,/cron: '0 \*\/6 \* \* \*'/);
assert.match(pagesWorkflow,/workflow_dispatch:/);


// v111 task 4: multi-product quote list.
const quoteList=read('quote-list.js');
assert.match(read('index.html'),/quote-list\.js\?v=__FL_VERSION__/);
assert.match(sw,/quote-list\.js\?v=__FL_VERSION__/);
assert.match(read('scripts/build.mjs'),/'quote-list\.js'/);
assert.match(app,/FL_QUOTE_LIST\?\.createAddControl/);
assert.match(app,/flPrimaryWhatsAppNumber/);
assert.match(app,/flShowPublicToast/);
assert.match(quoteList,/fl_quote_list_v1/);
assert.match(quoteList,/MAX_ITEMS\s*=\s*30/);
assert.match(quoteList,/MAX_QTY\s*=\s*9999/);
assert.match(quoteList,/MAX_URL_LENGTH\s*=\s*1800/);
assert.match(quoteList,/quote_list_add/);
assert.match(quoteList,/quote_list_send/);
assert.match(quoteList,/role="dialog"/);
assert.match(cssComparableFile('styles/products.css'),/\.fl-quote-bar/);
assert.match(app,/classList\.toggle\('has-quote-list'/);
assert.match(quoteList,/closest\('\.product-card-actions'\)\?\.classList\.toggle\('has-quote-list'/);
assert.match(cssComparableFile('styles/products.css'),/\.product-card-actions\.has-quote-list \.product-whatsapp-button[\s\S]*?grid-column:1!important/);
assert.match(cssComparableFile('styles/products.css'),/\.product-card-actions\.has-quote-list \.quote-list-product-control[\s\S]*?grid-column:2!important/);
assert.match(cssComparableFile('styles/products.css'),/\.product-card-actions:not\(\.has-quote-list\) \.product-whatsapp-button[\s\S]*?grid-column:1\/-1!important/);


// v111D: Owner controls whether the public quote-list feature is visible.
const quoteVisibilityMigration=read('supabase/migrations/20261010113500_quote_list_visibility.sql');
const v111Upgrade=read('supabase/UPGRADE_EXISTING_V111.sql');
const adminSettings=read('admin-settings.js');
const publicSync=read('public-sync.js');
assert.match(sql,/quote_list_enabled boolean not null default true/i);
assert.match(quoteVisibilityMigration,/quote_list_enabled/);
assert.match(quoteVisibilityMigration,/QUOTE_LIST_VISIBILITY_V111D_OK/);
assert.match(v111Upgrade,/quote_list_enabled/);
assert.match(v111Upgrade,/UPGRADE_EXISTING_V111_OK/);
assert.match(adminSettings,/flQuoteListSettingsForm/);
assert.match(adminSettings,/quote_list_enabled/);
assert.match(publicSync,/quote_list_enabled/);
assert.match(publicSync,/flowerlight:site-settings/);
assert.match(quoteList,/quote_list_enabled/);
assert.match(quoteList,/flowerlight:site-settings/);
assert.match(quoteList,/isEnabled/);
assert.match(quoteList,/createQuantityInput/);
assert.match(quoteList,/input\.type = 'number'/);
assert.match(quoteList,/input\.min = '1'/);
assert.match(quoteList,/input\.max = String\(MAX_QTY\)/);
assert.match(quoteList,/input\.addEventListener\('change'/);
assert.match(cssComparableFile('styles/products.css'),/\.fl-quote-item-qty-input/);


// v111H: product availability states.
const availabilityMigration=read('supabase/migrations/20261010150500_product_availability.sql');
const productForm=read('admin-product-form.js');
const productAdmin=read('admin-products.js');
const productImport=read('admin-import.js');
assert.match(sql,/availability text not null default 'available'/i);
assert.match(sql,/products_availability_check/i);
assert.match(v111Upgrade,/availability text not null default 'available'/i);
assert.match(availabilityMigration,/PRODUCT_AVAILABILITY_V111H_OK/);
assert.match(publicSync,/availability:\['available','out_of_stock','coming_soon'\]/);
assert.match(app,/product-availability-badge/);
assert.match(productForm,/flProdAvailability/);
assert.match(productAdmin,/AVAILABILITY_LABELS/);
assert.match(productImport,/حالة التوفر/);
assert.match(quoteList,/availability !== 'available'/);
assert.match(cssComparableFile('styles/products.css'),/\.product-availability-badge\.is-out_of_stock/);


// v111I / task 6: global catalog search. Specification filters remain deferred
// until product specification keys are normalized across the catalog.
const catalogSearch=read('catalog-search.js');
assert.match(index,/aria-label="بحث في جميع أقسام المنتجات"/);
assert.match(app,/dataset\.productName/);
assert.match(app,/dataset\.productModel/);
assert.match(catalogSearch,/querySelectorAll\('\.extra-section-panel'\)/);
assert.match(catalogSearch,/catalog-search-section-label/);
assert.match(catalogSearch,/لا توجد نتائج مطابقة للبحث والفلاتر/);
assert.match(catalogSearch,/site-catalog-tab/);


// v111M / task 6: dedicated, reusable and dependent search filters.
const catalogFilterMigration=read('supabase/migrations/20261010203000_catalog_filter_selection.sql');
const customFilterMigration=read('supabase/migrations/20261010213000_catalog_custom_filters.sql');
const searchFiltersAdmin=read('admin-search-filters.js');
assert.match(sql,/catalog_filter_keys text\[\] not null default/i);
assert.match(sql,/catalog_custom_filters jsonb not null default/i);
assert.match(v111Upgrade,/catalog_filter_keys/);
assert.match(v111Upgrade,/catalog_custom_filters/);
assert.match(catalogFilterMigration,/CATALOG_FILTER_SELECTION_V111L_OK/);
assert.match(customFilterMigration,/CATALOG_CUSTOM_FILTERS_V111M_OK/);
assert.doesNotMatch(adminSettings,/flCatalogFilterSettingsForm/);
assert.match(searchFiltersAdmin,/فلاتر البحث/);
assert.match(searchFiltersAdmin,/إضافة فلتر جديد/);
assert.match(searchFiltersAdmin,/catalog_custom_filters/);
assert.match(searchFiltersAdmin,/catalog_filter_keys/);
assert.match(admin,/search-filters/);
assert.match(admin,/productSpecFields/);
assert.match(publicSync,/catalog_filter_keys/);
assert.match(publicSync,/catalog_custom_filters/);
assert.match(read('site-loader.js'),/admin-search-filters\.js/);
const catalogSearchFilters=read('catalog-search.js');
assert.match(app,/dataset\.filterSpecs/);
assert.match(catalogSearchFilters,/catalog_filter_keys/);
assert.match(catalogSearchFilters,/catalog_custom_filters/);
assert.match(catalogSearchFilters,/BASE_FILTER_DEFS/);
assert.match(catalogSearchFilters,/catalogFilter_/);
assert.match(catalogSearchFilters,/catalogFilterClear/);
assert.match(catalogSearchFilters,/cardMatchesFilters/);
assert.match(catalogSearchFilters,/choicesFor/);
assert.match(catalogSearchFilters,/exceptKey/);
assert.match(catalogSearchFilters,/flowerlight:site-settings/);


// v111O / task 7: system dark mode without changing export canvases.
assert.match(read('theme-dark.css'),/color-scheme:dark/);
assert.match(read('theme-mode.js'),/flowerlight:public-theme/);
assert.match(index,/id="flThemeSwitch"/);
assert.match(index,/<section class="hero" id="siteHero">\s*<button id="flThemeSwitch"/);
assert.doesNotMatch(index,/<main class="page">\s*<button id="flThemeSwitch"/);
assert.match(cssComparableFile('styles/responsive.css'),/\.fl-theme-switch\{position:absolute;top:40px;right:24px;left:auto;/);
assert.match(cssComparableFile('styles/responsive.css'),/@media\(max-width:420px\)\{\.fl-theme-switch\{right:18px;left:auto;top:20px;/);
assert.match(index,/id="flDarkThemeCss"/);
assert.match(sw,/theme-dark\.css\?v=__FL_VERSION__/);
assert.match(sw,/theme-mode\.js\?v=__FL_VERSION__/);
assert.match(index,/name="color-scheme" content="light dark"/);
assert.match(index,/theme-color" content="#111827" media="\(prefers-color-scheme: dark\)"/);
assert.match(index,/theme-color" content="#ff9f0a" media="\(prefers-color-scheme: light\)"/);
assert.doesNotMatch(read('styles/responsive.css'),/site-catalog-page canvas/);

// v115: public English/Arabic locale module loaded before public UI.
assert.match(index,/site-i18n\.js\?v=__FL_VERSION__/);
assert.match(index,/id="flLanguageSwitch"/);
assert.match(read('privacy-en.html'),/lang="en" dir="ltr"/);
assert.match(read('privacy-en.html'),/Privacy Policy \| Basair Gulf/);
assert.match(read('privacy.html'),/href="privacy-en.html"/);
assert.match(read('site-i18n.js'),/privacy-en\\.html/);
assert.match(read('site-i18n.js'),/flowerlight:public-language/);
assert.match(read('site-i18n.js'),/MutationObserver/);
assert.match(sw,/site-i18n\.js\?v=__FL_VERSION__/);
assert.match(read('scripts/build.mjs'),/site-i18n\.js/);

// Task 8: error listeners and a safe analytics fallback without GA4 setup.
const analyticsSource = read('analytics.js');
assert.match(analyticsSource, /unhandledrejection/);
assert.match(analyticsSource, /js_error/);
assert.match(analyticsSource, /MAX_SESSION_ERRORS = 5/);
const noAnalyticsWindow = {
  FLOWER_LIGHT_ANALYTICS_CONFIG: { measurementId: '' },
  addEventListener() {},
};
vm.runInNewContext(analyticsSource, { window: noAnalyticsWindow, console });
assert.doesNotThrow(() => noAnalyticsWindow.flTrack('js_error', { message: 'TypeError', source: 'app.js', line: 1 }));

// v116: authoritative bilingual product/category fields, preserving Arabic originals.
const bilingualSql=read('supabase/UPGRADE_EXISTING_V116.sql');
for(const field of ['name_en','description_en','caption_en','specifications_en'])assert.match(bilingualSql,new RegExp(field));
assert.match(index,/flLanguageSwitch/);
assert.match(admin,/flCatNameEn/);
assert.match(admin,/flCatDescEn/);
assert.match(read('admin-product-form.js'),/flProdNameEn/);
assert.match(read('admin-product-form.js'),/flProdCaptionEn/);
assert.match(read('admin-product-form.js'),/collectEnglishProductSpecifications/);
assert.match(read('admin-products.js'),/specifications_en/);
assert.match(read('public-sync.js'),/description_en/);
assert.match(read('public-sync.js'),/specifications_en/);
assert.match(app,/localizedProduct/);
assert.match(app,/localizedSection/);
assert.match(app,/Products in/);
assert.match(read('catalog-search.js'),/dataset.categorySearch/);

// v117: localized public card profile/contact labels and safe migration.
const publicCardSql=read('supabase/UPGRADE_EXISTING_V117.sql');
for(const column of ['brand_name_en','company_name_en','label_en'])assert.match(publicCardSql,new RegExp(column));
assert.match(publicCardSql,/PUBLIC_CARD_I18N_V117_OK/);
assert.match(read('admin.js'),/flProfileBrandEn/);
assert.match(read('admin.js'),/flProfileCompanyEn/);
assert.match(read('admin.js'),/flContactLabelEn/);
assert.match(read('public-sync.js'),/contactDisplayLabel/);
assert.match(read('public-sync.js'),/flowerlight:language-change/);
assert.match(read('public-sync.js'),/Explore/);
assert.match(read('bank-info.js'),/bank accounts/);
assert.match(read('bank-info.js'),/flowerlight:language-change/);
assert.match(read('business-info.js'),/translateLabel/);

// Production safety: never submit personal data without server-verified Turnstile.
assert.doesNotMatch(sync,/db\.from\(['"]customer_leads['"]\)\.insert/);
assert.match(sync,/if\(!turnstileSiteKey\)/);
assert.match(sync,/db\.functions\.invoke\(leadSubmissionFunction/);
const securityAudit=read('supabase/SECURITY_AUDIT_READONLY_V117.sql');
const statements=securityAudit.split('\n').filter(line=>!/^\s*--/.test(line)).join('\n');
assert.doesNotMatch(statements,/\b(?:INSERT|UPDATE|DELETE|ALTER|DROP|GRANT|REVOKE|CREATE|TRUNCATE|EXECUTE)\s+(?:INTO|TABLE|FROM|ON|POLICY|FUNCTION|ROLE|SCHEMA|INDEX)\b/i);
assert.match(securityAudit,/anon_can_insert_customer_leads/);
assert.match(securityAudit,/authenticated_can_insert_customer_leads/);
const edgeOnlySql=read('supabase/UPGRADE_CUSTOMER_LEADS_EDGE_ONLY_V118.sql');
assert.match(edgeOnlySql,/revoke insert on table public\.customer_leads from anon, authenticated/i);
assert.match(edgeOnlySql,/grant insert on table public\.customer_leads to service_role/i);
assert.match(read('supabase/migrations/2026-10-06_turnstile_customer_leads.sql'),/revoke insert on table public\.customer_leads from anon, authenticated/i);
assert.match(sql,/revoke insert on table public\.customer_leads from anon, authenticated/i);

console.log('FLOWER_LIGHT_FINAL_SMOKE_OK');
