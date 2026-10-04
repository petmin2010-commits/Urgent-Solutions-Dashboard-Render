(()=>{'use strict';
const REPORT_ID='vdReportV2',PREVIEW_ID='vdReportPreviewOverlay';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
const chunk=(arr,size)=>{const out=[];for(let i=0;i<arr.length;i+=size)out.push(arr.slice(i,i+size));return out};
function state(){return window.VDUrgent?.getState?.()||{}}
function pageName(){const s=state(),meta=window.VDUrgent?.PAGE_META?.[s.page];return meta?.title||document.getElementById('pageTitle')?.textContent?.trim()||'تقرير الداشبورد'}
function brand(){return {project:'إدارة الحلول العاجلة',city:'أمانة محافظة جدة • مشاريع المياه',contractText:'شركة أبعاد الرؤية للاستشارات الهندسية'}}
function visible(el){if(!el)return false;let n=el;while(n&&n!==document.body){const st=getComputedStyle(n);if(n.hidden||st.display==='none'||st.visibility==='hidden')return false;n=n.parentElement}return true}
function filters(){
 const out=[];document.querySelectorAll('#activeFilters .filter-chip b:first-child').forEach(x=>{const t=clean(x.textContent);if(t)out.push(t)});
 const p=clean(document.getElementById('periodSummaryMain')?.textContent);if(p&&p!=='كامل المدة'&&p!=='كامل البيانات')out.push('الفترة: '+p);
 return [...new Set(out)];
}
function cleanup(root){
 root.querySelectorAll('button,.vd-info-btn,.table-search,.mf-pop,.map-legend').forEach(x=>x.remove());
 root.querySelectorAll('input,select,textarea').forEach(el=>{const span=document.createElement('span');span.className='vd-report-static-value';span.textContent=el.options?.[el.selectedIndex]?.textContent||el.value||'';el.replaceWith(span)});
}
function cloneWithCharts(source){
 const clone=source.cloneNode(true),src=[...source.querySelectorAll('canvas')],dst=[...clone.querySelectorAll('canvas')];
 src.forEach((canvas,i)=>{const c=dst[i];if(!c)return;try{
   const chart=window.Chart?.getChart?.(canvas);chart?.stop?.();chart?.update?.('none');
   const img=document.createElement('img');img.className='vd-report-chart-image';img.src=canvas.toDataURL('image/png',1);img.alt='Chart';
   c.replaceWith(img);
   if(chart?.config?.type==='doughnut'){
     clone.classList.add('vd-report-doughnut-card');
     const legend=document.createElement('div');legend.className='vd-report-doughnut-legend';
     const labels=Array.isArray(chart.data?.labels)?chart.data.labels:[],ds=chart.data?.datasets?.[0]||{},colors=Array.isArray(ds.backgroundColor)?ds.backgroundColor:labels.map(()=>ds.backgroundColor||'#64748b');
     labels.forEach((label,j)=>{const item=document.createElement('span');item.className='vd-report-doughnut-legend-item';item.innerHTML='<i style="background:'+esc(colors[j]||'#64748b')+'"></i><b>'+esc(label)+'</b>';legend.appendChild(item)});
     img.insertAdjacentElement('afterend',legend);
   }
 }catch(_){c.remove()}});
 cleanup(clone);return clone;
}
function createPage(title,subtitle='',cls=''){
 const b=brand(),p=document.createElement('section');p.className=('vd-report-v2-page '+cls).trim();
 p.innerHTML='<header class="vd-report-section-header"><div><span>VISION DIMENSIONS</span><h2>'+esc(title)+'</h2><div class="vd-report-page-identity"><b>'+esc(pageName())+'</b><span>'+esc(b.project)+' • '+esc(b.city)+'</span></div></div>'+(subtitle?'<p>'+esc(subtitle)+'</p>':'')+'</header><div class="vd-report-section-body"></div><div class="vd-report-page-stamp">'+esc(pageName())+' • '+new Date().toLocaleString('ar-SA')+'</div><footer class="vd-report-footer"><span>Vision Dimensions</span><span>شركة أبعاد الرؤية للاستشارات الهندسية</span><span>'+esc(b.project)+'</span></footer>';
 return p;
}
function buildCover(report,kpis){
 const b=brand(),fs=filters(),now=new Date(),p=document.createElement('section');p.className='vd-report-v2-page vd-report-cover';
 p.innerHTML='<div class="vd-report-cover-top"><div class="vd-report-cover-brand"><img src="/assets/vision-dimensions-makkah.png" alt="Vision Dimensions"><div><strong>شركة أبعاد الرؤية للاستشارات الهندسية</strong><span>VISION DIMENSIONS ENGINEERING CONSULTANCY</span></div></div><div class="vd-report-cover-badge">تقرير فني</div></div><div class="vd-report-cover-title"><small>'+esc(b.project)+'</small><h1>'+esc(pageName())+'</h1><p>'+esc(b.city)+'</p><strong>'+esc(b.contractText)+'</strong></div><div class="vd-report-cover-meta"><div><span>تاريخ التقرير</span><b>'+now.toLocaleDateString('ar-SA')+'</b></div><div><span>وقت الإصدار</span><b>'+now.toLocaleTimeString('ar-SA',{hour:'2-digit',minute:'2-digit'})+'</b></div><div><span>الفلاتر</span><b>'+(fs.length?fs.length+' فلتر مطبق':'جميع البيانات')+'</b></div></div><div class="vd-report-cover-kpis"></div>'+(fs.length?'<div class="vd-report-cover-filters"><strong>الفلاتر المطبقة</strong><div>'+fs.map(x=>'<span>'+esc(x)+'</span>').join('')+'</div></div>':'')+'<div class="vd-report-cover-footer">VISION DIMENSIONS</div>';
 const g=p.querySelector('.vd-report-cover-kpis');kpis.slice(0,6).forEach(k=>{const c=k.cloneNode(true);cleanup(c);c.classList.add('vd-report-kpi-clone');g.appendChild(c)});report.appendChild(p);
}
function panelTitle(panel,fallback){return clean(panel.querySelector('.panel-head b,.table-tools b,h1,h2,h3')?.textContent)||fallback}
function buildKpis(report,kpis){if(!kpis.length)return;chunk(kpis,20).forEach((grp,i)=>{const p=createPage('المؤشرات الرئيسية',grp.length+' مؤشر','vd-report-kpi-page'),g=document.createElement('div');g.className='vd-report-kpi-grid';grp.forEach(k=>{const c=k.cloneNode(true);cleanup(c);c.classList.add('vd-report-kpi-clone');g.appendChild(c)});p.querySelector('.vd-report-section-body').appendChild(g);report.appendChild(p)})}
function buildCharts(report,panels){chunk(panels,4).forEach((grp,i)=>{const p=createPage('التحليلات والرسوم البيانية',panels.length>4?'صفحة '+(i+1):'التحليلات المرئية','vd-report-chart-page'),g=document.createElement('div');g.className='vd-report-chart-grid';grp.forEach(x=>{const c=cloneWithCharts(x);c.classList.add('vd-report-chart-card');g.appendChild(c)});p.querySelector('.vd-report-section-body').appendChild(g);report.appendChild(p)})}
function buildTables(report,panels){
 panels.forEach(panel=>{const rows=[...panel.querySelectorAll('tbody tr')].filter(visible),groups=rows.length?chunk(rows,22):[[]],title=panelTitle(panel,'جدول البيانات');
  groups.forEach((grp,i)=>{const p=createPage(title,groups.length>1?'صفحة '+(i+1)+' من '+groups.length:'ملخص البيانات','vd-report-table-page'),c=panel.cloneNode(true);cleanup(c);
   const body=c.querySelector('tbody');if(body&&rows.length){body.innerHTML='';grp.forEach(r=>{const idx=rows.indexOf(r),srcRows=[...panel.querySelectorAll('tbody tr')].filter(visible),rowClone=srcRows[idx]?.cloneNode(true);if(rowClone)body.appendChild(rowClone)})}
   c.classList.add('vd-report-summary-table');p.querySelector('.vd-report-section-body').appendChild(c);report.appendChild(p);
  });
 });
}
function buildMisc(report,host,used){
 const extras=[...host.children].filter(x=>visible(x)&&!used.has(x)&&!x.classList.contains('kpi-grid')&&!x.classList.contains('chart-grid'));
 extras.forEach((x,i)=>{if(x.matches('.table-panel,.panel')||x.querySelector('table,canvas'))return;const p=createPage(panelTitle(x,'تفاصيل إضافية'),'محتوى الشاشة الحالية','vd-report-misc-page');p.querySelector('.vd-report-section-body').appendChild(cloneWithCharts(x));report.appendChild(p)});
}
function build(){
 document.getElementById(REPORT_ID)?.remove();const host=document.getElementById('pageHost'),report=document.createElement('div');report.id=REPORT_ID;report.className='vd-report-v2';document.body.appendChild(report);if(!host)return report;
 const kpis=[...host.querySelectorAll('.kpi-card')].filter(visible),charts=[...host.querySelectorAll('.panel')].filter(x=>visible(x)&&x.querySelector('canvas')),tables=[...host.querySelectorAll('.table-panel')].filter(visible),used=new Set([...kpis.map(x=>x.parentElement),...charts,...tables]);
 buildCover(report,kpis);buildKpis(report,kpis);buildCharts(report,charts);buildTables(report,tables);buildMisc(report,host,used);return report;
}
function reportName(){const meta=window.VDUrgent?.PAGE_META?.[state().page]||{},n=window.VDUrgent?.reportName?.(meta.title||state().page);return n||('VD_UrgentSolutions_'+Date.now())}
function teardown(){document.body.classList.remove('vd-report-v2-mode');document.getElementById(REPORT_ID)?.remove()}
function print(){
 closePreview();build();const old=document.title;document.title=reportName();document.body.classList.add('vd-report-v2-mode');
 const done=()=>{window.removeEventListener('afterprint',done);document.title=old;teardown()};window.addEventListener('afterprint',done);
 setTimeout(()=>window.print(),180);
}
function ensurePreview(){
 let o=document.getElementById(PREVIEW_ID);if(o)return o;o=document.createElement('div');o.id=PREVIEW_ID;o.className='vd-report-preview-overlay';o.innerHTML='<div class="vd-report-preview-shell"><div class="vd-report-preview-toolbar"><b>معاينة التقرير قبل التصدير</b><div><button type="button" data-close>إغلاق</button><button type="button" class="print" data-print>تصدير PDF</button></div></div><div class="vd-report-preview-stage"></div></div>';document.body.appendChild(o);o.querySelector('[data-close]').onclick=closePreview;o.querySelector('[data-print]').onclick=print;o.addEventListener('click',e=>{if(e.target===o)closePreview()});return o;
}
function preview(){closePreview();const o=ensurePreview(),report=build(),stage=o.querySelector('.vd-report-preview-stage');stage.innerHTML='';stage.appendChild(report);o.classList.add('show')}
function closePreview(){const o=document.getElementById(PREVIEW_ID);if(o){o.classList.remove('show');o.querySelector('.vd-report-preview-stage')?.replaceChildren()}document.getElementById(REPORT_ID)?.remove()}
window.VDReportExport={print,preview,build,closePreview};
})();