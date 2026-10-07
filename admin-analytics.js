// Flower Light admin — Analytics section (STAGE88 module split, part 1)
//
// Extracted verbatim from admin.js (no logic changes) to start breaking the
// 3497-line admin.js into independently loadable sections. This file is a
// plain classic script (not an ES module) so it keeps sharing globals the
// simple way the rest of the admin bundle already does.
//
// Dependencies: window.FL_ADMIN_CORE, which admin.js sets up BEFORE this
// file is loaded (see index.html — admin-analytics.js loads right after
// admin.js, and only on ?admin= pages). If FL_ADMIN_CORE is missing for any
// reason, this file no-ops instead of throwing, so a loading-order mistake
// degrades to "Analytics tab does nothing" rather than breaking the rest of
// the admin panel.

(() => {
  'use strict';
  const core = window.FL_ADMIN_CORE;
  if (!core) {
    console.error('[admin-analytics] window.FL_ADMIN_CORE is missing — admin.js must load before admin-analytics.js.');
    return;
  }
  const esc = core.esc;
  const notify = core.notify;
  const layout = core.layout;
  const db = core.db;
  const getView = () => core.view;

  let analyticsPeriod = 30;

  function analyticsPeriodLabel(days){
    return days===1?'اليوم':days===7?'آخر 7 أيام':days===30?'آخر 30 يومًا':days===90?'آخر 90 يومًا':'كل الوقت';
  }
  function analyticsRows(items,emptyText='لا توجد بيانات بعد.'){
    const list=Array.isArray(items)?items:[];
    if(!list.length)return `<div class="fl-cloud-empty">${esc(emptyText)}</div>`;
    return `<div class="fl-analytics-rank">${list.map(item=>`<div class="fl-analytics-rank-row"><strong title="${esc(item.label||'غير مسمى')}">${esc(item.label||'غير مسمى')}</strong><span class="fl-analytics-count">${Number(item.count||0).toLocaleString('ar-SA')}</span></div>`).join('')}</div>`;
  }
  const analyticsMetricLabels={
    visits:'الزيارات',
    products_open:'فتح المنتجات',
    catalog_downloads:'تحميل الكتالوج',
    lead_submissions:'بيانات العملاء'
  };
  function analyticsChartSvg(rows,metric='visits'){
    const data=(Array.isArray(rows)?rows:[]).map(row=>({day:String(row.day||''),value:Number(row?.[metric]||0)}));
    if(!data.length)return '<div class="fl-chart-empty">لا توجد بيانات زمنية بعد.</div>';
    const width=820,height=270,padL=48,padR=20,padT=24,padB=45;
    const innerW=width-padL-padR,innerH=height-padT-padB;
    const max=Math.max(1,...data.map(x=>x.value));
    const point=(x,i)=>({x:padL+(data.length===1?innerW/2:(i/(data.length-1))*innerW),y:padT+innerH-(x.value/max)*innerH});
    const pts=data.map(point);
    const line=pts.map((p,i)=>`${i?'L':'M'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
    const area=`M ${pts[0].x.toFixed(1)} ${(padT+innerH).toFixed(1)} `+pts.map(p=>`L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')+` L ${pts[pts.length-1].x.toFixed(1)} ${(padT+innerH).toFixed(1)} Z`;
    const yTicks=[0,.25,.5,.75,1].map(r=>{
      const y=padT+innerH-(r*innerH);const v=Math.round(max*r);
      return `<line class="fl-chart-grid" x1="${padL}" y1="${y}" x2="${width-padR}" y2="${y}"></line><text class="fl-chart-text" x="${padL-9}" y="${y+4}" text-anchor="end">${v.toLocaleString('ar-SA')}</text>`;
    }).join('');
    const labelIndexes=[...new Set([0,Math.floor((data.length-1)*.25),Math.floor((data.length-1)*.5),Math.floor((data.length-1)*.75),data.length-1])];
    const xLabels=labelIndexes.map(i=>{
      const p=pts[i];let label=data[i].day;
      try{label=new Intl.DateTimeFormat('ar-SA',{month:'short',day:'numeric'}).format(new Date(`${data[i].day}T00:00:00`));}catch(_){}
      return `<text class="fl-chart-text" x="${p.x}" y="${height-16}" text-anchor="middle">${esc(label)}</text>`;
    }).join('');
    const dots=pts.map((p,i)=>{
      if(data.length>45 && i%Math.ceil(data.length/30)!==0 && i!==data.length-1)return '';
      return `<circle class="fl-chart-dot" cx="${p.x}" cy="${p.y}" r="3.5"><title>${esc(data[i].day)} · ${data[i].value.toLocaleString('ar-SA')}</title></circle>`;
    }).join('');
    return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(analyticsMetricLabels[metric]||'الإحصائيات')} حسب اليوم">${yTicks}<path class="fl-chart-area" d="${area}"></path><path class="fl-chart-line" d="${line}"></path>${dots}${xLabels}</svg>`;
  }
  let analyticsChartMetric='visits';
  function updateAnalyticsChart(a){
    const host=document.getElementById('flAnalyticsChart');
    if(host)host.innerHTML=analyticsChartSvg(a?.timeseries,analyticsChartMetric);
  }
  async function renderAnalytics(){
    layout(`<div class="fl-cloud-head"><div><h2>إحصائيات الموقع</h2><p>الزيارات والتفاعل مع المنتجات والأقسام والفروع.</p></div></div><div class="fl-cloud-card"><div class="fl-cloud-empty">جاري تحميل الإحصائيات...</div></div>`);
    const {data,error}=await db.rpc('get_site_analytics_for_admin',{p_days:analyticsPeriod});
    if(getView()!=='analytics')return;
    if(error){
      layout(`<div class="fl-cloud-head"><div><h2>إحصائيات الموقع</h2><p>الزيارات والتفاعل مع الموقع.</p></div></div><div class="fl-cloud-note bad">تعذر تحميل الإحصائيات. شغّل ملف <b>SUPABASE_SETUP.sql</b> في Supabase مرة واحدة ثم أعد المحاولة.<br><small>${esc(error.message||'')}</small></div>`);
      return;
    }
    const a=data||{};
    const uniqueLabel=a.unique_visitors_is_approx?'زوار فريدون تقريبيًا*':'زوار فريدون';
    const allTimeChartNote=analyticsPeriod===0?' · الرسم يعرض آخر 90 يومًا للحفاظ على الوضوح':'';
    layout(`<div class="fl-cloud-head"><div><h2>إحصائيات الموقع</h2><p>${esc(analyticsPeriodLabel(analyticsPeriod))}${allTimeChartNote} · البيانات تتحدث تلقائيًا.</p></div></div>
      <div class="fl-analytics-toolbar"><select id="flAnalyticsPeriod" aria-label="الفترة"><option value="1" ${analyticsPeriod===1?'selected':''}>اليوم</option><option value="7" ${analyticsPeriod===7?'selected':''}>7 أيام</option><option value="30" ${analyticsPeriod===30?'selected':''}>30 يومًا</option><option value="90" ${analyticsPeriod===90?'selected':''}>90 يومًا</option><option value="0" ${analyticsPeriod===0?'selected':''}>كل الوقت</option></select><div class="fl-cloud-actions"><button class="fl-cloud-btn" id="flAnalyticsRefresh" type="button">تحديث</button><button class="fl-cloud-btn danger" id="flAnalyticsReset" type="button">إعادة تعيين الإحصائيات</button></div></div>
      <div class="fl-analytics-grid">
        <div class="fl-analytics-card"><strong>${Number(a.total_visits||0).toLocaleString('ar-SA')}</strong><span>زيارات الموقع</span></div>
        <div class="fl-analytics-card"><strong>${Number(a.unique_visitors||0).toLocaleString('ar-SA')}</strong><span>${uniqueLabel}</span></div>
        <div class="fl-analytics-card"><strong>${Number(a.products_open||0).toLocaleString('ar-SA')}</strong><span>فتح المنتجات</span></div>
        <div class="fl-analytics-card"><strong>${Number(a.catalog_downloads||0).toLocaleString('ar-SA')}</strong><span>تحميل الكتالوج</span></div>
        <div class="fl-analytics-card"><strong>${Number(a.whatsapp_clicks||0).toLocaleString('ar-SA')}</strong><span>ضغطات واتساب</span></div>
        <div class="fl-analytics-card"><strong>${Number(a.phone_clicks||0).toLocaleString('ar-SA')}</strong><span>ضغطات اتصال</span></div>
        <div class="fl-analytics-card"><strong>${Number(a.location_clicks||0).toLocaleString('ar-SA')}</strong><span>زيارات الفروع</span></div>
        <div class="fl-analytics-card"><strong>${Number(a.lead_submissions||0).toLocaleString('ar-SA')}</strong><span>بيانات عملاء مسجلة</span></div>
        <div class="fl-analytics-card"><strong>${Number(a.saved_contacts||0).toLocaleString('ar-SA')}</strong><span>حفظ جهة الاتصال</span></div>
      </div>
      <div class="fl-analytics-chart-card">
        <div class="fl-analytics-chart-head"><div><h3>النشاط اليومي</h3><p>منحنى زمني حقيقي مبني على أحداث الموقع.</p></div><select id="flAnalyticsMetric" aria-label="المؤشر"><option value="visits" ${analyticsChartMetric==='visits'?'selected':''}>الزيارات</option><option value="products_open" ${analyticsChartMetric==='products_open'?'selected':''}>فتح المنتجات</option><option value="catalog_downloads" ${analyticsChartMetric==='catalog_downloads'?'selected':''}>تحميل الكتالوج</option><option value="lead_submissions" ${analyticsChartMetric==='lead_submissions'?'selected':''}>بيانات العملاء</option></select></div>
        <div class="fl-analytics-chart-wrap" id="flAnalyticsChart">${analyticsChartSvg(a.timeseries,analyticsChartMetric)}</div>
      </div>
      <div class="fl-analytics-columns">
        <div class="fl-cloud-card"><div class="fl-cloud-head"><div><h2 style="font-size:17px">الأقسام الأكثر ضغطًا</h2><p>عدد مرات اختيار كل قسم من كتالوج المنتجات.</p></div></div>${analyticsRows(a.categories,'لم يتم الضغط على أي قسم بعد.')}</div>
        <div class="fl-cloud-card"><div class="fl-cloud-head"><div><h2 style="font-size:17px">الفروع والمواقع</h2><p>الملز والفيصلية وأي فرع جديد يظهر منفصلًا.</p></div></div>${analyticsRows(a.locations,'لم تتم زيارة أي فرع بعد.')}</div>
      </div>
      <div class="fl-cloud-note">يتم الاحتفاظ بالأحداث الخام لمدة ${Number(a.raw_retention_days||180)} يومًا، ثم تُحفظ كإحصائيات يومية مجمعة تلقائيًا لتقليل حجم قاعدة البيانات. ${a.unique_visitors_is_approx?'*عند شمول بيانات مؤرشفة يكون عدد الزوار الفريدين تقديريًا لأن نفس الزائر قد يظهر في أكثر من يوم.':'عدد الزوار الفريدين محسوب من معرف متصفح مجهول ولا يتضمن الاسم أو رقم الجوال.'}</div>`);
    document.getElementById('flAnalyticsPeriod')?.addEventListener('change',e=>{analyticsPeriod=Number(e.target.value)||0;renderAnalytics();});
    document.getElementById('flAnalyticsRefresh')?.addEventListener('click',renderAnalytics);
    document.getElementById('flAnalyticsReset')?.addEventListener('click',async()=>{
      const resetBtn=document.getElementById('flAnalyticsReset');
      const confirmed=window.confirm('سيتم حذف جميع إحصائيات الموقع نهائيًا، بما فيها الزيارات وضغطات الأقسام والفروع وتحميلات الكتالوج، ثم يبدأ العد من الصفر.\n\nلن يتم حذف المنتجات أو الأقسام أو بيانات العملاء أو وسائل التواصل.\n\nهل تريد المتابعة؟');
      if(!confirmed)return;
      if(resetBtn){resetBtn.disabled=true;resetBtn.textContent='جاري إعادة التعيين...';}
      try{
        const {data:resetResult,error:resetError}=await db.rpc('reset_site_analytics_for_admin');
        if(resetError)throw resetError;
        const rawDeleted=Number(resetResult?.raw_deleted||0);
        const dailyDeleted=Number(resetResult?.daily_deleted||0);
        analyticsChartMetric='visits';
        notify(`تمت إعادة تعيين الإحصائيات · حُذف ${rawDeleted.toLocaleString('ar-SA')} حدث خام و${dailyDeleted.toLocaleString('ar-SA')} سجل مؤرشف`);
        await renderAnalytics();
      }catch(err){
        console.warn('[Analytics reset] failed',err);
        const resetMessage=String(err?.message||'');
        notify(/DELETE requires a WHERE clause/i.test(resetMessage)
          ? 'شغّل ملف SUPABASE_SETUP.sql في Supabase مرة واحدة، ثم أعد المحاولة.'
          : (resetMessage||'تعذر إعادة تعيين الإحصائيات. شغّل ملف SUPABASE_SETUP.sql في Supabase ثم حاول مجددًا.'));
        if(resetBtn){resetBtn.disabled=false;resetBtn.textContent='إعادة تعيين الإحصائيات';}
      }
    });
    document.getElementById('flAnalyticsMetric')?.addEventListener('change',e=>{analyticsChartMetric=e.target.value;updateAnalyticsChart(a);});
  }



  window.FL_ADMIN_ANALYTICS = { renderAnalytics };
})();
