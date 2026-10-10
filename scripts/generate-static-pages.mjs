import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_PAGE_SIZE = 500;
const DEFAULT_MAX_ROWS = 50_000;
const BRAND_NAME = 'Flower Light | بصائر الخليج';

function htmlEscape(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}

function xmlEscape(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;'
  }[ch]));
}

function cleanDescription(value, max = 160) {
  const compact = String(value ?? '').replace(/\s+/g, ' ').trim();
  return Array.from(compact).slice(0, max).join('');
}

function safeJsonForHtml(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function normalizeBaseUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' && url.hostname !== '127.0.0.1' && url.hostname !== 'localhost') {
    throw new Error('baseUrl must use HTTPS (except localhost test URLs)');
  }
  url.search = '';
  url.hash = '';
  return url.href.replace(/\/?$/, '/');
}

function parseBrowserConfig(projectRoot) {
  const source = fs.readFileSync(path.join(projectRoot, 'config.js'), 'utf8');
  const pick = key => {
    const match = source.match(new RegExp(`${key}\\s*:\\s*['\"]([^'\"]+)['\"]`));
    return match ? match[1].trim() : '';
  };
  const url = pick('url');
  const anonKey = pick('anonKey');
  const storageBucket = pick('storageBucket') || 'product-images';
  if (!url || !anonKey) throw new Error('Unable to read Supabase url/anonKey from config.js');
  return { url, anonKey, storageBucket };
}

function publicStorageUrl(supabaseUrl, bucket, objectPath) {
  const value = String(objectPath || '').trim();
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  if (/^(data:|blob:)/i.test(value)) return '';
  const encodedPath = value.split('/').map(segment => encodeURIComponent(segment)).join('/');
  const encodedBucket = encodeURIComponent(String(bucket || 'product-images'));
  return new URL(`/storage/v1/object/public/${encodedBucket}/${encodedPath}`, supabaseUrl).href;
}

function productThumbnailPath(objectPath) {
  const value = String(objectPath || '');
  return /\.l\.webp(?:$|\?)/i.test(value)
    ? value.replace(/\.l\.webp(?=$|\?)/i, '.s.webp')
    : value;
}

async function fetchAllRows({ fetchImpl, supabaseUrl, anonKey, table, select = '*', filters = [], order = '', pageSize = DEFAULT_PAGE_SIZE, maxRows = DEFAULT_MAX_ROWS }) {
  const rows = [];
  for (let offset = 0; offset < maxRows; offset += pageSize) {
    const url = new URL(`/rest/v1/${table}`, supabaseUrl);
    url.searchParams.set('select', select);
    for (const [key, value] of filters) url.searchParams.append(key, value);
    if (order) url.searchParams.set('order', order);
    url.searchParams.set('limit', String(pageSize));
    url.searchParams.set('offset', String(offset));
    const response = await fetchImpl(url, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        Accept: 'application/json'
      }
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`${table} REST request failed: HTTP ${response.status}${detail ? ` — ${detail.slice(0, 240)}` : ''}`);
    }
    const batch = await response.json();
    if (!Array.isArray(batch)) throw new Error(`${table} REST response was not an array`);
    rows.push(...batch);
    if (batch.length < pageSize) return rows;
  }
  throw new Error(`${table} exceeded safe build limit (${maxRows} rows)`);
}

async function loadPublishedCatalog({ fetchImpl, config }) {
  const common = { fetchImpl, supabaseUrl: config.url, anonKey: config.anonKey };
  const [categories, products, productImages] = await Promise.all([
    fetchAllRows({ ...common, table: 'categories', filters: [['is_visible', 'eq.true']], order: 'sort_order.asc,created_at.asc,id.asc' }),
    fetchAllRows({ ...common, table: 'products', filters: [['is_visible', 'eq.true']], order: 'sort_order.asc,created_at.asc,id.asc' }),
    fetchAllRows({ ...common, table: 'product_images', select: 'id,product_id,image_path,sort_order,is_primary,created_at', order: 'sort_order.asc,created_at.asc,id.asc' })
  ]);

  const visibleCategoryIds = new Set(categories.map(row => String(row?.id || '')).filter(Boolean));
  const visibleProducts = products.filter(row => visibleCategoryIds.has(String(row?.category_id || '')));
  const imageMap = new Map();
  for (const row of productImages) {
    const productId = String(row?.product_id || '');
    if (!productId || !row?.image_path) continue;
    if (!imageMap.has(productId)) imageMap.set(productId, []);
    imageMap.get(productId).push(row);
  }
  return { categories, products: visibleProducts, productImages, imageMap };
}

