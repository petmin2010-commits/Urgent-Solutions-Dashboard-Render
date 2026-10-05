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
(async()=>{
  const e=env();
  const root='http://localhost:'+(e.PORT||3035);
  const login=await request(root+'/api/auth/login',{
    method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({email:e.ADMIN_EMAIL,password:e.ADMIN_PASSWORD})
  });
  if(!login.ok)throw new Error('login failed '+JSON.stringify(login.body));
  const cookie=(login.headers.get('set-cookie')||'').split(';')[0];
  const H={cookie};
  const boot=await request(root+'/api/bootstrap',{headers:H});
  const lookups=boot.body.lookups;
  const openStatus=lookups.repairStatuses.find(x=>!x.isClosed);
  const closedStatus=lookups.repairStatuses.find(x=>x.isClosed);
  const wfm='SMOKE-V2-'+Date.now();
  const common={
    requestNo:'SMOKE-V2',
    registeredAt:new Date().toISOString(),
    wfmNo:wfm,
    regionId:lookups.regions[0].id,
    neighborhood:'اختبار V2',
    inspectorId:lookups.inspectors[0].id,
    contractorId:lookups.contractors[0].id,
    municipalityPermitNo:'لا يوجد',
    hasHsePermit:true,
    locationText:'اختبار محلي',
    latitude:24.4709,longitude:39.6122,
    startedAt:new Date().toISOString(),
    depthM:0.7,
    breakTypeId:lookups.breakTypes[0].id,
    notes:'Smoke V2'
  };
  const create=await request(root+'/api/works',{
    method:'POST',headers:{...H,'content-type':'application/json'},
    body:JSON.stringify({...common,repairStatusId:openStatus.id})
  });
  if(!create.ok)throw new Error('create failed '+JSON.stringify(create.body));
  const workId=create.body.work.id;

  const duplicate=await request(root+'/api/works/check-wfm?wfm='+encodeURIComponent(wfm),{headers:H});
  const day=new Date().toISOString().slice(0,10);
  const filterQs=new URLSearchParams({
    regionId:common.regionId,
    inspectorId:common.inspectorId,
    contractorId:common.contractorId,
    dateFrom:day,
    dateTo:day,
    search:wfm
  });
  const filtered=await request(root+'/api/works?'+filterQs.toString(),{headers:H});
  const invalidClosed=await request(root+'/api/works',{
    method:'POST',headers:{...H,'content-type':'application/json'},
    body:JSON.stringify({...common,wfmNo:wfm+'-CLOSED',repairStatusId:closedStatus.id,finishedAt:''})
  });

  const roles=await request(root+'/api/roles',{headers:H});
  const smokeEmail='smoke.user.'+Date.now()+'@local.test';
  const createUser=await request(root+'/api/users',{
    method:'POST',headers:{...H,'content-type':'application/json'},
    body:JSON.stringify({
      name:'مستخدم اختبار',jobTitle:'اختبار',email:smokeEmail,password:'Smoke@123',
      roleId:'VIEWER',scopeType:'OWN',canLogin:true,active:true
    })
  });
  if(!createUser.ok)throw new Error('create user failed '+JSON.stringify(createUser.body));
  const userId=createUser.body.id;
  const updateUser=await request(root+'/api/users/'+userId,{
    method:'PUT',headers:{...H,'content-type':'application/json'},
    body:JSON.stringify({name:'مستخدم اختبار محدث',jobTitle:'اختبار',roleId:'FIELD_INSPECTOR',scopeType:'OWN',canLogin:false,active:true})
  });
  const users=await request(root+'/api/users',{headers:H});

  await request(root+'/api/works/'+workId,{method:'DELETE',headers:H});

  const db=new DatabaseSync(path.join(__dirname,'..','data','madinah-water.db'));
  db.exec('PRAGMA foreign_keys=ON');
  db.prepare("DELETE FROM users WHERE user_id=?").run(userId);
  db.prepare("DELETE FROM works WHERE work_id=?").run(workId);
  db.close();

  console.log(JSON.stringify({
    login:login.ok,
    roles:roles.body.rows?.length||0,
    createWork:create.ok,
    duplicateDetected:duplicate.body.duplicate,
    duplicateMatches:duplicate.body.matches?.length||0,
    filterMatched:filtered.ok && filtered.body.rows?.some(x=>x.id===workId),
    closedWithoutFinishRejected:invalidClosed.status===400,
    closedValidationMessage:invalidClosed.body.errors?.[0]||invalidClosed.body.error||'',
    createUser:createUser.ok,
    updateUser:updateUser.ok,
    userVisible:users.body.rows?.some(x=>x.id===userId)||false,
    cleanup:true
  },null,2));
})().catch(e=>{console.error(e);process.exit(1)});
