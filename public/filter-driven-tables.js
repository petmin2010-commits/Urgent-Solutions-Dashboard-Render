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

const EXCLUDED=new Set(['reports','excelExport','parties','municipalities']);

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
function render(){
 const page=currentPage(),host=document.getElementById('pageHost');if(!host)return;
 host.querySelector('.vd-filter-driven-tables')?.remove();
 if(EXCLUDED.has(page))return;
 const model=chooseSource(host,page);if(!model||!model.rows.length)return;
 const groups=(PAGE_GROUPS[page]||[]).filter(g=>model.headers.includes(g)).slice(0,3);
 if(!groups.length)return;
 const metrics=(PAGE_SUMS[page]||[]).filter(m=>model.headers.includes(m)).slice(0,2);
 const blocks=groups.map(g=>pivotPanel(g,model.rows,metrics));
 const priority=priorityPanel(model);if(priority)blocks.push(priority);
 const wrap=document.createElement('section');
 wrap.className='vd-filter-driven-tables';
 wrap.innerHTML='<section class="panel wide vd-filter-table-intro"><div class="panel-head"><div><b>جداول تحليلية حسب الفلتر الحالي</b><small>FILTER-DRIVEN TABLES</small></div><span>مبنية على '+fmt(model.rows.length)+' سجلًا من النتائج الحالية وتتحدث تلقائيًا مع الفلاتر والفترة</span></div></section>'+
  '<div class="vd-filter-driven-grid">'+blocks.join('')+'</div>';
 host.appendChild(wrap);wireSearch(wrap);
}
let timer=0;
function schedule(){clearTimeout(timer);timer=setTimeout(render,40)}
window.addEventListener('vd:page-rendered',schedule);
window.addEventListener('DOMContentLoaded',()=>setTimeout(render,700));
})();