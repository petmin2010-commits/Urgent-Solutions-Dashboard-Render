(()=>{
'use strict';
const STORAGE_KEY='vd_urgent_language';
const PAIRS=[
['المتابعة التشغيلية','Operational Monitoring'],['المتابعة الادارية','Administrative Monitoring'],['التحليل الذكي و التقارير','Smart Analytics & Reports'],
['ألوان الواجهة','Interface Colors'],['بحث في الصفحة الحالية...','Search current page...'],['المحلل الذكي','Smart Analyst'],['Project 360°','Project 360°'],['عرض المشروع عبر المشاريع والتصاريح والخطوط والتصميم والتنفيذ','View the project across projects, permits, lines, design and execution'],['QR — الرابط الحالي','QR — Current Link'],['مشاركة الصفحة الحالية بسرعة','Quickly share the current page'],
['الرئيسية','Dashboard'],['المشاريع','Projects'],['الخريطة الجغرافية','Geographic Map'],['التصاريح','Permits'],['الخطوط البديلة والتصميم','Alternative Lines & Design'],
['الأمتار والتسويات','Meter Settlements'],['الضمانات','Guarantees'],['الشكاوى','Complaints'],['التنفيذ والتسليم','Execution & Handover'],
['المقاولون والملاك','Contractors & Owners'],['تحليل البلديات','Municipality Analytics'],['التتبع الشامل','End-to-End Traceability'],['مخاطر المشاريع','Project Risks'],['جودة البيانات','Data Quality'],['التحليل التنفيذي','Executive Analytics'],['مركز التقارير','Report Center'],['تصدير تقرير Excel','Export Excel Report'],
['إدارة الحلول العاجلة','Urgent Solutions Management'],['أبعاد الرؤية للاستشارات الهندسية','Vision Dimensions Engineering Consultancy'],
['تحديث البيانات','Refresh Data'],['تغيير مظهر الصفحة','Change Theme'],['تصدير التقرير PDF','Export PDF Report'],['تسجيل الخروج','Sign Out'],['آخر تحديث','Last Update'],
['الفلاتر التفاعلية','Interactive Filters'],['تطبق على الكروت والشارتات والجداول • ويمكن الفلترة بالضغط على الكروت والشارتات','Filters apply to cards, charts and tables • click cards or charts to filter'],
['إعادة تعيين','Reset'],['لا توجد فلاتر نشطة','No active filters'],['لا توجد قيم','No values'],['تحديد الكل','Select All'],['إلغاء الكل','Clear All'],
['الكل','All'],['نتيجة','results'],['بحث داخل','Search in'],['بحث داخل الجدول...','Search table...'],['ابحث عن شاشة...','Search screens...'],
['البلدية','Municipality'],['المقاول','Contractor'],['المالك','Owner'],['نوع المشروع','Project Type'],['حالة العقد','Contract Status'],['حالة التصريح','Permit Status'],['حالة الضمان','Guarantee Status'],
['السنة','Year'],['المصمم','Designer'],['نوع الخط','Line Type'],['حالة التصميم','Design Status'],['سنة التكليف','Assignment Year'],['حالة التسوية','Settlement Status'],
['حالة الشكوى','Complaint Status'],['حالة التنفيذ','Execution Status'],['الأهمية','Severity'],['التصنيف','Category'],['المصدر','Source'],
['المشاريع','Projects'],['التصاريح الفعلية','Actual Permits'],['أمتار التصاريح','Permit Meters'],['الخطوط البديلة','Alternative Lines'],['أطوال الخطوط','Line Lengths'],
['تغطية الأمتار','Meter Coverage'],['فجوة الأمتار','Meter Gap'],['تحت الإصدار','Under Issuance'],['تصاريح أوشكت','Permits Near Expiry'],['تحتاج متابعة','Needs Follow-up'],
['إجمالي المشاريع','Total Projects'],['مشاريع ملغاة','Cancelled Projects'],['إجمالي الأمتار','Total Meters'],['سارية','Valid'],['أوشكت','Near Expiry'],['منتهية','Expired'],
['تاريخ غير قابل للقراءة','Unreadable Date'],['الخطوط المسجلة','Registered Lines'],['إجمالي الأطوال','Total Length'],['معتمد PMO','PMO Approved'],['قيد التصميم/الاعتماد','Under Design / Approval'],
['علاقات التسوية','Settlement Relations'],['عليه أمتار','Meters Owed'],['له أمتار','Meters in Credit'],['مستوفي الأمتار','Meters Settled'],
['ضمان منتهي','Expired Guarantee'],['أوشك على الانتهاء','Near Expiry'],['بانتظار إصدار','Awaiting Issuance'],['إجمالي الشكاوى','Total Complaints'],['بحالة مسجلة','Status Recorded'],['بدون حالة','No Status'],
['الخطوط','Lines'],['حالة تنفيذ مسجلة','Execution Status Recorded'],['منجز/مكتمل','Completed'],['بدون حالة تنفيذ','No Execution Status'],
['المقاولون','Contractors'],['الملاك','Owners'],['إجمالي الملاحظات','Total Findings'],['مرتفعة','High'],['متوسطة','Medium'],['منخفضة','Low'],
['مشاريع بالنطاق','Projects in Scope'],['تصاريح فعلية','Actual Permits'],['تسويات غير متوازنة','Unbalanced Settlements'],['تصاميم تحتاج متابعة','Designs Requiring Follow-up'],['ضمانات حرجة','Critical Guarantees'],
['حالة التصاريح','Permit Status'],['أنواع الخطوط البديلة','Alternative Line Types'],['حالة التصميم والاعتماد','Design & Approval Status'],['حالة الضمانات والتعهدات','Guarantees & Undertakings'],
['التصاريح حسب السنة','Permits by Year'],['المشاريع حسب البلدية','Projects by Municipality'],['حالة العقود','Contract Status'],['التوزيع حسب البلدية','Distribution by Municipality'],
['أعلى المقاولين بعدد التصاريح','Top Contractors by Permits'],['أعلى الملاك بالأمتار','Top Owners by Meters'],['أنواع الخطوط','Line Types'],['أطوال الخطوط حسب المقاول','Line Length by Contractor'],
['الخطوط حسب المصمم','Lines by Designer'],['حالة التسويات','Settlement Status'],['صافي الرصيد حسب المقاول','Net Balance by Contractor'],['حالة الضمانات','Guarantee Status'],
['الحالات حسب المقاول','Status by Contractor'],['حالة الشكاوى','Complaint Status'],['التنفيذ حسب نوع الخط','Execution by Line Type'],['المقاولون حسب أمتار التصاريح','Contractors by Permit Meters'],
['الملاك حسب الأمتار المستحقة','Owners by Due Meters'],['الملاحظات حسب التصنيف','Findings by Category'],['الملاحظات حسب المصدر','Findings by Source'],
['الأمتار: مستحق مقابل خطوط بديلة','Meters: Due vs Alternative Lines'],['تركيز المشاريع حسب البلدية','Project Concentration by Municipality'],
['تنبيهات المتابعة الذكية','Smart Follow-up Alerts'],['تفاصيل المشاريع','Project Details'],['سجل التصاريح الفعلية','Actual Permit Register'],['تفاصيل الخطوط البديلة','Alternative Line Details'],
['تسويات الملاك والمقاولين','Owner / Contractor Settlements'],['سجل الضمانات','Guarantee Register'],['سجل الشكاوى','Complaints Register'],['التنفيذ والتسليم','Execution & Handover'],
['ملخص المقاولين','Contractor Summary'],['نتائج التدقيق الذكي','Smart Audit Results'],['المشروعات الظاهرة على الخريطة','Projects Shown on Map'],
['مواقع صحيحة','Valid Locations'],['بدون إحداثيات','Missing Coordinates'],['البلديات الممثلة','Municipalities Represented'],['المشاريع ضمن الفلاتر','Filtered Projects'],
['م','No.'],['اسم المشروع','Project Name'],['رقم/حالة التصريح','Permit No. / Status'],['الأمتار','Meters'],['رقم التصريح','Permit No.'],['البداية','Start'],['النهاية','End'],
['المدة','Duration'],['الحي','District'],['الشارع','Street'],['الاستشاري','Consultant'],['المرجع','Reference'],['الخط/الموقع','Line / Location'],['النوع','Type'],['الطول','Length'],['القطر','Diameter'],
['رقم الضمان/التعهد','Guarantee / Undertaking No.'],['الأيام المتبقية','Days Remaining'],['الشكوى','Complaint'],['الربط','Link'],['انتهاء التنفيذ','Execution Completion'],['تقرير الإتمام','Completion Report'],
['خطاب التسليم','Handover Letter'],['تاريخ التسليم','Handover Date'],['الرصيد النهائي','Final Balance'],['الأمتار المستحقة','Due Meters'],['الخطوط البديلة','Alternative Lines'],
['الصف','Row'],['الملاحظة','Finding'],['نوع التنبيه','Alert Type'],['التفاصيل','Details'],
['طريقة الاحتساب','Calculation Method'],['كيفية الاحتساب','Calculation Method'],['مصدر البيانات','Data Source'],['الحقل التفاعلي','Interactive Field'],['التفاعل','Interaction'],['تفاصيل الاحتساب','Calculation Details'],
['معاينة','Preview'],['تصدير PDF','Export PDF'],['تم فتح معاينة التقرير — استخدم زر تصدير التقرير PDF بالأعلى','Report preview opened — use the Export PDF button above'],
['اختر ورقة Google Sheets','Choose Google Sheets Tab'],['اختر الأعمدة','Choose Columns'],['فلاتر الأعمدة المختارة','Selected Column Filters'],['الافتراضي: جميع القيم محددة','Default: all values selected'],
['تحديد كل الأعمدة','Select All Columns'],['إلغاء تحديد الكل','Clear All Columns'],['تصدير ملف Excel بالقيم فقط','Export Values-Only Excel'],['جاري قراءة الورقة...','Loading sheet...'],['تحميل الأعمدة والقيم من Google Sheets','Loading columns and values from Google Sheets'],
['تعذر قراءة الورقة','Could not load sheet'],['اختر عمودًا واحدًا على الأقل','Select at least one column'],['لا توجد صفوف مطابقة للفلاتر الحالية','No rows match current filters'],
['ساري','Valid'],['ساري ممدد','Extended Valid'],['منتهي','Expired'],['تحت الاصدار','Under Issuance'],['تحت الإصدار','Under Issuance'],['مشروع ملغي','Cancelled Project'],
['بانتظار الضمان أو التعهد','Awaiting Guarantee / Undertaking'],['الضمان منتهي','Guarantee Expired'],['الضمان ساري','Guarantee Valid'],['الضمان أوشك على الانتهاء','Guarantee Near Expiry'],
['بانتظار إصدار الضمان أو التعهد','Awaiting Guarantee / Undertaking'],['يوجد تعهد','Undertaking Available'],['معتمد (PMO)','Approved (PMO)'],['حزمة مصممة من قبل ال PMO','PMO Design Package'],['جاري الاعتماد (PMO)','Under PMO Approval'],
['تصريف أمطار','Stormwater Drainage'],['تخفيض منسوب','Groundwater Lowering'],['لم يتم التكليف','Not Assigned'],['غير محدد','Unspecified'],['فارغ','Empty'],
['جاري تحميل بيانات الحلول العاجلة','Loading Urgent Solutions Data'],['يتم قراءة البيانات مباشرة من Google Sheets','Data is read directly from Google Sheets'],['تعذر تحميل البيانات','Failed to load data'],['تعذر الاتصال بمصدر البيانات','Could not connect to data source'],
['ملخص تنفيذي لحالة مشاريع الحلول العاجلة والتصاريح والخطوط البديلة.','Executive summary of urgent-solutions projects, permits and alternative lines.'],
['متابعة العقود والمشاريع والملاك والمقاولين وحالة التصاريح المرتبطة.','Track contracts, projects, owners, contractors and related permit status.'],
['عرض مواقع مشاريع الحلول العاجلة في جدة اعتمادًا على إحداثيات E وN المسجلة بالشيت.','Map urgent-solutions projects in Jeddah using E and N coordinates from the sheet.'],
['تحليل التصاريح الفعلية وتواريخها وأمتارها وحالات الانتهاء.','Analyze actual permits, dates, meters and expiry status.'],
['متابعة الخطوط البديلة وأطوالها والمصممين وحالة الاعتماد.','Track alternative lines, lengths, designers and approval status.'],
['مقارنة الأمتار المستحقة من التصاريح مع الخطوط البديلة المنفذة.','Compare permit meter obligations with alternative-line lengths.'],
['متابعة الضمانات والتعهدات وتواريخ الانتهاء والحالات الحرجة.','Track guarantees, undertakings, expiry dates and critical cases.'],
['متابعة سجل الشكاوى وربطها بالحلول والخطوط البديلة.','Track complaints and their linkage to solutions and alternative lines.'],
['متابعة حالة التنفيذ وتقارير الإتمام وخطابات التسليم.','Track execution status, completion reports and handover letters.'],
['تحليل أحجام الأعمال والعلاقات بين المقاولين والملاك.','Analyze work volumes and contractor-owner relationships.'],
['تدقيق ذكي للتعارضات والمراجع المفقودة والقيم غير الطبيعية.','Smart audit for conflicts, missing references and abnormal values.'],
['قراءة إدارية مركزة لأبرز مؤشرات الأداء والمخاطر التشغيلية.','Executive view of key performance indicators and operational risks.'],
['تصدير تقارير PDF وExcel بأسماء منظمة وفق الشاشة والفلاتر الحالية.','Export PDF and Excel reports with standardized names based on the current screen and filters.'],
['اختيار قاعدة البيانات والأعمدة والفلاتر ثم تصدير القيم النهائية فقط.','Choose source, columns and filters, then export final values only.']
];
const AR_EN=new Map(PAIRS),EN_AR=new Map();PAIRS.forEach(([a,e])=>{if(!EN_AR.has(e))EN_AR.set(e,a)});
const arKeys=[...AR_EN.keys()].sort((a,b)=>b.length-a.length),enKeys=[...EN_AR.keys()].sort((a,b)=>b.length-a.length);
const originalText=new WeakMap(),originalAttrs=new WeakMap();let language=localStorage.getItem(STORAGE_KEY)==='en'?'en':'ar',queued=false;
const hasArabic=v=>/[\u0600-\u06FF]/.test(String(v||''));
function translateString(value,lang=language,allowPhrase=true){
 const raw=String(value??''),trimmed=raw.trim();if(!trimmed)return raw;
 const direct=lang==='en'?AR_EN.get(trimmed):EN_AR.get(trimmed);if(direct)return raw.replace(trimmed,direct);
 if(!allowPhrase)return raw;let out=raw;const keys=lang==='en'?arKeys:enKeys,dict=lang==='en'?AR_EN:EN_AR;
 for(const key of keys){if(out.includes(key))out=out.split(key).join(dict.get(key))}
 return out;
}
function freeText(node){return !!node.parentElement?.closest('textarea,pre,code,td,.raw-text,.free-text')}
function translateTextNode(node,lang){
 if(node.nodeType!==Node.TEXT_NODE)return;const cur=node.nodeValue||'';if(!cur.trim())return;
 if(lang==='ar'){const o=originalText.get(node);if(o!==undefined)node.nodeValue=o;return}
 if(hasArabic(cur))originalText.set(node,cur);const source=hasArabic(cur)?cur:(originalText.get(node)??cur),t=translateString(source,'en',!freeText(node));if(t!==cur)node.nodeValue=t;
}
function attrStore(el){let s=originalAttrs.get(el);if(!s){s=new Map();originalAttrs.set(el,s)}return s}
function translateAttrs(el,lang){
 const attrs=['placeholder','title','aria-label','data-empty-text'],store=attrStore(el);
 attrs.forEach(name=>{if(!el.hasAttribute?.(name))return;const cur=el.getAttribute(name)||'';if(lang==='ar'){if(store.has(name))el.setAttribute(name,store.get(name));return}
  if(hasArabic(cur))store.set(name,cur);const source=hasArabic(cur)?cur:(store.get(name)??cur),t=translateString(source,'en',true);if(t!==cur)el.setAttribute(name,t);
 });
}
function walk(root,lang=language){
 const base=root?.nodeType===Node.DOCUMENT_NODE?root.documentElement:root;if(!base)return;
 if(base.nodeType===Node.ELEMENT_NODE)translateAttrs(base,lang);const doc=base.ownerDocument||(root.nodeType===Node.DOCUMENT_NODE?root:document),w=doc.createTreeWalker(base,NodeFilter.SHOW_ELEMENT|NodeFilter.SHOW_TEXT);
 let node=w.currentNode;while(node){if(node.nodeType===Node.TEXT_NODE)translateTextNode(node,lang);else if(node.nodeType===Node.ELEMENT_NODE)translateAttrs(node,lang);node=w.nextNode()}
}
function translateCharts(lang=language){
 if(!window.Chart?.instances)return;
 Object.values(Chart.instances).forEach(chart=>{try{
  if(Array.isArray(chart.data?.labels))chart.data.labels=chart.data.labels.map(v=>typeof v==='string'?translateString(v,lang,true):v);
  (chart.data?.datasets||[]).forEach(ds=>{if(typeof ds.label==='string')ds.label=translateString(ds.label,lang,true)});
  chart.update?.('none');
 }catch(e){}});
}
function direction(lang){document.documentElement.lang=lang;document.documentElement.dir=lang==='en'?'ltr':'rtl';document.body?.classList.toggle('vd-lang-en',lang==='en')}
function updateControl(){
 const label=document.getElementById('vdLanguageLabel');if(label)label.textContent=language==='en'?'English':'العربية';
 document.querySelectorAll('[data-vd-lang]').forEach(b=>{b.classList.toggle('active',b.dataset.vdLang===language);b.setAttribute('aria-pressed',b.dataset.vdLang===language?'true':'false')});
}
function apply(lang,persist=true){language=lang==='en'?'en':'ar';if(persist)localStorage.setItem(STORAGE_KEY,language);direction(language);walk(document,language);translateCharts(language);updateControl();window.dispatchEvent(new CustomEvent('vd:languagechange',{detail:{language}}))}
function inject(){
 if(document.getElementById('vdLanguageWrap'))return;const host=document.querySelector('.top-actions');if(!host)return;
 const wrap=document.createElement('div');wrap.id='vdLanguageWrap';wrap.className='vd-language-wrap';wrap.innerHTML='<button id="vdLanguageButton" class="vd-language-button" type="button" aria-haspopup="menu"><span>🌐</span><span id="vdLanguageLabel">العربية</span><span>⌄</span></button><div id="vdLanguageMenu" class="vd-language-menu" hidden><button type="button" data-vd-lang="ar">العربية <span>AR</span></button><button type="button" data-vd-lang="en">English <span>EN</span></button></div>';host.appendChild(wrap);
 const button=wrap.querySelector('#vdLanguageButton'),menu=wrap.querySelector('#vdLanguageMenu');button.onclick=e=>{e.stopPropagation();menu.hidden=!menu.hidden};menu.onclick=e=>{const item=e.target.closest('[data-vd-lang]');if(!item)return;apply(item.dataset.vdLang,true);menu.hidden=true};document.addEventListener('click',e=>{if(!wrap.contains(e.target))menu.hidden=true});
}
function injectStyle(){
 const s=document.createElement('style');s.textContent='.vd-language-wrap{position:relative;display:inline-flex}.vd-language-button{height:38px;display:flex;align-items:center;gap:6px;padding:0 10px;border:1px solid var(--line);border-radius:12px;background:#fff;color:var(--green);font:700 9px Cairo;cursor:pointer}.vd-language-menu{position:absolute;top:44px;inset-inline-end:0;z-index:10050;width:145px;padding:6px;border:1px solid var(--line);border-radius:13px;background:#fff;box-shadow:0 15px 35px rgba(4,45,65,.18)}.vd-language-menu[hidden]{display:none!important}.vd-language-menu button{width:100%;display:flex;justify-content:space-between;border:0;background:transparent;padding:8px;border-radius:8px;font:700 9px Cairo;cursor:pointer;color:#234b5c}.vd-language-menu button.active,.vd-language-menu button:hover{background:#eaf7fb;color:#075f89}html[dir="ltr"] .nav-item,html[dir="ltr"] .nav-group-head,html[dir="ltr"] th,html[dir="ltr"] td{text-align:left}html[dir="ltr"] input,html[dir="ltr"] select{direction:ltr;text-align:left}@media print{.vd-language-wrap{display:none!important}}';document.head.appendChild(s);
}
const pendingRoots=new Set();
const obs=new MutationObserver(mutations=>{
 // The application renders Arabic natively. Re-walking the entire document for
 // every DOM mutation (especially count-up frames) can lock the UI after a tab click.
 if(language!=='en')return;
 for(const mutation of mutations){
  if(mutation.type==='childList'){
   mutation.addedNodes.forEach(node=>{
    const root=node.nodeType===Node.ELEMENT_NODE?node:node.parentElement;
    if(root)pendingRoots.add(root);
   });
  }else{
   const root=mutation.target?.nodeType===Node.ELEMENT_NODE?mutation.target:mutation.target?.parentElement;
   if(root)pendingRoots.add(root);
  }
 }
 if(queued)return;
 queued=true;
 requestAnimationFrame(()=>{
  queued=false;
  const roots=[...pendingRoots];pendingRoots.clear();
  roots.forEach(root=>walk(root,'en'));
  if(roots.length)translateCharts('en');
 });
});
function boot(){injectStyle();inject();apply(language,false);obs.observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['placeholder','title','aria-label']})}
window.VDUrgentI18n={setLanguage:l=>apply(l,true),getLanguage:()=>language,t:(v,l=language)=>translateString(v,l,true)};
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',boot,{once:true}):boot();
})();