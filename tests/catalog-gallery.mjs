import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const window={};
vm.runInNewContext(fs.readFileSync(new URL('../catalog-gallery.js',import.meta.url),'utf8'),{window});
const normalize=window.FL_CATALOG_GALLERY?.normalizedProductGallery;
assert.equal(typeof normalize,'function');
assert.equal(normalize({}).length,0);
const items=normalize({image:'first.l.webp',image_path:'first',image_thumb:'first.s.webp',gallery:[
{image:'first-copy.webp',image_path:'first'},{image:'second.l.webp',image_path:'second',thumb:'second.s.webp'},
{image:'third.l.webp',image_path:'third'},{image:'fourth.l.webp',image_path:'fourth'},
{image:'fifth.l.webp',image_path:'fifth'}]});
assert.equal(items.length,4);
assert.deepEqual(Array.from(items,i=>i.image_path),['first','second','third','fourth']);
assert.equal(items[0].thumb,'first.s.webp');
assert.equal(items[1].thumb,'second.s.webp');
console.log('CATALOG_GALLERY_MODULE_OK');
