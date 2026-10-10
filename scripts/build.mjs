import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { stripTypeScriptTypes } from 'node:module';
import { fileURLToPath } from 'node:url';
import { generateStaticPages } from './generate-static-pages.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
const versionParts=String(pkg.version||'').split('.');
if(versionParts.length!==3 || versionParts.some(part=>!/^\d+$/.test(part))) throw new Error('package.json version must be numeric semver (x.y.z)');
const releaseVersion=versionParts.join('');
const VERSION_TOKEN='__FL_VERSION__';
const JSONLD_CSP_TOKEN='__FL_JSONLD_CSP_HASH__';
const DEFAULT_SITE_URL='https://basair-alkhalij.github.io/Flower-light/';

const jsFiles=[
  'scripts/generate-static-pages.mjs',
  'analytics.js','catalog-pdf-viewer.js','app.js','public-sync.js','pwa-install.js','catalog-search.js','config.js','site-bootstrap.js','site-loader.js',
  'admin.js','admin-analytics.js','admin-datasheet.js','admin-leads.js','admin-permissions.js','admin-settings.js','admin-business.js','admin-banks.js',
  'business-info.js','bank-info.js','admin-media.js','admin-products.js','admin-product-form.js','admin-import.js','sw.js'
];
for(const file of jsFiles){
  const result=spawnSync(process.execPath,['--check',file],{cwd:root,encoding:'utf8'});
  if(result.status!==0){process.stderr.write(result.stderr||result.stdout);process.exit(result.status||1);}
}
for(const file of ['supabase/functions/manage-admin-account/index.ts','supabase/functions/submit-customer-lead/index.ts']){
  const source=fs.readFileSync(path.join(root,file),'utf8');
  let stripped;
  try{stripped=stripTypeScriptTypes(source,{mode:'strip'});}catch(error){
    console.error(`TypeScript strip failed: ${file}`);
    console.error(error?.stack||error);
    process.exit(1);
  }
  const tempName=`.fl-ts-check-${path.basename(file,'.ts')}-${process.pid}.mjs`;
  const tempPath=path.join(root,tempName);
  try{
    fs.writeFileSync(tempPath,stripped);
    const result=spawnSync(process.execPath,['--check',tempName],{cwd:root,encoding:'utf8'});
    if(result.status!==0){process.stderr.write(result.stderr||result.stdout);process.exit(result.status||1);}
  }finally{fs.rmSync(tempPath,{force:true});}
}

const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
if(!index.includes(JSONLD_CSP_TOKEN)){console.error('Missing JSON-LD CSP hash token in index.html');process.exit(1);}
const loader=fs.readFileSync(path.join(root,'site-loader.js'),'utf8');
for(const ref of [
  `style.css?v=${VERSION_TOKEN}`,`config.js?v=${VERSION_TOKEN}`,`analytics.js?v=${VERSION_TOKEN}`,`catalog-pdf-viewer.js?v=${VERSION_TOKEN}`,`app.js?v=${VERSION_TOKEN}`,`site-loader.js?v=${VERSION_TOKEN}`,
  `admin-datasheet.js?v=${VERSION_TOKEN}`,`admin-media.js?v=${VERSION_TOKEN}`,`admin-products.js?v=${VERSION_TOKEN}`,`admin-product-form.js?v=${VERSION_TOKEN}`,`admin-import.js?v=${VERSION_TOKEN}`
]){
  const haystack=ref.startsWith('admin-')?loader:index;
  if(!haystack.includes(ref)){console.error(`Missing release reference: ${ref}`);process.exit(1);}
}
for(const file of ['index.html','privacy.html','manifest.webmanifest','site-loader.js','sw.js']){
  const source=fs.readFileSync(path.join(root,file),'utf8');
  if(!source.includes(VERSION_TOKEN)){console.error(`Missing version token in ${file}`);process.exit(1);}
  if(/\?v=103\b/.test(source)){console.error(`Stale v103 reference in ${file}`);process.exit(1);}
}

const budgets={
  'admin.js':140_000,
  'app.js':120_000,
  'public-sync.js':65_000,
};
for(const [file,max] of Object.entries(budgets)){
  const data=fs.readFileSync(path.join(root,file));
  const raw=data.length;
  const gzip=zlib.gzipSync(data,{level:9}).length;
  console.log(`${file}: ${raw} bytes raw / ${gzip} bytes gzip`);
  if(raw>max){console.error(`${file} exceeds size budget ${max}`);process.exit(1);}
}
const styleParts=['styles/core.css','styles/products.css','styles/responsive.css','styles/admin.css','styles/business-bank.css'];
const combinedCss=styleParts.map(file=>fs.readFileSync(path.join(root,file),'utf8')).join('\n');
console.log(`style modules: ${Buffer.byteLength(combinedCss)} bytes raw / ${zlib.gzipSync(Buffer.from(combinedCss),{level:9}).length} bytes gzip`);
if(Buffer.byteLength(combinedCss)>130_000){console.error('Combined CSS exceeds size budget 130000');process.exit(1);}
console.log(`BUILD_CHECK_OK v${releaseVersion}`);


