(()=>{
'use strict';
const $=(s,p=document)=>p.querySelector(s),$$=(s,p=document)=>[...p.querySelectorAll(s)];
const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
const norm=v=>clean(v).normalize('NFKC').replace(/[\u064B-\u065F\u0670]/g,'').replace(/[أإآ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي').toLowerCase();
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const THEME_KEY='vd.urgent.theme.palette.v2',GROUP_KEY='vd.urgent.sidebar.group.v2';
const THEMES=[
 ['light','أبيض','#ffffff'],['lavender','لافندر','#b9a3e3'],['purple','موف','#8064c9'],['blue','أزرق','#397bc0'],['sky','سماوي','#3aa7c4'],['green','أخضر','#43996c'],['mint','نعناعي','#36a88e'],['orange','برتقالي','#df8a3a'],['gold','ذهبي','#b99839'],['pink','وردي','#c56d92'],
 ['charcoal','فحمي','#3d424e'],['navy','كحلي','#203653'],['midnight','ليلي أزرق','#16263e'],['forest','أخضر داكن','#1f4034'],['plum','موف داكن','#493052'],['burgundy','خمري داكن','#4d2631']
];
function toast(msg){const el=$('#toast');if(el){el.textContent=msg;el.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove('show'),2400)}}
window.addEventListener('vd:toast',e=>toast(e.detail||''));

function installTheme(){
 const old=$('#themeBtn');if(!old)return;
 const wrap=document.createElement('div');wrap.className='vd-theme-wrap';
 const btn=old.cloneNode(true);btn.id='themeBtn';btn.className='vd-theme-button';btn.innerHTML='<span>🎨</span><i class="vd-theme-dot"></i><span id="vdThemeLabel">ألوان الواجهة</span><span>⌄</span>';
 const panel=document.createElement('div');panel.className='vd-theme-panel';panel.hidden=true;
 panel.innerHTML='<div class="vd-theme-head"><div><b>ألوان الواجهة</b><small>تقنية لوحة كهرباء جدة — فاتح وغامق</small></div><button type="button" class="vd-tech-close" aria-label="إغلاق">×</button></div><div class="vd-theme-grid">'+THEMES.map(x=>'<button type="button" data-theme="'+x[0]+'"><i style="--swatch:'+x[2]+'"></i><span>'+x[1]+'</span></button>').join('')+'</div>';
 old.replaceWith(wrap);wrap.append(btn,panel);
 const apply=(key,persist=true)=>{document.body.dataset.vdTheme=key==='light'?'':key;document.body.classList.remove('theme-soft','theme-sand');const t=THEMES.find(x=>x[0]===key)||THEMES[0],dark=['charcoal','navy','midnight','forest','plum','burgundy'].includes(key);$('#vdThemeLabel').textContent=t[1];$('.vd-theme-dot').style.background=t[2];$$('[data-theme]',panel).forEach(b=>b.classList.toggle('active',b.dataset.theme===key));if(window.Chart){Chart.defaults.color=dark?'#dce8ed':'#000';Object.values(Chart.instances||{}).forEach(c=>{try{c.update('none')}catch(e){}})}if(persist)localStorage.setItem(THEME_KEY,key);window.dispatchEvent(new CustomEvent('vd:themechange',{detail:{theme:key}}))};
 btn.onclick=e=>{e.stopPropagation();panel.hidden=!panel.hidden};
 $('.vd-tech-close',panel).onclick=()=>panel.hidden=true;
 panel.onclick=e=>{const b=e.target.closest('[data-theme]');if(!b)return;apply(b.dataset.theme,true);panel.hidden=true};
 document.addEventListener('click',e=>{if(!wrap.contains(e.target))panel.hidden=true});
 apply(localStorage.getItem(THEME_KEY)||'light',false);
 window.VDUrgentTheme={apply,get:()=>localStorage.getItem(THEME_KEY)||'light'};
}
function installGlobalSearch(){
 const host=$('.top-actions');if(!host||$('#globalSearch'))return;
 const box=document.createElement('div');box.className='vd-global-search';box.innerHTML='<span>⌕</span><input id="globalSearch" type="search" autocomplete="off" placeholder="بحث في الصفحة الحالية...">';
 host.prepend(box);const input=$('#globalSearch');
 const run=()=>{const q=norm(input.value);$$('#pageHost tbody tr').forEach(tr=>tr.classList.toggle('vd-search-hidden',!!q&&!norm(tr.textContent).includes(q)));$$('#pageHost .report-card,#pageHost .quality-item').forEach(el=>el.classList.toggle('vd-search-hidden',!!q&&!norm(el.textContent).includes(q)))};
 input.addEventListener('input',run);window.addEventListener('vd:urgent-page',()=>{input.value='';run()});
 new MutationObserver(()=>{if(input.value)run()}).observe($('#pageHost'),{childList:true,subtree:true});
 document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();input.focus();input.select()}});
}
function installSidebarPersistence(){
 const groups=$$('#nav .nav-group');if(!groups.length)return;
 groups.forEach(g=>{const h=$('.nav-group-head',g);h?.setAttribute('aria-expanded',String(g.classList.contains('is-open')));h?.addEventListener('click',()=>setTimeout(()=>{groups.forEach(x=>$('.nav-group-head',x)?.setAttribute('aria-expanded',String(x.classList.contains('is-open'))));if(g.classList.contains('is-open'))localStorage.setItem(GROUP_KEY,g.dataset.group||'')},0))});
 const saved=localStorage.getItem(GROUP_KEY);if(saved){const g=groups.find(x=>x.dataset.group===saved);if(g){groups.forEach(x=>x.classList.toggle('is-open',x===g))}}
}
function ensureModal(id,title,sub){
 let m=document.getElementById(id);if(m)return m;m=document.createElement('div');m.id=id;m.className='vd-tech-modal';m.innerHTML='<div class="vd-tech-dialog"><div class="vd-tech-head"><div><h3>'+esc(title)+'</h3><small>'+esc(sub||'')+'</small></div><button class="vd-tech-close" type="button">×</button></div><div class="vd-tech-body"></div></div>';document.body.appendChild(m);$('.vd-tech-close',m).onclick=()=>m.classList.remove('show');m.addEventListener('click',e=>{if(e.target===m)m.classList.remove('show')});return m
}
function addTopButton(id,html,title,fn){const host=$('.top-actions');if(!host||$('#'+id))return;const b=document.createElement('button');b.id=id;b.className='vd-tech-btn';b.type='button';b.title=title;b.innerHTML=html;b.onclick=fn;host.appendChild(b)}
function installQR(){
 addTopButton('vdQrBtn','▦','QR للرابط الحالي',()=>{const m=ensureModal('vdQrModal','QR — الرابط الحالي','مشاركة الصفحة الحالية بسرعة');const body=$('.vd-tech-body',m),url=location.origin+location.pathname+'#'+($('.nav-item.active')?.dataset.page||'master');body.innerHTML='<div id="vdQrHost" class="vd-qr-host"></div><div class="vd-qr-url">'+esc(url)+'</div>';m.classList.add('show');const host=$('#vdQrHost');if(window.QRCode){new QRCode(host,{text:url,width:250,height:250,correctLevel:QRCode.CorrectLevel.H})}else host.textContent='تعذر تحميل مولد QR'});
}
function projectMatches(q){
 const d=window.__urgentDashboardData||{},rows=Array.isArray(d.projects)?d.projects:[],nq=norm(q);if(!nq)return rows.slice(0,30);return rows.filter(r=>[r.no,r.name,r.owner,r.contractor,r.municipality,r.permitRefs].some(v=>norm(v).includes(nq))).slice(0,50)
}
function render360Detail(row){
 const m=$('#vd360Modal'),body=$('.vd-tech-body',m),d=window.__urgentDashboardData||{},trace=(d.traceability||[]).find(x=>String(x.no||'')===String(row.no||''))||{};
 const fields=[['رقم المشروع',row.no],['اسم المشروع',row.name],['نوع المشروع',row.projectType],['حالة العقد',row.contractStatus],['المالك',row.owner],['المقاول',row.contractor],['البلدية',row.municipality],['التصاريح',row.permitRefs],['حالة التصريح',row.permitStatus],['أمتار التصاريح',row.permitMeters],['حالة الضمان',row.guaranteeStatus],['مستوى المخاطر',row.riskLevel],['ضغط التمديدات',row.extensionPressure],['عدد الخطوط',trace.lineCount],['مراجع الخطوط',trace.lineRefs],['أمتار الخطوط',trace.lineMeters],['حالات التصميم',trace.designStatuses],['حالات التنفيذ',trace.executionStatuses],['طريقة الربط',trace.matchMethod]];
 body.innerHTML='<div class="vd-tech-search"><button id="vd360Back" type="button">عودة للبحث</button></div><div class="vd-360-grid">'+fields.filter(x=>x[1]!==undefined&&x[1]!==null&&String(x[1])!=='').map(x=>'<div class="vd-360-field"><small>'+esc(x[0])+'</small><b>'+esc(x[1])+'</b></div>').join('')+'</div>';$('#vd360Back').onclick=open360
}
function open360(){
 const m=ensureModal('vd360Modal','Project 360°','عرض المشروع عبر المشاريع والتصاريح والخطوط والتصميم والتنفيذ');const body=$('.vd-tech-body',m);body.innerHTML='<div class="vd-tech-search"><input id="vd360Search" placeholder="ابحث برقم المشروع أو الاسم أو المقاول أو المالك..."><button id="vd360SearchBtn">بحث</button></div><div id="vd360Results" class="vd-360-results"></div>';m.classList.add('show');
 const input=$('#vd360Search'),out=$('#vd360Results');const run=()=>{const rows=projectMatches(input.value);out.innerHTML=rows.length?rows.map((r,i)=>'<div class="vd-360-item" data-i="'+i+'"><b>'+esc((r.no||'—')+' — '+(r.name||''))+'</b><span>'+esc([r.municipality,r.owner,r.contractor,r.riskLevel].filter(Boolean).join(' • '))+'</span></div>').join(''):'<div class="empty">لا توجد نتائج</div>';$$('.vd-360-item',out).forEach(el=>el.onclick=()=>render360Detail(rows[Number(el.dataset.i)]))};$('#vd360SearchBtn').onclick=run;input.oninput=()=>{clearTimeout(input._t);input._t=setTimeout(run,180)};run();input.focus()
}
function install360(){addTopButton('vd360Btn','360°','Project 360',open360)}
async function openAI(){
 const m=ensureModal('vdAiModal','المحلل الذكي','تحليل تنفيذي باستخدام نفس تقنية الذكاء الموجودة في كهرباء جدة');const body=$('.vd-tech-body',m);body.innerHTML='<div class="vd-ai-loading">جاري إعداد القراءة التنفيذية الذكية...</div>';m.classList.add('show');
 try{const page=$('.nav-item.active')?.dataset.page||'master',r=await fetch('/api/ai/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({page})});const j=await r.json();if(!r.ok)throw new Error(j.error||j.message||'AI_UNAVAILABLE');const a=j.analysis||{};const text=[a.current&&('الموقف الحالي: '+a.current),a.risks&&('المخاطر: '+a.risks),a.actions&&('الإجراء المقترح: '+a.actions),j.text].filter(Boolean).join('\n\n');body.innerHTML='<div class="vd-ai-output">'+esc(text||'لا توجد قراءة متاحة').replace(/\n/g,'<br>')+'</div>'}catch(e){body.innerHTML='<div class="empty"><b>المحلل الذكي غير متاح حاليًا</b><span>'+esc(e.message)+'</span></div>'}
}
function installAI(){addTopButton('vdAiBtn','✦','المحلل الذكي',openAI)}
function installStatus(){
 const user=$('.userbox');if(!user||$('#vdSourceBadge'))return;const b=document.createElement('span');b.id='vdSourceBadge';b.className='vd-source-badge';b.innerHTML='<i></i><span>LIVE SHEETS</span>';user.prepend(b);
 window.addEventListener('vd:urgent-data',e=>{const mode=e.detail?.sourceMode||'live',fallback=mode==='snapshot'||mode==='stale-cache';b.classList.toggle('snapshot',fallback);b.querySelector('span').textContent=mode==='snapshot'?'SNAPSHOT FALLBACK':mode==='stale-cache'?'STALE CACHE':'LIVE SHEETS'})
}
function installReportPrint(){
 window.addEventListener('beforeprint',()=>{window.VDCountUp?.finishAll?.();const title=$('#printMetaTitle');if(title&&window.VDReportNaming)title.textContent='إدارة الحلول العاجلة • '+window.VDReportNaming.arabicTitle()});
}
function boot(){installTheme();installGlobalSearch();installSidebarPersistence();installQR();install360();installAI();installStatus();installReportPrint();window.VDUrgentParity={open360,openAI,toast}}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',boot,{once:true}):boot();
})();