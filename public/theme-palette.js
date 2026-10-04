(()=>{'use strict';
const themes=[
 ['light','أبيض','#ffffff'],['lavender','لافندر','#b9a3e3'],['purple','موف','#8064c9'],['blue','أزرق','#397bc0'],['sky','سماوي','#3aa7c4'],['green','أخضر','#43996c'],['mint','نعناعي','#36a88e'],['orange','برتقالي','#df8a3a'],['gold','ذهبي','#b99839'],['pink','وردي','#c56d92'],
 ['charcoal','فحمي','#3d424e'],['navy','كحلي','#203653'],['midnight','ليلي أزرق','#16263e'],['forest','أخضر داكن','#1f4034'],['plum','موف داكن','#493052'],['burgundy','خمري داكن','#4d2631']
];
function apply(name){
 document.documentElement.dataset.vdTheme=name;localStorage.setItem('vd.urgent.palette',name);
 const t=themes.find(x=>x[0]===name)||themes[0];document.querySelector('#vdThemeLabel')?.replaceChildren(document.createTextNode(t[1]));const d=document.querySelector('#vdThemeDot');if(d)d.style.background=t[2];
 window.dispatchEvent(new CustomEvent('vd:theme-changed',{detail:{theme:name}}));
}
function mount(){
 const actions=document.querySelector('.top-actions');if(!actions||document.querySelector('#vdThemePicker'))return;
 const wrap=document.createElement('div');wrap.className='vd-theme-wrap';wrap.id='vdThemePicker';
 wrap.innerHTML='<button type="button" class="vd-theme-btn"><i id="vdThemeDot"></i><span id="vdThemeLabel">ألوان</span><b>⌄</b></button><div class="vd-theme-panel" hidden><header><strong>ألوان الواجهة</strong><small>فاتح / غامق</small></header><div class="vd-theme-grid">'+themes.map(t=>'<button type="button" data-theme="'+t[0]+'"><i style="background:'+t[2]+'"></i><span>'+t[1]+'</span></button>').join('')+'</div></div>';
 actions.insertBefore(wrap,actions.firstChild);
 const panel=wrap.querySelector('.vd-theme-panel'),btn=wrap.querySelector('.vd-theme-btn');btn.onclick=e=>{e.stopPropagation();panel.hidden=!panel.hidden};
 wrap.querySelectorAll('[data-theme]').forEach(b=>b.onclick=()=>{apply(b.dataset.theme);panel.hidden=true});
 document.addEventListener('click',e=>{if(!wrap.contains(e.target))panel.hidden=true});
 const legacy=document.querySelector('#themeBtn');if(legacy)legacy.hidden=true;
 apply(localStorage.getItem('vd.urgent.palette')||'light');
}
document.addEventListener('DOMContentLoaded',mount);
})();