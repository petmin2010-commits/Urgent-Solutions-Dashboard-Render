(()=>{'use strict';

const SMART_PAGES=new Set(['smartCenter','temporalMemory','investigationRoom','explainableDecision','smartThursday']);
const HISTORY_KEY='vd.urgent.smart.history.v2';
const THURSDAY_KEY='vd.urgent.smart.thursday.v2';
const SNAPSHOT_INTERVAL=15*60*1000;
const MAX_HISTORY=96;

const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const clean=v=>String(v==null?'':v).replace(/\s+/g,' ').trim();
const norm=v=>clean(v).normalize('NFKC').replace(/[\u064B-\u065F\u0670]/g,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').toLowerCase();
const num=v=>Number(v||0);
const fmt=v=>new Intl.NumberFormat('en-US',{maximumFractionDigits:1}).format(num(v));
const pct=(a,b)=>b?Math.round(a/b*1000)/10:0;
const nowLabel=d=>new Date(d||Date.now()).toLocaleString('ar-SA',{dateStyle:'medium',timeStyle:'short'});
const dateLabel=d=>new Date(d||Date.now()).toLocaleDateString('ar-SA',{dateStyle:'medium'});
const state=()=>window.VDUrgent?.getState?.()||{};
const rawData=()=>state().data||window.__urgentDashboardData||{};
function scopedData(raw=rawData()){
 const page=state().page||'';
 const filterRows=window.VDUrgent?.filterRows;
 if(!SMART_PAGES.has(page)||typeof filterRows!=='function')return raw;
 const projects=filterRows(raw.projects||[]);
 const projectNos=new Set(projects.map(x=>clean(x.no)).filter(Boolean));
 const projectPairs=new Set(projects.map(x=>clean(x.owner)+'||'+clean(x.contractor)).filter(x=>x!=='||'));
 const inProjectScope=r=>{
  const no=clean(r.projectNo||r.no),pair=clean(r.owner||r.projectOwner)+'||'+clean(r.contractor||r.helperContractor);
  if(no&&projectNos.size)return projectNos.has(no);
  if(pair!=='||'&&projectPairs.size)return projectPairs.has(pair);
  return true;
 };
 const permits=filterRows(raw.actualPermits||[]).filter(inProjectScope);
 const lines=filterRows(raw.lines||[]).filter(inProjectScope);
 const settlements=filterRows(raw.settlements||[]).filter(inProjectScope);
 const quality=filterRows(raw.quality||[]);
 const complaints=filterRows(raw.complaints||[]);
 const permitMeters=permits.reduce((a,x)=>a+num(x.meters),0),lineMeters=lines.reduce((a,x)=>a+num(x.length),0);
 const due=settlements.reduce((a,x)=>a+num(x.dueMeters),0),done=settlements.reduce((a,x)=>a+num(x.executedMeters),0);
 const highRiskProjects=projects.filter(x=>['حرج','مرتفع'].includes(clean(x.riskLevel))).length;
 const designPending=lines.filter(x=>/جاري|قيد/i.test(clean(x.designStatus))&&!x.approvalDate).length;
 let expired=0,expiring=0,valid=0,unknown=0;
 permits.forEach(x=>{const d=Number(x.expiryDays);if(Number.isFinite(d)){if(d<0)expired++;else if(d<=7)expiring++;else valid++;}else if(norm(x.expiryBand).includes('منتهي'))expired++;else unknown++;});
 const summaries={...(raw.summaries||{}),projects:projects.length,actualPermits:permits.length,permitMeters,lines:lines.length,lineMeters,
  grossCoveragePct:pct(lineMeters,permitMeters),matchedCoveragePct:pct(done,due),matchedGap:Math.round((due-done)*10)/10,
  highRiskProjects,qualityIssues:quality.length,complaints:complaints.length,designPending};
 const management={...(raw.management||{}),handoverReadiness:{...(raw.management?.handoverReadiness||{}),linesWithHandover:lines.filter(x=>x.handoverDate||x.handoverLetter).length}};
 return {...raw,projects,actualPermits:permits,lines,settlements,quality,complaints,summaries,permitTiming:{...(raw.permitTiming||{}),expired,expiring,valid,unknown},management};
}
const data=()=>scopedData(rawData());
const host=()=>document.getElementById('urgentSmartSuiteHost');

function safeParse(raw,fallback){try{return JSON.parse(raw)}catch{return fallback}}
function history(){const h=safeParse(localStorage.getItem(HISTORY_KEY),[]);return Array.isArray(h)?h:[]}
function saveHistory(h){try{localStorage.setItem(HISTORY_KEY,JSON.stringify(h.slice(-MAX_HISTORY)))}catch{}}
function metricSnapshot(d=data()){
 const s=d.summaries||{},p=d.permitTiming||{},m=d.management||{};
 return {
  capturedAt:Date.now(),sourceAt:d.updatedAt||new Date().toISOString(),
  projects:num(s.projects),permits:num(s.actualPermits),permitMeters:num(s.permitMeters),
  lines:num(s.lines),lineMeters:num(s.lineMeters),coverage:num(s.matchedCoveragePct||s.grossCoveragePct),
  highRisk:num(s.highRiskProjects),expired:num(p.expired),expiring:num(p.expiring),
  quality:num(s.qualityIssues),complaints:num(s.complaints),designPending:num(s.designPending),
  gap:num(s.matchedGap),handover:num(m.handoverReadiness?.linesWithHandover)
 };
}
function captureSnapshot(force=false){
 if(!force&&window.VDUrgent?.activeFilterCount?.()>0)return;
 const d=data();if(!d||!d.summaries)return;
 const h=history(),snap=metricSnapshot(d),last=h[h.length-1];
 if(!force&&last&&snap.capturedAt-num(last.capturedAt)<SNAPSHOT_INTERVAL)return;
 h.push(snap);saveHistory(h);
 maybeSaveThursday(snap);
}
function weekKey(ts=Date.now()){
 const d=new Date(ts),day=d.getDay(),diff=(day+2)%7;
 const thu=new Date(d);thu.setHours(0,0,0,0);thu.setDate(d.getDate()-diff+6);
 return thu.toISOString().slice(0,10);
}
function weekWindow(ts=Date.now()){
 const d=new Date(ts);d.setHours(0,0,0,0);
 const day=d.getDay(),sinceFriday=(day+2)%7;
 const from=new Date(d);from.setDate(d.getDate()-sinceFriday);
 const to=new Date(from);to.setDate(from.getDate()+6);
 return {from,to};
}
function maybeSaveThursday(snap){
 const d=new Date(),isThu=d.getDay()===4;if(!isThu)return;
 const store=safeParse(localStorage.getItem(THURSDAY_KEY),{}),key=weekKey();
 if(!store[key]){store[key]=snap;try{localStorage.setItem(THURSDAY_KEY,JSON.stringify(store))}catch{}}
}
function previousSnapshot(){
 const h=history();return h.length>1?h[h.length-2]:null;
}
function previousThursday(){
 const store=safeParse(localStorage.getItem(THURSDAY_KEY),{});
 const keys=Object.keys(store).sort();
 const current=weekKey();
 for(let i=keys.length-1;i>=0;i--)if(keys[i]<current)return store[keys[i]];
 return previousSnapshot();
}
function diffText(current,previous,key,label,invert=false){
 if(!previous)return label+': لا يوجد خط أساس سابق';
 const d=num(current[key])-num(previous[key]);if(!d)return label+': دون تغير';
 const good=invert?d<0:d>0;
 return label+' '+(d>0?'↑ +':'↓ ')+fmt(d)+(good?' ✓':'');
}
function riskScore(p,d=data()){
 let score=0,reasons=[];
 const level=norm(p.riskLevel);
 if(level.includes('حرج')){score+=38;reasons.push('تصنيف المخاطر حرج')}
 else if(level.includes('مرتفع')){score+=28;reasons.push('تصنيف المخاطر مرتفع')}
 else if(level.includes('متوسط'))score+=12;
 const permit=norm(p.permitStatus);
 if(permit.includes('منتهي')||num(p.permitDays)<0){score+=20;reasons.push('التصريح منتهي')}
 else if(permit.includes('تحت الاصدار')){score+=12;reasons.push('التصريح تحت الإصدار')}
 else if(num(p.permitDays)>0&&num(p.permitDays)<=7){score+=10;reasons.push('التصريح أوشك على الانتهاء')}
 const g=norm(p.guaranteeStatus);
 if(g.includes('منتهي')||num(p.guaranteeDays)<0){score+=16;reasons.push('الضمان منتهي')}
 else if(num(p.guaranteeDays)>0&&num(p.guaranteeDays)<=30){score+=8;reasons.push('الضمان قريب الانتهاء')}
 const ep=norm(p.extensionPressure);
 if(ep.includes('حرج')||ep.includes('مرتفع')){score+=12;reasons.push('ضغط تمديدات مرتفع')}
 if(!(num(p.lat)>20&&num(p.lat)<23&&num(p.lon)>38&&num(p.lon)<41)){score+=5;reasons.push('إحداثيات غير مكتملة')}
 const st=(d.settlements||[]).find(x=>clean(x.owner)===clean(p.owner)&&clean(x.contractor)===clean(p.contractor));
 if(st&&num(st.balance)>0){score+=Math.min(18,5+Math.round(num(st.balance)/500));reasons.push('فجوة أمتار '+fmt(st.balance)+' م')}
 if(clean(p.contractStatus).includes('منتهي')&&!p.handoverNo){score+=7;reasons.push('العقد منتهي دون خطاب تسليم')}
 return {score:Math.min(100,score),reasons};
}
function topRiskProjects(d=data(),limit=12){
 return (d.projects||[]).map(p=>({p,...riskScore(p,d)})).sort((a,b)=>b.score-a.score).slice(0,limit);
}
function health(d=data()){
 const s=d.summaries||{},p=d.permitTiming||{};
 let score=100;
 score-=Math.min(28,pct(num(s.highRiskProjects),num(s.projects))*0.7);
 score-=Math.min(22,pct(num(p.expired),num(s.actualPermits))*0.65);
 score-=Math.min(18,pct(num(s.qualityIssues),Math.max(1,num(s.projects)+num(s.lines)))*0.45);
 score-=Math.min(18,Math.max(0,100-num(s.matchedCoveragePct||s.grossCoveragePct))*0.18);
 score-=Math.min(14,pct(num(s.designPending),Math.max(1,num(s.lines)))*0.35);
 return Math.max(0,Math.round(score));
}
function severity(score){return score>=70?'حرج':score>=45?'مرتفع':score>=20?'متوسط':'منخفض'}
function kpi(label,value,sub='',tone=''){return '<article class="us-kpi '+tone+'"><span>'+esc(label)+'</span><strong>'+esc(value)+'</strong><small>'+esc(sub)+'</small></article>'}
function panel(title,sub,body,extra=''){return '<article class="us-panel"><div class="us-panel-head"><div><small>'+esc(sub)+'</small><h3>'+esc(title)+'</h3></div>'+extra+'</div>'+body+'</article>'}
function empty(msg){return '<div class="us-empty">'+esc(msg)+'</div>'}
function openPage(page){window.VDUrgent?.openPage?.(page)}
function smartHeader(eyebrow,title,desc,action=''){
 return '<section class="us-smart-hero"><div><small>'+esc(eyebrow)+'</small><h2>'+esc(title)+'</h2><p>'+esc(desc)+'</p></div>'+action+'</section>';
}
function updateFilterVisibility(page){
 const bar=document.getElementById('filterBar');if(bar&&SMART_PAGES.has(page))bar.style.display='block';
}

function renderCenter(){
 const h=host(),d=data(),s=d.summaries||{},pt=d.permitTiming||{},prev=previousSnapshot(),cur=metricSnapshot(d),risks=topRiskProjects(d,8),hs=health(d);
 h.innerHTML=smartHeader('SMART PROJECT INTELLIGENCE','مركز التحليل الذكي','مركز موحد لقراءة الوضع الحالي، التغيرات، المخاطر والقرارات المطلوبة في مشاريع الحلول العاجلة.','<button class="us-primary" id="usRefreshSmart">↻ إعادة التحليل</button>')+
 '<div class="us-kpis">'+
 kpi('صحة المحفظة',hs+'%',hs>=75?'مستقرة':hs>=55?'تحتاج متابعة':'تحتاج تدخل','health')+
 kpi('المشاريع',fmt(s.projects),'إجمالي المشروعات')+
 kpi('المخاطر العالية',fmt(s.highRiskProjects),'حرج + مرتفع','danger')+
 kpi('التصاريح المنتهية',fmt(pt.expired),'تحتاج معالجة','warn')+
 kpi('فجوة الأمتار',fmt(s.matchedGap)+' م','المستحق - المنفذ')+
 kpi('ملاحظات الجودة',fmt(s.qualityIssues),'ملاحظات تدقيق البيانات')+'</div>'+
 '<div class="us-grid two">'+
 panel('ماذا تغير منذ آخر قراءة؟','CHANGE DETECTION','<div class="us-change-list">'+[
   diffText(cur,prev,'highRisk','المخاطر العالية',true),diffText(cur,prev,'expired','التصاريح المنتهية',true),
   diffText(cur,prev,'quality','ملاحظات الجودة',true),diffText(cur,prev,'lineMeters','أمتار الخطوط'),
   diffText(cur,prev,'coverage','نسبة التغطية')
 ].map((x,i)=>'<div><b>'+(i+1)+'</b><span>'+esc(x)+'</span></div>').join('')+'</div>','<button class="us-mini" id="usCapture">حفظ لقطة الآن</button>')+
 panel('القرارات ذات الأولوية','PRIORITY ACTIONS','<div class="us-action-list">'+priorityActions(d).map((x,i)=>'<div><b>'+String(i+1).padStart(2,'0')+'</b><span><strong>'+esc(x.title)+'</strong><small>'+esc(x.text)+'</small></span></div>').join('')+'</div>')+
 '</div>'+
 panel('أعلى المشروعات أولوية','TOP RISK PROJECTS',riskTable(risks),'<button class="us-mini" data-smart-open="explainableDecision">فتح محرك القرار</button>')+
 '<div class="us-smart-links"><button data-smart-open="temporalMemory">◷ ذاكرة المشروع الزمنية</button><button data-smart-open="investigationRoom">⌕ غرفة التحقيق الذكية</button><button data-smart-open="explainableDecision">⚖ محرك القرار المفسر</button><button data-smart-open="smartThursday">▣ تقرير الخميس الذكي</button><button data-smart-open="risks">⚠ مخاطر المشاريع</button><button data-smart-open="analytics">⌁ التحليل التنفيذي</button></div>';
 document.getElementById('usRefreshSmart')?.addEventListener('click',()=>{captureSnapshot(true);renderCenter()});
 document.getElementById('usCapture')?.addEventListener('click',()=>{captureSnapshot(true);renderCenter();window.VDUrgent?.toast?.('تم حفظ لقطة زمنية جديدة')});
 wireOpenButtons();
}
function priorityActions(d){
 const s=d.summaries||{},pt=d.permitTiming||{},arr=[];
 if(num(s.highRiskProjects)>0)arr.push({title:'المشاريع الحرجة أولًا',text:'مراجعة '+fmt(s.highRiskProjects)+' مشروعًا ضمن المستوى الحرج/المرتفع وربط كل حالة بإجراء وتاريخ إغلاق.'});
 if(num(pt.expired)>0)arr.push({title:'معالجة التصاريح المنتهية',text:'يوجد '+fmt(pt.expired)+' تصريحًا منتهيًا؛ ابدأ بالأعلى أمتارًا والأقرب للتنفيذ.'});
 if(num(s.matchedGap)>0)arr.push({title:'إغلاق فجوة الأمتار',text:'الفجوة الحالية '+fmt(s.matchedGap)+' م بين المستحق والمنفذ على مستوى المطابقات.'});
 if(num(s.designPending)>0)arr.push({title:'تسريع الاعتمادات التصميمية',text:'يوجد '+fmt(s.designPending)+' خطًا قيد التصميم/الاعتماد.'});
 if(num(s.qualityIssues)>0)arr.push({title:'رفع جودة البيانات',text:'إغلاق '+fmt(s.qualityIssues)+' ملاحظة جودة قبل الاعتماد على المؤشرات في القرارات النهائية.'});
 if(!arr.length)arr.push({title:'استمرار المتابعة',text:'لا توجد إشارات حرجة في المؤشرات الرئيسية حاليًا؛ استمر في التحديث والمراجعة الأسبوعية.'});
 return arr.slice(0,5);
}
function riskTable(rows){
 if(!rows.length)return empty('لا توجد حالات مخاطرة قابلة للعرض.');
 return '<div class="us-table-wrap"><table><thead><tr><th>الأولوية</th><th>المشروع</th><th>البلدية</th><th>المقاول</th><th>السبب</th></tr></thead><tbody>'+
 rows.map(x=>'<tr><td><span class="us-score '+(x.score>=70?'red':x.score>=45?'amber':'blue')+'">'+x.score+'</span></td><td><b>'+esc(x.p.no||x.p.name||'—')+'</b><small>'+esc(x.p.name||'')+'</small></td><td>'+esc(x.p.municipality||'—')+'</td><td>'+esc(x.p.contractor||'—')+'</td><td>'+esc(x.reasons.slice(0,3).join(' • ')||'متابعة عامة')+'</td></tr>').join('')+
 '</tbody></table></div>';
}

function renderMemory(){
 const h=host(),hist=history(),cur=metricSnapshot(data()),first=hist[0],prev=hist[hist.length-1],trend=memoryFindings(hist);
 h.innerHTML=smartHeader('PROJECT TEMPORAL MEMORY • 15 MIN SNAPSHOTS','ذاكرة المشروع الزمنية','تُنشئ لقطة للمؤشرات كل 15 دقيقة عند وجود قراءة جديدة، وتستخدمها لاكتشاف بداية التغير وتفسير الاتجاه.','<button class="us-primary" id="usMemorySnap">＋ حفظ لقطة الآن</button>')+
 '<div class="us-kpis">'+kpi('عدد اللقطات',fmt(hist.length),'محفوظة على هذا الجهاز')+kpi('أول لقطة',first?dateLabel(first.capturedAt):'—','بداية الذاكرة')+kpi('آخر لقطة',cur?nowLabel(cur.capturedAt):'—','آخر قراءة')+kpi('المخاطر الحالية',fmt(cur.highRisk),'عالية/حرجة','danger')+kpi('التصاريح المنتهية',fmt(cur.expired),'الحالة الحالية','warn')+kpi('جودة البيانات',fmt(cur.quality),'ملاحظات حالية')+'</div>'+
 '<div class="us-grid two">'+
 panel('الاستنتاجات الزمنية','TEMPORAL FINDINGS',trend.map(x=>'<div class="us-finding"><b>'+esc(x.title)+'</b><span>'+esc(x.text)+'</span></div>').join('')||empty('لا توجد لقطات كافية لبناء اتجاه زمني.'))+
 panel('مقارنة آخر لقطة بالسابق','LATEST DELTA','<div class="us-change-list">'+[
   diffText(cur,prev,'highRisk','المخاطر العالية',true),diffText(cur,prev,'expired','التصاريح المنتهية',true),
   diffText(cur,prev,'quality','ملاحظات الجودة',true),diffText(cur,prev,'coverage','نسبة التغطية'),diffText(cur,prev,'lineMeters','الأمتار المنفذة')
 ].map((x,i)=>'<div><b>'+(i+1)+'</b><span>'+esc(x)+'</span></div>').join('')+'</div>')+
 '</div>'+
 panel('سجل اللقطات','SNAPSHOT HISTORY',historyTable(hist));
 document.getElementById('usMemorySnap')?.addEventListener('click',()=>{captureSnapshot(true);renderMemory();window.VDUrgent?.toast?.('تم حفظ لقطة جديدة')});
}
function memoryFindings(hist){
 if(hist.length<2)return [];
 const first=hist[0],last=hist[hist.length-1],out=[];
 const keys=[['highRisk','المخاطر العالية',true],['expired','التصاريح المنتهية',true],['quality','ملاحظات الجودة',true],['coverage','نسبة التغطية',false],['lineMeters','أمتار الخطوط',false]];
 keys.forEach(([k,label,invert])=>{const d=num(last[k])-num(first[k]);if(d!==0)out.push({title:label,text:'من '+fmt(first[k])+' إلى '+fmt(last[k])+' ('+(d>0?'+':'')+fmt(d)+'). '+((invert&&d>0)||(!invert&&d<0)?'اتجاه يحتاج متابعة.':'الاتجاه تحسن أو مستقر نسبيًا.')})});
 const deterioration=hist.find((x,i)=>i>0&&(num(x.highRisk)>num(hist[i-1].highRisk)||num(x.expired)>num(hist[i-1].expired)||num(x.quality)>num(hist[i-1].quality)));
 if(deterioration)out.unshift({title:'أول إشارة تدهور محفوظة',text:'ظهرت في '+nowLabel(deterioration.capturedAt)+' مقارنة باللقطة السابقة.'});
 return out.slice(0,6);
}
function historyTable(hist){
 if(!hist.length)return empty('لا توجد لقطات بعد.');
 return '<div class="us-table-wrap"><table><thead><tr><th>الوقت</th><th>المشاريع</th><th>مخاطر عالية</th><th>منتهية</th><th>الجودة</th><th>التغطية %</th><th>أمتار الخطوط</th></tr></thead><tbody>'+
 [...hist].reverse().slice(0,30).map(x=>'<tr><td>'+esc(nowLabel(x.capturedAt))+'</td><td>'+fmt(x.projects)+'</td><td>'+fmt(x.highRisk)+'</td><td>'+fmt(x.expired)+'</td><td>'+fmt(x.quality)+'</td><td>'+fmt(x.coverage)+'</td><td>'+fmt(x.lineMeters)+'</td></tr>').join('')+
 '</tbody></table></div>';
}

function phenomenonRows(kind,d=data()){
 if(kind==='risk')return (d.projects||[]).filter(p=>riskScore(p,d).score>=45).map(p=>({...p,_weight:riskScore(p,d).score,_source:'مشروع'}));
 if(kind==='expired')return (d.actualPermits||[]).filter(p=>norm(p.expiryBand).includes('منتهي')).map(p=>({...p,_weight:Math.max(1,num(p.meters)),_source:'تصريح'}));
 if(kind==='quality')return (d.quality||[]).map(q=>({...q,_weight:1,_source:'جودة'}));
 if(kind==='guarantee')return (d.projects||[]).filter(p=>num(p.guaranteeDays)<0||norm(p.guaranteeStatus).includes('منتهي')||(num(p.guaranteeDays)>0&&num(p.guaranteeDays)<=30)).map(p=>({...p,_weight:1,_source:'ضمان'}));
 if(kind==='gap')return (d.settlements||[]).filter(x=>num(x.balance)>0).map(x=>({...x,_weight:num(x.balance),_source:'تسوية'}));
 if(kind==='design')return (d.lines||[]).filter(x=>num(x.designAgeDays)>30||(/جاري|قيد/.test(clean(x.designStatus))&&!x.approvalDate)).map(x=>({...x,_weight:Math.max(1,num(x.designAgeDays)),_source:'خط بديل'}));
 return [];
}
function dimensionValue(r,dim){
 if(dim==='source')return clean(r._source)||'غير محدد';
 if(dim==='municipality')return clean(r.municipality||r.helperMunicipality)||'غير محدد';
 if(dim==='contractor')return clean(r.contractor||r.helperContractor)||'غير محدد';
 if(dim==='owner')return clean(r.owner||r.projectOwner)||'غير محدد';
 if(dim==='category')return clean(r.category||r.type||r.projectType)||'غير محدد';
 return 'غير محدد';
}
function aggregateInvestigation(rows,dim){
 const m=new Map();rows.forEach(r=>{const k=dimensionValue(r,dim),x=m.get(k)||{key:k,count:0,weight:0};x.count++;x.weight+=num(r._weight)||1;m.set(k,x)});
 return [...m.values()].sort((a,b)=>b.weight-a.weight||b.count-a.count);
}
function renderInvestigation(){
 const h=host();
 h.innerHTML=smartHeader('AUTOMATED INVESTIGATION ROOM','غرفة التحقيق الذكية','اختر الظاهرة والبُعد؛ النظام يقسم الحالات ويحدد أعلى تركّز وأقوى مساهمة في المشكلة.')+
 '<article class="us-investigate-controls"><label><span>الظاهرة</span><select id="usPhenomenon"><option value="risk">المشاريع عالية المخاطر</option><option value="expired">التصاريح المنتهية</option><option value="quality">ملاحظات جودة البيانات</option><option value="guarantee">مخاطر الضمانات</option><option value="gap">فجوات الأمتار</option><option value="design">تأخر التصميم والاعتماد</option></select></label><label><span>التقسيم</span><select id="usDimension"><option value="municipality">البلدية</option><option value="contractor">المقاول</option><option value="owner">المالك</option><option value="category">النوع / التصنيف</option><option value="source">المصدر</option></select></label><button class="us-primary" id="usRunInvestigation">ابدأ التحقيق</button></article>'+
 '<div id="usInvestigationResult"></div>';
 const run=()=>{
  const kind=document.getElementById('usPhenomenon').value,dim=document.getElementById('usDimension').value,rows=phenomenonRows(kind),groups=aggregateInvestigation(rows,dim),totalWeight=groups.reduce((a,x)=>a+x.weight,0),top=groups[0],concentration=top?pct(top.weight,totalWeight):0;
  document.getElementById('usInvestigationResult').innerHTML=
   '<div class="us-kpis">'+kpi('الحالات',fmt(rows.length),'ضمن الظاهرة المختارة')+kpi('المجموع المرجح',fmt(totalWeight),'بحسب نوع الظاهرة')+kpi('أعلى تركّز',top?top.key:'—',top?fmt(concentration)+'% من الأثر':'لا توجد بيانات','warn')+kpi('عدد المجموعات',fmt(groups.length),'بعد التقسيم')+'</div>'+
   '<div class="us-grid two">'+panel('أعلى مسببات/مناطق التركّز','ROOT CAUSE SPLIT',groups.slice(0,12).map((x,i)=>'<div class="us-bar-row"><span><b>'+esc(x.key)+'</b><small>'+fmt(x.count)+' حالة</small></span><div><i style="width:'+Math.max(4,pct(x.weight,totalWeight))+'%"></i></div><strong>'+fmt(pct(x.weight,totalWeight))+'%</strong></div>').join('')||empty('لا توجد حالات لهذه الظاهرة.'))+
   panel('الاستنتاج التفسيري','INVESTIGATION FINDING',top?'<div class="us-investigation-note"><b>المجموعة الأعلى أثرًا: '+esc(top.key)+'</b><p>تمثل '+fmt(concentration)+'% من الأثر المرجح، بعدد '+fmt(top.count)+' حالة. يوصى بفتح الحالات التابعة لهذه المجموعة أولًا ثم مقارنة الأسباب المشتركة بينها.</p><button class="us-mini" data-smart-open="explainableDecision">تحويل إلى محرك القرار</button></div>':empty('لا توجد بيانات كافية لبناء استنتاج.'))+'</div>'+
   panel('تفاصيل المجموعات','BREAKDOWN TABLE','<div class="us-table-wrap"><table><thead><tr><th>#</th><th>المجموعة</th><th>عدد الحالات</th><th>الأثر المرجح</th><th>المساهمة</th></tr></thead><tbody>'+groups.slice(0,30).map((x,i)=>'<tr><td>'+(i+1)+'</td><td><b>'+esc(x.key)+'</b></td><td>'+fmt(x.count)+'</td><td>'+fmt(x.weight)+'</td><td>'+fmt(pct(x.weight,totalWeight))+'%</td></tr>').join('')+'</tbody></table></div>');
  wireOpenButtons();
 };
 document.getElementById('usRunInvestigation').addEventListener('click',run);run();
}

function decisionAction(item){
 const r=item.reasons.join(' • ');
 if(r.includes('التصريح منتهي'))return 'تجديد/معالجة التصريح وربط الإجراء بموعد التنفيذ قبل استمرار الأعمال.';
 if(r.includes('فجوة أمتار'))return 'مراجعة الأمتار المستحقة والمنفذة مع المقاول والمالك وإغلاق فرق التسوية.';
 if(r.includes('الضمان منتهي'))return 'استكمال تمديد/استبدال الضمان قبل أي التزام مالي أو تسليم.';
 if(r.includes('ضغط تمديدات'))return 'تأكيد خطة التنفيذ والموارد ومتابعة أثر ضغط التمديدات أسبوعيًا.';
 if(r.includes('إحداثيات'))return 'استكمال الإحداثيات ومراجعة الربط الجغرافي قبل اعتماد التحليل المكاني.';
 return 'تثبيت مسؤول وتاريخ إغلاق للحالة ومراجعتها في تقرير الخميس الذكي.';
}
function renderDecision(){
 const h=host(),all=topRiskProjects(data(),100);
 h.innerHTML=smartHeader('EXPLAINABLE DECISION ENGINE','محرك القرار المفسر','لا يكتفي بدرجة أولوية؛ يعرض سبب الدرجة والأدلة التشغيلية والإجراء المقترح لكل مشروع.')+
 '<article class="us-decision-tools"><label><span>بحث بالمشروع / المقاول / البلدية</span><input id="usDecisionSearch" type="search" placeholder="اكتب كلمة للبحث..."></label><label><span>الحد الأدنى للأولوية</span><select id="usDecisionLevel"><option value="0">الكل</option><option value="20">20+</option><option value="45" selected>45+</option><option value="70">70+</option></select></label><button class="us-primary" id="usDecisionApply">تطبيق</button></article><div id="usDecisionResult"></div>';
 const run=()=>{
  const q=norm(document.getElementById('usDecisionSearch').value),min=num(document.getElementById('usDecisionLevel').value);
  const rows=all.filter(x=>x.score>=min&&(!q||norm([x.p.no,x.p.name,x.p.contractor,x.p.owner,x.p.municipality].join(' ')).includes(q)));
  document.getElementById('usDecisionResult').innerHTML='<div class="us-kpis">'+kpi('الحالات المطابقة',fmt(rows.length),'بعد البحث والحد الأدنى')+kpi('الأولوية الحرجة',fmt(rows.filter(x=>x.score>=70).length),'درجة 70 فأعلى','danger')+kpi('الأولوية المرتفعة',fmt(rows.filter(x=>x.score>=45&&x.score<70).length),'درجة 45–69','warn')+kpi('متوسط الدرجة',fmt(rows.length?rows.reduce((a,x)=>a+x.score,0)/rows.length:0),'من 100')+'</div>'+
  '<div class="us-decision-grid">'+rows.slice(0,24).map(x=>'<article class="us-decision-card"><div class="us-decision-head"><div><small>'+esc(x.p.no||'مشروع')+'</small><h3>'+esc(x.p.name||x.p.no||'مشروع بدون اسم')+'</h3><p>'+esc([x.p.municipality,x.p.contractor].filter(Boolean).join(' • '))+'</p></div><span class="us-big-score '+(x.score>=70?'red':x.score>=45?'amber':'blue')+'"><b>'+x.score+'</b><small>'+severity(x.score)+'</small></span></div><div class="us-reasons">'+x.reasons.map(r=>'<span>'+esc(r)+'</span>').join('')+'</div><div class="us-next"><small>الإجراء المقترح</small><b>'+esc(decisionAction(x))+'</b></div></article>').join('')+'</div>';
 };
 document.getElementById('usDecisionApply').addEventListener('click',run);document.getElementById('usDecisionSearch').addEventListener('input',run);run();
}

function renderThursday(){
 const h=host(),d=data(),s=d.summaries||{},pt=d.permitTiming||{},cur=metricSnapshot(d),prev=previousThursday(),w=weekWindow(),actions=priorityActions(d);
 h.innerHTML=smartHeader('FRIDAY → THURSDAY EXECUTIVE REVIEW','تقرير الخميس الذكي','ملخص أسبوعي للإدارة: الوضع الحالي، ما تغير منذ خط الأساس السابق، المخاطر والقرارات المطلوبة.','<button class="us-primary" id="usSaveThursday">حفظ خط أساس الخميس</button>')+
 '<div class="us-week-window"><span>الفترة الأسبوعية</span><b>'+esc(dateLabel(w.from))+' → '+esc(dateLabel(w.to))+'</b><small>يتم استخدام أحدث خط أساس محفوظ للمقارنة عند توفره.</small></div>'+
 '<div class="us-kpis">'+kpi('المشاريع',fmt(s.projects),'إجمالي')+kpi('المخاطر العالية',fmt(s.highRiskProjects),'حرج + مرتفع','danger')+kpi('التصاريح المنتهية',fmt(pt.expired),'الحالة الحالية','warn')+kpi('التغطية المطابقة',fmt(s.matchedCoveragePct)+'%','أمتار منفذة/مستحقة')+kpi('جودة البيانات',fmt(s.qualityIssues),'ملاحظة')+kpi('التصميم قيد المتابعة',fmt(s.designPending),'خط بديل')+'</div>'+
 '<div class="us-grid two">'+
 panel('ما تغير منذ الخميس السابق','WEEKLY DELTA','<div class="us-change-list">'+[
  diffText(cur,prev,'highRisk','المخاطر العالية',true),diffText(cur,prev,'expired','التصاريح المنتهية',true),
  diffText(cur,prev,'quality','ملاحظات الجودة',true),diffText(cur,prev,'coverage','التغطية'),diffText(cur,prev,'lineMeters','أمتار الخطوط')
 ].map((x,i)=>'<div><b>'+(i+1)+'</b><span>'+esc(x)+'</span></div>').join('')+'</div>')+
 panel('قرارات مطلوبة للأسبوع القادم','NEXT WEEK DECISIONS','<div class="us-action-list">'+actions.map((x,i)=>'<div><b>'+String(i+1).padStart(2,'0')+'</b><span><strong>'+esc(x.title)+'</strong><small>'+esc(x.text)+'</small></span></div>').join('')+'</div>')+
 '</div>'+
 panel('أعلى الحالات التي تتطلب متابعة','WEEKLY PRIORITIES',riskTable(topRiskProjects(d,10)))+
 panel('ملاحظات التقرير','METHODOLOGY','<div class="us-method">التقرير مبني على آخر بيانات محملة من Google Sheets في الداشبورد. نافذة المتابعة الأسبوعية من الجمعة إلى الخميس. المقارنة تعتمد على خط أساس الخميس المحفوظ عند توفره، وإلا تستخدم أحدث لقطة زمنية سابقة. لا يتم اعتبار درجة المخاطر قرارًا نهائيًا دون مراجعة المستندات والحالة الفعلية.</div>');
 document.getElementById('usSaveThursday')?.addEventListener('click',()=>{const store=safeParse(localStorage.getItem(THURSDAY_KEY),{});store[weekKey()]=metricSnapshot(d);localStorage.setItem(THURSDAY_KEY,JSON.stringify(store));captureSnapshot(true);renderThursday();window.VDUrgent?.toast?.('تم حفظ خط أساس تقرير الخميس')});
}

function wireOpenButtons(){
 host()?.querySelectorAll('[data-smart-open]').forEach(b=>b.addEventListener('click',()=>openPage(b.dataset.smartOpen)));
}
function renderSmartPage(page){
 const h=host();if(!h)return;
 captureSnapshot(false);
 if(page==='smartCenter')renderCenter();
 else if(page==='temporalMemory')renderMemory();
 else if(page==='investigationRoom')renderInvestigation();
 else if(page==='explainableDecision')renderDecision();
 else if(page==='smartThursday')renderThursday();
}
function onPage(){
 const page=state().page||'';updateFilterVisibility(page);
 if(SMART_PAGES.has(page))requestAnimationFrame(()=>renderSmartPage(page));
}
window.addEventListener('vd:urgent-data',()=>captureSnapshot(false));
window.addEventListener('vd:page-rendered',onPage);
document.addEventListener('DOMContentLoaded',onPage);
})();