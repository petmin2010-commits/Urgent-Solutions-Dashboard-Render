(()=>{
'use strict';
const state={ready:false,all:false,allow:new Set(),observer:null};
const norm=v=>String(v??'').normalize('NFKC').replace(/[\u064B-\u065F\u0670]/g,'').replace(/ـ/g,'').replace(/[أإآ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي').replace(/[^\p{L}\p{N}]+/gu,' ').replace(/\s+/g,' ').trim().toLowerCase();
const labelOf=el=>String(el?.querySelector('b')?.textContent||el?.textContent||'').trim();
function can(label,key=''){if(state.all)return true;const a=norm(label),k=norm(key);return state.allow.has(a)||state.allow.has(k)}
function allowed(el){return can(labelOf(el),el?.dataset?.page||'')}
function apply(){
 if(!state.ready)return;
 const items=[...document.querySelectorAll('#nav .nav-item')];
 items.forEach(el=>{const ok=allowed(el);el.hidden=!ok;el.style.display=ok?'':'none';el.setAttribute('aria-hidden',ok?'false':'true');if(!ok)el.classList.remove('active')});
 document.querySelectorAll('#nav .nav-group').forEach(g=>{const ok=[...g.querySelectorAll('.nav-item')].some(x=>!x.hidden&&x.style.display!=='none');g.hidden=!ok;g.style.display=ok?'':'none'});
 const active=items.find(x=>x.classList.contains('active')&&!x.hidden&&x.style.display!=='none');
 if(!active){const first=items.find(x=>!x.hidden&&x.style.display!=='none');if(first)first.click()}
}
document.addEventListener('click',e=>{if(!state.ready)return;const item=e.target.closest?.('#nav .nav-item');if(!item||allowed(item))return;e.preventDefault();e.stopImmediatePropagation();window.dispatchEvent(new CustomEvent('vd:toast',{detail:'لا توجد صلاحية لهذه الشاشة'}))},true);
async function start(){
 try{
  const r=await fetch('/api/auth/me',{credentials:'same-origin',cache:'no-store'});if(r.status===401)return location.replace('/login');if(!r.ok)throw new Error('PERMISSIONS_LOAD_FAILED');
  const j=await r.json(),p=Array.isArray(j?.user?.permissions)?j.user.permissions:[];state.allow=new Set(p.map(norm).filter(Boolean));state.all=!p.length||p.some(v=>['*','all','الكل','جميع الصفحات','كامل الصلاحيات'].includes(norm(v)));state.ready=true;
  window.vdCanAccessLabel=(label,key='')=>can(label,key);window.vdAllowedPages=()=>p.slice();apply();
  const nav=document.getElementById('nav');if(nav){state.observer=new MutationObserver(apply);state.observer.observe(nav,{childList:true,subtree:true,attributes:true,attributeFilter:['class']})}
 }catch(e){console.error('Urgent access-control:',e)}
}
window.VDUrgentAccess={apply,can:(label,key='')=>can(label,key)};
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',start,{once:true}):start();
})();