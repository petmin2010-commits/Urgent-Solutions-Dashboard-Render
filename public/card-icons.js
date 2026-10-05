(()=>{'use strict';

const SELECTOR='.kpi-card,.us-kpi,.dq-overview-card,.dq-card,.dq-smart-card,.insight-card,.report-card,.quality-item,.rc-card';

const ICONS={
 project:'<path d="M4 20V8l8-4 8 4v12"/><path d="M8 20v-6h8v6"/><path d="M8 10h.01M12 10h.01M16 10h.01"/>',
 permit:'<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5"/><path d="m9 15 2 2 4-4"/>',
 route:'<circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M7.5 16.5 16.5 7.5"/><path d="M9 6h4M11 4v4"/>',
 ruler:'<path d="M4 17 17 4l3 3L7 20z"/><path d="m12 9 3 3M9 12l2 2M15 6l2 2"/>',
 shield:'<path d="M12 3 19 6v5c0 4.7-2.9 8-7 10-4.1-2-7-5.3-7-10V6z"/><path d="m9 12 2 2 4-4"/>',
 complaint:'<path d="M4 5h16v11H9l-5 4z"/><path d="M12 8v4"/><path d="M12 14h.01"/>',
 execution:'<circle cx="12" cy="12" r="8"/><path d="m8.5 12 2.2 2.2L16 9"/><path d="M12 2v2M12 20v2"/>',
 users:'<circle cx="9" cy="9" r="3"/><circle cx="16.5" cy="10.5" r="2.5"/><path d="M3.5 20c.5-4 2.5-6 5.5-6s5 2 5.5 6"/><path d="M14 15c3 0 5 1.7 5.5 5"/>',
 municipality:'<path d="M4 9h16"/><path d="M6 9v9M10 9v9M14 9v9M18 9v9"/><path d="M3 20h18"/><path d="m12 3 8 4H4z"/>',
 trace:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
 quality:'<ellipse cx="10" cy="6" rx="6" ry="3"/><path d="M4 6v6c0 1.7 2.7 3 6 3"/><path d="M4 12v4c0 1.7 2.7 3 6 3"/><circle cx="17" cy="16" r="4"/><path d="m15.5 16 1 1 2-2"/>',
 risk:'<path d="M12 3 22 20H2z"/><path d="M12 9v5"/><path d="M12 17h.01"/>',
 analytics:'<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/><path d="m4 8 6-4 6 6 5-4"/>',
 smart:'<circle cx="12" cy="12" r="7"/><path d="M12 7v10M7 12h10"/><path d="M5 5l2 2M19 5l-2 2M5 19l2-2M19 19l-2-2"/>',
 memory:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/><path d="M5 4 3 6"/>',
 audit:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/><path d="m8 11 1.7 1.7L13 9.5"/>',
 decision:'<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/><circle cx="12" cy="12" r="1"/>',
 report:'<path d="M6 3h9l3 3v15H6z"/><path d="M15 3v4h4"/><path d="M9 11h6M9 15h6M9 18h4"/>',
 calendar:'<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 9h16"/><path d="M8 13h3M13 13h3M8 17h3"/>',
 map:'<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15M15 6v15"/>',
 total:'<path d="M18 5H7l5 7-5 7h11"/><path d="M7 5h11M7 19h11"/>',
 progress:'<path d="M4 17a8 8 0 0 1 16 0"/><path d="m12 13 4-4"/><circle cx="12" cy="17" r="1"/>',
 alertclock:'<circle cx="11" cy="12" r="8"/><path d="M11 8v5l3 2"/><path d="M20 4v4M20 10h.01"/>',
 link:'<path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1"/>',
 default:'<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/>'
};

const PAGE_FALLBACK={
 master:'analytics',projects:'project',map:'map',permits:'permit',lines:'route',settlements:'ruler',
 guarantees:'shield',complaints:'complaint',execution:'execution',parties:'users',municipalities:'municipality',
 traceability:'trace',quality:'quality',risks:'risk',analytics:'analytics',smartCenter:'smart',
 temporalMemory:'memory',investigationRoom:'audit',explainableDecision:'decision',smartThursday:'calendar',
 followup:'report',reports:'report'
};

function norm(v=''){
 return String(v).normalize('NFKD').replace(/[\u064B-\u065F\u0670]/g,'').replace(/[إأآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/[^\p{L}\p{N}%]+/gu,' ').replace(/\s+/g,' ').trim().toLowerCase();
}
function cardLabel(card){
 const el=card.querySelector('.rc-card-copy strong,:scope > span,:scope > b,:scope > h3,:scope > h4,.panel-head b');
 return (el?.textContent||card.getAttribute('aria-label')||card.getAttribute('title')||'').trim();
}
function keyFor(label,page=''){
 const t=norm(label);
 const rules=[
  [/جوده|اكتمال|صحه البيانات|مشاكل البيانات|ملاحظات البيانات/, 'quality'],
  [/ذاكره|زمني|لقطه|تاريخ الالتقاط|قديم|عمر الافاده/, 'memory'],
  [/تدقيق|تحقيق|فحص|مراجعه ذكيه/, 'audit'],
  [/قرار|اولويه|اجراء مقترح|توصيه/, 'decision'],
  [/صحه المشروع|انجاز|نسبه|تغطيه|اتجاه|مؤشر/, 'analytics'],
  [/ذكاء|ذكي|تحليل ذكي/, 'smart'],
  [/مخاطر|خطر|حرج|عاليه|عالي/, 'risk'],
  [/شكوي|شكاوي|بلاغ/, 'complaint'],
  [/ضمان/, 'shield'],
  [/تصريح|تصاريح|اعتماد/, 'permit'],
  [/خطوط بديله|خط بديل|مسار|route/, 'route'],
  [/امتار|متر|تسويه|تسويات|اطوال|طول/, 'ruler'],
  [/مقاول|مقاولين|كادر|مهندس|ملاك|مالك/, 'users'],
  [/بلديه|بلديات|امانه/, 'municipality'],
  [/تتبع|360|مطابقه|ترابط/, 'trace'],
  [/خريطه|موقع|حي|احياء/, 'map'],
  [/تنفيذ|تسليم|منجز|مستوفي|مكتمل/, 'execution'],
  [/متاخر|منتهي|انتهاء/, 'alertclock'],
  [/رابط|ارشيف|pcloud/, 'link'],
  [/خميس|اسبوع|موعد/, 'calendar'],
  [/تقرير|pdf|متابعه|ورقه reports/, 'report'],
  [/مشروع|مشاريع|ضخ/, 'project'],
  [/تحليل/, 'analytics'],
  [/اجمالي|عدد|total|grand total/, 'total']
 ];
 for(const [re,key] of rules)if(re.test(t))return key;
 return PAGE_FALLBACK[page]||'default';
}
function svg(key){
 const body=ICONS[key]||ICONS.default;
 return '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">'+body+'</svg>';
}
function pageKey(){
 return window.VDUrgent?.getState?.()?.page||document.querySelector('#nav .nav-item.active')?.dataset?.page||'';
}
function ensureIcon(card){
 if(!card||card.dataset.vdCardIconReady==='1')return;
 const label=cardLabel(card),key=keyFor(label,pageKey());
 let holder=null;
 if(card.classList.contains('rc-card')) holder=card.querySelector('.rc-card-icon');
 else if(card.matches('.dq-card,.dq-smart-card')) holder=card.querySelector(':scope > i');
 else holder=card.querySelector(':scope > .vd-card-icon');
 if(!holder){
  holder=document.createElement('span');
  holder.className='vd-card-icon';
  card.prepend(holder);
 }
 holder.classList.add('vd-card-icon');
 holder.dataset.iconKey=key;
 holder.innerHTML=svg(key);
 card.dataset.vdCardIconKey=key;
 card.dataset.vdCardIconReady='1';
 card.classList.add('vd-has-card-icon');
}
function decorate(root=document){
 root.querySelectorAll?.(SELECTOR).forEach(ensureIcon);
}
let queued=false;
function schedule(root=document){
 if(queued)return;queued=true;
 requestAnimationFrame(()=>{queued=false;decorate(root)});
}
window.VDCardIcons={decorate,resolve:keyFor,svg};
window.addEventListener('vd:page-rendered',()=>schedule(document.getElementById('pageHost')||document));
document.addEventListener('DOMContentLoaded',()=>schedule(document));
const target=document.getElementById('pageHost');
if(target)new MutationObserver(()=>schedule(target)).observe(target,{childList:true,subtree:true});
else new MutationObserver(()=>schedule(document)).observe(document.documentElement,{childList:true,subtree:true});
schedule(document);
})();