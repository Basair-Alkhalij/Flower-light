import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { stripTypeScriptTypes } from 'node:module';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
const versionParts=String(pkg.version||'').split('.');
if(versionParts.length!==3 || versionParts.some(part=>!/^\d+$/.test(part))) throw new Error('package.json version must be numeric semver (x.y.z)');
const releaseVersion=versionParts.join('');
const VERSION_TOKEN='__FL_VERSION__';
const JSONLD_CSP_TOKEN='__FL_JSONLD_CSP_HASH__';
const DEFAULT_SITE_URL='https://basair-alkhalij.github.io/Flower-light/';

const jsFiles=[
  'app.js','public-sync.js','pwa-install.js','catalog-search.js','config.js','site-bootstrap.js','site-loader.js',
  'admin.js','admin-analytics.js','admin-leads.js','admin-permissions.js','admin-settings.js','admin-business.js',
  'business-info.js','admin-media.js','admin-products.js','admin-product-form.js','admin-import.js','sw.js'
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
  `style.css?v=${VERSION_TOKEN}`,`config.js?v=${VERSION_TOKEN}`,`app.js?v=${VERSION_TOKEN}`,`site-loader.js?v=${VERSION_TOKEN}`,
  `admin-media.js?v=${VERSION_TOKEN}`,`admin-products.js?v=${VERSION_TOKEN}`,`admin-product-form.js?v=${VERSION_TOKEN}`,`admin-import.js?v=${VERSION_TOKEN}`
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
  'admin.js':170_000,
  'app.js':140_000,
  'style.css':128_000,
  'public-sync.js':65_000,
};
for(const [file,max] of Object.entries(budgets)){
  const data=fs.readFileSync(path.join(root,file));
  const raw=data.length;
  const gzip=zlib.gzipSync(data,{level:9}).length;
  console.log(`${file}: ${raw} bytes raw / ${gzip} bytes gzip`);
  if(raw>max){console.error(`${file} exceeds size budget ${max}`);process.exit(1);}
}
console.log(`BUILD_CHECK_OK v${releaseVersion}`);


function applyHtmlSecurityTokens(source,fileName){
  if(fileName!=='index.html') return source;
  const match=source.match(/<script\s+type=["']application\/ld\+json["']>([\s\S]*?)<\/script>/i);
  if(!match) throw new Error('Missing application/ld+json block in index.html');
  const hash='sha256-'+crypto.createHash('sha256').update(match[1],'utf8').digest('base64');
  return source.replaceAll(JSONLD_CSP_TOKEN,hash);
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

  for(const entry of fs.readdirSync(root,{withFileTypes:true})){
    const name=entry.name;
    if(!entry.isFile() || !(/\.(html|js|css|png|jpg|jpeg|ico|webmanifest|xml)$/.test(name) || ['robots.txt','.nojekyll'].includes(name))) continue;
    const data=fs.readFileSync(path.join(root,name));
    let output=data;
    if(/\.(js|css)$/.test(name)){
      const source=data.toString().replaceAll(VERSION_TOKEN,releaseVersion).replaceAll(DEFAULT_SITE_URL,siteUrl);
      const result=await transform(source,{loader:name.endsWith('.css')?'css':'js',minify:true,target:'es2020',charset:'utf8',legalComments:'inline'});
      output=Buffer.from(result.code);
      sizes[name]={source:data.length,minified:output.length,gzip:zlib.gzipSync(output,{level:9}).length};
    }else if(/\.(html|xml|webmanifest)$/.test(name)||name==='robots.txt'){
      { const replaced=data.toString().replaceAll(VERSION_TOKEN,releaseVersion).replaceAll(DEFAULT_SITE_URL,siteUrl); output=Buffer.from(applyHtmlSecurityTokens(replaced,name)); }
    }
    fs.writeFileSync(path.join(out,name),output);
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
