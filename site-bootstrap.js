// Flower Light page bootstrap — admin title/noindex handling.
(() => {
      const adminPanel = new URLSearchParams(location.search).get('admin');
      const adminTitles = {
        '1': 'لوحة المدير | بصائر الخليج',
        '2': 'لوحة الأدمن | بصائر الخليج'
      };
      const adminTitle = adminTitles[adminPanel];
      if (!adminTitle) return;
      document.title = adminTitle;
      document.getElementById('robotsMeta')?.setAttribute('content', 'noindex,nofollow');
    })();
