const fs=require('fs');
const path=require('path');

function loadEnv(){
  const out={};
  for(const raw of fs.readFileSync(path.join(__dirname,'..','.env'),'utf8').split(/\r?\n/)){
    const line=raw.trim();
    if(!line||line.startsWith('#'))continue;
    const i=line.indexOf('=');
    if(i>0)out[line.slice(0,i).trim()]=line.slice(i+1).trim();
  }
  return out;
}
async function json(url,options={}){
  const r=await fetch(url,options);
  const body=await r.json();
  if(!r.ok)throw new Error(r.status+' '+JSON.stringify(body));
  return {r,body};
}
(async()=>{
  const env=loadEnv();
  const base='http://localhost:'+(env.PORT||3035);
  const health=await json(base+'/api/health');
  const login=await json(base+'/api/auth/login',{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({email:env.ADMIN_EMAIL,password:env.ADMIN_PASSWORD})
  });
  const cookie=(login.r.headers.get('set-cookie')||'').split(';')[0];
  const boot=(await json(base+'/api/bootstrap',{headers:{cookie}})).body;
  const p={
    requestNo:'LOCAL-SMOKE',
    registeredAt:new Date().toISOString(),
    wfmNo:'SMOKE-'+Date.now(),
    regionId:boot.lookups.regions[0].id,
    neighborhood:'اختبار محلي',
    inspectorId:boot.lookups.inspectors[0].id,
    contractorId:boot.lookups.contractors[0].id,
    municipalityPermitNo:'لا يوجد',
    hasHsePermit:true,
    locationText:'اختبار API محلي',
    latitude:24.4709,
    longitude:39.6122,
    startedAt:new Date().toISOString(),
    depthM:0.8,
    breakTypeId:boot.lookups.breakTypes[0].id,
    repairStatusId:boot.lookups.repairStatuses[0].id,
    notes:'سجل smoke test وسيتم حذفه تلقائيا'
  };
  const created=(await json(base+'/api/works',{method:'POST',headers:{'content-type':'application/json',cookie},body:JSON.stringify(p)})).body;
  const fetched=(await json(base+'/api/works/'+created.work.id,{headers:{cookie}})).body;
  const removed=(await json(base+'/api/works/'+created.work.id,{method:'DELETE',headers:{cookie}})).body;
  console.log(JSON.stringify({
    health:health.body.ok,
    authenticated:boot.authenticated,
    user:boot.user.employee_name,
    lookups:{
      regions:boot.lookups.regions.length,
      inspectors:boot.lookups.inspectors.length,
      contractors:boot.lookups.contractors.length,
      breakTypes:boot.lookups.breakTypes.length,
      repairStatuses:boot.lookups.repairStatuses.length
    },
    createdCode:created.work.caseCode,
    fetchedWfm:fetched.work.wfmNo,
    deleted:removed.ok
  },null,2));
})().catch(e=>{console.error(e);process.exit(1)});
