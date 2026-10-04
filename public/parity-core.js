(()=>{'use strict';
const norm=v=>String(v??'').normalize('NFKC').replace(/[\u064B-\u065F\u0670]/g,'').replace(/[أإآ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي').replace(/[^\p{L}\p{N}]+/gu,' ').trim().toLowerCase();
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const api=()=>window.VDUrgent||{};
function emit(name,detail){window.dispatchEvent(new CustomEvent(name,{detail}))}
function ensureInfoButtons(){
  document.querySelectorAll('.kpi-card,.panel,.table-panel').forEach((el,i)=>{
    if(el.querySelector(':scope > .vd-tech-info,:scope > .vd-info-btn'))return;
    const b=document.createElement('button');b.type='button';b.className='vd-tech-info';b.textContent='!';b.title='المنهجية ومصدر الاحتساب';
    b.addEventListener('click',e=>{e.stopPropagation();const a=api(),title=el.querySelector('b,h3,span')?.textContent?.trim()||'تفاصيل الاحتساب';a.showInfo?.(title);});
    el.appendChild(b);
  });
}
function enhanceTables(){
  document.querySelectorAll('.table-scroll table').forEach(t=>{
    if(t.dataset.vdEnhanced)return;t.dataset.vdEnhanced='1';
    const wrap=t.closest('.table-panel');if(!wrap)return;
    const head=wrap.querySelector('.table-tools');if(!head)return;
    const count=document.createElement('span');count.className='vd-visible-count';
    const refresh=()=>{const rows=[...t.querySelectorAll('tbody tr')];count.textContent=rows.filter(r=>r.style.display!=='none').length+' صف';};
    head.appendChild(count);refresh();
    const obs=new MutationObserver(refresh);obs.observe(t.querySelector('tbody')||t,{subtree:true,attributes:true,attributeFilter:['style'],childList:true});
  });
}
function globalSearchBridge(){
  const input=document.querySelector('#globalSearch');if(!input||input.dataset.vdBound)return;input.dataset.vdBound='1';
  input.addEventListener('input',()=>{
    const q=norm(input.value);
    document.querySelectorAll('#pageHost .table-search').forEach(x=>{x.value=input.value;x.dispatchEvent(new Event('input'));});
    document.querySelectorAll('#pageHost .kpi-card,.panel').forEach(el=>{if(!q){el.classList.remove('vd-search-dim');return}el.classList.toggle('vd-search-dim',!norm(el.textContent).includes(q));});
  });
}
function afterRender(){ensureInfoButtons();enhanceTables();globalSearchBridge();emit('vd:parity-ready',{page:api().getState?.()?.page||''});}
window.addEventListener('vd:page-rendered',afterRender);
window.addEventListener('vd:urgent-data',()=>emit('vd:data-ready',api().getState?.()?.data));
document.addEventListener('DOMContentLoaded',afterRender);
window.VDParity={norm,esc,emit,afterRender};
})();