function primaryProductImage(product, imageMap, config) {
  let gallery = (imageMap.get(String(product?.id || '')) || []).slice();
  if (product?.image_path && !gallery.some(row => row.image_path === product.image_path)) {
    gallery.unshift({ image_path: product.image_path, is_primary: true, sort_order: -1 });
  }
  let primaryIndex = gallery.findIndex(row => row.image_path === product?.image_path);
  if (primaryIndex < 0) primaryIndex = gallery.findIndex(row => row.is_primary === true);
  if (primaryIndex < 0 && gallery.length) primaryIndex = 0;
  const chosen = primaryIndex >= 0 ? gallery[primaryIndex]?.image_path : '';
  const raw = chosen || product?.image_path || product?.image_url || '';
  return publicStorageUrl(config.url, config.storageBucket, raw);
}

function validLastmod(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

function staticPageHtml({ title, description, canonical, image, bodyTitle, bodyImage, redirectUrl, jsonLd }) {
  const safeTitle = htmlEscape(title);
  const safeDescription = htmlEscape(description);
  const safeCanonical = htmlEscape(canonical);
  const safeImage = htmlEscape(image);
  const safeBodyTitle = htmlEscape(bodyTitle);
  const safeBodyImage = htmlEscape(bodyImage);
  const redirectLiteral = safeJsonForHtml(redirectUrl);
  const jsonLdText = jsonLd ? safeJsonForHtml(jsonLd) : '';
  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${safeTitle}</title>
<meta name="description" content="${safeDescription}">
<link rel="canonical" href="${safeCanonical}">
<meta property="og:type" content="website">
<meta property="og:locale" content="ar_SA">
<meta property="og:title" content="${safeTitle}">
<meta property="og:description" content="${safeDescription}">
<meta property="og:image" content="${safeImage}">
<meta property="og:url" content="${safeCanonical}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${safeTitle}">
<meta name="twitter:description" content="${safeDescription}">
<meta name="twitter:image" content="${safeImage}">
${jsonLdText ? `<script type="application/ld+json">${jsonLdText}</script>` : ''}
</head>
<body style="font-family:Arial,sans-serif;background:#fffaf3;color:#181818;margin:0;padding:32px;text-align:center">
<main style="max-width:760px;margin:auto">
<h1>${safeBodyTitle}</h1>
${safeBodyImage ? `<img src="${safeBodyImage}" alt="${safeBodyTitle}" style="max-width:100%;height:auto;border-radius:18px">` : ''}
<p>${safeDescription}</p>
<p><a href="${htmlEscape(redirectUrl)}">فتح في كتالوج Flower Light</a></p>
</main>
<script>location.replace(${redirectLiteral});</script>
<noscript><p><a href="${htmlEscape(redirectUrl)}">فتح الصفحة الرئيسية</a></p></noscript>
</body>
</html>
`;
}

function writeFileEnsuringDir(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

export async function generateStaticPages({ outDir, baseUrl, projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), fetchImpl = globalThis.fetch, config = null } = {}) {
  if (!outDir) throw new Error('generateStaticPages requires outDir');
  if (typeof fetchImpl !== 'function') throw new Error('generateStaticPages requires fetch support');
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const resolvedConfig = config || parseBrowserConfig(projectRoot);
  const { categories, products, imageMap } = await loadPublishedCatalog({ fetchImpl, config: resolvedConfig });
  const fallbackImage = new URL('share-image.jpg', normalizedBaseUrl).href;

  fs.rmSync(path.join(outDir, 'p'), { recursive: true, force: true });
  fs.rmSync(path.join(outDir, 'c'), { recursive: true, force: true });

  const sitemapEntries = [
    { loc: normalizedBaseUrl, changefreq: 'weekly', priority: '1.0' },
    { loc: new URL('privacy.html', normalizedBaseUrl).href, changefreq: 'yearly', priority: '0.3' }
  ];

  const productsByCategory = new Map();
  for (const product of products) {
    const categoryId = String(product?.category_id || '');
    if (!productsByCategory.has(categoryId)) productsByCategory.set(categoryId, []);
    productsByCategory.get(categoryId).push(product);
  }

  let productCount = 0;
  for (const product of products) {
    const id = String(product?.id || '').trim();
    if (!id) continue;
    const category = categories.find(row => String(row?.id || '') === String(product?.category_id || ''));
    if (!category) continue;
    const name = String(product?.name || product?.model || 'منتج Flower Light').trim() || 'منتج Flower Light';
    const description = cleanDescription(product?.caption || product?.description || `منتج ${name} من Flower Light`);
    const canonical = new URL(`p/${encodeURIComponent(id)}/`, normalizedBaseUrl).href;
    const image = primaryProductImage(product, imageMap, resolvedConfig) || fallbackImage;
    const redirectUrl = new URL(`?product=${encodeURIComponent(id)}`, normalizedBaseUrl).href;
    const title = `${name} | ${BRAND_NAME}`;
    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name,
      image: [image],
      description,
      sku: String(product?.model || '').trim() || undefined,
      brand: { '@type': 'Brand', name: 'Flower Light' }
    };
    if (!jsonLd.sku) delete jsonLd.sku;
    const html = staticPageHtml({ title, description, canonical, image, bodyTitle: name, bodyImage: image, redirectUrl, jsonLd });
    writeFileEnsuringDir(path.join(outDir, 'p', encodeURIComponent(id), 'index.html'), html);
    sitemapEntries.push({ loc: canonical, lastmod: validLastmod(product?.updated_at), changefreq: 'weekly', priority: '0.8' });
    productCount += 1;
  }

  let categoryCount = 0;
  for (const category of categories) {
    const token = String(category?.slug || category?.id || '').trim();
    if (!token) continue;
    const name = String(category?.name || 'قسم Flower Light').trim() || 'قسم Flower Light';
    const description = cleanDescription(category?.description || `منتجات قسم ${name}`);
    const canonical = new URL(`c/${encodeURIComponent(token)}/`, normalizedBaseUrl).href;
    const firstProduct = (productsByCategory.get(String(category?.id || '')) || [])[0];
    const image = (firstProduct ? primaryProductImage(firstProduct, imageMap, resolvedConfig) : '') || fallbackImage;
    const redirectUrl = new URL(`?category=${encodeURIComponent(token)}`, normalizedBaseUrl).href;
    const title = `${name} | ${BRAND_NAME}`;
    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name,
      description,
      url: canonical,
      primaryImageOfPage: image ? { '@type': 'ImageObject', contentUrl: image } : undefined
    };
    if (!jsonLd.primaryImageOfPage) delete jsonLd.primaryImageOfPage;
    const html = staticPageHtml({ title, description, canonical, image, bodyTitle: name, bodyImage: image, redirectUrl, jsonLd });
    writeFileEnsuringDir(path.join(outDir, 'c', encodeURIComponent(token), 'index.html'), html);
    sitemapEntries.push({ loc: canonical, lastmod: validLastmod(category?.updated_at), changefreq: 'weekly', priority: '0.7' });
    categoryCount += 1;
  }

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapEntries.map(entry => {
    const lastmod = entry.lastmod ? `\n    <lastmod>${xmlEscape(entry.lastmod)}</lastmod>` : '';
    return `  <url>\n    <loc>${xmlEscape(entry.loc)}</loc>${lastmod}\n    <changefreq>${entry.changefreq}</changefreq>\n    <priority>${entry.priority}</priority>\n  </url>`;
  }).join('\n')}\n</urlset>\n`;
  fs.writeFileSync(path.join(outDir, 'sitemap.xml'), sitemap);

  return { productCount, categoryCount, sitemapEntries: sitemapEntries.length };
}
