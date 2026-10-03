(()=>{
'use strict';
const rootOf=p=>typeof p==='string'?document.querySelector(p):p;
const $=(s,p=document)=>rootOf(p)?.querySelector(s)||null;
const $$=(s,p=document)=>[...(rootOf(p)?.querySelectorAll(s)||[])];
const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const n=v=>Number(v||0);
const fmt=v=>new Intl.NumberFormat('en-US',{maximumFractionDigits:1}).format(n(v));
const clean=v=>String(v==null?'':v).replace(/\s+/g,' ').trim();
const norm=v=>clean(v).normalize('NFKC').replace(/[\u064B-\u065F\u0670]/g,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').toLowerCase();

const PAGE_META={
 master:{title:'الرئيسية',sub:'ملخص تنفيذي لحالة مشاريع الحلول العاجلة والتصاريح والخطوط البديلة.',icon:'◉',eye:'EXECUTIVE OVERVIEW'},
 projects:{title:'المشاريع',sub:'متابعة العقود والمشاريع والملاك والمقاولين وحالة التصاريح المرتبطة.',icon:'▣',eye:'PROJECTS CONTROL'},
 map:{title:'الخريطة الجغرافية',sub:'عرض مواقع مشاريع الحلول العاجلة في جدة اعتمادًا على إحداثيات E وN المسجلة بالشيت.',icon:'⌖',eye:'GEOGRAPHIC PROJECT VIEW'},
 permits:{title:'التصاريح',sub:'تحليل التصاريح الفعلية وتواريخها وأمتارها وحالات الانتهاء.',icon:'▤',eye:'PERMITS MANAGEMENT'},
 lines:{title:'الخطوط البديلة والتصميم',sub:'متابعة الخطوط البديلة وأطوالها والمصممين وحالة الاعتماد.',icon:'⌁',eye:'ALTERNATIVE LINES'},
 settlements:{title:'الأمتار والتسويات',sub:'مقارنة الأمتار المستحقة من التصاريح مع الخطوط البديلة المنفذة.',icon:'⇄',eye:'METERS SETTLEMENT'},
 guarantees:{title:'الضمانات',sub:'متابعة الضمانات والتعهدات وتواريخ الانتهاء والحالات الحرجة.',icon:'◇',eye:'GUARANTEES'},
 complaints:{title:'الشكاوى',sub:'متابعة سجل الشكاوى وربطها بالحلول والخطوط البديلة.',icon:'!',eye:'COMPLAINTS'},
 execution:{title:'التنفيذ والتسليم',sub:'متابعة حالة التنفيذ وتقارير الإتمام وخطابات التسليم.',icon:'✓',eye:'EXECUTION & HANDOVER'},
 parties:{title:'المقاولون والملاك',sub:'تحليل أحجام الأعمال والعلاقات بين المقاولين والملاك.',icon:'♙',eye:'PARTIES ANALYTICS'},
 quality:{title:'جودة البيانات',sub:'تدقيق ذكي للتعارضات والمراجع المفقودة والقيم غير الطبيعية.',icon:'◎',eye:'DATA QUALITY'},
 analytics:{title:'التحليل التنفيذي',sub:'قراءة إدارية مركزة لأبرز مؤشرات الأداء والمخاطر التشغيلية.',icon:'⌁',eye:'EXECUTIVE ANALYTICS'},
 reports:{title:'مركز التقارير',sub:'تصدير تقارير PDF وExcel بأسماء منظمة وفق الشاشة والفلاتر الحالية.',icon:'⇩',eye:'REPORTS CENTER'},
 excelExport:{title:'تصدير تقرير Excel',sub:'اختيار قاعدة البيانات والأعمدة والفلاتر ثم تصدير القيم النهائية فقط.',icon:'▧',eye:'EXCEL EXPORT'}
};
const FILTERS={
 master:[
  {field:'municipality',label:'البلدية'},{field:'contractor',label:'المقاول'},
  {field:'owner',label:'المالك'},{field:'projectType',label:'نوع المشروع'}
 ],
 projects:[
  {field:'municipality',label:'البلدية'},{field:'contractor',label:'المقاول'},
  {field:'owner',label:'المالك'},{field:'projectType',label:'نوع المشروع'},
  {field:'contractStatus',label:'حالة العقد'},{field:'permitStatus',label:'حالة التصريح'},
  {field:'guaranteeStatus',label:'حالة الضمان'}
 ],
 map:[
  {field:'municipality',label:'البلدية'},{field:'contractor',label:'المقاول'},
  {field:'owner',label:'المالك'},{field:'projectType',label:'نوع المشروع'},
  {field:'permitStatus',label:'حالة التصريح'}
 ],
 permits:[
  {field:'municipality',label:'البلدية'},{field:'contractor',label:'المقاول'},
  {field:'owner',label:'المالك'},{field:'year',label:'السنة'}
 ],
 lines:[
  {field:'municipality',label:'البلدية'},{field:'contractor',label:'المقاول'},
  {field:'owner',label:'المالك'},{field:'designer',label:'المصمم'},
  {field:'type',label:'نوع الخط'},{field:'designStatus',label:'حالة التصميم'},
  {field:'year',label:'سنة التكليف'}
 ],
 settlements:[
  {field:'contractor',label:'المقاول'},{field:'owner',label:'المالك'},{field:'status',label:'حالة التسوية'}
 ],
 guarantees:[
  {field:'guaranteeStatus',label:'حالة الضمان'},{field:'contractor',label:'المقاول'},
  {field:'owner',label:'المالك'},{field:'municipality',label:'البلدية'}
 ],
 complaints:[{field:'status',label:'حالة الشكوى'}],
 execution:[
  {field:'executionStatus',label:'حالة التنفيذ'},{field:'contractor',label:'المقاول'},
  {field:'owner',label:'المالك'},{field:'type',label:'نوع الخط'}
 ],
 parties:[{field:'contractor',label:'المقاول'},{field:'owner',label:'المالك'}],
 quality:[
  {field:'severity',label:'الأهمية'},{field:'category',label:'التصنيف'},{field:'source',label:'المصدر'}
 ],
 analytics:[
  {field:'municipality',label:'البلدية'},{field:'contractor',label:'المقاول'},{field:'owner',label:'المالك'}
 ]
};

const state={data:null,user:null,page:'master',filters:new Map(),charts:[],map:null,theme:0,export:{sheet:'vd projects',source:null,cache:new Map(),columns:new Set(),filters:new Map(),initializedSheet:null}};

const COLORS=['#0879a5','#19a5c8','#5bc6de','#83d9e8','#2f73b7','#79a8d8','#d0a351','#d36d56','#7d70b4','#69a99b'];
function toast(message){
 const el=$('#toast');el.textContent=message;el.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove('show'),2200);
}
function safeCount(obj,key){return n(obj?.[key]||0)}
function countBy(rows,field){
 const out={};rows.forEach(r=>{const v=clean(r[field])||'غير محدد';out[v]=(out[v]||0)+1});return out;
}
function sum(rows,field){return rows.reduce((a,r)=>a+n(r[field]),0)}
function topEntries(obj,limit=10){return Object.entries(obj||{}).sort((a,b)=>b[1]-a[1]).slice(0,limit)}
function pill(text){
 const t=clean(text);let c='pill';
 if(/منتهي|عليه|عاجل|مرتفع|غير موجود|خطأ/i.test(t))c+=' danger';
 else if(/اوشك|أوشك|بانتظار|جاري|قيد|غير محدد/i.test(t))c+=' warn';
 else if(/ساري|معتمد|مستوفي|منجز/i.test(t))c+=' ';
 else c+=' info';
 return '<span class="'+c+'">'+esc(t||'غير محدد')+'</span>';
}
function pageFilterDefs(){return FILTERS[state.page]||[]}
function filterKey(field){return state.page+'::'+field}
function filterSource(){
 const d=state.data||{};
 if(state.page==='master'||state.page==='analytics')return [...(d.projects||[]),...(d.actualPermits||[]),...(d.lines||[])];
 if(state.page==='projects'||state.page==='map'||state.page==='guarantees')return d.projects||[];
 if(state.page==='permits')return d.actualPermits||[];
 if(state.page==='lines'||state.page==='execution')return d.lines||[];
 if(state.page==='settlements')return d.settlements||[];
 if(state.page==='complaints')return d.complaints||[];
 if(state.page==='parties')return [...(d.projects||[]),...(d.lines||[])];
 if(state.page==='quality')return d.quality||[];
 return [];
}
function optionsFor(field){
 return [...new Set(filterSource().map(r=>clean(r[field])).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ar'));
}
function selectedFor(field){
 const values=optionsFor(field),key=filterKey(field);
 if(!state.filters.has(key))state.filters.set(key,new Set(values));
 const set=state.filters.get(key);
 values.forEach(v=>{if(!set.has(v) && set.__initialized!==true){set.add(v)}});
 set.__initialized=true;
 [...set].forEach(v=>{if(!values.includes(v))set.delete(v)});
 return {values,set};
}
function rowPasses(row,defs=pageFilterDefs()){
 return defs.every(def=>{
  const {values,set}=selectedFor(def.field);
  if(!values.length||set.size===values.length)return true;
  return set.has(clean(row[def.field]));
 });
}
function filtered(rows,defs=pageFilterDefs()){return (rows||[]).filter(r=>rowPasses(r,defs))}
function activeFilterCount(){
 let x=0;for(const def of pageFilterDefs()){const {values,set}=selectedFor(def.field);if(values.length&&set.size<values.length)x++}return x;
}
function commonFiltered(rows){
 const defs=pageFilterDefs().filter(d=>rows.some(r=>Object.prototype.hasOwnProperty.call(r,d.field)));
 return filtered(rows,defs);
}

function renderFilters(){
 const bar=$('#filterBar'),host=$('#filtersHost'),defs=pageFilterDefs();
 if(!defs.length){bar.style.display='none';host.innerHTML='';return}
 bar.style.display='block';
 host.innerHTML=defs.map(def=>{
  const {values,set}=selectedFor(def.field);
  const label=!values.length?'لا توجد قيم':set.size===values.length?'الكل':set.size+'/'+values.length;
  return '<div class="multi-filter" data-field="'+esc(def.field)+'">'+
   '<button class="mf-trigger" type="button"><b>'+esc(def.label)+'</b><span>'+esc(label)+' ▾</span></button>'+
   '<div class="mf-pop"><input class="mf-search" type="search" placeholder="بحث داخل '+esc(def.label)+'...">'+
   '<div class="mf-actions"><button data-act="all" type="button">تحديد الكل</button><button data-act="none" type="button">إلغاء الكل</button></div>'+
   '<div class="mf-options">'+values.map(v=>'<label class="mf-option" data-text="'+esc(norm(v))+'"><input type="checkbox" value="'+esc(v)+'" '+(set.has(v)?'checked':'')+'><span>'+esc(v)+'</span></label>').join('')+'</div></div></div>';
 }).join('');
 $$('.mf-trigger',host).forEach(btn=>btn.addEventListener('click',e=>{
   e.stopPropagation();const box=btn.closest('.multi-filter');$$('.multi-filter',host).forEach(x=>{if(x!==box)x.classList.remove('open')});box.classList.toggle('open');
 }));
 $$('.mf-search',host).forEach(inp=>inp.addEventListener('input',()=>{
   const q=norm(inp.value);$$('.mf-option',inp.closest('.mf-pop')).forEach(x=>x.style.display=!q||x.dataset.text.includes(q)?'flex':'none');
 }));
 $$('.mf-actions button',host).forEach(btn=>btn.addEventListener('click',()=>{
   const box=btn.closest('.multi-filter'),field=box.dataset.field,{values,set}=selectedFor(field);
   set.clear();if(btn.dataset.act==='all')values.forEach(v=>set.add(v));renderPage();
 }));
 $$('.mf-option input',host).forEach(inp=>inp.addEventListener('change',()=>{
   const field=inp.closest('.multi-filter').dataset.field,{set}=selectedFor(field);
   inp.checked?set.add(inp.value):set.delete(inp.value);renderPage();
 }));
}
document.addEventListener('click',e=>{if(!e.target.closest('.multi-filter'))$$('.multi-filter').forEach(x=>x.classList.remove('open'))});

function kpi(label,value,note='',cls=''){
 return '<article class="kpi-card '+cls+'"><span>'+esc(label)+'</span><strong data-count>'+esc(value)+'</strong><small>'+esc(note)+'</small></article>';
}
function animateCounts(){
 $$('[data-count]','#pageHost').forEach(el=>{
  const raw=clean(el.textContent).replace(/,/g,'');if(!/^[-+]?\d+(?:\.\d+)?$/.test(raw))return;
  const target=Number(raw);if(!Number.isFinite(target)||target===0)return;
  const decimals=(raw.split('.')[1]||'').length,start=performance.now(),duration=650;
  const step=now=>{const p=Math.min(1,(now-start)/duration),e=1-Math.pow(1-p,3),v=target*e;el.textContent=new Intl.NumberFormat('en-US',{minimumFractionDigits:decimals,maximumFractionDigits:decimals}).format(decimals?v:Math.round(v));if(p<1)requestAnimationFrame(step)};
  requestAnimationFrame(step);
 });
}
function destroyCharts(){state.charts.forEach(c=>{try{c.destroy()}catch(e){}});state.charts=[]}
const valuePlugin={
 id:'vdValueLabels',
 afterDatasetsDraw(chart){
  const ctx=chart.ctx;ctx.save();ctx.font='600 10px Cairo';ctx.fillStyle='#223d37';ctx.textAlign='center';ctx.textBaseline='bottom';
  chart.data.datasets.forEach((ds,di)=>{
   const meta=chart.getDatasetMeta(di);if(meta.data.length>18)return;
   meta.data.forEach((el,i)=>{const v=ds.data[i];if(v==null||v===0)return;const pos=el.tooltipPosition();ctx.fillText(fmt(v),pos.x,pos.y-5)});
  });ctx.restore();
 }
};
function makeChart(id,type,labels,values,opts={}){
 if(!window.Chart)return;
 const canvas=document.getElementById(id);if(!canvas)return;
 const colors=labels.map((_,i)=>COLORS[i%COLORS.length]);
 const chart=new Chart(canvas,{
  type,data:{labels,datasets:[{label:opts.label||'',data:values,backgroundColor:type==='line'?'rgba(8,121,165,.14)':colors,borderColor:type==='line'?'#0879a5':colors,borderWidth:type==='line'?2:1,tension:.32,fill:type==='line'}]},
  options:{responsive:true,maintainAspectRatio:false,indexAxis:opts.horizontal?'y':'x',plugins:{legend:{display:type==='doughnut',position:'bottom',labels:{font:{family:'Cairo',size:10},boxWidth:10}},tooltip:{rtl:true,titleFont:{family:'Cairo'},bodyFont:{family:'Cairo'}}},scales:type==='doughnut'?{}:{x:{ticks:{font:{family:'Cairo',size:9},color:'#566a64'},grid:{display:false}},y:{beginAtZero:true,ticks:{font:{family:'Cairo',size:9},color:'#566a64'},grid:{color:'rgba(0,0,0,.04)'}}}},
  plugins:[valuePlugin]
 });
 state.charts.push(chart);
}
function chartPanel(id,title,sub=''){
 return '<section class="panel"><div class="panel-head"><b>'+esc(title)+'</b><span>'+esc(sub)+'</span></div><div class="chart-wrap"><canvas id="'+id+'"></canvas></div></section>';
}
function tablePanel(title,columns,rows){
 const id='tbl_'+Math.random().toString(36).slice(2);
 return '<section class="table-panel wide"><div class="table-tools"><b>'+esc(title)+' <span style="color:#8b9b96">('+rows.length+')</span></b><input class="table-search" data-table="'+id+'" type="search" placeholder="بحث داخل الجدول..."></div>'+
 '<div class="table-scroll"><table id="'+id+'"><thead><tr>'+columns.map(c=>'<th>'+esc(c.label)+'</th>').join('')+'</tr></thead><tbody>'+
 rows.map(r=>'<tr>'+columns.map(c=>'<td>'+((c.html?c.html(r):esc(r[c.key]??''))||'—')+'</td>').join('')+'</tr>').join('')+
 '</tbody></table></div></section>';
}
function wireTableSearch(){
 $$('.table-search','#pageHost').forEach(inp=>inp.addEventListener('input',()=>{
  const q=norm(inp.value),table=document.getElementById(inp.dataset.table);if(!table)return;
  $$('tbody tr',table).forEach(tr=>tr.style.display=!q||norm(tr.textContent).includes(q)?'':'none');
 }));
}

function timing(rows){
 const today=new Date();today.setHours(0,0,0,0);const out={expired:0,expiring:0,valid:0,unknown:0};
 rows.forEach(x=>{if(!x.end){out.unknown++;return}const parts=String(x.end).match(/(\d{1,4})[\/\-](\d{1,2})[\/\-](\d{1,4})/);let d=null;if(parts){if(parts[1].length===4)d=new Date(+parts[1],+parts[2]-1,+parts[3]);else d=new Date(+parts[3],+parts[2]-1,+parts[1])}if(!d||isNaN(d)){out.unknown++;return}const days=Math.floor((d-today)/86400000);if(days<0)out.expired++;else if(days<=7)out.expiring++;else out.valid++});return out;
}
function attentions(projects){
 return projects.filter(p=>/منتهي|أوشك|بانتظار/i.test(clean(p.guaranteeStatus))||/منتهي|أوشك/i.test(clean(p.permitStatus))).length;
}
function dateDaysLeft(v){
 const s=clean(v),m=s.match(/(\d{1,4})[\/\-](\d{1,2})[\/\-](\d{1,4})/);
 if(!m)return null;
 let y,mo,d;if(m[1].length===4){y=+m[1];mo=+m[2];d=+m[3]}else{d=+m[1];mo=+m[2];y=+m[3]}
 const dt=new Date(y,mo-1,d);if(isNaN(dt))return null;
 const now=new Date();now.setHours(0,0,0,0);return Math.floor((dt-now)/86400000);
}
function buildOperationalAlerts(projects,permits,lines){
 const out=[];
 permits.forEach(p=>{
  const days=dateDaysLeft(p.end);
  if(days===null)return;
  if(days<0)out.push({severity:'high',type:'تصريح منتهي',item:p.id||'—',details:'انتهى منذ '+Math.abs(days)+' يوم • '+(p.owner||'مالك غير محدد')});
  else if(days<=7)out.push({severity:'medium',type:'تصريح يوشك',item:p.id||'—',details:'متبقي '+days+' يوم • '+(p.owner||'مالك غير محدد')});
 });
 projects.forEach(p=>{
  const s=clean(p.guaranteeStatus);
  if(/منتهي/i.test(s))out.push({severity:'high',type:'ضمان منتهي',item:p.no||'—',details:(p.contractor||'مقاول غير محدد')+' • '+s});
  else if(/أوشك|اوشك|بانتظار/i.test(s))out.push({severity:'medium',type:'متابعة ضمان',item:p.no||'—',details:(p.contractor||'مقاول غير محدد')+' • '+s});
 });
 lines.forEach(l=>{
  const s=clean(l.designStatus);
  if(!s)out.push({severity:'low',type:'حالة تصميم ناقصة',item:l.ref||'—',details:l.name||'خط بدون وصف'});
  else if(/جاري|قيد/i.test(s))out.push({severity:'medium',type:'تصميم تحت المتابعة',item:l.ref||'—',details:s+' • '+(l.designer||'مصمم غير محدد')});
 });
 const rank={high:3,medium:2,low:1};
 return out.sort((a,b)=>(rank[b.severity]||0)-(rank[a.severity]||0)).slice(0,30);
}

function renderMaster(){
 const d=state.data,projects=commonFiltered(d.projects),permits=commonFiltered(d.actualPermits),lines=commonFiltered(d.lines),pt=timing(permits);
 const permitMeters=sum(permits,'meters'),lineMeters=sum(lines,'length'),coverage=permitMeters?Math.round((lineMeters/permitMeters)*1000)/10:0,gap=Math.round((permitMeters-lineMeters)*10)/10;
 const permitStatus=countBy(projects,'permitStatus'),lineType=countBy(lines,'type'),design=countBy(lines,'designStatus'),guarantees=countBy(projects,'guaranteeStatus'),years=countBy(permits,'year'),mun=countBy(projects,'municipality');
 const alerts=buildOperationalAlerts(projects,permits,lines);
 $('#pageHost').innerHTML='<div class="kpi-grid">'+
  kpi('المشاريع',projects.length,'مشروع ضمن نطاق الفلاتر')+
  kpi('التصاريح الفعلية',permits.length,'تصاريح لها بداية ونهاية')+
  kpi('أمتار التصاريح',fmt(permitMeters),'متر مستحق')+
  kpi('الخطوط البديلة',lines.length,'خط مسجل')+
  kpi('أطوال الخطوط',fmt(lineMeters),'متر خطوط بديلة')+
  kpi('تغطية الأمتار',coverage,'% = أطوال الخطوط ÷ أمتار التصاريح','info')+
  kpi('فجوة الأمتار',fmt(gap),'المستحق - أطوال الخطوط',gap>0?'warn':'info')+
  kpi('تحت الإصدار',projects.filter(x=>x.permitRefs==='تحت الاصدار').length,'مشاريع تنتظر إصدار التصريح','warn')+
  kpi('تصاريح أوشكت',pt.expiring,'تنتهي خلال 7 أيام','warn')+
  kpi('تحتاج متابعة',attentions(projects),'تصاريح أو ضمانات حرجة','danger')+
 '</div><div class="chart-grid">'+
  chartPanel('cPermitStatus','حالة التصاريح','منطق مستقل عن حالة الضمان')+
  chartPanel('cLineType','أنواع الخطوط البديلة')+
  chartPanel('cDesign','حالة التصميم والاعتماد')+
  chartPanel('cGuarantee','حالة الضمانات والتعهدات')+
  chartPanel('cYears','التصاريح حسب السنة')+
  chartPanel('cMun','المشاريع حسب البلدية')+
 '</div>'+
 tablePanel('تنبيهات المتابعة الذكية',[
  {key:'severity',label:'الأهمية',html:r=>pill(r.severity==='high'?'مرتفعة':r.severity==='medium'?'متوسطة':'منخفضة')},
  {key:'type',label:'نوع التنبيه'},{key:'item',label:'المرجع'},{key:'details',label:'التفاصيل'}
 ],alerts);
 let x=topEntries(permitStatus);makeChart('cPermitStatus','doughnut',x.map(a=>a[0]),x.map(a=>a[1]));
 x=topEntries(lineType);makeChart('cLineType','doughnut',x.map(a=>a[0]),x.map(a=>a[1]));
 x=topEntries(design);makeChart('cDesign','bar',x.map(a=>a[0]),x.map(a=>a[1]));
 x=topEntries(guarantees);makeChart('cGuarantee','doughnut',x.map(a=>a[0]),x.map(a=>a[1]));
 x=topEntries(years);makeChart('cYears','bar',x.map(a=>a[0]),x.map(a=>a[1]));
 x=topEntries(mun,12);makeChart('cMun','bar',x.map(a=>a[0]),x.map(a=>a[1]),{horizontal:true});
}
function renderProjects(){
 const rows=filtered(state.data.projects),meters=sum(rows,'permitMeters'),under=rows.filter(x=>x.permitRefs==='تحت الاصدار').length,cancel=rows.filter(x=>x.permitRefs==='مشروع ملغي').length;
 $('#pageHost').innerHTML='<div class="kpi-grid">'+
  kpi('إجمالي المشاريع',rows.length)+kpi('أمتار التصاريح',fmt(meters),'متر')+
  kpi('تحت الإصدار',under,'حالة خام من رقم التصريح','warn')+
  kpi('مشاريع ملغاة',cancel,'مفصولة عن التصاريح الفعلية','danger')+
 '</div><div class="chart-grid">'+chartPanel('pStatus','حالة العقود')+chartPanel('pType','نوع المشروع')+chartPanel('pPermit','حالة التصريح')+chartPanel('pMun','التوزيع حسب البلدية')+'</div>'+
 tablePanel('تفاصيل المشاريع',[
  {key:'no',label:'م'},{key:'name',label:'اسم المشروع'},{key:'contractStatus',label:'حالة العقد',html:r=>pill(r.contractStatus)},
  {key:'projectType',label:'نوع المشروع'},{key:'owner',label:'المالك'},{key:'contractor',label:'المقاول'},
  {key:'municipality',label:'البلدية'},{key:'permitRefs',label:'رقم/حالة التصريح'},{key:'permitStatus',label:'حالة التصريح',html:r=>pill(r.permitStatus)},
  {key:'permitMeters',label:'الأمتار'},{key:'guaranteeStatus',label:'حالة الضمان',html:r=>pill(r.guaranteeStatus)}
 ],rows);
 for(const [id,field] of [['pStatus','contractStatus'],['pType','projectType'],['pPermit','permitStatus'],['pMun','municipality']]){
  const x=topEntries(countBy(rows,field),12);makeChart(id,id==='pPermit'?'doughnut':'bar',x.map(a=>a[0]),x.map(a=>a[1]),{horizontal:id==='pMun'});
 }
}
function renderMap(){
 const all=filtered(state.data.projects);
 const rows=all.filter(r=>Number.isFinite(Number(r.lat))&&Number.isFinite(Number(r.lon))&&Number(r.lat)>20&&Number(r.lat)<23&&Number(r.lon)>38&&Number(r.lon)<41);
 const missing=all.length-rows.length;
 $('#pageHost').innerHTML='<div class="kpi-grid">'+
  kpi('المشاريع ضمن الفلاتر',all.length)+
  kpi('مواقع صحيحة',rows.length,'مشروعات لها إحداثيات قابلة للرسم')+
  kpi('بدون إحداثيات',missing,'تحتاج استكمال بيانات الموقع',missing?'warn':'')+
  kpi('البلديات الممثلة',new Set(rows.map(x=>x.municipality).filter(Boolean)).size)+
 '</div>'+
 '<section class="map-panel"><div class="map-legend"><span><i class="map-dot"></i> موقع مشروع حلول عاجلة</span><span>الإحداثيات من حقلي E وN في الشيت</span></div><div id="projectMap" class="map-canvas"></div></section>'+
 tablePanel('المشروعات الظاهرة على الخريطة',[
  {key:'no',label:'م'},{key:'name',label:'اسم المشروع'},{key:'municipality',label:'البلدية'},
  {key:'district',label:'الحي'},{key:'street',label:'الشارع'},{key:'owner',label:'المالك'},
  {key:'contractor',label:'المقاول'},{key:'permitStatus',label:'حالة التصريح',html:r=>pill(r.permitStatus)}
 ],rows);
 if(!window.L){
  const el=document.getElementById('projectMap');if(el)el.innerHTML='<div class="empty"><b>تعذر تحميل مكتبة الخريطة</b><span>تحقق من الاتصال بالإنترنت ثم أعد تحميل الصفحة.</span></div>';
  return;
 }
 state.map=L.map('projectMap',{zoomControl:true,attributionControl:true}).setView([21.55,39.18],11);
 L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap'}).addTo(state.map);
 const bounds=[];
 rows.forEach(r=>{
  const lat=Number(r.lat),lon=Number(r.lon);bounds.push([lat,lon]);
  const marker=L.circleMarker([lat,lon],{radius:6,color:'#075f89',weight:2,fillColor:'#19a5c8',fillOpacity:.82});
  marker.bindPopup('<b>'+esc(r.no||'')+' — '+esc(r.name||'مشروع')+'</b><br>'+
   '<span>'+esc(r.municipality||'')+' • '+esc(r.district||'')+'</span><br>'+
   '<span>المقاول: '+esc(r.contractor||'—')+'</span><br>'+
   '<span>المالك: '+esc(r.owner||'—')+'</span><br>'+
   '<span>حالة التصريح: '+esc(r.permitStatus||'—')+'</span>');
  marker.addTo(state.map);
 });
 if(bounds.length)state.map.fitBounds(bounds,{padding:[28,28],maxZoom:14});
 setTimeout(()=>state.map&&state.map.invalidateSize(),120);
}
function renderPermits(){
 const rows=filtered(state.data.actualPermits),t=timing(rows);
 $('#pageHost').innerHTML='<div class="kpi-grid">'+
  kpi('التصاريح الفعلية',rows.length,'مؤرخة ببداية ونهاية')+kpi('إجمالي الأمتار',fmt(sum(rows,'meters')),'متر')+
  kpi('سارية',t.valid,'أكثر من 7 أيام')+kpi('أوشكت',t.expiring,'7 أيام أو أقل','warn')+
  kpi('منتهية',t.expired,'تحتاج مراجعة','danger')+kpi('تاريخ غير قابل للقراءة',t.unknown,'جودة بيانات','info')+
 '</div><div class="chart-grid">'+chartPanel('peYear','التصاريح حسب السنة')+chartPanel('peMun','التصاريح حسب البلدية')+chartPanel('peCon','أعلى المقاولين بعدد التصاريح')+chartPanel('peOwner','أعلى الملاك بالأمتار')+'</div>'+
 tablePanel('سجل التصاريح الفعلية',[
  {key:'id',label:'رقم التصريح'},{key:'start',label:'البداية'},{key:'end',label:'النهاية'},{key:'meters',label:'الأمتار'},
  {key:'owner',label:'المالك'},{key:'contractor',label:'المقاول'},{key:'municipality',label:'البلدية'},{key:'district',label:'الحي'},{key:'year',label:'السنة'}
 ],rows);
 let x=topEntries(countBy(rows,'year'));makeChart('peYear','bar',x.map(a=>a[0]),x.map(a=>a[1]));
 x=topEntries(countBy(rows,'municipality'),12);makeChart('peMun','bar',x.map(a=>a[0]),x.map(a=>a[1]),{horizontal:true});
 x=topEntries(countBy(rows,'contractor'),12);makeChart('peCon','bar',x.map(a=>a[0]),x.map(a=>a[1]),{horizontal:true});
 const om={};rows.forEach(r=>{const k=r.owner||'غير محدد';om[k]=(om[k]||0)+n(r.meters)});x=topEntries(om,12);makeChart('peOwner','bar',x.map(a=>a[0]),x.map(a=>a[1]),{horizontal:true});
}
function renderLines(){
 const rows=filtered(state.data.lines),approved=rows.filter(x=>/معتمد/i.test(x.designStatus)).length,pending=rows.filter(x=>!x.designStatus||/جاري|منتهي وجاري/i.test(x.designStatus)).length;
 $('#pageHost').innerHTML='<div class="kpi-grid">'+
  kpi('الخطوط المسجلة',rows.length)+kpi('إجمالي الأطوال',fmt(sum(rows,'length')),'متر')+
  kpi('معتمد PMO',approved,'حزم/تصاميم معتمدة')+kpi('قيد التصميم/الاعتماد',pending,'تحتاج متابعة','warn')+
 '</div><div class="chart-grid">'+chartPanel('lType','أنواع الخطوط')+chartPanel('lDesign','حالة التصميم')+chartPanel('lContractor','أطوال الخطوط حسب المقاول')+chartPanel('lDesigner','الخطوط حسب المصمم')+'</div>'+
 tablePanel('تفاصيل الخطوط البديلة',[
  {key:'ref',label:'المرجع'},{key:'name',label:'الخط/الموقع'},{key:'type',label:'النوع',html:r=>pill(r.type)},
  {key:'length',label:'الطول'},{key:'contractor',label:'المقاول'},{key:'owner',label:'المالك'},{key:'designer',label:'المصمم'},
  {key:'municipality',label:'البلدية'},{key:'designStatus',label:'حالة التصميم',html:r=>pill(r.designStatus)},{key:'year',label:'السنة'}
 ],rows);
 let x=topEntries(countBy(rows,'type'));makeChart('lType','doughnut',x.map(a=>a[0]),x.map(a=>a[1]));
 x=topEntries(countBy(rows,'designStatus'));makeChart('lDesign','bar',x.map(a=>a[0]),x.map(a=>a[1]));
 const cm={};rows.forEach(r=>{const k=r.contractor||'غير محدد';cm[k]=(cm[k]||0)+n(r.length)});x=topEntries(cm,12);makeChart('lContractor','bar',x.map(a=>a[0]),x.map(a=>a[1]),{horizontal:true});
 x=topEntries(countBy(rows,'designer'),10);makeChart('lDesigner','bar',x.map(a=>a[0]),x.map(a=>a[1]),{horizontal:true});
}
function renderSettlements(){
 const rows=filtered(state.data.settlements),owed=rows.filter(x=>x.balance>0),credit=rows.filter(x=>x.balance<0),settled=rows.filter(x=>x.balance===0);
 $('#pageHost').innerHTML='<div class="kpi-grid">'+
  kpi('علاقات التسوية',rows.length)+kpi('عليه أمتار',owed.length,fmt(sum(owed,'balance'))+' م','danger')+
  kpi('له أمتار',credit.length,fmt(Math.abs(sum(credit,'balance')))+' م','info')+kpi('مستوفي الأمتار',settled.length,'رصيد صفر')+
 '</div><div class="chart-grid">'+chartPanel('sStatus','حالة التسويات')+chartPanel('sContractor','صافي الرصيد حسب المقاول')+'</div>'+
 tablePanel('تسويات الملاك والمقاولين',[
  {key:'owner',label:'المالك'},{key:'contractor',label:'المقاول'},{key:'dueMeters',label:'المستحق من التصاريح'},
  {key:'executedMeters',label:'الخطوط البديلة'},{key:'balance',label:'الرصيد النهائي'},
  {key:'status',label:'الحالة',html:r=>pill(r.status)}
 ],rows);
 let x=topEntries(countBy(rows,'status'));makeChart('sStatus','doughnut',x.map(a=>a[0]),x.map(a=>a[1]));
 const cm={};rows.forEach(r=>{const k=r.contractor||'غير محدد';cm[k]=(cm[k]||0)+n(r.balance)});x=Object.entries(cm).sort((a,b)=>Math.abs(b[1])-Math.abs(a[1])).slice(0,15);makeChart('sContractor','bar',x.map(a=>a[0]),x.map(a=>a[1]),{horizontal:true});
}
function renderGuarantees(){
 const rows=filtered(state.data.projects),by=countBy(rows,'guaranteeStatus'),expired=rows.filter(x=>/منتهي/i.test(x.guaranteeStatus)).length,soon=rows.filter(x=>/أوشك/i.test(x.guaranteeStatus)).length,waiting=rows.filter(x=>/بانتظار/i.test(x.guaranteeStatus)).length;
 $('#pageHost').innerHTML='<div class="kpi-grid">'+kpi('المشاريع',rows.length)+kpi('ضمان منتهي',expired,'تحتاج إجراء','danger')+kpi('أوشك على الانتهاء',soon,'متابعة عاجلة','warn')+kpi('بانتظار إصدار',waiting,'ضمان أو تعهد','warn')+'</div>'+
 '<div class="chart-grid">'+chartPanel('gStatus','حالة الضمانات')+chartPanel('gContractor','الحالات حسب المقاول')+'</div>'+
 tablePanel('سجل الضمانات',[
  {key:'no',label:'المشروع'},{key:'owner',label:'المالك'},{key:'contractor',label:'المقاول'},{key:'guaranteeRef',label:'رقم الضمان/التعهد'},
  {key:'guaranteeExpiry',label:'الانتهاء'},{key:'guaranteeDays',label:'الأيام المتبقية'},{key:'guaranteeStatus',label:'الحالة',html:r=>pill(r.guaranteeStatus)}
 ],rows);
 let x=topEntries(by);makeChart('gStatus','doughnut',x.map(a=>a[0]),x.map(a=>a[1]));
 x=topEntries(countBy(rows,'contractor'),12);makeChart('gContractor','bar',x.map(a=>a[0]),x.map(a=>a[1]),{horizontal:true});
}
function renderComplaints(){
 const rows=filtered(state.data.complaints),withStatus=rows.filter(x=>x.status).length;
 $('#pageHost').innerHTML='<div class="kpi-grid">'+kpi('إجمالي الشكاوى',rows.length)+kpi('بحالة مسجلة',withStatus)+kpi('بدون حالة',rows.length-withStatus,'تحتاج استكمال البيانات','warn')+'</div>'+
 '<div class="chart-grid">'+chartPanel('coStatus','حالة الشكاوى')+'<section class="panel"><div class="panel-head"><b>ملاحظة تشغيلية</b></div><div class="empty"><b>جاهز للربط</b><span>عند تعبئة حالة الشكوى وربطها بالخط سيتم تحديث المؤشرات تلقائيًا.</span></div></section></div>'+
 tablePanel('سجل الشكاوى',[
  {key:'text',label:'الشكوى'},{key:'status',label:'الحالة',html:r=>pill(r.status)},{key:'link',label:'الربط'}
 ],rows);
 const x=topEntries(countBy(rows,'status'));makeChart('coStatus','doughnut',x.map(a=>a[0]),x.map(a=>a[1]));
}
function renderExecution(){
 const rows=filtered(state.data.lines),started=rows.filter(x=>x.executionStatus).length,complete=rows.filter(x=>/منجز|منتهي|مكتمل/i.test(x.executionStatus)).length;
 $('#pageHost').innerHTML='<div class="kpi-grid">'+kpi('الخطوط',rows.length)+kpi('حالة تنفيذ مسجلة',started)+kpi('منجز/مكتمل',complete)+kpi('بدون حالة تنفيذ',rows.length-started,'جاهزة لاستقبال البيانات','warn')+'</div>'+
 '<div class="chart-grid">'+chartPanel('exStatus','حالة التنفيذ')+chartPanel('exType','التنفيذ حسب نوع الخط')+'</div>'+
 tablePanel('التنفيذ والتسليم',[
  {key:'ref',label:'المرجع'},{key:'name',label:'الخط'},{key:'contractor',label:'المقاول'},{key:'type',label:'النوع'},
  {key:'executionStatus',label:'حالة التنفيذ',html:r=>pill(r.executionStatus)},{key:'completion',label:'انتهاء التنفيذ'},
  {key:'completionReport',label:'تقرير الإتمام'},{key:'handoverLetter',label:'خطاب التسليم'},{key:'handoverDate',label:'تاريخ التسليم'}
 ],rows);
 let x=topEntries(countBy(rows,'executionStatus'));makeChart('exStatus','doughnut',x.map(a=>a[0]),x.map(a=>a[1]));
 const typeRows=rows.filter(r=>r.executionStatus);x=topEntries(countBy(typeRows,'type'));makeChart('exType','bar',x.map(a=>a[0]),x.map(a=>a[1]));
}
function renderParties(){
 const projects=commonFiltered(state.data.projects),lines=commonFiltered(state.data.lines);
 const contractors={},owners={};
 projects.forEach(r=>{const k=r.contractor||'غير محدد';if(!contractors[k])contractors[k]={projects:0,permitMeters:0,lineMeters:0};contractors[k].projects++;contractors[k].permitMeters+=n(r.permitMeters);const o=r.owner||'غير محدد';if(!owners[o])owners[o]={projects:0,permitMeters:0,lineMeters:0};owners[o].projects++;owners[o].permitMeters+=n(r.permitMeters)});
 lines.forEach(r=>{const k=r.contractor||'غير محدد';if(!contractors[k])contractors[k]={projects:0,permitMeters:0,lineMeters:0};contractors[k].lineMeters+=n(r.length);const o=r.owner||'غير محدد';if(!owners[o])owners[o]={projects:0,permitMeters:0,lineMeters:0};owners[o].lineMeters+=n(r.length)});
 const cr=Object.entries(contractors).map(([name,x])=>({name,...x})).sort((a,b)=>b.permitMeters-a.permitMeters),or=Object.entries(owners).map(([name,x])=>({name,...x})).sort((a,b)=>b.permitMeters-a.permitMeters);
 $('#pageHost').innerHTML='<div class="kpi-grid">'+kpi('المقاولون',cr.length)+kpi('الملاك',or.length)+kpi('أمتار التصاريح',fmt(sum(projects,'permitMeters')))+kpi('أمتار الخطوط',fmt(sum(lines,'length')))+'</div>'+
 '<div class="chart-grid">'+chartPanel('paCon','المقاولون حسب أمتار التصاريح')+chartPanel('paOwner','الملاك حسب الأمتار المستحقة')+'</div>'+
 tablePanel('ملخص المقاولين',[
  {key:'name',label:'المقاول'},{key:'projects',label:'المشاريع'},{key:'permitMeters',label:'أمتار التصاريح'},{key:'lineMeters',label:'أمتار الخطوط'}
 ],cr);
 let x=cr.slice(0,12);makeChart('paCon','bar',x.map(a=>a.name),x.map(a=>a.permitMeters),{horizontal:true});
 x=or.slice(0,12);makeChart('paOwner','bar',x.map(a=>a.name),x.map(a=>a.permitMeters),{horizontal:true});
}
function renderQuality(){
 const rows=filtered(state.data.quality),high=rows.filter(x=>x.severity==='high').length,medium=rows.filter(x=>x.severity==='medium').length;
 $('#pageHost').innerHTML='<div class="kpi-grid">'+kpi('إجمالي الملاحظات',rows.length)+kpi('مرتفعة',high,'تحتاج مراجعة مباشرة','danger')+kpi('متوسطة',medium,'تحتاج استكمال','warn')+kpi('منخفضة',rows.length-high-medium,'تحسين جودة')+'</div>'+
 '<div class="chart-grid">'+chartPanel('qCat','الملاحظات حسب التصنيف')+chartPanel('qSource','الملاحظات حسب المصدر')+'</div>'+
 tablePanel('نتائج التدقيق الذكي',[
  {key:'severity',label:'الأهمية',html:r=>pill(r.severity==='high'?'مرتفعة':r.severity==='medium'?'متوسطة':'منخفضة')},
  {key:'category',label:'التصنيف'},{key:'source',label:'المصدر'},{key:'row',label:'الصف'},{key:'message',label:'الملاحظة'}
 ],rows);
 let x=topEntries(countBy(rows,'category'));makeChart('qCat','bar',x.map(a=>a[0]),x.map(a=>a[1]),{horizontal:true});
 x=topEntries(countBy(rows,'source'));makeChart('qSource','doughnut',x.map(a=>a[0]),x.map(a=>a[1]));
}
function renderAnalytics(){
 const projects=commonFiltered(state.data.projects),permits=commonFiltered(state.data.actualPermits),lines=commonFiltered(state.data.lines),sett=state.data.settlements.filter(r=>rowPasses(r,pageFilterDefs().filter(d=>['owner','contractor'].includes(d.field))));
 const pendingDesign=lines.filter(x=>!x.designStatus||/جاري/i.test(x.designStatus)).length,critical=projects.filter(x=>/منتهي|أوشك|بانتظار/i.test(x.guaranteeStatus)).length,imbalance=sett.filter(x=>x.balance!==0).length;
 const meterDue=sum(permits,'meters'),meterLines=sum(lines,'length'),coverage=meterDue?Math.round((meterLines/meterDue)*1000)/10:0,gap=Math.round((meterDue-meterLines)*10)/10,pt=timing(permits);
 const dueBalance=Math.round(sett.filter(x=>x.balance>0).reduce((a,x)=>a+n(x.balance),0)*10)/10;
 $('#pageHost').innerHTML='<div class="kpi-grid">'+kpi('مشاريع بالنطاق',projects.length)+kpi('تصاريح فعلية',permits.length)+kpi('خطوط بديلة',lines.length)+kpi('تسويات غير متوازنة',imbalance,'أرصدة غير صفرية','warn')+kpi('تصاميم تحتاج متابعة',pendingDesign,'غير معتمد بالكامل','warn')+kpi('ضمانات حرجة',critical,'منتهي/أوشك/بانتظار','danger')+'</div>'+
 '<div class="insight-grid">'+
  '<article class="insight-card"><span>تغطية الأمتار</span><b>'+fmt(coverage)+'%</b><p>نسبة أطوال الخطوط البديلة إلى أمتار التصاريح ضمن الفلاتر الحالية.</p></article>'+
  '<article class="insight-card '+(gap>0?'warn':'')+'"><span>فجوة الأمتار</span><b>'+fmt(gap)+' م</b><p>الفرق الوصفي بين الأمتار المستحقة وأطوال الخطوط البديلة، وليس نسبة إنجاز للمشروعات.</p></article>'+
  '<article class="insight-card '+((pt.expired+pt.expiring)>0?'danger':'')+'"><span>التصاريح الزمنية</span><b>'+fmt(pt.expired+pt.expiring)+'</b><p>'+fmt(pt.expired)+' منتهي و '+fmt(pt.expiring)+' ينتهي خلال 7 أيام.</p></article>'+
  '<article class="insight-card '+(dueBalance>0?'warn':'')+'"><span>رصيد «عليه أمتار»</span><b>'+fmt(dueBalance)+' م</b><p>إجمالي الأرصدة الموجبة في علاقات التسوية الحالية.</p></article>'+
 '</div>'+
 '<div class="chart-grid">'+chartPanel('anMeter','الأمتار: مستحق مقابل خطوط بديلة')+chartPanel('anMun','تركيز المشاريع حسب البلدية')+chartPanel('anSet','حالة التسويات')+chartPanel('anGuarantee','حالة الضمانات')+'</div>';
 makeChart('anMeter','bar',['أمتار التصاريح','أمتار الخطوط'],[meterDue,meterLines]);
 let x=topEntries(countBy(projects,'municipality'),12);makeChart('anMun','bar',x.map(a=>a[0]),x.map(a=>a[1]),{horizontal:true});
 x=topEntries(countBy(sett,'status'));makeChart('anSet','doughnut',x.map(a=>a[0]),x.map(a=>a[1]));
 x=topEntries(countBy(projects,'guaranteeStatus'));makeChart('anGuarantee','doughnut',x.map(a=>a[0]),x.map(a=>a[1]));
}
function renderReports(){
 $('#pageHost').innerHTML='<div class="report-actions">'+
 ['master','projects','map','permits','lines','settlements','guarantees','complaints','execution','parties','quality','analytics'].map(key=>{
  const m=PAGE_META[key];return '<article class="report-card"><b>'+esc(m.title)+'</b><p>'+esc(m.sub)+'</p><button type="button" data-report="'+key+'">فتح وتجهيز PDF</button></article>'
 }).join('')+'</div>';
 $$('[data-report]','#pageHost').forEach(btn=>btn.addEventListener('click',()=>{openPage(btn.dataset.report);setTimeout(()=>printCurrent(),250)}));
}
const EXPORT_SHEETS=[
 {key:'vd projects',label:'vd projects — المشاريع'},
 {key:'Alternative lines',label:'Alternative lines — الخطوط البديلة'},
 {key:'info. new',label:'info. new — التصاريح والمراجع والشكاوى'},
 {key:'owners',label:'owners — الملاك والأمتار'}
];
function exportValueKey(v){const x=clean(v);return x===''?'__EMPTY__':x}
function exportValueLabel(v){return v==='__EMPTY__'?'(فارغ)':v}
async function loadExportSource(sheet,force=false){
 if(!force&&state.export.cache.has(sheet))return state.export.cache.get(sheet);
 const r=await fetch('/api/export/source?sheet='+encodeURIComponent(sheet),{cache:'no-store'});
 if(r.status===401){location.replace('/login');throw new Error('AUTH_REQUIRED')}
 const j=await r.json();if(!r.ok)throw new Error(j.message||j.error||'SOURCE_LOAD_FAILED');
 state.export.cache.set(sheet,j);return j;
}
function renderExcelExport(){
 $('#pageHost').innerHTML='<div class="export-builder"><aside class="export-side"><label>1. اختر ورقة Google Sheets</label><select id="exportSheet">'+EXPORT_SHEETS.map(x=>'<option value="'+esc(x.key)+'" '+(x.key===state.export.sheet?'selected':'')+'>'+esc(x.label)+'</option>').join('')+'</select><div style="margin-top:13px;font-size:9px;color:#8293a0;line-height:1.9">يتم قراءة القيم الظاهرة بعد تنفيذ المعادلات، وليس صيغ المعادلات. الصفوف الوهمية الممتدة أسفل البيانات الفعلية لا تدخل في التقرير.</div></aside><section class="export-main" id="exportMain"><div class="empty"><b>جاري قراءة الورقة...</b><span>تحميل الأعمدة والقيم من Google Sheets</span></div></section></div>';
 $('#exportSheet').addEventListener('change',e=>{
  state.export.sheet=e.target.value;state.export.source=null;state.export.columns.clear();state.export.filters.clear();state.export.initializedSheet=null;renderExcelExport();
 });
 const requested=state.export.sheet;
 loadExportSource(requested).then(src=>{
  if(state.page!=='excelExport'||state.export.sheet!==requested)return;
  state.export.source=src;
  if(state.export.initializedSheet!==requested){
   state.export.columns=new Set(src.columns.map(c=>c.key));
   state.export.filters.clear();state.export.initializedSheet=requested;
  }
  renderExportBuilder();
 }).catch(err=>{
  const main=$('#exportMain');if(main)main.innerHTML='<div class="empty"><b>تعذر قراءة الورقة</b><span>'+esc(err.message)+'</span></div>';
 });
}
function exportColumnValues(col){
 const src=state.export.source;if(!src)return [];
 return [...new Set((src.rows||[]).map(r=>exportValueKey(r[col.key])))]
  .sort((a,b)=>exportValueLabel(a).localeCompare(exportValueLabel(b),'ar',{numeric:true}));
}
function ensureExportFilter(col){
 const key=state.export.sheet+'::'+col.key,values=exportColumnValues(col);
 if(!state.export.filters.has(key))state.export.filters.set(key,new Set(values));
 const set=state.export.filters.get(key);
 [...set].forEach(v=>{if(!values.includes(v))set.delete(v)});
 return {key,values,set};
}
function renderExportBuilder(){
 const src=state.export.source,main=$('#exportMain');if(!src||!main)return;
 main.innerHTML='<div class="panel-head"><b>2. اختر الأعمدة</b><span><b id="exportRowCount"></b> • '+src.columns.length+' عمود متاح</span></div>'+
 '<div class="export-column-actions"><button id="exportColsAll" type="button">تحديد كل الأعمدة</button><button id="exportColsNone" type="button">إلغاء تحديد الكل</button></div>'+
 '<div class="column-list">'+src.columns.map(c=>'<label class="column-choice"><input type="checkbox" data-col="'+esc(c.key)+'" '+(state.export.columns.has(c.key)?'checked':'')+'><span>'+esc(c.label)+'</span></label>').join('')+'</div>'+
 '<div class="panel-head" style="margin-top:16px"><b>3. فلاتر الأعمدة المختارة</b><span>الافتراضي: جميع القيم محددة</span></div><div id="exportFilters" class="filters-host"></div>'+
 '<div class="export-footer"><button id="doExcelExport" type="button">تصدير ملف Excel بالقيم فقط</button></div>';
 $$('[data-col]',main).forEach(x=>x.addEventListener('change',()=>{x.checked?state.export.columns.add(x.dataset.col):state.export.columns.delete(x.dataset.col);renderExportFilters()}));
 $('#exportColsAll').addEventListener('click',()=>{src.columns.forEach(c=>state.export.columns.add(c.key));renderExportBuilder()});
 $('#exportColsNone').addEventListener('click',()=>{state.export.columns.clear();renderExportBuilder()});
 $('#doExcelExport').addEventListener('click',exportExcelBuilder);
 renderExportFilters();
}
function renderExportFilters(){
 const host=$('#exportFilters'),src=state.export.source;if(!host||!src)return;
 const cols=src.columns.filter(c=>state.export.columns.has(c.key));
 host.innerHTML=cols.map(c=>{
  const {key,values,set}=ensureExportFilter(c);
  const countLabel=set.size===values.length?'الكل':set.size+'/'+values.length;
  return '<div class="multi-filter export-mf" data-key="'+esc(key)+'" data-field="'+esc(c.key)+'"><button class="mf-trigger" type="button"><b>'+esc(c.header||c.letter)+'</b><span>'+countLabel+' ▾</span></button><div class="mf-pop"><input class="mf-search" type="search" placeholder="بحث في '+esc(c.header||('عمود '+c.letter))+'..."><div class="mf-actions"><button data-act="all" type="button">تحديد الكل</button><button data-act="none" type="button">إلغاء الكل</button></div><div class="mf-options">'+values.map(v=>{const label=exportValueLabel(v);return '<label class="mf-option" data-text="'+esc(norm(label))+'"><input type="checkbox" value="'+esc(v)+'" '+(set.has(v)?'checked':'')+'><span>'+esc(label)+'</span></label>'}).join('')+'</div></div></div>';
 }).join('');
 $$('.export-mf .mf-trigger',host).forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();const box=b.closest('.export-mf');$$('.export-mf',host).forEach(x=>{if(x!==box)x.classList.remove('open')});box.classList.toggle('open')}));
 $$('.export-mf .mf-search',host).forEach(inp=>inp.addEventListener('input',()=>{const q=norm(inp.value);$$('.mf-option',inp.closest('.mf-pop')).forEach(x=>x.style.display=!q||x.dataset.text.includes(q)?'flex':'none')}));
 $$('.export-mf .mf-actions button',host).forEach(b=>b.addEventListener('click',()=>{const box=b.closest('.export-mf'),col=src.columns.find(c=>c.key===box.dataset.field),x=ensureExportFilter(col);x.set.clear();if(b.dataset.act==='all')x.values.forEach(v=>x.set.add(v));renderExportFilters()}));
 $$('.export-mf .mf-option input',host).forEach(inp=>inp.addEventListener('change',()=>{const set=state.export.filters.get(inp.closest('.export-mf').dataset.key);inp.checked?set.add(inp.value):set.delete(inp.value);updateExportCount()}));
 updateExportCount();
}
function exportRows(){
 const src=state.export.source;if(!src)return [];
 const cols=src.columns.filter(c=>state.export.columns.has(c.key));
 return (src.rows||[]).filter(row=>cols.every(c=>{
  const {values,set}=ensureExportFilter(c);
  return set.size===values.length||set.has(exportValueKey(row[c.key]));
 }));
}
function updateExportCount(){const el=$('#exportRowCount');if(el)el.textContent=exportRows().length+' صف'}
async function exportExcelBuilder(){
 const src=state.export.source;if(!src)return;
 const cols=src.columns.filter(c=>state.export.columns.has(c.key)).map(c=>({key:c.key,label:c.label,width:22}));
 const rows=exportRows();
 if(!cols.length)return toast('اختر عمودًا واحدًا على الأقل');
 if(!rows.length)return toast('لا توجد صفوف مطابقة للفلاتر الحالية');
 await downloadXlsx(src.sheet,cols,rows);
}
async function downloadXlsx(type,columns,rows){
 const name=reportName(type,true),r=await fetch('/api/export/xlsx',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:name,columns,rows})});
 if(!r.ok)return toast('تعذر إنشاء ملف Excel');
 const blob=await r.blob(),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name+'.xlsx';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
