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
function renderThursday(){
 const h=host(),d=data(),s=d.summaries||{},pt=d.permitTiming||{},cur=metricSnapshot(d),prev=previousThursday(),w=weekWindow(),actions=priorityActions(d),baseline=thursdayCentral?.baselineDate;
 h.innerHTML=smartTabs('smartThursday')+smartHeader('SMART THURSDAY • WEEKLY EXECUTIVE BRIEF','تقرير الخميس الذكي','ملخص أسبوعي ذكي للتقدم والتغيرات والمؤشرات والقرارات المطلوبة.','<button class="us-primary" id="usSyncThursday">↻ مزامنة تقرير الخميس</button>')+
 '<div class="us-week-window"><span>الفترة الأسبوعية</span><b>'+esc(dateLabel(w.from))+' → '+esc(dateLabel(w.to))+'</b><small>'+(baseline?'خط الأساس المركزي: '+esc(baseline):'لا يوجد خميس سابق محفوظ بعد')+'</small></div>'+
 '<div class="us-kpis">'+kpi('المشاريع',fmt(s.projects),'إجمالي')+kpi('المخاطر العالية',fmt(s.highRiskProjects),'حرج + مرتفع','danger')+kpi('التصاريح المنتهية',fmt(pt.expired),'الحالة الحالية','warn')+kpi('التغطية المطابقة',fmt(s.matchedCoveragePct)+'%','أمتار منفذة/مستحقة')+kpi('جودة البيانات',fmt(s.qualityIssues),'ملاحظة')+kpi('التصميم قيد المتابعة',fmt(s.designPending),'خط بديل')+'</div>'+
 '<div class="us-grid two">'+panel('ما تغير منذ الخميس السابق','WEEKLY DELTA','<div class="us-change-list">'+[diffText(cur,prev,'highRisk','المخاطر العالية',true),diffText(cur,prev,'expired','التصاريح المنتهية',true),diffText(cur,prev,'quality','ملاحظات الجودة',true),diffText(cur,prev,'coverage','التغطية'),diffText(cur,prev,'handover','جاهزية التسليم')].map((x,i)=>'<div><b>'+(i+1)+'</b><span>'+esc(x)+'</span></div>').join('')+'</div>')+panel('قرارات مطلوبة للأسبوع القادم','NEXT WEEK DECISIONS','<div class="us-action-list">'+actions.map((x,i)=>'<div><b>'+String(i+1).padStart(2,'0')+'</b><span><strong>'+esc(x.title)+'</strong><small>'+esc(x.text)+'</small></span></div>').join('')+'</div>')+'</div>'+
 panel('أعلى الحالات التي تتطلب متابعة','WEEKLY PRIORITIES',riskTable(topRiskProjects(d,10)))+
 panel('ملاحظات التقرير','METHODOLOGY','<div class="us-method">الذاكرة الأسبوعية مركزية داخل ورقة VD Thursday Progress. لا تُنشأ لقطة أسبوعية رسمية إلا يوم الخميس؛ خلال الخميس يتم تحديث نفس اللقطة، وبعد انتهاء اليوم تظل ثابتة للمقارنات اللاحقة.</div>');
 wireSmartTabs();document.getElementById('usSyncThursday')?.addEventListener('click',async()=>{await syncThursday(true);if(state().page==='smartThursday')renderThursday();window.VDUrgent?.toast?.(thursdayCentral?.snapshotToday?'تم تحديث لقطة الخميس المركزية':'تم تحديث المقارنة؛ حفظ اللقطة الرسمية يتم يوم الخميس')});
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