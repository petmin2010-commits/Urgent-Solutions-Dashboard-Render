(()=>{'use strict';
/* Calculation explainer, scoped exclusively to Urgent Solutions. Descriptions follow the
   server.js and public/app.js formulas; no KPI values or data sources are modified. */
const clean=v=>String(v==null?'':v).replace(/\s+/g,' ').trim();
const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=v=>Number(v)||0;
const fmt=v=>new Intl.NumberFormat('en-US',{maximumFractionDigits:1}).format(num(v));
const sum=(rows,k)=>(rows||[]).reduce((s,r)=>s+num(r[k]),0);
const pct=(a,b)=>b?Math.round(a/b*1000)/10:0;
const source={
 master:'vd projects (المشاريع) + info. new (التصاريح المؤرخة) + Alternative lines (الخطوط البديلة)',
 projects:'vd projects',map:'vd projects + Alternative lines؛ رابط KMZ من عمود AL',
 permits:'info. new (أرقام التصاريح والمواعيد والأمتار) مع ربط بيانات المشروع من vd projects',
 lines:'Alternative lines',settlements:'vd projects (الأمتار المستحقة) + Alternative lines (الأطوال)، مع مطابقة المالك والمقاول',
 guarantees:'vd projects (الضمانات والتعهدات)',complaints:'info. new (الشكاوى)',
 execution:'Alternative lines (التنفيذ والتسليم)',parties:'vd projects + Alternative lines',
 municipalities:'تجميع مشتق من vd projects + Alternative lines',traceability:'ربط مشتق من vd projects + Alternative lines',
 quality:'vd projects + info. new + Alternative lines؛ قواعد التدقيق المحلية وفحوص الخادم',
 risks:'vd projects؛ درجة مخاطر مشتقة من التصريح والضمان والتسويات والعقد والموقع والتمديدات',
 analytics:'vd projects + info. new + Alternative lines + التسويات المطابقة',
 smartCenter:'نفس مصادر التشغيل، مع Dashboard History للذاكرة الزمنية',temporalMemory:'Dashboard History (المركزي) أو لقطات محلية احتياطية',
 investigationRoom:'المشاريع + التصاريح + التسويات + الضمانات + جودة البيانات + الخطوط',
 explainableDecision:'مصادر التشغيل؛ درجة أولوية تفسيرية تحسب محليًا في smart-center.js',
 smartThursday:'المصادر الحية + لقطات يوم الخميس المحفوظة في VD Thursday Progress',
 followup:'ورقة reports؛ نتائج Pivot والعمليات المعروضة كما يقرأها الخادم، دون إعادة حسابها في الواجهة',
 reports:'تقارير PDF مشتقة من العناصر الحالية',excelExport:'قيم الأعمدة المختارة من أوراق Google Sheets الأصلية'
};
const P='عدد سجلات المشاريع الداخلة بعد الفلاتر: COUNT(projects)؛ يعد كل سجل مشروع مرة واحدة، وليس كل تصريح مشروعًا مستقلًا.';
const PE='عدد التصاريح الفعلية: COUNT(actualPermits)؛ يستبعد السجل دون تاريخ بداية أو نهاية، وتستبعد حالات تحت الإصدار والمشروع الملغي من مجموعة التصاريح المؤرخة.';
const LI='عدد سجلات الخطوط البديلة: COUNT(lines) بعد الفلاتر؛ كل سجل يمثل خطًا مستقلًا.';
const GROSS='التغطية الإجمالية (%) = ROUND((Σ طول الخطوط البديلة length ÷ Σ أمتار التصاريح الفعلية meters) × 100, 1). إذا كان المقام صفرًا تعرض 0. قد تتجاوز 100% ولا تدل بذاتها على تنفيذ مشروع بعينه.';
const MAP_PROJECT_COVERAGE='تغطية خريطة المشاريع (%) = ROUND((عدد مشاريع vd projects ذات إحداثيات صحيحة ÷ إجمالي المشاريع ضمن الفلاتر الحالية) ×100, 1). تُقرأ الإحداثيات من Z وAA وتصحح عند تبادل ترتيب خط العرض والطول. الصالح: 20 < lat < 23 و38 < lon < 41، كلاهما رقم محدود. تُستبعد الإحداثيات الفارغة والخارجة عن الحدود من البسط، وتبقى في المقام. عند عدم وجود مشاريع تعرض 0%.';
const MAP_LINE_COVERAGE='تغطية خريطة الخطوط البديلة (%) = ROUND((عدد سجلات Alternative lines ذات إحداثيات صحيحة ÷ إجمالي سجلات الخطوط البديلة ضمن الفلاتر الحالية) ×100, 1). تُقرأ الإحداثيات من G وH وتصحح عند تبادل ترتيب خط العرض والطول. الصالح: 20 < lat < 23 و38 < lon < 41، كلاهما رقم محدود. تُستبعد الإحداثيات الفارغة والخارجة عن الحدود من البسط، وتبقى في المقام؛ لا تدخل المشاريع أو ملفات KMZ في الحساب. عند عدم وجود خطوط تعرض 0%.';
const MATCH='التغطية المطابقة (%) = ROUND((Σ executedMeters ÷ Σ dueMeters) × 100, 1) لعلاقات التسوية المجمعة بمفتاح (المالك + المقاول). المستحق من permitMeters في vd projects، والمنفذ هو Σ length من Alternative lines. تستبعد السجلات الناقصة لمفتاح المطابقة وفق منطق الخادم؛ المقام صفر يعرض 0.';
const GAP='الفجوة (متر) = Σ الأمتار المستحقة − Σ أطوال الخطوط المقابلة؛ القيمة الموجبة نقص، والصفر توازن، والسالبة زيادة في الخطوط. لا يتم إخفاء القيم السالبة.';
const RISK='مؤشر مخاطر المشروع في server.js: التصريح تحت الإصدار +15، منتهي +30، خلال 7 أيام +25، خلال 30 +18، خلال 60 +10، بيانات تصريح مفقودة +12؛ الضمان منتهي +25، أوشك/بانتظار +15، تعهد +4؛ نسبة التغطية المطابقة 0% +20، أقل من 50% +15، أقل من 80% +10، أقل من 100% +5؛ حالة العقد غير محددة أو متوقف +8؛ إحداثيات خارج نطاق جدة أو ناقصة +5؛ عدد التصاريح ≥10 +7، ≥5 +5، ≥2 +3. حد الدرجة 100، والتصنيف: حرج ≥60، مرتفع ≥40، متوسط ≥20، طبيعي أقل من 20. تطبق البنود الشرطية بترتيب if/else ولا تجمع مستويات البند الواحد.';
const DESIGN='مدة الاعتماد = تاريخ اعتماد التصميم − تاريخ رفعه بالأيام (مقربة لأقرب يوم). عمر التصميم الجاري = اليوم − تاريخ الرفع إذا لم يوجد تاريخ اعتماد، وبحد أدنى صفر؛ فرق الطول = طول التصميم − الطول الفعلي للخط مع التقريب إلى منزلتين.';
const PERMIT='أيام انتهاء التصريح = الفرق بالأيام بين تاريخ النهاية وبداية اليوم بتوقيت الرياض. التصنيف: أقل من 0 منتهي، 0–7 أيام، 8–30، 31–60، أكثر من 60، أو غير محدد إذا تعذر قراءة التاريخ.';
const GUARANTEE='يستخرج عدد الحالات من نص guaranteeStatus في vd projects؛ قد تتضمن الحالة ضمانًا أو تعهدًا. نوافذ الأيام: منتهي (≤0)، 0–14، 15–30، 31–60، >60، أو تعهد/بدون تاريخ، بحسب منطق شارت الضمانات.';
const FILTER='تُطبق قوائم الفلاتر متعددة الاختيار، والفلاتر الناتجة عن النقر على الكروت/الشارتات، ثم الفترة الزمنية وفق حقلها في كل شاشة. كل فئة «غير محدد» تمثل القيم الفارغة في التجميع. بعض الجداول مشتقة بربط أو تجميع ولا يجوز مقارنة مجموعاتها بعدد الصفوف الخام دون مراعاة مفتاح التجميع.';
const METRICS={
 master:{
  'المشاريع':P,'التصاريح الفعلية':PE,'أمتار التصاريح':'Σ meters لجميع التصاريح الفعلية المؤرخة في info. new؛ الأمتار بالمتر وليس بعدد التصاريح.',
  'الخطوط البديلة':LI,'أطوال الخطوط':'Σ length من Alternative lines بوحدة متر.',
  'التغطية الإجمالية':GROSS,'التغطية المطابقة':MATCH,
  'فجوة التسوية المطابقة':GAP+' هنا يستخدم dueMeters و executedMeters بعد المطابقة (المالك + المقاول).',
  'تغطية خريطة المشاريع':MAP_PROJECT_COVERAGE,
  'تغطية خريطة الخطوط البديلة':MAP_LINE_COVERAGE,
  'تصاميم معتمدة':'COUNT(lines WHERE designStatus يحتوي «معتمد» أو «حزمة مصممة»).',
  'تصاميم تحتاج مراجعة':'COUNT(حالة جاري/قيد بلا تاريخ اعتماد) + COUNT(حالة جاري/قيد مع تاريخ اعتماد) + COUNT(بدون حالة تصميم). الحالات الثلاث غير متداخلة.',
  'فجوة الأمتار':GAP,'تحت الإصدار':'COUNT(projects WHERE permitRefs يساوي حرفيًا «تحت الاصدار»).','تصاريح أوشكت':'COUNT(التصاريح ذات أيام متبقية من 0 إلى 7 شاملة).','تحتاج متابعة':'عدد المشاريع التي تتضمن حالة ضمان «منتهي/أوشك/بانتظار» أو حالة تصريح «منتهي/أوشك»؛ كل مشروع مرة واحدة.'
 },
 projects:{
  'إجمالي المشاريع':P,'أمتار التصاريح':'Σ permitMeters من vd projects، لا تجمع هنا حقل meters من info. new.',
  'متعدد التصاريح/التمديدات':'COUNT(projects WHERE permitCount > 1). يُحسب المشروع مرة واحدة مهما كان عدد التصاريح.',
  'متوسط التصاريح للمشروع':'ROUND(Σ permitCount ÷ COUNT(projects), 2). القيمة صفر عند خلو القائمة.',
  'أعلى عدد تمديدات':'MAX(permitCount) بين المشاريع المطابقة؛ صفر إذا لا توجد مشاريع.',
  'مخاطر مرتفعة/حرجة':'COUNT(projects WHERE riskLevel ∈ {مرتفع، حرج}) وفق معادلة الخادم. '+RISK,
  'تحت الإصدار':'COUNT(permitRefs = «تحت الاصدار»).','مشاريع ملغاة':'COUNT(permitRefs = «مشروع ملغي»).'
 },
 map:{
  'مواقع المشاريع':'COUNT(projects WHERE lat بين 20 و23 حصريًا و lon بين 38 و41 حصريًا).',
  'الخطوط البديلة':'COUNT(lines WHERE نفس شروط صلاحية الإحداثيات) وليس كل الخطوط الموجودة في الشيت.',
  'تغطية خريطة المشاريع':MAP_PROJECT_COVERAGE,
  'تغطية خريطة الخطوط البديلة':MAP_LINE_COVERAGE,
  'طبقات KMZ من الشيت':'عدد روابط kmzUrl من Alternative lines (عمود AL) التي تبدأ http:// أو https:// مع إزالة تكرار الرابط.',
  'إجمالي أطوال الخطوط':'Σ length للخطوط التي اجتازت التحقق من الإحداثيات فقط في الخريطة.'
 },
 permits:{
  'التصاريح الفعلية':PE,'إجمالي الأمتار':'Σ meters ضمن مجموعة actualPermits؛ متر.',
  'منتهية':'COUNT(expiryBand = «منتهي»)، أي expiryDays < 0.',
  'تنتهي خلال 30 يوم':'COUNT(expiryBand ∈ {«0–7 أيام»، «8–30 يوم»})؛ لا يدخل المنتهي.',
  'مشاريع مرتبطة':'COUNT(DISTINCT projectNo) غير الفارغ بعد مطابقة رقم التصريح مع مراجع مشاريع vd projects.',
  'غير مرتبطة بمشروع':'COUNT(actualPermits WHERE projectNo فارغ)؛ لا يختلط مع عدد المشاريع.',
  'سارية':'عدد التصاريح تاريخ انتهائها بعد أكثر من 7 أيام.',
  'أوشكت':'عدد التصاريح من اليوم حتى 7 أيام شاملة.',
  'تاريخ غير قابل للقراءة':'COUNT(التصاريح الفعلية التي لا يمكن قراءة تاريخ نهايتها).'
 },
 lines:{
  'الخطوط المسجلة':LI,'إجمالي الأطوال':'Σ length من سجلات الخطوط (متر).',
  'تصميم معتمد':'COUNT(designStatus يحتوي «معتمد» أو «حزمة مصممة»).',
  'قيد الاعتماد فعليًا':'COUNT(designStatus يحتوي «جاري» أو «قيد» AND approvalDate فارغ).',
  'تعارض حالة/تاريخ':'COUNT(designStatus يحتوي «جاري» أو «قيد» AND approvalDate موجود).',
  'بدون حالة تصميم':'COUNT(designStatus فارغ).',
  'متوسط مدة الاعتماد':'ROUND(Σ approvalDays للخطوط ذات مدة اعتماد عددية ≥0 ÷ عدد هذه الخطوط, 1). لا تدخل المدد السالبة أو غير المتاحة. '+DESIGN,
  'مشاكل تسلسل زمني':'COUNT(assignmentToSubmissionDays < 0)، أي رفع التصميم سبق تاريخ التكليف.',
  'معتمد PMO':'عدد الخطوط التي تحتوي حالة تصميمها «معتمد».','قيد التصميم/الاعتماد':'عدد الخطوط ذات حالة فارغة أو «جاري/منتهي وجاري».'
 },
 settlements:{
  'علاقات التسوية':'COUNT(DISTINCT owner + contractor) المنشأة من مفاتيح المالك والمقاول الموجودة في المشاريع أو الخطوط.',
  'المستحق المطابق':'Σ dueMeters لعلاقات المالك + المقاول؛ مستمد من مجموع permitMeters في vd projects.',
  'الخطوط المطابقة':'Σ executedMeters لعلاقات المالك + المقاول؛ مستمد من مجموع length في Alternative lines.',
  'نسبة التغطية المطابقة':MATCH,
  'فجوة الأمتار':GAP+' تعتمد على مجموع علاقات التسوية.',
  'عليه أمتار':'COUNT(علاقات التسوية التي balance > 0)؛ القيمة الصغيرة أسفل الكارت = Σ الأرصدة الموجبة بالمتر.',
  'له أمتار':'COUNT(علاقات التسوية التي balance < 0)؛ القيمة أسفل الكارت = القيمة المطلقة لمجموع الأرصدة السالبة.',
  'مستوفي':'COUNT(balance = 0).','مستوفي الأمتار':'COUNT(balance = 0).'
 },
 guarantees:{
  'المشاريع':P,'ضمان منتهي':'COUNT(projects WHERE guaranteeStatus يحتوي «منتهي»).',
  'أوشك على الانتهاء':'COUNT(projects WHERE guaranteeStatus يحتوي «أوشك»).',
  'بانتظار إصدار':'COUNT(projects WHERE guaranteeStatus يحتوي «بانتظار»).',
  'تعهدات قائمة':'COUNT(projects WHERE guaranteeStatus يحتوي «تعهد»).',
  'ضمانات سارية':'COUNT(projects WHERE guaranteeStatus يحتوي «ساري»).'
 },
 complaints:{
  'إجمالي الشكاوى':'COUNT(complaints)، كل شكوى كسجل مستقل.',
  'بحالة مسجلة':'COUNT(complaints WHERE status غير فارغ).',
  'بدون حالة':'COUNT(complaints) − COUNT(status غير فارغ).',
  'مرتبطة بحل/خط':'COUNT(complaints WHERE link غير فارغ).',
  'بدون ربط':'COUNT(complaints) − COUNT(link غير فارغ).',
  'جاهزية بيانات الشكاوى':'ROUND(((عدد الشكاوى ذات الحالة + عدد الشكاوى ذات الربط) ÷ (2 × عدد الشكاوى)) × 100, 1). الصفر إذا لم توجد شكاوى؛ هي اكتمال حقلين وليست نسبة إغلاق فعلي.'
 },
 execution:{
  'الخطوط':LI,'حالة تنفيذ مسجلة':'COUNT(lines WHERE executionStatus غير فارغ). وجود قيمة لا يعني اكتمال العمل.',
  'بيانات إتمام':'COUNT(lines WHERE completion أو completionReport غير فارغ).',
  'بيانات تسليم':'COUNT(lines WHERE handoverDate أو handoverLetter غير فارغ).',
  'جاهزية بيانات التنفيذ':'ROUND(((عدد حالات التنفيذ المسجلة + عدد الخطوط ذات بيانات إتمام + عدد الخطوط ذات بيانات تسليم) ÷ (3 × عدد الخطوط)) ×100, 1). مقياس اكتمال بيانات وليس نسبة إنجاز ميدانية.',
  'بدون حالة تنفيذ':'COUNT(lines) − COUNT(executionStatus غير فارغ).',
  'منجز/مكتمل':'COUNT(executionStatus يحتوي «منجز/منتهي/مكتمل»).'
 },
 parties:{
  'المقاولون':'عدد أسماء المقاولين المميزة في اتحاد المشاريع والخطوط؛ «غير محدد» مجموعة مستقلة عند غياب الاسم.',
  'الملاك':'عدد أسماء الملاك المميزة في اتحاد المشاريع والخطوط؛ «غير محدد» مجموعة مستقلة.',
  'أمتار التصاريح':'Σ permitMeters من المشاريع المفلترة.',
  'أمتار الخطوط':'Σ length من الخطوط البديلة المفلترة.'
 },
 municipalities:{
  'البلديات':'COUNT(صفوف municipalitySummary)؛ كل صف يجمع مشاريع وخطوط بلدية واحدة.',
  'المشاريع':'Σ projects من ملخص البلديات.',
  'أمتار التصاريح':'Σ permitMeters من ملخص البلديات.',
  'الخطوط':'Σ lines من ملخص البلديات.',
  'أمتار الخطوط':'Σ lineMeters من ملخص البلديات.',
  'مخاطر مرتفعة/حرجة':'Σ criticalProjects؛ الخادم يعد التصنيف مرتفع أو حرج.',
  'تصاميم تحتاج متابعة':'Σ pendingDesign؛ حالة التصميم فارغة أو تحتوي جاري/قيد.'
 },
 traceability:{
  'المشاريع':'عدد صفوف التتبع المشتقة من المشاريع.',
  'مرتبطة بخطوط':'COUNT(matchMethod لا يساوي «لا يوجد ربط مطابق»). الربط تحليلي على مستوى المالك + المقاول لا ربط مباشر مثبت بخانة خط محدد.',
  'بدون ربط مطابق':'COUNT(صفوف التتبع) − عدد الصفوف المرتبطة.',
  'مخاطر مرتفعة/حرجة':'COUNT(riskLevel حرج أو مرتفع) في سجل التتبع.',
  'أمتار التصاريح':'Σ permitMeters في سجل التتبع.',
  'أمتار الخطوط المرتبطة':'Σ lineMeters في سجل التتبع؛ قد يرتبط إجمالي خط واحد بأكثر من مشروع متشارك بالمفتاح نفسه، لذا لا يستخدم كمجموع فريد للأمتار.'
 },
 risks:{
  'المشاريع':P,'متوسط درجة المخاطر':'ROUND(Σ riskScore ÷ عدد المشاريع,1)، صفر إذا لا توجد مشاريع. '+RISK,
  'حرج':'COUNT(riskLevel = «حرج»؛ الدرجة ≥60).',
  'مرتفع':'COUNT(riskLevel = «مرتفع»؛ من 40 إلى أقل من 60).',
  'متوسط':'COUNT(riskLevel = «متوسط»؛ من 20 إلى أقل من 40).',
  'طبيعي':'COUNT(riskLevel = «طبيعي»؛ أقل من 20).',
  'ضغط تمديدات مرتفع':'COUNT(extensionPressure = «مرتفع» أو «مرتفع جدًا»)؛ أي permitCount ≥5.'
 },
 analytics:{
  'المشاريع بالنطاق':P,'التغطية الإجمالية':GROSS,'التغطية المطابقة':MATCH,
  'مشاريع عالية المخاطر':'COUNT(riskLevel حرج أو مرتفع) من المشاريع الحالية.',
  'تصاريح منتهية':'COUNT(expiryBand = «منتهي»)، من التصاريح المؤرخة الداخلة بالنطاق.',
  'تصاميم متقادمة >60 يوم':'COUNT(lines WHERE designAgeDays >60). العمر يعتمد تاريخ الرفع وعدم وجود اعتماد.',
  'تسويات غير متوازنة':'COUNT(settlements WHERE balance ≠ 0).',
  'تصاميم تحتاج متابعة':'COUNT(lines WHERE designStatus فارغ أو يحتوي «جاري»).',
  'ضمانات حرجة':'COUNT(projects WHERE guaranteeStatus يحتوي «منتهي/أوشك/بانتظار»).'
 },
 followup:{
  'عدد البايفتات':'قيمة pivotCount=15 ثابتة في تعريف تقارير ورقة reports بالخادم؛ لا تعدّ عدد الصفوف.',
  'مشاريع الضخ':'Grand Total / قيمة العمود الثاني من Pivot المشاريع حسب المالك (reports A:B).',
  'التصاريح':'Grand Total من Pivot التصاريح حسب السنة (reports D:F)؛ تظهر الأمتار المجمعة في الشرح الصغير.',
  'الخطوط البديلة':'Grand Total من Pivot الخطوط حسب السنة (reports N:Q).'
 }
};
const CHARTS={
 cRisk:['vd projects','COUNT(projects) GROUP BY riskLevel؛ تصنيف الدرجة المركبة بحسب قواعد الخادم. '+RISK],
 cPermitStatus:['vd projects','COUNT(projects) GROUP BY permitStatus، وليس تصاريح info. new.'],
 cGuarantee:['vd projects','COUNT(projects) GROUP BY guaranteeStatus.'], cExt:['vd projects','COUNT(projects) GROUP BY extensionPressure؛ 0/1/2–4/5–9/≥10 تصاريح في المستويات المقابلة.'],
 cLineType:['Alternative lines','COUNT(lines) GROUP BY type.'],cDesign:['Alternative lines','COUNT(lines) GROUP BY designStatus.'],
 cYears:['info. new','COUNT(actualPermits) GROUP BY year؛ السنة من تاريخ التصريح.'],
 cMun:['vd projects','COUNT(projects) GROUP BY municipality؛ أعلى 12 بلدية.'],
 pRisk:['vd projects','COUNT(projects) GROUP BY riskLevel وفق درجة المخاطر المركبة.'],
 pExt:['vd projects','COUNT(projects) GROUP BY extensionPressure.'],
 pStatus:['vd projects','COUNT(projects) GROUP BY contractStatus.'],
 pType:['vd projects','COUNT(projects) GROUP BY projectType.'],
 pPermit:['vd projects','COUNT(projects) GROUP BY permitStatus.'],
 pMun:['vd projects','COUNT(projects) GROUP BY municipality؛ أعلى 12.'],
 pMeters:['vd projects','ترتيب المشاريع تنازليًا حسب permitMeters وعرض أعلى 12، وقيمة العمود = أمتار التصاريح للمشروع ذاته.'],
 peExpiry:['info. new','COUNT(actualPermits) GROUP BY expiryBand؛ '+PERMIT],
 peYear:['info. new','COUNT(actualPermits) GROUP BY year.'],
 peMun:['info. new + vd projects','COUNT(actualPermits) GROUP BY municipality المستمدة من المشروع المرتبط؛ أعلى 12.'],
 peCon:['info. new + vd projects','COUNT(actualPermits) GROUP BY contractor المستمد من المشروع المرتبط؛ أعلى 12.'],
 peOwner:['info. new','SUM(meters) GROUP BY owner ثم أعلى 12 مالك؛ الشارت أمتار لا عدد تصاريح.'],
 peMetersYear:['info. new','SUM(meters) GROUP BY year مع ترتيب السنوات تصاعديًا.'],
 lType:['Alternative lines','COUNT(lines) GROUP BY type.'],
 lDesign:['Alternative lines','COUNT(lines) GROUP BY designStatus.'],
 lApproval:['Alternative lines','COUNT(lines) GROUP BY approvalBand؛ الفئات من submissionDate إلى approvalDate؛ '+DESIGN],
 lAging:['Alternative lines','COUNT(lines WHERE designAgeDays >0) GROUP BY designAgeBand. '+DESIGN],
 lContractor:['Alternative lines','SUM(length) GROUP BY contractor؛ أعلى 12 مقاول بالأمتار.'],
 lDesigner:['Alternative lines','COUNT(lines) GROUP BY designer؛ أعلى 10 مهندسين من حيث عدد الخطوط.'],
 lDiameter:['Alternative lines','COUNT(lines) GROUP BY diameter؛ أعلى 12 قطرًا.'],
 lDiff:['Alternative lines','أكبر 12 خطًا بترتيب |designLengthDiff| تنازليًا؛ القيمة المعروضة designLength − length بإشارتها، لا بالقيمة المطلقة.'],
 sStatus:['علاقات التسوية','COUNT(settlements) GROUP BY status؛ الرصيد >0 عليه، <0 له، =0 مستوفي.'],
 sCoverage:['علاقات التسوية','COUNT(settlements) GROUP BY coverageBand؛ بدون مستحق، 0%، <50%، 50–79%، 80–99%، ≥100%.'],
 sContractor:['علاقات التسوية','SUM(balance) GROUP BY contractor؛ تعرض أكبر 12–15 مجموعًا بحسب |الرصيد| مع الاحتفاظ بإشارته.'],
 sDueDone:['علاقات التسوية','SUM(dueMeters) وSUM(executedMeters) GROUP BY contractor؛ أعلى 10 مقاولين من حيث المستحق؛ شريطان لكل مقاول.'],
 sGaps:['علاقات التسوية','أكبر 12 علاقة (مالك + مقاول) حسب |balance|؛ قيمة العمود balance بإشارتها.'],
 gStatus:['vd projects','COUNT(projects) GROUP BY guaranteeStatus.'],
 gContractor:['vd projects','COUNT(projects) GROUP BY contractor؛ أعلى 12 مقاولًا.'],
 gWindow:['vd projects','عدد المشاريع حسب نافذة guaranteeDays وتوفر تاريخ الضمان/التعهد؛ '+GUARANTEE],
 coStatus:['info. new','COUNT(complaints) GROUP BY status؛ الفارغ يظهر تحت «غير محدد».'],
 exStatus:['Alternative lines','COUNT(lines) GROUP BY executionStatus؛ شارت حالة مسجلة وليس نسبة تنفيذ.'],
 exType:['Alternative lines','COUNT(lines WHERE executionStatus غير فارغ) GROUP BY type.'],
 paCon:['vd projects + Alternative lines','لكل مقاول شريطان: SUM(permitMeters) من المشاريع وSUM(length) من الخطوط؛ أعلى 10 مقاولين مرتبّين حسب المستحق.'],
 paOwner:['vd projects + Alternative lines','لكل مالك شريطان: SUM(permitMeters) من المشاريع وSUM(length) من الخطوط؛ أعلى 10 ملاك مرتّبين حسب المستحق.'],
 rLevel:['vd projects','COUNT(projects) GROUP BY riskLevel. '+RISK],
 rExt:['vd projects','COUNT(projects) GROUP BY extensionPressure.'],
 rMun:['vd projects','AVG(riskScore) GROUP BY municipality؛ ترتيب تنازلي لأعلى 12 بلدية. هذه متوسطات وليست مجموع درجات أو أعداد مشاريع.'],
 rTop:['vd projects','عرض أعلى 12 مشروعًا حسب riskScore تنازليًا؛ قيمة العمود درجة المشروع (0–100).'],
 muProjects:['ملخص البلديات','عدد المشاريع لكل بلدية؛ ترتيب تنازلي.'],
 muPermit:['ملخص البلديات','Σ permitMeters لكل بلدية؛ ترتيب تنازلي بالمتر.'],
 muLines:['ملخص البلديات','Σ lineMeters لكل بلدية؛ ترتيب تنازلي بالمتر.'],
 muRisk:['ملخص البلديات','عدد المشاريع ذات المخاطر المرتفعة أو الحرجة في كل بلدية؛ ترتيب تنازلي.'],
 muCoverage:['ملخص البلديات','grossCoveragePct = lineMeters ÷ permitMeters ×100 لكل بلدية؛ استبعاد البلديات التي ليس لديها مقام متاح؛ ليست تسوية مالك + مقاول.'],
 trRisk:['التتبع','COUNT(traceability) GROUP BY riskLevel.'],
 trMatch:['التتبع','COUNT(traceability) GROUP BY matchMethod؛ ربط على مستوى المالك + المقاول.'],
 trLines:['التتبع','أعلى 12 مشروعًا حسب lineMeters المربوطة تحليليًا؛ لا يعني تخصيص أطوال فريدة لكل مشروع.'],
 anMeter:['info. new + Alternative lines','عمود لأمتار التصاريح الفعلية = Σ meters وعمود لطول الخطوط = Σ length.'],
 anMun:['vd projects','COUNT(projects) GROUP BY municipality؛ أعلى 12.'],
 anSet:['علاقات التسوية','COUNT(settlements) GROUP BY status.'],
 anGuarantee:['vd projects','COUNT(projects) GROUP BY guaranteeStatus.'],
 anRisk:['vd projects','COUNT(projects) GROUP BY riskLevel.'],
 qCat:['جودة البيانات','COUNT(quality) GROUP BY category.'],
 qSource:['جودة البيانات','COUNT(quality) GROUP BY source.'],
 usMemoryChart:['Dashboard History','كل نقطة = قيمة حقيقية من لقطة محفوظة؛ حتى آخر 30 لقطة؛ كل سلسلة مؤشر مستقل (المخاطر والتصاريح والجودة/التغطية حسب الرسم).'],
 ustTrend:['VD Thursday Progress','خط لكل مؤشر من لقطات الخميس الرسمية، وليست قراءات أيام أخرى.'],
 ustCoverageTrend:['VD Thursday Progress','التغطية وجاهزية التسليم من لقطات الخميس؛ النقاط نسبة مئوية 0–100.'],
 ustPermitTrend:['VD Thursday Progress','سلامة التصاريح (%) = 100 − (التصاريح المنتهية ÷ إجمالي التصاريح) ×100 مع حد أدنى صفر.'],
 ustRiskTrend:['VD Thursday Progress','استقرار المخاطر (%) = 100 − (المشاريع عالية المخاطر ÷ إجمالي المشاريع) ×100 مع حد أدنى صفر.'],
 ustQualityTrend:['VD Thursday Progress','جودة البيانات (%) = 100 − (عدد ملاحظات الجودة ÷ عدد الوحدات المرجعية للمشاريع والخطوط) ×100 مع حد أدنى صفر؛ الحفظ كل خميس.']
};
const TABLES={
 'تنبيهات المتابعة الذكية':'تبدأ القواعد من التصاريح الفعلية: منتهي إذا end < اليوم، واقتراب الانتهاء خلال 7 أيام؛ ومن المشاريع: ضمان منتهي/أوشك/بانتظار؛ ومن الخطوط: تصميم فارغ أو جاري/قيد. لكل حالة سجل تنبيه، ثم ترتيب الأهمية high ثم medium ثم low، وقصر العرض على أول 30 سجلًا.',
 'تفاصيل المشاريع':'صف لكل مشروع مفلتر من vd projects، مع عرض الحقول المشتقة وحالة العقد والتصريح وأمتاره؛ لا يشترط أن يمثل السجل تصريحًا واحدًا.',
 'تفاصيل المشاريع ومؤشر المخاطر':'صف لكل مشروع بعد الفلاتر، مرتب تنازليًا حسب riskScore. أسباب المخاطر محفوظة في reasons، والنسبة المطابقة ناتجة عن علاقة المالك + المقاول. '+RISK,
 'العناصر الجغرافية':'اتحاد سجلات المشاريع والخطوط التي نجحت في اختبار الإحداثيات: 20 < lat < 23 و38 < lon < 41؛ لا تظهر السجلات بلا إحداثيات صالحة في هذا الجدول.',
 'سجل التصاريح الفعلية':'صف لكل تصريح من info. new له تاريخ بداية ونهاية، مع الأمتار وتفاصيله، دون «تحت الإصدار» أو «مشروع ملغي».',
 'سجل التصاريح المربوط بالمشروعات':'ربط كل تصريح مؤرخ برقم id مع القيم المفصولة بالفاصلة من permitRefs بالمشاريع؛ إذا لم يطابق رقمًا، تُترك بيانات المشروع المرتبط فارغة. '+PERMIT,
 'تفاصيل الخطوط البديلة':'صف لكل خط مفلتر من Alternative lines، مع الأطوال والتصميم والمقاول والمالك.',
 'تفاصيل الخطوط ودورة التصميم':'صف لكل خط، يضيف تاريخ التكليف والرفع والاعتماد، فرق طول التصميم، متوسطات الأيام وتصنيف العمر. '+DESIGN,
 'تسويات الملاك والمقاولين':'صف واحد لكل مفتاح مركب (المالك + المقاول) يظهر في المشاريع أو الخطوط مع بيانات صالحة. dueMeters = Σ permitMeters، executedMeters = Σ length، balance = dueMeters − executedMeters. «عليه» للموجب و«له» للسالب و«مستوفي» للصفر؛ التغطية من القسمة على المستحق وتكون null إن كان صفرًا.',
 'سجل الضمانات':'يعرض سجل المشاريع مع guaranteeRef وguaranteeExpiry وguaranteeDays وguaranteeStatus؛ الحالة مستمدة من البيانات لا من افتراض عام.',
 'سجل الضمانات والتعهدات':'صف لكل مشروع ونوع الضمان أو التعهد الموجود في vd projects؛ تميّز الحالة النصية، وتعرض مخاطر المشروع المشتقة. '+GUARANTEE,
 'سجل الشكاوى':'صف لكل شكوى من info. new مع نص الشكوى وحقل المتابعة status والربط بالحل link؛ لا تستنتج حالة إغلاق من مجرد وجود الربط.',
 'التنفيذ والتسليم':'صف لكل خط بديل، مع حقول التنفيذ والإتمام والتقرير وخطاب/تاريخ التسليم. خلو الحقول يعني نقص معلومات ولا يثبت عدم التنفيذ.',
 'ملخص المقاولين':'تجميع اتحاد المشاريع والخطوط باسم المقاول، مع COUNT(projects)، COUNT(lines)، Σ permitMeters، Σ length، ونسبة إجمالية length ÷ permitMeters ×100؛ مرتب بأمتار التصاريح تنازليًا.',
 'ملخص الملاك':'تجميع اتحاد المشاريع والخطوط باسم المالك، مع COUNT(projects)، COUNT(lines)، Σ permitMeters، Σ length، ونسبة إجمالية length ÷ permitMeters ×100؛ مرتب بأمتار التصاريح تنازليًا.',
 'نتائج جودة البيانات':'كل صف ملاحظة ناتجة عن قاعدة تدقيق على مصدر وعمود محددين، مع التصنيف والصف ورسالة المخالفة؛ ليست كل ملاحظة مشروعًا مختلفًا.',
 'سجل مخاطر المشاريع':'صف لكل مشروع، مرتب تنازليًا بدرجة riskScore. يعرض الأسباب وحقول التصريح والضمان والعقد والمطابقة. '+RISK,
 'ملخص البلديات':'صف لكل بلدية بعد تجميع المشاريع والخطوط. النسبة الإجمالية = lineMeters ÷ permitMeters ×100 إذا المستحق >0؛ لا تعني مطابقة العلاقات التعاقدية.',
 'مصفوفة التتبع الشامل':'صف لكل مشروع من vd projects مع البحث عن خطوط Alternative lines التي تتشارك المالك والمقاول. يوضح matchMethod صراحة أن الربط تحليلي؛ لا تُعد أمتار الخط الواحد موزعة بشكل حصري على مشروع محدد.',
 'أعلى أولويات التدخل الإداري':'أعلى 15 مشروعًا في نطاق الفلاتر، بترتيب riskScore تنازليًا. يبيّن التصنيف والأسباب ونسبة التغطية المطابقة، ولا يعيد حساب الدرجة بمؤشر الذكاء المحلي.',
 'سجل اللقطات':'سجل Dashboard History الزمني المعروض من الأحدث للأقدم، حتى 30 صفًا؛ كل صف لقطة محفوظة لحظة محددة.',
 'أعلى المشروعات أولوية':'أعلى 8 مشاريع بعد ترتيب أولوية smart-center.js محليًا؛ تختلف درجة أولوية الذكاء عن riskScore المحسوبة بالخادم.',
 'مركز الاستثناءات — الحالات التي تحتاج مراجعة':'اتحاد أعلى 40 مشروعًا بدرجة ذكية ≥45، حتى 80 ملاحظة جودة، وحتى 40 تصريحًا منتهيًا؛ المعروض أول 80 نتيجة دون دمج المتشابه.',
 'مقارنة آخر لقطة بالسابق':'الفرق = قراءة اللقطة الأحدث − قراءة اللقطة السابقة لكل مؤشر. لا يُنشأ فرق حقيقي إذا لم يتوفر خط أساس سابق.',
 'أعلى مسببات/مناطق التركّز':'تجميع الحالات المختارة حسب البعد المختار (بلدية/مقاول/مالك/مصدر/فئة)، ثم ترتيب تنازلي بوزن الأثر؛ ليس مجرد COUNT عند اختلاف الأوزان.',
 'مركز التقارير':'الجداول المصدرة تستخدم البيانات التي خضعت للمعاينة والفلاتر؛ ملف PDF يعرض ما تم اختياره ولا ينشئ معادلة حساب جديدة.',
 'عدد مشاريع الضخ للجهة المالكة':'من ورقة reports نطاق A:B، COUNT(A) للمشاريع مصنف حسب المالك، مع صف Grand Total المقدم من Pivot.',
 'عدد وأطوال التصاريح بكل عام':'من ورقة reports نطاق D:F؛ لكل سنة COUNT/COUNTA أرقام التصاريح وSUM الأمتار المستحقة. Grand Total هو مخرج Pivot وليس مجموعًا مستقلًا للواجهة.',
 'الأمتار المستحقة حسب المقاول':'من ورقة reports نطاق G:I؛ مصنف حسب المقاول، SUM عدد تصاريح المشروع/تمديداته + SUM الأمتار، وقد لا يساوي عد صفوف التصاريح الفعلية.',
 'الأمتار المستحقة حسب الجهة المالكة':'من ورقة reports نطاق J:L؛ مصنف حسب المالك، SUM عدد التصاريح/التمديدات وSUM الأمتار.',
 'عدد وأطوال الخطوط البديلة بكل عام':'من ورقة reports نطاق N:Q؛ مجمع حسب السنة ونوع الخط؛ العدد وطول الخط بالمتر.',
 'الخطوط البديلة حسب المقاول':'من ورقة reports نطاق R:U؛ تجميع المقاول ونوع الخط والعدد والطول.',
 'الخطوط البديلة حسب المالك':'من ورقة reports نطاق V:Y؛ تجميع المالك ونوع الخط والعدد والطول.',
 'الخطوط البديلة حسب الحي':'من ورقة reports نطاق DG:DI؛ تجميع الأحياء مع الحفاظ على صف الحي الفارغ وGrand Total. قد يختلف عدد سجلات Pivot عن بيانات الخطوط إذا احتسب COUNTA الخلايا الفارغة على نحو مختلف.'
};
const SMART_SCORE='درجة الأولوية المحلية في smart-center.js (مختلفة عن درجة الخادم): مستوى مخاطر «حرج» +38، مرتفع +28، متوسط +12؛ تصريح منتهي +20، تحت الإصدار +12، ينتهي خلال 7 أيام +10؛ ضمان منتهي +16 أو قريب ≤30 يوم +8؛ ضغط تمديدات مرتفع/حرج +12؛ إحداثيات غير صالحة +5؛ رصيد تسوية موجب + min(18, 5 + ROUND(balance/500))؛ عقد منتهي دون خطاب تسليم +7. مجموع البنود بحد أقصى 100. تصنيف أولوية محرك القرار: حرج ≥70، مرتفع ≥45، متوسط ≥20، منخفض دون ذلك.';
const HEALTH='صحة المحفظة تبدأ من 100 نقطة، ويُخصم منها: min(28, نسبة المشاريع عالية المخاطر ×0.7)، وmin(22, نسبة التصاريح المنتهية ×0.65)، وmin(18, نسبة ملاحظات الجودة إلى (عدد المشاريع+الخطوط) ×0.45)، وmin(18, (100−التغطية المختارة الموجبة) ×0.18)، وmin(14, نسبة التصاميم الجاري اعتمادها إلى الخطوط ×0.35). النتيجة مقربة لأقرب صحيح ومقيدة ≥0. إنه مؤشر استدلالي مركب وليس نسبة إنجاز.';
const THURSDAY={
 'تغطية الأمتار':'Σ أمتار الخطوط ÷ Σ أمتار التصاريح ×100. تُحسب القراءة الحية من البيانات الحالية ثم تحفظ لقطة الخميس الرسمية للمقارنة.',
 'سلامة التصاريح':'max(0, 100 − التصاريح المنتهية ÷ إجمالي التصاريح ×100).',
 'استقرار المخاطر':'max(0, 100 − المشاريع عالية المخاطر ÷ إجمالي المشاريع ×100).',
 'جودة البيانات':'max(0, 100 − ملاحظات الجودة ÷ MAX(1, عدد المشاريع + عدد الخطوط) ×100).',
 'جاهزية التسليم':'عدد الخطوط ذات خطاب/تاريخ تسليم ÷ عدد الخطوط ×100؛ ليست نسبة تنفيذ إنشائي.'
};
const SMART_METRICS={
 'صحة المحفظة':HEALTH,'المشاريع':P,
 'المخاطر العالية':'COUNT(projects WHERE riskLevel ∈ {حرج، مرتفع}) كما يصنف الخادم.',
 'التصاريح المنتهية':'COUNT(actualPermits WHERE expiryDays <0) ضمن البيانات المفلترة.',
 'فجوة الأمتار':GAP+' هنا الفرق من علاقات التسوية.',
 'ملاحظات الجودة':'عدد صفوف quality من فحوص الخادم للبيانات الحالية، وقد يتكرر المشروع في أكثر من ملاحظة.',
 'عدد اللقطات':'COUNT(history) من Dashboard History المركزي إن توفر، وإلا من الذاكرة المحلية (حتى 96 لقطة؛ فاصل التسجيل المحلي الأدنى 15 دقيقة).',
 'نطاق الذاكرة':'الفترة من أول لقطة إلى آخر لقطة من سجل الذاكرة؛ ليست متوسطًا.',
 'آخر لقطة':'تاريخ/وقت أحدث لقطة محفوظة.',
 'المخاطر الحالية':'COUNT(projects WHERE riskLevel = حرج أو مرتفع) في اللقطة التشغيلية.',
 'جودة البيانات':'عدد ملاحظات الجودة في لقطة التشغيل/السجل بحسب نوع العرض.',
 'الحالات':'COUNT(الصفوف المنطبقة على الظاهرة المختارة في غرفة التحقيق).',
 'المجموع المرجح':'Σ _weight للحالات ضمن الظاهرة: المخاطر تستخدم درجة الأولوية، التصاريح المنتهية أمتارها بحد أدنى 1، فجوات التسوية رصيدها، التصميم عمره بحد أدنى 1، وبقية الأنواع وزنها 1. في التجميع الخالي/غير الرقمي تُستخدم قيمة 1.',
 'أعلى تركّز':'مجموعة التقسيم صاحبة أكبر مجموع أوزان، والنسبة = وزنها ÷ مجموع الأوزان ×100، وليس بالضرورة الأكثر عددًا.',
 'عدد المجموعات':'COUNT(DISTINCT البعد المختار) بين الحالات الداخلة في التحليل.',
 'الحالات المطابقة':'عدد الحالات بعد تطبيق نص البحث والحد الأدنى لدرجة الأولوية في محرك القرار.',
 'الأولوية الحرجة':'COUNT(درجة الأولوية المحلية ≥70) بعد الفلاتر الداخلية لمحرك القرار. '+SMART_SCORE,
 'الأولوية المرتفعة':'COUNT(45 ≤ درجة الأولوية المحلية <70) بعد الفلاتر الداخلية. '+SMART_SCORE,
 'ثقة تغطية عالية':'تُحسب درجة الثقة من اكتمال ثمانية أدلة (المشروع/المقاول/المالك/البلدية/التصريح/الضمان/الإحداثيات/السبب). الثقة = clamp(round(25 + نسبة الأدلة المكتملة ×0.7),25,95)، ثم يتم عدّ الحالات فوق عتبة الثقة المعلنة.'
};
const page=()=>window.VDUrgent?.getState?.()?.page||document.body.dataset.vdPage||'master';
const data=()=>window.VDUrgent?.getState?.()?.data||window.__urgentDashboardData||{};
function filtered(raw){const f=window.VDUrgent?.filterRows;try{return typeof f==='function'?f(raw||[]):raw||[]}catch{return raw||[]}}
function visibleValue(el){return clean(el.querySelector(':scope > strong, :scope > .dq-hero-score-main > strong, :scope > b, :scope > .stp-delta-main')?.textContent||el.querySelector('strong')?.textContent||'')}
function titleOf(el){
 const opts=[':scope > span','.stp-card-head > span',':scope > .panel-head b',':scope > .table-tools b',':scope > .us-panel-head h3',':scope > .dq-section-head h3',':scope > .sheet-contractor-head h4',':scope > .dq-section-metrics .dq-quality-rate small',':scope > div > h3',':scope > h3',':scope > b'];
 for(const sel of opts){let node;try{node=el.querySelector(sel)}catch{}if(node&&clean(node.textContent))return clean(node.textContent)}
 return clean(el.getAttribute('data-report-table-title')||el.getAttribute('aria-label')||'عنصر تحليلي');
}
const pageMetric=(p,title)=>METRICS[p]?.[title]||((['smartCenter','temporalMemory','investigationRoom','explainableDecision','smartThursday'].includes(p))?SMART_METRICS[title]:null);
function dynamicExample(el,p,title,kind){
 const d=data(),a=filtered(d.actualPermits),l=filtered(d.lines),s=filtered(d.settlements),pr=filtered(d.projects);
 if(kind==='chart'){
  const canvas=el.querySelector('canvas'),chart=canvas&&window.Chart?.getChart?.(canvas);
  if(chart){
   const labels=chart.data.labels||[],ds=chart.data.datasets||[],pair=labels.length?ds.map(set=>clean(set.label||'السلسلة')+' = '+fmt(set.data?.[0])).join(' ؛ '):'لا توجد قيم';
   return 'الفئات المعروضة: '+labels.length+'؛ السلاسل: '+ds.length+'. مثال حي من الرسم: '+(labels.length?'«'+clean(labels[0])+'»: '+pair:'لا توجد فئات بعد الفلترة')+'.';
  }
  return 'لا يوجد رسم مرسوم حاليًا؛ يعاد حسابه عند توفر بيانات.';
 }
 if(['التغطية الإجمالية','تغطية الأمتار'].includes(title) && !el.classList.contains('stp-section-card'))
  return 'من نطاق الفلاتر الحالي: أطوال الخطوط = '+fmt(sum(l,'length'))+' م، أمتار التصاريح = '+fmt(sum(a,'meters'))+' م؛ الناتج '+pct(sum(l,'length'),sum(a,'meters'))+'%.';
 if(['التغطية المطابقة','نسبة التغطية المطابقة'].includes(title))
  return 'من علاقات التسوية الحالية: المنفذ المطابق = '+fmt(sum(s,'executedMeters'))+' م، المستحق المطابق = '+fmt(sum(s,'dueMeters'))+' م؛ الناتج '+pct(sum(s,'executedMeters'),sum(s,'dueMeters'))+'%.';
 if(['فجوة التسوية المطابقة'].includes(title)|| (p==='settlements'&&title==='فجوة الأمتار'))
  return 'من علاقات التسوية الحالية: '+fmt(sum(s,'dueMeters'))+' − '+fmt(sum(s,'executedMeters'))+' = '+fmt(Math.round((sum(s,'dueMeters')-sum(s,'executedMeters'))*10)/10)+' متر.';
 if(title==='تغطية خريطة المشاريع'||title==='تغطية خريطة الخطوط البديلة'){
  const isProject=title==='تغطية خريطة المشاريع',rows=isProject?pr:l;
  // The card subtitle exposes its exact post-filter scope on both the master and map pages.
  const shown=clean(el.querySelector(':scope > small')?.textContent).match(/(\d+)\s+من\s+(\d+)/);
  const valid=r=>Number.isFinite(Number(r?.lat))&&Number.isFinite(Number(r?.lon))&&Number(r.lat)>20&&Number(r.lat)<23&&Number(r.lon)>38&&Number(r.lon)<41;
  const mapped=shown?Number(shown[1]):rows.filter(valid).length,total=shown?Number(shown[2]):rows.length;
  return mapped+' '+(isProject?'مشروعًا':'خطًا بديلًا')+' بإحداثيات صالحة ÷ '+total+' '+(isProject?'مشروعًا':'خطًا بديلًا')+' ضمن الفلاتر = '+pct(mapped,total)+'%.';
 }
 if(kind==='table'){
  const tbody=el.querySelector('table tbody'),thead=el.querySelector('table thead'),count=tbody?.rows?.length||0;
  const headers=[...(thead?.querySelectorAll('th')||[])].map(x=>clean(x.textContent)).filter(Boolean);
  return 'الجدول المعروض حاليًا: '+fmt(count)+' صفًا، '+fmt(headers.length)+' عمودًا؛ الأعمدة: '+headers.slice(0,12).join('، ')+(headers.length>12?'…':'')+'. البحث داخل الجدول قد يخفي صفوفًا بصريًا فقط.';
 }
 const value=visibleValue(el);
 return value?'القيمة المعروضة حاليًا: '+value+'. تُعاد من المصدر عند تحديث الداشبورد أو الفلاتر.':'يظهر التفصيل بمجرد توفر سجل مطابق في مصدر البيانات.';
}
function infoFor(el){
 const p=page(),canvas=el.querySelector('canvas'),chartId=canvas?.id||'',label=titleOf(el);
 const quality=el.matches('.dq-card,.dq-smart-card,.dq-overview-card,.dq-hero-score,.dq-section-metrics,.dq-smart-total');
 const isTable=el.matches('.table-panel,.sheet-report-table,.us-table-wrap,.dq-table-wrap,.sheet-contractor-report')||!!el.querySelector('table')&&!canvas&&!el.matches('.us-panel');
 const isChart=!!canvas||el.matches('.stp-panel');
 const isSmartCard=el.matches('.stp-section-card,.us-kpi');
 const kind=isChart?'chart':isTable?'table':'card';
 let formula='',condition='',dataSource=source[p]||'Google Sheets',notes='';
 if(quality){
  const name=label||clean(el.querySelector('span')?.textContent),detail=clean(el.getAttribute('title')||el.querySelector('small')?.textContent);
  dataSource=el.closest('.dq-section')?.querySelector('.dq-section-head span')?.textContent||source.quality;
  if(el.matches('.dq-card'))formula='عدد الصفوف التي يتحقق فيها شرط التدقيق المحدد: '+name+'. يتم اختبار الصفوف المنطبقة على هذا الحقل فقط، ثم عدّ كل صف مخالف. '+detail;
  else if(el.matches('.dq-smart-card'))formula='عدد حالات فحص التدقيق المتقدم «'+name+'». '+detail+'؛ التفصيل يُظهر الصفوف والقيم والأدلة المستخدمة.';
  else if(el.matches('.dq-overview-card'))formula='مجموع حالات الإخفاق لجميع قواعد جودة البيانات الخاصة بقسم «'+name+'». عدد السجلات المتأثرة رقم مستقل عن مجموع الملاحظات؛ فقد يحمل السجل أكثر من ملاحظة.';
  else if(el.matches('.dq-hero-score'))formula='مجموع ملاحظات الجودة = Σ المخالفات عبر الأقسام الخمسة؛ نسبة الجودة = MAX(0,MIN(100,(إجمالي الخلايا/الاختبارات المنطبقة − الملاحظات) ÷ إجمالي الخلايا/الاختبارات المنطبقة ×100)). إن لم توجد اختبارات تصبح 100%.';
  else if(el.matches('.dq-section-metrics'))formula='نسبة جودة القسم = MAX(0,MIN(100,(عدد الاختبارات المنطبقة − المخالفات) ÷ عدد الاختبارات المنطبقة ×100)). لكل قاعدة عدد صفوف منطبقة مستقل؛ يُجمع عدد الاختبارات على جميع القواعد.';
  else formula='مجموع نتائج التدقيق الذكي المتقدم عبر سبع مجموعات: تكرار المعرف، التسلسل الزمني، الإحداثيات، المراجع المفقودة، تعارض الاعتماد، تقادم التصميم أكثر من 60 يومًا، والملاحظات الحرجة الواردة من الخادم.';
  condition='العد هنا على مستوى قواعد الاختبار، وليس عدد المشاريع الفريدة. الملاحظات متعددة القواعد قد تتكرر على السجل الواحد.';
 }else if(el.matches('.stp-section-card')){
  const heading=clean(el.querySelector('.stp-card-head span')?.textContent)||label;
  formula=THURSDAY[heading]||'الفرق الأسبوعي = معدل أحدث لقطة خميس محفوظة − معدل لقطة الخميس السابقة (بالنقاط المئوية)، وبنفس القسم. لا تستعمل قراءة اليوم الحية بدل خط الأساس.';
  condition=el.classList.contains('stp-baseline-card')?'تتطلب المقارنة وجود لقطتي خميس رسميتين؛ إذا غاب أحدهما يظهر «بانتظار خط أساس» بدل رقم مختلق.':'معدل حي من المصادر التشغيلية الحالية، يفصل عن فرق الأسابيع.';
 }else if(el.matches('.map-panel')){
  formula='خريطة تفاعلية تجمع المشاريع من vd projects والخطوط من Alternative lines بشرط 20 < lat < 23 و38 < lon < 41، وتمثل الخط البديل كنقطة زرقاء لا كمسار هندسي. روابط KMZ من العمود AL تجمع كرابط واحد لكل ملف فريد، وتضاف الملفات المحلية المؤقتة في طبقات منفصلة.';
  condition='فلاتر الخريطة الثلاثة (المشاريع/الخطوط/KMZ) ومستويات إظهار الطبقات قد تجعل عدد النقاط الظاهرة أقل من عدد العناصر الصالحة بالمؤشرات. البحث عن المشروع/الخط لا يغير رقم الأمتار.';
 }else if(isChart){
  const rule=CHARTS[chartId];
  formula=rule?.[1]||'يُعرض تسلسل البيانات الحالي كما يحسبه مصدر الرسم. القيم لا تُعدّ تلقائيًا أرقامًا للمشاريع ما لم تكن وحدة الرسم «عدد المشاريع».';
  if(rule)dataSource=rule[0];
  condition='تظهر الفئات الفارغة غالبًا بوصف «غير محدد». الرسوم من نوع أعلى N تخفي بقية الفئات دون حذفها من المصدر؛ والرسوم ذات السلاسل المتعددة لا تخلط الأمتار مع الأعداد.';
 }else if(isTable){
  const tableName=el.getAttribute('data-report-table-title')||label;
  formula=TABLES[tableName]|| (el.matches('.sheet-report-table,.sheet-contractor-report')?
   'هذا الجدول يقرأ نطاقًا محددًا من ورقة reports جاهزًا بقيم Pivot ومعادلات Google Sheets. يُحافظ على الصفوف وعناوين الأعمدة والـGrand Total كما هو ولا يعيد احتسابه في المتصفح.':
   'الجدول عبارة عن سجلات أو تجميعات فعلية في النطاق المفلتر؛ يحدد مصدره القسم والعناوين، ولا ينشئ تقديرًا مستقلًا للقيم.');
  if(el.matches('.sheet-contractor-report')){
   const idx=Number((el.getAttribute('data-followup-report')||'').split('-').pop());
   const cols=['AA','AM','AY','BK','BW','CI','CU'];
   formula='هذا تقرير تسوية المقاول من ورقة reports؛ نطاق التقرير يبدأ من العمود '+(cols[idx]||'المحدد')+'، أول صف للقيمة الإجمالية والثاني للعناوين، ثم صفوف التفاصيل. منطق الشيت: مطابقة المالك + المقاول، رصيد التسوية = أمتار التصاريح المستحقة − أمتار الخطوط المقابلة. تحتفظ الواجهة بالرصيد والإشارات والتصنيف كما في الشيت.';
  }
  if(el.matches('.sheet-report-table,.sheet-contractor-report')){dataSource=source.followup;condition='نتائج Pivot قد تستخدم COUNTA لعدد الصفوف وليس COUNT(DISTINCT) لمعرف المشروع؛ صف Grand Total ناتج من الشيت وليس سجلًا إضافيًا.'}
  else condition='ترتيب الصفوف والتجميعات بحسب الوصف أعلاه؛ البحث النصي يؤثر في إظهار الصفوف فقط ولا يعدّل الحسابات.';
 }else{
  formula=pageMetric(p,label)||SMART_METRICS[label]||'هذا عنصر عرض/ملخص مرتبط بمصدر الصفحة؛ لا يُحتسب من علامة الرسم وحدها. إن كانت البطاقة نصية فهي شرح أو توصية وليست مؤشرًا رقميًا مستقلًا.';
  if(isSmartCard&&p==='explainableDecision'&&['الحالات المطابقة','الأولوية الحرجة','الأولوية المرتفعة','ثقة تغطية عالية'].includes(label))formula+=' '+SMART_SCORE;
  if(el.matches('.insight-card')&&p==='analytics'){
   const name=clean(el.querySelector('span,b')?.textContent);
   const insights={'المخاطر':'COUNT(riskLevel حرج أو مرتفع).','التسويات':MATCH,'التصاريح':'COUNT(expiryBand = منتهي).','التصميم':'COUNT(designAgeDays >60).','تغطية الأمتار':GROSS,'فجوة الأمتار':GAP,'التصاريح الزمنية':'COUNT(منتهي) + COUNT(0–7 أيام).','رصيد «عليه أمتار»':'Σ balance للقيم الموجبة من علاقات التسوية.'};
   formula=insights[name]||formula;
  }
  condition=el.matches('.us-kpi')?'هذه قراءة من الملخص المفلتر لمحرك التحليل، وقد تختلف معادلة «الأولوية المحلية» عن riskScore التشغيلي المعروض في صفحة المشاريع.':'يُحدد الشرط كما في المعادلة، وتُحسب القيم المفقودة أو غير الصالحة بحسب المصدر الأصلي؛ لا يُستنتج إنجاز تنفيذ من مجرد اكتمال الحقول.';
 }
 if(el.matches('.us-panel')&&!canvas){
  const name=clean(el.querySelector('.us-panel-head h3')?.textContent)||label;
  const known={
   'اكتمال البيانات حسب المجال':'لكل مجال قائمة حقول إجبارية، نسبة الاكتمال = (عدد خلايا هذه الحقول − عدد الخلايا الفارغة) ÷ عدد خلايا الحقول ×100. المشاريع 6 حقول، التصاريح 5، الخطوط 5، التسويات 4.',
   'أعلى المشروعات أولوية':'ترتيب topRiskProjects تنازليًا بدرجة الأولوية المحلية، وعرض أول 8. '+SMART_SCORE,
   'مركز الاستثناءات — الحالات التي تحتاج مراجعة':TABLES['مركز الاستثناءات — الحالات التي تحتاج مراجعة'],
   'أعلى نقاط التدخل الآن':'قواعد نصية مرتبة: مشاريع مرتفعة المخاطر، تصاريح منتهية، فجوة تسوية موجبة، تصميم معلق، ملاحظات جودة؛ تعرض حتى 5 إجراءات بناء على وجود الحالات.',
   'مقارنة آخر لقطة بالسابق':'فرق كل مؤشر = أحدث لقطة − سابقتها من الذاكرة المركزية إن توفرت، وإلا المحلية؛ غياب الخط السابق يعرض «لا يوجد خط أساس».',
   'سجل اللقطات':TABLES['سجل اللقطات'],
   'الاستنتاجات الزمنية':'فرق أحدث لقطة عن أول لقطة لكل مؤشر، ثم رصد أول تاريخ زادت فيه المخاطر/التصاريح المنتهية/الجودة قياسًا باللقطة السابقة.',
   'أعلى مسببات/مناطق التركّز':TABLES['أعلى مسببات/مناطق التركّز'],
   'قرارات مطلوبة للأسبوع القادم':'اقتراحات قواعد تشغيلية وفق حالة المخاطر والتصاريح والتسويات والتصميم وجودة البيانات؛ لا تحتوي على تنبؤ إحصائي خارجي.'
  };
  if(known[name])formula=known[name];
 }
 if(p==='smartThursday'&&THURSDAY[label])formula=THURSDAY[label];
 if(label==='تغطية خريطة المشاريع')dataSource='Google Sheets: vd projects؛ عمودا الإحداثيات Z وAA (الصفوف المفلترة)';
 if(label==='تغطية خريطة الخطوط البديلة')dataSource='Google Sheets: Alternative lines؛ عمودا الإحداثيات G وH (الصفوف المفلترة)';
 const active=window.VDUrgent?.getState?.(),period=active?.periods?.get?.(p);
 const periodText=period?.from||period?.to?'الفترة: '+(period.from||'بداية البيانات')+' إلى '+(period.to||'نهاية البيانات')+'. ':'';
 const filterText=(p==='followup'||p==='quality')?'هذه الشاشة تقرأ مجموعة الفحص/نتائج Pivot وفق مصدرها، ولا تفترض أن فلاتر المؤشرات الأخرى تعيد حساب Pivot الورقة.':FILTER;
 notes=periodText+filterText;
 return {title:label||'عنصر تحليلي',formula,condition,example:dynamicExample(el,p,label,kind),dataSource,notes,kind};
}
function open(el){
 const modal=document.getElementById('vdInfoModal'),body=document.getElementById('vdInfoBody'),head=document.getElementById('vdInfoTitle');if(!modal||!body||!head)return;
 const info=infoFor(el);head.textContent=info.title;
 const rows=[['المعادلة الفعلية التفصيلية',info.formula],['الشروط والاستثناءات',info.condition],['مثال بالقيم الحالية',info.example],['مصدر البيانات والربط',info.dataSource],['الفلاتر وأساس الفترة',info.notes]];
 body.innerHTML=rows.map(([name,value])=>'<div class="vd-info-row vd-help-detail-row"><b>'+esc(name)+'</b><span>'+esc(value)+'</span></div>').join('');
 modal.classList.add('show');modal.setAttribute('aria-hidden','false');
}
const selector='.kpi-card,.panel,.table-panel,.map-panel,.insight-card,.us-kpi,.us-panel,.us-table-wrap,.stp-section-card,.stp-panel,.dq-hero-score,.dq-overview-card,.dq-card,.dq-smart-card,.dq-smart-total,.dq-section-metrics,.dq-table-wrap,.sheet-report-table,.sheet-contractor-report';
function decorate(){
 const host=document.getElementById('pageHost');if(!host)return;
 host.querySelectorAll(selector).forEach(el=>{
  const old=el.querySelector(':scope > .vd-info-btn');
  if(old){old.textContent='!';old.title='المعادلة التفصيلية ومثال من البيانات الفعلية';old.setAttribute('aria-label','شرح احتساب '+titleOf(el));return;}
  if(el.dataset.vdDetailedHelp==='1')return;el.dataset.vdDetailedHelp='1';el.classList.add('vd-info-host');
  const insideButton=el.tagName==='BUTTON';
  const icon=document.createElement(insideButton?'span':'button');
  if(!insideButton)icon.type='button';else{icon.setAttribute('role','button');icon.tabIndex=0;}
  icon.className='vd-info-btn vd-detail-info';icon.textContent='!';icon.title='شرح المعادلة الفعلية والمصدر والشروط ومثال حي';icon.setAttribute('aria-label','تفاصيل احتساب '+titleOf(el));
  const handler=e=>{e.preventDefault();e.stopPropagation();open(el);};
  icon.addEventListener('click',handler);
  if(insideButton)icon.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){handler(e)}});
  el.appendChild(icon);
 });
}
let scheduled=false;
function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;try{decorate()}catch(e){console.warn('VD detailed help',e)}})}
window.VDUrgentHelp={open,decorate,infoFor,formulas:{METRICS,CHARTS,TABLES}};
document.addEventListener('vd:urgent-page',schedule);
document.addEventListener('vd:page-rendered',schedule);
document.addEventListener('vd:urgent-data',schedule);
document.addEventListener('DOMContentLoaded',schedule);
if(document.readyState!=='loading')schedule();
const host=document.getElementById('pageHost');
if(host)new MutationObserver(records=>{
 if(records.some(r=>[...r.addedNodes].some(n=>n.nodeType===1&&!n.matches?.('.vd-info-btn'))))schedule();
}).observe(host,{childList:true,subtree:true});
})();