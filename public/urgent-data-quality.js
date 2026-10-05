(function(){
'use strict';

const DQ={sections:[],advanced:[]};
const archiveUrl='https://u.pcloud.link/publink/show?code=kZCKlU5ZwyDsJUjxzdhWgIKBxxljomcV74HX#/filemanager?folder=31795965088';
const txt=v=>String(v==null?'':v).replace(/\s+/g,' ').trim();
const html=v=>txt(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number=v=>new Intl.NumberFormat('ar-SA',{maximumFractionDigits:1}).format(Number(v||0));
const normal=v=>txt(v).normalize('NFKD').replace(/[\u064B-\u065F\u0670]/g,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').toLowerCase();
const blank=(r,k)=>!txt(r&&r[k]);
const exact=(v,x)=>normal(v)===normal(x);
const has=(v,x)=>normal(v).includes(normal(x));
const validCoord=r=>{
  const lat=Number(r&&r.lat),lon=Number(r&&r.lon);
  return Number.isFinite(lat)&&Number.isFinite(lon)&&lat>20&&lat<23&&lon>38&&lon<41;
};
const rowNo=r=>r?.row||r?._row||'—';
const rowId=(r,section)=>{
  if(section==='projects')return txt(r.no||r.name)||'مشروع — صف '+rowNo(r);
  if(section==='permits')return txt(r.id)||'تصريح — صف '+rowNo(r);
  if(section==='lines')return txt(r.ref||r.name)||'خط — صف '+rowNo(r);
  if(section==='complaints')return txt(r.text).slice(0,80)||'شكوى — صف '+rowNo(r);
  if(section==='linkage')return txt(r.no||r.name)||'ربط — صف '+rowNo(r);
  return 'صف '+rowNo(r);
};
const context=(r,section)=>{
  if(section==='projects')return txt(r.contractor||r.owner||r.municipality)||'—';
  if(section==='permits')return txt(r.helperContractor||r.owner||r.helperMunicipality)||'—';
  if(section==='lines')return txt(r.contractor||r.owner||r.designer)||'—';
  if(section==='complaints')return txt(r.status)||'—';
  if(section==='linkage')return txt(r.contractor||r.owner)||'—';
  return '—';
};
const sourceName=section=>({
  projects:'vd projects',
  permits:'info. new',
  lines:'Alternative lines',
  complaints:'info. new',
  linkage:'ربط مشتق'
}[section]||section);

function parseDate(v){
  const s=txt(v);if(!s)return null;
  const d=new Date(s);if(!isNaN(d))return d;
  const m=s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
  if(!m)return null;
  const a=Number(m[1]),b=Number(m[2]),y=Number(m[3]);
  const d1=new Date(y,b-1,a);if(d1.getFullYear()===y&&d1.getMonth()===b-1&&d1.getDate()===a)return d1;
  const d2=new Date(y,a-1,b);if(d2.getFullYear()===y&&d2.getMonth()===a-1&&d2.getDate()===b)return d2;
  return null;
}
function dateLabel(v){
  const d=parseDate(v);if(!d)return txt(v)||'—';
  const p=n=>String(n).padStart(2,'0');
  return p(d.getDate())+'/'+p(d.getMonth()+1)+'/'+d.getFullYear();
}
function missing(label,col,field,header,note,applicable){
  return {label,col,field,header,note:note||('العمود '+col+' — بيانات ناقصة'),issue:r=>blank(r,field),value:()=> 'فارغ',applicable:applicable||(()=>true)};
}
function custom(label,col,header,note,predicate,value,applicable){
  return {label,col,header,note,issue:predicate,value:value||(()=> '—'),applicable:applicable||(()=>true)};
}
function linkedLineMap(data){
  return new Set((data.lines||[]).map(x=>txt(x.ref)).filter(Boolean));
}
function definitions(data){
  const lineRefs=linkedLineMap(data);
  return [
    {key:'projects',title:'المشاريع',subtitle:'💧 vd projects',rows:data.projects||[],cards:[
      missing('بدون حالة عقد','D','contractStatus','حالة العقد'),
      missing('بدون جهة مالكة','S','owner','الجهة المالكة'),
      missing('بدون مقاول رئيسي','T','contractor','المقاول الرئيسي'),
      missing('بدون بلدية','V','municipality','البلدية'),
      missing('بدون حي','W','district','الحي'),
      missing('بدون شارع','X','street','الشارع'),
      custom('إحداثيات غير مكتملة','Z + AA','E / N','العمودان Z وAA — إحداثيات الموقع يجب أن تكون صالحة للرسم على خريطة جدة',r=>!validCoord(r),r=>(txt(r.lat)||'فارغ')+' / '+(txt(r.lon)||'فارغ')),
      missing('بدون رقم معاملة','AB','transactionNo','رقم المعاملة','العمود AB — مطلوب عند وجود تصريح فعلي',r=>!!txt(r.permitRefs)&&!exact(r.permitRefs,'مشروع ملغي')),
      missing('بدون مرجع تصريح','AC','permitRefs','أرقام تصاريح المشروع'),
      missing('بدون حالة تصريح','AI','permitStatus','حالة التصريح / التصاريح','العمود AI — مطلوب عند وجود مرجع تصريح',r=>!!txt(r.permitRefs)&&!exact(r.permitRefs,'مشروع ملغي'))
    ]},
    {key:'permits',title:'التصاريح',subtitle:'🧾 info. new',rows:data.permits||[],cards:[
      custom('رقم تصريح غير نمطي','A','التصاريح','العمود A — رقم التصريح يجب أن يكون رقمًا أو رقمًا بامتداد مثل 123-1 عند وجود تواريخ تصريح',r=>!!txt(r.start)&&!!txt(r.end)&&!!txt(r.id)&&!/^(?:\d+|\d+-\d+)$/.test(txt(r.id)),r=>txt(r.id)),
      missing('بدون تاريخ بداية','B','start','تاريخ بداية التصريح','العمود B — مطلوب للتصاريح الفعلية',r=>!!txt(r.id)&&!exact(r.id,'تحت الاصدار')&&!exact(r.id,'مشروع ملغي')),
      missing('بدون تاريخ نهاية','C','end','تاريخ نهاية التصريح','العمود C — مطلوب للتصاريح الفعلية',r=>!!txt(r.id)&&!exact(r.id,'تحت الاصدار')&&!exact(r.id,'مشروع ملغي')),
      custom('نهاية أسبق من البداية','B + C','فترة التصريح','تاريخ نهاية التصريح لا يجوز أن يسبق تاريخ البداية',r=>{const a=parseDate(r.start),b=parseDate(r.end);return !!a&&!!b&&b<a},r=>dateLabel(r.start)+' ← '+dateLabel(r.end)),
      custom('بدون أمتار مستحقة','E','عدد الأمتار المستحقة','العمود E — يجب تسجيل الأمتار للتصريح الفعلي',r=>!!txt(r.start)&&!!txt(r.end)&&!(Number(r.meters)>0),r=>txt(r.meters)||'0'),
      missing('بدون مالك','F','owner','صاحب مشروع الضخ','العمود F — بيانات ناقصة',r=>!!txt(r.start)&&!!txt(r.end)),
      missing('بدون رابط تصريح','G','permitLink','رابط التصريح','العمود G — بيانات ناقصة',r=>!!txt(r.start)&&!!txt(r.end)),
      missing('بدون بلدية','I','helperMunicipality','البلدية','العمود I — بيانات ناقصة',r=>!!txt(r.start)&&!!txt(r.end)),
      missing('بدون حي','J','helperDistrict','الحي','العمود J — بيانات ناقصة',r=>!!txt(r.start)&&!!txt(r.end)),
      missing('بدون شارع','K','helperStreet','الشارع','العمود K — بيانات ناقصة',r=>!!txt(r.start)&&!!txt(r.end)),
      missing('بدون مقاول','M','helperContractor','المقاولين','العمود M — بيانات ناقصة',r=>!!txt(r.start)&&!!txt(r.end))
    ]},
    {key:'lines',title:'الخطوط البديلة',subtitle:'〰️ Alternative lines',rows:data.lines||[],cards:[
      missing('بدون بلدية','C','municipality','البلدية'),
      missing('بدون حي','D','district','الحي'),
      missing('بدون شارع','E','street','الشارع'),
      custom('إحداثيات غير مكتملة','G + H','E / N','العمودان G وH — إحداثيات الخط يجب أن تكون صالحة للرسم على خريطة جدة',r=>!validCoord(r),r=>(txt(r.lat)||'فارغ')+' / '+(txt(r.lon)||'فارغ')),
      missing('بدون خطاب تكليف','I','assignmentNo','رقم خطاب التكليف'),
      missing('بدون تاريخ تكليف','K','assignmentDate','تاريخ التكليف'),
      missing('بدون مقاول','L','contractor','المقاول المكلف بالخط البديل'),
      missing('بدون مالك','M','owner','المالك المكلف بالخط البديل'),
      missing('بدون مهندس مصمم','N','designer','المهندس المصمم'),
      missing('بدون نوع خط','O','type','نوع الخط البديل'),
      custom('بدون طول خط','P','طول الخط البديل','العمود P — طول الخط يجب أن يكون أكبر من صفر',r=>!(Number(r.length)>0),r=>txt(r.length)||'0'),
      custom('بدون طول تصميم','Q','طول التصميم','العمود Q — طول التصميم يجب أن يكون أكبر من صفر',r=>!(Number(r.designLength)>0),r=>txt(r.designLength)||'0'),
      missing('بدون قطر تصميم','R','diameter','أقطار التصميم'),
      missing('بدون حالة تصميم','T','designStatus','حالة تصميم الخط البديل'),
      missing('بدون رقم معاملة','U','transactionNo','رقم المعاملة','العمود U — مطلوب بعد بدء إجراءات التصميم',r=>!!txt(r.designStatus)),
      missing('بدون تاريخ رفع','V','submissionDate','تاريخ رفع معاملة الدراسات والتصاميم','العمود V — مطلوب بعد بدء إجراءات التصميم',r=>!!txt(r.designStatus)),
      missing('معتمد بدون تاريخ اعتماد','W','approvalDate','تاريخ الاعتماد','العمود W — مطلوب عندما تكون حالة التصميم معتمدة فعليًا',r=>/معتمد/i.test(txt(r.designStatus)))
    ]},
    {key:'complaints',title:'الشكاوى',subtitle:'📣 info. new — شكاوى المواطنين',rows:data.complaints||[],cards:[
      missing('بدون حالة متابعة','W','status','حالة الشكوى'),
      missing('بدون ربط بحل / خط','X','link','الخط البديل المقابل كحل للشكوى')
    ]},
    {key:'linkage',title:'الربط والتكامل',subtitle:'🔗 الربط بين المشاريع والخطوط',rows:data.traceability||[],cards:[
      custom('مشروع بدون خط مطابق','—','الربط بالمالك + المقاول','لا يوجد خط بديل مطابق لنفس المالك والمقاول',r=>Number(r.lineCount||0)===0,r=>'لا يوجد ربط مطابق'),
      custom('ربط بدون أمتار منفذة','—','أمتار الخطوط','يوجد ربط بخط بديل لكن إجمالي أمتار الخطوط يساوي صفر',r=>Number(r.lineCount||0)>0&&!(Number(r.lineMeters)>0),r=>txt(r.lineMeters)||'0'),
      custom('مرجع خط غير موجود','T','الرقم المرجعي للخط البديل','مرجع في info. new غير موجود في Alternative lines',r=>false,r=>txt(r.ref)||'فارغ')
    ],extraRows:(data.refLines||[]).filter(r=>txt(r.ref)&&!lineRefs.has(txt(r.ref)))}
  ];
}
function sectionStats(section){
  const affected=new Set(),counts=[];let totalCells=0;
  section.cards.forEach((card,ci)=>{
    const applicable=card.applicable||(()=>true);
    let rows=[];
    if(section.key==='linkage'&&ci===2){
      rows=(section.extraRows||[]);
      totalCells+=(section.extraRows||[]).length;
    }else{
      const applicableRows=section.rows.filter(applicable);
      totalCells+=applicableRows.length;
      rows=applicableRows.filter(card.issue);
    }
    counts.push(rows.length);
    rows.forEach(r=>affected.add((r.row||r._row||r.no||r.ref||r.id||JSON.stringify(r))));
  });
  const issues=counts.reduce((a,b)=>a+b,0);
  const rate=totalCells?((totalCells-issues)/totalCells)*100:100;
  return {issues,affected:affected.size,counts,totalCells,completionRate:Math.max(0,Math.min(100,rate))};
}
function issueRows(section,cardIndex){
  if(section.key==='linkage'&&cardIndex===2)return section.extraRows||[];
  const card=section.cards[cardIndex],applicable=card.applicable||(()=>true);
  return section.rows.filter(r=>applicable(r)&&card.issue(r));
}
function detailRows(section,cardIndex){
  const card=section.cards[cardIndex];
  return issueRows(section,cardIndex).map(r=>({
    source:sourceName(section.key),
    row:rowNo(r),
    id:rowId(r,section.key),
    context:context(r,section.key),
    value:card.value(r),
    rule:card.note
  }));
}
function renderDetails(section,cardIndex){
  const card=section.cards[cardIndex],rows=detailRows(section,cardIndex),root=document.getElementById('udqIssueDetails');
  if(!root)return;
  root.innerHTML='<div class="dq-detail-head"><div><span>ISSUE DRILLDOWN</span><h3>'+html(section.title)+' — '+html(card.label)+'</h3><small>'+html(card.note)+'</small></div><div class="dq-detail-count">'+number(rows.length)+' حالة</div></div>'+
   (rows.length?'<div class="dq-table-wrap"><table><thead><tr><th>#</th><th>المصدر</th><th>صف الشيت</th><th>المعرف</th><th>المقاول / المالك / الحالة</th><th>القيمة الحالية</th><th>قاعدة الجودة</th></tr></thead><tbody>'+
   rows.map((r,i)=>'<tr><td>'+(i+1)+'</td><td>'+html(r.source)+'</td><td>'+html(r.row)+'</td><td><b>'+html(r.id)+'</b></td><td>'+html(r.context)+'</td><td>'+html(r.value)+'</td><td>'+html(r.rule)+'</td></tr>').join('')+
   '</tbody></table></div>':'<div class="dq-empty">لا توجد حالات مخالفة لهذه القاعدة حاليًا.</div>');
  root.scrollIntoView({behavior:'smooth',block:'start'});
}
function smartRow(source,row,issue,value){
  return {source,row:rowNo(row),id:txt(row.no||row.id||row.ref||row.name||row.text)||'—',context:txt(row.contractor||row.owner||row.status)||'—',issue,value:txt(value)||'—'};
}
function duplicateBy(rows,key,source){
  const map=new Map(),out=[];
  rows.forEach(r=>{const v=txt(r[key]);if(!v)return;if(!map.has(normal(v)))map.set(normal(v),[]);map.get(normal(v)).push(r)});
  map.forEach(group=>{if(group.length>1)group.forEach(r=>out.push(smartRow(source,r,'معرف مكرر',txt(r[key]))))});
  return out;
}
function advancedChecks(data){
  const projects=data.projects||[],permits=data.permits||[],lines=data.lines||[],refs=data.refLines||[],quality=data.quality||[];
  const dup=[
    ...duplicateBy(projects,'no','vd projects'),
    ...duplicateBy(permits,'id','info. new'),
    ...duplicateBy(lines,'ref','Alternative lines')
  ];
  const dates=[];
  projects.forEach(r=>{const a=parseDate(r.startDate),b=parseDate(r.endDate);if(a&&b&&b<a)dates.push(smartRow('vd projects',r,'نهاية المشروع أسبق من البداية',dateLabel(r.startDate)+' ← '+dateLabel(r.endDate)))});
  permits.forEach(r=>{const a=parseDate(r.start),b=parseDate(r.end);if(a&&b&&b<a)dates.push(smartRow('info. new',r,'نهاية التصريح أسبق من البداية',dateLabel(r.start)+' ← '+dateLabel(r.end)))});
  lines.forEach(r=>{if(r.chronologyIssue)dates.push(smartRow('Alternative lines',r,'رفع التصميم يسبق تاريخ التكليف',dateLabel(r.submissionDate)+' ← '+dateLabel(r.assignmentDate)))});
  const coords=[
    ...projects.filter(r=>!validCoord(r)).map(r=>smartRow('vd projects',r,'إحداثيات غير صالحة',txt(r.lat)+' / '+txt(r.lon))),
    ...lines.filter(r=>!validCoord(r)).map(r=>smartRow('Alternative lines',r,'إحداثيات غير صالحة',txt(r.lat)+' / '+txt(r.lon)))
  ];
  const lineSet=new Set(lines.map(r=>txt(r.ref)).filter(Boolean));
  const orphans=refs.filter(r=>txt(r.ref)&&!lineSet.has(txt(r.ref))).map(r=>smartRow('info. new',r,'مرجع خط غير موجود في Alternative lines',r.ref));
  const designConflict=lines.filter(r=>/جاري|قيد/i.test(txt(r.designStatus))&&!!txt(r.approvalDate)).map(r=>smartRow('Alternative lines',r,'حالة تصميم جارية رغم وجود تاريخ اعتماد',r.designStatus+' | '+dateLabel(r.approvalDate)));
  const staleDesign=lines.filter(r=>/جاري|قيد/i.test(txt(r.designStatus))&&!txt(r.approvalDate)&&Number(r.designAgeDays)>60).map(r=>smartRow('Alternative lines',r,'تصميم متقادم أكثر من 60 يومًا',Number(r.designAgeDays)+' يوم'));
  const highServer=quality.filter(x=>x.severity==='high').map(x=>({source:x.source,row:x.row,id:'صف '+x.row,context:x.category||'—',issue:x.message||x.category,value:x.category||'—'}));
  return [
    {label:'معرفات مكررة',note:'تكرار رقم المشروع أو التصريح أو الرقم المرجعي للخط داخل نفس المصدر.',rows:dup},
    {label:'تاريخ غير منطقي',note:'نهاية أسبق من البداية أو تسلسل زمني غير صحيح بين التكليف والرفع.',rows:dates},
    {label:'إحداثيات غير صالحة',note:'إحداثيات مفقودة أو خارج نطاق جدة ولا يمكن تمثيلها على الخريطة.',rows:coords},
    {label:'مرجع خط مفقود',note:'مرجع خط موجود في info. new ولا يوجد له سجل مطابق في Alternative lines.',rows:orphans},
    {label:'تعارض حالة التصميم',note:'حالة التصميم ما زالت جارية / قيد المعالجة رغم وجود تاريخ اعتماد.',rows:designConflict},
    {label:'تصميم متقادم 60+ يوم',note:'تصميم غير معتمد تجاوز 60 يومًا منذ بدء المتابعة.',rows:staleDesign},
    {label:'ملاحظات حرجة من الخادم',note:'جميع ملاحظات الجودة المصنفة عالية الأهمية في فحص الخادم الحالي.',rows:highServer}
  ];
}
function renderAdvancedDetails(check){
  const root=document.getElementById('udqIssueDetails');if(!root)return;
  const rows=check.rows||[];
  root.innerHTML='<div class="dq-detail-head"><div><span>SMART DATA AUDIT</span><h3>التدقيق الذكي — '+html(check.label)+'</h3><small>'+html(check.note)+'</small></div><div class="dq-detail-count">'+number(rows.length)+' حالة</div></div>'+
  (rows.length?'<div class="dq-table-wrap"><table><thead><tr><th>#</th><th>المصدر</th><th>صف الشيت</th><th>المعرف</th><th>السياق</th><th>المشكلة</th><th>القيمة الحالية</th></tr></thead><tbody>'+
   rows.map((r,i)=>'<tr><td>'+(i+1)+'</td><td>'+html(r.source)+'</td><td>'+html(r.row)+'</td><td><b>'+html(r.id)+'</b></td><td>'+html(r.context)+'</td><td>'+html(r.issue)+'</td><td>'+html(r.value)+'</td></tr>').join('')+
   '</tbody></table></div>':'<div class="dq-empty">لا توجد حالات مخالفة لهذا الفحص حاليًا.</div>');
  root.scrollIntoView({behavior:'smooth',block:'start'});
}
function archiveBlock(){
  return '<section class="dq-archive">'+
   '<div class="dq-archive-head"><div><span>DATA QUALITY ARCHIVE</span><h3>أرشيف جودة البيانات</h3><p>فتح أرشيف ملفات ومستندات إدارة الحلول العاجلة داخل الداشبورد بنفس أسلوب العرض المدمج.</p></div><a href="'+archiveUrl+'" target="_blank" rel="noopener noreferrer">فتح في نافذة مستقلة ↗</a></div>'+
   '<div class="dq-archive-frame"><iframe id="qualityArchiveFrame" data-src="'+archiveUrl+'" title="أرشيف جودة البيانات" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe></div>'+
   '<small>إذا منع pCloud العرض المدمج استخدم زر الفتح في نافذة مستقلة.</small>'+
  '</section>';
}
function render(){
  const host=document.getElementById('pageHost');if(!host)return;
  const data=window.VDUrgent?.getState?.()?.data||window.__urgentDashboardData||{};
  const sections=definitions(data);DQ.sections=sections;
  const stats=sections.map(sectionStats);
  const advanced=advancedChecks(data);DQ.advanced=advanced;
  const totalIssues=stats.reduce((s,x)=>s+x.issues,0);
  const totalAffected=stats.reduce((s,x)=>s+x.affected,0);
  const totalCells=stats.reduce((s,x)=>s+x.totalCells,0);
  const rate=totalCells?Math.max(0,Math.min(100,((totalCells-totalIssues)/totalCells)*100)):100;
  const smartTotal=advanced.reduce((s,x)=>s+x.rows.length,0);

  host.innerHTML=
  '<section class="dq-hero">'+
   '<div><span>DATA QUALITY CONTROL</span><h2>مركز مراقبة جودة البيانات</h2><p>مراقبة مباشرة لنواقص الإدخال وقواعد الجودة في المشاريع والتصاريح والخطوط البديلة والشكاوى والربط. اضغط على أي كارت لعرض السجلات التي تحتاج معالجة.</p></div>'+
   '<div class="dq-hero-score"><div class="dq-hero-score-main"><strong>'+number(totalIssues)+'</strong><b>'+(totalIssues===0?'100.00':rate.toFixed(2))+'%</b></div><span>ملاحظات جودة <em>• نسبة الجودة</em></span><small>'+number(totalAffected)+' حالة متأثرة عبر الأقسام</small></div>'+
  '</section>'+
  '<section class="dq-overview">'+
   sections.map((s,i)=>'<button class="dq-overview-card" type="button" data-dq-go="'+html(s.key)+'"><span>'+html(s.title)+'</span><strong>'+number(stats[i].issues)+'</strong><small>'+number(stats[i].affected)+' سجل متأثر</small></button>').join('')+
  '</section>'+
  sections.map((section,si)=>
   '<section class="dq-section" id="udq-'+html(section.key)+'">'+
    '<div class="dq-section-head"><div><span>'+html(section.subtitle)+'</span><h3>'+html(section.title)+'</h3></div><div class="dq-section-metrics"><div><b>'+number(stats[si].issues)+'</b><small>ملاحظات جودة</small></div><div class="dq-quality-rate"><b>'+(stats[si].issues===0?'100.00':stats[si].completionRate.toFixed(2))+'%</b><small>نسبة جودة البيانات</small><em>'+number(stats[si].totalCells-stats[si].issues)+' / '+number(stats[si].totalCells)+' خلية مكتملة</em></div></div></div>'+
    '<div class="dq-cards">'+section.cards.map((card,ci)=>{const count=stats[si].counts[ci];return '<button type="button" class="dq-card '+(count?'has-issue':'is-ok')+'" data-dq-si="'+si+'" data-dq-ci="'+ci+'" title="'+html(card.note)+'"><i>i</i><span>'+html(card.label)+'</span><strong>'+number(count)+'</strong><small>'+html(card.col==='—'?card.header:'العمود '+card.col+' — '+card.header)+'</small></button>'}).join('')+'</div>'+
   '</section>'
  ).join('')+
  '<section class="dq-smart-audit">'+
   '<div class="dq-smart-head"><div><span>SMART DATA AUDIT</span><h3>التدقيق الذكي المتقدم</h3><p>فحوصات إضافية على الترابط والمنطق والتكرار والإحداثيات والتصميم، بنفس فكرة التدقيق المتقدم في داشبورد جدة.</p></div><div class="dq-smart-total"><b>'+number(smartTotal)+'</b><small>ملاحظة ذكية</small></div></div>'+
   '<div class="dq-smart-cards">'+advanced.map((check,i)=>'<button type="button" class="dq-smart-card '+(check.rows.length?'has-issue':'is-ok')+'" data-dq-ai="'+i+'" title="'+html(check.note)+'"><i>✦</i><span>'+html(check.label)+'</span><strong>'+number(check.rows.length)+'</strong><small>'+html(check.note)+'</small></button>').join('')+'</div>'+
  '</section>'+
  '<section id="udqIssueDetails" class="dq-details"><div class="dq-detail-placeholder"><b>تفاصيل الحالات</b><span>اضغط على أي كارت أعلاه لعرض الصفوف التي تحتاج مراجعة.</span></div></section>'+
  archiveBlock();

  host.querySelectorAll('[data-dq-si]').forEach(btn=>btn.addEventListener('click',()=>renderDetails(sections[Number(btn.dataset.dqSi)],Number(btn.dataset.dqCi))));
  host.querySelectorAll('[data-dq-go]').forEach(btn=>btn.addEventListener('click',()=>document.getElementById('udq-'+btn.dataset.dqGo)?.scrollIntoView({behavior:'smooth',block:'start'})));
  host.querySelectorAll('[data-dq-ai]').forEach(btn=>btn.addEventListener('click',()=>renderAdvancedDetails(advanced[Number(btn.dataset.dqAi)])));
  const frame=document.getElementById('qualityArchiveFrame');if(frame&&!frame.src)frame.src=frame.dataset.src||archiveUrl;
}
window.renderUrgentDataQuality=render;
})();