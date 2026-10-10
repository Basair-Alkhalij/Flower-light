import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { generateStaticPages } from '../scripts/generate-static-pages.mjs';

const categories = [
  { id: 'cat-1', slug: 'wall-lights', name: 'جداريات <script>alert(1)</script>', description: 'وصف القسم', is_visible: true, sort_order: 0, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-02-01T00:00:00Z' },
  { id: 'cat-hidden', slug: 'hidden-category', name: 'مخفي', description: '', is_visible: false, sort_order: 1, created_at: '2026-01-01T00:00:00Z' }
];
const products = [
  { id: 'prod-1', category_id: 'cat-1', name: 'منتج <script>alert(1)</script>', model: 'WL-100', caption: 'وصف المنتج <script>alert(2)</script>', image_path: 'products/prod-1/main.l.webp', is_visible: true, sort_order: 0, created_at: '2026-01-02T00:00:00Z', updated_at: '2026-02-02T00:00:00Z' },
  { id: 'prod-hidden', category_id: 'cat-1', name: 'منتج مخفي', model: 'HIDDEN', caption: '', image_path: 'products/hidden.jpg', is_visible: false, sort_order: 1, created_at: '2026-01-03T00:00:00Z' },
  { id: 'prod-hidden-category', category_id: 'cat-hidden', name: 'منتج بقسم مخفي', model: 'HC', caption: '', image_path: 'products/hc.jpg', is_visible: true, sort_order: 2, created_at: '2026-01-04T00:00:00Z' }
];
const images = [
  { id: 'img-1', product_id: 'prod-1', image_path: 'products/prod-1/main.l.webp', sort_order: 0, is_primary: true, created_at: '2026-01-02T00:00:00Z' }
];

function response(data, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() { return structuredClone(data); },
    async text() { return JSON.stringify(data); }
  };
}

const seen = [];
const mockFetch = async input => {
  const url = input instanceof URL ? input : new URL(String(input));
  seen.push(url);
  const table = url.pathname.split('/').pop();
  let rows = table === 'categories' ? categories : table === 'products' ? products : table === 'product_images' ? images : null;
  if (!rows) return response({ message: 'not found' }, 404);
  if (url.searchParams.get('is_visible') === 'eq.true') rows = rows.filter(row => row.is_visible === true);
  const offset = Number(url.searchParams.get('offset') || 0);
  const limit = Number(url.searchParams.get('limit') || 500);
  return response(rows.slice(offset, offset + limit));
};

const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flower-light-static-pages-'));
try {
  const result = await generateStaticPages({
    outDir,
    baseUrl: 'https://example.com/Flower-light/',
    fetchImpl: mockFetch,
    config: {
      url: 'https://demo.supabase.co',
      anonKey: 'sb_publishable_test',
      storageBucket: 'product-images'
    }
  });

  assert.equal(result.productCount, 1);
  assert.equal(result.categoryCount, 1);
  assert.ok(seen.some(url => url.pathname.endsWith('/products') && url.searchParams.get('is_visible') === 'eq.true'));
  assert.ok(seen.some(url => url.pathname.endsWith('/categories') && url.searchParams.get('is_visible') === 'eq.true'));

  const productFile = path.join(outDir, 'p', 'prod-1', 'index.html');
  const categoryFile = path.join(outDir, 'c', 'wall-lights', 'index.html');
  assert.ok(fs.existsSync(productFile));
  assert.ok(fs.existsSync(categoryFile));
  assert.equal(fs.existsSync(path.join(outDir, 'p', 'prod-hidden', 'index.html')), false);
  assert.equal(fs.existsSync(path.join(outDir, 'p', 'prod-hidden-category', 'index.html')), false);

  const categoryHtml = fs.readFileSync(categoryFile, 'utf8');
  assert.match(categoryHtml, /<link rel="canonical" href="https:\/\/example\.com\/Flower-light\/c\/wall-lights\/">/);
  assert.match(categoryHtml, /<meta property="og:image" content="https:\/\/demo\.supabase\.co\/storage\/v1\/object\/public\/product-images\/products\/prod-1\/main\.l\.webp">/);

  const productHtml = fs.readFileSync(productFile, 'utf8');
  assert.match(productHtml, /<link rel="canonical" href="https:\/\/example\.com\/Flower-light\/p\/prod-1\/">/);
  assert.match(productHtml, /<meta property="og:image" content="https:\/\/demo\.supabase\.co\/storage\/v1\/object\/public\/product-images\/products\/prod-1\/main\.l\.webp">/);
  assert.match(productHtml, /location\.replace\("https:\/\/example\.com\/Flower-light\/\?product=prod-1"\)/);
  assert.ok(productHtml.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(!productHtml.includes('<script>alert(1)</script>'));
  assert.ok(!productHtml.includes('<script>alert(2)</script>'));
  assert.match(productHtml, /"@type":"Product"/);
  assert.match(productHtml, /"sku":"WL-100"/);

  const sitemap = fs.readFileSync(path.join(outDir, 'sitemap.xml'), 'utf8');
  assert.ok(sitemap.includes('https://example.com/Flower-light/'));
  assert.ok(sitemap.includes('https://example.com/Flower-light/privacy.html'));
  assert.ok(sitemap.includes('https://example.com/Flower-light/p/prod-1/'));
  assert.ok(sitemap.includes('https://example.com/Flower-light/c/wall-lights/'));
  assert.ok(!sitemap.includes('prod-hidden'));
  assert.ok(!sitemap.includes('hidden-category'));

  await assert.rejects(
    generateStaticPages({
      outDir: path.join(outDir, 'failure-case'),
      baseUrl: 'https://example.com/Flower-light/',
      fetchImpl: async () => response({ message: 'offline' }, 503),
      config: { url: 'https://demo.supabase.co', anonKey: 'sb_publishable_test', storageBucket: 'product-images' }
    }),
    /REST request failed: HTTP 503/
  );

  console.log('STATIC_PAGES_OK');
} finally {
  fs.rmSync(outDir, { recursive: true, force: true });
}
