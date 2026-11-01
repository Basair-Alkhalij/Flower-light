// Flower Light: catalog and category PDF/JPG downloads.
// The PDF page renderer and the approved datasheet design remain in catalog-pdf-renderer.js.
(() => {
  'use strict';

  function create(deps) {
    const required=['catalogDownloadPdf','catalogPdfEntries','sectionPdfEntries','productDisplayName',
      'safePdfFilePart','createProductOverviewPdfPage','downloadCanvasAsJpg','askExportChoice',
      'loadJsPdfOnDemand','showPublicToast','trackEvent','queryCategoryButtons'];
    if(!deps || required.some(key => !(key in deps))) throw new Error('Catalog export missing dependency');
    const {catalogDownloadPdf,catalogDownloadPdfLabel,catalogPdfEntries,sectionPdfEntries,
      productDisplayName,safePdfFilePart,createProductOverviewPdfPage,downloadCanvasAsJpg,
      askExportChoice,loadJsPdfOnDemand,showPublicToast,trackEvent,queryCategoryButtons,
      PDF_EXPORT_SCALE,JPG_EXPORT_SCALE,PDF_IMAGE_QUALITY}=deps;
    let catalogPdfBusy=false;

  function catalogExportLabelNode(button) {
    return button === catalogDownloadPdf ? catalogDownloadPdfLabel : button?.querySelector('span');
  }

  function setCatalogExportBusy(busy) {
    [catalogDownloadPdf, ...queryCategoryButtons()].filter(Boolean).forEach(button => {
      if (busy) button.disabled = true;
      else if (button === catalogDownloadPdf) button.disabled = catalogPdfEntries().length === 0;
      else button.disabled = button.dataset.hasProducts !== 'true';
    });
  }

  async function downloadCatalogJpg(entriesArg = null, options = {}) {
    if (catalogPdfBusy) return;
    const entries = Array.isArray(entriesArg) ? entriesArg : catalogPdfEntries();
    if (!entries.length) {
      showPublicToast('لا توجد منتجات ظاهرة للتحميل.');
      return;
    }
    const button = options.button || catalogDownloadPdf;
    const labelNode = catalogExportLabelNode(button);
    const originalLabel = labelNode?.textContent || options.defaultLabel || 'تنزيل جميع المنتجات';
    const scopeName = String(options.scopeName || 'جميع المنتجات');
    const jpgPrefix = options.jpgPrefix ? `${safePdfFilePart(options.jpgPrefix)}-` : '';
    catalogPdfBusy = true;
    setCatalogExportBusy(true);
    let failedImages = 0;
    try {
      try {
        await document.fonts?.load('800 42px Tajawal');
        await document.fonts?.load('500 24px Tajawal');
      } catch (_) {}
      for (let index = 0; index < entries.length; index += 1) {
        if (labelNode) labelNode.textContent = `جاري تجهيز الصور ${index + 1}/${entries.length}`;
        const { item } = entries[index];
        // Export every product with the exact approved datasheet/product template.
        const { canvas, failedImages: pageFailedImages } = await createProductOverviewPdfPage(item, { scale: JPG_EXPORT_SCALE });
        if (pageFailedImages) failedImages += pageFailedImages;
        const base = safePdfFilePart(item?.model || productDisplayName(item) || `catalog-${index + 1}`);
        await downloadCanvasAsJpg(canvas, `${jpgPrefix}${String(index + 1).padStart(2, '0')}-${base}.jpg`);
        await new Promise(resolve => setTimeout(resolve, 160));
      }
      trackEvent('catalog_download', { label: `${scopeName} JPG`, category: options.category || '', products_count: entries.length, failed_images: failedImages });
      showPublicToast(failedImages ? `تم تحميل صور ${scopeName}، وتعذر إدراج ${failedImages} صورة.` : `تم تحميل ${entries.length} صورة من ${scopeName}.`, 4300);
    } catch (error) {
      console.warn('[Catalog JPG] generation failed', error);
      showPublicToast(`تعذر تجهيز صور ${scopeName}. أعد المحاولة بعد التأكد من اتصال الإنترنت.`, 4500);
    } finally {
      catalogPdfBusy = false;
      if (labelNode) labelNode.textContent = originalLabel;
      setCatalogExportBusy(false);
    }
  }

  async function downloadCatalogPdf(entriesArg = null, options = {}) {
    if (catalogPdfBusy) return;
    const entries = Array.isArray(entriesArg) ? entriesArg : catalogPdfEntries();
    if (!entries.length) {
      showPublicToast('لا توجد منتجات ظاهرة للتحميل.');
      return;
    }
    const button = options.button || catalogDownloadPdf;
    const labelNode = catalogExportLabelNode(button);
    const originalLabel = labelNode?.textContent || options.defaultLabel || 'تنزيل جميع المنتجات';
    const scopeName = String(options.scopeName || 'جميع المنتجات');
    const pdfFilename = String(options.pdfFilename || 'flower-light-products-datasheet.pdf');
    catalogPdfBusy = true;
    setCatalogExportBusy(true);
    let failedImages = 0;
    try {
      if (labelNode) labelNode.textContent = 'جاري تحميل أداة PDF…';
      const JsPdf = await loadJsPdfOnDemand();
      try {
        await document.fonts?.load('800 42px Tajawal');
        await document.fonts?.load('500 24px Tajawal');
      } catch (_) {}

      const pdf = new JsPdf({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
      for (let index = 0; index < entries.length; index += 1) {
        if (labelNode) labelNode.textContent = `جاري التجهيز ${index + 1}/${entries.length}`;
        const { item } = entries[index];
        // Export every product with the exact approved datasheet/product template.
        const { canvas, failedImages: pageFailedImages } = await createProductOverviewPdfPage(item, { scale: PDF_EXPORT_SCALE });
        if (pageFailedImages) failedImages += pageFailedImages;
        if (index > 0) pdf.addPage('a4', 'portrait');
        const pageImage = canvas.toDataURL('image/jpeg', PDF_IMAGE_QUALITY);
        pdf.addImage(pageImage, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
        await new Promise(resolve => window.requestAnimationFrame(resolve));
      }

      const blob = pdf.output('blob');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = pdfFilename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 5000);
      trackEvent('catalog_download', { label: `${scopeName} PDF`, category: options.category || '', products_count: entries.length, failed_images: failedImages });
      showPublicToast(failedImages ? `تم تجهيز ${scopeName}، وتعذر إدراج ${failedImages} صورة.` : `تم تحميل ${scopeName}: ${entries.length} منتج.` , 4200);
    } catch (error) {
      console.warn('[Catalog PDF] generation failed', error);
      showPublicToast(`تعذر تجهيز ملف PDF لـ ${scopeName}. أعد المحاولة بعد التأكد من اتصال الإنترنت.`, 4500);
    } finally {
      catalogPdfBusy = false;
      if (labelNode) labelNode.textContent = originalLabel;
      setCatalogExportBusy(false);
    }
  }

  async function handleCatalogDownloadChoice() {
    const choice = await askExportChoice({
      title: 'تنزيل جميع المنتجات',
      subtitle: 'يتم تنزيل جميع المنتجات بنفس قالب الداتا شيت المعتمد، كملف PDF واحد أو صور عالية الدقة.',
      pdfLabel: 'تنزيل جميع المنتجات PDF',
      jpgLabel: 'تنزيل جميع المنتجات صور'
    });
    const options = { button: catalogDownloadPdf, scopeName: 'جميع المنتجات' };
    if (choice === 'jpg') return downloadCatalogJpg(catalogPdfEntries(), options);
    if (choice === 'pdf') return downloadCatalogPdf(catalogPdfEntries(), options);
  }

  async function handleSectionDownloadChoice(section, button) {
    const name = String(section?.name || 'المنتجات').trim() || 'المنتجات';
    const entries = sectionPdfEntries(section);
    if (!entries.length) {
      showPublicToast(`لا توجد منتجات ظاهرة في قسم ${name} للتحميل.`);
      return;
    }
    const choice = await askExportChoice({
      title: `تحميل قسم ${name}`,
      subtitle: `اختر تحميل منتجات قسم ${name} كملف PDF واحد أو صور عالية الدقة.`,
      pdfLabel: `تحميل قسم ${name} PDF`,
      jpgLabel: `تحميل قسم ${name} صور`
    });
    const safeName = safePdfFilePart(name);
    const options = {
      button,
      scopeName: `قسم ${name}`,
      category: name,
      pdfFilename: `flower-light-${safeName}-datasheet.pdf`,
      jpgPrefix: safeName
    };
    if (choice === 'jpg') return downloadCatalogJpg(entries, options);
    if (choice === 'pdf') return downloadCatalogPdf(entries, options);
  }



    return Object.freeze({
      handleCatalogDownloadChoice, handleSectionDownloadChoice,
      downloadCatalogPdf, downloadCatalogJpg,
      isBusy: () => catalogPdfBusy
    });
  }

  window.FL_CATALOG_EXPORT=Object.freeze({create});
})();
