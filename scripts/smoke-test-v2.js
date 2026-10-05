const fs=require('fs');
const path=require('path');
const { DatabaseSync }=require('node:sqlite');

function env(){
  const o={};
  for(const raw of fs.readFileSync(path.join(__dirname,'..','.env'),'utf8').split(/\r?\n/)){
    const line=raw.trim(); if(!line||line.startsWith('#'))continue;
    const i=line.indexOf('='); if(i>0)o[line.slice(0,i).trim()]=line.slice(i+1).trim();
  }
  return o;
}
async function request(url,options={}){
  const r=await fetch(url,options);
  const body=await r.json().catch(()=>({}));
  return {ok:r.ok,status:r.status,headers:r.headers,body};
}
async function login(root,email,password){
  const r=await request(root+'/api/auth/login',{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({email,password})
  });
  return {...r,cookie:(r.headers.get('set-cookie')||'').split(';')[0]};
}

(async()=>{
  const e=env();
  const root='http://localhost:'+(e.PORT||3035);
  const adminLogin=await login(root,e.ADMIN_EMAIL,e.ADMIN_PASSWORD);
  if(!adminLogin.ok)throw new Error('admin login failed '+JSON.stringify(adminLogin.body));
  const H={cookie:adminLogin.cookie};

  const boot=await request(root+'/api/bootstrap',{headers:H});
  const lookups=boot.body.lookups;
  if((lookups.regions||[]).length<2)throw new Error('need at least 2 regions for scope smoke test');
  const openStatus=lookups.repairStatuses.find(x=>!x.isClosed);
  const closedStatus=lookups.repairStatuses.find(x=>x.isClosed);
  const stamp=Date.now();
  const wfm='SMOKE-V2-'+stamp;

  const common={
    requestNo:'SMOKE-V2',
    registeredAt:new Date().toISOString(),
    neighborhood:'اختبار V2',
    inspectorId:lookups.inspectors[0].id,
    contractorId:lookups.contractors[0].id,
    municipalityPermitNo:'لا يوجد',
    hasHsePermit:true,
    locationText:'اختبار محلي',
    latitude:24.4709,
    longitude:39.6122,
    startedAt:new Date().toISOString(),
    depthM:0.7,
    breakTypeId:lookups.breakTypes[0].id,
    repairStatusId:openStatus.id,
    notes:'Smoke V2'
  };

  const createA=await request(root+'/api/works',{
    method:'POST',headers:{...H,'content-type':'application/json'},
    body:JSON.stringify({...common,wfmNo:wfm,regionId:lookups.regions[0].id})
  });
  if(!createA.ok)throw new Error('create A failed '+JSON.stringify(createA.body));
  const workA=createA.body.work.id;

  const createB=await request(root+'/api/works',{
    method:'POST',headers:{...H,'content-type':'application/json'},
    body:JSON.stringify({...common,wfmNo:wfm+'-B',regionId:lookups.regions[1].id})
  });
  if(!createB.ok)throw new Error('create B failed '+JSON.stringify(createB.body));
  const workB=createB.body.work.id;

  const duplicate=await request(root+'/api/works/check-wfm?wfm='+encodeURIComponent(wfm),{headers:H});
  const day=new Date().toISOString().slice(0,10);
  const filterQs=new URLSearchParams({
    regionId:lookups.regions[0].id,
    inspectorId:common.inspectorId,
    contractorId:common.contractorId,
    dateFrom:day,
    dateTo:day,
    search:wfm
  });
  const filtered=await request(root+'/api/works?'+filterQs.toString(),{headers:H});
  const history=await request(root+'/api/works/'+workA+'/history',{headers:H});
  const exportRes=await fetch(root+'/api/works/export.csv?'+filterQs.toString(),{headers:H});
  const exportText=await exportRes.text();

  const invalidClosed=await request(root+'/api/works',{
    method:'POST',headers:{...H,'content-type':'application/json'},
    body:JSON.stringify({
      ...common,
      wfmNo:wfm+'-CLOSED',
      regionId:lookups.regions[0].id,
      repairStatusId:closedStatus.id,
      finishedAt:''
    })
  });

  const roles=await request(root+'/api/roles',{headers:H});

  const basicEmail='smoke.user.'+stamp+'@local.test';
  const createUser=await request(root+'/api/users',{
    method:'POST',headers:{...H,'content-type':'application/json'},
    body:JSON.stringify({
      name:'مستخدم اختبار',
      jobTitle:'اختبار',
      email:basicEmail,
      password:'Smoke@123',
      roleId:'VIEWER',
      scopeType:'OWN',
      canLogin:true,
      active:true
    })
  });
  if(!createUser.ok)throw new Error('create user failed '+JSON.stringify(createUser.body));
  const userId=createUser.body.id;
  const updateUser=await request(root+'/api/users/'+userId,{
    method:'PUT',headers:{...H,'content-type':'application/json'},
    body:JSON.stringify({
      name:'مستخدم اختبار محدث',
      jobTitle:'اختبار',
      roleId:'FIELD_INSPECTOR',
      scopeType:'OWN',
      canLogin:false,
      active:true
    })
  });
  const users=await request(root+'/api/users',{headers:H});

  const regionEmail='smoke.region.'+stamp+'@local.test';
  const regionPassword='Region@123';
  const createRegionUser=await request(root+'/api/users',{
    method:'POST',headers:{...H,'content-type':'application/json'},
    body:JSON.stringify({
      name:'مدير منطقة اختبار',
      jobTitle:'مدير منطقة',
      email:regionEmail,
      password:regionPassword,
      roleId:'PROJECT_MANAGER',
      scopeType:'REGION',
      scopeValue:lookups.regions[0].id,
      canLogin:true,
      active:true
    })
  });
  if(!createRegionUser.ok)throw new Error('create region user failed '+JSON.stringify(createRegionUser.body));
  const regionUserId=createRegionUser.body.id;
  const regionLogin=await login(root,regionEmail,regionPassword);
  if(!regionLogin.ok)throw new Error('region login failed '+JSON.stringify(regionLogin.body));
  const HR={cookie:regionLogin.cookie};

  const regionList=await request(root+'/api/works?pageSize=100',{headers:HR});
  const regionSeesA=regionList.body.rows?.some(x=>x.id===workA)||false;
  const regionSeesB=regionList.body.rows?.some(x=>x.id===workB)||false;

  const regionCreateOutside=await request(root+'/api/works',{
    method:'POST',headers:{...HR,'content-type':'application/json'},
    body:JSON.stringify({
      ...common,
      wfmNo:wfm+'-OUTSIDE',
      regionId:lookups.regions[1].id
    })
  });

  await request(root+'/api/works/'+workA,{method:'DELETE',headers:H});
  await request(root+'/api/works/'+workB,{method:'DELETE',headers:H});

  const db=new DatabaseSync(path.join(__dirname,'..','data','madinah-water.db'));
  db.exec('PRAGMA foreign_keys=ON');
  db.prepare('DELETE FROM audit_log WHERE user_id=?').run(regionUserId);
  db.prepare('DELETE FROM users WHERE user_id=?').run(regionUserId);
  db.prepare('DELETE FROM users WHERE user_id=?').run(userId);
  db.prepare('DELETE FROM works WHERE work_id=?').run(workA);
  db.prepare('DELETE FROM works WHERE work_id=?').run(workB);
  db.close();

  console.log(JSON.stringify({
    adminLogin:adminLogin.ok,
    roles:roles.body.rows?.length||0,
    createWorkA:createA.ok,
    createWorkB:createB.ok,
    duplicateDetected:duplicate.body.duplicate,
    duplicateMatches:duplicate.body.matches?.length||0,
    filterMatched:filtered.ok && filtered.body.rows?.some(x=>x.id===workA),
    historyHasCreate:history.ok && history.body.rows?.some(x=>x.action==='CREATE'),
    exportCsvOk:exportRes.ok && /text\/csv/i.test(exportRes.headers.get('content-type')||''),
    exportContainsFilteredWork:exportText.includes(wfm),
    closedWithoutFinishRejected:invalidClosed.status===400,
    closedValidationMessage:invalidClosed.body.errors?.[0]||invalidClosed.body.error||'',
    createUser:createUser.ok,
    updateUser:updateUser.ok,
    userVisible:users.body.rows?.some(x=>x.id===userId)||false,
    createRegionUser:createRegionUser.ok,
    regionLogin:regionLogin.ok,
    regionScopeSeesAssignedRegion:regionSeesA,
    regionScopeHidesOtherRegion:!regionSeesB,
    regionCreateOutsideRejected:regionCreateOutside.status===403,
    cleanup:true
  },null,2));
})().catch(e=>{console.error(e);process.exit(1)});
