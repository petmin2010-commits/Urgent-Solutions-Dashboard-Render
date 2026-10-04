(()=>{'use strict';
const state={permissions:[],ready:false,observer:null};
const norm=v=>(window.VDParity?.norm?window.VDParity.norm(v):String(v??'').trim().toLowerCase());
const allKeys=new Set(['*','all',norm('الكل'),norm('جميع الصفحات'),norm('كامل الصلاحيات')]);
function allowed(label,key){
  const p=state.permissions||[];if(!p.length||p.some(x=>allKeys.has(norm(x))))return true;
  return p.some(x=>norm(x)===norm(label)||norm(x)===norm(key));
}
function apply(){
  document.querySelectorAll('.nav-item[data-page]').forEach(el=>{
    const label=el.querySelector('b')?.textContent||el.textContent||'',key=el.dataset.page||'';
    const ok=allowed(label,key);el.hidden=!ok;el.setAttribute('aria-hidden',ok?'false':'true');
  });
  document.querySelectorAll('[data-permission]').forEach(el=>{el.hidden=!allowed(el.dataset.permission,el.dataset.permission)});
}
async function load(){
  try{const r=await fetch('/api/auth/me',{cache:'no-store'});if(r.status===401)return location.replace('/login');const j=await r.json();state.permissions=j.user?.permissions||[];state.ready=true;apply();
    if(state.observer)state.observer.disconnect();state.observer=new MutationObserver(apply);state.observer.observe(document.body,{childList:true,subtree:true});
    window.vdCanAccess=(label,key)=>allowed(label,key);window.vdPermissions=[...state.permissions];
  }catch(e){console.warn('Access control refresh failed',e)}
}
window.addEventListener('vd:user-ready',e=>{state.permissions=e.detail?.permissions||[];state.ready=true;apply()});
document.addEventListener('DOMContentLoaded',load);
})();