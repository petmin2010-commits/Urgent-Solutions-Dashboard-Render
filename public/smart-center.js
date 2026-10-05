(()=>{'use strict';

const SMART_PAGES=new Set(['smartCenter','temporalMemory','investigationRoom','explainableDecision','smartThursday']);
const HISTORY_KEY='vd.urgent.smart.history.v3';
const SNAPSHOT_INTERVAL=15*60*1000;
const MAX_HISTORY=96;
let memoryChart=null,centralHistory=null,centralSyncAt=0,centralPromise=null,thursdayCentral=null,thursdaySyncAt=0,thursdayPromise=null;

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
const host=()=>document.getElementById('urgentSmartSuiteHost');

async function rpc(method,args=[]){
 const r=await fetch('/api/rpc',{method:'POST',headers:{'Content-Type':'application/json','Cache-Control':'no-cache'},cache:'no-store',body:JSON.stringify({method,args})});
 const j=await r.json().catch(()=>({}));
 if(!r.ok||j.ok===false)throw new Error(j.message||j.error||('HTTP '+r.status));
 return j.result||j;
}
function scopedData(raw=rawData()){
 const page=state().page||'',filterRows=window.VDUrgent?.filterRows;
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
 const permits=filterRows(raw.actualPermits||[]).filter(inProjectScope),lines=filterRows(raw.lines||[]).filter(inProjectScope),settlements=filterRows(raw.settlements||[]).filter(inProjectScope);
 const quality=filterRows(raw.quality||[]),complaints=filterRows(raw.complaints||[]);
 const permitMeters=permits.reduce((a,x)=>a+num(x.meters),0),lineMeters=lines.reduce((a,x)=>a+num(x.length),0),due=settlements.reduce((a,x)=>a+num(x.dueMeters),0),done=settlements.reduce((a,x)=>a+num(x.executedMeters),0);
 const highRiskProjects=projects.filter(x=>['حرج','مرتفع'].includes(clean(x.riskLevel))).length,designPending=lines.filter(x=>/جاري|قيد/i.test(clean(x.designStatus))&&!x.approvalDate).length;
 let expired=0,expiring=0,valid=0,unknown=0;
 permits.forEach(x=>{const d=Number(x.expiryDays);if(Number.isFinite(d)){if(d<0)expired++;else if(d<=7)expiring++;else valid++;}else if(norm(x.expiryBand).includes('منتهي'))expired++;else unknown++;});
 const summaries={...(raw.summaries||{}),projects:projects.length,actualPermits:permits.length,permitMeters,lines:lines.length,lineMeters,grossCoveragePct:pct(lineMeters,permitMeters),matchedCoveragePct:pct(done,due),matchedGap:Math.round((due-done)*10)/10,highRiskProjects,qualityIssues:quality.length,complaints:complaints.length,designPending};
 const management={...(raw.management||{}),handoverReadiness:{...(raw.management?.handoverReadiness||{}),linesWithHandover:lines.filter(x=>x.handoverDate||x.handoverLetter||x.completion||x.completionReport).length}};
 return {...raw,projects,actualPermits:permits,lines,settlements,quality,complaints,summaries,permitTiming:{...(raw.permitTiming||{}),expired,expiring,valid,unknown},management};
}
const data=()=>scopedData(rawData());

function safeParse(raw,fallback){try{return JSON.parse(raw)}catch{return fallback}}
function localHistory(){const h=safeParse(localStorage.getItem(HISTORY_KEY),[]);return Array.isArray(h)?h:[]}
function saveLocalHistory(h){try{localStorage.setItem(HISTORY_KEY,JSON.stringify(h.slice(-MAX_HISTORY)))}catch{}}
function health(d=rawData()){
 const s=d.summaries||{},p=d.permitTiming||{};let score=100;
 score-=Math.min(28,pct(num(s.highRiskProjects),Math.max(1,num(s.projects)))*0.7);
 score-=Math.min(22,pct(num(p.expired),Math.max(1,num(s.actualPermits)))*0.65);
 score-=Math.min(18,pct(num(s.qualityIssues),Math.max(1,num(s.projects)+num(s.lines)))*0.45);
 score-=Math.min(18,Math.max(0,100-num(s.matchedCoveragePct||s.grossCoveragePct))*0.18);
 score-=Math.min(14,pct(num(s.designPending),Math.max(1,num(s.lines)))*0.35);
 return Math.max(0,Math.round(score));
}
function metricSnapshot(d=rawData()){
 const s=d.summaries||{},p=d.permitTiming||{},m=d.management||{};
 return {capturedAt:Date.now(),sourceAt:d.updatedAt||new Date().toISOString(),projects:num(s.projects),permits:num(s.actualPermits),permitMeters:num(s.permitMeters),lines:num(s.lines),lineMeters:num(s.lineMeters),coverage:num(s.matchedCoveragePct||s.grossCoveragePct),highRisk:num(s.highRiskProjects),expired:num(p.expired),expiring:num(p.expiring),quality:num(s.qualityIssues),complaints:num(s.complaints),designPending:num(s.designPending),gap:num(s.matchedGap),handover:num(m.handoverReadiness?.linesWithHandover),health:health(d)};
}
function captureLocal(force=false){
 const d=rawData();if(!d?.summaries)return;
 const h=localHistory(),snap=metricSnapshot(d),last=h[h.length-1];
 if(!force&&last&&snap.capturedAt-num(last.capturedAt)<SNAPSHOT_INTERVAL)return;
 h.push(snap);saveLocalHistory(h);
}
function centralRows(){
 const rows=centralHistory?.memoryHistory;
 if(!Array.isArray(rows)||!rows.length)return null;
 return rows.map(x=>({...x,capturedAt:Date.parse(x.timestamp||x.date)||Date.now(),sourceAt:x.timestamp||x.date}));
}
function history(){return centralRows()||localHistory()}
function previousSnapshot(){
 if(centralHistory?.previous)return {...centralHistory.previous,capturedAt:Date.parse(centralHistory.previous.timestamp||centralHistory.previous.date)||Date.now()};
 const h=history();return h.length>1?h[h.length-2]:null;
}
function issuePayload(d=rawData()){
 const issueKeys=[],categories={},contractors={};
 const add=(key,cat,contractor)=>{issueKeys.push(key);if(cat)categories[cat]=(categories[cat]||0)+1;if(contractor)contractors[contractor]=(contractors[contractor]||0)+1};
 (d.projects||[]).forEach(p=>{if(['حرج','مرتفع'].includes(clean(p.riskLevel)))add('risk|'+clean(p.no)+'|'+clean(p.riskLevel),'مخاطر المشاريع',clean(p.contractor))});
 (d.quality||[]).forEach(q=>add('quality|'+clean(q.source)+'|'+clean(q.row)+'|'+clean(q.category)+'|'+clean(q.message),clean(q.category)||'جودة البيانات',''));
 (d.actualPermits||[]).forEach(p=>{if(norm(p.expiryBand).includes('منتهي'))add('permit|expired|'+clean(p.id),'التصاريح',clean(p.contractor||p.helperContractor))});
 (d.lines||[]).forEach(l=>{if((/جاري|قيد/i.test(clean(l.designStatus))&&!l.approvalDate)||num(l.designAgeDays)>60)add('design|'+clean(l.ref)+'|'+clean(l.designStatus),'التصميم',clean(l.contractor))});
 return {issueKeys,categories,contractors};
}
function centralPayload(){
 const d=rawData(),summary=metricSnapshot(d),issues=issuePayload(d);
 return {summary,issueKeys:issues.issueKeys,categories:issues.categories,contractors:issues.contractors};
}
async function syncCentralHistory(force=false){
 if(centralPromise)return centralPromise;
 if(!force&&centralHistory&&Date.now()-centralSyncAt<60*1000)return centralHistory;
 centralPromise=rpc('saveSmartHistory',[centralPayload()]).then(x=>{centralHistory=x;centralSyncAt=Date.now();return x}).catch(e=>{console.error('Central smart history:',e);return null}).finally(()=>{centralPromise=null});
 return centralPromise;
}
function thursdayPayload(){
 const d=rawData(),s=d.summaries||{},snap=metricSnapshot(d),lines=Math.max(1,num(s.lines)),permits=Math.max(1,num(s.actualPermits)),projects=Math.max(1,num(s.projects)),base=Math.max(1,num(s.projects)+num(s.lines));
 const sections=[
  {key:'coverage',label:'تغطية الأمتار',rate:snap.coverage,total:num(s.permitMeters),completed:num(s.lineMeters)},
  {key:'permits',label:'سلامة التصاريح',rate:Math.max(0,100-pct(snap.expired,permits)),total:permits,completed:Math.max(0,permits-snap.expired)},
  {key:'risk',label:'استقرار المخاطر',rate:Math.max(0,100-pct(snap.highRisk,projects)),total:projects,completed:Math.max(0,projects-snap.highRisk)},
  {key:'quality',label:'جودة البيانات',rate:Math.max(0,100-pct(snap.quality,base)),total:base,completed:Math.max(0,base-snap.quality)},
  {key:'handover',label:'جاهزية التسليم',rate:pct(snap.handover,lines),total:lines,completed:snap.handover}
 ];
 const overallRate=Math.round(sections.reduce((a,x)=>a+x.rate,0)/sections.length*10)/10;
 return {overallRate,totalOrders:lines,completed:snap.handover,sections,summary:snap};
}
async function syncThursday(force=false){
 if(thursdayPromise)return thursdayPromise;
 if(!force&&thursdayCentral&&Date.now()-thursdaySyncAt<60*1000)return thursdayCentral;
 thursdayPromise=rpc('syncThursdayProgressHistory',[thursdayPayload()]).then(x=>{thursdayCentral=x;thursdaySyncAt=Date.now();return x}).catch(e=>{console.error('Thursday central history:',e);return null}).finally(()=>{thursdayPromise=null});
 return thursdayPromise;
}
function previousThursday(){
 const s=thursdayCentral?.previousWeek?.summary;
 if(s&&typeof s==='object')return {...s,capturedAt:Date.parse(thursdayCentral.previousWeek.timestamp||thursdayCentral.previousWeek.date)||Date.now()};
 return previousSnapshot();
}
function weekWindow(ts=Date.now()){
 const d=new Date(ts);d.setHours(0,0,0,0);const day=d.getDay(),sinceFriday=(day+2)%7,from=new Date(d);from.setDate(d.getDate()-sinceFriday);const to=new Date(from);to.setDate(from.getDate()+6);return {from,to};
}
function diffText(current,previous,key,label,invert=false){
 if(!previous)return label+': لا يوجد خط أساس سابق';
 const d=num(current[key])-num(previous[key]);if(!d)return label+': دون تغير';
 const good=invert?d<0:d>0;return label+' '+(d>0?'↑ +':'↓ ')+fmt(d)+(good?' ✓':'');
}
function kpi(label,value,sub='',tone=''){return '<article class="us-kpi '+tone+'"><span>'+esc(label)+'</span><strong>'+esc(value)+'</strong><small>'+esc(sub)+'</small></article>'}
function panel(title,sub,body,extra=''){return '<article class="us-panel"><div class="us-panel-head"><div><small>'+esc(sub)+'</small><h3>'+esc(title)+'</h3></div>'+extra+'</div>'+body+'</article>'}
function empty(msg){return '<div class="us-empty">'+esc(msg)+'</div>'}
function openPage(page){window.VDUrgent?.openPage?.(page)}
function smartTabs(page){
 const tabs=[['smartCenter','🧠','مركز التحليل الذكي'],['temporalMemory','◷','ذاكرة المشروع الزمنية'],['investigationRoom','⌕','غرفة التحقيق الذكية'],['explainableDecision','⚖','محرك القرار المفسر'],['project360','🔎','Project 360°'],['smartThursday','▣','تقرير الخميس الذكي']];
 return '<section class="us-smart-top"><div class="us-smart-top-head"><div><small>SMART PROJECT INTELLIGENCE • FREE ENGINE</small><strong>مركز التحليل الذكي</strong><span>تحليل مباشر للمشروعات، جودة البيانات، المخاطر والاستثناءات.</span></div><div class="us-smart-live"><i></i><b>'+(centralHistory?.source==='google-sheet'?'ذاكرة مركزية • Dashboard History':'جاري مزامنة الذاكرة...')+'</b></div></div><div class="us-smart-tabs">'+tabs.map(([k,i,t])=>'<button type="button" class="'+(k===page?'active':'')+'" data-smart-tab="'+k+'">'+i+' <span>'+t+'</span></button>').join('')+'</div></section>';
}
function smartHeader(eyebrow,title,desc,action=''){return '<section class="us-smart-hero"><div><small>'+esc(eyebrow)+'</small><h2>'+esc(title)+'</h2><p>'+esc(desc)+'</p></div>'+action+'</section>'}
function wireSmartTabs(){
 host()?.querySelectorAll('[data-smart-tab]').forEach(b=>b.addEventListener('click',()=>{
  const k=b.dataset.smartTab;if(k==='project360')window.VDUrgentParity?.open360?.();else openPage(k);
 }));
}
function updateFilterVisibility(page){const bar=document.getElementById('filterBar');if(bar&&SMART_PAGES.has(page))bar.style.display='none'}

function riskScore(p,d=data()){
 let score=0,reasons=[];const level=norm(p.riskLevel);
 if(level.includes('حرج')){score+=38;reasons.push('تصنيف المخاطر حرج')}else if(level.includes('مرتفع')){score+=28;reasons.push('تصنيف المخاطر مرتفع')}else if(level.includes('متوسط'))score+=12;
 const permit=norm(p.permitStatus);if(permit.includes('منتهي')||num(p.permitDays)<0){score+=20;reasons.push('التصريح منتهي')}else if(permit.includes('تحت الاصدار')){score+=12;reasons.push('التصريح تحت الإصدار')}else if(num(p.permitDays)>0&&num(p.permitDays)<=7){score+=10;reasons.push('التصريح أوشك على الانتهاء')}
 const g=norm(p.guaranteeStatus);if(g.includes('منتهي')||num(p.guaranteeDays)<0){score+=16;reasons.push('الضمان منتهي')}else if(num(p.guaranteeDays)>0&&num(p.guaranteeDays)<=30){score+=8;reasons.push('الضمان قريب الانتهاء')}
 const ep=norm(p.extensionPressure);if(ep.includes('حرج')||ep.includes('مرتفع')){score+=12;reasons.push('ضغط تمديدات مرتفع')}
 if(!(num(p.lat)>20&&num(p.lat)<23&&num(p.lon)>38&&num(p.lon)<41)){score+=5;reasons.push('إحداثيات غير مكتملة')}
 const st=(d.settlements||[]).find(x=>clean(x.owner)===clean(p.owner)&&clean(x.contractor)===clean(p.contractor));if(st&&num(st.balance)>0){score+=Math.min(18,5+Math.round(num(st.balance)/500));reasons.push('فجوة أمتار '+fmt(st.balance)+' م')}
 if(clean(p.contractStatus).includes('منتهي')&&!p.handoverNo){score+=7;reasons.push('العقد منتهي دون خطاب تسليم')}
 return {score:Math.min(100,score),reasons};
}
function topRiskProjects(d=data(),limit=12){return (d.projects||[]).map(p=>({p,...riskScore(p,d)})).sort((a,b)=>b.score-a.score).slice(0,limit)}
function severity(score){return score>=70?'حرج':score>=45?'مرتفع':score>=20?'متوسط':'منخفض'}
function riskTable(rows){
 if(!rows.length)return empty('لا توجد حالات مخاطرة قابلة للعرض.');
 return '<div class="us-table-wrap"><table><thead><tr><th>الأولوية</th><th>المشروع</th><th>البلدية</th><th>المقاول</th><th>السبب</th></tr></thead><tbody>'+rows.map(x=>'<tr><td><span class="us-score '+(x.score>=70?'red':x.score>=45?'amber':'blue')+'">'+x.score+'</span></td><td><b>'+esc(x.p.no||x.p.name||'—')+'</b><small>'+esc(x.p.name||'')+'</small></td><td>'+esc(x.p.municipality||'—')+'</td><td>'+esc(x.p.contractor||'—')+'</td><td>'+esc(x.reasons.slice(0,3).join(' • ')||'متابعة عامة')+'</td></tr>').join('')+'</tbody></table></div>';
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
function exceptions(d){
 const rows=[];
 topRiskProjects(d,40).filter(x=>x.score>=45).forEach(x=>rows.push({sev:x.score>=70?'حرجة':'مرتفعة',cat:'المخاطر',id:x.p.no||x.p.name,title:x.reasons.join(' • '),contractor:x.p.contractor}));
 (d.quality||[]).slice(0,80).forEach(x=>rows.push({sev:String(x.severity).toLowerCase()==='high'?'مرتفعة':'متوسطة',cat:'جودة البيانات',id:(x.source||'')+' / '+(x.row||''),title:x.message,contractor:''}));
 (d.actualPermits||[]).filter(x=>norm(x.expiryBand).includes('منتهي')).slice(0,40).forEach(x=>rows.push({sev:'مرتفعة',cat:'التصاريح',id:x.id,title:'تصريح منتهي',contractor:x.contractor||x.helperContractor}));
 return rows;
}
function completenessCards(d){
 const defs=[
  ['المشاريع',d.projects||[],['no','name','owner','contractor','municipality','contractStatus']],
  ['التصاريح',d.actualPermits||[],['id','start','end','meters','owner']],
  ['الخطوط البديلة',d.lines||[],['ref','name','contractor','owner','designStatus']],
  ['التسويات',d.settlements||[],['owner','contractor','dueMeters','executedMeters']]
 ];
 return defs.map(([label,rows,keys])=>{let cells=0,missing=0;rows.forEach(r=>keys.forEach(k=>{cells++;if(r[k]===null||r[k]===undefined||clean(r[k])==='')missing++}));return {label,score:cells?Math.round((1-missing/cells)*1000)/10:100,missing}});
}
function analystAnswer(q,d){
 const s=d.summaries||{},pt=d.permitTiming||{},text=norm(q);
 if(text.includes('مقاول')){const m={};topRiskProjects(d,100).filter(x=>x.score>=45).forEach(x=>{const k=x.p.contractor||'غير محدد';m[k]=(m[k]||0)+1});const top=Object.entries(m).sort((a,b)=>b[1]-a[1]).slice(0,5);return top.length?'أعلى المقاولين في الحالات مرتفعة الأولوية: '+top.map(x=>x[0]+' ('+x[1]+')').join('، '):'لا توجد حالات مرتفعة الأولوية للمقاولين حاليًا.'}
 if(text.includes('جوده')||text.includes('جودة'))return 'يوجد '+fmt(s.qualityIssues)+' ملاحظة جودة بيانات. يوصى بإغلاق الملاحظات عالية الأهمية أولًا قبل اعتماد المؤشرات النهائية.';
 if(text.includes('تصريح'))return 'التصاريح المنتهية: '+fmt(pt.expired)+'، والتي تنتهي خلال 7 أيام: '+fmt(pt.expiring)+'.';
 if(text.includes('مخاطر')||text.includes('حرج'))return 'عدد المشروعات ذات المخاطر المرتفعة/الحرجة: '+fmt(s.highRiskProjects)+'. أعلى الحالات ظاهرة في رادار الأولوية أدناه.';
 if(text.includes('امتار')||text.includes('أمتار'))return 'نسبة التغطية الحالية '+fmt(s.matchedCoveragePct)+'%، والفجوة '+fmt(s.matchedGap)+' متر.';
 return 'صحة المحفظة '+health(d)+'%. المشروعات '+fmt(s.projects)+'، المخاطر العالية '+fmt(s.highRiskProjects)+'، التصاريح المنتهية '+fmt(pt.expired)+'، وملاحظات الجودة '+fmt(s.qualityIssues)+'.';
}
function renderCenter(){
 const h=host(),d=data(),s=d.summaries||{},pt=d.permitTiming||{},prev=previousSnapshot(),cur=metricSnapshot(d),risks=topRiskProjects(d,8),hs=health(d),ex=exceptions(d),comp=completenessCards(d);
 const centralNote=centralHistory?.source==='google-sheet'?'المقارنة مركزية ومشتركة بين جميع المستخدمين من ورقة Dashboard History.':'يتم الآن إنشاء/قراءة الذاكرة المركزية؛ يظهر الاحتياطي المحلي مؤقتًا عند تعذر الاتصال.';
 h.innerHTML=smartTabs('smartCenter')+
 smartHeader('SMART PROJECT INTELLIGENCE','مركز التحليل الذكي','مركز موحد لقراءة الوضع الحالي، ما تغير، المخاطر، جودة البيانات والاستثناءات.','<button class="us-primary" id="usRefreshSmart">↻ إعادة التحليل</button>')+
 '<div class="us-kpis">'+kpi('صحة المحفظة',hs+'%',hs>=75?'مستقرة':hs>=55?'تحتاج متابعة':'تحتاج تدخل','health')+kpi('المشاريع',fmt(s.projects),'إجمالي المشروعات')+kpi('المخاطر العالية',fmt(s.highRiskProjects),'حرج + مرتفع','danger')+kpi('التصاريح المنتهية',fmt(pt.expired),'تحتاج معالجة','warn')+kpi('فجوة الأمتار',fmt(s.matchedGap)+' م','المستحق - المنفذ')+kpi('ملاحظات الجودة',fmt(s.qualityIssues),'ملاحظات تدقيق البيانات')+'</div>'+
 '<article class="us-what-banner"><div class="us-panel-head"><div><small>WHAT CHANGED</small><h3>ماذا تغير منذ أمس؟</h3></div><span class="us-memory-evidence">'+esc(centralHistory?.previous?.date?'مقارنة مع '+centralHistory.previous.date:'خط أساس اليوم')+'</span></div><div class="us-change-list">'+[
  diffText(cur,prev,'highRisk','المخاطر العالية',true),diffText(cur,prev,'expired','التصاريح المنتهية',true),diffText(cur,prev,'quality','ملاحظات الجودة',true),diffText(cur,prev,'coverage','نسبة التغطية'),diffText(cur,prev,'handover','جاهزية التسليم')
 ].map((x,i)=>'<div><b>'+(i+1)+'</b><span>'+esc(x)+'</span></div>').join('')+'</div><div class="us-method">'+esc(centralNote)+'</div></article>'+
 panel('أعلى نقاط التدخل الآن','PRIORITY RADAR','<div class="us-action-list">'+priorityActions(d).map((x,i)=>'<div><b>'+String(i+1).padStart(2,'0')+'</b><span><strong>'+esc(x.title)+'</strong><small>'+esc(x.text)+'</small></span></div>').join('')+'</div>')+
 '<div class="us-grid two">'+panel('اسأل المحلل المجاني','SMART ANALYST','<div class="us-analyst"><div class="us-memory-chips"><button data-analyst-q="الحالات الحرجة">الحالات الحرجة</button><button data-analyst-q="المقاولون">المقاولون</button><button data-analyst-q="جودة البيانات">جودة البيانات</button><button data-analyst-q="التصاريح">التصاريح</button><button data-analyst-q="الأمتار">الأمتار</button></div><div class="us-ask-row"><input id="usAnalystQuestion" placeholder="اكتب سؤالك عن المشروع..."><button id="usAnalystAsk" class="us-mini">تحليل</button></div><div id="usAnalystAnswer" class="us-memory-answer">اختر سؤالًا جاهزًا أو اكتب سؤالك. الإجابة ناتجة من قواعد وأرقام الداشبورد مباشرة.</div></div>')+
 panel('اكتمال البيانات حسب المجال','DATA COMPLETENESS',comp.map(x=>'<div class="us-bar-row"><span><b>'+esc(x.label)+'</b><small>'+fmt(x.missing)+' خلايا أساسية ناقصة</small></span><div><i style="width:'+Math.max(3,x.score)+'%"></i></div><strong>'+fmt(x.score)+'%</strong></div>').join(''))+'</div>'+
 panel('أعلى المشروعات أولوية','TOP RISK PROJECTS',riskTable(risks),'<button class="us-mini" data-smart-open="explainableDecision">فتح محرك القرار</button>')+
 panel('مركز الاستثناءات — الحالات التي تحتاج مراجعة','EXCEPTION CENTER','<div class="us-table-wrap"><table><thead><tr><th>الأهمية</th><th>النوع</th><th>المرجع</th><th>التفصيل</th><th>المقاول</th></tr></thead><tbody>'+ex.slice(0,80).map(x=>'<tr><td>'+esc(x.sev)+'</td><td>'+esc(x.cat)+'</td><td><b>'+esc(x.id||'—')+'</b></td><td>'+esc(x.title||'')+'</td><td>'+esc(x.contractor||'—')+'</td></tr>').join('')+'</tbody></table></div>');
 wireSmartTabs();wireOpenButtons();
 const ask=q=>{const box=document.getElementById('usAnalystAnswer');if(box)box.innerHTML='<b>قراءة المحلل</b><span>'+esc(analystAnswer(q,d))+'</span>'};
 document.querySelectorAll('[data-analyst-q]').forEach(b=>b.addEventListener('click',()=>ask(b.dataset.analystQ)));
 document.getElementById('usAnalystAsk')?.addEventListener('click',()=>ask(document.getElementById('usAnalystQuestion')?.value||''));
 document.getElementById('usRefreshSmart')?.addEventListener('click',async()=>{captureLocal(true);await syncCentralHistory(true);if(state().page==='smartCenter')renderCenter();window.VDUrgent?.toast?.('تم تحديث التحليل والذاكرة المركزية')});
}
function renderMemory(){
 const h=host(),hist=history(),cur=metricSnapshot(data()),first=hist[0],prev=hist.length>1?hist[hist.length-2]:null,trend=memoryFindings(hist),cov=centralHistory?.memoryCoverage;
 h.innerHTML=smartTabs('temporalMemory')+
 smartHeader('PROJECT TEMPORAL MEMORY • EVIDENCE ENGINE','ذاكرة المشروع الزمنية','تقرأ اللقطات التاريخية المركزية للإجابة عن: متى بدأ التدهور؟ ما أول مؤشر؟ وماذا سبق التغير؟','<button class="us-primary" id="usMemoryRefresh">↻ تحديث الذاكرة</button>')+
 '<div class="us-kpis">'+kpi('عدد اللقطات',fmt(hist.length),centralRows()?'ذاكرة مركزية مشتركة':'احتياطي محلي')+kpi('نطاق الذاكرة',cov?(cov.from+' → '+cov.to):'—','Dashboard History')+kpi('آخر لقطة',hist.length?nowLabel(hist[hist.length-1].capturedAt):'—','آخر قراءة')+kpi('المخاطر الحالية',fmt(cur.highRisk),'عالية/حرجة','danger')+kpi('التصاريح المنتهية',fmt(cur.expired),'الحالة الحالية','warn')+kpi('جودة البيانات',fmt(cur.quality),'ملاحظات حالية')+'</div>'+
 '<article class="us-memory-ask"><div class="us-panel-head"><div><small>ASK THE PAST</small><h3>اسأل ذاكرة المشروع</h3></div><span class="us-memory-evidence">'+(centralRows()?'زمن + دليل مركزي':'زمن + دليل محلي')+'</span></div><div class="us-memory-chips"><button data-memory-q="deterioration">متى بدأ التدهور؟</button><button data-memory-q="firstSignal">ما أول مؤشر ظهر؟</button><button data-memory-q="riskPeak">متى بلغت المخاطر أعلى قيمة؟</button><button data-memory-q="coverage">كيف تغيرت التغطية؟</button></div><div class="us-memory-answer" id="usMemoryAnswer">اختر سؤالًا لقراءة الذاكرة الزمنية.</div></article>'+
 '<div class="us-grid two">'+panel('تطور المؤشرات عبر الزمن','TEMPORAL TREND','<div class="us-memory-chart"><canvas id="usMemoryChart"></canvas></div>')+panel('الاستنتاجات الزمنية','TEMPORAL FINDINGS',trend.map(x=>'<div class="us-finding"><b>'+esc(x.title)+'</b><span>'+esc(x.text)+'</span></div>').join('')||empty('لا توجد لقطات كافية لبناء اتجاه زمني.'))+'</div>'+
 panel('مقارنة آخر لقطة بالسابق','LATEST DELTA','<div class="us-change-list">'+[diffText(cur,prev,'highRisk','المخاطر العالية',true),diffText(cur,prev,'expired','التصاريح المنتهية',true),diffText(cur,prev,'quality','ملاحظات الجودة',true),diffText(cur,prev,'coverage','نسبة التغطية'),diffText(cur,prev,'lineMeters','أمتار الخطوط')].map((x,i)=>'<div><b>'+(i+1)+'</b><span>'+esc(x)+'</span></div>').join('')+'</div>')+
 panel('سجل اللقطات','SNAPSHOT HISTORY',historyTable(hist));
 wireSmartTabs();document.querySelectorAll('[data-memory-q]').forEach(b=>b.addEventListener('click',()=>{const box=document.getElementById('usMemoryAnswer');if(box)box.innerHTML=memoryAnswer(hist,b.dataset.memoryQ)}));
 document.getElementById('usMemoryRefresh')?.addEventListener('click',async()=>{await syncCentralHistory(true);if(state().page==='temporalMemory')renderMemory();window.VDUrgent?.toast?.('تم تحديث الذاكرة المركزية')});
 renderMemoryChart(hist);
}
function memoryAnswer(hist,kind){
 if(hist.length<2)return '<b>التغطية غير كافية.</b><span>تحتاج الذاكرة إلى لقطة سابقة واحدة على الأقل لبناء استنتاج زمني قابل للمراجعة.</span>';
 const pairs=hist.map((x,i)=>({x,prev:i?hist[i-1]:null})).slice(1),fmtAt=x=>nowLabel(x.capturedAt);
 if(kind==='deterioration'){const hit=pairs.find(p=>num(p.x.highRisk)>num(p.prev.highRisk)||num(p.x.expired)>num(p.prev.expired)||num(p.x.quality)>num(p.prev.quality));return hit?'<b>أول تدهور محفوظ: '+esc(fmtAt(hit.x))+'</b><span>ظهرت زيادة في المخاطر أو التصاريح المنتهية أو ملاحظات الجودة مقارنة باللقطة السابقة.</span>':'<b>لم يظهر تدهور صريح داخل اللقطات المحفوظة.</b><span>لا توجد زيادة متتابعة في مؤشرات التدهور الرئيسية.</span>'}
 if(kind==='firstSignal'){const events=[];pairs.forEach(p=>{[['highRisk','المخاطر العالية'],['expired','التصاريح المنتهية'],['quality','ملاحظات الجودة']].forEach(([k,label])=>{if(num(p.x[k])>num(p.prev[k]))events.push({at:p.x.capturedAt,label,delta:num(p.x[k])-num(p.prev[k])})})});events.sort((a,b)=>a.at-b.at);const e=events[0];return e?'<b>أول مؤشر متدهور: '+esc(e.label)+'</b><span>ظهر في '+esc(nowLabel(e.at))+' بزيادة '+esc(fmt(e.delta))+' مقارنة باللقطة السابقة.</span>':'<b>لا توجد إشارة تدهور محفوظة.</b><span>المؤشرات الأساسية لم تسجل زيادة سلبية داخل الذاكرة الحالية.</span>'}
 if(kind==='riskPeak'){const p=[...hist].sort((a,b)=>num(b.highRisk)-num(a.highRisk))[0];return '<b>أعلى قيمة للمخاطر العالية: '+esc(fmt(p.highRisk))+'</b><span>سُجلت في '+esc(fmtAt(p))+'.</span>'}
 const a=hist[0],b=hist[hist.length-1],d=num(b.coverage)-num(a.coverage);return '<b>التغطية: '+esc(fmt(a.coverage))+'% ← '+esc(fmt(b.coverage))+'%</b><span>صافي التغير '+(d>=0?'+':'')+esc(fmt(d))+' نقطة مئوية.</span>';
}
function memoryFindings(hist){
 if(hist.length<2)return [];const first=hist[0],last=hist[hist.length-1],out=[];
 [['highRisk','المخاطر العالية',true],['expired','التصاريح المنتهية',true],['quality','ملاحظات الجودة',true],['coverage','نسبة التغطية',false],['lineMeters','أمتار الخطوط',false]].forEach(([k,label,invert])=>{const d=num(last[k])-num(first[k]);if(d!==0)out.push({title:label,text:'من '+fmt(first[k])+' إلى '+fmt(last[k])+' ('+(d>0?'+':'')+fmt(d)+'). '+((invert&&d>0)||(!invert&&d<0)?'اتجاه يحتاج متابعة.':'الاتجاه تحسن أو مستقر نسبيًا.')})});
 const deterioration=hist.find((x,i)=>i>0&&(num(x.highRisk)>num(hist[i-1].highRisk)||num(x.expired)>num(hist[i-1].expired)||num(x.quality)>num(hist[i-1].quality)));if(deterioration)out.unshift({title:'أول إشارة تدهور محفوظة',text:'ظهرت في '+nowLabel(deterioration.capturedAt)+' مقارنة باللقطة السابقة.'});return out.slice(0,6);
}
function historyTable(hist){
 if(!hist.length)return empty('لا توجد لقطات بعد.');
 return '<div class="us-table-wrap"><table><thead><tr><th>الوقت</th><th>المشاريع</th><th>مخاطر عالية</th><th>منتهية</th><th>الجودة</th><th>التغطية %</th><th>أمتار الخطوط</th></tr></thead><tbody>'+[...hist].reverse().slice(0,30).map(x=>'<tr><td>'+esc(nowLabel(x.capturedAt))+'</td><td>'+fmt(x.projects)+'</td><td>'+fmt(x.highRisk)+'</td><td>'+fmt(x.expired)+'</td><td>'+fmt(x.quality)+'</td><td>'+fmt(x.coverage)+'</td><td>'+fmt(x.lineMeters)+'</td></tr>').join('')+'</tbody></table></div>';
}
function renderMemoryChart(hist){
 const canvas=document.getElementById('usMemoryChart');if(!canvas||typeof Chart==='undefined')return;try{memoryChart?.destroy()}catch{}
 const rows=hist.slice(-30);if(!rows.length)return;memoryChart=new Chart(canvas,{type:'line',data:{labels:rows.map(x=>new Date(x.capturedAt).toLocaleDateString('ar-SA',{month:'2-digit',day:'2-digit'})),datasets:[{label:'المخاطر العالية',data:rows.map(x=>num(x.highRisk)),tension:.28},{label:'التصاريح المنتهية',data:rows.map(x=>num(x.expired)),tension:.28},{label:'جودة البيانات',data:rows.map(x=>num(x.quality)),tension:.28},{label:'التغطية %',data:rows.map(x=>num(x.coverage)),tension:.28}]},options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},plugins:{legend:{position:'bottom',labels:{font:{family:'Cairo',size:9}}}},scales:{x:{ticks:{font:{family:'Cairo',size:8}},grid:{display:false}},y:{beginAtZero:true,ticks:{font:{family:'Cairo',size:8}}}}}});
}
function phenomenonRows(kind,d=data()){
 if(kind==='risk')return (d.projects||[]).filter(p=>riskScore(p,d).score>=45).map(p=>({...p,_weight:riskScore(p,d).score,_source:'مشروع'}));
 if(kind==='expired')return (d.actualPermits||[]).filter(p=>norm(p.expiryBand).includes('منتهي')).map(p=>({...p,_weight:Math.max(1,num(p.meters)),_source:'تصريح'}));
 if(kind==='quality')return (d.quality||[]).map(q=>({...q,_weight:1,_source:'جودة'}));
 if(kind==='guarantee')return (d.projects||[]).filter(p=>num(p.guaranteeDays)<0||norm(p.guaranteeStatus).includes('منتهي')||(num(p.guaranteeDays)>0&&num(p.guaranteeDays)<=30)).map(p=>({...p,_weight:1,_source:'ضمان'}));
 if(kind==='gap')return (d.settlements||[]).filter(x=>num(x.balance)>0).map(x=>({...x,_weight:num(x.balance),_source:'تسوية'}));
 if(kind==='design')return (d.lines||[]).filter(x=>num(x.designAgeDays)>30||(/جاري|قيد/.test(clean(x.designStatus))&&!x.approvalDate)).map(x=>({...x,_weight:Math.max(1,num(x.designAgeDays)),_source:'خط بديل'}));return [];
}
function dimensionValue(r,dim){if(dim==='source')return clean(r._source)||'غير محدد';if(dim==='municipality')return clean(r.municipality||r.helperMunicipality)||'غير محدد';if(dim==='contractor')return clean(r.contractor||r.helperContractor)||'غير محدد';if(dim==='owner')return clean(r.owner||r.projectOwner)||'غير محدد';if(dim==='category')return clean(r.category||r.type||r.projectType)||'غير محدد';return 'غير محدد'}
function aggregateInvestigation(rows,dim){const m=new Map();rows.forEach(r=>{const k=dimensionValue(r,dim),x=m.get(k)||{key:k,count:0,weight:0};x.count++;x.weight+=num(r._weight)||1;m.set(k,x)});return [...m.values()].sort((a,b)=>b.weight-a.weight||b.count-a.count)}
function renderInvestigation(){
 const h=host();h.innerHTML=smartTabs('investigationRoom')+smartHeader('SMART INVESTIGATION ROOM','غرفة التحقيق الذكية','اختر الظاهرة والبُعد؛ النظام يبحث عن مناطق التركّز والأنماط المؤثرة مع تفسير قابل للمراجعة.')+
 '<article class="us-investigate-controls"><label><span>الظاهرة</span><select id="usPhenomenon"><option value="risk">المشاريع عالية المخاطر</option><option value="expired">التصاريح المنتهية</option><option value="quality">ملاحظات جودة البيانات</option><option value="guarantee">مخاطر الضمانات</option><option value="gap">فجوات الأمتار</option><option value="design">تأخر التصميم والاعتماد</option></select></label><label><span>التقسيم</span><select id="usDimension"><option value="municipality">البلدية</option><option value="contractor">المقاول</option><option value="owner">المالك</option><option value="category">النوع / التصنيف</option><option value="source">المصدر</option></select></label><button class="us-primary" id="usRunInvestigation">ابدأ التحقيق</button></article><div id="usInvestigationResult"></div>';
 const run=()=>{const kind=document.getElementById('usPhenomenon').value,dim=document.getElementById('usDimension').value,rows=phenomenonRows(kind),groups=aggregateInvestigation(rows,dim),totalWeight=groups.reduce((a,x)=>a+x.weight,0),top=groups[0],concentration=top?pct(top.weight,totalWeight):0;
 document.getElementById('usInvestigationResult').innerHTML='<div class="us-kpis">'+kpi('الحالات',fmt(rows.length),'ضمن الظاهرة المختارة')+kpi('المجموع المرجح',fmt(totalWeight),'بحسب نوع الظاهرة')+kpi('أعلى تركّز',top?top.key:'—',top?fmt(concentration)+'% من الأثر':'لا توجد بيانات','warn')+kpi('عدد المجموعات',fmt(groups.length),'بعد التقسيم')+'</div><div class="us-grid two">'+panel('أعلى مسببات/مناطق التركّز','ROOT CAUSE SPLIT',groups.slice(0,12).map(x=>'<div class="us-bar-row"><span><b>'+esc(x.key)+'</b><small>'+fmt(x.count)+' حالة</small></span><div><i style="width:'+Math.max(4,pct(x.weight,totalWeight))+'%"></i></div><strong>'+fmt(pct(x.weight,totalWeight))+'%</strong></div>').join('')||empty('لا توجد حالات لهذه الظاهرة.'))+panel('الاستنتاج التفسيري','INVESTIGATION FINDING',top?'<div class="us-investigation-note"><b>المجموعة الأعلى أثرًا: '+esc(top.key)+'</b><p>تمثل '+fmt(concentration)+'% من الأثر المرجح، بعدد '+fmt(top.count)+' حالة. ابدأ بمراجعة الحالات داخل هذه المجموعة ثم قارن الأسباب المشتركة.</p><button class="us-mini" data-smart-open="explainableDecision">تحويل إلى محرك القرار</button></div>':empty('لا توجد بيانات كافية لبناء استنتاج.'))+'</div>'+panel('تفاصيل المجموعات','BREAKDOWN TABLE','<div class="us-table-wrap"><table><thead><tr><th>#</th><th>المجموعة</th><th>عدد الحالات</th><th>الأثر المرجح</th><th>المساهمة</th></tr></thead><tbody>'+groups.slice(0,30).map((x,i)=>'<tr><td>'+(i+1)+'</td><td><b>'+esc(x.key)+'</b></td><td>'+fmt(x.count)+'</td><td>'+fmt(x.weight)+'</td><td>'+fmt(pct(x.weight,totalWeight))+'%</td></tr>').join('')+'</tbody></table></div>');wireOpenButtons()};
 document.getElementById('usRunInvestigation').addEventListener('click',run);wireSmartTabs();run();
}
function decisionAction(item){const r=item.reasons.join(' • ');if(r.includes('التصريح منتهي'))return 'تجديد/معالجة التصريح وربط الإجراء بموعد التنفيذ.';if(r.includes('فجوة أمتار'))return 'مراجعة الأمتار المستحقة والمنفذة وإغلاق فرق التسوية.';if(r.includes('الضمان منتهي'))return 'استكمال تمديد/استبدال الضمان قبل أي التزام مالي أو تسليم.';if(r.includes('ضغط تمديدات'))return 'تأكيد خطة التنفيذ والموارد ومتابعة ضغط التمديدات أسبوعيًا.';if(r.includes('إحداثيات'))return 'استكمال الإحداثيات قبل اعتماد التحليل المكاني.';return 'تثبيت مسؤول وتاريخ إغلاق للحالة ومراجعتها في تقرير الخميس الذكي.'}
function decisionConfidence(item){const p=item.p,checks=[p.no||p.name,p.contractor,p.owner,p.municipality,p.permitStatus,p.guaranteeStatus,(num(p.lat)&&num(p.lon))?'geo':'',item.reasons.length?item.reasons[0]:''];return Math.max(25,Math.min(95,Math.round(25+pct(checks.filter(Boolean).length,checks.length)*.7)))}
function renderDecision(){
 const h=host(),all=topRiskProjects(data(),100);
 h.innerHTML=smartTabs('explainableDecision')+smartHeader('EXPLAINABLE DECISION ENGINE','محرك القرار المفسر','لا يكتفي بدرجة أولوية؛ يعرض سبب الدرجة والأدلة التشغيلية وثقة التغطية والإجراء المقترح لكل مشروع.')+
 '<article class="us-decision-tools"><label><span>بحث بالمشروع / المقاول / البلدية</span><input id="usDecisionSearch" type="search" placeholder="اكتب كلمة للبحث..."></label><label><span>الحد الأدنى للأولوية</span><select id="usDecisionLevel"><option value="0">الكل</option><option value="20">20+</option><option value="45" selected>45+</option><option value="70">70+</option></select></label><button class="us-primary" id="usDecisionApply">تطبيق</button></article><div class="us-decision-method"><b>منهج المحرك:</b> الدرجة أداة ترتيب تشغيلية وليست قرارًا نهائيًا، وثقة التغطية تقيس اكتمال الأدلة المتاحة.</div><div id="usDecisionResult"></div>';
 const run=()=>{const q=norm(document.getElementById('usDecisionSearch').value),min=num(document.getElementById('usDecisionLevel').value),rows=all.map(x=>({...x,confidence:decisionConfidence(x)})).filter(x=>x.score>=min&&(!q||norm([x.p.no,x.p.name,x.p.contractor,x.p.owner,x.p.municipality,...x.reasons].join(' ')).includes(q))).sort((a,b)=>b.score-a.score||b.confidence-a.confidence);
 document.getElementById('usDecisionResult').innerHTML='<div class="us-kpis">'+kpi('الحالات المطابقة',fmt(rows.length),'بعد البحث والحد الأدنى')+kpi('الأولوية الحرجة',fmt(rows.filter(x=>x.score>=70).length),'درجة 70 فأعلى','danger')+kpi('الأولوية المرتفعة',fmt(rows.filter(x=>x.score>=45&&x.score<70).length),'درجة 45–69','warn')+kpi('ثقة تغطية عالية',fmt(rows.filter(x=>x.confidence>=75).length),'75% فأعلى')+'</div><div class="us-decision-grid">'+rows.slice(0,30).map(x=>'<article class="us-decision-card"><div class="us-decision-head"><div><small>'+esc(x.p.no||'مشروع')+'</small><h3>'+esc(x.p.name||x.p.no||'مشروع بدون اسم')+'</h3><p>'+esc([x.p.municipality,x.p.contractor].filter(Boolean).join(' • '))+'</p></div><span class="us-big-score '+(x.score>=70?'red':x.score>=45?'amber':'blue')+'"><b>'+x.score+'</b><small>'+severity(x.score)+'</small></span></div><div class="us-decision-meta"><span>ثقة التغطية '+x.confidence+'%</span><span>'+x.reasons.length+' إشارات</span></div><div class="us-reasons">'+x.reasons.map(r=>'<span>'+esc(r)+'</span>').join('')+'</div><div class="us-next"><small>الإجراء المقترح</small><b>'+esc(decisionAction(x))+'</b></div></article>').join('')+'</div>'};
 document.getElementById('usDecisionApply').addEventListener('click',run);document.getElementById('usDecisionSearch').addEventListener('input',run);document.getElementById('usDecisionLevel').addEventListener('change',run);wireSmartTabs();run();
}
let urgentThursdayCharts={};
const URGENT_THURSDAY_PAGES={coverage:'settlements',permits:'permits',risk:'risks',quality:'quality',handover:'execution'};
const URGENT_THURSDAY_COLORS={coverage:'#43a5ff',permits:'#55d6a9',risk:'#ff8f5c',quality:'#9b7cff',handover:'#f4ca4d'};
function thursdayTrend(){return Array.isArray(thursdayCentral?.trend)?thursdayCentral.trend:[]}
function thursdaySection(snap,key){return (snap?.sections||[]).find(x=>x.key===key)||null}
function signedThursday(v,dec=0){const x=Number(v||0),z=dec?Math.round(x*10)/10:Math.round(x);return (z>0?'+':'')+z.toLocaleString('ar-SA')}
function liveThursdayCard(x){
 const pending=Math.max(0,Number(x.total||0)-Number(x.completed||0)),page=URGENT_THURSDAY_PAGES[x.key]||'master';
 return '<article class="stp-section-card stp-live-card" data-thursday-page="'+esc(page)+'"><div class="stp-card-head"><span>'+esc(x.label)+'</span><span class="stp-delta live">حي الآن</span></div><strong>'+fmt(x.rate)+'%</strong><div class="stp-baseline-values stp-live-source"><span>قراءة مباشرة من الشيتات</span></div><div class="stp-mini"><span><b>'+fmt(x.total)+'</b>إجمالي</span><span><b>'+fmt(x.completed)+'</b>مكتمل</span><span><b>'+fmt(pending)+'</b>متبقي</span></div><small>الوضع الحالي مستقل عن لقطة الخميس الرسمية.</small></article>';
}
function baselineThursdayCard(x,latest,previous){
 const a=thursdaySection(previous,x.key),b=thursdaySection(latest,x.key),page=URGENT_THURSDAY_PAGES[x.key]||'master';
 if(!(a&&b))return '<article class="stp-section-card stp-baseline-card" data-thursday-page="'+esc(page)+'"><div class="stp-card-head"><span>'+esc(x.label)+'</span><span class="stp-delta neutral">بانتظار خط أساس</span></div><strong class="stp-delta-main neutral">—</strong><div class="stp-baseline-values"><span>يلزم توفر لقطتي خميس رسميتين</span></div><div class="stp-mini"><span><b>—</b>فرق الإجمالي</span><span><b>—</b>فرق المكتمل</span><span><b>—</b>فرق المتبقي</span></div><small>لا تتم مقارنة الوضع الحي بلقطة الخميس.</small></article>';
 const dr=Math.round((Number(b.rate||0)-Number(a.rate||0))*10)/10,dt=Number(b.total||0)-Number(a.total||0),dc=Number(b.completed||0)-Number(a.completed||0);
 const ap=Math.max(0,Number(a.total||0)-Number(a.completed||0)),bp=Math.max(0,Number(b.total||0)-Number(b.completed||0)),dp=bp-ap;
 const cls=dr>0?'up':dr<0?'down':'neutral',arrow=dr>0?'▲':dr<0?'▼':'●';
 return '<article class="stp-section-card stp-baseline-card" data-thursday-page="'+esc(page)+'"><div class="stp-card-head"><span>'+esc(x.label)+'</span><span class="stp-delta '+cls+'">'+esc(previous.label)+' ← '+esc(latest.label)+'</span></div><strong class="stp-delta-main '+cls+'">'+arrow+' '+signedThursday(dr,1)+' نقطة</strong><div class="stp-baseline-values"><span><small>'+esc(previous.label)+'</small><b>'+fmt(a.rate)+'%</b></span><i>←</i><span><small>'+esc(latest.label)+'</small><b>'+fmt(b.rate)+'%</b></span></div><div class="stp-mini"><span><b>'+signedThursday(dt)+'</b>فرق الإجمالي</span><span><b>'+signedThursday(dc)+'</b>فرق المكتمل</span><span><b>'+signedThursday(dp)+'</b>فرق المتبقي</span></div><small>الفرق محسوب بين خميسين رسميين محفوظين فقط.</small></article>';
}
function destroyUrgentThursdayCharts(){Object.values(urgentThursdayCharts).forEach(c=>{try{c.destroy()}catch{}});urgentThursdayCharts={}}
function drawUrgentThursdayChart(id,keys){
 const el=document.getElementById(id);if(!el||typeof Chart==='undefined')return;
 const hist=thursdayTrend(),labels=hist.map(x=>x.label||x.date||'');
 const datasets=keys.map(key=>{const cur=thursdayPayload().sections.find(x=>x.key===key),label=cur?.label||key,color=URGENT_THURSDAY_COLORS[key]||'#43a5ff';return {label,data:hist.map(x=>{const s=thursdaySection(x,key);return s?Number(s.rate||0):null}),borderColor:color,backgroundColor:color,borderWidth:2,tension:.28,pointRadius:4,pointHoverRadius:6,fill:false,spanGaps:true}}).filter(x=>x.data.some(v=>v!==null&&Number.isFinite(v)));
 urgentThursdayCharts[id]=new Chart(el,{type:'line',data:{labels,datasets},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{color:'#b9c9dc',usePointStyle:true,font:{family:'Cairo',size:9}}},tooltip:{rtl:true}},scales:{y:{min:0,max:100,ticks:{color:'#91a7bf',callback:v=>v+'%'},grid:{color:'rgba(255,255,255,.05)'}},x:{ticks:{color:'#91a7bf'},grid:{display:false}}}}});
}
function drawUrgentThursdayCharts(){
 destroyUrgentThursdayCharts();
 drawUrgentThursdayChart('ustTrend',['coverage','permits','risk','quality','handover']);
 drawUrgentThursdayChart('ustCoverageTrend',['coverage','handover']);
 drawUrgentThursdayChart('ustPermitTrend',['permits']);
 drawUrgentThursdayChart('ustRiskTrend',['risk']);
 drawUrgentThursdayChart('ustQualityTrend',['quality']);
}
function urgentThursdayChartImage(id){try{return document.getElementById(id)?.toDataURL('image/png',1)||''}catch{return ''}}
function exportUrgentThursdayReport(){
 const current=thursdayPayload(),trend=thursdayTrend(),latest=trend.length?trend[trend.length-1]:null,previous=trend.length>1?trend[trend.length-2]:null,d=data(),w=weekWindow(),stamp=new Intl.DateTimeFormat('ar-SA',{timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date());
 const win=window.open('','_blank');if(!win){window.VDUrgent?.toast?.('اسمح بالنوافذ المنبثقة لتصدير التقرير');return}
 const fileTitle=window.VDReportNaming?.build?.({key:'smartThursday'})||('VD_UrgentSolutions_SmartThursday_'+Date.now());
 const logo=location.origin+'/assets/vision-dimensions-logo.png',sections=current.sections||[],priorities=topRiskProjects(d,12),actions=priorityActions(d),history=trend.slice(-8);
 const card=x=>{const p=Math.max(0,Number(x.total||0)-Number(x.completed||0));return '<article class="kpi"><span>'+esc(x.label)+'</span><strong>'+fmt(x.rate)+'%</strong><div><b>'+fmt(x.total)+'</b> إجمالي • <b>'+fmt(x.completed)+'</b> مكتمل • <b>'+fmt(p)+'</b> متبقي</div></article>'};
 const delta=x=>{const a=thursdaySection(previous,x.key),b=thursdaySection(latest,x.key);if(!(a&&b))return '<article class="delta"><span>'+esc(x.label)+'</span><strong>بانتظار لقطتي خميس</strong></article>';const dr=Math.round((Number(b.rate||0)-Number(a.rate||0))*10)/10;return '<article class="delta"><span>'+esc(x.label)+'</span><strong class="'+(dr>0?'pos':dr<0?'neg':'flat')+'">'+signedThursday(dr,1)+' نقطة</strong><small>'+esc(previous.label)+' '+fmt(a.rate)+'% ← '+esc(latest.label)+' '+fmt(b.rate)+'%</small></article>'};
 const img=id=>{const s=urgentThursdayChartImage(id);return s?'<img src="'+s+'">':'<div class="empty">لا توجد لقطات أسبوعية كافية بعد</div>'};
 const histRows=history.length?history.map(z=>'<tr><td>'+esc(z.label||z.date||'')+'</td>'+['coverage','permits','risk','quality','handover'].map(k=>'<td>'+fmt(thursdaySection(z,k)?.rate||0)+'%</td>').join('')+'</tr>').join(''):'<tr><td colspan="6">لا توجد لقطات خميس محفوظة بعد.</td></tr>';
 const priorityRows=priorities.length?priorities.map((x,i)=>'<tr><td>'+(i+1)+'</td><td>'+esc(x.p.no||x.p.name||'—')+'</td><td>'+esc(x.p.municipality||'—')+'</td><td>'+esc(x.p.contractor||'—')+'</td><td>'+x.score+'</td><td>'+esc(x.reasons.slice(0,3).join(' • ')||'متابعة عامة')+'</td></tr>').join(''):'<tr><td colspan="6">لا توجد حالات.</td></tr>';
 const actionRows=actions.map((x,i)=>'<tr><td>'+(i+1)+'</td><td>'+esc(x.title)+'</td><td>'+esc(x.text)+'</td></tr>').join('');
 const totalPages=4;
 const header=(n,sub)=>'<header><img src="'+logo+'"><div><h1>التقرير الأسبوعي لمتابعة الحلول العاجلة</h1><p>Smart Thursday Weekly Executive Report</p><p>'+esc(sub)+'</p><code>'+esc(fileTitle)+'</code></div><aside><b>إدارة الحلول العاجلة</b><span>'+esc(stamp)+'</span></aside></header><section class="info"><span><b>الفترة:</b>'+esc(dateLabel(w.from))+' — '+esc(dateLabel(w.to))+'</span><span><b>المقارنة:</b>'+(previous&&latest?esc(previous.label)+' مقابل '+esc(latest.label):'بانتظار خط أساس')+'</span><span><b>الصفحة:</b>'+n+' / '+totalPages+'</span></section>';
 const footer=n=>'<footer><span>شركة أبعاد الرؤية للاستشارات الهندسية</span><span dir="ltr">'+esc(fileTitle)+'</span><span>صفحة '+n+' من '+totalPages+'</span></footer>';
 const page=(n,sub,body)=>'<main class="page">'+header(n,sub)+body+footer(n)+'</main>';
 const html='<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>'+esc(fileTitle)+'</title><style>@page{size:A4 landscape;margin:0}*{box-sizing:border-box}body{margin:0;color:#172b5f;font-family:Tahoma,Arial,sans-serif;background:#fff;font-size:9px}.page{width:297mm;height:210mm;padding:7mm 9mm 14mm;position:relative;overflow:hidden;page-break-after:always}.page:last-child{page-break-after:auto}.page:before{content:"";position:absolute;left:-20mm;bottom:-28mm;width:345mm;height:54mm;border-top:8mm solid #232d70;border-radius:50% 50% 0 0/100% 100% 0 0}.page:after{content:"";position:absolute;left:-18mm;bottom:-20mm;width:340mm;height:43mm;border-top:4.5mm solid #d9dde3;border-radius:50% 50% 0 0/100% 100% 0 0}.page>*{position:relative;z-index:2}header{min-height:23mm;text-align:center;position:relative}header img{position:absolute;left:0;top:0;width:27mm;height:17mm;object-fit:contain}header>div{padding:0 42mm}header h1{margin:0;font-size:18px}header h1:after{content:"";display:block;width:72mm;height:1px;background:#f2a31b;margin:2.5mm auto 0}header p{margin:.8mm 0;color:#6e737b;font-size:8px;font-weight:700}header code{font-size:6px;color:#7a8490}header aside{position:absolute;right:0;top:0;text-align:right;font-size:7px}header aside b,header aside span{display:block}.info{margin-bottom:3mm;border:1px solid #26396f;display:grid;grid-template-columns:2fr 2fr 1fr}.info span{padding:2mm;background:#f7f8fa;border-left:1px solid #c8ced9}.info span:last-child{border-left:0}.info b{margin-left:1mm}.section{display:flex;align-items:center;gap:2mm;width:max-content;padding:1.4mm 3mm;background:#172b5f;color:#fff;border-radius:3px 3px 0 0;margin:2mm 0 0 auto}.section h2{margin:0;font-size:9px}.grid{display:grid;grid-template-columns:repeat(5,1fr);gap:2mm;border-top:1px solid #26396f;padding-top:1.5mm}.kpi,.delta{border:1px solid #26396f;border-radius:3px;padding:2mm;background:#fff;min-height:28mm;text-align:center}.kpi span,.delta span{display:block;font-weight:900;font-size:7px}.kpi strong,.delta strong{display:block;margin:1mm 0;color:#f19500;font-size:15px}.kpi div{font-size:6px;color:#667184}.delta small{display:block;color:#6f7784;font-size:5.8px}.pos{color:#148a5b!important}.neg{color:#c64f58!important}.flat{color:#f19500!important}.chart{border:1px solid #26396f;border-radius:3px;overflow:hidden;background:#fff}.chart h3{margin:0;padding:1.5mm 2mm;background:#172b5f;color:#fff;font-size:8px}.chart img{width:100%;height:55mm;object-fit:contain}.chart .empty{height:55mm;display:grid;place-items:center;color:#7a808a}.chartgrid{display:grid;grid-template-columns:1fr 1fr;gap:3mm}.chart.wide img,.chart.wide .empty{height:72mm}.two{display:grid;grid-template-columns:1fr 1fr;gap:3mm}.box{border:1px solid #26396f;border-radius:3px;overflow:hidden}.box h3{margin:0;padding:1.5mm 2mm;background:#172b5f;color:#fff;font-size:8px}.box table{width:100%;border-collapse:collapse;font-size:6px}.box th,.box td{padding:1mm;border:1px solid #d5d9e0;text-align:right}.box th{background:#eef0f4}footer{position:absolute;bottom:2.5mm;right:9mm;left:9mm;display:grid;grid-template-columns:auto 1fr auto;gap:3mm;color:#777f8a;font-size:5.8px}footer span:nth-child(2){text-align:center}@media print{body{margin:0}}</style></head><body>'+
 page(1,'الوضع الحالي والفروق الأسبوعية','<div class="section"><h2>1. الوضع الحالي الحي</h2></div><div class="grid">'+sections.map(card).join('')+'</div><div class="section"><h2>2. فرق خميس مقابل خميس</h2></div><div class="grid">'+sections.map(delta).join('')+'</div>')+
 page(2,'الاتجاه الأسبوعي','<div class="section"><h2>3. اتجاه جميع المؤشرات</h2></div><section class="chart wide"><h3>التريند الأسبوعي — المؤشرات الخمسة</h3>'+img('ustTrend')+'</section><div class="section"><h2>4. التغطية والتسليم</h2></div><div class="chartgrid"><section class="chart"><h3>التغطية وجاهزية التسليم</h3>'+img('ustCoverageTrend')+'</section><section class="chart"><h3>سلامة التصاريح</h3>'+img('ustPermitTrend')+'</section></div>')+
 page(3,'المخاطر والجودة','<div class="section"><h2>5. مؤشرات الاستقرار</h2></div><div class="chartgrid"><section class="chart"><h3>استقرار المخاطر</h3>'+img('ustRiskTrend')+'</section><section class="chart"><h3>جودة البيانات</h3>'+img('ustQualityTrend')+'</section></div><div class="section"><h2>6. قرارات الأسبوع القادم</h2></div><section class="box"><table><thead><tr><th>#</th><th>القرار</th><th>الإجراء المطلوب</th></tr></thead><tbody>'+actionRows+'</tbody></table></section>')+
 page(4,'الأولويات واللقطات','<div class="section"><h2>7. أعلى الحالات التي تتطلب متابعة</h2></div><section class="box"><table><thead><tr><th>#</th><th>المشروع</th><th>البلدية</th><th>المقاول</th><th>الأولوية</th><th>الأسباب</th></tr></thead><tbody>'+priorityRows+'</tbody></table></section><div class="section"><h2>8. آخر لقطات الخميس</h2></div><section class="box"><table><thead><tr><th>الخميس</th><th>التغطية</th><th>التصاريح</th><th>المخاطر</th><th>الجودة</th><th>التسليم</th></tr></thead><tbody>'+histRows+'</tbody></table></section>')+
 '<script>window.addEventListener("load",function(){setTimeout(function(){window.print()},900)});<\/script></body></html>';
 win.document.open();win.document.write(html);win.document.close();
}
function renderThursday(){
 const h=host(),d=data(),current=thursdayPayload(),trend=thursdayTrend(),latest=trend.length?trend[trend.length-1]:null,previous=trend.length>1?trend[trend.length-2]:null,w=weekWindow(),actions=priorityActions(d),baselineText=previous&&latest?('مقارنة إغلاق '+previous.label+' مع '+latest.label):'تظهر الفروق بعد توفر لقطتي خميس رسميتين';
 h.innerHTML=smartTabs('smartThursday')+
 '<section class="st-hero us-thursday-hero"><div><span>VISION DIMENSIONS • THURSDAY SMART REPORT</span><h2>تقرير الخميس الذكي — الحلول العاجلة</h2><p>الوضع الحالي حي من الشيتات، والمقارنة الأسبوعية بين لقطات الخميس الرسمية فقط.</p><small>الفترة الحالية: '+esc(dateLabel(w.from))+' — '+esc(dateLabel(w.to))+' • '+esc(baselineText)+'</small></div><div class="stp-actions"><button id="usSyncThursday" type="button">↻ مزامنة</button><button id="usExportThursday" class="stp-export-btn" type="button">⇩ تصدير تقرير PDF</button></div></section>'+
 '<section class="stp-root" id="usThursdayPortfolio">'+
 '<div class="stp-section-head"><div><span>LIVE STATUS</span><h3>الوضع الحالي</h3></div><small>قراءة حية من الشيتات أياً كان اليوم — لا تعتمد على لقطة الخميس</small></div>'+
 '<div class="stp-section-grid stp-live-grid">'+current.sections.map(liveThursdayCard).join('')+'</div>'+
 '<div class="stp-section-head"><div><span>THURSDAY BASELINE DELTA</span><h3>الفرق بين خطي الأساس الأسبوعيين</h3></div><small>'+esc(baselineText)+'</small></div>'+
 '<div class="stp-section-grid">'+current.sections.map(x=>baselineThursdayCard(x,latest,previous)).join('')+'</div>'+
 '<div class="stp-chart-grid"><article class="stp-panel stp-wide"><div><span>WEEKLY TREND</span><h3>التغير الأسبوعي لكل مؤشر بصورة مستقلة</h3></div><canvas id="ustTrend"></canvas></article>'+
 '<article class="stp-panel"><div><span>COVERAGE • HANDOVER</span><h3>تريند التغطية وجاهزية التسليم</h3></div><canvas id="ustCoverageTrend"></canvas></article>'+
 '<article class="stp-panel"><div><span>PERMITS</span><h3>تريند سلامة التصاريح</h3></div><canvas id="ustPermitTrend"></canvas></article>'+
 '<article class="stp-panel"><div><span>RISK</span><h3>تريند استقرار المخاطر</h3></div><canvas id="ustRiskTrend"></canvas></article>'+
 '<article class="stp-panel"><div><span>DATA QUALITY</span><h3>تريند جودة البيانات</h3></div><canvas id="ustQualityTrend"></canvas></article></div>'+
 '<div class="stp-foot"><b>منهج الاحتساب:</b> الوضع الحالي يُقرأ مباشرة من الشيتات. خط الأساس الأسبوعي يُحفظ في VD Thursday Progress يوم الخميس فقط؛ وأي فرق أسبوعي أو تريند يقارن لقطات خميس رسمية ولا يقارن لقطة حية بلقطة أسبوعية.</div>'+
 '<div class="us-grid two us-thursday-support">'+panel('قرارات مطلوبة للأسبوع القادم','NEXT WEEK DECISIONS','<div class="us-action-list">'+actions.map((x,i)=>'<div><b>'+String(i+1).padStart(2,'0')+'</b><span><strong>'+esc(x.title)+'</strong><small>'+esc(x.text)+'</small></span></div>').join('')+'</div>')+panel('أعلى الحالات التي تتطلب متابعة','WEEKLY PRIORITIES',riskTable(topRiskProjects(d,10)))+'</div></section>';
 wireSmartTabs();
 document.getElementById('usSyncThursday')?.addEventListener('click',async()=>{await syncThursday(true);if(state().page==='smartThursday')renderThursday();window.VDUrgent?.toast?.(thursdayCentral?.snapshotToday?'تم تحديث لقطة الخميس المركزية':'تم تحديث المقارنة؛ حفظ اللقطة الرسمية يتم يوم الخميس')});
 document.getElementById('usExportThursday')?.addEventListener('click',exportUrgentThursdayReport);
 h.querySelectorAll('[data-thursday-page]').forEach(c=>c.addEventListener('click',()=>openPage(c.dataset.thursdayPage)));
 setTimeout(drawUrgentThursdayCharts,30);
}
function wireOpenButtons(){host()?.querySelectorAll('[data-smart-open]').forEach(b=>b.addEventListener('click',()=>openPage(b.dataset.smartOpen)))}
function renderSmartPage(page,hydrated=false){
 const h=host();if(!h)return;captureLocal(false);
 if(page==='smartCenter')renderCenter();else if(page==='temporalMemory')renderMemory();else if(page==='investigationRoom')renderInvestigation();else if(page==='explainableDecision')renderDecision();else if(page==='smartThursday')renderThursday();
 if(!hydrated){
  const task=page==='smartThursday'?Promise.all([syncCentralHistory(false),syncThursday(false)]):syncCentralHistory(false);
  Promise.resolve(task).then(()=>{if(state().page===page)requestAnimationFrame(()=>renderSmartPage(page,true))});
 }
}
function onPage(){const page=state().page||'';updateFilterVisibility(page);if(SMART_PAGES.has(page))requestAnimationFrame(()=>renderSmartPage(page))}
window.addEventListener('vd:urgent-data',()=>{captureLocal(false);centralSyncAt=0;thursdaySyncAt=0;syncCentralHistory(false);syncThursday(false)});
window.addEventListener('vd:page-rendered',onPage);
document.addEventListener('DOMContentLoaded',onPage);
})();