/* Flower Light — visitor-facing Arabic/English translations, no database changes. */
(() => {
  'use strict';
  if (new URLSearchParams(location.search).has('admin')) return;
  const KEY='flowerlight:public-language';
  const dictionary={
  "تلقائي": "Auto",
  "فاتح": "Light",
  "داكن": "Dark",
  "مظهر الموقع": "Appearance",
  "شركة بصائر الخليج": "Basair Gulf",
  "بصائر الخليج": "Basair Gulf",
  "فلور لايت": "Flower Light",
  "مدير مبيعات": "Sales Manager",
  "Sales Manager": "Sales Manager",
  "اتصال أو واتساب": "Call or WhatsApp",
  "اختر الفرع": "Choose a branch",
  "فرع الفيصلية": "Al Faisaliyah branch",
  "الاسم التجاري": "Legal business name",
  "الرقم الضريبي": "Tax number",
  "السجل التجاري": "Commercial registration",
  "الحساب البنكي": "Bank account",
  "حساب بنكي واحد": "One bank account",
  "الحسابات البنكية": "Bank accounts",
  "معلومات رسمية ومحدثة": "Official, up-to-date information",
  "الموقع الجغرافي": "Location",
  "للتواصل": "Contact",
  "مدة الاحتفاظ بالبيانات": "Data retention period",

  "منتجاتنا": "Our Products",
  "تصفح الأقسام والمنتجات": "Browse categories and products",
  "الأقسام والمنتجات": "Categories & Products",
  "استعرض الأقسام والمنتجات واختر ما تريد.": "Browse categories and choose your products.",
  "لا توجد أقسام أو منتجات بعد.": "No categories or products yet.",
  "تنزيل جميع المنتجات": "Download all products",
  "بحث في جميع أقسام المنتجات": "Search all product categories",
  "ابحث في جميع الأقسام (الاسم أو الكود أو المواصفات)…": "Search categories (name, code or specifications)…",
  "اختر طريقة التواصل": "Choose a contact method",
  "إغلاق": "Close",
  "اتصال": "Call",
  "واتساب": "WhatsApp",
  "اختر الفرع": "Choose a branch",
  "اختر الموقع الجغرافي الذي تريد فتحه.": "Choose the location to open.",
  "اختر نوع الملف": "Choose file format",
  "اختر الصيغة المناسبة للتحميل.": "Choose your preferred download format.",
  "تحميل PDF": "Download PDF",
  "تحميل JPG": "Download JPG",
  "تحميل JPG عالي الدقة": "Download high-resolution JPG",
  "ملف مناسب للطباعة والمشاركة الرسمية": "Suitable for printing and sharing",
  "صورة مناسبة للمعرض والمشاركة السريعة": "High-resolution image for easy sharing",
  "إغلاق كتالوج المنتجات": "Close product catalog",
  "إغلاق الصورة المكبرة": "Close enlarged image",
  "الصورة السابقة": "Previous image",
  "الصورة التالية": "Next image",
  "الصورة الحالية": "Current image",
  "تحميل هذه الصورة": "Download this image",
  "مشاركة المنتج": "Share product",
  "مشاركة القسم": "Share category",
  "تحميل كتالوج PDF": "Download PDF catalog",
  "استفسار عن هذا المنتج عبر واتساب": "Ask about this product on WhatsApp",
  "استفسار عبر واتساب": "Ask on WhatsApp",
  "تحميل": "Download",
  "تحميل المنتج": "Download product",
  "تحميل قسم": "Download category",
  "دخول كتالوج المنتجات": "Product catalog access",
  "عرّفنا بك أولًا": "Please introduce yourself",
  "أدخل بياناتك مرة واحدة للمتابعة إلى المنتجات.": "Enter your details once to continue to the catalog.",
  "الاسم": "Name",
  "اسم الشركة": "Company name",
  "اختياري": "Optional",
  "مثال: محمد أحمد": "e.g. Mohammed Ahmed",
  "مثال: شركة النور": "e.g. Al Noor Company",
  "رقم الجوال": "Mobile number",
  "اترك هذا الحقل فارغًا": "Leave this field empty",
  "متابعة إلى المنتجات": "Continue to products",
  "سياسة الخصوصية": "Privacy policy",
  "بالمتابعة سيتم حفظ الاسم ورقم الجوال، واسم الشركة إذا أدخلته، لاستخدامها في التواصل وخدمة الاستفسارات.": "By continuing, your name, phone number and company name (if provided) will be stored for customer communication and enquiries.",
  "إخفاء تذكير التثبيت": "Dismiss installation reminder",
  "ثبّت تطبيق بصائر الخليج": "Install Basair Gulf app",
  "افتحه كتطبيق مستقل على جوالك.": "Open the website as an app on your phone.",
  "تثبيت": "Install",
  "تم تجهيز بطاقة PDF للتحميل": "Your PDF card is ready to download",
  "الحسابات البنكية": "Bank accounts",
  "حساب بنكي واحد": "One bank account",
  "حسابات بنكية": "Bank accounts",
  "الرئيسي": "Primary",
  "المستفيد": "Beneficiary",
  "رقم الحساب": "Account number",
  "نسخ": "Copy",
  "تم النسخ ✓": "Copied ✓",
  "تعذر النسخ": "Could not copy",
  "بيانات المنشأة": "Business information",
  "معلومات رسمية ومحدثة": "Official business details",
  "الاسم التجاري": "Legal business name",
  "السجل التجاري": "Commercial registration",
  "الرقم الضريبي": "Tax ID",
  "للتواصل": "Contact",
  "مدة الاحتفاظ بالبيانات": "Data retention period",
  "يوم": "days",
  "تعذر تحميل بيانات المنشأة حالياً. أعد المحاولة لاحقاً.": "Unable to load business information. Please try later.",
  "المنتجات": "Products",
  "المنتج": "Product",
  "صفحة": "Page",
  "الكتالوج": "Catalog",
  "كتالوج": "Catalog",
  "كتالوج PDF": "PDF catalog",
  "قسم": "Category",
  "منتجات قسم": "Category products",
  "منتجات قسم ثريات": "Chandelier products",
  "منتجات قسم كشافات شارع": "Street lighting products",
  "تحميل قسم": "Download category",
  "القسم": "Category",
  "غير مصنف": "Uncategorized",
  "المواصفات الفنية": "Technical specifications",
  "المواصفات": "Specifications",
  "المعلومة السابقة": "Previous specification",
  "المعلومة التالية": "Next specification",
  "الصورة": "Image",
  "صور": "images",
  "كود المنتج": "Product code",
  "رمز المنتج": "Product code",
  "رقم المنتج": "Product number",
  "رقم المنتج / الكود": "Product number / code",
  "متوفر": "Available",
  "نفد": "Out of stock",
  "قريبًا": "Coming soon",
  "حالة التوفر": "Availability",
  "كل حالات التوفر": "All availability statuses",
  "كل الأكواد": "All codes",
  "القدرة": "Wattage",
  "الواط": "Wattage",
  "وات": "W",
  "كل القدرات": "All wattages",
  "اللومن": "Lumens",
  "كل قيم اللومن": "All lumen values",
  "حرارة اللون": "Color temperature",
  "كل درجات اللون": "All color temperatures",
  "كل قيم CRI": "All CRI values",
  "الفولت": "Voltage",
  "كل قيم الفولت": "All voltages",
  "درجة الحماية": "IP rating",
  "درجة الحماية IP": "IP rating",
  "كل درجات الحماية": "All IP ratings",
  "المقاس": "Dimensions",
  "المقاس / الأبعاد": "Dimensions",
  "الأبعاد": "Dimensions",
  "كل المقاسات": "All dimensions",
  "اللون": "Color",
  "كل الألوان": "All colors",
  "الخامة": "Material",
  "كل الخامات": "All materials",
  "زاوية الإضاءة": "Beam angle",
  "كل الزوايا": "All beam angles",
  "التردد": "Frequency",
  "كل الترددات": "All frequencies",
  "الضمان": "Warranty",
  "كل مدد الضمان": "All warranty terms",
  "قاعدة اللمبة": "Lamp base",
  "كل القواعد": "All lamp bases",
  "عدد اللمبات": "Number of lamps",
  "كل الأعداد": "All quantities",
  "مسح الفلاتر": "Clear filters",
  "لا توجد أقسام منتجات قابلة للبحث": "No searchable product categories",
  "لا توجد نتائج مطابقة للبحث والفلاتر": "No matching products. Try changing your search or filters.",
  "السعر": "Price",
  "سعر المفرق": "Retail price",
  "سعر الجملة": "Wholesale price",
  "سعر جملة الجملة": "Bulk wholesale price",
  "عرض لفترة محدودة": "Limited-time offer",
  "جميع المنتجات": "All products",
  "قائمة الطلب": "Order list",
  "قائمة طلب عرض السعر": "Quotation request list",
  "أضف لقائمة الطلب": "Add to order list",
  "عدّل الكميات ثم أرسل الطلب إلى واتساب.": "Adjust quantities, then send your request via WhatsApp.",
  "إغلاق قائمة الطلب": "Close order list",
  "ملاحظات": "Notes",
  "(اختياري)": "(optional)",
  "(حتى 500 حرف)": "(up to 500 characters)",
  "إرسال عبر واتساب": "Send via WhatsApp",
  "مسح القائمة": "Clear list",
  "تم مسح قائمة الطلب": "Order list cleared",
  "بدون كود": "No code",
  "حذف": "Remove",
  "لا يوجد رقم واتساب متاح حاليًا": "WhatsApp is currently unavailable.",
  "الطلب طويل جدًا لواتساب. قلّل عدد الأصناف أو الملاحظات.": "Your request is too long for WhatsApp. Reduce the items or notes.",
  "لا توجد منتجات ظاهرة للتحميل.": "There are no visible products to download.",
  "اختر تنزيل المنتج كملف PDF أو كصورة JPG عالية الدقة.": "Choose to download this product as a PDF or high-resolution JPG.",
  "تم نسخ الرابط": "Link copied",
  "تم نسخ رابط المنتج": "Product link copied",
  "تم نسخ رابط القسم": "Category link copied",
  "تعذر النسخ. انسخ الرابط من شريط العنوان.": "Could not copy the link. Please copy it from the address bar.",
  "جاري تجهيز JPG…": "Preparing JPG…",
  "جاري تجهيز PDF…": "Preparing PDF…",
  "جاري تحميل أداة PDF…": "Loading PDF tool…",
  "تنزيل جميع المنتجات PDF": "Download all products as PDF",
  "تنزيل جميع المنتجات صور": "Download all product images",
  "الموقع": "Location",
  "المواقع": "Locations",
  "الموقع الجغرافي": "Location",
  "الموقع الجغرافي، اختر الفرع": "Location — choose a branch",
  "الهاتف": "Phone",
  "جوال": "Mobile",
  "الموقع الإلكتروني": "Website",
  "البريد الإلكتروني": "Email",
  "تواصل": "Contact",
  "حفظ": "Save",
  "مشاركة": "Share",
  "تحميل كتالوج": "Download catalog",
  "تعذر تحميل التحقق الأمني. تحقق من الاتصال ثم أعد المحاولة.": "Security verification could not load. Check your connection and try again.",
  "انتظر لحظة ثم حاول مرة أخرى.": "Please wait a moment and try again.",
  "اكتب الاسم بشكل صحيح.": "Please enter a valid name.",
  "اكتب اسم الشركة بشكل صحيح أو اتركه فارغًا.": "Please enter a valid company name or leave it blank.",
  "اكتب رقم جوال صحيح.": "Please enter a valid mobile number.",
  "أكمل التحقق الأمني ثم اضغط متابعة.": "Complete security verification, then continue.",
  "جاري الحفظ...": "Saving…",
  "تعذر حفظ البيانات الآن.": "Unable to save your details right now.",
  "محاولات كثيرة من هذا الاتصال. حاول بعد عدة دقائق.": "Too many attempts. Please try again in a few minutes.",
  "تعذر التحقق الأمني. أعد المحاولة.": "Security verification failed. Please retry.",
  "تعذر حفظ البيانات الآن. تحقق من الاتصال وحاول مرة أخرى.": "Unable to save details. Check your connection and try again.",
  "فرع الفيصلية": "Al Faisaliyah branch",
  "فرع": "Branch",
  "اختر فرع": "Choose branch",
  "البيانات": "Information",
  "التصنيفات": "Categories",
  "صور المنتجات": "Product photos",
  "بدون": "None"
};
  const titleEn='Basair Gulf | Flower Light Products';
  const cache=new WeakMap();
  const attributeCache=new WeakMap();
  const attributes=['placeholder','aria-label','title'];
  const englishPrivacy=/\/privacy-en\.html$/i.test(location.pathname||'');
  let language=englishPrivacy?'en':'ar';
  try { if (!englishPrivacy && localStorage.getItem(KEY)==='en') language='en'; } catch (_) {}

  function translate(value){
    const string=String(value??'');
    const trimmed=string.trim();
    if (!trimmed) return string;
    if(trimmed==='استعرض الأقسام والمنتجات.')return string.replace(trimmed,'Browse categories and products.');
    if(trimmed==='ر.س')return string.replace(trimmed,'SAR');
    if(trimmed==='جاري تحميل بيانات المنشأة...')return string.replace(trimmed,'Loading business information…');
    const exact=dictionary[trimmed];
    if (exact) return string.replace(trimmed,exact);
    const patterns=[
      [/^(\d+) منتج$/,'$1 products'],
      [/^منتجات قسم (.+)$/,'Products in $1'],
      [/^من (\d+) قطعة فأكثر$/,'From $1 pieces'],
      [/^تحميل قسم (.+)$/,'Download category $1'],
      [/^مشاركة قسم (.+)$/,'Share category $1'],
      [/^مشاركة (.+)$/,'Share $1'],
      [/^تحميل (.+)$/,'Download $1']
    ];
    for(const [regex,result] of patterns)if(regex.test(trimmed))return string.replace(trimmed,trimmed.replace(regex,result));
    const rules=[
      [/^(\d+) معلومات$/,'$1 specifications'],
      [/^(\d+) صور$/,'$1 images'],
      [/^(\d+) يوم$/,'$1 days'],
      [/^قائمة الطلب \((\d+)\)$/,'Order list ($1)'],
      [/^تحميل قسم (.+)$/,'Download category $1'],
      [/^مشاركة (.+)$/,'Share $1'],
      [/^تحميل (.+)$/,'Download $1'],
      [/^كل (.+)$/,'All $1']
    ];
    for(const [regex,result] of rules){
      if(regex.test(trimmed)){
        const out=trimmed.replace(regex,result);
        // Do not display half-translated strings.
        if(!/[\u0600-\u06ff]/.test(out))return string.replace(trimmed,out);
      }
    }
    return string;
  }

  function blocked(node){
    const element=node.nodeType===1?node:node.parentElement;
    return !element || !!element.closest('script,style,svg,textarea,code,pre,[contenteditable="true"],[data-fl-no-translate],#flCloudAdmin');
  }
  function textNode(node){
    if(blocked(node))return;
    const current=node.nodeValue||'';
    let stored=cache.get(node);
    if(!stored || current!==stored.last){
      stored={original:current,last:current};
      cache.set(node,stored);
    }
    const next=language==='en'?translate(stored.original):stored.original;
    if(current!==next)node.nodeValue=next;
    stored.last=next;
  }
  function attr(element,name){
    const current=element.getAttribute(name);
    if(current==null)return;
    let records=attributeCache.get(element);
    if(!records){records=Object.create(null);attributeCache.set(element,records);}
    let stored=records[name];
    if(!stored||current!==stored.last)stored=records[name]={original:current,last:current};
    const next=language==='en'?translate(stored.original):stored.original;
    if(next!==current)element.setAttribute(name,next);
    stored.last=next;
  }
  function syncPrivacyLinks(root){
    if(root?.nodeType!==1)return;
    const links=[];
    if(root.matches?.('a[href="privacy.html"],a[href="privacy-en.html"]'))links.push(root);
    root.querySelectorAll?.('a[href="privacy.html"],a[href="privacy-en.html"]').forEach(link=>links.push(link));
    for(const link of links){
      if(link.closest('[data-fl-no-translate]'))continue;
      const wanted=language==='en'?'privacy-en.html':'privacy.html';
      if(link.getAttribute('href')!==wanted)link.setAttribute('href',wanted);
    }
  }
  function scan(root){
    if(!root)return;
    if(root.nodeType===3){textNode(root);return;}
    if(root.nodeType!==1 || blocked(root))return;
    syncPrivacyLinks(root);
    for(const name of attributes)if(root.hasAttribute(name))attr(root,name);
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_ELEMENT|NodeFilter.SHOW_TEXT);
    while(walker.nextNode()){
      const node=walker.currentNode;
      if(node.nodeType===3)textNode(node);
      else if(!blocked(node))for(const name of attributes)if(node.hasAttribute(name))attr(node,name);
    }
  }
  let pending=false;
  const observer=new MutationObserver(records=>{
    if(pending)return;
    pending=true;
    queueMicrotask(()=>{
      pending=false;
      for(const record of records){
        if(record.type==='childList'){
          record.addedNodes.forEach(scan);
        } else if(record.type==='characterData')textNode(record.target);
        else if(record.type==='attributes'&&record.attributeName)attr(record.target,record.attributeName);
      }
    });
  });

  function apply(){
    document.documentElement.lang=language;
    document.documentElement.dir=language==='en'?'ltr':'rtl';
    document.documentElement.dataset.flLanguage=language;
    const button=document.getElementById('flLanguageSwitch');
    if(button){
      button.textContent=language==='ar'?'English':'العربية';
      button.setAttribute('aria-label',language==='ar'?'Switch website to English':'التبديل إلى اللغة العربية');
      button.title=language==='ar'?'Switch to English':'العودة إلى العربية';
      button.lang=language==='ar'?'en':'ar';
    }
    scan(document.body);
    if(language==='en' && document.title.includes('بصائر الخليج')) document.title=titleEn;
    if(language==='ar' && document.title===titleEn) document.title='بصائر الخليج | مستودع منتجات فلور لايت';
    window.dispatchEvent(new CustomEvent('flowerlight:language-change',{detail:{language}}));
  }

  window.FL_I18N={
    get lang(){return language;},
    translate:(string)=>language==='en'?translate(string):String(string??''),
    setLanguage(next){
      if(next!=='ar'&&next!=='en')return;
      language=next;
      try{localStorage.setItem(KEY,next);}catch(_){}
      apply();
    }
  };
  const ready=()=>{
    const button=document.getElementById('flLanguageSwitch');
    if(button)button.addEventListener('click',()=>window.FL_I18N.setLanguage(language==='ar'?'en':'ar'));
    observer.observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:attributes});
    apply();
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});
  else ready();
})();
