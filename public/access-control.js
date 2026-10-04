(()=>{'use strict';
const state={ready:false,all:false,allow:new Set(),observer:null};
const norm=v=>String(v??'').normalize('NFKC').replace(/[\u064B-\u065F\u0670]/g,'').replace(/ـ/g,'').replace(/[أإآ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي').replace(/[^\p{L}\p{N}]+/gu,' ').replace(/\s+/g,' ').trim().toLowerCase();
const labelOf=el=>String(el?.querySelector('b')?.textContent||el?.textContent||'').trim();
function can(label,key=''){if(state.all)return true;const a=norm(label),k=norm(key);return state.allow.has(a)||state.allow.has(k)}
function allowed(el){return can(labelOf(el),el?.dataset?.page||'')}
function setPermissions(p){
 const arr=Array.isArray(p)?p:[];state.allow=new Set(arr.map(norm).filter(Boolean));state.all=!arr.length||arr.some(v=>String(v??'').trim()==='*'||['all','الكل','جميع الصفحات','كامل الصلاحيات'].includes(norm(v)));state.ready=true;
 window.vdCanAccessLabel=(label,key='')=>can(label,key);window.vdAllowedPages=()=>arr.slice();apply();
}
function apply(){
 if(!state.ready)return;
 const items=[...document.querySelectorAll('#nav .nav-item')];
 items.forEach(el=>{
  const ok=allowed(el),hidden=!ok,display=ok?'':'none',aria=ok?'false':'true';
  if(el.hidden!==hidden)el.hidden=hidden;
  if(el.style.display!==display)el.style.display=display;
  if(el.getAttribute('aria-hidden')!==aria)el.setAttribute('aria-hidden',aria);
  if(!ok&&el.classList.contains('active'))el.classList.remove('active');
 });
 document.querySelectorAll('#nav .nav-group').forEach(g=>{
  const ok=[...g.querySelectorAll('.nav-item')].some(x=>!x.hidden&&x.style.display!=='none'),hidden=!ok,display=ok?'':'none';
  if(g.hidden!==hidden)g.hidden=hidden;
  if(g.style.display!==display)g.style.display=display;
 });
 const active=items.find(x=>x.classList.contains('active')&&!x.hidden&&x.style.display!=='none');
 if(!active){const first=items.find(x=>!x.hidden&&x.style.display!=='none');if(first)first.click()}
 document.querySelectorAll('[data-permission]').forEach(el=>{const hidden=!can(el.dataset.permission,el.dataset.permission);if(el.hidden!==hidden)el.hidden=hidden});
}
document.addEventListener('click',e=>{if(!state.ready)return;const item=e.target.closest?.('#nav .nav-item');if(!item||allowed(item))return;e.preventDefault();e.stopImmediatePropagation();window.VDUrgent?.toast?.('لا توجد صلاحية لهذه الشاشة')},true);
async function start(){try{const r=await fetch('/api/auth/me',{credentials:'same-origin',cache:'no-store'});if(r.status===401)return location.replace('/login');if(!r.ok)throw new Error('PERMISSIONS_LOAD_FAILED');const j=await r.json();setPermissions(j?.user?.permissions||[]);const nav=document.getElementById('nav');if(nav){state.observer=new MutationObserver(()=>requestAnimationFrame(apply));state.observer.observe(nav,{childList:true,subtree:true})}}catch(e){console.error('Urgent access-control:',e)}}
window.addEventListener('vd:user-ready',e=>setPermissions(e.detail?.permissions||[]));
window.VDUrgentAccess={apply,can:(label,key='')=>can(label,key)};
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',start,{once:true}):start();
})();