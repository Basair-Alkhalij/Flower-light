// Flower Light catalog gallery — pure normalization shared by product cards/lightbox.
(() => {
  'use strict';
  function normalizedProductGallery(item) {
    const rows = Array.isArray(item?.gallery) ? item.gallery : [];
    const result = [];
    const seen = new Set();
    const add = (image, imagePath = '', thumb = '') => {
      const src = String(image || '').trim();
      const path = String(imagePath || '').trim();
      const thumbSrc = String(thumb || '').trim() || src;
      const key = path || src;
      if (!src || !key || seen.has(key) || result.length >= 4) return;
      seen.add(key);
      result.push({ image: src, thumb: thumbSrc, image_path: path });
    };
    add(item?.image, item?.image_path, item?.image_thumb);
    rows.forEach(row => add(row?.image, row?.image_path, row?.thumb));
    return result;
  }
  window.FL_CATALOG_GALLERY=Object.freeze({normalizedProductGallery});
})();
