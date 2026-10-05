(()=>{'use strict';

const REPORT_ID='vdReportV2';
const PREVIEW_ID='vdReportPreviewOverlay';
const SMART_PAGES=new Set(['smartCenter','temporalMemory','investigationRoom','explainableDecision','smartThursday']);

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
const chunk=(arr,size)=>{const out=[];for(let i=0;i<arr.length;i+=size)out.push(arr.slice(i,i+size));return out};
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));

function state(){return window.VDUrgent?.getState?.()||{}}
function pageKey(){return state().page||document.querySelector('#nav .nav-item.active')?.dataset?.page||''}
function pageName(){const meta=window.VDUrgent?.PAGE_META?.[pageKey()];return meta?.title||document.getElementById('pageTitle')?.textContent?.trim()||'تقرير الداشبورد'}
function brand(){return {project:'إدارة الحلول العاجلة',city:'أمانة محافظة جدة • مشاريع المياه',contractText:'شركة أبعاد الرؤية للاستشارات الهندسية'}}
function host(){return document.getElementById('pageHost')}
function visible(el,boundary=document.body){
 if(!el)return false;
 let n=el;
 while(n){
  if(n.hidden||n.getAttribute?.('aria-hidden')==='true')return false;
  const st=getComputedStyle(n);
  if(st.display==='none'||st.visibility==='hidden'||Number(st.opacity)===0)return false;
  if(n===boundary||n===document.body)break;
  n=n.parentElement;
 }
 return true;
}
function filters(){
 const out=[];
 document.querySelectorAll('#activeFilters .filter-chip b:first-child').forEach(x=>{const t=clean(x.textContent);if(t)out.push(t)});
 const p=clean(document.getElementById('periodSummaryMain')?.textContent);
 if(p&&p!=='كامل المدة'&&p!=='كامل البيانات')out.push('الفترة: '+p);
 return [...new Set(out)];
}
function makeKpi(label,value,note=''){
 const a=document.createElement('article');a.className='kpi-card';
 a.innerHTML='<span>'+esc(label)+'</span><strong>'+esc(value)+'</strong><small>'+esc(note)+'</small>';
 return a;
}
function freezeControls(root,mode='remove',keepLegend=false){
 if(!root)return;
 root.querySelectorAll('[hidden],[aria-hidden="true"]').forEach(x=>x.remove());
 root.querySelectorAll('.mf-pop,.tooltip,.toast,.vd-info-modal,.filter-summary').forEach(x=>x.remove());
 if(!keepLegend)root.querySelectorAll('.map-legend').forEach(x=>x.remove());
 root.querySelectorAll('button').forEach(btn=>{
  if(mode==='freeze'&&!btn.closest('.us-smart-tabs')&&!btn.matches('[data-report-ignore]')){
   const div=document.createElement('div');
   div.className=(btn.className||'')+' vd-report-static-button';
   div.innerHTML=btn.innerHTML;
   btn.replaceWith(div);
  }else btn.remove();
 });
 root.querySelectorAll('input,select,textarea').forEach(el=>{
  const span=document.createElement('span');span.className='vd-report-static-value';
  span.textContent=el.options?.[el.selectedIndex]?.textContent||el.value||'';
  el.replaceWith(span);
 });
 root.querySelectorAll('iframe').forEach(x=>x.remove());
 root.querySelectorAll('a').forEach(a=>{
  const span=document.createElement('span');span.className='vd-report-static-link';span.textContent=clean(a.textContent)||a.href||'';
  a.replaceWith(span);
 });
}
function removeExportBars(root){
 root?.querySelectorAll?.('.sheet-report-hero,.followup-single-pdf,.us-smart-hero,.dq-hero,.rc-hero,.page-hero,.report-hero,.hero-bar,.tab-hero').forEach(x=>x.remove());
}
function cloneWithCharts(source,options={}){
 const clone=source.cloneNode(true);
 const src=[...source.querySelectorAll('canvas')],dst=[...clone.querySelectorAll('canvas')];
 src.forEach((canvas,i)=>{
  const c=dst[i];if(!c)return;
  try{
   if(!visible(canvas,source)){c.remove();return}
   const chart=window.Chart?.getChart?.(canvas);chart?.stop?.();chart?.update?.('none');
   const img=document.createElement('img');img.className='vd-report-chart-image';img.src=canvas.toDataURL('image/png',1);img.alt='Chart';
   c.replaceWith(img);
   if(chart?.config?.type==='doughnut'){
    img.classList.add('vd-report-chart-image-doughnut');clone.classList.add('vd-report-doughnut-card');
    const legend=document.createElement('div');legend.className='vd-report-doughnut-legend';
    const labels=Array.isArray(chart.data?.labels)?chart.data.labels:[],ds=chart.data?.datasets?.[0]||{};
    const colors=Array.isArray(ds.backgroundColor)?ds.backgroundColor:labels.map(()=>ds.backgroundColor||'#64748b');
    labels.forEach((label,j)=>{const item=document.createElement('span');item.className='vd-report-doughnut-legend-item';item.innerHTML='<i style="background:'+esc(colors[j]||'#64748b')+'"></i><b>'+esc(label)+'</b>';legend.appendChild(item)});
    img.insertAdjacentElement('afterend',legend);
   }
  }catch(_){c.remove()}
 });
 removeExportBars(clone);
 freezeControls(clone,options.buttons||'remove',!!options.keepLegend);
 return clone;
}
function createPage(title,subtitle='',cls=''){
 const b=brand(),p=document.createElement('section');p.className=('vd-report-v2-page '+cls).trim();
 p.innerHTML='<header class="vd-report-section-header"><div><span>VISION DIMENSIONS</span><h2>'+esc(title)+'</h2><div class="vd-report-page-identity"><b>'+esc(pageName())+'</b><span>'+esc(b.project)+' • '+esc(b.city)+'</span></div></div>'+(subtitle?'<p>'+esc(subtitle)+'</p>':'')+'</header><div class="vd-report-section-body"></div><div class="vd-report-page-stamp">'+esc(pageName())+' • '+new Date().toLocaleString('ar-SA')+'</div><footer class="vd-report-footer"><span>Vision Dimensions</span><span>شركة أبعاد الرؤية للاستشارات الهندسية</span><span>'+esc(b.project)+'</span></footer>';
 return p;
}
function appendPageNumbers(report){
 const pages=[...report.querySelectorAll('.vd-report-v2-page')],total=pages.length;
 pages.forEach((p,i)=>{
  const footer=p.querySelector('.vd-report-footer');if(!footer)return;
  const n=document.createElement('span');n.className='vd-report-page-number';n.textContent='صفحة '+(i+1)+' / '+total;footer.appendChild(n);
 });
}
function buildCover(report,kpis=[]){
 const b=brand(),fs=filters(),now=new Date(),p=document.createElement('section');p.className='vd-report-v2-page vd-report-cover';
 const shownFilters=fs.slice(0,10),extra=fs.length-shownFilters.length;
 p.innerHTML='<div class="vd-report-cover-top"><div class="vd-report-cover-brand"><img src="/assets/vision-dimensions-makkah.png" alt="Vision Dimensions"><div><strong>شركة أبعاد الرؤية للاستشارات الهندسية</strong><span>VISION DIMENSIONS ENGINEERING CONSULTANCY</span></div></div><div class="vd-report-cover-badge">تقرير فني</div></div><div class="vd-report-cover-title"><small>'+esc(b.project)+'</small><h1>'+esc(pageName())+'</h1><p>'+esc(b.city)+'</p><strong>'+esc(b.contractText)+'</strong></div><div class="vd-report-cover-meta"><div><span>تاريخ التقرير</span><b>'+now.toLocaleDateString('ar-SA')+'</b></div><div><span>وقت الإصدار</span><b>'+now.toLocaleTimeString('ar-SA',{hour:'2-digit',minute:'2-digit'})+'</b></div><div><span>الفلاتر</span><b>'+(fs.length?fs.length+' فلتر مطبق':'جميع البيانات')+'</b></div></div><div class="vd-report-cover-kpis"></div>'+(shownFilters.length?'<div class="vd-report-cover-filters"><strong>الفلاتر المطبقة</strong><div>'+shownFilters.map(x=>'<span>'+esc(x)+'</span>').join('')+(extra>0?'<span>+'+extra+' فلاتر أخرى</span>':'')+'</div></div>':'')+'<div class="vd-report-cover-footer">VISION DIMENSIONS</div>';
 const g=p.querySelector('.vd-report-cover-kpis');
 kpis.slice(0,6).forEach(k=>{const c=k.cloneNode(true);freezeControls(c);c.classList.add('vd-report-kpi-clone');g.appendChild(c)});
 report.appendChild(p);
}
function panelTitle(panel,fallback='تفاصيل التقرير'){
 const contractor=panel.closest?.('.sheet-contractor-report');
 if(contractor){const h=clean(contractor.querySelector('h4')?.textContent),b=clean(contractor.querySelector('.sheet-balance b')?.textContent);if(h)return h+(b?' - صافي الأمتار: '+b:'')}
 return clean(panel.querySelector?.('.table-tools b,.panel-head b,.us-panel-head h3,.dq-detail-head h3,h1,h2,h3')?.textContent)||fallback;
}
function findKpis(root){
 const selector='.kpi-card,.us-kpi';
 return [...root.querySelectorAll(selector)].filter(x=>visible(x,root)&&!x.querySelector(selector));
}
function buildKpis(report,kpis){
 if(!kpis.length)return;
 chunk(kpis,16).forEach((grp,i)=>{
  const p=createPage('المؤشرات الرئيسية',kpis.length>16?'صفحة '+(i+1):'ملخص المؤشرات','vd-report-kpi-page');
  const g=document.createElement('div');g.className='vd-report-kpi-grid';
  grp.forEach(k=>{const c=k.cloneNode(true);freezeControls(c);c.classList.add('vd-report-kpi-clone');g.appendChild(c)});
  p.querySelector('.vd-report-section-body').appendChild(g);report.appendChild(p);
 });
}
function buildCharts(report,panels){
 if(!panels.length)return;
 chunk(panels,4).forEach((grp,i)=>{
  const p=createPage('التحليلات والرسوم البيانية',panels.length>4?'صفحة '+(i+1):'التحليلات المرئية','vd-report-chart-page');
  const g=document.createElement('div');g.className='vd-report-chart-grid';
  grp.forEach(x=>{const c=cloneWithCharts(x);c.classList.add('vd-report-chart-card');g.appendChild(c)});
  p.querySelector('.vd-report-section-body').appendChild(g);report.appendChild(p);
 });
}
function rowsPerPage(table,rows){
 const cols=Math.max(1,table.querySelectorAll('thead th').length||table.rows?.[0]?.cells?.length||1);
 const sample=rows.slice(0,20),texts=sample.flatMap(r=>[...r.cells].map(c=>clean(c.textContent)));
 const avg=texts.length?texts.reduce((a,b)=>a+b.length,0)/texts.length:0,max=texts.reduce((m,x)=>Math.max(m,x.length),0);
 let n=cols<=4?26:cols<=6?22:cols<=8?18:cols<=10?15:cols<=12?12:cols<=16?9:7;
 if(avg>28)n-=2;if(avg>50)n-=2;if(max>140)n-=2;if(max>260)n-=1;
 return clamp(n,5,28);
}
function buildTablePages(report,sources){
 sources.forEach(source=>{
  if(!visible(source,host()||document.body))return;
  const table=source.matches('table')?source:source.querySelector('table');if(!table)return;
  const rows=[...table.querySelectorAll('tbody tr')].filter(r=>visible(r,source));
  if(!rows.length)return;
  const per=rowsPerPage(table,rows),groups=chunk(rows,per),title=panelTitle(source);
  const context=source.closest?.('.us-panel,.dq-details,.sheet-contractor-report'),note=clean(source.querySelector?.('.table-tools small,.us-panel-head small,.dq-detail-head small')?.textContent)||clean(context?.querySelector?.('.us-panel-head small,.dq-detail-head small')?.textContent);
  const cols=table.querySelectorAll('thead th').length;
  groups.forEach((grp,i)=>{
   const p=createPage(title,groups.length>1?'صفحة '+(i+1)+' من '+groups.length:(note||'بيانات التقرير'),'vd-report-table-page');
   const wrap=document.createElement('section');wrap.className='vd-report-summary-table';
   if(cols>12)wrap.classList.add('vd-report-table-ultra-wide');else if(cols>8)wrap.classList.add('vd-report-table-wide');
   const t=table.cloneNode(true),body=t.querySelector('tbody');body.innerHTML='';
   grp.forEach(r=>body.appendChild(r.cloneNode(true)));
   wrap.appendChild(t);freezeControls(wrap);
   p.querySelector('.vd-report-section-body').appendChild(wrap);report.appendChild(p);
  });
 });
}
function fitVisual(source,clone,wrapper,maxWidth=1000,maxHeight=520){
 const rect=source.getBoundingClientRect(),w=Math.max(1,Math.ceil(source.scrollWidth||0),Math.ceil(rect.width||0)),h=Math.max(1,Math.ceil(source.scrollHeight||0),Math.ceil(rect.height||0));
 const scale=Math.min(1,maxWidth/w,maxHeight/h);
 clone.style.width=w+'px';clone.style.maxWidth='none';clone.style.transformOrigin='top center';clone.style.transform='scale('+scale+')';
 wrapper.style.height=(Math.ceil(h*scale)+8)+'px';wrapper.dataset.scale=scale.toFixed(3);
}
function buildMapPage(report,root){
 const map=root.querySelector('.map-panel');if(!map||!visible(map,root))return;
 const p=createPage('الخريطة الجغرافية','مواقع المشاريع والخطوط البديلة','vd-report-map-page');
 const wrap=document.createElement('div');wrap.className='vd-report-visual-wrapper';
 const c=cloneWithCharts(map,{keepLegend:true});wrap.appendChild(c);fitVisual(map,c,wrap,1060,530);
 p.querySelector('.vd-report-section-body').appendChild(wrap);report.appendChild(p);
}
function buildMisc(report,elements,title='تفاصيل إضافية'){
 const usable=elements.filter(x=>visible(x,host()||document.body)&&clean(x.textContent).length>10&&!x.matches('.sheet-report-hero,.followup-single-pdf,.us-smart-hero,.dq-hero,.rc-hero,.page-hero,.report-hero,.hero-bar,.tab-hero')&&!x.querySelector('canvas,table'));
 chunk(usable,2).forEach((grp,i)=>{
  const p=createPage(title,usable.length>2?'صفحة '+(i+1):'محتوى الشاشة الحالية','vd-report-misc-page');
  const g=document.createElement('div');g.className='vd-report-misc-grid';
  grp.forEach(x=>{const c=cloneWithCharts(x,{buttons:'freeze'});g.appendChild(c)});
  p.querySelector('.vd-report-section-body').appendChild(g);report.appendChild(p);
 });
}
function qualityKpis(root){
 const out=[];
 const rate=clean(root.querySelector('.dq-hero-score-main b')?.textContent),issues=clean(root.querySelector('.dq-hero-score-main strong')?.textContent);
 if(rate)out.push(makeKpi('نسبة جودة البيانات',rate,issues?issues+' ملاحظة':''));
 [...root.querySelectorAll('.dq-overview-card')].slice(0,5).forEach(x=>out.push(makeKpi(clean(x.querySelector('span')?.textContent),clean(x.querySelector('strong')?.textContent),clean(x.querySelector('small')?.textContent))));
 return out;
}
function buildQualityReport(report,root){
 const kpis=qualityKpis(root);buildCover(report,kpis);
 const overview=root.querySelector('.dq-overview');
 if(overview){
  const p=createPage('ملخص جودة البيانات','الوضع الحالي ونسب الاكتمال','vd-report-dq-page vd-report-dq-summary');
  const b=p.querySelector('.vd-report-section-body');
  const c=cloneWithCharts(overview,{buttons:'freeze'});c.classList.add('vd-report-dq-source');b.appendChild(c);
  report.appendChild(p);
 }
 [...root.querySelectorAll('.dq-section')].filter(x=>visible(x,root)).forEach(section=>{
  const title=clean(section.querySelector('.dq-section-head h3')?.textContent)||'جودة البيانات';
  const p=createPage(title,'قواعد جودة البيانات وملاحظات الاكتمال','vd-report-dq-page vd-report-dq-section-page');
  const c=cloneWithCharts(section,{buttons:'freeze'});c.classList.add('vd-report-dq-source');
  p.querySelector('.vd-report-section-body').appendChild(c);report.appendChild(p);
 });
 const smart=root.querySelector('.dq-smart-audit');
 if(smart&&visible(smart,root)){
  const p=createPage('التدقيق الذكي لجودة البيانات','SMART DATA AUDIT','vd-report-dq-page vd-report-dq-smart-page');
  const c=cloneWithCharts(smart,{buttons:'freeze'});c.classList.add('vd-report-dq-source');
  p.querySelector('.vd-report-section-body').appendChild(c);report.appendChild(p);
 }
 const details=root.querySelector('#udqIssueDetails .dq-table-wrap');
 if(details&&visible(details,root))buildTablePages(report,[details]);
 const archive=root.querySelector('.dq-archive-head');
 if(archive){
  const p=createPage('أرشيف جودة البيانات','مرجع الأرشفة المعتمد','vd-report-dq-page');
  p.querySelector('.vd-report-section-body').appendChild(cloneWithCharts(archive,{buttons:'freeze'}));report.appendChild(p);
 }
}
function buildSmartReport(report,root){
 const kpis=findKpis(root);buildCover(report,kpis);
 const mainKpis=root.querySelector('.us-kpis'),week=root.querySelector('.us-week-window');
 if(mainKpis||week){
  const p=createPage('الملخص الذكي',pageName(),'vd-report-smart-page vd-report-smart-summary');
  const b=p.querySelector('.vd-report-section-body');
  [week,mainKpis].filter(Boolean).forEach(x=>b.appendChild(cloneWithCharts(x,{buttons:'freeze'})));
  report.appendChild(p);
 }
 const banners=[...root.querySelectorAll('.us-what-banner,.us-memory-ask')].filter(x=>visible(x,root));
 if(banners.length)buildMisc(report,banners,'التحليل والتغيرات');
 const tableWraps=[...root.querySelectorAll('.us-table-wrap')].filter(x=>visible(x,root));
 if(tableWraps.length)buildTablePages(report,tableWraps);
 const panels=[...root.querySelectorAll('.us-panel')].filter(x=>visible(x,root)&&!x.querySelector('table'));
 chunk(panels,2).forEach((grp,i)=>{
  const p=createPage('التحليل الذكي التفصيلي',panels.length>2?'صفحة '+(i+1):pageName(),'vd-report-smart-page');
  const g=document.createElement('div');g.className='vd-report-smart-grid';
  grp.forEach(x=>{const c=cloneWithCharts(x,{buttons:'freeze'});c.classList.add('vd-report-smart-card');g.appendChild(c)});
  p.querySelector('.vd-report-section-body').appendChild(g);report.appendChild(p);
 });
 const cards=[...root.querySelectorAll('.us-decision-card')].filter(x=>visible(x,root));
 chunk(cards,6).forEach((grp,i)=>{
  const p=createPage('قرارات وأولويات التنفيذ',cards.length>6?'صفحة '+(i+1):'EXPLAINABLE DECISION','vd-report-smart-page vd-report-smart-decisions');
  const g=document.createElement('div');g.className='vd-report-decision-grid';
  grp.forEach(x=>g.appendChild(cloneWithCharts(x,{buttons:'freeze'})));
  p.querySelector('.vd-report-section-body').appendChild(g);report.appendChild(p);
 });
}
function buildFollowupReport(report,root){
 const kpis=[...root.querySelectorAll('.kpi-card')].filter(x=>visible(x,root));buildCover(report,kpis);
 const summary=[root.querySelector('.sheet-report-kpis'),...root.querySelectorAll('.sheet-report-warning')].filter(Boolean);
 if(summary.length){
  const p=createPage('المتابعة','ملخص تقارير ورقة reports','vd-report-followup-summary');
  const b=p.querySelector('.vd-report-section-body');summary.forEach(x=>b.appendChild(cloneWithCharts(x,{buttons:'freeze'})));report.appendChild(p);
 }
 const tables=[...root.querySelectorAll('.sheet-report-table')].filter(x=>visible(x,root));buildTablePages(report,tables);
}
function buildReportsCenter(report,root){
 buildCover(report,[]);
 const hub=root.querySelector('#vdReportHub');
 if(!hub)return;
 const groups=[...hub.querySelectorAll('.rc-group')].filter(x=>visible(x,hub));
 groups.forEach(g=>{
  const title=clean(g.querySelector('.rc-group-head h3')?.textContent)||'مركز التقارير';
  const p=createPage(title,'قائمة التقارير المتاحة بصيغة PDF','vd-report-center-page');
  const c=cloneWithCharts(g,{buttons:'freeze'});p.querySelector('.vd-report-section-body').appendChild(c);report.appendChild(p);
 });
}
function buildStandardReport(report,root){
 const kpis=[...root.querySelectorAll('.kpi-card')].filter(x=>visible(x,root)),charts=[...root.querySelectorAll('.panel')].filter(x=>visible(x,root)&&x.querySelector('canvas')),tables=[...root.querySelectorAll('.table-panel')].filter(x=>visible(x,root));
 buildCover(report,kpis);buildKpis(report,kpis);buildCharts(report,charts);buildTablePages(report,tables);buildMapPage(report,root);
 const used=new Set([...kpis.map(x=>x.closest('.kpi-grid')||x),...charts,...tables]);
 const extras=[...root.children].filter(x=>!used.has(x)&&!x.matches('.kpi-grid,.chart-grid,.map-panel')&&!x.querySelector('.table-panel,.panel,canvas,table'));
 buildMisc(report,extras);
}
function build(){
 document.getElementById(REPORT_ID)?.remove();
 const root=host(),report=document.createElement('div');report.id=REPORT_ID;report.className='vd-report-v2';document.body.appendChild(report);
 if(!root)return report;
 const key=pageKey();
 if(key==='quality')buildQualityReport(report,root);
 else if(SMART_PAGES.has(key))buildSmartReport(report,root);
 else if(key==='followup')buildFollowupReport(report,root);
 else if(key==='reports')buildReportsCenter(report,root);
 else buildStandardReport(report,root);
 if(!report.querySelector('.vd-report-v2-page'))buildCover(report,[]);
 appendPageNumbers(report);return report;
}
function reportName(){const meta=window.VDUrgent?.PAGE_META?.[pageKey()]||{},n=window.VDUrgent?.reportName?.(meta.title||pageKey());return n||('VD_UrgentSolutions_'+Date.now())}
function teardown(){document.body.classList.remove('vd-report-v2-mode');document.getElementById(REPORT_ID)?.remove()}
function print(){
 closePreview();build();const old=document.title;document.title=reportName();document.body.classList.add('vd-report-v2-mode');
 const done=()=>{window.removeEventListener('afterprint',done);document.title=old;teardown()};window.addEventListener('afterprint',done);
 setTimeout(()=>window.print(),220);
}
function ensurePreview(){
 let o=document.getElementById(PREVIEW_ID);if(o)return o;
 o=document.createElement('div');o.id=PREVIEW_ID;o.className='vd-report-preview-overlay';
 o.innerHTML='<div class="vd-report-preview-shell"><div class="vd-report-preview-toolbar"><b>معاينة التقرير قبل التصدير</b><div><button type="button" data-close>إغلاق</button><button type="button" class="print" data-print>تصدير PDF</button></div></div><div class="vd-report-preview-stage"></div></div>';
 document.body.appendChild(o);o.querySelector('[data-close]').onclick=closePreview;o.querySelector('[data-print]').onclick=print;o.addEventListener('click',e=>{if(e.target===o)closePreview()});return o;
}
function preview(){closePreview();const o=ensurePreview(),report=build(),stage=o.querySelector('.vd-report-preview-stage');stage.innerHTML='';stage.appendChild(report);o.classList.add('show')}
function closePreview(){const o=document.getElementById(PREVIEW_ID);if(o){o.classList.remove('show');o.querySelector('.vd-report-preview-stage')?.replaceChildren()}document.getElementById(REPORT_ID)?.remove()}

window.VDReportExport={print,preview,build,closePreview};
})();