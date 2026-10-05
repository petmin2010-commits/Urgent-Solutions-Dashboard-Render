(()=>{
  'use strict';

  const host=document.getElementById('onlineUsers');
  const countEl=document.getElementById('onlineUsersCount');
  if(!host||!countEl)return;

  const HEARTBEAT_MS=25000;
  let timer=null;
  let inFlight=false;

  function setState(count,state){
    host.classList.toggle('is-live',state==='live');
    host.classList.toggle('is-error',state==='error');
    if(Number.isFinite(count))countEl.textContent=String(Math.max(0,Math.trunc(count)));
    else countEl.textContent='—';
  }

  async function heartbeat(){
    if(inFlight||document.visibilityState==='hidden')return;
    inFlight=true;
    try{
      const res=await fetch('/api/presence/heartbeat',{
        method:'POST',
        credentials:'same-origin',
        cache:'no-store',
        headers:{Accept:'application/json'}
      });
      if(!res.ok)throw new Error('presence '+res.status);
      const data=await res.json();
      setState(Number(data?.count),'live');
    }catch(error){
      setState(NaN,'error');
    }finally{
      inFlight=false;
    }
  }

  function start(){
    heartbeat();
    if(timer)clearInterval(timer);
    timer=setInterval(heartbeat,HEARTBEAT_MS);
  }

  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='visible')heartbeat();
  });
  window.addEventListener('focus',heartbeat);
  window.addEventListener('online',heartbeat);
  start();
})();