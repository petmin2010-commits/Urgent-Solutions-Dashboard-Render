(()=>{'use strict';

const GROUPS=[
 {title:'التقارير التشغيلية',subtitle:'المشاريع والتصاريح والتنفيذ والمتابعة الميدانية',items:[
  ['master','تقرير اللوحة الرئيسية','◉'],['projects','تقرير المشاريع','▣'],['map','تقرير الخريطة الجغرافية','⌖'],
  ['permits','تقرير التصاريح','▤'],['lines','تقرير الخطوط البديلة والتصميم','⌁'],['settlements','تقرير الأمتار والتسويات','⇄'],
  ['guarantees','تقرير الضمانات','◇'],['complaints','تقرير الشكاوى','!'],['execution','تقرير التنفيذ والتسليم','✓']
 ]},
 {title:'الإدارة والجودة',subtitle:'الجهات والبلديات والتتبع وجودة البيانات',items:[
  ['parties','تقرير المقاولين والملاك','♙'],['municipalities','تقرير تحليل البلديات','⌂'],
  ['traceability','تقرير التتبع الشامل','⛓'],['quality','تقرير جودة البيانات','◎']
 ]},
 {title:'التحليل الذكي',subtitle:'المخاطر والذاكرة والتدقيق والقرار والتقرير الهندسي',items:[
  ['risks','تقرير مخاطر المشاريع','⚠'],['analytics','تقرير التحليل التنفيذي','⌁'],
  ['smartCenter','تقرير مركز التحليل الذكي','◆'],['temporalMemory','تقرير ذاكرة المشروع الزمنية','◷'],
  ['investigationRoom','تقرير غرفة التدقيق الذكية','◉'],['explainableDecision','تقرير مختبر القرار المتغير','⌘'],
  ['smartThursday','التقرير الهندسي الذكي','▣']
 ]}
];

const delay=ms=>new Promise(r=>setTimeout(r,ms));
const state=()=>window.VDUrgent?.getState?.();
const meta=()=>window.VDUrgent?.PAGE_META||{};
const navFor=key=>document.querySelector('#nav .nav-item[data-page="'+key+'"]');
const available=key=>!!navFor(key);

function cloneSetMap(map){
 const out=new Map();
 if(map&&typeof map.forEach==='function')map.forEach((v,k)=>out.set(k,v instanceof Set?new Set(v):v&&typeof v==='object'?{...v}:v));
 return out;
}
function restoreMap(target,snapshot){
 if(!target||typeof target.clear!=='function')return;
 target.clear();snapshot.forEach((v,k)=>target.set(k,v instanceof Set?new Set(v):v&&typeof v==='object'?{...v}:v));
}
function filterSnapshot(){
 const st=state()||{};
 return {filters:cloneSetMap(st.filters),interactive:cloneSetMap(st.interactiveFilters),periods:cloneSetMap(st.periods)};
}
function clearFiltersForGeneral(){
 const st=state()||{};
 st.filters?.clear?.();st.interactiveFilters?.clear?.();st.periods?.clear?.();
}
function restoreFilters(s){
 const st=state()||{};
 restoreMap(st.filters,s.filters);restoreMap(st.interactiveFilters,s.interactive);restoreMap(st.periods,s.periods);
}
async function waitPage(key){
 for(let i=0;i<35;i++){if(state()?.page===key&&navFor(key)?.classList.contains('active'))return true;await delay(120)}
 return state()?.page===key;
}
async function exportGeneral(key,button){
 if(!available(key)||!window.VDUrgent)return;
 const original=button.textContent,snap=filterSnapshot(),scope=window.__VD_REPORT_SCOPE_OVERRIDE;
 button.disabled=true;button.textContent='جاري تجهيز التقرير...';
 window.__VD_REPORT_SCOPE_OVERRIDE='General';
 clearFiltersForGeneral();window.VDUrgent.openPage(key);await waitPage(key);await delay(260);
 let done=false;
 const finish=()=>{
  if(done)return;done=true;restoreFilters(snap);
  if(scope===undefined)delete window.__VD_REPORT_SCOPE_OVERRIDE;else window.__VD_REPORT_SCOPE_OVERRIDE=scope;
  button.disabled=false;button.textContent=original;
  setTimeout(()=>window.VDUrgent?.openPage?.('reports'),100);
 };
 window.addEventListener('afterprint',finish,{once:true});
 try{window.VDUrgent.printCurrent?.()}catch(e){console.error(e);finish()}
 setTimeout(finish,7000);
}
function render(){
 const st=state(),host=document.querySelector('#pageHost');
 if(!st||st.page!=='reports'||!host)return;
 const groups=GROUPS.map(g=>{
  const items=g.items.filter(([k])=>available(k));
  if(!items.length)return '';
  return '<section class="rc-group"><div class="rc-group-head"><div><h3>'+g.title+'</h3><p>'+g.subtitle+'</p></div><span>'+items.length+' تقارير</span></div><div class="rc-grid">'+
   items.map(([key,label,icon])=>'<article class="rc-card"><div class="rc-card-icon">'+icon+'</div><div class="rc-card-copy"><strong>'+label+'</strong><small>المصدر: '+((meta()[key]?.title)||key)+'</small></div><div class="rc-card-actions"><button type="button" class="rc-open-btn" data-open="'+key+'">معاينة</button><button type="button" class="rc-export-btn" data-export="'+key+'">تصدير PDF</button></div></article>').join('')+
  '</div></section>';
 }).join('');
 const total=GROUPS.reduce((n,g)=>n+g.items.filter(([k])=>available(k)).length,0);
 host.innerHTML='<section id="vdReportHub" class="vd-report-hub"><div class="rc-hero"><div><span>VISION DIMENSIONS • REPORT CENTER</span><h2>مركز التقارير</h2><p>مركز موحد على منطق جدة: معاينة التقرير أو إنشاء تقرير عام PDF بعد تصفير الفلاتر مؤقتًا ثم استعادتها تلقائيًا.</p></div><div class="rc-total"><b>'+total+'</b><span>تقرير متاح</span></div></div><div class="rc-export-note">التصدير من هذا المركز «عام» بدون الفلاتر الحالية. التصدير من داخل أي تاب يحترم الفلاتر النشطة في ذلك التاب.</div>'+groups+'</section>';
 host.querySelectorAll('[data-open]').forEach(b=>b.addEventListener('click',()=>window.VDUrgent?.openPage?.(b.dataset.open)));
 host.querySelectorAll('[data-export]').forEach(b=>b.addEventListener('click',()=>exportGeneral(b.dataset.export,b)));
}
window.renderUrgentReportsCenter=render;
window.addEventListener('vd:page-rendered',render);
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',()=>setTimeout(render,100),{once:true}):setTimeout(render,100);
})();
