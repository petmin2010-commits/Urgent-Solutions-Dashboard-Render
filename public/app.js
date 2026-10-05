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
 map:{title:'الخريطة الجغرافية',sub:'عرض تفاعلي لمواقع المشاريع والخطوط البديلة مع دعم رفع ملفات KMZ/KML وإدارتها كطبقات مستقلة.',icon:'⌖',eye:'GEOGRAPHIC PROJECT VIEW'},
 permits:{title:'التصاريح',sub:'تحليل التصاريح الفعلية وتواريخها وأمتارها وحالات الانتهاء.',icon:'▤',eye:'PERMITS MANAGEMENT'},
 lines:{title:'الخطوط البديلة والتصميم',sub:'متابعة الخطوط البديلة وأطوالها والمصممين وحالة الاعتماد.',icon:'⌁',eye:'ALTERNATIVE LINES'},
 settlements:{title:'الأمتار والتسويات',sub:'مقارنة الأمتار المستحقة من التصاريح مع الخطوط البديلة المنفذة.',icon:'⇄',eye:'METERS SETTLEMENT'},
 guarantees:{title:'الضمانات',sub:'متابعة الضمانات والتعهدات وتواريخ الانتهاء والحالات الحرجة.',icon:'◇',eye:'GUARANTEES'},
 complaints:{title:'الشكاوى',sub:'متابعة سجل الشكاوى وربطها بالحلول والخطوط البديلة.',icon:'!',eye:'COMPLAINTS'},
 execution:{title:'التنفيذ والتسليم',sub:'متابعة حالة التنفيذ وتقارير الإتمام وخطابات التسليم.',icon:'✓',eye:'EXECUTION & HANDOVER'},
 parties:{title:'المقاولون والملاك',sub:'تحليل أحجام الأعمال والعلاقات بين المقاولين والملاك.',icon:'♙',eye:'PARTIES ANALYTICS'},
 municipalities:{title:'تحليل البلديات',sub:'قراءة جغرافية للأمتار والمشاريع والخطوط والمخاطر حسب البلدية.',icon:'⌂',eye:'MUNICIPALITY ANALYTICS'},
 traceability:{title:'التتبع الشامل',sub:'ربط المشروع بالتصاريح والملاك والمقاولين والخطوط والتصميم والتنفيذ.',icon:'⛓',eye:'END-TO-END TRACEABILITY'},
 quality:{title:'جودة البيانات',sub:'تدقيق ذكي للتعارضات والمراجع المفقودة والقيم غير الطبيعية.',icon:'◎',eye:'DATA QUALITY'},
 risks:{title:'مخاطر المشاريع',sub:'مؤشر مركب للمخاطر النظامية والتعاقدية وفجوات الأمتار وجودة البيانات.',icon:'⚠',eye:'PROJECT RISK CONTROL'},
 analytics:{title:'التحليل التنفيذي',sub:'قراءة إدارية مركزة لأبرز مؤشرات الأداء والمخاطر التشغيلية.',icon:'⌁',eye:'EXECUTIVE ANALYTICS'},
 smartCenter:{title:'مركز التحليل الذكي',sub:'قراءة ذكية موحدة للموقف الحالي والتغيرات والمخاطر والإجراءات ذات الأولوية.',icon:'◆',eye:'SMART INTELLIGENCE CENTER'},
 temporalMemory:{title:'ذاكرة المشروع الزمنية',sub:'حفظ ومقارنة لقطات المؤشرات لرصد بداية التدهور والتغيرات عبر الزمن.',icon:'◷',eye:'PROJECT TEMPORAL MEMORY'},
 investigationRoom:{title:'غرفة التحقيق الذكية',sub:'تحليل أسباب الظواهر والمخاطر واكتشاف مناطق التركّز والأنماط المؤثرة حسب البلدية والمقاول والمالك ومصادر البيانات.',icon:'⌕',eye:'SMART INVESTIGATION ROOM'},
 explainableDecision:{title:'محرك القرار المفسر',sub:'ترتيب الحالات حسب الأولوية مع إظهار سبب الدرجة والأدلة وثقة التغطية والإجراء المقترح.',icon:'⚖',eye:'EXPLAINABLE DECISION ENGINE'},
 smartThursday:{title:'تقرير الخميس الذكي',sub:'ملخص أسبوعي ذكي الجمعة–الخميس للتقدم والتغيرات والمؤشرات والقرارات المطلوبة.',icon:'▣',eye:'SMART THURSDAY REPORT'},
 followup:{title:'المتابعة',sub:'متابعة مباشرة لتقارير ورقة reports بنفس مخرجات Pivot Tables والمعادلات والتسويات المعتمدة في Google Sheets.',icon:'▤',eye:'REPORTS FOLLOW-UP'},
 reports:{title:'مركز التقارير',sub:'مركز موحد لمعاينة وتصدير جميع التقارير بصيغة PDF، بما فيها جداول المتابعة.',icon:'▦',eye:'REPORTS CENTER'},
 excelExport:{title:'تقارير الاكسيل',sub:'اختيار قاعدة البيانات والأعمدة والفلاتر ثم تصدير القيم النهائية فقط.',icon:'▧',eye:'EXCEL REPORTS'}
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
  {field:'guaranteeStatus',label:'حالة الضمان'},{field:'riskLevel',label:'مستوى المخاطر'},
  {field:'extensionPressure',label:'ضغط التمديدات'}
 ],
 map:[
  {field:'municipality',label:'البلدية'},{field:'contractor',label:'المقاول'},
  {field:'owner',label:'المالك'},{field:'projectType',label:'نوع المشروع'},
  {field:'type',label:'نوع الخط'},{field:'permitStatus',label:'حالة التصريح'},
  {field:'designStatus',label:'حالة التصميم'},{field:'executionStatus',label:'حالة التنفيذ'}
 ],
 permits:[
  {field:'municipality',label:'البلدية'},{field:'contractor',label:'المقاول'},
  {field:'owner',label:'المالك'},{field:'year',label:'السنة'},
  {field:'expiryBand',label:'نافذة الانتهاء'},{field:'contractStatus',label:'حالة العقد'},
  {field:'guaranteeStatus',label:'حالة الضمان'}
 ],
 lines:[
  {field:'municipality',label:'البلدية'},{field:'contractor',label:'المقاول'},
  {field:'owner',label:'المالك'},{field:'designer',label:'المصمم'},
  {field:'type',label:'نوع الخط'},{field:'designStatus',label:'حالة التصميم'},
  {field:'year',label:'سنة التكليف'},{field:'diameter',label:'قطر التصميم'},
  {field:'approvalBand',label:'مدة الاعتماد'},{field:'designAgeBand',label:'عمر المتابعة'}
 ],
 settlements:[
  {field:'contractor',label:'المقاول'},{field:'owner',label:'المالك'},{field:'status',label:'حالة التسوية'},
  {field:'coverageBand',label:'نسبة التغطية'}
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
 municipalities:[{field:'municipality',label:'البلدية'}],
 traceability:[
  {field:'municipality',label:'البلدية'},{field:'contractor',label:'المقاول'},{field:'owner',label:'المالك'},
  {field:'riskLevel',label:'مستوى المخاطر'},{field:'contractStatus',label:'حالة العقد'},
  {field:'permitStatus',label:'حالة التصريح'},{field:'matchMethod',label:'طريقة الربط'}
 ],
 quality:[
  {field:'severity',label:'الأهمية'},{field:'category',label:'التصنيف'},{field:'source',label:'المصدر'}
 ],
 risks:[
  {field:'municipality',label:'البلدية'},{field:'contractor',label:'المقاول'},{field:'owner',label:'المالك'},
  {field:'riskLevel',label:'مستوى المخاطر'},{field:'extensionPressure',label:'ضغط التمديدات'},
  {field:'contractStatus',label:'حالة العقد'},{field:'permitStatus',label:'حالة التصريح'},
  {field:'guaranteeStatus',label:'حالة الضمان'}
 ],
 analytics:[
  {field:'municipality',label:'البلدية'},{field:'contractor',label:'المقاول'},{field:'owner',label:'المالك'},
  {field:'riskLevel',label:'مستوى المخاطر'}
 ],
 smartCenter:[
  {field:'municipality',label:'البلدية'},{field:'contractor',label:'المقاول'},{field:'owner',label:'المالك'},
  {field:'riskLevel',label:'مستوى المخاطر'}
 ],
 temporalMemory:[
  {field:'municipality',label:'البلدية'},{field:'contractor',label:'المقاول'},{field:'owner',label:'المالك'},
  {field:'riskLevel',label:'مستوى المخاطر'}
 ],
 investigationRoom:[
  {field:'municipality',label:'البلدية'},{field:'contractor',label:'المقاول'},{field:'owner',label:'المالك'},
  {field:'riskLevel',label:'مستوى المخاطر'}
 ],
 explainableDecision:[
  {field:'municipality',label:'البلدية'},{field:'contractor',label:'المقاول'},{field:'owner',label:'المالك'},
  {field:'riskLevel',label:'مستوى المخاطر'}
 ],
 smartThursday:[
  {field:'municipality',label:'البلدية'},{field:'contractor',label:'المقاول'},{field:'owner',label:'المالك'},
  {field:'riskLevel',label:'مستوى المخاطر'}
 ]
};

const PAGE_SOURCES={
 master:'vd projects + info. new + Alternative lines',
 projects:'vd projects',
 map:'vd projects + Alternative lines — إحداثيات مواقع المشاريع والخطوط البديلة',
 permits:'info. new — التصاريح المؤرخة',
 lines:'Alternative lines',
 settlements:'vd projects + Alternative lines — مقارنة الأمتار حسب المالك والمقاول',
 guarantees:'vd projects',
 complaints:'info. new — شكاوى المواطنين',
 execution:'Alternative lines — حالة التنفيذ والتسليم',
 parties:'vd projects + Alternative lines',
 municipalities:'vd projects + Alternative lines — تجميع حسب البلدية',
 traceability:'vd projects + Alternative lines — ربط تشغيلي بالمالك + المقاول',
 quality:'تدقيق مشتق من vd projects + info. new + Alternative lines',
 risks:'مؤشر مشتق من التصريح والضمان والتسوية والعقد والإحداثيات والتمديدات',
 analytics:'مؤشرات مجمعة من المشاريع والتصاريح والخطوط والتسويات',
 smartCenter:'تحليل مباشر من المشاريع والتصاريح والخطوط والتسويات والضمانات وجودة البيانات',
 temporalMemory:'لقطات زمنية محفوظة من مؤشرات الداشبورد مع مقارنة التغيرات',
 investigationRoom:'تحليل تجميعي للظواهر حسب البلدية والمقاول والمالك ومصدر المشكلة',
 explainableDecision:'قواعد قرار مفسرة مبنية على المخاطر والتصاريح والضمانات والتسويات وجودة البيانات',
 smartThursday:'ملخص الجمعة–الخميس ومقارنة أحدث لقطة زمنية بالخط الأساس السابق',
 followup:'Google Sheets — ورقة reports: Pivot Tables + معادلات التسوية',
 reports:'مركز التقارير الموحد — معاينة وتصدير PDF فقط',
 excelExport:'القيم النهائية من Google Sheets'
};
const CHART_FILTERS={
 master:{cPermitStatus:['permitStatus','حالة التصريح'],cLineType:['type','نوع الخط'],cDesign:['designStatus','حالة التصميم'],cGuarantee:['guaranteeStatus','حالة الضمان'],cYears:['year','السنة'],cMun:['municipality','البلدية'],cRisk:['riskLevel','مستوى المخاطر'],cExt:['extensionPressure','ضغط التمديدات']},
 projects:{pStatus:['contractStatus','حالة العقد'],pType:['projectType','نوع المشروع'],pPermit:['permitStatus','حالة التصريح'],pMun:['municipality','البلدية'],pRisk:['riskLevel','مستوى المخاطر'],pExt:['extensionPressure','ضغط التمديدات']},
 permits:{peYear:['year','السنة'],peMun:['municipality','البلدية'],peCon:['contractor','المقاول'],peOwner:['owner','المالك'],peExpiry:['expiryBand','نافذة الانتهاء'],peMetersYear:['year','السنة']},
 lines:{lType:['type','نوع الخط'],lDesign:['designStatus','حالة التصميم'],lContractor:['contractor','المقاول'],lDesigner:['designer','المصمم'],lApproval:['approvalBand','مدة الاعتماد'],lAging:['designAgeBand','عمر المتابعة'],lDiameter:['diameter','قطر التصميم'],lDiff:['ref','مرجع الخط']},
 settlements:{sStatus:['status','حالة التسوية'],sContractor:['contractor','المقاول'],sCoverage:['coverageBand','نسبة التغطية'],sDueDone:['contractor','المقاول']},
 guarantees:{gStatus:['guaranteeStatus','حالة الضمان'],gContractor:['contractor','المقاول'],gWindow:['guaranteeDays','نافذة الأيام','guaranteeWindow']},
 complaints:{coStatus:['status','حالة الشكوى']},
 execution:{exStatus:['executionStatus','حالة التنفيذ'],exType:['type','نوع الخط']},
 parties:{paCon:['contractor','المقاول'],paOwner:['owner','المالك']},
 municipalities:{muProjects:['municipality','البلدية'],muPermit:['municipality','البلدية'],muLines:['municipality','البلدية'],muRisk:['municipality','البلدية'],muCoverage:['municipality','البلدية']},
 traceability:{trRisk:['riskLevel','مستوى المخاطر'],trMatch:['matchMethod','طريقة الربط']},
 quality:{qCat:['category','التصنيف'],qSource:['source','المصدر']},
 risks:{rLevel:['riskLevel','مستوى المخاطر'],rExt:['extensionPressure','ضغط التمديدات'],rMun:['municipality','البلدية']},
 analytics:{anMun:['municipality','البلدية'],anSet:['status','حالة التسوية'],anGuarantee:['guaranteeStatus','حالة الضمان'],anRisk:['riskLevel','مستوى المخاطر']}
};
const CARD_RULES={
 master:{
  'تحت الإصدار':{field:'permitRefs',mode:'exact',value:'تحت الاصدار',label:'حالة التصريح'},
  'تصاريح أوشكت':{field:'end',mode:'permitTiming',value:'expiring',label:'صلاحية التصريح'}
 },
 projects:{
  'تحت الإصدار':{field:'permitRefs',mode:'exact',value:'تحت الاصدار',label:'حالة التصريح'},
  'مشاريع ملغاة':{field:'permitRefs',mode:'exact',value:'مشروع ملغي',label:'حالة المشروع'}
 },
 permits:{
  'سارية':{field:'end',mode:'permitTiming',value:'valid',label:'صلاحية التصريح'},
  'أوشكت':{field:'end',mode:'permitTiming',value:'expiring',label:'صلاحية التصريح'},
  'منتهية':{field:'end',mode:'permitTiming',value:'expired',label:'صلاحية التصريح'},
  'تاريخ غير قابل للقراءة':{field:'end',mode:'permitTiming',value:'unknown',label:'صلاحية التصريح'}
 },
 lines:{
  'معتمد PMO':{field:'designStatus',mode:'contains',value:'معتمد',label:'حالة التصميم'},
  'قيد التصميم/الاعتماد':{field:'designStatus',mode:'pendingDesign',value:'1',label:'حالة التصميم'}
 },
 settlements:{
  'عليه أمتار':{field:'status',mode:'exact',value:'عليه أمتار',label:'حالة التسوية'},
  'له أمتار':{field:'status',mode:'exact',value:'له أمتار',label:'حالة التسوية'},
  'مستوفي الأمتار':{field:'status',mode:'exact',value:'مستوفي الأمتار',label:'حالة التسوية'}
 },
 guarantees:{
  'ضمان منتهي':{field:'guaranteeStatus',mode:'contains',value:'منتهي',label:'حالة الضمان'},
  'أوشك على الانتهاء':{field:'guaranteeStatus',mode:'contains',value:'أوشك',label:'حالة الضمان'},
  'بانتظار إصدار':{field:'guaranteeStatus',mode:'contains',value:'بانتظار',label:'حالة الضمان'}
 },
 complaints:{
  'بحالة مسجلة':{field:'status',mode:'notblank',value:'',label:'حالة الشكوى'},
  'بدون حالة':{field:'status',mode:'blank',value:'',label:'حالة الشكوى'}
 },
 execution:{
  'حالة تنفيذ مسجلة':{field:'executionStatus',mode:'notblank',value:'',label:'حالة التنفيذ'},
  'منجز/مكتمل':{field:'executionStatus',mode:'completeExecution',value:'1',label:'حالة التنفيذ'},
  'بدون حالة تنفيذ':{field:'executionStatus',mode:'blank',value:'',label:'حالة التنفيذ'}
 },
 quality:{
  'مرتفعة':{field:'severity',mode:'exact',value:'high',label:'الأهمية'},
  'متوسطة':{field:'severity',mode:'exact',value:'medium',label:'الأهمية'},
  'منخفضة':{field:'severity',mode:'exact',value:'low',label:'الأهمية'}
 }
};

