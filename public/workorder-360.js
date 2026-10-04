(()=>{'use strict';
function mount(){
 const st=window.VDUrgent?.getState?.();if(!st||st.page!=='traceability')return;const host=document.querySelector('#pageHost');if(!host||host.querySelector('#vd360'))return;
 const projects=st.data?.projects||[],el=document.createElement('section');el.id='vd360';el.className='vd360';
 el.innerHTML='<div class="vd360-head"><div><small>PROJECT 360°</small><h3>بحث 360° عن المشروع</h3></div><div class="vd360-search"><input type="search" placeholder="اسم المشروع / المقاول / المالك / الرقم"><button type="button">بحث</button></div></div><div id="vd360Result" class="vd360-result"><span>اكتب أي جزء من اسم المشروع أو المقاول لإظهار الربط الكامل.</span></div>';
 host.prepend(el);const input=el.querySelector('input'),btn=el.querySelector('button');btn.onclick=()=>search(input.value);input.onkeydown=e=>{if(e.key==='Enter')search(input.value)};
 function search(q){q=window.VDParity.norm(q);const out=el.querySelector('#vd360Result');if(!q){out.innerHTML='<span>أدخل قيمة للبحث.</span>';return}
  const rows=projects.filter(p=>[p.no,p.name,p.contractor,p.owner,p.municipality].some(v=>window.VDParity.norm(v).includes(q))).slice(0,10);
  if(!rows.length){out.innerHTML='<span>لا توجد نتائج مطابقة.</span>';return}
  out.innerHTML=rows.map(p=>'<article><h4>'+window.VDParity.esc(p.name||p.no||'مشروع')+'</h4><div><b>المقاول</b><span>'+window.VDParity.esc(p.contractor||'—')+'</span><b>المالك</b><span>'+window.VDParity.esc(p.owner||'—')+'</span><b>البلدية</b><span>'+window.VDParity.esc(p.municipality||'—')+'</span><b>التصريح</b><span>'+window.VDParity.esc(p.permitStatus||p.permitRefs||'—')+'</span><b>الضمان</b><span>'+window.VDParity.esc(p.guaranteeStatus||'—')+'</span><b>المخاطر</b><span>'+window.VDParity.esc(p.riskLevel||'—')+'</span></div></article>').join('');
 }
}
window.addEventListener('vd:page-rendered',mount);
})();