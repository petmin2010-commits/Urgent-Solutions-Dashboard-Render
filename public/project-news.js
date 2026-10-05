(()=>{'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const SPEEDS=[0.75,1,1.5,2,3,4],SPEED_KEY='vd.urgent.projectNews.speed';
let paused=false,lastRows=[],timer=null,offset=0,lastFeedSig='',speed=1;
function tone(v){const s=String(v||'').trim();if(/عاجل|urgent/i.test(s))return'urgent';if(/مهم|important|تنبيه/i.test(s))return'important';if(/إنجاز|انجاز|تحسن|نجاح|achievement|improvement/i.test(s))return'positive';return'update'}
function cleanDate(v){const s=String(v||'').trim();if(!s)return'';const d=new Date(s);if(isNaN(d))return s;try{return new Intl.DateTimeFormat('ar-SA-u-ca-gregory',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}).format(d)}catch{return s}}
function item(r){const url=String(r.sheetUrl||'').trim(),sheet=String(r.sourceSheet||'').trim(),help=[r.summary,sheet?('اضغط لفتح ورقة: '+sheet):''].filter(Boolean).join(' — '),tip=help?' title="'+esc(help)+'"':'',open=url?' href="'+esc(url)+'" target="_blank" rel="noopener noreferrer"':'',tag=url?'a':'span';return '<'+tag+' class="news-item"'+open+tip+'><span class="news-source sheet">Smart News ⚡</span><span class="news-priority '+tone(r.priority)+'">'+esc(r.priority||'تحديث')+'</span><span class="news-category">'+esc(r.category||'عام')+'</span><span class="news-title">'+esc(r.title||'')+'</span>'+(r.date?'<span class="news-date">'+esc(cleanDate(r.date))+'</span>':'')+'</'+tag+'><span class="news-sep">◆</span>'}
function loadSpeed(){try{const v=Number(localStorage.getItem(SPEED_KEY));if(SPEEDS.includes(v))speed=v}catch{}}
function syncSpeedButton(){const b=document.getElementById('projectNewsSpeed');if(!b)return;b.textContent=speed+'×';b.dataset.speed=String(speed);b.title='سرعة مرور الخبر: '+speed+'×';b.setAttribute('aria-label','سرعة مرور الخبر '+speed+'×')}
function cycleSpeed(){const i=SPEEDS.indexOf(speed);speed=SPEEDS[(i+1)%SPEEDS.length];try{localStorage.setItem(SPEED_KEY,String(speed))}catch{}syncSpeedButton()}
function stopMotion(){if(timer){clearInterval(timer);timer=null}}
function startMotion(){
 stopMotion();const track=document.getElementById('projectNewsTrack'),group=track?.querySelector('.news-group');
 if(!track||!group||lastRows.length<2)return;const cycle=Math.max(0,group.offsetWidth);
 if(cycle<=0){offset=0;track.style.transform='translateX(0px)';return}
 offset=-cycle;track.style.transform='translateX('+offset+'px)';
 timer=setInterval(()=>{if(paused)return;offset+=speed;if(offset>=0)offset=-cycle;track.style.transform='translateX('+offset+'px)'},45);
}
function render(rows){
 lastRows=Array.isArray(rows)?rows.filter(Boolean):[];
 const host=document.getElementById('projectNewsTicker'),track=document.getElementById('projectNewsTrack'),btn=document.getElementById('projectNewsPause'),speedBtn=document.getElementById('projectNewsSpeed');
 if(!host||!track)return;stopMotion();track.style.transform='translateX(0px)';
 if(!lastRows.length){host.classList.add('is-empty');track.innerHTML='<span class="news-empty-message">لا توجد أخبار جديدة أو فجوات نشطة حاليًا.</span>';if(btn)btn.style.display='none';if(speedBtn)speedBtn.style.display='none';return}
 host.classList.remove('is-empty');if(btn)btn.style.display='';if(speedBtn)speedBtn.style.display='';
 const body=lastRows.slice(0,140).map(item).join('');track.innerHTML='<span class="news-group">'+body+'</span><span class="news-group" aria-hidden="true">'+body+'</span>';
 requestAnimationFrame(()=>requestAnimationFrame(startMotion));
}
async function load(){
 const track=document.getElementById('projectNewsTrack');
 try{
  const r=await fetch('/api/rpc',{method:'POST',headers:{'Content-Type':'application/json','Cache-Control':'no-cache'},cache:'no-store',body:JSON.stringify({method:'getProjectNews',args:[]})});
  const data=await r.json().catch(()=>({}));if(!r.ok||data.ok===false)throw new Error(data.message||data.error||('HTTP '+r.status));
  const payload=data.result||data,rows=payload.rows||[],sig=rows.map(x=>[x.eventKey||'',x.date||'',x.title||''].join('|')).join('¦');
  if(sig!==lastFeedSig){lastFeedSig=sig;render(rows)}
 }catch(e){console.error('Smart News load failed:',e);if(track&&!lastRows.length)track.innerHTML='<span class="news-empty-message">تعذر تحميل الأخبار الذكية — اضغط تحديث الصفحة.</span>'}
}
function boot(){
 loadSpeed();syncSpeedButton();
 const btn=document.getElementById('projectNewsPause'),speedBtn=document.getElementById('projectNewsSpeed');
 speedBtn?.addEventListener('click',cycleSpeed);
 btn?.addEventListener('click',()=>{paused=!paused;document.getElementById('projectNewsTicker')?.classList.toggle('is-paused',paused);btn.textContent=paused?'▶':'❚❚';btn.setAttribute('aria-label',paused?'تشغيل شريط الأخبار':'إيقاف شريط الأخبار')});
 load();setInterval(load,60*1000);window.addEventListener('focus',load);document.addEventListener('visibilitychange',()=>{if(!document.hidden)load()});window.addEventListener('resize',()=>{if(lastRows.length)startMotion()});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
window.refreshProjectNews=load;
})();