function applyHtmlSecurityTokens(source,fileName){
  if(fileName!=='index.html') return source;
  const match=source.match(/<script\s+type=["']application\/ld\+json["']>([\s\S]*?)<\/script>/i);
  if(!match) throw new Error('Missing application/ld+json block in index.html');
  const hash='sha256-'+crypto.createHash('sha256').update(match[1],'utf8').digest('base64');
  return source
    .replaceAll(JSONLD_CSP_TOKEN,hash)
    .replace('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/dist/umd/supabase.js','supabase-vendor.js?v='+releaseVersion)
    .replace(' https://cdn.jsdelivr.net','');
}

if (!process.argv.includes('--check')) {
  const {transform}=await import('esbuild');
  const settings = JSON.parse(fs.readFileSync(path.join(root,'site-settings.json'),'utf8'));
  const rawUrl = process.env.SITE_URL || settings.siteUrl;
  const site = new URL(rawUrl);
  if(site.protocol !== 'https:' || site.search || site.hash || site.username || site.password) throw new Error('SITE_URL must be a clean HTTPS URL');
  const siteUrl=site.href.replace(/\/?$/, '/');
  const out=path.join(root,'dist');
  fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(out);
  const sizes={};

  // Production self-hosting: fetch the exact pinned Supabase UMD bundle at build time
  // and serve it from the same origin. Runtime no longer depends on the Supabase CDN.
  const supabaseVendorUrl='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/dist/umd/supabase.js';
  let supabaseVendor;
  try{
    const localVendor=String(process.env.FL_SUPABASE_VENDOR_FILE||'').trim();
    if(localVendor){
      supabaseVendor=fs.readFileSync(path.resolve(root,localVendor));
    }else{
      const response=await fetch(supabaseVendorUrl,{redirect:'follow'});
      if(!response.ok) throw new Error(`HTTP ${response.status}`);
      supabaseVendor=Buffer.from(await response.arrayBuffer());
      if(supabaseVendor.length<100_000) throw new Error('downloaded file is unexpectedly small');
    }
    fs.writeFileSync(path.join(out,'supabase-vendor.js'),supabaseVendor);
    sizes['supabase-vendor.js']={source:supabaseVendor.length,minified:supabaseVendor.length,gzip:zlib.gzipSync(supabaseVendor,{level:9}).length};
  }catch(error){
    throw new Error(`Unable to prepare pinned Supabase browser bundle: ${error?.message||error}`);
  }

  for(const entry of fs.readdirSync(root,{withFileTypes:true})){
    const name=entry.name;
    if(!entry.isFile() || !(/\.(html|js|css|png|jpg|jpeg|ico|webmanifest|xml)$/.test(name) || ['robots.txt','.nojekyll'].includes(name))) continue;
    const data=fs.readFileSync(path.join(root,name));
    let output=data;
    if(/\.(js|css)$/.test(name)){
      const rawSource=name==='style.css'?combinedCss:data.toString();
      const source=rawSource.replaceAll(VERSION_TOKEN,releaseVersion).replaceAll(DEFAULT_SITE_URL,siteUrl);
      const result=await transform(source,{loader:name.endsWith('.css')?'css':'js',minify:true,target:'es2020',charset:'utf8',legalComments:'inline'});
      output=Buffer.from(result.code);
      sizes[name]={source:Buffer.byteLength(rawSource),minified:output.length,gzip:zlib.gzipSync(output,{level:9}).length};
    }else if(/\.(html|xml|webmanifest)$/.test(name)||name==='robots.txt'){
      { const replaced=data.toString().replaceAll(VERSION_TOKEN,releaseVersion).replaceAll(DEFAULT_SITE_URL,siteUrl); output=Buffer.from(applyHtmlSecurityTokens(replaced,name)); }
    }
    fs.writeFileSync(path.join(out,name),output);
  }


  if (process.env.FL_SKIP_STATIC_PAGES === '1') {
    console.warn('STATIC_PAGES_SKIPPED FL_SKIP_STATIC_PAGES=1');
  } else {
    try {
      const staticResult = await generateStaticPages({ outDir: out, baseUrl: siteUrl, projectRoot: root });
      console.log('STATIC_PAGES_OK', JSON.stringify(staticResult));
    } catch (error) {
      throw new Error(`Static product/category page generation failed: ${error?.message || error}`);
    }
  }


  const leakedTokens=[];
  for(const entry of fs.readdirSync(out,{withFileTypes:true})){
    if(!entry.isFile() || !/\.(html|js|css|webmanifest|xml|txt)$/.test(entry.name)) continue;
    { const built=fs.readFileSync(path.join(out,entry.name),'utf8'); if(built.includes(VERSION_TOKEN)||built.includes(JSONLD_CSP_TOKEN)) leakedTokens.push(entry.name); }
  }
  if(leakedTokens.length) throw new Error(`Unreplaced version token in dist: ${leakedTokens.join(', ')}`);

  fs.writeFileSync(path.join(root,'BUILD_SIZES.json'),JSON.stringify({releaseVersion,siteUrl,files:sizes},null,2)+'\n');
  console.log('BUILD_OK',`v${releaseVersion}`,siteUrl,JSON.stringify(sizes['app.js']));
}
