(()=>{'use strict';
const TYPES={master:'Dashboard',projects:'Projects',map:'GeographicMap',permits:'Permits',lines:'AlternativeLines',settlements:'MeterSettlements',guarantees:'Guarantees',complaints:'Complaints',execution:'ExecutionHandover',parties:'ContractorsOwners',municipalities:'MunicipalityAnalytics',traceability:'Project360',quality:'DataQuality',risks:'ProjectRisks',analytics:'ExecutiveAnalytics',reports:'ReportsCenter',excelExport:'ExcelExport'};
const AR={master:'تقرير الرئيسية',projects:'تقرير المشاريع',map:'تقرير الخريطة الجغرافية',permits:'تقرير التصاريح',lines:'تقرير الخطوط البديلة والتصميم',settlements:'تقرير الأمتار والتسويات',guarantees:'تقرير الضمانات',complaints:'تقرير الشكاوى',execution:'تقرير التنفيذ والتسليم',parties:'تقرير المقاولين والملاك',municipalities:'تقرير تحليل البلديات',traceability:'تقرير التتبع الشامل',quality:'تقرير جودة البيانات',risks:'تقرير مخاطر المشاريع',analytics:'تقرير التحليل التنفيذي',reports:'مركز التقارير',excelExport:'تقرير Excel'};
const pad=n=>String(n).padStart(2,'0');
function timestamp(d=new Date()){return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())+'_'+pad(d.getHours())+'-'+pad(d.getMinutes())+'-'+pad(d.getSeconds())}
function pageKey(){return document.querySelector('.nav-item.active')?.dataset?.page||window.__urgentCurrentPage||'master'}
function meaningful(el){if(!el||el.hidden)return false;const t=String(el.type||'').toLowerCase();if(['button','submit','hidden','file'].includes(t))return false;if(['checkbox','radio'].includes(t))return !!el.checked;const v=String(el.value||'').trim();return !!v&&!['all','الكل','جميع البيانات','كامل المدة'].includes(v.toLowerCase())}
function hasFilters(){if(window.__VD_REPORT_SCOPE_OVERRIDE==='General')return false;if(window.__VD_REPORT_SCOPE_OVERRIDE==='Filtered')return true;const controls=[...document.querySelectorAll('#filterBar input,#filterBar select,.table-search,#globalSearch')].filter(Boolean);const chips=document.querySelectorAll('#activeFilters .filter-chip').length;return chips>0||controls.some(meaningful)}
function scope(force=''){const f=force||window.__VD_REPORT_SCOPE_OVERRIDE||'';if(f==='General'||f==='Filtered')return f;return hasFilters()?'Filtered':'General'}
function type(key=pageKey()){return TYPES[key]||'Report'}
function arabicTitle(key=pageKey(),force=''){return (AR[key]||'تقرير')+(scope(force)==='Filtered'?' المفلتر':' العام')}
function safe(v){return String(v||'Report').replace(/[\\/:*?"<>|\s]+/g,'_').replace(/_+/g,'_').slice(0,90)}
function build(o={}){const key=o.key||pageKey(),t=o.type||type(key),sc=scope(o.scope||''),stamp=timestamp(o.date||new Date());return ['VD','Jeddah','UrgentSolutions',safe(t),sc,stamp].join('_')}
function make(t,opts={}){return build({type:safe(t||type()),scope:opts.filtered===true?'Filtered':opts.filtered===false?'General':''})}
window.VDReportNaming={build,make,safe,timestamp,stamp:timestamp,pageKey,type,arabicTitle,scope,hasFilters,TYPES,AR};
})();