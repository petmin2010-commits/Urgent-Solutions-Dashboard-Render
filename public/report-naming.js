(()=>{'use strict';
const pad=n=>String(n).padStart(2,'0');
function stamp(d=new Date()){return d.getFullYear()+pad(d.getMonth()+1)+pad(d.getDate())+'_'+pad(d.getHours())+pad(d.getMinutes())+pad(d.getSeconds())}
function safe(v){return String(v||'Report').replace(/[\\/:*?"<>|\s]+/g,'_').replace(/_+/g,'_').slice(0,90)}
function make(type,opts={}){
 const state=window.VDUrgent?.getState?.()||{},page=state.page||'master',filtered=opts.filtered??(window.VDUrgent?.activeFilterCount?.()>0);
 const city='Jeddah',scope=filtered?'Filtered':'General';
 return 'VD_UrgentSolutions_'+city+'_'+safe(type||page)+'_'+scope+'_'+stamp();
}
window.VDReportNaming={make,safe,stamp};
})();