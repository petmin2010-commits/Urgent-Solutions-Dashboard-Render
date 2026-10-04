(()=>{'use strict';
const pages=['master','projects','map','permits','lines','settlements','guarantees','complaints','execution','parties','municipalities','traceability','quality','risks','analytics'];
function mount(){
 const st=window.VDUrgent?.getState?.();if(!st||st.page!=='reports')return;const host=document.querySelector('#pageHost');if(!host||host.querySelector('#vdReportHub'))return;
 const meta=window.VDUrgent?.PAGE_META||{},el=document.createElement('section');el.id='vdReportHub';el.className='vd-report-hub';
 el.innerHTML='<header><div><small>STANDARD REPORT ENGINE</small><h3>مركز التقارير الموحد</h3><p>تسمية قياسية + الفلاتر الحالية + PDF + Excel.</p></div><button type="button" data-export-current>تصدير PDF</button></header><div class="vd-report-grid">'+pages.map(p=>'<button type="button" data-report-page="'+p+'"><span>'+((meta[p]?.icon)||'▣')+'</span><b>'+((meta[p]?.title)||p)+'</b><small>فتح التقرير</small></button>').join('')+'</div>';
 host.prepend(el);el.querySelector('[data-export-current]').onclick=()=>window.VDUrgent?.printCurrent?.();el.querySelectorAll('[data-report-page]').forEach(b=>b.onclick=()=>window.VDUrgent?.openPage?.(b.dataset.reportPage));
}
window.addEventListener('vd:page-rendered',mount);document.addEventListener('DOMContentLoaded',mount);
})();