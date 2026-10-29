// Flower Light · PDF canvas renderer (standalone, source-preserving split from app.js).
// Only the catalog renderer consumes this module. It does not load jsPDF or write
// to Supabase and receives product formatting helpers explicitly from app.js.
(() => {
  'use strict';
  function create({productDisplayName,productPricingLines,productSpecifications,specificationDisplayValue,normalizedProductGallery}) {
    for(const [name, value] of Object.entries({productDisplayName,productPricingLines,productSpecifications,specificationDisplayValue,normalizedProductGallery})) {
      if (typeof value !== 'function') throw new Error('PDF renderer missing dependency: '+name);
    }

  function sectionPdfEntries(section) {
    const items = Array.isArray(section?.items) ? section.items : [];
    return items.filter(item => item?.image).map(item => ({ section, item }));
  }

  function catalogPdfEntries() {
    const data = window.FLOWER_LIGHT_PRODUCTS || {extraSections:[]};
    const sections = Array.isArray(data.extraSections) ? data.extraSections : [];
    return sections.flatMap(section => sectionPdfEntries(section));
  }

  function canvasWrappedLines(ctx, text, maxWidth, maxLines = 2) {
    const words = String(text || '').trim().split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    const lines = [];
    let line = '';
    words.forEach(word => {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width <= maxWidth || !line) line = test;
      else { lines.push(line); line = word; }
    });
    if (line) lines.push(line);
    const visible = lines.slice(0, maxLines);
    if (lines.length > maxLines && visible.length) {
      let last = visible[visible.length - 1];
      while (last && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
      visible[visible.length - 1] = `${last}…`;
    }
    return visible;
  }

  function wrapCanvasText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 2) {
    const visible = canvasWrappedLines(ctx, text, maxWidth, maxLines);
    if (!visible.length) return y;
    visible.forEach((part, index) => ctx.fillText(part, x, y + index * lineHeight, maxWidth));
    return y + visible.length * lineHeight;
  }

  async function loadCatalogPdfImage(src) {
    // Uploaded datasheet images are FileReader data: URLs. The page's CSP allows
    // them in img-src but intentionally excludes data: from connect-src, so
    // fetch(dataUrl) fails even though the same image can be displayed safely.
    // Decode these directly as <img>; keep the fetch/blob path for remote images.
    if (/^data:image\//i.test(String(src || ''))) {
      const image = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => img.naturalWidth && img.naturalHeight
          ? resolve(img)
          : reject(new Error('Image has no dimensions'));
        img.onerror = () => reject(new Error('Uploaded image decode failed'));
        img.src = src;
      });
      return { image, objectUrl: '' };
    }
    const response = await fetch(src, { mode: 'cors', cache: 'force-cache' });
    if (!response.ok) throw new Error(`Image HTTP ${response.status}`);
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    try {
      const image = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Image decode failed'));
        img.src = objectUrl;
      });
      return { image, objectUrl };
    } catch (error) {
      URL.revokeObjectURL(objectUrl);
      throw error;
    }
  }

  const BASE_EXPORT_PAGE_WIDTH = 1000;
  const BASE_EXPORT_PAGE_HEIGHT = 1414;
  const PDF_EXPORT_SCALE = 2;
  const JPG_EXPORT_SCALE = 3;
  const PDF_IMAGE_QUALITY = 0.94;
  const JPG_IMAGE_QUALITY = 0.94;

  function createScaledExportCanvas(scale = 1) {
    const safeScale = Math.max(1, Number(scale) || 1);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(BASE_EXPORT_PAGE_WIDTH * safeScale);
    canvas.height = Math.round(BASE_EXPORT_PAGE_HEIGHT * safeScale);
    const ctx = canvas.getContext('2d', { alpha: false });
    ctx.setTransform(safeScale, 0, 0, safeScale, 0, 0);
    return { canvas, ctx, scale: safeScale };
  }

  function exportCanvasToBlob(canvas, type = 'image/jpeg', quality = 0.92) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(blob => {
        if (blob) resolve(blob);
        else reject(new Error('تعذر تحويل التصميم إلى ملف.'));
      }, type, quality);
    });
  }

  function triggerBlobDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  async function createCatalogPdfPage(section, item, pageNumber, totalPages, { scale = 1 } = {}) {
    const { canvas, ctx } = createScaledExportCanvas(scale);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, BASE_EXPORT_PAGE_WIDTH, BASE_EXPORT_PAGE_HEIGHT);

    // Header
    ctx.fillStyle = '#ff9f0a';
    ctx.fillRect(0, 0, BASE_EXPORT_PAGE_WIDTH, 16);
    ctx.direction = 'rtl';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#8a5400';
    ctx.font = '700 30px Tajawal, Arial, sans-serif';
    ctx.fillText(String(section?.name || 'القسم'), 930, 72, 870);
    ctx.fillStyle = '#171717';
    ctx.font = '800 42px Tajawal, Arial, sans-serif';
    wrapCanvasText(ctx, productDisplayName(item), 930, 124, 870, 48, 2);

    // Product image area
    const box = { x: 65, y: 205, w: 870, h: 780 };
    ctx.fillStyle = '#f7f6f3';
    ctx.fillRect(box.x, box.y, box.w, box.h);
    let imageFailed = false;
    try {
      const loaded = await loadCatalogPdfImage(item.image);
      try {
        const img = loaded.image;
        const scale = Math.min(box.w / img.naturalWidth, box.h / img.naturalHeight);
        const width = Math.max(1, img.naturalWidth * scale);
        const height = Math.max(1, img.naturalHeight * scale);
        const x = box.x + (box.w - width) / 2;
        const y = box.y + (box.h - height) / 2;
        ctx.drawImage(img, x, y, width, height);
      } finally {
        URL.revokeObjectURL(loaded.objectUrl);
      }
    } catch (error) {
      imageFailed = true;
      ctx.fillStyle = '#8a8178';
      ctx.font = '600 28px Tajawal, Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('تعذر تحميل صورة هذا المنتج', BASE_EXPORT_PAGE_WIDTH / 2, box.y + box.h / 2);
      ctx.textAlign = 'right';
    }

    // Product details
    let detailY = 1045;
    ctx.direction = 'rtl';
    ctx.textAlign = 'right';
    if (item?.model) {
      ctx.fillStyle = '#5d554c';
      ctx.font = '600 26px Tajawal, Arial, sans-serif';
      ctx.fillText(`رقم المنتج / الكود: ${String(item.model)}`, 930, detailY, 870);
      detailY += 42;
    }
    if (item?.caption) {
      ctx.fillStyle = '#5d554c';
      ctx.font = '500 24px Tajawal, Arial, sans-serif';
      detailY = wrapCanvasText(ctx, item.caption, 930, detailY, 870, 34, 2);
    }
    const pricingLines = productPricingLines(item);
    if (pricingLines.length) {
      detailY += 12;
      ctx.fillStyle = item?.limited_offer===true ? '#c23a24' : '#9f5a00';
      ctx.font = '800 26px Tajawal, Arial, sans-serif';
      pricingLines.forEach(price => {
        if (detailY > 1290) return;
        const note = price.note ? ` — ${price.note}` : '';
        ctx.fillText(`${price.label}: ${price.value}${note}${item?.limited_offer===true?' · عرض لفترة محدودة':''}`, 930, detailY, 870);
        detailY += 36;
      });
    }

    const specs = productSpecifications(item).slice(0, 7);
    if (specs.length) {
      detailY += 12;
      ctx.fillStyle = '#8a5400';
      ctx.font = '700 22px Tajawal, Arial, sans-serif';
      ctx.fillText('المواصفات', 930, detailY, 870);
      detailY += 32;
      ctx.fillStyle = '#4f4942';
      ctx.font = '500 20px Tajawal, Arial, sans-serif';
      specs.forEach(spec => {
        if (detailY > 1300) return;
        ctx.fillText(`${spec.label}: ${specificationDisplayValue(spec)}`, 930, detailY, 870);
        detailY += 27;
      });
    }

    // Footer / page number
    ctx.strokeStyle = '#eee8df';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(65, 1338);
    ctx.lineTo(935, 1338);
    ctx.stroke();
    ctx.fillStyle = '#9a9188';
    ctx.font = '500 20px Tajawal, Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.direction = 'ltr';
    ctx.fillText(`${pageNumber} / ${totalPages}`, 65, 1378);
    ctx.textAlign = 'right';
    ctx.direction = 'rtl';
    const profile = window.FLOWER_LIGHT_PROFILE || {};
    const brand = String(profile.brand_name || profile.company_name || 'Flower Light').trim();
    ctx.fillText(brand, 935, 1378, 600);

    return { canvas, imageFailed };
  }



  async function drawPdfContainedImage(ctx, src, box, { label = '' } = {}) {
    drawPdfImageBoxFrame(ctx, box);
    try {
      const loaded = await loadCatalogPdfImage(src);
      try {
        const img = loaded.image;
        const scale = Math.min(box.w / img.naturalWidth, box.h / img.naturalHeight);
        const width = Math.max(1, img.naturalWidth * scale);
        const height = Math.max(1, img.naturalHeight * scale);
        ctx.drawImage(img, box.x + (box.w - width) / 2, box.y + (box.h - height) / 2, width, height);
      } finally {
        URL.revokeObjectURL(loaded.objectUrl);
      }
      if (label) drawPdfImageCounterChip(ctx, label, box.x + 16, box.y + 16);
      return false;
    } catch (_) {
      drawPdfImagePlaceholder(ctx, box, label || 'الصورة');
      return true;
    }
  }

  function roundRectPath(ctx, x, y, w, h, r = 18) {
    const radius = Math.max(0, Math.min(r, Math.min(w, h) / 2));
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  function fillRoundedRect(ctx, x, y, w, h, r, fill) {
    ctx.save();
    roundRectPath(ctx, x, y, w, h, r);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.restore();
  }

  function strokeRoundedRect(ctx, x, y, w, h, r, stroke, lineWidth = 2) {
    ctx.save();
    roundRectPath(ctx, x, y, w, h, r);
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
    ctx.restore();
  }

  function normalizeDigitString(value) {
    return String(value || '').replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
  }

  function productWarrantyYears(item) {
    const directCandidates = [item?.warranty_years, item?.warrantyYears, item?.warranty];
    for (const value of directCandidates) {
      const digits = normalizeDigitString(value).match(/\d+/);
      if (digits) return Math.min(99, Math.max(1, Number(digits[0])));
    }
    const spec = productSpecifications(item).find(spec => String(spec.key || '').toLowerCase() === 'warranty' || String(spec.label || '').includes('ضمان'));
    const text = normalizeDigitString(specificationDisplayValue(spec || ''));
    const digits = text.match(/\d+/);
    if (digits) return Math.min(99, Math.max(1, Number(digits[0])));
    if (/سنتين|سنتان/.test(text)) return 2;
    if (/ثلاث/.test(text)) return 3;
    if (/خمس/.test(text)) return 5;
    if (/سنة/.test(text)) return 1;
    return null;
  }

  function catalogContactPhone() {
    const list = Array.isArray(window.FLOWER_LIGHT_CONTACTS) ? window.FLOWER_LIGHT_CONTACTS : [];
    const first = list.find(item => (item?.type === 'phone' || item?.type === 'whatsapp') && item?.is_visible !== false)?.value || '';
    return String(first || '').trim();
  }

  function catalogDesignFooterNumber() {
    return String(window.FLOWER_LIGHT_SITE_SETTINGS?.design_footer_number || '').trim().slice(0, 40);
  }

  function catalogDesignFooterLabel() {
    return String(window.FLOWER_LIGHT_SITE_SETTINGS?.design_footer_label || '').trim().slice(0, 40);
  }

  async function loadCompanyLogoImage() {
    if (window.__flCompanyLogoPromise) return window.__flCompanyLogoPromise;
    window.__flCompanyLogoPromise = loadCatalogPdfImage('company-logo.png?v=__FL_VERSION__').catch(() => null);
    return window.__flCompanyLogoPromise;
  }

  function masterBarcodeUrl() {
    return String(window.FLOWER_LIGHT_SITE_SETTINGS?.master_barcode_url || '').trim();
  }

  async function drawMasterBarcode(ctx, box) {
    const src = masterBarcodeUrl();
    if (!src || !box || box.w < 20 || box.h < 20) return false;
    try {
      const loaded = await loadCatalogPdfImage(src);
      try {
        const img = loaded.image;
        const padding = 4;
        const innerW = Math.max(1, box.w - padding * 2);
        const innerH = Math.max(1, box.h - padding * 2);
        const scale = Math.min(innerW / img.naturalWidth, innerH / img.naturalHeight);
        const width = Math.max(1, img.naturalWidth * scale);
        const height = Math.max(1, img.naturalHeight * scale);
        ctx.save();
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(box.x, box.y, box.w, box.h);
        ctx.drawImage(img, box.x + (box.w - width) / 2, box.y + (box.h - height) / 2, width, height);
        ctx.restore();
      } finally {
        URL.revokeObjectURL(loaded.objectUrl);
      }
      return true;
    } catch (error) {
      console.warn('[Master barcode] image load failed', error);
      return false;
    }
  }

  function drawPdfImageBoxFrame(ctx, box) {
    fillRoundedRect(ctx, box.x, box.y, box.w, box.h, box.r || 24, '#f6f6f4');
    strokeRoundedRect(ctx, box.x, box.y, box.w, box.h, box.r || 24, '#d9d3ca', 1.5);
  }

  function drawPdfImageCounterChip(ctx, text, x, y) {
    ctx.save();
    fillRoundedRect(ctx, x, y, 74, 34, 16, 'rgba(30,30,30,.84)');
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 17px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.direction = 'ltr';
    ctx.fillText(String(text), x + 37, y + 18);
    ctx.restore();
  }

  function drawPdfImagePlaceholder(ctx, box, label = 'الصورة') {
    drawPdfImageBoxFrame(ctx, box);
    ctx.save();
    ctx.strokeStyle = '#bbb8b1';
    ctx.lineWidth = 4;
    roundRectPath(ctx, box.x + box.w / 2 - 32, box.y + box.h / 2 - 48, 64, 52, 10);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(box.x + box.w / 2 - 12, box.y + box.h / 2 - 24, 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(box.x + box.w / 2 - 24, box.y + box.h / 2 + 2);
    ctx.lineTo(box.x + box.w / 2 - 4, box.y + box.h / 2 - 16);
    ctx.lineTo(box.x + box.w / 2 + 24, box.y + box.h / 2 + 12);
    ctx.stroke();
    ctx.fillStyle = '#8d8b86';
    ctx.font = '700 20px Tajawal, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.direction = 'rtl';
    ctx.fillText(label, box.x + box.w / 2, box.y + box.h / 2 + 56);
    ctx.restore();
  }

  function productPdfImageBoxes(count, area) {
    const gap = 18;
    if (count <= 1) return [{ x: area.x, y: area.y, w: area.w, h: area.h, r: 26 }];
    if (count === 2) {
      const w = (area.w - gap) / 2;
      return [
        { x: area.x, y: area.y, w, h: area.h, r: 24 },
        { x: area.x + w + gap, y: area.y, w, h: area.h, r: 24 }
      ];
    }
    if (count === 3) {
      const rightW = Math.round(area.w * 0.36);
      const leftW = area.w - rightW - gap;
      const halfH = (area.h - gap) / 2;
      return [
        { x: area.x, y: area.y, w: leftW, h: area.h, r: 24 },
        { x: area.x + leftW + gap, y: area.y, w: rightW, h: halfH, r: 20 },
        { x: area.x + leftW + gap, y: area.y + halfH + gap, w: rightW, h: halfH, r: 20 }
      ];
    }
    const w = (area.w - gap) / 2;
    const h = (area.h - gap) / 2;
    return [
      { x: area.x, y: area.y, w, h, r: 22 },
      { x: area.x + w + gap, y: area.y, w, h, r: 22 },
      { x: area.x, y: area.y + h + gap, w, h, r: 22 },
      { x: area.x + w + gap, y: area.y + h + gap, w, h, r: 22 }
    ];
  }

  function drawCatalogTemplateBackground(ctx) {
    const pageW = BASE_EXPORT_PAGE_WIDTH;
    const pageH = BASE_EXPORT_PAGE_HEIGHT;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, pageW, pageH);

    ctx.save();
    ctx.fillStyle = '#f3f3f1';
    ctx.beginPath();
    ctx.moveTo(pageW * 0.54, 0);
    ctx.bezierCurveTo(pageW * 0.82, 0, pageW, 20, pageW, 150);
    ctx.lineTo(pageW, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.fillStyle = '#ff9f0a';
    ctx.beginPath();
    ctx.moveTo(0, 158);
    ctx.bezierCurveTo(220, 154, 310, 190, 455, 184);
    ctx.bezierCurveTo(610, 180, 735, 148, 1000, 168);
    ctx.lineTo(1000, 194);
    ctx.lineTo(0, 194);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.fillStyle = '#ff9f0a';
    ctx.beginPath();
    ctx.moveTo(0, pageH - 58);
    ctx.bezierCurveTo(145, pageH - 70, 205, pageH - 6, 356, pageH - 18);
    ctx.bezierCurveTo(575, pageH - 34, 670, pageH - 110, 1000, pageH - 30);
    ctx.lineTo(1000, pageH);
    ctx.lineTo(0, pageH);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.fillStyle = '#f2f2f2';
    ctx.beginPath();
    ctx.moveTo(665, pageH);
    ctx.quadraticCurveTo(820, pageH - 112, 1000, pageH - 18);
    ctx.lineTo(1000, pageH);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  async function drawCatalogPageHeader(ctx, item) {
    const logoAsset = await loadCompanyLogoImage();
    if (logoAsset?.image) {
      try {
        // Enlarged approved logo to match the sample proportion.
        // Its lower edge now reaches approximately the subtitle line.
        ctx.drawImage(logoAsset.image, 38, 18, 126, 126);
      } finally {
        try { URL.revokeObjectURL(logoAsset.objectUrl); } catch (_) {}
        window.__flCompanyLogoPromise = Promise.resolve({ image: logoAsset.image, objectUrl: '' });
      }
    }

    const englishBrandFirst = 'Flower';
    const englishBrandRest = 'Light';

    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
    ctx.direction = 'ltr';
    const brandX = 188;
    const brandY = 72;
    ctx.fillStyle = '#ff9f0a';
    ctx.font = '600 54px Arial, sans-serif';
    const firstBrandWidth = Math.min(360, ctx.measureText(englishBrandFirst).width);
    ctx.fillText(englishBrandFirst, brandX, brandY, 360);
    ctx.fillStyle = '#2b2b2b';
    ctx.fillText(englishBrandRest, brandX + firstBrandWidth + 16, brandY, Math.max(130, 520 - firstBrandWidth));

    ctx.fillStyle = '#666666';
    ctx.font = '400 17px Arial, sans-serif';
    ctx.direction = 'ltr';
    ctx.textAlign = 'left';
    ctx.fillText('Better Lighting for a Brighter Life', brandX, 126, 470);
    ctx.fillStyle = '#ff9f0a';
    ctx.fillRect(brandX, 136, 34, 3);

    const warranty = productWarrantyYears(item);
    if (warranty) {
      const cardX = 730;
      const cardY = 18;
      const cardW = 232;
      const cardH = 126;

      ctx.save();
      ctx.shadowColor = 'rgba(87, 59, 18, 0.16)';
      ctx.shadowBlur = 15;
      ctx.shadowOffsetY = 5;
      fillRoundedRect(ctx, cardX, cardY, cardW, cardH, 24, '#ffffff');
      ctx.restore();
      strokeRoundedRect(ctx, cardX, cardY, cardW, cardH, 24, '#f2d29d', 2);

      const numberX = cardX + 14;
      const numberY = cardY + 14;
      const numberW = 70;
      const numberH = cardH - 28;
      const numberGradient = ctx.createLinearGradient(numberX, numberY, numberX, numberY + numberH);
      numberGradient.addColorStop(0, '#ffad22');
      numberGradient.addColorStop(1, '#ef8b00');
      fillRoundedRect(ctx, numberX, numberY, numberW, numberH, 18, numberGradient);

      ctx.fillStyle = '#ffffff';
      ctx.font = '600 47px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.direction = 'ltr';
      ctx.fillText(String(warranty), numberX + numberW / 2, numberY + 39);
      ctx.font = '600 12px Arial, sans-serif';
      ctx.fillText('YEARS', numberX + numberW / 2, numberY + 76, numberW - 12);

      const textX = cardX + 100;
      ctx.direction = 'ltr';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#9b8b72';
      ctx.font = '500 12px Arial, sans-serif';
      ctx.fillText('PRODUCT', textX, cardY + 34, 112);
      ctx.fillStyle = '#28231d';
      ctx.font = '600 19px Arial, sans-serif';
      ctx.fillText('WARRANTY', textX, cardY + 59, 116);
      ctx.fillStyle = '#ff9f0a';
      ctx.fillRect(textX, cardY + 71, 36, 3);

      ctx.direction = 'rtl';
      ctx.textAlign = 'right';
      ctx.fillStyle = '#5b5144';
      ctx.font = '600 16px Tajawal, Arial, sans-serif';
      const ar = warranty === 1 ? 'ضمان لمدة سنة' : warranty === 2 ? 'ضمان لمدة سنتين' : `ضمان لمدة ${warranty} سنوات`;
      ctx.fillText(ar, cardX + cardW - 16, cardY + 105, 116);
    }
  }

  function drawCatalogFooter(ctx) {
    const phone = catalogContactPhone();
    const designFooterNumber = catalogDesignFooterNumber();
    const designFooterLabel = catalogDesignFooterLabel();
    const footerTop = 1320;

    ctx.fillStyle = '#ff9f0a';
    ctx.fillRect(0, footerTop, 1000, 1414 - footerTop);
    ctx.fillStyle = '#df8200';
    ctx.fillRect(0, footerTop, 1000, 4);

    if (phone) {
      fillRoundedRect(ctx, 40, 1341, 46, 46, 23, '#ffffff');
      ctx.fillStyle = '#f29500';
      ctx.font = '700 24px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('☎', 63, 1365);

      ctx.direction = 'rtl';
      ctx.textAlign = 'right';
      ctx.fillStyle = '#ffffff';
      ctx.font = '600 15px Tajawal, Arial, sans-serif';
      ctx.fillText('للاستفسار والطلبات', 280, 1352, 182);
      ctx.direction = 'ltr';
      ctx.textAlign = 'left';
      ctx.font = '600 19px Arial, sans-serif';
      ctx.fillText(phone, 100, 1382, 180);

      ctx.strokeStyle = '#ffc766';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(300, 1335);
      ctx.lineTo(300, 1398);
      ctx.stroke();
    }

    if (designFooterNumber) {
      fillRoundedRect(ctx, 320, 1341, 46, 46, 23, '#ffffff');
      ctx.fillStyle = '#f29500';
      ctx.font = '700 23px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('☎', 343, 1365);

      ctx.direction = 'rtl';
      ctx.textAlign = 'right';
      ctx.fillStyle = '#ffffff';
      ctx.font = '600 15px Tajawal, Arial, sans-serif';
      ctx.fillText(designFooterLabel || 'رقم التواصل', 695, 1352, 313);
      ctx.direction = 'ltr';
      ctx.textAlign = 'left';
      ctx.font = '600 18px Arial, sans-serif';
      ctx.fillText(designFooterNumber, 382, 1382, 310);
    }

    ctx.strokeStyle = '#ffc766';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(712, 1335);
    ctx.lineTo(712, 1398);
    ctx.stroke();

    ctx.direction = 'rtl';
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffffff';
    ctx.font = '600 14px Tajawal, Arial, sans-serif';
    ctx.fillText('إضاءة ... لمستقبل أكثر إشراقاً', 962, 1353, 232);
    ctx.direction = 'ltr';
    ctx.textAlign = 'right';
    ctx.fillStyle = '#fff4dd';
    ctx.font = '400 12px Arial, sans-serif';
    ctx.fillText('Lighting ... for a Brighter Tomorrow', 961, 1382, 230);
  }

  function buildPdfSpecRows(item) {
    const rows = [];
    if (item?.model) rows.push({ label: 'رقم المنتج / الكود', value: String(item.model) });
    const specs = productSpecifications(item);
    specs.forEach(spec => rows.push({ label: spec.label, value: specificationDisplayValue(spec) }));
    const pricing = productPricingLines(item);
    pricing.forEach(price => rows.push({ label: price.label, value: `${price.value}${price.note ? ` (${price.note})` : ''}` }));
    return rows.filter(row => row.label && row.value).slice(0, 16);
  }

  function pdfSpecGridMetrics(rows) {
    const columns = Math.min(4, Math.max(1, rows.length));
    const headerH = 46;
    const cellH = 68;
    const rowCount = Math.ceil(rows.length / columns);
    return { columns, headerH, cellH, rowCount, totalHeight: headerH + rowCount * cellH };
  }

  function drawPdfSpecsTable(ctx, rows, topY) {
    const x = 38;
    const width = 924;
    const metrics = pdfSpecGridMetrics(rows);
    const { columns, headerH, cellH, rowCount } = metrics;
    const bodyH = rowCount * cellH;

    fillRoundedRect(ctx, x, topY, width, headerH, 14, '#ff9f0a');
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 28px Tajawal, Arial, sans-serif';
    ctx.direction = 'rtl';
    ctx.textAlign = 'right';
    ctx.fillText('المواصفات الفنية', x + width - 20, topY + 31, 290);
    ctx.direction = 'ltr';
    ctx.textAlign = 'left';
    ctx.font = '600 21px Arial, sans-serif';
    ctx.fillText('Technical Specifications', x + 18, topY + 30, 270);

    const startY = topY + headerH;
    if (!rows.length) return metrics.totalHeight;
    const cellW = width / columns;
    rows.forEach((row, index) => {
      const gridRow = Math.floor(index / columns);
      const gridColumn = index % columns;
      const cellX = x + width - (gridColumn + 1) * cellW;
      const y = startY + gridRow * cellH;
      ctx.fillStyle = (gridRow + gridColumn) % 2 === 0 ? '#fafafa' : '#f3f3f1';
      ctx.fillRect(cellX, y, cellW, cellH);
      ctx.strokeStyle = '#d8d6d0';
      ctx.lineWidth = 1;
      ctx.strokeRect(cellX, y, cellW, cellH);

      ctx.direction = 'rtl';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#73706a';
      ctx.font = '600 15px Tajawal, Arial, sans-serif';
      ctx.fillText(String(row.label), cellX + cellW - 12, y + 22, cellW - 24);

      ctx.fillStyle = '#171717';
      ctx.font = '700 18px Tajawal, Arial, sans-serif';
      ctx.fillText(String(row.value), cellX + cellW - 12, y + 51, cellW - 24);
    });
    strokeRoundedRect(ctx, x, startY, width, bodyH, 0, '#d5d3cc', 1.5);
    return metrics.totalHeight;
  }

  async function createBrandedProductPdfPage(item, { images = [], singleMode = false, currentIndex = 0, totalImages = 1, scale = 1 } = {}) {
    const { canvas, ctx } = createScaledExportCanvas(scale);

    drawCatalogTemplateBackground(ctx);
    await drawCatalogPageHeader(ctx, item);

    const rows = buildPdfSpecRows(item);
    const tableHeight = pdfSpecGridMetrics(rows).totalHeight;
    const footerY = 1320;
    const tableY = footerY - tableHeight - 20;
    const productName = productDisplayName(item);
    ctx.font = '700 36px Tajawal, Arial, sans-serif';
    const nameLines = canvasWrappedLines(ctx, productName, 918, 2);
    ctx.font = '600 19px Tajawal, Arial, sans-serif';
    const captionLines = item?.caption ? canvasWrappedLines(ctx, item.caption, 918, 2) : [];
    const detailsBlockHeight = 44 + Math.max(1, nameLines.length) * 40 + (item?.model ? 32 : 0) + (captionLines.length ? 8 + captionLines.length * 27 : 0) + 10;
    const detailsTop = tableY - detailsBlockHeight - 14;
    const imageTop = 206;
    const imageBottom = detailsTop - 14;
    const imageArea = { x: 40, y: imageTop, w: 920, h: Math.max(320, imageBottom - imageTop) };

    const gallery = images.length ? images.slice(0, 4) : [{ image: item?.image || '', image_path: item?.image_path || '' }];
    const layoutBoxes = productPdfImageBoxes(Math.min(4, Math.max(1, gallery.length)), imageArea);
    let failedImages = 0;
    for (let i = 0; i < layoutBoxes.length; i += 1) {
      const row = gallery[i] || {};
      const label = singleMode ? `${currentIndex + 1}/${Math.max(1, totalImages)}` : `${i + 1}/${layoutBoxes.length}`;
      if (!row?.image) {
        drawPdfImagePlaceholder(ctx, layoutBoxes[i], singleMode ? 'الصورة الحالية' : `صورة ${i + 1}`);
        failedImages += 1;
      } else if (await drawPdfContainedImage(ctx, row.image, layoutBoxes[i], { label })) {
        failedImages += 1;
      }
    }

    const barcodeBoxHeight = Math.max(0, Math.min(112, tableY - detailsTop - 18));
    const barcodeDrawn = barcodeBoxHeight >= 54 ? await drawMasterBarcode(ctx, {
      x: 52,
      y: tableY - barcodeBoxHeight - 8,
      w: 192,
      h: barcodeBoxHeight
    }) : false;
    const detailsTextWidth = barcodeDrawn ? 682 : 918;

    ctx.direction = 'rtl';
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ff9f0a';
    ctx.font = '700 36px Tajawal, Arial, sans-serif';
    let detailsY = wrapCanvasText(ctx, productName, 956, detailsTop + 36, detailsTextWidth, 40, 2);

    ctx.fillStyle = '#202020';
    ctx.font = '700 21px Tajawal, Arial, sans-serif';
    const codeText = item?.model ? `رقم المنتج / الكود: ${String(item.model)}` : '';
    if (codeText) {
      ctx.fillText(codeText, 956, detailsY, detailsTextWidth);
      detailsY += 32;
    }

    if (item?.caption) {
      ctx.fillStyle = '#6a6a6a';
      ctx.font = '600 19px Tajawal, Arial, sans-serif';
      wrapCanvasText(ctx, item.caption, 956, detailsY + 4, detailsTextWidth, 27, 2);
    }

    drawPdfSpecsTable(ctx, rows, tableY);
    drawCatalogFooter(ctx);

    return { canvas, failedImages, imageCount: layoutBoxes.length };
  }

  async function createProductOverviewPdfPage(item, { scale = 1 } = {}) {
    const gallery = normalizedProductGallery(item).slice(0, 4);
    return createBrandedProductPdfPage(item, { images: gallery, singleMode: false, scale });
  }



    return Object.freeze({sectionPdfEntries,catalogPdfEntries,createBrandedProductPdfPage,createProductOverviewPdfPage,PDF_EXPORT_SCALE,JPG_EXPORT_SCALE,PDF_IMAGE_QUALITY,JPG_IMAGE_QUALITY,exportCanvasToBlob,triggerBlobDownload});
  }
  window.FL_CATALOG_PDF_RENDERER = Object.freeze({create});
})();