function reportName(type,forceFiltered=false){
 const d=new Date(),pad=x=>String(x).padStart(2,'0'),stamp=d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())+'_'+pad(d.getHours())+'-'+pad(d.getMinutes())+'-'+pad(d.getSeconds()),scope=(forceFiltered||activeFilterCount())?'Filtered':'General';
 return 'VD_UrgentSolutions_'+String(type).replace(/\s+/g,'_')+'_'+scope+'_'+stamp;
}
function printCurrent(){
 const old=document.title,meta=PAGE_META[state.page]||PAGE_META.master;
 const now=new Date();
 const title=reportName(meta.title||state.page);
 const titleEl=$('#printMetaTitle'),timeEl=$('#printMetaTime');
 if(titleEl)titleEl.textContent='إدارة الحلول العاجلة • '+meta.title;
 if(timeEl)timeEl.textContent=now.toLocaleString('ar-SA',{dateStyle:'medium',timeStyle:'short'});
 document.title=title;
 window.print();
 setTimeout(()=>document.title=old,500);
}

function renderPage(){
 destroyCharts();if(state.map){try{state.map.remove()}catch(e){}state.map=null}const meta=PAGE_META[state.page]||PAGE_META.master;
 $('#pageTitle').textContent=meta.title;$('#pageSubtitle').textContent=meta.sub;$('#heroIcon').textContent=meta.icon;$('#heroEyebrow').textContent=meta.eye+' • JEDDAH WATER PROJECTS';
 renderFilters();
 const fn={master:renderMaster,projects:renderProjects,map:renderMap,permits:renderPermits,lines:renderLines,settlements:renderSettlements,guarantees:renderGuarantees,complaints:renderComplaints,execution:renderExecution,parties:renderParties,quality:renderQuality,analytics:renderAnalytics,reports:renderReports,excelExport:renderExcelExport}[state.page]||renderMaster;
 fn();wireTableSearch();animateCounts();
}
function canAccess(item){
 const p=state.user?.permissions||[];if(!p.length||p.includes('*'))return true;
 const key=item.dataset.page,label=clean($('b',item)?.textContent);return p.some(x=>norm(x)===norm(key)||norm(x)===norm(label));
}
function applyPermissions(){
 $$('.nav-item').forEach(item=>item.style.display=canAccess(item)?'grid':'none');
 const active=$('.nav-item.active');if(active&&!canAccess(active)){const first=$$('.nav-item').find(canAccess);if(first)openPage(first.dataset.page)}
}
function openPage(page){
 const item=$('.nav-item[data-page="'+page+'"]');if(item&&!canAccess(item))return toast('لا توجد صلاحية لهذه الشاشة');
 state.page=page;$$('.nav-item').forEach(x=>x.classList.toggle('active',x.dataset.page===page));
 const group=item?.closest('.nav-group');if(group){$$('.nav-group').forEach(g=>g.classList.toggle('is-open',g===group))}
 renderPage();window.scrollTo({top:0,behavior:'smooth'});
}
async function loadData(force=false){
 const btn=$('#refreshBtn');if(btn)btn.disabled=true;
 try{
  const r=await fetch('/api/data'+(force?'?refresh=1':''),{cache:'no-store'});if(r.status===401)return location.replace('/login');const j=await r.json();if(!r.ok)throw new Error(j.message||'DATA');
  state.data=j;$('#updatedAt').textContent=new Date(j.updatedAt).toLocaleString('ar-SA',{dateStyle:'short',timeStyle:'short'});renderPage();toast(force?'تم تحديث البيانات':'تم تحميل البيانات');
 }catch(e){console.error(e);$('#pageHost').innerHTML='<div class="empty"><b>تعذر تحميل البيانات</b><span>'+esc(e.message)+'</span></div>';toast('تعذر الاتصال بمصدر البيانات')}
 finally{if(btn)btn.disabled=false;$('#boot').classList.add('hide')}
}
async function boot(){
 try{
  const r=await fetch('/api/auth/me',{cache:'no-store'});if(!r.ok)return location.replace('/login');const j=await r.json();state.user=j.user;
  $('#userName').textContent=state.user.name||state.user.username;$('#userRole').textContent=state.user.role||'';
  if(state.user.image){$('#userPhoto').src=state.user.image;$('#userPhoto').hidden=false}
  applyPermissions();
  await loadData(false);
 }catch(e){location.replace('/login')}
}
$$('.nav-item').forEach(item=>item.addEventListener('click',()=>openPage(item.dataset.page)));
$$('.nav-group-head').forEach(h=>h.addEventListener('click',()=>h.closest('.nav-group').classList.toggle('is-open')));
$('#navSearch').addEventListener('input',e=>{const q=norm(e.target.value);$$('.nav-item').forEach(x=>x.classList.toggle('search-hidden',!!q&&!norm(x.textContent).includes(q)));$$('.nav-group').forEach(g=>{if(q&&$$('.nav-item:not(.search-hidden)',g).length)g.classList.add('is-open')})});
$('#navClear').addEventListener('click',()=>{$('#navSearch').value='';$('#navSearch').dispatchEvent(new Event('input'))});
$('#sidebarToggle').addEventListener('click',()=>{document.body.classList.toggle('sidebar-collapsed');localStorage.setItem('vd.urgent.sidebar.collapsed',document.body.classList.contains('sidebar-collapsed')?'1':'0')});
if(localStorage.getItem('vd.urgent.sidebar.collapsed')==='1')document.body.classList.add('sidebar-collapsed');
$('#refreshBtn').addEventListener('click',()=>loadData(true));
$('#clearFiltersBtn').addEventListener('click',()=>{pageFilterDefs().forEach(d=>state.filters.delete(filterKey(d.field)));renderPage();toast('تمت إعادة تعيين الفلاتر')});
$('#printBtn').addEventListener('click',printCurrent);
$('#logoutBtn').addEventListener('click',async()=>{await fetch('/api/auth/logout',{method:'POST'});location.replace('/login')});
$('#themeBtn').addEventListener('click',()=>{state.theme=(state.theme+1)%3;document.body.classList.remove('theme-soft','theme-sand');if(state.theme===1)document.body.classList.add('theme-soft');if(state.theme===2)document.body.classList.add('theme-sand');localStorage.setItem('vd.urgent.theme',String(state.theme))});
state.theme=Number(localStorage.getItem('vd.urgent.theme')||0)%3;if(state.theme===1)document.body.classList.add('theme-soft');if(state.theme===2)document.body.classList.add('theme-sand');
boot();
})();