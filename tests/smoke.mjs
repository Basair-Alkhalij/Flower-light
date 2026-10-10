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
const admin = read('admin.js');
const adminMedia = read('admin-media.js');
const adminProducts = read('admin-products.js');
const adminProductForm = read('admin-product-form.js');
const adminImport = read('admin-import.js');
const adminDatasheet = read('admin-datasheet.js');
const adminProductBundle = [admin,adminMedia,adminProducts,adminProductForm,adminImport].join('\n');
const sync = read('public-sync.js');
const siteBootstrap = read('site-bootstrap.js');
const siteLoader = read('site-loader.js');
const submitLead = read('supabase/functions/submit-customer-lead/index.ts');
const turnstileMigration = read('supabase/migrations/2026-10-06_turnstile_customer_leads.sql');
// Owner site-settings cards moved to admin-settings.js (module split part 4); their UI strings are checked across both files.
const adminWithSettings = `${admin}\n${read('admin-settings.js')}`;
const cssEntry = read('style.css');
const css = ['styles/core.css','styles/products.css','styles/responsive.css','styles/admin.css','styles/business-bank.css'].map(read).join('\n');
const manageAdmin = read('supabase/functions/manage-admin-account/index.ts');
const sql = read('SUPABASE_SETUP.sql');

assert.match(index, /Basair Gulf Flower Light/);
assert.doesNotMatch(index, /\?v=70/);
assert.doesNotMatch(index, /\?v=78/);
assert.doesNotMatch(index, /\?v=79/);
assert.match(index, /style\.css\?v=__FL_VERSION__/);
assert.match(index, /share-image\.jpg/);
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
    title: 'بصائر الخليج | مستودع منتجات فلور لايت',
    getElementById: id => id === 'robotsMeta'
      ? { setAttribute: (name, value) => { if (name === 'content') robots = value; } }
      : null,
  };
  vm.runInNewContext(seoScript, { document, location: { search }, URLSearchParams });
  return { title: document.title, robots };
};
assert.deepEqual(evaluateSeo(''), {
  title: 'بصائر الخليج | مستودع منتجات فلور لايت',
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
assert.match(adminDatasheet, /flDatasheetDesignerForm[\s\S]*createAdminDatasheetExport/);
assert.doesNotMatch(admin, /createAdminDatasheetPdf/);
assert.doesNotMatch(app, /requestAnimationFrame\(\(\)=>renderSiteCatalogPages/);
assert.doesNotMatch(`${index}\n${app}\n${admin}\n${sync}`, /quote_service_visible|quoteModal|paperQuote|عرض عرض سعر|طلب عرض سعر|flSubmitImageQuoteRequest|quoteBucket/i);
assert.doesNotMatch(css, /\\n\\n/);
const responsiveQueries = [...css.matchAll(/@media\s*([^\{]+)\{/g)]
  .map(match => match[1].trim().replace(/\s+/g, ' '));
assert.deepEqual(responsiveQueries, [
  '(max-width:520px)',
  '(max-width: 760px)',
  '(max-width: 430px)',
  '(min-width: 761px)',
  '(prefers-reduced-motion: reduce)',
  '(min-width:720px)',
  '(max-width:420px)',
  '(prefers-reduced-motion:reduce)',
  '(max-width: 760px)',
  '(max-width: 520px)',
  '(max-width:520px)',
]);
assert.match(css, /Consolidated responsive architecture/);
assert.match(admin, /ownerSettingsViewItems/);
assert.match(admin, /site-settings/);
assert.match(admin, /business-settings/);
assert.match(admin, /template-settings/);
assert.match(admin, /fl-cloud-nav-group/);
assert.match(admin, /primaryRecoverySettingsCardHtml\(\)/);
assert.match(css, /\.fl-overview-shortcuts/);
assert.match(css, /\.fl-price-tier-row\{[\s\S]*?grid-template-columns:minmax\(96px,1\.05fr\)/);
assert.match(css, /\.fl-cloud-mini\{min-height:44px\}/);
assert.match(css, /\.fl-cloud-dialog\.fl-product-dialog\{[\s\S]*?width:min\(980px,calc\(100vw - 32px\)\)/);
assert.match(css, /\.image-lightbox\{[\s\S]*?align-items:flex-start!important/);
assert.match(adminProductBundle, /classList\.add\('fl-product-dialog'\)/);
assert.match(app, /imageLightbox\.scrollTop = 0/);
assert.match(app, /actions\.append\(pdfButton, shareButton, whatsappLink\)/);
assert.match(css, /\.product-card-actions \.product-whatsapp-button\{[\s\S]*?grid-column:1\/-1!important;/);
assert.match(css, /\.image-lightbox-actions \.image-lightbox-whatsapp\{[\s\S]*?grid-column:1\/-1!important;/);
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
assert.match(app, /سعر جملة الجملة/);
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
assert.match(app, /function catalogDesignFooterNumber\(\)/);
assert.match(app, /رقم التواصل/);
assert.doesNotMatch(app, /زوروا موقعنا الإلكتروني/);
assert.match(read('SUPABASE_SETUP.sql'), /design_footer_number text not null default ''/);
assert.match(read('SUPABASE_SETUP.sql'), /STAGE88_DESIGN_FOOTER_LABEL_OK/);

// STAGE88: one optional Owner-managed barcode is shared by all approved export templates.
assert.match(adminWithSettings, /flMasterBarcodeSettingsForm/);
assert.match(adminWithSettings, /uploadMasterBarcodeFile/);
assert.match(adminWithSettings, /master_barcode_path/);
assert.match(sync, /master_barcode_path/);
assert.match(app, /function masterBarcodeUrl\(\)/);
assert.match(app, /async function drawMasterBarcode/);
assert.match(app, /barcodeDrawn/);
assert.match(read('SUPABASE_SETUP.sql'), /master_barcode_path text not null default ''/);
assert.match(read('SUPABASE_SETUP.sql'), /site-settings/);
assert.match(read('SUPABASE_SETUP.sql'), /STAGE88_MASTER_BARCODE_OK/);
assert.match(read('SUPABASE_SETUP.sql'), /STAGE88_FINAL_OK/);

// STAGE88: Admin 2 permissions must be identical across UI, SQL and Edge Function.
assert.match(admin, /delegatablePermissionKeys = new Set\(\[\.\.\.validPermissionKeys\]\.filter\(key=>!\['sections','products'\]\.includes\(key\)\)\)/);
assert.match(admin, /currentAdminPermissions=new Set\(normalizePermissionList\(data\)\)/);
assert.match(siteLoader, /if \(adminPanel === '2'\) document\.getElementById\('flCloudPrimaryAdmin'\)\?\.remove\(\)/);
const edgeAdmin=read('supabase/functions/manage-admin-account/index.ts');
const edgeAllowed=edgeAdmin.match(/const allowedPermissions = new Set\(\[([\s\S]*?)\]\)/)?.[1]||'';
for(const permission of ['analytics','profile','contacts','leads','datasheet']) assert.match(edgeAllowed,new RegExp(`['\"]${permission}['\"]`));
for(const forbidden of ['sections','products','quotes','services']) assert.doesNotMatch(edgeAllowed,new RegExp(`['\"]${forbidden}['\"]`));
const hardeningStart=sql.lastIndexOf('STAGE88 ADMIN=2 FINAL PERMISSION HARDENING');
const hardeningEnd=sql.indexOf('STAGE88 GLOBAL MASTER BARCODE',hardeningStart);
const hardening=sql.slice(hardeningStart,hardeningEnd>hardeningStart?hardeningEnd:undefined);
for(const permission of ['analytics','profile','contacts','leads','datasheet']) assert.match(hardening,new RegExp(`['\"]${permission}['\"]`));
for(const forbidden of ['sections','products','quotes','services']) assert.doesNotMatch(hardening,new RegExp(`['\"]${forbidden}['\"]`));
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
for(const asset of ['analytics.js','catalog-pdf-viewer.js','app.js','site-bootstrap.js','site-loader.js','admin.js','admin-datasheet.js','admin-media.js','admin-products.js','admin-product-form.js','admin-import.js','public-sync.js','style.css' ,'company-logo.png','favicon-32.png','favicon-192.png','apple-touch-icon.png','favicon.ico','share-image.jpg']){
  assert.ok(fs.existsSync(path.join(root,asset)),`required release asset missing: ${asset}`);
}

// STAGE88: release contains only the canonical social preview asset and no obsolete stage files.
assert.ok(fs.existsSync(path.join(root,'share-image.jpg')));
assert.equal(fs.existsSync(path.join(root,'share-image-v78.jpg')),false);
const releaseNames=fs.readdirSync(root);
assert.equal(releaseNames.some(name=>/^README_STAGE/i.test(name)),false);
assert.equal(releaseNames.some(name=>/^FINAL_SQL_STAGE/i.test(name)),false);
const textBundle=[index,app,adminProductBundle,sync,css,read('README.md'),read('SUPABASE_SETUP.sql')].join('\n');
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
assert.match(siteLoader,/admin-leads\.js\?v=__FL_VERSION__/);
assert.match(leadsJs,/window\.FL_ADMIN_LEADS\s*=/);
assert.match(admin,/FL_ADMIN_LEADS/);
assert.doesNotMatch(admin,/function\s+(renderLeads|loadLeadsPage|deleteLead|deleteAllLeads|exportAllLeads)\b/);
assert.match(leadsJs,/customer_leads/);

// Module split part 3: permissions screen lives in admin-permissions.js.
const permsJs=read('admin-permissions.js');
assert.match(siteLoader,/admin-permissions\.js\?v=__FL_VERSION__/);
assert.match(permsJs,/window\.FL_ADMIN_PERMISSIONS\s*=/);
assert.match(permsJs,/owner_set_admin2_settings/);
assert.match(admin,/renderSplitSection\('FL_ADMIN_PERMISSIONS'/);
assert.doesNotMatch(admin,/function\s+renderPermissions\b/);

// Module split part 4: Owner site-settings cards live in admin-settings.js.
const settingsJs=read('admin-settings.js');
assert.match(siteLoader,/admin-settings\.js\?v=__FL_VERSION__/);
assert.match(settingsJs,/window\.FL_ADMIN_SETTINGS\s*=/);
assert.match(settingsJs,/site_settings/);
assert.match(settingsJs,/require_customer_lead/);
assert.match(admin,/FL_ADMIN_SETTINGS/);
assert.doesNotMatch(admin,/function\s+uploadMasterBarcodeFile\b/);
assert.doesNotMatch(admin,/flMasterBarcodeSettingsForm'\)\?\.addEventListener/);


// v100: product-area split and responsive WebP thumbnails.
assert.match(siteLoader,/admin-media\.js\?v=__FL_VERSION__/);
assert.match(siteLoader,/admin-products\.js\?v=__FL_VERSION__/);
assert.match(siteLoader,/admin-product-form\.js\?v=__FL_VERSION__/);
assert.match(siteLoader,/admin-import\.js\?v=__FL_VERSION__/);
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
assert.doesNotMatch(pwaInstall,/SamsungBrowser|hasTrustedWebApkPath/);
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
assert.match(siteLoader, /admin-import\.js\?v=__FL_VERSION__/);
assert.match(read('admin-import.js'), /xlsx-0\.20\.3/);
assert.match(read('admin-import.js'), /integrity/);
assert.match(app, /JSPDF_SRI/);
assert.match(catalogPdfViewer, /PDFJS_SRI/);
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
assert.match(read('styles/products.css'),/\.fl-quote-bar/);
assert.match(app,/classList\.toggle\('has-quote-list'/);
assert.match(quoteList,/closest\('\.product-card-actions'\)\?\.classList\.toggle\('has-quote-list'/);
assert.match(read('styles/products.css'),/\.product-card-actions\.has-quote-list \.product-whatsapp-button[\s\S]*?grid-column:1!important/);
assert.match(read('styles/products.css'),/\.product-card-actions\.has-quote-list \.quote-list-product-control[\s\S]*?grid-column:2!important/);
assert.match(read('styles/products.css'),/\.product-card-actions:not\(\.has-quote-list\) \.product-whatsapp-button[\s\S]*?grid-column:1\/-1!important/);


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
assert.match(read('styles/products.css'),/\.fl-quote-item-qty-input/);


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
assert.match(read('styles/products.css'),/\.product-availability-badge\.is-out_of_stock/);


// v111I / task 6: global catalog search. Specification filters remain deferred
// until product specification keys are normalized across the catalog.
const catalogSearch=read('catalog-search.js');
assert.match(index,/aria-label="بحث في جميع أقسام المنتجات"/);
assert.match(app,/dataset\.productName/);
assert.match(app,/dataset\.productModel/);
assert.match(catalogSearch,/querySelectorAll\('\.extra-section-panel'\)/);
assert.match(catalogSearch,/catalog-search-section-label/);
assert.match(catalogSearch,/لا توجد نتائج مطابقة في جميع الأقسام/);
assert.match(catalogSearch,/site-catalog-tab/);

console.log('FLOWER_LIGHT_FINAL_SMOKE_OK');