const state={data:null,user:null,page:'master',filters:new Map(),filterOptionsCache:new Map(),interactiveFilters:new Map(),periods:new Map(),charts:[],map:null,theme:0,export:{sheet:'vd projects',source:null,cache:new Map(),columns:new Set(),filters:new Map(),initializedSheet:null}};

const COLORS=['#0879a5','#19a5c8','#5bc6de','#83d9e8','#2f73b7','#79a8d8','#d0a351','#d36d56','#7d70b4','#69a99b'];
if(window.Chart){Chart.defaults.color='#000000';}
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
 if(/منتهي|عليه|عاجل|مرتفع|حرج|غير موجود|خطأ/i.test(t))c+=' danger';
 else if(/اوشك|أوشك|بانتظار|جاري|قيد|غير محدد|متوسط/i.test(t))c+=' warn';
 else if(/ساري|معتمد|مستوفي|منجز/i.test(t))c+=' ';
 else c+=' info';
 return '<span class="'+c+'">'+esc(t||'غير محدد')+'</span>';
}
function pageFilterDefs(){return FILTERS[state.page]||[]}
function filterKey(field){return state.page+'::'+field}
function interactiveStore(){
 if(!state.interactiveFilters.has(state.page))state.interactiveFilters.set(state.page,new Map());
 return state.interactiveFilters.get(state.page);
}
function filterSource(){
 const d=state.data||{};
 if(state.page==='master'||state.page==='analytics')return [...(d.projects||[]),...(d.actualPermits||[]),...(d.lines||[])];
 if(state.page==='map')return [...(d.projects||[]),...(d.lines||[])];
 if(state.page==='projects'||state.page==='guarantees'||state.page==='risks')return d.projects||[];
 if(state.page==='permits')return d.actualPermits||[];
 if(state.page==='lines'||state.page==='execution')return d.lines||[];
 if(state.page==='settlements')return d.settlements||[];
 if(state.page==='complaints')return d.complaints||[];
 if(state.page==='parties')return [...(d.projects||[]),...(d.lines||[])];
 if(['smartCenter','temporalMemory','investigationRoom','explainableDecision','smartThursday'].includes(state.page))return [...(d.projects||[]),...(d.actualPermits||[]),...(d.lines||[]),...(d.settlements||[])];
 if(state.page==='municipalities')return d.municipalitySummary||[];
 if(state.page==='traceability')return d.traceability||[];
 if(state.page==='quality')return d.quality||[];
 return [];
}
function primaryRows(){
 const d=state.data||{};
 if(state.page==='permits')return d.actualPermits||[];
 if(state.page==='lines'||state.page==='execution')return d.lines||[];
 if(state.page==='settlements')return d.settlements||[];
 if(state.page==='complaints')return d.complaints||[];
 if(state.page==='quality')return d.quality||[];
 if(state.page==='municipalities')return d.municipalitySummary||[];
 if(state.page==='traceability')return d.traceability||[];
 if(state.page==='parties'||state.page==='risks'||['smartCenter','temporalMemory','investigationRoom','explainableDecision','smartThursday'].includes(state.page))return d.projects||[];
 return d.projects||[];
}
function optionsFor(field){
 const key=filterKey(field);
 if(state.filterOptionsCache.has(key))return state.filterOptionsCache.get(key);
 const values=[...new Set(filterSource().map(r=>clean(r[field])).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ar'));
 state.filterOptionsCache.set(key,values);
 return values;
}
function selectedFor(field){
 const values=optionsFor(field),key=filterKey(field);
 if(!state.filters.has(key))state.filters.set(key,new Set(values));
 const set=state.filters.get(key);
 if(set.__optionsRef!==values){
  if(set.__initialized!==true)values.forEach(v=>set.add(v));
  set.__initialized=true;
  const valueSet=new Set(values);
  [...set].forEach(v=>{if(!valueSet.has(v))set.delete(v)});
  set.__optionsRef=values;
 }
 return {values,set};
}
function rulePass(row,rule){
 if(!rule)return true;
 if(rule.mode==='allOf')return (rule.rules||[]).every(r=>rulePass(row,r));
 if(rule.mode==='projectRef')return norm(row?.no)===norm(rule.value)||norm(row?.name)===norm(rule.value);
 if(rule.mode==='guaranteeWindow'){
  const status=clean(row?.guaranteeStatus),expiry=clean(row?.guaranteeExpiry),days=n(row?.guaranteeDays),band=clean(rule.value);
  if(band==='تعهد/بدون تاريخ')return /تعهد/i.test(status)||!expiry;
  if(!expiry)return false;
  if(band==='منتهي')return days<=0;
  if(band==='0–14 يوم')return days>0&&days<=14;
  if(band==='15–30 يوم')return days>14&&days<=30;
  if(band==='31–60 يوم')return days>30&&days<=60;
  if(band==='>60 يوم')return days>60;
  return true;
 }
 if(!rule.field||!Object.prototype.hasOwnProperty.call(row,rule.field))return true;
 const raw=row[rule.field],v=clean(raw);
 if(rule.mode==='blank')return !v;
 if(rule.mode==='notblank')return !!v;
 if(rule.mode==='contains')return norm(v).includes(norm(rule.value));
 if(rule.mode==='permitTiming'){
  const days=dateDaysLeft(raw);
  if(rule.value==='unknown')return days===null;
  if(days===null)return false;
  if(rule.value==='expired')return days<0;
  if(rule.value==='expiring')return days>=0&&days<=7;
  if(rule.value==='valid')return days>7;
 }
 if(rule.mode==='pendingDesign')return !v||/جاري|قيد|منتهي وجاري/i.test(v);
 if(rule.mode==='completeExecution')return /منجز|منتهي|مكتمل/i.test(v);
 return norm(v)===norm(rule.value);
}
function rowPasses(row,defs=pageFilterDefs()){
 const manual=defs.every(def=>{
  if(!Object.prototype.hasOwnProperty.call(row,def.field))return true;
  const {values,set}=selectedFor(def.field);
  if(!values.length||set.size===values.length)return true;
  return set.has(clean(row[def.field]));
 });
 if(!manual)return false;
 return [...interactiveStore().values()].every(rule=>rulePass(row,rule));
}
const PERIOD_META={
 master:{basis:'الأساس: تاريخ بداية المشروع / بداية التصريح / تاريخ التكليف',fields:['startDate','start','assignmentDate']},
 projects:{basis:'الأساس: تاريخ بداية المشروع',fields:['startDate']},
 map:{basis:'الأساس: تاريخ بداية المشروع / تاريخ تكليف الخط البديل',fields:['startDate','assignmentDate']},
 permits:{basis:'الأساس: تاريخ بداية التصريح',fields:['start']},
 lines:{basis:'الأساس: تاريخ التكليف',fields:['assignmentDate']},
 settlements:{basis:'لا يوجد محور زمني موحد لهذه الشاشة',disabled:true},
 guarantees:{basis:'الأساس: تاريخ انتهاء الضمان',fields:['guaranteeExpiry']},
 complaints:{basis:'لا يوجد تاريخ معتمد في سجل الشكاوى',disabled:true},
 execution:{basis:'الأساس: تاريخ التكليف',fields:['assignmentDate']},
 parties:{basis:'الأساس: تاريخ بداية المشروع / تاريخ التكليف',fields:['startDate','assignmentDate']},
 municipalities:{basis:'لا يوجد محور زمني في التجميع البلدي',disabled:true},
 traceability:{basis:'لا يوجد تاريخ موحد في سجل التتبع الحالي',disabled:true},
 quality:{basis:'لا يوجد تاريخ مستقل لسجل جودة البيانات',disabled:true},
 risks:{basis:'الأساس: تاريخ بداية المشروع',fields:['startDate']},
 analytics:{basis:'الأساس: تاريخ المصدر التشغيلي',fields:['startDate','start','assignmentDate']},
 smartCenter:{basis:'الأساس: تاريخ المصدر التشغيلي',fields:['startDate','start','assignmentDate']},
 temporalMemory:{basis:'الأساس: تاريخ المصدر التشغيلي للقراءة الحالية',fields:['startDate','start','assignmentDate']},
 investigationRoom:{basis:'الأساس: تاريخ المصدر التشغيلي',fields:['startDate','start','assignmentDate']},
 explainableDecision:{basis:'الأساس: تاريخ بداية المشروع',fields:['startDate']},
 smartThursday:{basis:'الأساس: تاريخ المصدر التشغيلي',fields:['startDate','start','assignmentDate']}
};
function periodState(){
 if(!state.periods.has(state.page))state.periods.set(state.page,{from:'',to:'',preset:'all'});
 return state.periods.get(state.page);
}
function parsePeriodDate(v){
 const s=clean(v);if(!s)return null;
 let m=s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/);
 if(m){const d=new Date(+m[1],+m[2]-1,+m[3]);return isNaN(d)?null:d}
 m=s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
 if(m){const a=+m[1],b=+m[2],y=+m[3],day=a>12?a:b>12?b:a,month=a>12?b:b>12?a:b;const d=new Date(y,month-1,day);return isNaN(d)?null:d}
 const d=new Date(s);return isNaN(d)?null:d;
}
function inputPeriodDate(v){
 const m=String(v||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);if(!m)return null;
 const d=new Date(+m[1],+m[2]-1,+m[3]);return isNaN(d)?null:d;
}
function rowPeriodDate(row){
 const meta=PERIOD_META[state.page];if(!meta||meta.disabled)return null;
 for(const field of meta.fields||[]){const d=parsePeriodDate(row?.[field]);if(d)return d}
 return null;
}
function rowPassesPeriod(row){
 const meta=PERIOD_META[state.page];if(!meta||meta.disabled)return true;
 const st=periodState(),from=inputPeriodDate(st.from),to=inputPeriodDate(st.to);
 if(!from&&!to)return true;
 const d=rowPeriodDate(row);if(!d)return false;d.setHours(12,0,0,0);
 if(from){from.setHours(0,0,0,0);if(d<from)return false}
 if(to){to.setHours(23,59,59,999);if(d>to)return false}
 return true;
}
function isoPeriod(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function fmtPeriod(v){const d=inputPeriodDate(v);return d?String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0')+'/'+d.getFullYear():''}
function setPeriodPreset(preset){
 const meta=PERIOD_META[state.page];if(!meta||meta.disabled)return;
 const st=periodState(),today=new Date();today.setHours(0,0,0,0);
 if(preset==='all'){st.from='';st.to=''}
 else if(preset==='week'){const start=new Date(today);start.setDate(start.getDate()-((start.getDay()-5+7)%7));const end=new Date(start);end.setDate(end.getDate()+6);st.from=isoPeriod(start);st.to=isoPeriod(end)}
 else if(preset==='month'){st.from=isoPeriod(new Date(today.getFullYear(),today.getMonth(),1));st.to=isoPeriod(today)}
 else if(preset==='30'){const d=new Date(today);d.setDate(d.getDate()-29);st.from=isoPeriod(d);st.to=isoPeriod(today)}
 else if(preset==='90'){const d=new Date(today);d.setDate(d.getDate()-89);st.from=isoPeriod(d);st.to=isoPeriod(today)}
 else if(preset==='year'){st.from=isoPeriod(new Date(today.getFullYear(),0,1));st.to=isoPeriod(today)}
 st.preset=preset;renderPage();
}
function periodLabel(){
 const st=periodState();if(!st.from&&!st.to)return 'كامل المدة';
 if(st.from&&st.to)return fmtPeriod(st.from)+' — '+fmtPeriod(st.to);
 if(st.from)return 'من '+fmtPeriod(st.from);return 'حتى '+fmtPeriod(st.to);
}
function renderPeriodControls(){
 const box=$('#periodControls'),meta=PERIOD_META[state.page],st=periodState();if(!box)return;
 const disabled=!meta||meta.disabled,from=$('#periodFrom'),to=$('#periodTo'),basis=$('#periodBasis');
 box.classList.toggle('is-disabled',disabled);
 if(basis)basis.textContent=meta?.basis||'لا يوجد محور زمني لهذه الشاشة';
 if(from){from.disabled=disabled;from.value=disabled?'':st.from}
 if(to){to.disabled=disabled;to.value=disabled?'':st.to}
 $$('.vd-period-presets [data-period]',box).forEach(btn=>{btn.disabled=disabled;btn.classList.toggle('active',!disabled&&btn.dataset.period===st.preset)});
 const main=$('#periodSummaryMain'),sub=$('#periodSummarySub');
 if(main)main.textContent=disabled?'كامل البيانات':periodLabel();
 if(sub)sub.textContent=disabled?(meta?.basis||'بدون فلتر زمني'):(meta?.basis||'الأساس الزمني').replace(/^الأساس:\s*/,'');
}
function filtered(rows,defs=pageFilterDefs()){return (rows||[]).filter(r=>rowPasses(r,defs)&&rowPassesPeriod(r))}
function activeFilterCount(){
 let x=interactiveStore().size;
 for(const def of pageFilterDefs()){const {values,set}=selectedFor(def.field);if(values.length&&set.size<values.length)x++}
 const meta=PERIOD_META[state.page],st=periodState();if(meta&&!meta.disabled&&(st.from||st.to))x++;
 return x;
}
function commonFiltered(rows){
 const defs=pageFilterDefs().filter(d=>rows.some(r=>Object.prototype.hasOwnProperty.call(r,d.field)));
 return filtered(rows,defs);
}
function sameRule(a,b){return JSON.stringify(a||{})===JSON.stringify(b||{})}
function toggleInteractiveFilter(key,rule){
 const store=interactiveStore(),cur=store.get(key);
 if(cur&&sameRule(cur,rule)){
  store.delete(key);
 }else{
  for(const [otherKey,otherRule] of store){
   if(otherKey!==key&&otherRule?.field===rule?.field)store.delete(otherKey);
  }
  store.set(key,rule);
 }
 renderPage();
}
function clearAllFilters(){
 pageFilterDefs().forEach(d=>state.filters.delete(filterKey(d.field)));
 interactiveStore().clear();
 const st=periodState();st.from='';st.to='';st.preset='all';
 renderPage();
 toast('تم مسح الفلاتر وإعادة الفترة إلى كامل المدة');
}
function renderFilterSummary(){
 const box=$('#activeFilters'),count=$('#resultCount');if(!box||!count)return;
 const chips=[];
 for(const def of pageFilterDefs()){
  const {values,set}=selectedFor(def.field);
  if(values.length&&set.size<values.length){const selected=[...set],detail=selected.length<=2?selected.join('، '):(selected.length+' من '+values.length);chips.push({key:'manual:'+def.field,label:def.label+': '+detail})}
 }
 for(const [key,rule] of interactiveStore())chips.push({key:'interactive:'+key,label:(rule.label||rule.field)+': '+(rule.displayValue||rule.value||'مفعل')});
 const meta=PERIOD_META[state.page],st=periodState();
 if(meta&&!meta.disabled&&(st.from||st.to))chips.push({key:'period',label:'الفترة: '+periodLabel()});
 box.innerHTML=chips.length?chips.map(c=>'<button type="button" class="vd-filter-chip" data-chip="'+esc(c.key)+'"><span>'+esc(c.label)+'</span><b>×</b></button>').join(''):'<span class="vd-no-active-filters">لا توجد فلاتر نشطة</span>';
 $$('.vd-filter-chip',box).forEach(btn=>btn.addEventListener('click',()=>{const key=btn.dataset.chip||'';if(key.startsWith('manual:'))state.filters.delete(filterKey(key.slice(7)));else if(key.startsWith('interactive:'))interactiveStore().delete(key.slice(12));else if(key==='period'){const ps=periodState();ps.from='';ps.to='';ps.preset='all'}renderPage()}));
 const rows=primaryRows(),defs=pageFilterDefs().filter(d=>rows.some(r=>Object.prototype.hasOwnProperty.call(r,d.field))),matched=filtered(rows,defs);
 count.innerHTML='<b>'+matched.length+' سجل</b><small>من '+rows.length+' إجمالي</small>';
 renderPeriodControls();
}

function renderFilters(){
 const bar=$('#filterBar'),host=$('#filtersHost'),defs=pageFilterDefs();if(!bar||!host)return;
 if(['reports','master','quality','smartCenter','temporalMemory','investigationRoom','explainableDecision','smartThursday'].includes(state.page)){bar.style.display='none';host.innerHTML='';return;}
 bar.style.display='block';bar.classList.toggle('no-manual-filters',!defs.length);
 host.innerHTML=defs.map(def=>{
  const {values,set}=selectedFor(def.field),label=!values.length?'لا توجد قيم':set.size===values.length?'الكل':set.size+'/'+values.length;
  return '<div class="multi-filter" data-field="'+esc(def.field)+'"><button class="mf-trigger" type="button"><b>'+esc(def.label)+'</b><span>'+esc(label)+' ▾</span></button><div class="mf-pop"><input class="mf-search" type="search" placeholder="بحث داخل '+esc(def.label)+'..."><div class="mf-actions"><button data-act="all" type="button">تحديد الكل</button><button data-act="none" type="button">إلغاء الكل</button></div><div class="mf-options">'+values.map(v=>'<label class="mf-option" data-text="'+esc(norm(v))+'"><input type="checkbox" value="'+esc(v)+'" '+(set.has(v)?'checked':'')+'><span>'+esc(v)+'</span></label>').join('')+'</div></div></div>';
 }).join('');
 $$('.mf-trigger',host).forEach(btn=>btn.addEventListener('click',e=>{e.stopPropagation();const box=btn.closest('.multi-filter');$$('.multi-filter',host).forEach(x=>{if(x!==box)x.classList.remove('open')});box.classList.toggle('open')}));
 $$('.mf-search',host).forEach(inp=>inp.addEventListener('input',()=>{const q=norm(inp.value);$$('.mf-option',inp.closest('.mf-pop')).forEach(x=>x.style.display=!q||x.dataset.text.includes(q)?'flex':'none')}));
 $$('.mf-actions button',host).forEach(btn=>btn.addEventListener('click',()=>{const box=btn.closest('.multi-filter'),field=box.dataset.field,{values,set}=selectedFor(field);set.clear();if(btn.dataset.act==='all')values.forEach(v=>set.add(v));renderPage()}));
 $$('.mf-option input',host).forEach(inp=>inp.addEventListener('change',()=>{const field=inp.closest('.multi-filter').dataset.field,{set}=selectedFor(field);inp.checked?set.add(inp.value):set.delete(inp.value);renderPage()}));
 // Summary and period controls are rendered once after the page body is ready.
}
document.addEventListener('click',e=>{if(!e.target.closest('.multi-filter'))$$('.multi-filter').forEach(x=>x.classList.remove('open'))});

function kpi(label,value,note='',cls=''){
 return '<article class="kpi-card '+cls+'"><span>'+esc(label)+'</span><strong data-count>'+esc(value)+'</strong><small>'+esc(note)+'</small></article>';
}
function animateCounts(){
 if(window.VDCountUp){window.VDCountUp.refresh();return;}
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
  const ctx=chart.ctx;ctx.save();ctx.font='600 10px Cairo';ctx.fillStyle='#000000';ctx.textAlign='center';ctx.textBaseline='bottom';
  chart.data.datasets.forEach((ds,di)=>{
   const meta=chart.getDatasetMeta(di);if(meta.data.length>18)return;
   meta.data.forEach((el,i)=>{const v=ds.data[i];if(v==null||v===0)return;const pos=el.tooltipPosition();ctx.fillText(fmt(v),pos.x,pos.y-5)});
  });ctx.restore();
 }
};
function chartRule(id,label,index,opts={}){
 const custom=opts.filterRules?.[index];if(custom)return{...custom,displayValue:custom.displayValue||clean(label)};
 const cfg=CHART_FILTERS[state.page]?.[id];if(!cfg)return null;
 const [field,title,mode='exact']=cfg,value=clean(label);
 if(value==='غير محدد'&&mode==='exact')return{field,mode:'blank',value:'',label:title,displayValue:value};
 return{field,mode,value,label:title,displayValue:value};
}
function handleChartClick(id,label,index,opts={}){
 const rule=chartRule(id,label,index,opts);if(!rule)return;
 toggleInteractiveFilter('chart:'+id,rule);
}
function makeChart(id,type,labels,values,opts={}){
 if(!window.Chart)return;
 const canvas=document.getElementById(id);if(!canvas)return;
 const colors=labels.map((_,i)=>COLORS[i%COLORS.length]);
 const chart=new Chart(canvas,{
  type,data:{labels,datasets:[{label:opts.label||'',data:values,backgroundColor:type==='line'?'rgba(8,121,165,.14)':colors,borderColor:type==='line'?'#0879a5':colors,borderWidth:type==='line'?2:1,tension:.32,fill:type==='line'}]},
  options:{responsive:true,maintainAspectRatio:false,indexAxis:opts.horizontal?'y':'x',
   onHover:(event,elements)=>{if(event?.native?.target)event.native.target.style.cursor=(elements.length&&(CHART_FILTERS[state.page]?.[id]||opts.filterRules?.length))?'pointer':'default'},
   onClick:(event,elements)=>{if(!elements.length)return;const idx=elements[0].index;if(!CHART_FILTERS[state.page]?.[id]&&!opts.filterRules?.[idx])return;handleChartClick(id,labels[idx],idx,opts)},
   plugins:{legend:{display:type==='doughnut',position:'bottom',labels:{font:{family:'Cairo',size:10},boxWidth:10}},tooltip:{rtl:true,titleFont:{family:'Cairo'},bodyFont:{family:'Cairo'}}},
   scales:type==='doughnut'?{}:{x:{ticks:{font:{family:'Cairo',size:9},color:'#000000'},grid:{display:false}},y:{beginAtZero:true,ticks:{font:{family:'Cairo',size:9},color:'#000000'},grid:{color:'rgba(0,0,0,.04)'}}}},
  plugins:[]
 });
 state.charts.push(chart);
 const panel=canvas.closest('.panel'),active=interactiveStore().get('chart:'+id);
 if(panel)panel.classList.toggle('vd-filtered',!!active);
}

function makeMultiBar(id,labels,datasets,opts={}){
 if(!window.Chart)return;
 const canvas=document.getElementById(id);if(!canvas)return;
 const chart=new Chart(canvas,{
  type:'bar',
  data:{labels,datasets:datasets.map((ds,i)=>({label:ds.label,data:ds.data,backgroundColor:COLORS[(i*2)%COLORS.length],borderColor:COLORS[(i*2)%COLORS.length],borderWidth:1}))},
  options:{responsive:true,maintainAspectRatio:false,indexAxis:opts.horizontal?'y':'x',
   onHover:(event,elements)=>{if(event?.native?.target)event.native.target.style.cursor=(elements.length&&(CHART_FILTERS[state.page]?.[id]||opts.filterRules?.length))?'pointer':'default'},
   onClick:(event,elements)=>{if(!elements.length)return;const idx=elements[0].index;if(!CHART_FILTERS[state.page]?.[id]&&!opts.filterRules?.[idx])return;handleChartClick(id,labels[idx],idx,opts)},
   plugins:{legend:{display:true,position:'bottom',labels:{font:{family:'Cairo',size:10},boxWidth:10}},tooltip:{rtl:true,titleFont:{family:'Cairo'},bodyFont:{family:'Cairo'}}},
   scales:{x:{ticks:{font:{family:'Cairo',size:9},color:'#000000'},grid:{display:false}},y:{beginAtZero:true,ticks:{font:{family:'Cairo',size:9},color:'#000000'},grid:{color:'rgba(0,0,0,.04)'}}}},
  plugins:[]
 });
 state.charts.push(chart);
 const panel=canvas.closest('.panel'),active=interactiveStore().get('chart:'+id);
 if(panel)panel.classList.toggle('vd-filtered',!!active);
}
function avg(rows,field){
 const vals=(rows||[]).map(r=>n(r[field])).filter(v=>Number.isFinite(v));
 return vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:0;
}
function pct(a,b){return b?Math.round((a/b)*1000)/10:0}

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
function wireInteractiveCards(){
 const rules=CARD_RULES[state.page]||{};
 $$('.kpi-card','#pageHost').forEach(card=>{
  const label=clean(card.querySelector(':scope > span')?.textContent);
  const rule=rules[label];
  if(!rule)return;
  card.classList.add('vd-clickable');
  const active=interactiveStore().has('card:'+label);
  card.classList.toggle('vd-filtered',active);
  card.title='اضغط لتطبيق/إلغاء هذا الفلتر';
  card.addEventListener('click',e=>{
   if(e.target.closest('.vd-info-btn'))return;
   toggleInteractiveFilter('card:'+label,{...rule,displayValue:label});
  });
 });
}
function elementInfoTitle(el){
 return clean(el.querySelector(':scope > span')?.textContent||
  el.querySelector('.panel-head b')?.textContent||
  el.querySelector('.table-tools b')?.childNodes?.[0]?.textContent||
  el.querySelector('.map-legend span')?.textContent||
  el.querySelector(':scope > b')?.textContent||
  'عنصر تحليلي');
}
function elementCalcText(el){
 if(el.classList.contains('kpi-card'))return 'تُعاد قيمة الكارت من الصفوف المطابقة لكل الفلاتر اليدوية والتفاعلية النشطة في هذه الشاشة.';
 if(el.querySelector('canvas'))return 'يتم تجميع الصفوف المطابقة للفلاتر حسب البعد الظاهر في الشارت. الضغط على أي فئة يضيف فلترًا تفاعليًا ويعيد احتساب بقية العناصر.';
 if(el.classList.contains('table-panel'))return 'يعرض الجدول الصفوف المطابقة للفلاتر الحالية، ويعمل مربع البحث داخل النتائج الظاهرة دون تغيير مصدر البيانات.';
 if(el.classList.contains('map-panel'))return 'تعرض الخريطة المشاريع التي تحتوي على إحداثيات صحيحة بعد تطبيق الفلاتر الحالية.';
 if(el.classList.contains('insight-card'))return 'مؤشر تحليلي مشتق من البيانات المفلترة الحالية ولا يُستخدم كبديل عن القيم الأصلية في الشيت.';
 return 'عنصر تحليلي يتحدث تلقائيًا مع الفلاتر النشطة.';
}
function openInfo(el){
 const modal=$('#vdInfoModal'),title=$('#vdInfoTitle'),body=$('#vdInfoBody');if(!modal||!title||!body)return;
 const canvas=el.querySelector('canvas'),cfg=canvas?CHART_FILTERS[state.page]?.[canvas.id]:null;
 title.textContent=elementInfoTitle(el);
 body.innerHTML='<div class="vd-info-row"><b>كيفية الاحتساب</b><span>'+esc(elementCalcText(el))+'</span></div>'+
  '<div class="vd-info-row"><b>مصدر البيانات</b><span>'+esc(PAGE_SOURCES[state.page]||'Google Sheets')+'</span></div>'+
  (cfg?'<div class="vd-info-row"><b>الحقل التفاعلي</b><span>'+esc(cfg[1]+' — '+cfg[0])+'</span></div>':'')+
  '<div class="vd-info-row"><b>التفاعل</b><span>الفلاتر اليدوية والنقر على الكروت والشارتات تعمل معًا على نفس النطاق. يمكن إزالة أي فلتر من الشريط النشط أعلى الصفحة.</span></div>';
 modal.classList.add('show');modal.setAttribute('aria-hidden','false');
}
function decorateInfo(){
 $$('.kpi-card,.panel,.table-panel,.map-panel,.insight-card','#pageHost').forEach(el=>{
  if(el.dataset.vdInfo==='1')return;el.dataset.vdInfo='1';el.classList.add('vd-info-host');
  const b=document.createElement('button');b.type='button';b.className='vd-info-btn';b.textContent='i';b.title='كيفية ومصدر الاحتساب';
  b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();openInfo(el)});
  el.appendChild(b);
 });
}
function closeInfo(){
 const modal=$('#vdInfoModal');if(!modal)return;modal.classList.remove('show');modal.setAttribute('aria-hidden','true');
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
 const validCoord=r=>Number.isFinite(Number(r?.lat))&&Number.isFinite(Number(r?.lon))&&Number(r.lat)>20&&Number(r.lat)<23&&Number(r.lon)>38&&Number(r.lon)<41;
 const projectAll=filtered(state.data.projects||[]);
 const lineDefs=pageFilterDefs().filter(d=>(state.data.lines||[]).some(r=>Object.prototype.hasOwnProperty.call(r,d.field)));
 const lineAll=(state.data.lines||[]).filter(r=>rowPasses(r,lineDefs)&&rowPassesPeriod(r));
 const projects=projectAll.filter(validCoord),lines=lineAll.filter(validCoord);
 const missingProjects=projectAll.length-projects.length,missingLines=lineAll.length-lines.length;
 const coverageTotal=projectAll.length+lineAll.length,coverageMapped=projects.length+lines.length;
 const pctMapped=coverageTotal?Math.round(coverageMapped/coverageTotal*100):0;
 const combinedRows=[
  ...projects.map(r=>({itemType:'مشروع',ref:r.no,name:r.name,municipality:r.municipality,district:r.district,street:r.street,owner:r.owner,contractor:r.contractor,status:r.contractStatus||r.permitStatus||'',lat:r.lat,lon:r.lon})),
  ...lines.map(r=>({itemType:'خط بديل',ref:r.ref,name:r.name,municipality:r.municipality,district:r.district,street:r.street,owner:r.owner,contractor:r.contractor,status:r.executionStatus||r.designStatus||'',lat:r.lat,lon:r.lon}))
 ];
 const opt=(rows,key,label)=>{
  const vals=[...new Set(rows.map(r=>clean(r[key])).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ar'));
  return '<label class="map-glass-filter"><span>'+label+'</span><select data-map-filter="'+key+'"><option value="">الكل</option>'+vals.map(v=>'<option value="'+esc(v)+'">'+esc(v)+'</option>').join('')+'</select></label>';
 };
 const filterUniverse=[...projects,...lines];
 $('#pageHost').innerHTML='<div class="kpi-grid map-kpis">'+
  kpi('مواقع المشاريع',projects.length,missingProjects?'مفقود '+missingProjects+' موقع':'جميع المواقع المتاحة')+
  kpi('الخطوط البديلة',lines.length,missingLines?'مفقود '+missingLines+' إحداثية':'إحداثيات الخطوط المتاحة')+
  kpi('تغطية الإحداثيات',pctMapped+'%','من '+coverageTotal+' عنصرًا جغرافيًا')+
  kpi('إجمالي أطوال الخطوط',fmt(sum(lines,'length')),'متر')+
 '</div>'+
 '<section class="map-panel map-panel-advanced" id="advancedMapPanel">'+
  '<div class="map-stage">'+
   '<div id="projectMap" class="map-canvas"></div>'+
   '<div class="map-glass-panel">'+
    '<div class="map-glass-top">'+
     '<div class="map-layer-buttons">'+
      '<button type="button" class="map-layer-btn active" data-map-layer="projects"><span class="map-symbol project-symbol"></span>المشاريع <b id="mapProjectCount">'+projects.length+'</b></button>'+
      '<button type="button" class="map-layer-btn active" data-map-layer="lines"><span class="map-symbol line-symbol"></span>الخطوط البديلة <b id="mapLineCount">'+lines.length+'</b></button>'+
      '<button type="button" class="map-tool-btn" id="mapFitBtn">⌖ ملاءمة</button>'+
      '<button type="button" class="map-tool-btn" id="mapResetBtn">↺ إعادة الفلاتر</button>'+
      '<button type="button" class="map-tool-btn" id="mapFullscreenBtn">⛶ توسعة</button>'+
      '<button type="button" class="map-tool-btn map-kmz-upload-btn" id="mapKmzUploadBtn">⬆ رفع KMZ</button>'+
      '<input id="mapKmzFileInput" class="map-file-input" type="file" accept=".kmz,.kml,application/vnd.google-earth.kmz,application/vnd.google-earth.kml+xml" multiple>'+
     '</div>'+
     '<div class="map-search-wrap"><input id="mapSearchInput" type="search" autocomplete="off" placeholder="بحث داخل الخريطة: مشروع، خط، مقاول، مالك، حي..."><div id="mapSearchResults" class="map-search-results"></div></div>'+
    '</div>'+
    '<div class="map-glass-filters">'+
     opt(filterUniverse,'municipality','البلدية')+
     opt(filterUniverse,'contractor','المقاول')+
     opt(filterUniverse,'owner','المالك')+
     opt(lines,'type','نوع الخط')+
     opt(lines,'designStatus','حالة التصميم')+
    '</div>'+
    '<div id="mapKmzLayers" class="map-kmz-layers" aria-live="polite"></div>'+
   '</div>'+
   '<div class="map-floating-legend"><span><i class="map-dot project-only"></i> مشروع</span><span><i class="map-dot line-only"></i> خط بديل</span><span class="map-kmz-legend"><i></i> KMZ</span><em id="mapVisibleSummary">'+projects.length+' مشروع • '+lines.length+' خط</em></div>'+
  '</div>'+
 '</section>'+
 tablePanel('العناصر الجغرافية',[
  {key:'itemType',label:'النوع',html:r=>'<span class="pill '+(r.itemType==='خط بديل'?'info':'')+'">'+esc(r.itemType)+'</span>'},
  {key:'ref',label:'المرجع'},{key:'name',label:'الاسم'},{key:'municipality',label:'البلدية'},
  {key:'district',label:'الحي'},{key:'street',label:'الشارع'},{key:'owner',label:'المالك'},
  {key:'contractor',label:'المقاول'},{key:'status',label:'الحالة',html:r=>pill(r.status)},
  {key:'lat',label:'Lat'},{key:'lon',label:'Lon'}
 ],combinedRows);
 if(!window.L){
  const el=document.getElementById('projectMap');if(el)el.innerHTML='<div class="empty"><b>تعذر تحميل مكتبة الخريطة</b><span>تحقق من الاتصال بالإنترنت ثم أعد تحميل الصفحة.</span></div>';
  return;
 }
 const safeUrl=v=>{const s=clean(v);return /^https?:\/\//i.test(s)?s:''};
 const action=(label,url)=>{const u=safeUrl(url);return u?'<a class="map-popup-action" href="'+esc(u)+'" target="_blank" rel="noopener">'+esc(label)+'</a>':''};
 const cell=(label,value)=>clean(value)?'<div><span>'+esc(label)+'</span><b>'+esc(value)+'</b></div>':'';
 const projectTooltip=r=>'<div class="map-hover-card"><div class="map-card-head"><span class="map-kind project">مشروع</span><b>'+esc((r.no||'')+(r.name?' — '+r.name:''))+'</b></div><div class="map-card-grid">'+
  cell('البلدية',r.municipality)+cell('الحي',r.district)+cell('الشارع',r.street)+cell('المقاول',r.contractor)+cell('المالك',r.owner)+cell('حالة العقد',r.contractStatus)+cell('التصريح',r.permitStatus)+cell('أمتار التصاريح',r.permitMeters?fmt(r.permitMeters)+' م':'')+
  '</div><div class="map-card-hint">اضغط لعرض جميع بيانات المشروع والروابط</div></div>';
 const projectPopup=r=>'<div class="map-popup-card"><div class="map-card-head"><span class="map-kind project">مشروع</span><b>'+esc((r.no||'')+(r.name?' — '+r.name:''))+'</b></div><div class="map-card-grid">'+
  cell('رقم العقد',r.contractNo)+cell('حالة العقد',r.contractStatus)+cell('الشركة',r.company)+cell('الإدارة',r.department)+cell('نوع المشروع',r.projectType)+cell('الفرع',r.branch)+
  cell('البلدية',r.municipality)+cell('الحي',r.district)+cell('الشارع',r.street)+cell('المالك',r.owner)+cell('المقاول',r.contractor)+cell('المختبر',r.lab)+
  cell('بداية المشروع',r.startDate)+cell('نهاية المشروع',r.endDate)+cell('رقم المعاملة',r.transactionNo)+cell('رقم/حالة التصريح',r.permitRefs)+cell('عدد التصاريح',r.permitCount)+cell('حالة التصريح',r.permitStatus)+
  cell('انتهاء التصريح',r.permitExpiry)+cell('أمتار التصاريح',r.permitMeters?fmt(r.permitMeters)+' م':'')+cell('مرجع الضمان',r.guaranteeRef)+cell('انتهاء الضمان',r.guaranteeExpiry)+cell('حالة الضمان',r.guaranteeStatus)+
  cell('محضر التسليم',r.handoverNo)+cell('تاريخ التسليم',r.handoverDate)+cell('المخالصة',r.clearance)+
  '</div><div class="map-popup-actions">'+action('فتح الموقع',r.locationLink)+action('فتح الضمان',r.guaranteeLink)+action('محضر التسليم',r.handoverLink)+action('تقرير المضخة',r.pumpReportLink)+'</div></div>';
 const lineTooltip=r=>'<div class="map-hover-card"><div class="map-card-head"><span class="map-kind line">خط بديل</span><b>'+esc((r.ref||'')+(r.name?' — '+r.name:''))+'</b></div><div class="map-card-grid">'+
  cell('البلدية',r.municipality)+cell('الحي',r.district)+cell('الشارع',r.street)+cell('نوع الخط',r.type)+cell('الطول',r.length?fmt(r.length)+' م':'')+cell('القطر',r.diameter)+cell('المقاول',r.contractor)+cell('المالك',r.owner)+cell('التصميم',r.designStatus)+cell('التنفيذ',r.executionStatus)+
  '</div><div class="map-card-hint">الخط يُعرض كمسار عند توفر أكثر من إحداثية لنفس المرجع، وإلا كرمز خط عند إحداثيته المرجعية</div></div>';
 const linePopup=r=>'<div class="map-popup-card"><div class="map-card-head"><span class="map-kind line">خط بديل</span><b>'+esc((r.ref||'')+(r.name?' — '+r.name:''))+'</b></div><div class="map-card-grid">'+
  cell('البلدية',r.municipality)+cell('الحي',r.district)+cell('الشارع',r.street)+cell('المالك',r.owner)+cell('المقاول',r.contractor)+cell('نوع الخط',r.type)+cell('الطول',r.length?fmt(r.length)+' م':'')+
  cell('طول التصميم',r.designLength?fmt(r.designLength)+' م':'')+cell('القطر',r.diameter)+cell('المصمم',r.designer)+cell('حالة التصميم',r.designStatus)+cell('رقم التكليف',r.assignmentNo)+cell('تاريخ التكليف',r.assignmentDate)+
  cell('رقم المعاملة',r.transactionNo)+cell('تاريخ الرفع',r.submissionDate)+cell('تاريخ الاعتماد',r.approvalDate)+cell('REV',r.rev)+cell('حالة التنفيذ',r.executionStatus)+cell('نسبة الإنجاز',r.completion)+
  cell('تاريخ التسليم',r.handoverDate)+cell('سنة التنفيذ',r.year)+cell('مستحق المالك',r.ownerDue)+cell('المتبقي',r.remaining)+cell('ملاحظات',r.notes)+
  '</div><div class="map-popup-actions">'+action('فتح الموقع',r.locationLink)+action('التكليف',r.assignmentLink)+action('مخطط التصميم',r.designLink)+action('اعتماد التصميم',r.approvalLink)+action('تقرير الإتمام',r.completionReport)+action('خطاب التسليم',r.handoverLetter)+'</div></div>';

 state.map=L.map('projectMap',{zoomControl:true,attributionControl:true,preferCanvas:true}).setView([21.55,39.18],11);
 const street=L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap'});
 const satellite=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,attribution:'Tiles &copy; Esri'});
 street.addTo(state.map);
 const projectLayer=L.layerGroup().addTo(state.map),lineLayer=L.layerGroup().addTo(state.map);
 L.control.layers({'خريطة الشوارع':street,'صور جوية':satellite},{},{position:'bottomright',collapsed:true}).addTo(state.map);
 const filterState={municipality:'',contractor:'',owner:'',type:'',designStatus:''};
 let bounds=[],searchItems=[],kmzManager=null,visibleProjectCount=projects.length,visibleLineCount=lines.length;
 const matchesMapFilters=(r,kind)=>{
  if(filterState.municipality&&clean(r.municipality)!==filterState.municipality)return false;
  if(filterState.contractor&&clean(r.contractor)!==filterState.contractor)return false;
  if(filterState.owner&&clean(r.owner)!==filterState.owner)return false;
  if(kind==='line'&&filterState.type&&clean(r.type)!==filterState.type)return false;
  if(kind==='line'&&filterState.designStatus&&clean(r.designStatus)!==filterState.designStatus)return false;
  return true;
 };
 const lineGroupKey=r=>{
  const raw=clean(r.name),base=raw.replace(/[\s\-–—]*(?:خط|جزء)?\s*(?:\d+|[٠-٩]+)\s*$/i,'').trim();
  return 'name:'+norm(base||raw||r.ref||r.row);
 };
 const renderFeatures=()=>{
  projectLayer.clearLayers();lineLayer.clearLayers();bounds=[];searchItems=[];
  const fp=projects.filter(r=>matchesMapFilters(r,'project'));
  const fl=lines.filter(r=>matchesMapFilters(r,'line'));
  fp.forEach(r=>{
   const lat=Number(r.lat),lon=Number(r.lon);
   const marker=L.circleMarker([lat,lon],{radius:7,color:'#fff',weight:2,fillColor:'#168a72',fillOpacity:.94});
   marker.bindTooltip(projectTooltip(r),{direction:'top',sticky:true,opacity:.98,className:'vd-map-tooltip',offset:[0,-8]});
   marker.bindPopup(projectPopup(r),{maxWidth:460,className:'vd-map-popup'});
   projectLayer.addLayer(marker);bounds.push([lat,lon]);
   searchItems.push({kind:'مشروع',label:(r.no||'')+(r.name?' — '+r.name:''),search:norm([r.no,r.name,r.municipality,r.district,r.street,r.owner,r.contractor,r.permitRefs,r.permitStatus].join(' ')),marker,lat,lon,layer:'projects'});
  });
  fl.forEach(r=>{
   const lat=Number(r.lat),lon=Number(r.lon);
   const marker=L.circleMarker([lat,lon],{radius:6,color:'#fff',weight:2,fillColor:'#1677b8',fillOpacity:.96});
   marker.bindTooltip(lineTooltip(r),{direction:'top',sticky:true,opacity:.98,className:'vd-map-tooltip',offset:[0,-8]});
   marker.bindPopup(linePopup(r),{maxWidth:470,className:'vd-map-popup'});
   lineLayer.addLayer(marker);bounds.push([lat,lon]);
   searchItems.push({kind:'خط بديل',label:(r.ref||'')+(r.name?' — '+r.name:''),search:norm([r.ref,r.name,r.municipality,r.district,r.street,r.owner,r.contractor,r.designer,r.type,r.designStatus,r.executionStatus].join(' ')),marker,lat,lon,layer:'lines'});
  });
  visibleProjectCount=fp.length;visibleLineCount=fl.length;
  const pc=$('#mapProjectCount'),lc=$('#mapLineCount'),summary=$('#mapVisibleSummary'),kmzVisible=(window.VDKMZ?.uploads||[]).filter(x=>x.visible).length;
  if(pc)pc.textContent=fp.length;if(lc)lc.textContent=fl.length;if(summary)summary.textContent=fp.length+' مشروع • '+fl.length+' خط'+(kmzVisible?' • '+kmzVisible+' KMZ':'');
 };
 renderFeatures();
 const fitVisible=()=>{
  const b=L.latLngBounds(bounds);kmzManager?.extendBounds?.(b);
  if(b.isValid())state.map.fitBounds(b,{padding:[42,42],maxZoom:14});
 };
 const fitBtn=$('#mapFitBtn'),resetBtn=$('#mapResetBtn'),fullBtn=$('#mapFullscreenBtn'),panel=$('#advancedMapPanel'),searchInput=$('#mapSearchInput'),searchResults=$('#mapSearchResults');
 kmzManager=window.VDKMZ?.init({
  map:state.map,input:$('#mapKmzFileInput'),button:$('#mapKmzUploadBtn'),host:$('#mapKmzLayers'),
  stage:panel?.querySelector('.map-stage'),toast,
  onSummary:visible=>{const summary=$('#mapVisibleSummary');if(summary)summary.textContent=visibleProjectCount+' مشروع • '+visibleLineCount+' خط'+(visible?' • '+visible+' KMZ':'')}
 })||null;
 fitVisible();
 if(fitBtn)fitBtn.addEventListener('click',fitVisible);
 if(resetBtn)resetBtn.addEventListener('click',()=>{
  Object.keys(filterState).forEach(k=>filterState[k]='');
  $$('[data-map-filter]','#pageHost').forEach(s=>s.value='');
  renderFeatures();fitVisible();toast('تمت إعادة فلاتر الخريطة');
 });
 if(fullBtn&&panel)fullBtn.addEventListener('click',()=>{
  panel.classList.toggle('map-fullscreen');document.body.classList.toggle('map-fullscreen-open',panel.classList.contains('map-fullscreen'));
  fullBtn.textContent=panel.classList.contains('map-fullscreen')?'✕ إغلاق التوسعة':'⛶ توسعة';
  setTimeout(()=>{state.map&&state.map.invalidateSize();fitVisible()},180);
 });
 $$('[data-map-layer]','#pageHost').forEach(btn=>btn.addEventListener('click',()=>{
  const layer=btn.dataset.mapLayer==='projects'?projectLayer:lineLayer;
  if(state.map.hasLayer(layer)){state.map.removeLayer(layer);btn.classList.remove('active')}else{layer.addTo(state.map);btn.classList.add('active')}
 }));
 $$('[data-map-filter]','#pageHost').forEach(sel=>sel.addEventListener('change',()=>{
  filterState[sel.dataset.mapFilter]=sel.value;
  renderFeatures();fitVisible();
 }));
 const closeSearch=()=>{if(searchResults){searchResults.innerHTML='';searchResults.classList.remove('show')}};
 if(searchInput&&searchResults){
  searchInput.addEventListener('input',()=>{
   const q=norm(searchInput.value);if(q.length<2){closeSearch();return}
   const matches=searchItems.map((x,i)=>({...x,i})).filter(x=>x.search.includes(q)).slice(0,10);
   searchResults.innerHTML=matches.length?matches.map(x=>'<button type="button" data-map-result="'+x.i+'"><span>'+esc(x.kind)+'</span><b>'+esc(x.label||'بدون اسم')+'</b></button>').join(''):'<div class="map-search-empty">لا توجد نتائج ضمن الفلاتر الحالية</div>';
   searchResults.classList.add('show');
  });
  searchResults.addEventListener('click',e=>{
   const b=e.target.closest('[data-map-result]');if(!b)return;const x=searchItems[Number(b.dataset.mapResult)];if(!x)return;
   const targetLayer=x.layer==='projects'?projectLayer:lineLayer;if(!state.map.hasLayer(targetLayer))targetLayer.addTo(state.map);
   state.map.setView([x.lat,x.lon],17,{animate:true});x.marker.openPopup();searchInput.value=x.label;closeSearch();
  });
 }
 setTimeout(()=>state.map&&state.map.invalidateSize(),160);
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
 if(typeof window.renderUrgentDataQuality==='function')return window.renderUrgentDataQuality();
 const rows=filtered(state.data.quality);
 $('#pageHost').innerHTML=tablePanel('نتائج جودة البيانات',[
  {key:'category',label:'التصنيف'},{key:'source',label:'المصدر'},{key:'row',label:'الصف'},{key:'message',label:'الملاحظة'}
 ],rows);
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

function renderMasterV2(){
 const d=state.data,projects=commonFiltered(d.projects),permits=commonFiltered(d.actualPermits),lines=commonFiltered(d.lines),sett=commonFiltered(d.settlements||[]);
 const permitMeters=sum(permits,'meters'),lineMeters=sum(lines,'length'),gross=pct(lineMeters,permitMeters);
 const matchedDue=sum(sett,'dueMeters'),matchedDone=sum(sett,'executedMeters'),matched=pct(matchedDone,matchedDue),matchedGap=Math.round((matchedDue-matchedDone)*10)/10;
 const risks=countBy(projects,'riskLevel'),high=(risks['حرج']||0)+(risks['مرتفع']||0);
 const mapped=projects.filter(r=>Number(r.lat)>20&&Number(r.lat)<23&&Number(r.lon)>38&&Number(r.lon)<41).length;
 const designApproved=lines.filter(x=>/معتمد|حزمة مصممة/i.test(x.designStatus)).length;
 const designPending=lines.filter(x=>/جاري|قيد/i.test(x.designStatus)&&!x.approvalDate).length;
 const designConflict=lines.filter(x=>/جاري|قيد/i.test(x.designStatus)&&!!x.approvalDate).length;
 const designMissing=lines.filter(x=>!x.designStatus).length;
 const alerts=buildOperationalAlerts(projects,permits,lines);
 $('#pageHost').innerHTML='<div class="kpi-grid">'+
  kpi('المشاريع',projects.length,'مشروع ضمن نطاق الفلاتر')+
  kpi('المخاطر المرتفعة/الحرجة',high,'مشاريع تحتاج تدخلًا إداريًا',high?'danger':'')+
  kpi('التصاريح الفعلية',permits.length,'تصاريح مؤرخة فعليًا')+
  kpi('أمتار التصاريح',fmt(permitMeters),'متر مستحق')+
  kpi('الخطوط البديلة',lines.length,'خط تشغيلي')+
  kpi('أطوال الخطوط',fmt(lineMeters),'متر خطوط بديلة')+
  kpi('التغطية الإجمالية',gross,'% = إجمالي الخطوط ÷ إجمالي أمتار التصاريح','info')+
  kpi('التغطية المطابقة',matched,'% وفق تطابق المالك + المقاول',matched<80?'warn':'info')+
  kpi('فجوة التسوية المطابقة',fmt(matchedGap),'متر غير مغطى بالمطابقة',matchedGap>0?'danger':'')+
  kpi('تغطية الخريطة',pct(mapped,projects.length),'% مشاريع بإحداثيات صحيحة','info')+
  kpi('تصاميم معتمدة',designApproved,'حزم/تصاميم معتمدة')+
  kpi('تصاميم تحتاج مراجعة',designPending+designConflict+designMissing,'قيد اعتماد أو تعارض أو حالة مفقودة',(designPending+designConflict+designMissing)?'warn':'')+
 '</div><div class="chart-grid">'+
  chartPanel('cRisk','مستوى مخاطر المشاريع','مؤشر مركب للتصريح والضمان والتسوية والعقد والبيانات')+
  chartPanel('cPermitStatus','حالة التصاريح','مفصولة عن حالة الضمان')+
  chartPanel('cGuarantee','حالة الضمانات والتعهدات')+
  chartPanel('cExt','ضغط تمديدات التصاريح')+
  chartPanel('cLineType','أنواع الخطوط البديلة')+
  chartPanel('cDesign','حالة التصميم والاعتماد')+
  chartPanel('cYears','التصاريح حسب السنة')+
  chartPanel('cMun','المشاريع حسب البلدية')+
 '</div>'+tablePanel('تنبيهات المتابعة الذكية',[
  {key:'severity',label:'الأهمية',html:r=>pill(r.severity==='high'?'مرتفعة':r.severity==='medium'?'متوسطة':'منخفضة')},
  {key:'type',label:'نوع التنبيه'},{key:'item',label:'المرجع'},{key:'details',label:'التفاصيل'}
 ],alerts);
 let x=topEntries(risks);makeChart('cRisk','doughnut',x.map(a=>a[0]),x.map(a=>a[1]));
 x=topEntries(countBy(projects,'permitStatus'));makeChart('cPermitStatus','doughnut',x.map(a=>a[0]),x.map(a=>a[1]));
 x=topEntries(countBy(projects,'guaranteeStatus'));makeChart('cGuarantee','doughnut',x.map(a=>a[0]),x.map(a=>a[1]));
 x=topEntries(countBy(projects,'extensionPressure'));makeChart('cExt','bar',x.map(a=>a[0]),x.map(a=>a[1]));
 x=topEntries(countBy(lines,'type'));makeChart('cLineType','doughnut',x.map(a=>a[0]),x.map(a=>a[1]));
 x=topEntries(countBy(lines,'designStatus'));makeChart('cDesign','bar',x.map(a=>a[0]),x.map(a=>a[1]));
 x=topEntries(countBy(permits,'year'));makeChart('cYears','bar',x.map(a=>a[0]),x.map(a=>a[1]));
 x=topEntries(countBy(projects,'municipality'),12);makeChart('cMun','bar',x.map(a=>a[0]),x.map(a=>a[1]),{horizontal:true});
}
function renderProjectsV2(){
 const rows=filtered(state.data.projects),meters=sum(rows,'permitMeters'),risks=countBy(rows,'riskLevel');
 const multi=rows.filter(x=>n(x.permitCount)>1).length,avgExt=rows.length?Math.round(rows.reduce((a,x)=>a+n(x.permitCount),0)/rows.length*100)/100:0;
 const high=(risks['حرج']||0)+(risks['مرتفع']||0);
 $('#pageHost').innerHTML='<div class="kpi-grid">'+
  kpi('إجمالي المشاريع',rows.length)+kpi('أمتار التصاريح',fmt(meters),'متر')+
  kpi('مخاطر مرتفعة/حرجة',high,'حسب مؤشر المخاطر المركب',high?'danger':'')+
  kpi('متعدد التصاريح/التمديدات',multi,'أكثر من تصريح واحد','warn')+
  kpi('متوسط التصاريح للمشروع',avgExt,'تصريح/تمديد')+
  kpi('أعلى عدد تمديدات',rows.length?Math.max(...rows.map(x=>n(x.permitCount))):0,'أقصى عدد مسجل','info')+
 '</div><div class="chart-grid">'+
  chartPanel('pRisk','مستوى المخاطر')+chartPanel('pExt','ضغط التمديدات')+
  chartPanel('pStatus','حالة العقود')+chartPanel('pPermit','حالة التصاريح')+
  chartPanel('pMun','المشاريع حسب البلدية')+chartPanel('pMeters','أعلى المشاريع في أمتار التصاريح')+
 '</div>'+tablePanel('تفاصيل المشاريع ومؤشر المخاطر',[
  {key:'no',label:'م'},{key:'name',label:'اسم المشروع'},{key:'riskLevel',label:'المخاطر',html:r=>pill(r.riskLevel)},
  {key:'riskScore',label:'درجة المخاطر'},{key:'contractStatus',label:'حالة العقد',html:r=>pill(r.contractStatus)},
  {key:'owner',label:'المالك'},{key:'contractor',label:'المقاول'},{key:'municipality',label:'البلدية'},
  {key:'permitCount',label:'عدد التصاريح'},{key:'extensionPressure',label:'ضغط التمديدات',html:r=>pill(r.extensionPressure)},
  {key:'permitStatus',label:'حالة التصريح',html:r=>pill(r.permitStatus)},{key:'permitMeters',label:'الأمتار'},
  {key:'matchedCoveragePct',label:'تغطية مطابقة %'},{key:'matchedBalance',label:'فجوة مطابقة'},
  {key:'riskReasons',label:'أسباب المخاطر',html:r=>esc((r.reasons||[]).join(' • '))}
 ],rows.sort((a,b)=>n(b.riskScore)-n(a.riskScore)));
 let x=topEntries(countBy(rows,'riskLevel'));makeChart('pRisk','doughnut',x.map(a=>a[0]),x.map(a=>a[1]));
 x=topEntries(countBy(rows,'extensionPressure'));makeChart('pExt','bar',x.map(a=>a[0]),x.map(a=>a[1]));
 x=topEntries(countBy(rows,'contractStatus'));makeChart('pStatus','bar',x.map(a=>a[0]),x.map(a=>a[1]));
 x=topEntries(countBy(rows,'permitStatus'));makeChart('pPermit','doughnut',x.map(a=>a[0]),x.map(a=>a[1]));
 x=topEntries(countBy(rows,'municipality'),12);makeChart('pMun','bar',x.map(a=>a[0]),x.map(a=>a[1]),{horizontal:true});
 const top=[...rows].sort((a,b)=>n(b.permitMeters)-n(a.permitMeters)).slice(0,12);makeChart('pMeters','bar',top.map(x=>x.no||x.name),top.map(x=>x.permitMeters),{horizontal:true,filterRules:top.map(x=>({mode:'projectRef',value:x.no||x.name,label:'المشروع'}))});
}
function renderPermitsV2(){
 const rows=filtered(state.data.actualPermits),expired=rows.filter(x=>x.expiryBand==='منتهي').length,soon=rows.filter(x=>['0–7 أيام','8–30 يوم'].includes(x.expiryBand)).length;
 const linked=new Set(rows.map(x=>x.projectNo).filter(Boolean)).size;
 $('#pageHost').innerHTML='<div class="kpi-grid">'+
  kpi('التصاريح الفعلية',rows.length,'بعد استبعاد تحت الإصدار والملغي')+
  kpi('إجمالي الأمتار',fmt(sum(rows,'meters')),'متر')+
  kpi('منتهية',expired,'تحتاج مراجعة/إغلاق','danger')+
  kpi('تنتهي خلال 30 يوم',soon,'نافذة تدخل قريبة',soon?'warn':'')+
  kpi('مشاريع مرتبطة',linked,'تم الربط برقم التصريح')+
  kpi('غير مرتبطة بمشروع',rows.filter(x=>!x.projectNo).length,'مراجعة الربط','warn')+
 '</div><div class="chart-grid">'+
  chartPanel('peExpiry','نافذة انتهاء التصاريح','منتهي / 7 / 30 / 60 يوم')+
  chartPanel('peYear','التصاريح حسب السنة')+
  chartPanel('peMun','التصاريح حسب بلدية المشروع','البلدية من vd projects بعد الربط')+
  chartPanel('peCon','التصاريح حسب مقاول المشروع','المقاول من vd projects بعد الربط')+
  chartPanel('peOwner','أعلى الملاك بالأمتار')+
  chartPanel('peMetersYear','الأمتار حسب سنة التصريح')+
 '</div>'+tablePanel('سجل التصاريح المربوط بالمشروعات',[
  {key:'id',label:'رقم التصريح'},{key:'projectNo',label:'المشروع'},{key:'projectName',label:'اسم المشروع'},
  {key:'start',label:'البداية'},{key:'end',label:'النهاية'},{key:'expiryDays',label:'الأيام المتبقية'},
  {key:'expiryBand',label:'نافذة الانتهاء',html:r=>pill(r.expiryBand)},{key:'meters',label:'الأمتار'},
  {key:'owner',label:'المالك'},{key:'contractor',label:'المقاول'},{key:'municipality',label:'البلدية'},
  {key:'contractStatus',label:'حالة العقد',html:r=>pill(r.contractStatus)}
 ],rows);
 let x=topEntries(countBy(rows,'expiryBand'));makeChart('peExpiry','doughnut',x.map(a=>a[0]),x.map(a=>a[1]));
 x=topEntries(countBy(rows,'year'));makeChart('peYear','bar',x.map(a=>a[0]),x.map(a=>a[1]));
 x=topEntries(countBy(rows,'municipality'),12);makeChart('peMun','bar',x.map(a=>a[0]),x.map(a=>a[1]),{horizontal:true});
 x=topEntries(countBy(rows,'contractor'),12);makeChart('peCon','bar',x.map(a=>a[0]),x.map(a=>a[1]),{horizontal:true});
 const om={};rows.forEach(r=>{const k=r.owner||'غير محدد';om[k]=(om[k]||0)+n(r.meters)});x=topEntries(om,12);makeChart('peOwner','bar',x.map(a=>a[0]),x.map(a=>a[1]),{horizontal:true});
 const ym={};rows.forEach(r=>{const k=r.year||'غير محدد';ym[k]=(ym[k]||0)+n(r.meters)});x=Object.entries(ym).sort((a,b)=>String(a[0]).localeCompare(String(b[0])));makeChart('peMetersYear','bar',x.map(a=>a[0]),x.map(a=>a[1]));
}
function renderLinesV2(){
 const rows=filtered(state.data.lines),approved=rows.filter(x=>/معتمد|حزمة مصممة/i.test(x.designStatus)).length,pending=rows.filter(x=>/جاري|قيد/i.test(x.designStatus)&&!x.approvalDate).length,conflicts=rows.filter(x=>/جاري|قيد/i.test(x.designStatus)&&!!x.approvalDate).length,missing=rows.filter(x=>!x.designStatus).length;
 const validApproval=rows.filter(x=>Number.isFinite(x.approvalDays)&&x.approvalDays>=0);
 const avgApproval=validApproval.length?Math.round(avg(validApproval,'approvalDays')*10)/10:0;
 const chronology=rows.filter(x=>x.chronologyIssue).length;
 $('#pageHost').innerHTML='<div class="kpi-grid">'+
  kpi('الخطوط المسجلة',rows.length)+kpi('إجمالي الأطوال',fmt(sum(rows,'length')),'متر')+
  kpi('تصميم معتمد',approved,'معتمد/حزمة PMO')+kpi('قيد الاعتماد فعليًا',pending,'بدون تاريخ اعتماد',pending?'warn':'')+
  kpi('تعارض حالة/تاريخ',conflicts,'حالة جاري الاعتماد مع وجود تاريخ اعتماد',conflicts?'danger':'')+
  kpi('بدون حالة تصميم',missing,'فجوة بيانات',missing?'warn':'')+
  kpi('متوسط مدة الاعتماد',avgApproval,'يوم للحالات ذات تسلسل صالح','info')+
  kpi('مشاكل تسلسل زمني',chronology,'رفع التصميم قبل التكليف',chronology?'danger':'')+
 '</div><div class="chart-grid">'+
  chartPanel('lType','أنواع الخطوط')+chartPanel('lDesign','حالة التصميم')+
  chartPanel('lApproval','مدة اعتماد التصميم')+chartPanel('lAging','عمر التصاميم غير المعتمدة')+
  chartPanel('lContractor','أطوال الخطوط حسب المقاول')+chartPanel('lDesigner','الخطوط حسب المصمم')+
  chartPanel('lDiameter','توزيع أقطار التصميم')+chartPanel('lDiff','أكبر فروقات طول التصميم مقابل الخط')+
 '</div>'+tablePanel('تفاصيل الخطوط ودورة التصميم',[
  {key:'ref',label:'المرجع'},{key:'name',label:'الخط/الموقع'},{key:'type',label:'النوع',html:r=>pill(r.type)},
  {key:'length',label:'طول الخط'},{key:'designLength',label:'طول التصميم'},{key:'designLengthDiff',label:'فرق التصميم'},
  {key:'diameter',label:'القطر'},{key:'contractor',label:'المقاول'},{key:'owner',label:'المالك'},
  {key:'designer',label:'المصمم'},{key:'designStatus',label:'حالة التصميم',html:r=>pill(r.designStatus)},
  {key:'submissionDate',label:'تاريخ الرفع'},{key:'approvalDate',label:'تاريخ الاعتماد'},
  {key:'approvalDays',label:'مدة الاعتماد'},{key:'designAgeDays',label:'عمر المتابعة'},
  {key:'chronologyIssue',label:'التسلسل الزمني',html:r=>r.chronologyIssue?pill('خطأ زمني'):pill('سليم')}
 ],rows);
 let x=topEntries(countBy(rows,'type'));makeChart('lType','doughnut',x.map(a=>a[0]),x.map(a=>a[1]));
 x=topEntries(countBy(rows,'designStatus'));makeChart('lDesign','bar',x.map(a=>a[0]),x.map(a=>a[1]));
 x=topEntries(countBy(rows,'approvalBand'));makeChart('lApproval','bar',x.map(a=>a[0]),x.map(a=>a[1]));
 x=topEntries(countBy(rows.filter(r=>r.designAgeDays>0),'designAgeBand'));makeChart('lAging','bar',x.map(a=>a[0]),x.map(a=>a[1]));
 const cm={};rows.forEach(r=>{const k=r.contractor||'غير محدد';cm[k]=(cm[k]||0)+n(r.length)});x=topEntries(cm,12);makeChart('lContractor','bar',x.map(a=>a[0]),x.map(a=>a[1]),{horizontal:true});
 x=topEntries(countBy(rows,'designer'),10);makeChart('lDesigner','bar',x.map(a=>a[0]),x.map(a=>a[1]),{horizontal:true});
 x=topEntries(countBy(rows,'diameter'),12);makeChart('lDiameter','bar',x.map(a=>a[0]),x.map(a=>a[1]));
 const diffs=rows.filter(r=>r.designLengthDiff!==null).sort((a,b)=>Math.abs(n(b.designLengthDiff))-Math.abs(n(a.designLengthDiff))).slice(0,12);makeChart('lDiff','bar',diffs.map(x=>x.ref),diffs.map(x=>x.designLengthDiff),{horizontal:true});
}
function renderSettlementsV2(){
 const rows=filtered(state.data.settlements),due=sum(rows,'dueMeters'),done=sum(rows,'executedMeters'),gap=Math.round((due-done)*10)/10,coverage=pct(done,due);
 const owed=rows.filter(x=>x.balance>0),credit=rows.filter(x=>x.balance<0),settled=rows.filter(x=>x.balance===0);
 $('#pageHost').innerHTML='<div class="kpi-grid">'+
  kpi('علاقات التسوية',rows.length)+kpi('المستحق المطابق',fmt(due),'متر')+
  kpi('الخطوط المطابقة',fmt(done),'متر')+kpi('نسبة التغطية المطابقة',coverage,'% بالمالك + المقاول',coverage<80?'warn':'info')+
  kpi('فجوة الأمتار',fmt(gap),'المستحق - المنفذ',gap>0?'danger':'')+
  kpi('عليه أمتار',owed.length,fmt(sum(owed,'balance'))+' م','danger')+
  kpi('له أمتار',credit.length,fmt(Math.abs(sum(credit,'balance')))+' م','info')+
  kpi('مستوفي',settled.length,'رصيد صفر')+
 '</div><div class="chart-grid">'+
  chartPanel('sStatus','حالة التسويات')+chartPanel('sCoverage','نطاق نسبة التغطية')+
  chartPanel('sContractor','صافي الرصيد حسب المقاول')+chartPanel('sDueDone','المستحق مقابل الخطوط حسب المقاول')+
  chartPanel('sGaps','أكبر فجوات المالك + المقاول')+
 '</div>'+tablePanel('تسويات الملاك والمقاولين',[
  {key:'owner',label:'المالك'},{key:'contractor',label:'المقاول'},{key:'dueMeters',label:'المستحق'},
  {key:'executedMeters',label:'الخطوط'},{key:'coveragePct',label:'التغطية %'},{key:'coverageBand',label:'نطاق التغطية',html:r=>pill(r.coverageBand)},
  {key:'balance',label:'الرصيد النهائي'},{key:'status',label:'الحالة',html:r=>pill(r.status)}
 ],rows);
 let x=topEntries(countBy(rows,'status'));makeChart('sStatus','doughnut',x.map(a=>a[0]),x.map(a=>a[1]));
 x=topEntries(countBy(rows,'coverageBand'));makeChart('sCoverage','bar',x.map(a=>a[0]),x.map(a=>a[1]));
 const cm={};rows.forEach(r=>{const k=r.contractor||'غير محدد';cm[k]=(cm[k]||0)+n(r.balance)});x=Object.entries(cm).sort((a,b)=>Math.abs(b[1])-Math.abs(a[1])).slice(0,12);makeChart('sContractor','bar',x.map(a=>a[0]),x.map(a=>a[1]),{horizontal:true});
 const ag={};rows.forEach(r=>{const k=r.contractor||'غير محدد';ag[k]??={due:0,done:0};ag[k].due+=n(r.dueMeters);ag[k].done+=n(r.executedMeters)});const aa=Object.entries(ag).sort((a,b)=>b[1].due-a[1].due).slice(0,10);makeMultiBar('sDueDone',aa.map(x=>x[0]),[{label:'المستحق',data:aa.map(x=>x[1].due)},{label:'الخطوط',data:aa.map(x=>x[1].done)}],{horizontal:true});
 const gaps=[...rows].sort((a,b)=>Math.abs(b.balance)-Math.abs(a.balance)).slice(0,12);makeChart('sGaps','bar',gaps.map(x=>(x.owner||'')+' / '+(x.contractor||'')),gaps.map(x=>x.balance),{horizontal:true,filterRules:gaps.map(x=>({mode:'allOf',label:'المالك + المقاول',rules:[{field:'owner',mode:'exact',value:x.owner||''},{field:'contractor',mode:'exact',value:x.contractor||''}]}))});
}
function renderGuaranteesV2(){
 const rows=filtered(state.data.projects),expired=rows.filter(x=>/منتهي/i.test(x.guaranteeStatus)).length,soon=rows.filter(x=>/أوشك/i.test(x.guaranteeStatus)).length,waiting=rows.filter(x=>/بانتظار/i.test(x.guaranteeStatus)).length,undertaking=rows.filter(x=>/تعهد/i.test(x.guaranteeStatus)).length;
 const valid=rows.filter(x=>/ساري/i.test(x.guaranteeStatus)).length;
 $('#pageHost').innerHTML='<div class="kpi-grid">'+kpi('المشاريع',rows.length)+
  kpi('ضمان منتهي',expired,'تدخل تعاقدي','danger')+kpi('أوشك على الانتهاء',soon,'متابعة عاجلة','warn')+
  kpi('بانتظار إصدار',waiting,'ضمان أو تعهد','warn')+kpi('تعهدات قائمة',undertaking,'بديل الضمان','info')+
  kpi('ضمانات سارية',valid,'سارية حاليًا')+
 '</div><div class="chart-grid">'+chartPanel('gStatus','حالة الضمانات والتعهدات')+chartPanel('gContractor','المشاريع حسب المقاول')+chartPanel('gWindow','نافذة الأيام المتبقية')+'</div>'+
 tablePanel('سجل الضمانات والتعهدات',[
  {key:'no',label:'المشروع'},{key:'owner',label:'المالك'},{key:'contractor',label:'المقاول'},
  {key:'guaranteeRef',label:'رقم الضمان/التعهد'},{key:'guaranteeExpiry',label:'الانتهاء'},
  {key:'guaranteeDays',label:'الأيام المتبقية'},{key:'guaranteeStatus',label:'الحالة',html:r=>pill(r.guaranteeStatus)},
  {key:'riskLevel',label:'مخاطر المشروع',html:r=>pill(r.riskLevel)}
 ],rows);
 let x=topEntries(countBy(rows,'guaranteeStatus'));makeChart('gStatus','doughnut',x.map(a=>a[0]),x.map(a=>a[1]));
 x=topEntries(countBy(rows,'contractor'),12);makeChart('gContractor','bar',x.map(a=>a[0]),x.map(a=>a[1]),{horizontal:true});
 const bands={'منتهي':0,'0–14 يوم':0,'15–30 يوم':0,'31–60 يوم':0,'>60 يوم':0,'تعهد/بدون تاريخ':0};rows.forEach(r=>{if(/تعهد/i.test(r.guaranteeStatus)||!r.guaranteeExpiry)bands['تعهد/بدون تاريخ']++;else if(n(r.guaranteeDays)<=0)bands['منتهي']++;else if(n(r.guaranteeDays)<=14)bands['0–14 يوم']++;else if(n(r.guaranteeDays)<=30)bands['15–30 يوم']++;else if(n(r.guaranteeDays)<=60)bands['31–60 يوم']++;else bands['>60 يوم']++});x=Object.entries(bands);makeChart('gWindow','bar',x.map(a=>a[0]),x.map(a=>a[1]));
}
function renderComplaintsV2(){
 const rows=filtered(state.data.complaints),withStatus=rows.filter(x=>x.status).length,withLink=rows.filter(x=>x.link).length;
 $('#pageHost').innerHTML='<div class="kpi-grid">'+kpi('إجمالي الشكاوى',rows.length)+
  kpi('بحالة مسجلة',withStatus,'اكتمال المتابعة')+kpi('بدون حالة',rows.length-withStatus,'فجوة متابعة','warn')+
  kpi('مرتبطة بحل/خط',withLink,'اكتمال الربط')+kpi('بدون ربط',rows.length-withLink,'تحتاج تحديد الحل','warn')+
  kpi('جاهزية بيانات الشكاوى',pct(withStatus+withLink,rows.length*2),'% من حقول الحالة والربط','info')+
 '</div><div class="chart-grid">'+chartPanel('coStatus','حالة الشكاوى')+
 '<section class="panel"><div class="panel-head"><b>قراءة استشارية</b></div><div class="empty"><b>الشكوى يجب أن تكون قابلة للتتبع حتى الحل</b><span>الحالة والربط بالخط البديل حقول أساسية قبل احتساب مؤشرات زمن الاستجابة أو الإغلاق.</span></div></section></div>'+
 tablePanel('سجل الشكاوى',[
  {key:'text',label:'الشكوى'},{key:'status',label:'الحالة',html:r=>pill(r.status)},{key:'link',label:'الخط/الحل المقابل'}
 ],rows);
 const x=topEntries(countBy(rows,'status'));makeChart('coStatus','doughnut',x.map(a=>a[0]),x.map(a=>a[1]));
}
function renderExecutionV2(){
 const rows=filtered(state.data.lines),started=rows.filter(x=>x.executionStatus).length,completion=rows.filter(x=>x.completion||x.completionReport).length,handover=rows.filter(x=>x.handoverDate||x.handoverLetter).length;
 const ready=pct(started+completion+handover,rows.length*3);
 $('#pageHost').innerHTML='<div class="kpi-grid">'+kpi('الخطوط',rows.length)+
  kpi('حالة تنفيذ مسجلة',started,'جاهزية الحقل')+kpi('بيانات إتمام',completion,'تاريخ/تقرير')+
  kpi('بيانات تسليم',handover,'خطاب/تاريخ')+kpi('جاهزية بيانات التنفيذ',ready,'% من الحقول الأساسية','info')+
  kpi('بدون حالة تنفيذ',rows.length-started,'لا يعني عدم التنفيذ','warn')+
 '</div>'+
 (started?'<div class="chart-grid">'+chartPanel('exStatus','حالة التنفيذ')+chartPanel('exType','التنفيذ حسب نوع الخط')+'</div>':
 '<section class="panel wide"><div class="panel-head"><b>مؤشر الجاهزية</b><span>لا يتم عرض نسبة إنجاز تنفيذية وهمية</span></div><div class="empty"><b>لا توجد حالات تنفيذ مدخلة حاليًا</b><span>عند تعبئة حالة التنفيذ وتواريخ الإتمام والتسليم ستظهر مؤشرات الإنجاز تلقائيًا.</span></div></section>')+
 tablePanel('التنفيذ والتسليم',[
  {key:'ref',label:'المرجع'},{key:'name',label:'الخط'},{key:'contractor',label:'المقاول'},{key:'type',label:'النوع'},
  {key:'executionStatus',label:'حالة التنفيذ',html:r=>pill(r.executionStatus)},{key:'completion',label:'انتهاء التنفيذ'},
  {key:'completionReport',label:'تقرير الإتمام'},{key:'handoverLetter',label:'خطاب التسليم'},{key:'handoverDate',label:'تاريخ التسليم'}
 ],rows);
 if(started){let x=topEntries(countBy(rows,'executionStatus'));makeChart('exStatus','doughnut',x.map(a=>a[0]),x.map(a=>a[1]));const typeRows=rows.filter(r=>r.executionStatus);x=topEntries(countBy(typeRows,'type'));makeChart('exType','bar',x.map(a=>a[0]),x.map(a=>a[1]))}
}
function renderPartiesV2(){
 const projects=commonFiltered(state.data.projects),lines=commonFiltered(state.data.lines);
 const contractors={},owners={};
 projects.forEach(r=>{const k=r.contractor||'غير محدد';contractors[k]??={name:k,projects:0,permitMeters:0,lineMeters:0,lines:0};contractors[k].projects++;contractors[k].permitMeters+=n(r.permitMeters);const o=r.owner||'غير محدد';owners[o]??={name:o,projects:0,permitMeters:0,lineMeters:0,lines:0};owners[o].projects++;owners[o].permitMeters+=n(r.permitMeters)});
 lines.forEach(r=>{const k=r.contractor||'غير محدد';contractors[k]??={name:k,projects:0,permitMeters:0,lineMeters:0,lines:0};contractors[k].lines++;contractors[k].lineMeters+=n(r.length);const o=r.owner||'غير محدد';owners[o]??={name:o,projects:0,permitMeters:0,lineMeters:0,lines:0};owners[o].lines++;owners[o].lineMeters+=n(r.length)});
 const cr=Object.values(contractors).map(x=>({...x,coveragePct:pct(x.lineMeters,x.permitMeters)})).sort((a,b)=>b.permitMeters-a.permitMeters);
 const or=Object.values(owners).map(x=>({...x,coveragePct:pct(x.lineMeters,x.permitMeters)})).sort((a,b)=>b.permitMeters-a.permitMeters);
 $('#pageHost').innerHTML='<div class="kpi-grid">'+kpi('المقاولون',cr.length)+kpi('الملاك',or.length)+kpi('أمتار التصاريح',fmt(sum(projects,'permitMeters')))+kpi('أمتار الخطوط',fmt(sum(lines,'length')))+'</div>'+
 '<div class="chart-grid">'+chartPanel('paCon','المقاولون: المستحق مقابل الخطوط')+chartPanel('paOwner','الملاك: المستحق مقابل الخطوط')+'</div>'+
 tablePanel('ملخص المقاولين',[
  {key:'name',label:'المقاول'},{key:'projects',label:'المشاريع'},{key:'lines',label:'الخطوط'},{key:'permitMeters',label:'أمتار التصاريح'},{key:'lineMeters',label:'أمتار الخطوط'},{key:'coveragePct',label:'التغطية الإجمالية %'}
 ],cr)+tablePanel('ملخص الملاك',[
  {key:'name',label:'المالك'},{key:'projects',label:'المشاريع'},{key:'lines',label:'الخطوط'},{key:'permitMeters',label:'أمتار التصاريح'},{key:'lineMeters',label:'أمتار الخطوط'},{key:'coveragePct',label:'التغطية الإجمالية %'}
 ],or);
 let x=cr.slice(0,10);makeMultiBar('paCon',x.map(a=>a.name),[{label:'أمتار التصاريح',data:x.map(a=>a.permitMeters)},{label:'أمتار الخطوط',data:x.map(a=>a.lineMeters)}],{horizontal:true});
 x=or.slice(0,10);makeMultiBar('paOwner',x.map(a=>a.name),[{label:'أمتار التصاريح',data:x.map(a=>a.permitMeters)},{label:'أمتار الخطوط',data:x.map(a=>a.lineMeters)}],{horizontal:true});
}
function renderRisks(){
 const rows=filtered(state.data.projects),counts=countBy(rows,'riskLevel'),avgScore=rows.length?Math.round(avg(rows,'riskScore')*10)/10:0;
 const high=(counts['حرج']||0)+(counts['مرتفع']||0),extHigh=rows.filter(x=>['مرتفع','مرتفع جدًا'].includes(x.extensionPressure)).length;
 $('#pageHost').innerHTML='<div class="kpi-grid">'+
  kpi('المشاريع',rows.length)+kpi('متوسط درجة المخاطر',avgScore,'من 100','info')+
  kpi('حرج',counts['حرج']||0,'أولوية قصوى','danger')+kpi('مرتفع',counts['مرتفع']||0,'أولوية عالية','danger')+
  kpi('متوسط',counts['متوسط']||0,'متابعة','warn')+kpi('طبيعي',counts['طبيعي']||0,'مخاطر أقل')+
  kpi('ضغط تمديدات مرتفع',extHigh,'5 تصاريح/تمديدات فأكثر',extHigh?'warn':'')+
 '</div><div class="chart-grid">'+
  chartPanel('rLevel','توزيع مستوى المخاطر')+chartPanel('rExt','ضغط تمديدات التصاريح')+
  chartPanel('rMun','المخاطر حسب البلدية')+chartPanel('rTop','أعلى المشاريع في درجة المخاطر')+
 '</div>'+tablePanel('سجل مخاطر المشاريع',[
  {key:'riskLevel',label:'المستوى',html:r=>pill(r.riskLevel)},{key:'riskScore',label:'الدرجة'},
  {key:'no',label:'المشروع'},{key:'name',label:'اسم المشروع'},{key:'municipality',label:'البلدية'},
  {key:'owner',label:'المالك'},{key:'contractor',label:'المقاول'},{key:'contractStatus',label:'حالة العقد',html:r=>pill(r.contractStatus)},
  {key:'permitStatus',label:'التصريح',html:r=>pill(r.permitStatus)},{key:'guaranteeStatus',label:'الضمان',html:r=>pill(r.guaranteeStatus)},
  {key:'extensionPressure',label:'ضغط التمديدات',html:r=>pill(r.extensionPressure)},
  {key:'matchedCoveragePct',label:'تغطية مطابقة %'},{key:'matchedBalance',label:'فجوة مطابقة'},
  {key:'riskReasons',label:'أسباب المخاطر',html:r=>esc((r.reasons||[]).join(' • '))}
 ],rows.sort((a,b)=>n(b.riskScore)-n(a.riskScore)));
 let x=topEntries(counts);makeChart('rLevel','doughnut',x.map(a=>a[0]),x.map(a=>a[1]));
 x=topEntries(countBy(rows,'extensionPressure'));makeChart('rExt','bar',x.map(a=>a[0]),x.map(a=>a[1]));
 const mg={};rows.forEach(r=>{const k=r.municipality||'غير محدد';mg[k]??={sum:0,count:0};mg[k].sum+=n(r.riskScore);mg[k].count++});x=Object.entries(mg).map(([k,v])=>[k,Math.round(v.sum/v.count*10)/10]).sort((a,b)=>b[1]-a[1]).slice(0,12);makeChart('rMun','bar',x.map(a=>a[0]),x.map(a=>a[1]),{horizontal:true});
 const top=[...rows].sort((a,b)=>n(b.riskScore)-n(a.riskScore)).slice(0,12);makeChart('rTop','bar',top.map(x=>x.no||x.name),top.map(x=>x.riskScore),{horizontal:true,filterRules:top.map(x=>({mode:'projectRef',value:x.no||x.name,label:'المشروع'}))});
}
function renderMunicipalities(){
 const rows=filtered(state.data.municipalitySummary||[]);
 const projects=sum(rows,'projects'),permitMeters=sum(rows,'permitMeters'),lines=sum(rows,'lines'),lineMeters=sum(rows,'lineMeters'),critical=sum(rows,'criticalProjects'),pending=sum(rows,'pendingDesign');
 $('#pageHost').innerHTML='<div class="kpi-grid">'+kpi('البلديات',rows.length)+kpi('المشاريع',projects)+
  kpi('أمتار التصاريح',fmt(permitMeters),'متر')+kpi('الخطوط',lines)+kpi('أمتار الخطوط',fmt(lineMeters),'متر')+
  kpi('مخاطر مرتفعة/حرجة',critical,'مشروعات')+kpi('تصاميم تحتاج متابعة',pending,'خطوط','warn')+
 '</div><div class="chart-grid">'+
  chartPanel('muProjects','عدد المشاريع حسب البلدية')+chartPanel('muPermit','أمتار التصاريح حسب البلدية')+
  chartPanel('muLines','أمتار الخطوط حسب البلدية')+chartPanel('muRisk','المشاريع مرتفعة/حرجة المخاطر')+
  chartPanel('muCoverage','التغطية الإجمالية حسب البلدية','للقراءة المقارنة فقط؛ ليست تسوية مطابقة')+
 '</div>'+tablePanel('ملخص البلديات',[
  {key:'municipality',label:'البلدية'},{key:'projects',label:'المشاريع'},{key:'permitMeters',label:'أمتار التصاريح'},
  {key:'lines',label:'الخطوط'},{key:'lineMeters',label:'أمتار الخطوط'},{key:'grossCoveragePct',label:'تغطية إجمالية %'},
  {key:'criticalProjects',label:'مخاطر مرتفعة/حرجة'},{key:'pendingDesign',label:'تصاميم تحتاج متابعة'}
 ],rows);
 let x=[...rows].sort((a,b)=>b.projects-a.projects);makeChart('muProjects','bar',x.map(a=>a.municipality),x.map(a=>a.projects),{horizontal:true});
 x=[...rows].sort((a,b)=>b.permitMeters-a.permitMeters);makeChart('muPermit','bar',x.map(a=>a.municipality),x.map(a=>a.permitMeters),{horizontal:true});
 x=[...rows].sort((a,b)=>b.lineMeters-a.lineMeters);makeChart('muLines','bar',x.map(a=>a.municipality),x.map(a=>a.lineMeters),{horizontal:true});
 x=[...rows].sort((a,b)=>b.criticalProjects-a.criticalProjects);makeChart('muRisk','bar',x.map(a=>a.municipality),x.map(a=>a.criticalProjects),{horizontal:true});
 x=rows.filter(a=>a.grossCoveragePct!==null).sort((a,b)=>b.grossCoveragePct-a.grossCoveragePct);makeChart('muCoverage','bar',x.map(a=>a.municipality),x.map(a=>a.grossCoveragePct),{horizontal:true});
}
function renderTraceability(){
 const rows=filtered(state.data.traceability||[]),linked=rows.filter(x=>x.matchMethod!=='لا يوجد ربط مطابق').length,unlinked=rows.length-linked,high=rows.filter(x=>['حرج','مرتفع'].includes(x.riskLevel)).length;
 $('#pageHost').innerHTML='<div class="kpi-grid">'+kpi('المشاريع',rows.length)+kpi('مرتبطة بخطوط',linked,'بمطابقة المالك + المقاول')+
  kpi('بدون ربط مطابق',unlinked,'تحتاج مراجعة العلاقة','warn')+kpi('مخاطر مرتفعة/حرجة',high,'مشاريع')+
  kpi('أمتار التصاريح',fmt(sum(rows,'permitMeters')),'متر')+kpi('أمتار الخطوط المرتبطة',fmt(sum(rows,'lineMeters')),'متر')+
 '</div><div class="chart-grid">'+chartPanel('trRisk','المخاطر في سلسلة التتبع')+chartPanel('trMatch','حالة الربط التشغيلي')+chartPanel('trLines','أعلى المشروعات في أمتار الخطوط المرتبطة')+'</div>'+
 '<section class="panel wide"><div class="panel-head"><b>منهجية الربط</b><span>لا يتم ادعاء ربط مباشر غير موجود بالشيت</span></div><div class="empty"><b>الربط الحالي تحليلي على مستوى المالك + المقاول</b><span>يظهر بوضوح في الجدول كـ "طريقة الربط". عند إضافة مرجع مشروع مباشر للخط يمكن تحويله إلى تتبع قطعي.</span></div></section>'+
 tablePanel('مصفوفة التتبع الشامل',[
  {key:'no',label:'المشروع'},{key:'name',label:'اسم المشروع'},{key:'riskLevel',label:'المخاطر',html:r=>pill(r.riskLevel)},
  {key:'owner',label:'المالك'},{key:'contractor',label:'المقاول'},{key:'municipality',label:'البلدية'},
  {key:'permitRefs',label:'التصاريح'},{key:'permitCount',label:'عدد التصاريح'},{key:'permitMeters',label:'أمتار التصاريح'},
  {key:'lineCount',label:'عدد الخطوط'},{key:'lineRefs',label:'مراجع الخطوط'},{key:'lineMeters',label:'أمتار الخطوط'},
  {key:'designStatuses',label:'حالات التصميم'},{key:'executionStatuses',label:'حالات التنفيذ'},
  {key:'matchMethod',label:'طريقة الربط',html:r=>pill(r.matchMethod)}
 ],rows);
 let x=topEntries(countBy(rows,'riskLevel'));makeChart('trRisk','doughnut',x.map(a=>a[0]),x.map(a=>a[1]));
 x=topEntries(countBy(rows,'matchMethod'));makeChart('trMatch','doughnut',x.map(a=>a[0]),x.map(a=>a[1]));
 const top=[...rows].sort((a,b)=>n(b.lineMeters)-n(a.lineMeters)).slice(0,12);makeChart('trLines','bar',top.map(x=>x.no||x.name),top.map(x=>x.lineMeters),{horizontal:true,filterRules:top.map(x=>({mode:'projectRef',value:x.no||x.name,label:'المشروع'}))});
}
function renderAnalyticsV2(){
 const projects=commonFiltered(state.data.projects),permits=commonFiltered(state.data.actualPermits),lines=commonFiltered(state.data.lines),sett=commonFiltered(state.data.settlements||[]);
 const permitMeters=sum(permits,'meters'),lineMeters=sum(lines,'length'),gross=pct(lineMeters,permitMeters),matched=pct(sum(sett,'executedMeters'),sum(sett,'dueMeters'));
 const risk=countBy(projects,'riskLevel'),high=(risk['حرج']||0)+(risk['مرتفع']||0),expired=permits.filter(x=>x.expiryBand==='منتهي').length;
 const oldDesign=lines.filter(x=>n(x.designAgeDays)>60).length;
 const topRisk=[...projects].sort((a,b)=>n(b.riskScore)-n(a.riskScore)).slice(0,15);
 $('#pageHost').innerHTML='<div class="kpi-grid">'+kpi('المشاريع بالنطاق',projects.length)+
  kpi('التغطية الإجمالية',gross,'% إجمالي')+kpi('التغطية المطابقة',matched,'% مالك + مقاول',matched<80?'warn':'info')+
  kpi('مشاريع عالية المخاطر',high,'حرج + مرتفع',high?'danger':'')+kpi('تصاريح منتهية',expired,'من التصاريح المفلترة','danger')+
  kpi('تصاميم متقادمة >60 يوم',oldDesign,'غير معتمدة','warn')+
 '</div><div class="insight-grid">'+
  '<article class="insight-card"><b>المخاطر</b><strong>'+fmt(high)+'</strong><span>مشروع يحتاج تدخلًا ذا أولوية.</span></article>'+
  '<article class="insight-card"><b>التسويات</b><strong>'+fmt(matched)+'%</strong><span>تغطية مطابقة بالمالك والمقاول.</span></article>'+
  '<article class="insight-card"><b>التصاريح</b><strong>'+fmt(expired)+'</strong><span>تصريح منتهي داخل نطاق الفلاتر.</span></article>'+
  '<article class="insight-card"><b>التصميم</b><strong>'+fmt(oldDesign)+'</strong><span>تصميم غير معتمد عمره أكبر من 60 يومًا.</span></article>'+
 '</div><div class="chart-grid">'+chartPanel('anRisk','مستوى المخاطر')+chartPanel('anSet','حالة التسويات')+
  chartPanel('anGuarantee','حالة الضمانات')+chartPanel('anMun','المشاريع حسب البلدية')+
 '</div>'+tablePanel('أعلى أولويات التدخل الإداري',[
  {key:'riskLevel',label:'المستوى',html:r=>pill(r.riskLevel)},{key:'riskScore',label:'الدرجة'},{key:'no',label:'المشروع'},
  {key:'municipality',label:'البلدية'},{key:'owner',label:'المالك'},{key:'contractor',label:'المقاول'},
  {key:'permitStatus',label:'التصريح',html:r=>pill(r.permitStatus)},{key:'guaranteeStatus',label:'الضمان',html:r=>pill(r.guaranteeStatus)},
  {key:'matchedCoveragePct',label:'تغطية مطابقة %'},{key:'riskReasons',label:'أسباب المخاطر',html:r=>esc((r.reasons||[]).join(' • '))}
 ],topRisk);
 let x=topEntries(risk);makeChart('anRisk','doughnut',x.map(a=>a[0]),x.map(a=>a[1]));
 x=topEntries(countBy(sett,'status'));makeChart('anSet','doughnut',x.map(a=>a[0]),x.map(a=>a[1]));
 x=topEntries(countBy(projects,'guaranteeStatus'));makeChart('anGuarantee','doughnut',x.map(a=>a[0]),x.map(a=>a[1]));
 x=topEntries(countBy(projects,'municipality'),12);makeChart('anMun','bar',x.map(a=>a[0]),x.map(a=>a[1]),{horizontal:true});
}

function renderSmartShell(){
 $('#pageHost').innerHTML='<section id="urgentSmartSuiteHost" class="urgent-smart-suite-host" data-smart-page="'+esc(state.page)+'"></section>';
}
function reportGrandValue(table,index){
 const rows=table?.rows||[],grand=rows.find(r=>norm(r?.[0])===norm('Grand Total'));
 return clean(grand?.[index]??'');
}
function sheetReportTable(title,table,note='',reportKey=''){
 const id='rpt_'+Math.random().toString(36).slice(2),headers=table?.headers||[],rows=table?.rows||[];
 return '<section class="table-panel wide sheet-report-table" data-report-table-title="'+esc(title)+'"'+(reportKey?' data-followup-report="'+esc(reportKey)+'"':'')+'><div class="table-tools"><div><b>'+esc(title)+'</b>'+(note?'<small>'+esc(note)+'</small>':'')+'</div><div class="sheet-table-actions"><button type="button" class="sheet-table-pdf" data-export-sheet-table>تصدير الجدول PDF</button><input class="table-search" data-table="'+id+'" type="search" placeholder="بحث داخل التقرير..."></div></div>'+
 '<div class="table-scroll"><table id="'+id+'"><thead><tr>'+headers.map(h=>'<th>'+esc(h||'—')+'</th>').join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+headers.map((_,i)=>'<td>'+esc(r?.[i]??'')+'</td>').join('')+'</tr>').join('')+'</tbody></table></div></section>';
}
function contractorSheetReport(rep,index){
 const total=clean(rep?.total),tone=total.startsWith('-')?'negative':(total&&total!=='0'?'positive':'neutral');
 return '<article class="sheet-contractor-report" data-followup-report="contractor-'+index+'"><div class="sheet-contractor-head"><div><small>مطابقة المالك + المقاول</small><h4>'+esc(rep?.title||'تقرير مقاول')+'</h4></div><span class="sheet-balance '+tone+'"><small>صافي الأمتار</small><b>'+esc(total||'0')+'</b></span></div>'+sheetReportTable('تفاصيل التسوية',rep,'المستحق من vd projects مقابل أطوال Alternative lines ثم الفرق + الخصم/الإضافة + حالة السداد')+'</article>';
}
function exportFollowupTablePdf(button){
 const target=button?.closest?.('.sheet-report-table');if(!target)return;
 const host=$('#pageHost'),all=[...host.querySelectorAll('.sheet-report-table')],hidden=[];
 all.forEach(el=>{if(el!==target){hidden.push([el,el.style.display]);el.style.display='none'}});
 ['.sheet-report-hero','.sheet-report-kpis','.sheet-report-warning'].forEach(sel=>host.querySelectorAll(sel).forEach(el=>{hidden.push([el,el.style.display]);el.style.display='none'}));
 const oldTitle=document.title,title=target.dataset.reportTableTitle||'جدول المتابعة';
 document.title=reportName('المتابعة_'+title,true);
 let restored=false;const restore=()=>{if(restored)return;restored=true;hidden.forEach(([el,v])=>el.style.display=v);document.title=oldTitle;window.removeEventListener('afterprint',restore)};
 window.addEventListener('afterprint',restore,{once:true});
 try{printCurrent()}catch(e){console.error(e);restore()}
 setTimeout(restore,8000);
}
function renderReportsCenterShell(){
 const filterBar=$('#filterBar');if(filterBar)filterBar.style.display='none';
 $('#pageHost').innerHTML='';
}
function renderReports(){
 const reportHub=document.querySelector('#vdReportHub');if(reportHub)reportHub.remove();
 const filterBar=$('#filterBar');if(filterBar)filterBar.style.display='none';
 const r=state.data?.sheetReports;
 if(!r){$('#pageHost').innerHTML='<div class="empty"><b>تعذر تحميل تقارير ورقة reports</b><span>أعد تحديث البيانات المباشرة.</span></div>';return;}
 const projectCount=reportGrandValue(r.projectsByOwner,1),permitCount=reportGrandValue(r.permitsByYear,1),permitMeters=reportGrandValue(r.permitsByYear,2),permitProjectCount=reportGrandValue(r.permitsByContractor,1),lineCount=reportGrandValue(r.linesByYear,2),lineMeters=reportGrandValue(r.linesByYear,3),audit=r.audit||{};
 const warning=audit.countMismatch?'<div class="sheet-report-warning"><b>ملاحظة تدقيق على Pivot الحي</b><span>إجمالي COUNTA الظاهر في البايفت = '+esc(audit.districtPivotGrandCount||'—')+'، منها '+esc(audit.blankDistrictCount||'—')+' تحت حي فارغ، بينما عدد سجلات الخطوط البديلة الفعلية = '+esc(audit.actualAlternativeLineRows||'—')+'. تم الإبقاء على أرقام الشيت كما هي مع إظهار التنبيه.</span></div>':'';
 const permitWarning=permitCount&&permitProjectCount&&permitCount!==permitProjectCount?'<div class="sheet-report-warning"><b>اختلاف طريقة عد التصاريح</b><span>تقرير السنوات يستخدم COUNTA لصفوف التصاريح الفعلية = '+esc(permitCount)+'، بينما تقارير المقاول/المالك تستخدم SUM لحقل «عدد تصاريح المشروع / عدد مرات التمديد» = '+esc(permitProjectCount)+'. الأمتار تُقرأ من نفس منطق الشيت، لذلك لا يتم توحيد الرقمين قسرًا.</span></div>':'';
 $('#pageHost').innerHTML='<section class="sheet-report-hero"><div><small>GOOGLE SHEETS • reports</small><h3>المتابعة</h3><p>النتائج تُقرأ مباشرة من ورقة <b>reports</b> بعد تنفيذ Google Sheets للـ Pivot Tables والمعادلات؛ لا يتم إعادة احتسابها بمنطق بديل داخل المتصفح.</p></div><div class="sheet-report-actions"><button type="button" data-report-anchor="projects">المشاريع</button><button type="button" data-report-anchor="permits">التصاريح</button><button type="button" data-report-anchor="lines">الخطوط البديلة</button><button type="button" data-report-anchor="contractors">تسويات المقاولين</button><button type="button" id="printSheetReports">تصدير PDF</button></div></section>'+warning+permitWarning+
 '<div class="kpi-grid sheet-report-kpis">'+kpi('عدد البايفتات',r.pivotCount||15,'مكتشفة في ورقة reports')+kpi('مشاريع الضخ',projectCount||'—','Grand Total من Pivot الملاك')+kpi('التصاريح',permitCount||'—',(permitMeters||'—')+' متر مستحق')+kpi('الخطوط البديلة',lineCount||'—',(lineMeters||'—')+' متر')+'</div>'+
 '<section class="sheet-report-section" id="sheet-report-projects"><div class="sheet-report-section-head"><div><small>01</small><h3>تقارير المشاريع</h3></div><p>نفس Pivot عدد مشاريع الضخ حسب الجهة المالكة.</p></div>'+sheetReportTable('عدد مشاريع الضخ للجهة المالكة',r.projectsByOwner,'Pivot: الجهة المالكة ← COUNTA اسم المشروع','projects-owner')+'</section>'+
 '<section class="sheet-report-section" id="sheet-report-permits"><div class="sheet-report-section-head"><div><small>02</small><h3>تقارير التصاريح</h3></div><p>عدد التصاريح، الأمتار المستحقة، والتجميع حسب السنة/المقاول/الجهة المالكة.</p></div><div class="sheet-report-grid">'+sheetReportTable('عدد وأطوال التصاريح بكل عام',r.permitsByYear,'COUNTA التصاريح + SUM الأمتار المستحقة','permits-year')+sheetReportTable('الأمتار المستحقة حسب المقاول',r.permitsByContractor,'SUM عدد تصاريح المشروع/عدد مرات التمديد + SUM الأمتار — جميع الملاك','permits-contractor')+sheetReportTable('الأمتار المستحقة حسب الجهة المالكة',r.permitsByOwner,'SUM عدد تصاريح المشروع/عدد مرات التمديد + SUM الأمتار — جميع المقاولين','permits-owner')+'</div></section>'+
 '<section class="sheet-report-section" id="sheet-report-lines"><div class="sheet-report-section-head"><div><small>03</small><h3>تقارير الخطوط البديلة</h3></div><p>نفس Pivot السنة والمقاول والمالك والحي مع عدد الخطوط ومجموع الأطوال.</p></div><div class="sheet-report-grid">'+sheetReportTable('عدد وأطوال الخطوط البديلة بكل عام',r.linesByYear,'السنة ← نوع الخط ← العدد والطول','lines-year')+sheetReportTable('الخطوط البديلة حسب المقاول',r.linesByContractor,'المقاول ← نوع الخط','lines-contractor')+sheetReportTable('الخطوط البديلة حسب المالك',r.linesByOwner,'المالك ← نوع الخط','lines-owner')+sheetReportTable('الخطوط البديلة حسب الحي',r.linesByDistrict,'مطابق لـ Pivot DG3:DI','lines-district')+'</div></section>'+
 '<section class="sheet-report-section" id="sheet-report-contractors"><div class="sheet-report-section-head"><div><small>04</small><h3>تقارير تسوية المقاولين</h3></div><p>منطق الشيت: مطابقة المالك والمقاول، جلب إجمالي الأمتار المستحقة من vd projects، وجلب إجمالي أطوال الخطوط من Alternative lines، ثم الفرق والخصم/الإضافة والتصنيف: عليه أمتار / له أمتار / مستوفي الأمتار.</p></div><div class="sheet-contractor-stack">'+(r.contractors||[]).map(contractorSheetReport).join('')+'</div></section>';
 $$('[data-report-anchor]','#pageHost').forEach(b=>b.addEventListener('click',()=>document.getElementById('sheet-report-'+b.dataset.reportAnchor)?.scrollIntoView({behavior:'smooth',block:'start'})));
 $('#printSheetReports')?.addEventListener('click',printCurrent);
 $$('[data-export-sheet-table]','#pageHost').forEach(b=>b.addEventListener('click',()=>exportFollowupTablePdf(b)));
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
 if(window.VDReportNaming){const raw=String(type||''),pageTitle=PAGE_META[state.page]?.title||'',reportType=(!raw||raw===pageTitle)?window.VDReportNaming.type(state.page):raw.replace(/\s+/g,'_');return window.VDReportNaming.build({key:state.page,type:reportType,scope:forceFiltered?'Filtered':''});}
 const d=new Date(),pad=x=>String(x).padStart(2,'0'),stamp=d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())+'_'+pad(d.getHours())+'-'+pad(d.getMinutes())+'-'+pad(d.getSeconds()),scope=(forceFiltered||activeFilterCount())?'Filtered':'General';
 return 'VD_UrgentSolutions_'+String(type).replace(/\s+/g,'_')+'_'+scope+'_'+stamp;
}
function printCurrent(){
 if(window.VDReportExport?.print)return window.VDReportExport.print();
 const old=document.title,meta=PAGE_META[state.page]||PAGE_META.master,now=new Date(),title=reportName(meta.title||state.page);
 const titleEl=$('#printMetaTitle'),timeEl=$('#printMetaTime');
 if(titleEl)titleEl.textContent='إدارة الحلول العاجلة • '+meta.title;
 if(timeEl)timeEl.textContent=now.toLocaleString('ar-SA',{dateStyle:'medium',timeStyle:'short'});
 document.title=title;window.print();setTimeout(()=>document.title=old,500);
}

