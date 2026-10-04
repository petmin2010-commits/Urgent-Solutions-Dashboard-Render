(()=>{'use strict';
let mounted='';
function box(){
 const host=document.querySelector('#pageHost');if(!host)return null;
 let el=document.querySelector('#vdSmartParity');if(el)return el;
 el=document.createElement('section');el.id='vdSmartParity';el.className='vd-smart-parity';
 el.innerHTML='<div class="vd-smart-head"><div><small>SMART ANALYTICS</small><h3>التحليل الذكي المساعد</h3><p>تحليل تشغيلي آلي للمؤشرات والمخاطر والإجراءات.</p></div><button type="button" id="vdAiRun">تحليل الآن</button></div><div class="vd-smart-grid"><article><b>الموقف الحالي</b><div id="vdAiCurrent">—</div></article><article><b>أهم المخاطر</b><div id="vdAiRisks">—</div></article><article><b>الإجراء المقترح</b><div id="vdAiActions">—</div></article><article><b>ماذا تغير منذ آخر قراءة</b><div id="vdAiChanges">—</div></article></div>';
 host.prepend(el);el.querySelector('#vdAiRun').onclick=run;return el;
}
async function run(){
 const el=box();if(!el)return;const btn=el.querySelector('#vdAiRun');btn.disabled=true;btn.textContent='جاري التحليل...';
 try{
  const st=window.VDUrgent?.getState?.()||{},data=st.data||window.__urgentDashboardData||{};
  const r=await fetch('/api/ai/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({page:st.page,summary:data.summaries||{},management:data.management||{}})});
  const j=await r.json(),x=j.analysis||{};
  el.querySelector('#vdAiCurrent').textContent=x.current||j.text||'لا توجد ملاحظات';
  el.querySelector('#vdAiRisks').textContent=x.risks||'لا توجد مخاطر حرجة ظاهرة';
  el.querySelector('#vdAiActions').textContent=x.actions||'استمرار المتابعة والتحديث الدوري';
  const current=data.summaries||{},key='vd.urgent.smart.baseline',previous=JSON.parse(localStorage.getItem(key)||'null');
  if(previous){const labels={projects:'المشاريع',actualPermits:'التصاريح',permitMeters:'أمتار التصاريح',lines:'الخطوط',lineMeters:'أمتار الخطوط',highRiskProjects:'المخاطر العالية',qualityIssues:'ملاحظات الجودة'};const changes=Object.keys(labels).map(k=>({k,d:Number(current[k]||0)-Number(previous[k]||0)})).filter(x=>x.d!==0);el.querySelector('#vdAiChanges').textContent=changes.length?changes.map(c=>labels[c.k]+' '+(c.d>0?'↑ +':'↓ ')+c.d).join(' • '):'لا تغيرات رقمية في المؤشرات الرئيسية منذ آخر قراءة.'}else el.querySelector('#vdAiChanges').textContent='تم إنشاء خط الأساس الأول للمقارنة.';
  localStorage.setItem(key,JSON.stringify(current));
 }catch(e){el.querySelector('#vdAiCurrent').textContent='تعذر تشغيل التحليل: '+e.message}
 finally{btn.disabled=false;btn.textContent='تحليل الآن'}
}
function onPage(){const page=window.VDUrgent?.getState?.()?.page||'';if(!['analytics','risks','master'].includes(page))return;box();if(mounted!==page){mounted=page;run()}}
window.addEventListener('vd:page-rendered',onPage);document.addEventListener('DOMContentLoaded',onPage);
})();