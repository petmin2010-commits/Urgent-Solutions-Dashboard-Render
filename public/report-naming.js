(()=>{'use strict';

const TYPES={
 master:'Dashboard',
 projects:'Projects',
 map:'GeographicMap',
 permits:'Permits',
 lines:'AlternativeLines',
 settlements:'MeterSettlements',
 guarantees:'Guarantees',
 complaints:'Complaints',
 execution:'ExecutionHandover',
 parties:'ContractorsOwners',
 municipalities:'MunicipalityAnalytics',
 traceability:'Project360',
 quality:'DataQuality',
 risks:'ProjectRisks',
 analytics:'ExecutiveAnalytics',
 smartCenter:'SmartIntelligence',
 temporalMemory:'ProjectTemporalMemory',
 investigationRoom:'SmartInvestigation',
 explainableDecision:'ExplainableDecision',
 smartThursday:'SmartThursday',
 followup:'FollowUp',
 reports:'ReportsCenter',
 excelExport:'ExcelExport'
};

const AR={
 master:'تقرير اللوحة الرئيسية',
 projects:'تقرير المشاريع',
 map:'تقرير الخريطة الجغرافية',
 permits:'تقرير التصاريح',
 lines:'تقرير الخطوط البديلة والتصميم',
 settlements:'تقرير الأمتار والتسويات',
 guarantees:'تقرير الضمانات',
 complaints:'تقرير الشكاوى',
 execution:'تقرير التنفيذ والتسليم',
 parties:'تقرير المقاولين والملاك',
 municipalities:'تقرير تحليل البلديات',
 traceability:'تقرير التتبع الشامل',
 quality:'تقرير جودة البيانات',
 risks:'تقرير مخاطر المشاريع',
 analytics:'تقرير التحليل التنفيذي',
 smartCenter:'تقرير مركز التحليل الذكي',
 temporalMemory:'تقرير ذاكرة المشروع الزمنية',
 investigationRoom:'تقرير غرفة التدقيق الذكية',
 explainableDecision:'تقرير مختبر القرار المتغير',
 smartThursday:'التقرير الهندسي الذكي',
 followup:'تقرير المتابعة',
 reports:'مركز التقارير',
 excelExport:'تقرير Excel'
};

const FOLLOWUP_TYPES={
 'projects-owner':'FollowUp_ProjectsByOwner',
 'permits-year':'FollowUp_PermitsByYear',
 'permits-contractor':'FollowUp_PermitsByContractor',
 'permits-owner':'FollowUp_PermitsByOwner',
 'lines-year':'FollowUp_LinesByYear',
 'lines-contractor':'FollowUp_LinesByContractor',
 'lines-owner':'FollowUp_LinesByOwner',
 'lines-district':'FollowUp_LinesByDistrict'
};

const pad=n=>String(n).padStart(2,'0');
function timestamp(d=new Date()){
 return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())+'_'+pad(d.getHours())+'-'+pad(d.getMinutes())+'-'+pad(d.getSeconds());
}
function pageKey(){return document.querySelector('.nav-item.active')?.dataset?.page||window.__urgentCurrentPage||'master'}
function meaningful(el){
 if(!el||el.hidden)return false;
 const t=String(el.type||'').toLowerCase();
 if(['button','submit','hidden','file'].includes(t))return false;
 if(['checkbox','radio'].includes(t))return !!el.checked;
 const v=String(el.value||'').trim();
 return !!v&&!['all','الكل','جميع البيانات','كامل المدة'].includes(v.toLowerCase());
}
function hasFilters(){
 if(window.__VD_REPORT_SCOPE_OVERRIDE==='General')return false;
 if(window.__VD_REPORT_SCOPE_OVERRIDE==='Filtered')return true;
 const controls=[...document.querySelectorAll('#filterBar input,#filterBar select,.table-search,#globalSearch')].filter(Boolean);
 const chips=document.querySelectorAll('#activeFilters .filter-chip').length;
 return chips>0||controls.some(meaningful);
}
function scope(force=''){
 const f=force||window.__VD_REPORT_SCOPE_OVERRIDE||'';
 if(f==='General'||f==='Filtered')return f;
 return hasFilters()?'Filtered':'General';
}
function type(key=pageKey()){
 const override=String(window.__VD_REPORT_TYPE_OVERRIDE||'').trim();
 return override||TYPES[key]||'Report';
}
function arabicTitle(key=pageKey(),force=''){
 const override=String(window.__VD_REPORT_AR_TITLE_OVERRIDE||'').trim();
 const base=override||AR[key]||'تقرير';
 return base+(scope(force)==='Filtered'?' مفلتر':' عام');
}
function safe(v){return String(v||'Report').replace(/[\\/:*?"<>|\s]+/g,'_').replace(/_+/g,'_').replace(/^_+|_+$/g,'').slice(0,110)}
function build(o={}){
 const key=o.key||pageKey(),t=o.type||type(key),sc=scope(o.scope||''),stamp=timestamp(o.date||new Date());
 return ['VD','Jeddah','UrgentSolutions',safe(t),sc,stamp].join('_');
}
function make(t,opts={}){return build({type:safe(t||type()),scope:opts.filtered===true?'Filtered':opts.filtered===false?'General':''})}
function followupType(target=''){
 const t=String(target||'');
 if(FOLLOWUP_TYPES[t])return FOLLOWUP_TYPES[t];
 const m=t.match(/^contractor-(\d+)$/);
 return m?'FollowUp_ContractorSettlement_'+String(Number(m[1])+1).padStart(2,'0'):'FollowUp';
}

window.VDReportNaming={build,make,safe,timestamp,stamp:timestamp,pageKey,type,arabicTitle,scope,hasFilters,followupType,TYPES,AR,FOLLOWUP_TYPES};
})();