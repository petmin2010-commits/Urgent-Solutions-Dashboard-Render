(()=>{
  const SELECTOR='.vd-proximity-logo';
  let raf=0,last=null;
  const reset=(el)=>{
    el.classList.remove('is-near');
    el.style.setProperty('--vd-rot-x','0deg');
    el.style.setProperty('--vd-rot-y','0deg');
    el.style.setProperty('--vd-shift-x','0px');
    el.style.setProperty('--vd-shift-y','0px');
    el.style.setProperty('--vd-glow','0');
  };
  const render=()=>{
    raf=0;
    if(!last)return;
    const x=last.clientX,y=last.clientY;
    document.querySelectorAll(SELECTOR).forEach(el=>{
      const r=el.getBoundingClientRect();
      if(!r.width||!r.height)return;
      const cx=r.left+r.width/2,cy=r.top+r.height/2;
      const dx=x-cx,dy=y-cy;
      const distance=Math.hypot(dx,dy);
      const radius=Math.max(170,Math.min(260,Math.max(r.width,r.height)*3.2));
      if(distance>radius){reset(el);return;}
      const power=1-distance/radius;
      const strength=parseFloat(el.dataset.proximityStrength||'1')||1;
      const nx=Math.max(-1,Math.min(1,dx/(radius*.62)));
      const ny=Math.max(-1,Math.min(1,dy/(radius*.62)));
      el.classList.add('is-near');
      el.style.setProperty('--vd-rot-x',(-ny*5*strength).toFixed(2)+'deg');
      el.style.setProperty('--vd-rot-y',(nx*6*strength).toFixed(2)+'deg');
      el.style.setProperty('--vd-shift-x',(nx*2.6*strength*power).toFixed(2)+'px');
      el.style.setProperty('--vd-shift-y',(ny*2.1*strength*power-2.5*power).toFixed(2)+'px');
      el.style.setProperty('--vd-glow',(power*strength).toFixed(3));
    });
  };
  window.addEventListener('pointermove',e=>{last=e;if(!raf)raf=requestAnimationFrame(render)},{passive:true});
  window.addEventListener('blur',()=>document.querySelectorAll(SELECTOR).forEach(reset));
  document.addEventListener('pointerleave',()=>document.querySelectorAll(SELECTOR).forEach(reset));
})();