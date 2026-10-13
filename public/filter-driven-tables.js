(()=>{
'use strict';

const PAGE_GROUPS={
 master:['نوع التنبيه','الأهمية'],
 projects:['البلدية','المقاول','المالك','المخاطر','حالة العقد','حالة التصريح'],
 map:['البلدية','المقاول','المالك','حالة التصريح'],
 permits:['البلدية','المقاول','المالك','الحالة','حالة العقد'],
 lines:['المصمم','المقاول','المالك','حالة التصميم','النوع'],
 settlements:['المقاول','المالك','الحالة','نطاق التغطية'],
 guarantees:['المقاول','المالك','الحالة','مخاطر المشروع'],
 complaints:['الحالة'],
 execution:['المقاول','النوع','حالة التنفيذ'],
 traceability:['البلدية','المقاول','المالك','المخاطر','طريقة الربط'],
 quality:['المصدر','التصنيف','الأهمية'],
 risks:['البلدية','المقاول','المالك','المستوى'],
 analytics:['البلدية','المقاول','المالك','المستوى']
};

const PAGE_SUMS={
 projects:['أمتار التصاريح','الأمتار'],
 map:['أمتار التصاريح','الأمتار'],
 permits:['الأمتار'],
 lines:['طول الخط','طول التصميم'],
 settlements:['المستحق','الخطوط','الرصيد النهائي','الفجوة'],
 guarantees:[],
 complaints:[],
 execution:[],
 traceability:['أمتار التصاريح','أمتار الخطوط'],
 quality:[],
 risks:['فجوة مطابقة'],
 analytics:['تغطية مطابقة %']
};

const EXCLUDED=new Set(['reports','excelExport']);

const PAGE_DATASETS={
 master:['projects','actualPermits','lines','settlements'],
 projects:['projects'],map:['projects','lines'],permits:['actualPermits'],lines:['lines'],
 settlements:['settlements'],guarantees:['projects'],complaints:['complaints'],execution:['lines'],
 parties:['projects','lines'],municipalities:['municipalitySummary'],traceability:['traceability'],
 quality:['quality'],risks:['projects'],analytics:['projects','actualPermits','lines','settlements'],
 smartCenter:['projects','actualPermits','lines','settlements','quality'],
 temporalMemory:['projects','actualPermits','lines'],investigationRoom:['projects','actualPermits','lines','quality'],
 explainableDecision:['projects','actualPermits','lines','quality'],
 smartThursday:['projects','actualPermits','lines','settlements'],
 followup:['projects','actualPermits','lines']
};
const SOURCE_FIELDS={
 projects:{title:'المشاريع',fields:[['no','رقم المشروع'],['name','اسم المشروع'],['municipality','البلدية'],['contractor','المقاول'],['owner','المالك'],['projectType','نوع المشروع'],['contractStatus','حالة العقد'],['permitStatus','حالة التصريح'],['permitMeters','أمتار التصاريح'],['guaranteeStatus','حالة الضمان'],['riskLevel','المخاطر'],['riskScore','درجة المخاطر'],['matchedBalance','فجوة مطابقة']]},
 actualPermits:{title:'التصاريح الفعلية',fields:[['id','رقم التصريح'],['projectNo','رقم المشروع'],['projectName','اسم المشروع'],['municipality','البلدية'],['contractor','المقاول'],['owner','المالك'],['start','تاريخ البداية'],['end','تاريخ النهاية'],['expiryBand','حالة الانتهاء'],['expiryDays','الأيام المتبقية'],['meters','الأمتار'],['contractStatus','حالة العقد']]},
 lines:{title:'الخطوط البديلة',fields:[['ref','مرجع الخط'],['name','اسم الخط'],['municipality','البلدية'],['contractor','المقاول'],['owner','المالك'],['type','النوع'],['length','طول الخط'],['designLength','طول التصميم'],['designer','المصمم'],['designStatus','حالة التصميم'],['executionStatus','حالة التنفيذ'],['approvalDate','تاريخ الاعتماد']]},
 settlements:{title:'الأمتار والتسويات',fields:[['owner','المالك'],['contractor','المقاول'],['dueMeters','المستحق'],['executedMeters','الخطوط'],['balance','الرصيد النهائي'],['status','الحالة'],['coveragePct','نسبة التغطية'],['coverageBand','نطاق التغطية']]},
 complaints:{title:'الشكاوى',fields:[['text','الشكوى'],['status','الحالة'],['link','الحل/الخط المقابل']]},
 municipalitySummary:{title:'ملخص البلديات',fields:[['municipality','البلدية'],['projects','عدد المشاريع'],['permitMeters','أمتار التصاريح'],['lines','عدد الخطوط'],['lineMeters','أمتار الخطوط'],['grossCoveragePct','نسبة التغطية'],['criticalProjects','مشاريع عالية المخاطر'],['pendingDesign','تصاميم قيد المتابعة']]},
 traceability:{title:'التتبع الشامل',fields:[['no','رقم المشروع'],['name','اسم المشروع'],['municipality','البلدية'],['contractor','المقاول'],['owner','المالك'],['riskLevel','المخاطر'],['permitCount','عدد التصاريح'],['permitMeters','أمتار التصاريح'],['lineCount','عدد الخطوط'],['lineMeters','أمتار الخطوط'],['matchMethod','طريقة الربط']]},
 quality:{title:'ملاحظات الجودة',fields:[['source','المصدر'],['category','التصنيف'],['severity','الأهمية'],['row','صف المصدر'],['message','الملاحظة']]}
};
const PAGE_DATA_GROUPS={
 master:['البلدية','المقاول','المالك'],parties:['المقاول','المالك'],
 municipalities:['البلدية'],followup:['البلدية','المقاول','المالك'],
 smartCenter:['البلدية','المقاول','المالك'],temporalMemory:['البلدية','المقاول','المالك'],
 investigationRoom:['البلدية','المقاول','المالك'],explainableDecision:['البلدية','المقاول','المالك'],
 smartThursday:['البلدية','المقاول','المالك']
};
const PAGE_DATA_SUMS={
 master:['أمتار التصاريح','الأمتار','طول الخط','المستحق','الخطوط'],
 parties:['أمتار التصاريح','طول الخط'],municipalities:['عدد المشاريع','أمتار التصاريح','أمتار الخطوط'],
 smartCenter:['أمتار التصاريح','الأمتار','طول الخط'],temporalMemory:['أمتار التصاريح','الأمتار'],
 investigationRoom:['أمتار التصاريح','الأمتار'],explainableDecision:['أمتار التصاريح','الأمتار'],
 smartThursday:['أمتار التصاريح','الأمتار','طول الخط'],followup:['أمتار التصاريح','الأمتار','طول الخط']
};
const currentDatasetByPage=new Map();
function rawModels(page){
 const api=window.VDUrgent,st=api?.getState?.(),data=st?.data||{};
 return (PAGE_DATASETS[page]||[]).filter(key=>Array.isArray(data[key])).map(key=>{
  const original=data[key],spec=SOURCE_FIELDS[key];
  let scoped=[];
  try{scoped=api?.filterRows?.(original)||[];}catch(e){console.error('[VD TABLES] scoped filter',key,e);}
  const fields=spec.fields.filter(([k])=>scoped.some(r=>Object.prototype.hasOwnProperty.call(r,k)));
  const headers=fields.length?fields.map(x=>x[1]):spec.fields.slice(0,6).map(x=>x[1]);
  const selected=fields.length?fields:spec.fields.slice(0,6);
  const rows=scoped.map(raw=>{
   const record={};
   selected.forEach(([field,label])=>record[label]=Array.isArray(raw?.[field])?raw[field].join(' • '):String(raw?.[field]??''));
   return record;
  });
  return {key,title:spec.title,allCount:original.length,headers,rows};
 });
}


function esc(v){
 return String(v==null?'':v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
function norm(v){
 return String(v==null?'':v).replace(/\s+/g,' ').trim().normalize('NFKC')
  .replace(/[\u064B-\u065F\u0670]/g,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').toLowerCase();
}
function num(v){
 const s=String(v==null?'':v).replace(/[,٬]/g,'').replace(/٫/g,'.').replace(/%/g,'').replace(/[^0-9+\-.]/g,'');
 const n=Number(s);return Number.isFinite(n)?n:0;
}
function fmt(v){
 return new Intl.NumberFormat('en-US',{maximumFractionDigits:1}).format(Number(v)||0);
}
function currentPage(){
 return String(window.__urgentCurrentPage||document.querySelector('.nav-item.active')?.dataset?.page||'master');
}
function sourceTables(host){
 return [...host.querySelectorAll('.table-panel table')].filter(t=>!t.closest('.vd-filter-driven-tables'));
}
function tableModel(table){
 const headers=[...table.querySelectorAll('thead th')].map(th=>th.textContent.trim());
 const rows=[...table.querySelectorAll('tbody tr')].map(tr=>{
  const vals=[...tr.children].map(td=>td.textContent.replace(/\s+/g,' ').trim());
  const o={};headers.forEach((h,i)=>o[h]=vals[i]??'');return o;
 });
 return {headers,rows};
}
function chooseSource(host,page){
 const tables=sourceTables(host);if(!tables.length)return null;
 const preferred=tables.map(t=>({t,m:tableModel(t)})).filter(x=>x.m.rows.length);
 if(!preferred.length)return null;
 const groups=PAGE_GROUPS[page]||[];
 preferred.sort((a,b)=>{
  const am=groups.filter(g=>a.m.headers.includes(g)).length;
  const bm=groups.filter(g=>b.m.headers.includes(g)).length;
  if(bm!==am)return bm-am;
  return b.m.rows.length-a.m.rows.length;
 });
 return preferred[0].m;
}
function aggregate(rows,group,metrics){
 const map=new Map();
 rows.forEach(r=>{
  const key=(r[group]||'غير محدد').trim()||'غير محدد';
  if(!map.has(key))map.set(key,{name:key,count:0,sums:{}});
  const x=map.get(key);x.count++;
  metrics.forEach(m=>x.sums[m]=(x.sums[m]||0)+num(r[m]));
 });
 return [...map.values()].sort((a,b)=>b.count-a.count||String(a.name).localeCompare(String(b.name),'ar'));
}
function pivotPanel(group,rows,metrics){
 const id='vdft_'+Math.random().toString(36).slice(2);
 const data=aggregate(rows,group,metrics);
 const heads=['القيمة','عدد السجلات',...metrics];
 return '<section class="table-panel vd-filter-pivot">'+
  '<div class="table-tools"><b>ملخص حسب '+esc(group)+' <span>('+data.length+')</span></b>'+
  '<input class="vd-filter-pivot-search" data-table="'+id+'" type="search" placeholder="بحث داخل الملخص..."></div>'+
  '<div class="table-scroll"><table id="'+id+'"><thead><tr>'+heads.map(h=>'<th>'+esc(h)+'</th>').join('')+'</tr></thead><tbody>'+
  data.map(x=>'<tr><td>'+esc(x.name)+'</td><td>'+fmt(x.count)+'</td>'+metrics.map(m=>'<td>'+fmt(x.sums[m])+'</td>').join('')+'</tr>').join('')+
  '</tbody></table></div></section>';
}
function priorityPanel(model){
 const keywords=/حرج|مرتفع|منتهي|اوشك|أوشك|بانتظار|بدون|غير مسجل|غير مرتبط|خطأ|متقادم|تحتاج/i;
 const rows=model.rows.filter(r=>Object.values(r).some(v=>keywords.test(String(v)))).slice(0,80);
 if(!rows.length)return '';
 const cols=model.headers.slice(0,Math.min(model.headers.length,9));
 const id='vdft_'+Math.random().toString(36).slice(2);
 return '<section class="table-panel vd-filter-pivot vd-filter-priority">'+
  '<div class="table-tools"><b>السجلات ذات الأولوية داخل النتائج الحالية <span>('+rows.length+')</span></b>'+
  '<input class="vd-filter-pivot-search" data-table="'+id+'" type="search" placeholder="بحث داخل الأولويات..."></div>'+
  '<div class="table-scroll"><table id="'+id+'"><thead><tr>'+cols.map(h=>'<th>'+esc(h)+'</th>').join('')+'</tr></thead><tbody>'+
  rows.map(r=>'<tr>'+cols.map(h=>'<td>'+esc(r[h]||'—')+'</td>').join('')+'</tr>').join('')+
  '</tbody></table></div></section>';
}
function wireSearch(scope){
 scope.querySelectorAll('.vd-filter-pivot-search').forEach(inp=>inp.addEventListener('input',()=>{
  const q=norm(inp.value),table=document.getElementById(inp.dataset.table);if(!table)return;
  table.querySelectorAll('tbody tr').forEach(tr=>tr.style.display=!q||norm(tr.textContent).includes(q)?'':'none');
 }));
}
function detailPanel(model){
 const id='vdft_detail_'+(++detailSerial);
 return '<section class="table-panel wide vd-filter-pivot vdft-detail-panel"><div class="table-tools"><b>البيانات التفصيلية المفلترة <span>('+fmt(model.rows.length)+')</span></b>'+
 '<div class="vdft-detail-tools"><input type="search" class="vdft-detail-search" data-table="'+id+'" placeholder="بحث في كامل النتائج..."><label>عدد الصفوف <select class="vdft-detail-size" data-table="'+id+'"><option>25</option><option>50</option><option>100</option></select></label></div></div>'+
 '<div class="table-scroll vdft-detail-scroll"><table id="'+id+'"><thead><tr>'+model.headers.map(h=>'<th>'+esc(h)+'</th>').join('')+'</tr></thead><tbody></tbody></table></div><div class="vdft-pagination" data-pager="'+id+'"></div></section>';
}
let detailSerial=0;
function wireDetail(scope,model){
 const input=scope.querySelector('.vdft-detail-search'),size=scope.querySelector('.vdft-detail-size');
 if(!input||!size)return;
 const table=scope.querySelector('#'+input.dataset.table),pager=scope.querySelector('[data-pager="'+input.dataset.table+'"]');
 let page=0,sortIndex=-1,ascending=true;
 const draw=()=>{
  const q=norm(input.value),all=model.rows.filter(r=>!q||model.headers.some(h=>norm(r[h]).includes(q)));
  if(sortIndex>=0)all.sort((a,b)=>{
   const h=model.headers[sortIndex],v1=String(a[h]??''),v2=String(b[h]??'');
   const x=Number(v1.replace(/[,٬]/g,'')),y=Number(v2.replace(/[,٬]/g,''));
   const cmp=v1.trim()&&v2.trim()&&Number.isFinite(x)&&Number.isFinite(y)?x-y:v1.localeCompare(v2,'ar',{numeric:true});
   return ascending?cmp:-cmp;
  });
  const per=Number(size.value)||25,pages=Math.max(1,Math.ceil(all.length/per));
  page=Math.min(page,pages-1);const start=page*per,visible=all.slice(start,start+per);
  table.querySelector('tbody').innerHTML=visible.map(r=>'<tr>'+model.headers.map(h=>'<td>'+esc(r[h]||'—')+'</td>').join('')+'</tr>').join('')||
   '<tr><td colspan="'+model.headers.length+'">لا توجد سجلات مطابقة للفلاتر والبحث</td></tr>';
  pager.innerHTML='<span>'+fmt(all.length)+' نتيجة — عرض '+(all.length?fmt(start+1):'0')+' إلى '+fmt(Math.min(start+per,all.length))+'</span>'+
   '<div><button type="button" data-vdft-prev '+(!page?'disabled':'')+'>السابق</button><b>صفحة '+fmt(page+1)+' / '+fmt(pages)+'</b><button type="button" data-vdft-next '+(page>=pages-1?'disabled':'')+'>التالي</button></div>';
  pager.querySelector('[data-vdft-prev]').onclick=()=>{page=Math.max(0,page-1);draw()};
  pager.querySelector('[data-vdft-next]').onclick=()=>{page=Math.min(pages-1,page+1);draw()};
 };
 input.addEventListener('input',()=>{page=0;draw()});
 size.addEventListener('change',()=>{page=0;draw()});
 table.querySelectorAll('thead th').forEach((th,i)=>{
  th.title='اضغط لترتيب العمود';th.classList.add('vdft-sort');
  th.addEventListener('click',()=>{ascending=sortIndex===i?!ascending:true;sortIndex=i;page=0;draw()});
 });
 draw();
}
function render(){
 const page=currentPage(),host=document.getElementById('pageHost');
 if(!host)return;
 host.querySelector('.vd-filter-driven-tables')?.remove();
 if(EXCLUDED.has(page)||!PAGE_DATASETS[page])return;
 const models=rawModels(page);
 if(!models.length)return;
 const chosen=models.find(m=>m.key===currentDatasetByPage.get(page))||models[0];
 currentDatasetByPage.set(page,chosen.key);
 const groups=(PAGE_DATA_GROUPS[page]||PAGE_GROUPS[page]||['البلدية','المقاول','المالك']).filter(k=>chosen.headers.includes(k)).slice(0,3);
 const metrics=(PAGE_DATA_SUMS[page]||PAGE_SUMS[page]||[]).filter(k=>chosen.headers.includes(k)).slice(0,2);
 const blocks=groups.map(g=>pivotPanel(g,chosen.rows,metrics));
 const priority=priorityPanel(chosen);if(priority)blocks.push(priority);
 const wrap=document.createElement('section');
 wrap.className='vd-filter-driven-tables';
 wrap.innerHTML='<section class="panel wide vd-filter-table-intro"><div class="panel-head"><div><b>جداول تفصيلية وتحليلية حسب الفلاتر الحالية</b><small>FILTER-DRIVEN TABLES • LIVE SOURCE</small></div>'+
  '<span>'+fmt(chosen.rows.length)+' سجل مطابق من '+fmt(chosen.allCount)+' — يتم احتساب كامل المصدر بعد فلاتر الصفحة والفترة الزمنية</span></div></section>'+
  '<div class="vdft-source-selector">'+models.map(m=>'<button type="button" data-vdft-dataset="'+esc(m.key)+'" class="'+(m.key===chosen.key?'active':'')+'">'+esc(m.title)+' <b>'+fmt(m.rows.length)+'</b></button>').join('')+'</div>'+
  detailPanel(chosen)+(blocks.length?'<div class="vd-filter-driven-grid">'+blocks.join('')+'</div>':'');
 host.appendChild(wrap);
 wrap.querySelectorAll('[data-vdft-dataset]').forEach(btn=>btn.addEventListener('click',()=>{currentDatasetByPage.set(page,btn.dataset.vdftDataset);render()}));
 wireDetail(wrap,chosen);wireSearch(wrap);
}
let timer=0;
function schedule(){clearTimeout(timer);timer=setTimeout(render,40)}
window.addEventListener('vd:page-rendered',schedule);
window.addEventListener('DOMContentLoaded',()=>setTimeout(render,700));
})();
