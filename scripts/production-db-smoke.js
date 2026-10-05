const {all,get,run,initDatabase,id,nowIso,usePostgres,pool}=require('../src/db');

async function requirePostgres(){
  if(!usePostgres) throw new Error('This maintenance script is production/PostgreSQL only.');
  await initDatabase();
}

async function findBase(){
  const admin=await get("SELECT user_id FROM users WHERE role_id='SUPER_ADMIN' AND active=1 ORDER BY created_at LIMIT 1");
  const region=await get("SELECT region_id AS id FROM regions WHERE active=1 ORDER BY sort_order,name LIMIT 1");
  const inspector=await get("SELECT inspector_id AS id FROM inspectors WHERE active=1 ORDER BY name LIMIT 1");
  const contractor=await get("SELECT contractor_id AS id FROM contractors WHERE active=1 ORDER BY name LIMIT 1");
  const breakType=await get("SELECT break_type_id AS id FROM break_types WHERE active=1 ORDER BY name LIMIT 1");
  const status=await get("SELECT repair_status_id AS id FROM repair_statuses WHERE active=1 AND is_closed=0 ORDER BY name LIMIT 1");
  if(!admin||!region||!inspector||!contractor||!breakType||!status) throw new Error('Reference data incomplete.');
  return {admin,region,inspector,contractor,breakType,status};
}

async function existingSmoke(){
  const row=await get("SELECT setting_value FROM app_settings WHERE setting_key='production_smoke_work_id'");
  return row?.setting_value||null;
}

async function cleanup(){
  const workId=await existingSmoke();
  if(!workId) return {cleaned:false,reason:'none'};
  await run("DELETE FROM audit_log WHERE entity_type='WORK' AND entity_id=?",[workId]);
  await run("DELETE FROM works WHERE work_id=?",[workId]);
  await run("DELETE FROM app_settings WHERE setting_key='production_smoke_work_id'");
  return {cleaned:true,workId};
}

async function create(){
  await cleanup();
  const b=await findBase();
  const workId=id();
  const stamp=Date.now();
  const now=nowIso();
  const caseCode='MW-PROD-SMOKE-'+stamp;
  const wfm='PROD-SMOKE-'+stamp;
  await run(`INSERT INTO works(
    work_id,case_code,request_no,registered_at,region_id,neighborhood,inspector_id,contractor_id,
    municipality_permit_no,has_hse_permit,wfm_no,location_text,latitude,longitude,started_at,finished_at,
    depth_m,break_type_id,repair_status_id,notes,source,created_by,updated_by,created_at,updated_at
  ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,[
    workId,caseCode,'PROD-SMOKE',now,b.region.id,'اختبار إنتاج مؤقت',b.inspector.id,b.contractor.id,
    'TEST',1,wfm,'Render production persistence smoke test',24.4709,39.6122,now,null,
    0.5,b.breakType.id,b.status.id,'سجل اختبار تلقائي مؤقت','SMOKE',b.admin.user_id,b.admin.user_id,now,now
  ]);
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZK0sAAAAASUVORK5CYII=','base64');
  const mediaId=id();
  await run(`INSERT INTO work_media(
    media_id,work_id,original_name,stored_name,mime_type,size_bytes,relative_url,file_data,uploaded_by,uploaded_at
  ) VALUES(?,?,?,?,?,?,?,?,?,?)`,[
    mediaId,workId,'smoke.png',mediaId,'image/png',png.length,'/api/media/'+mediaId,png,b.admin.user_id,now
  ]);
  await run("INSERT INTO audit_log(audit_id,user_id,action,entity_type,entity_id,old_data,new_data,created_at) VALUES(?,?,?,?,?,?,?,?)",[
    id(),b.admin.user_id,'SMOKE_CREATE','WORK',workId,null,JSON.stringify({caseCode,wfm}),now
  ]);
  await run("INSERT INTO app_settings(setting_key,setting_value,updated_at) VALUES(?,?,?) ON CONFLICT(setting_key) DO UPDATE SET setting_value=excluded.setting_value,updated_at=excluded.updated_at",[
    'production_smoke_work_id',workId,now
  ]);
  return {created:true,workId,caseCode,wfm,mediaId};
}

async function verify(){
  const workId=await existingSmoke();
  if(!workId) throw new Error('No smoke record marker found.');
  const work=await get("SELECT work_id,case_code,wfm_no,source FROM works WHERE work_id=?",[workId]);
  const media=await get("SELECT media_id,size_bytes,octet_length(file_data) AS bytes FROM work_media WHERE work_id=? ORDER BY uploaded_at DESC LIMIT 1",[workId]);
  const sessionTable=await get("SELECT to_regclass('public.session') AS name");
  const sessions=sessionTable?.name?await get('SELECT COUNT(*) AS n FROM session'):null;
  return {
    persisted:!!work,
    workId,
    caseCode:work?.case_code||null,
    wfm:work?.wfm_no||null,
    source:work?.source||null,
    mediaPersisted:!!media&&Number(media.bytes)>0,
    mediaBytes:media?Number(media.bytes):0,
    sessionTable:!!sessionTable?.name,
    sessionRows:sessions?Number(sessions.n):0
  };
}

(async()=>{
  const mode=(process.argv[2]||'verify').toLowerCase();
  await requirePostgres();
  let result;
  if(mode==='create') result=await create();
  else if(mode==='verify') result=await verify();
  else if(mode==='cleanup') result=await cleanup();
  else throw new Error('Mode must be create, verify, or cleanup');
  console.log(JSON.stringify({ok:true,mode,...result}));
  if(pool) await pool.end();
})().catch(async e=>{
  console.error(JSON.stringify({ok:false,error:e.message}));
  try{if(pool)await pool.end();}catch{}
  process.exit(1);
});