function renderPage(){
 const pageAtRender=state.page,started=performance.now();
 document.body.dataset.vdPage=pageAtRender;
 document.body.classList.remove('map-fullscreen-open');
 destroyCharts();if(state.map){try{state.map.remove()}catch(e){}state.map=null}const meta=PAGE_META[pageAtRender]||PAGE_META.master;
 $('#pageTitle').textContent=meta.title;$('#pageSubtitle').textContent=meta.sub;$('#heroIcon').textContent=meta.icon;$('#heroEyebrow').textContent=meta.eye+' • URGENT SOLUTIONS';
 renderFilters();
 const fn={master:renderMasterV2,projects:renderProjectsV2,map:renderMap,permits:renderPermitsV2,lines:renderLinesV2,settlements:renderSettlementsV2,guarantees:renderGuaranteesV2,complaints:renderComplaintsV2,execution:renderExecutionV2,parties:renderPartiesV2,municipalities:renderMunicipalities,traceability:renderTraceability,risks:renderRisks,quality:renderQuality,analytics:renderAnalyticsV2,smartCenter:renderSmartShell,temporalMemory:renderSmartShell,investigationRoom:renderSmartShell,explainableDecision:renderSmartShell,smartThursday:renderSmartShell,followup:renderReports,reports:renderReportsCenterShell,excelExport:renderExcelExport}[pageAtRender]||renderMasterV2;
 try{
  fn();
 }catch(e){
  console.error('[VD] page render failed:',pageAtRender,e);
  const host=$('#pageHost');
  if(host)host.innerHTML='<div class="empty"><b>تعذر فتح هذه الشاشة</b><span>'+esc(e?.message||'RENDER_ERROR')+'</span></div>';
 }
 window.__urgentCurrentPage=pageAtRender;
 requestAnimationFrame(()=>{
  if(state.page!==pageAtRender)return;
  const safe=(label,work)=>{try{work()}catch(e){console.error('[VD] '+label+' failed:',pageAtRender,e)}};
  safe('table search',wireTableSearch);
  safe('interactive cards',wireInteractiveCards);
  safe('info decoration',decorateInfo);
  safe('filter summary',renderFilterSummary);
  safe('count up',()=>{if(window.VDCountUp)window.VDCountUp.refresh();else animateCounts()});
  window.dispatchEvent(new CustomEvent('vd:urgent-page',{detail:{page:pageAtRender,data:state.data}}));
  window.dispatchEvent(new CustomEvent('vd:page-rendered',{detail:{page:pageAtRender,data:state.data}}));
  console.debug('[VD] rendered',pageAtRender,Math.round(performance.now()-started)+'ms');
 });
}
function canAccess(item){
 const p=state.user?.permissions||[];if(!p.length||p.includes('*'))return true;
 const key=item.dataset.page,label=clean($('b',item)?.textContent);
 const aliases={
  excelExport:['تصدير تقرير Excel','تقارير الاكسيل','excelExport'],
  smartCenter:['مركز التحليل الذكي','التحليل الذكي و التقارير','analytics','risks'],
  temporalMemory:['ذاكرة المشروع الزمنية','التحليل الذكي و التقارير'],
  investigationRoom:['غرفة التحقيق الذكية','غرفة التدقيق الذكية','التحليل الذكي و التقارير'],
  explainableDecision:['محرك القرار المفسر','مختبر القرار المتغير','التحليل الذكي و التقارير'],
  smartThursday:['تقرير الخميس الذكي','التقرير الهندسي الذكي','التحليل الذكي و التقارير']
 };
 const wanted=[key,label,...(aliases[key]||[])].map(norm);
 return p.some(x=>wanted.includes(norm(x)));
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
  state.data=j;state.filterOptionsCache.clear();window.__urgentDashboardData=j;window.dispatchEvent(new CustomEvent('vd:urgent-data',{detail:j}));$('#updatedAt').textContent=new Date(j.updatedAt).toLocaleString('ar-SA',{dateStyle:'short',timeStyle:'short'});renderPage();toast(force?'تم تحديث البيانات':'تم تحميل البيانات');
 }catch(e){console.error(e);$('#pageHost').innerHTML='<div class="empty"><b>تعذر تحميل البيانات</b><span>'+esc(e.message)+'</span></div>';toast('تعذر الاتصال بمصدر البيانات')}
 finally{if(btn)btn.disabled=false;$('#boot').classList.add('hide')}
}
async function boot(){
 try{
  const r=await fetch('/api/auth/me',{cache:'no-store'});if(!r.ok)return location.replace('/login');const j=await r.json();state.user=j.user;
  window.dispatchEvent(new CustomEvent('vd:user-ready',{detail:state.user}));
  $('#userName').textContent=state.user.name||state.user.username;$('#userRole').textContent=state.user.role||'';
  if(state.user.image){const photo=$('#userPhoto');photo.hidden=false;photo.onerror=()=>{photo.hidden=true;photo.removeAttribute('src')};photo.src='/api/auth/photo?v='+Date.now()}
  applyPermissions();
  await loadData(false);
 }catch(e){location.replace('/login')}
}
$$('.nav-item').forEach(item=>item.addEventListener('click',()=>openPage(item.dataset.page)));
$$('.nav-group-head').forEach(h=>h.addEventListener('click',()=>{const g=h.closest('.nav-group'),willOpen=!g.classList.contains('is-open');$$('.nav-group').forEach(x=>x.classList.remove('is-open'));if(willOpen){g.classList.add('is-open');requestAnimationFrame(()=>g.scrollIntoView({block:'nearest',behavior:'smooth'}))}}));
$('#navSearch').addEventListener('input',e=>{const q=norm(e.target.value);$$('.nav-item').forEach(x=>x.classList.toggle('search-hidden',!!q&&!norm(x.textContent).includes(q)));$$('.nav-group').forEach(g=>{if(q&&$$('.nav-item:not(.search-hidden)',g).length)g.classList.add('is-open')})});
$('#navClear').addEventListener('click',()=>{$('#navSearch').value='';$('#navSearch').dispatchEvent(new Event('input'))});
$('#sidebarToggle').addEventListener('click',()=>{document.body.classList.toggle('sidebar-collapsed');localStorage.setItem('vd.urgent.sidebar.collapsed',document.body.classList.contains('sidebar-collapsed')?'1':'0')});
if(localStorage.getItem('vd.urgent.sidebar.collapsed')==='1')document.body.classList.add('sidebar-collapsed');
$('#refreshBtn').addEventListener('click',()=>loadData(true));
$('#clearFiltersBtn').addEventListener('click',clearAllFilters);
$('#previewReportBtn')?.addEventListener('click',()=>window.VDReportExport?.preview?.());
$('#printBtn').addEventListener('click',printCurrent);
$('#periodFrom')?.addEventListener('change',e=>{const st=periodState();st.from=e.target.value||'';if(st.from&&st.to&&st.from>st.to){const x=st.from;st.from=st.to;st.to=x}st.preset='custom';renderPage()});
$('#periodTo')?.addEventListener('change',e=>{const st=periodState();st.to=e.target.value||'';if(st.from&&st.to&&st.from>st.to){const x=st.from;st.from=st.to;st.to=x}st.preset='custom';renderPage()});
$$('.vd-period-presets [data-period]').forEach(btn=>btn.addEventListener('click',()=>setPeriodPreset(btn.dataset.period)));
$('#logoutBtn').addEventListener('click',async()=>{await fetch('/api/auth/logout',{method:'POST'});location.replace('/login')});
$('#vdInfoClose')?.addEventListener('click',closeInfo);
$('#vdInfoModal')?.addEventListener('click',e=>{if(e.target.id==='vdInfoModal')closeInfo()});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeInfo()});
$('#themeBtn').addEventListener('click',()=>{state.theme=(state.theme+1)%3;document.body.classList.remove('theme-soft','theme-sand');if(state.theme===1)document.body.classList.add('theme-soft');if(state.theme===2)document.body.classList.add('theme-sand');localStorage.setItem('vd.urgent.theme',String(state.theme))});
state.theme=Number(localStorage.getItem('vd.urgent.theme')||0)%3;if(state.theme===1)document.body.classList.add('theme-soft');if(state.theme===2)document.body.classList.add('theme-sand');
window.VDUrgent={getState:()=>state,openPage,renderPage,loadData,printCurrent,activeFilterCount,filterRows:(rows)=>commonFiltered(rows||[]),PAGE_META,FILTERS,toast,reportName,showInfo:(title,body)=>{const modal=document.getElementById('vdInfoModal'),t=document.getElementById('vdInfoTitle'),b=document.getElementById('vdInfoBody');if(t)t.textContent=title||'تفاصيل الاحتساب';if(b)b.innerHTML='<div style="white-space:pre-wrap;line-height:1.9">'+esc(body||PAGE_SOURCES[state.page]||'يعتمد على البيانات المفلترة الحالية ومصادر Google Sheets المرتبطة.')+'</div>';if(modal){modal.classList.add('show');modal.setAttribute('aria-hidden','false')}}};
boot();
})();
