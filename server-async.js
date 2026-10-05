const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const express=require('express');
const session=require('express-session');
const helmet=require('helmet');
const multer=require('multer');
const {DateTime}=require('luxon');

function loadEnv(){
 const f=path.join(__dirname,'.env');
 if(!fs.existsSync(f))return;
 for(const raw of fs.readFileSync(f,'utf8').split(/\r?\n/)){
  const line=raw.trim(); if(!line||line.startsWith('#'))continue;
  const i=line.indexOf('='); if(i<0)continue;
  const k=line.slice(0,i).trim(),v=line.slice(i+1).trim();
  if(!(k in process.env))process.env[k]=v;
 }
}
loadEnv();

const {
 usePostgres,pool,all,get,run,initDatabase,nowIso,id,
 hashPassword,verifyPassword,getPermissionsForRole,audit
}=require('./src/db');

const app=express();
const PORT=Number(process.env.PORT||3035);
const ZONE='Asia/Riyadh';

app.disable('x-powered-by');
app.set('trust proxy',1);
app.use(helmet({
 contentSecurityPolicy:{directives:{
  defaultSrc:["'self'"],styleSrc:["'self'"],scriptSrc:["'self'"],
  imgSrc:["'self'",'data:','blob:'],mediaSrc:["'self'",'blob:'],
  connectSrc:["'self'"],fontSrc:["'self'",'data:']
 }}
}));
app.use(express.json({limit:'4mb'}));
app.use(express.urlencoded({extended:false}));

let sessionOptions={
 name:'madinah_water_sid',
 secret:process.env.SESSION_SECRET||crypto.randomBytes(48).toString('hex'),
 resave:false,saveUninitialized:false,rolling:true,
 cookie:{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',maxAge:12*60*60*1000}
};
if(usePostgres){
 const PgStore=require('connect-pg-simple')(session);
 sessionOptions.store=new PgStore({pool,createTableIfMissing:true});
}
app.use(session(sessionOptions));

const upload=multer({
 storage:multer.memoryStorage(),
 limits:{fileSize:30*1024*1024,files:10},
 fileFilter:(_req,file,cb)=>{
  const ok=/^(image|video)\//i.test(file.mimetype)||file.mimetype==='application/pdf';
  cb(ok?null:new Error('يسمح بالصور والفيديو وPDF فقط'),ok);
 }
});

const clean=v=>String(v==null?'':v).replace(/\s+/g,' ').trim();
const bool=v=>['1','true','yes','نعم','on'].includes(clean(v).toLowerCase())?1:0;
const numOrNull=v=>{if(v===''||v==null)return null;const n=Number(String(v).replace(/,/g,'.'));return Number.isFinite(n)?n:null};
function dateOrNull(v){const s=clean(v);if(!s)return null;const d=DateTime.fromISO(s,{zone:ZONE});return d.isValid?d.toISO():null}
function csvCell(v){const s=String(v==null?'':v).replace(/\r?\n/g,' ');return '"'+s.replace(/"/g,'""')+'"'}

async function currentUser(req){
 if(!req.session.userId)return null;
 const u=await get(`SELECT u.user_id,u.employee_name,u.job_title,u.email,u.role_id,u.scope_type,u.scope_value,r.role_name_ar
 FROM users u JOIN roles r ON r.role_id=u.role_id
 WHERE u.user_id=? AND u.active=1 AND u.can_login=1`,[req.session.userId]);
 if(!u)return null;
 u.permissions=await getPermissionsForRole(u.role_id);
 return u;
}
async function requireAuth(req,res,next){
 try{const u=await currentUser(req);if(!u)return res.status(401).json({ok:false,error:'AUTH_REQUIRED'});req.user=u;next();}
 catch(e){next(e);}
}
function requirePermission(code){
 return async(req,res,next)=>{
  try{
   const u=req.user||await currentUser(req);
   if(!u)return res.status(401).json({ok:false,error:'AUTH_REQUIRED'});
   if(!u.permissions.includes(code))return res.status(403).json({ok:false,error:'PERMISSION_DENIED',permission:code});
   req.user=u;next();
  }catch(e){next(e);}
 };
}
const workScopeType=u=>clean(u?.scope_type||'ALL').toUpperCase();
function workScopeAllows(u,row){
 if(!u||!row)return false;
 const t=workScopeType(u);
 if(t==='REGION')return clean(row.region_id)===clean(u.scope_value);
 if(t==='OWN')return clean(row.created_by)===clean(u.user_id);
 if(t==='ALL')return u.permissions.includes('WORK_VIEW_ALL')||clean(row.created_by)===clean(u.user_id);
 return clean(row.created_by)===clean(u.user_id);
}
function applyWorkScope(u,where,args){
 const t=workScopeType(u);
 if(t==='REGION'){where.push('w.region_id=?');args.push(clean(u.scope_value));return;}
 if(t==='OWN'||!u.permissions.includes('WORK_VIEW_ALL')){where.push('w.created_by=?');args.push(u.user_id);}
}

async function lookupData(){
 return {
  regions:await all('SELECT region_id AS id,name FROM regions WHERE active=1 ORDER BY sort_order,name'),
  inspectors:await all('SELECT inspector_id AS id,name FROM inspectors WHERE active=1 ORDER BY name'),
  contractors:await all('SELECT contractor_id AS id,name FROM contractors WHERE active=1 ORDER BY name'),
  breakTypes:await all('SELECT break_type_id AS id,name FROM break_types WHERE active=1 ORDER BY name'),
  repairStatuses:await all('SELECT repair_status_id AS id,name,is_closed AS "isClosed" FROM repair_statuses WHERE active=1 ORDER BY is_closed,name')
 };
}
async function roleData(){
 return all(`SELECT role_id AS id,role_name_ar AS name,description FROM roles WHERE active=1
 ORDER BY CASE role_id WHEN 'SUPER_ADMIN' THEN 1 WHEN 'PROJECT_MANAGER' THEN 2 WHEN 'FIELD_INSPECTOR' THEN 3 ELSE 9 END,role_name_ar`);
}
async function stats(){
 const today=DateTime.now().setZone(ZONE).toISODate();
 const total=Number((await get('SELECT COUNT(*) AS n FROM works WHERE deleted_at IS NULL')).n||0);
 const todayCount=Number((await get("SELECT COUNT(*) AS n FROM works WHERE deleted_at IS NULL AND substr(registered_at,1,10)=?",[today])).n||0);
 const closed=Number((await get("SELECT COUNT(*) AS n FROM works w LEFT JOIN repair_statuses s ON s.repair_status_id=w.repair_status_id WHERE w.deleted_at IS NULL AND COALESCE(s.is_closed,0)=1")).n||0);
 const hse=Number((await get('SELECT COUNT(*) AS n FROM works WHERE deleted_at IS NULL AND has_hse_permit=1')).n||0);
 const withLocation=Number((await get('SELECT COUNT(*) AS n FROM works WHERE deleted_at IS NULL AND latitude IS NOT NULL AND longitude IS NOT NULL')).n||0);
 const withMedia=Number((await get('SELECT COUNT(DISTINCT w.work_id) AS n FROM works w JOIN work_media m ON m.work_id=w.work_id WHERE w.deleted_at IS NULL')).n||0);
 const topRegions=await all("SELECT COALESCE(r.name,'غير محدد') AS label,COUNT(*) AS value FROM works w LEFT JOIN regions r ON r.region_id=w.region_id WHERE w.deleted_at IS NULL GROUP BY COALESCE(r.name,'غير محدد') ORDER BY value DESC,label LIMIT 6");
 const byStatus=await all("SELECT COALESCE(s.name,'غير محدد') AS label,COUNT(*) AS value,COALESCE(s.is_closed,0) AS \"isClosed\" FROM works w LEFT JOIN repair_statuses s ON s.repair_status_id=w.repair_status_id WHERE w.deleted_at IS NULL GROUP BY COALESCE(s.name,'غير محدد'),COALESCE(s.is_closed,0) ORDER BY value DESC,label");
 return {
  total,today:todayCount,closed,open:Math.max(0,total-closed),hsePermit:hse,withLocation,withMedia,
  completionRate:total?Math.round((closed/total)*1000)/10:0,
  locationRate:total?Math.round((withLocation/total)*1000)/10:0,
  mediaRate:total?Math.round((withMedia/total)*1000)/10:0,
  topRegions:topRegions.map(x=>({...x,value:Number(x.value)})),
  byStatus:byStatus.map(x=>({...x,value:Number(x.value),isClosed:!!Number(x.isClosed)}))
 };
}

function rowToWork(row){
 if(!row)return null;
 return {
  id:row.work_id,caseCode:row.case_code,requestNo:row.request_no||'',registeredAt:row.registered_at,
  regionId:row.region_id||'',region:row.region_name||'',neighborhood:row.neighborhood||'',
  inspectorId:row.inspector_id||'',inspector:row.inspector_name||'',contractorId:row.contractor_id||'',
  contractor:row.contractor_name||'',municipalityPermitNo:row.municipality_permit_no||'',
  hasHsePermit:!!Number(row.has_hse_permit),wfmNo:row.wfm_no||'',locationText:row.location_text||'',
  latitude:row.latitude==null?null:Number(row.latitude),longitude:row.longitude==null?null:Number(row.longitude),
  startedAt:row.started_at,finishedAt:row.finished_at,depthM:row.depth_m==null?null:Number(row.depth_m),
  breakTypeId:row.break_type_id||'',breakType:row.break_type_name||'',repairStatusId:row.repair_status_id||'',
  repairStatus:row.repair_status_name||'',notes:row.notes||'',source:row.source,createdAt:row.created_at,updatedAt:row.updated_at
 };
}

const workSelect=`
 SELECT w.*,r.name AS region_name,i.name AS inspector_name,c.name AS contractor_name,
 b.name AS break_type_name,s.name AS repair_status_name
 FROM works w
 LEFT JOIN regions r ON r.region_id=w.region_id
 LEFT JOIN inspectors i ON i.inspector_id=w.inspector_id
 LEFT JOIN contractors c ON c.contractor_id=w.contractor_id
 LEFT JOIN break_types b ON b.break_type_id=w.break_type_id
 LEFT JOIN repair_statuses s ON s.repair_status_id=w.repair_status_id
`;

async function validateWork(payload){
 const errors=[];
 const out={
  requestNo:clean(payload.requestNo),registeredAt:dateOrNull(payload.registeredAt),regionId:clean(payload.regionId),
  neighborhood:clean(payload.neighborhood),inspectorId:clean(payload.inspectorId),contractorId:clean(payload.contractorId),
  municipalityPermitNo:clean(payload.municipalityPermitNo),hasHsePermit:bool(payload.hasHsePermit),wfmNo:clean(payload.wfmNo),
  locationText:clean(payload.locationText),latitude:numOrNull(payload.latitude),longitude:numOrNull(payload.longitude),
  startedAt:dateOrNull(payload.startedAt),finishedAt:dateOrNull(payload.finishedAt),depthM:numOrNull(payload.depthM),
  breakTypeId:clean(payload.breakTypeId),repairStatusId:clean(payload.repairStatusId),notes:clean(payload.notes)
 };
 if(!out.registeredAt)errors.push('تاريخ تسجيل الحالة مطلوب');
 if(!out.regionId)errors.push('المنطقة مطلوبة');
 if(!out.inspectorId)errors.push('اسم المراقب مطلوب');
 if(!out.contractorId)errors.push('المقاول مطلوب');
 if(!out.wfmNo)errors.push('رقم بلاغ / أمر العمل WFM مطلوب');
 if(!out.breakTypeId)errors.push('وصف الانكسار مطلوب');
 if(!out.repairStatusId)errors.push('حالة الإصلاح مطلوبة');
 const st=out.repairStatusId?await get('SELECT name,is_closed FROM repair_statuses WHERE repair_status_id=? AND active=1',[out.repairStatusId]):null;
 if(out.repairStatusId&&!st)errors.push('حالة الإصلاح المحددة غير صالحة');
 if(st&&Number(st.is_closed)===1&&!out.finishedAt)errors.push('تاريخ ووقت انتهاء العمل مطلوب عند إغلاق الحالة');
 if(out.depthM!=null&&(out.depthM<0||out.depthM>100))errors.push('عمق الحفر غير منطقي');
 if(out.latitude!=null&&(out.latitude<-90||out.latitude>90))errors.push('خط العرض غير صحيح');
 if(out.longitude!=null&&(out.longitude<-180||out.longitude>180))errors.push('خط الطول غير صحيح');
 if(out.startedAt&&out.finishedAt&&Date.parse(out.finishedAt)<Date.parse(out.startedAt))errors.push('وقت انتهاء العمل لا يمكن أن يسبق وقت المباشرة');
 return {errors,value:out};
}

const makeCaseCode=()=> 'MW-'+DateTime.now().setZone(ZONE).toFormat('yyyyLLdd')+'-'+crypto.randomBytes(3).toString('hex').toUpperCase();

function buildWorkWhere(req){
 const f={
  search:clean(req.query.search),regionId:clean(req.query.regionId),repairStatusId:clean(req.query.repairStatusId),
  inspectorId:clean(req.query.inspectorId),contractorId:clean(req.query.contractorId),
  dateFrom:clean(req.query.dateFrom),dateTo:clean(req.query.dateTo)
 };
 const where=['w.deleted_at IS NULL'],args=[];
 if(f.search){where.push('(w.case_code LIKE ? OR w.wfm_no LIKE ? OR w.request_no LIKE ? OR w.neighborhood LIKE ? OR w.notes LIKE ?)');const q='%'+f.search+'%';args.push(q,q,q,q,q);}
 if(f.regionId){where.push('w.region_id=?');args.push(f.regionId);}
 if(f.repairStatusId){where.push('w.repair_status_id=?');args.push(f.repairStatusId);}
 if(f.inspectorId){where.push('w.inspector_id=?');args.push(f.inspectorId);}
 if(f.contractorId){where.push('w.contractor_id=?');args.push(f.contractorId);}
 if(f.dateFrom){where.push('substr(w.registered_at,1,10)>=?');args.push(f.dateFrom);}
 if(f.dateTo){where.push('substr(w.registered_at,1,10)<=?');args.push(f.dateTo);}
 applyWorkScope(req.user,where,args);
 return {where,args};
}

app.get('/api/health',(_req,res)=>res.json({ok:true,service:'madinah-water-business',database:usePostgres?'postgres':'sqlite',time:DateTime.now().setZone(ZONE).toISO()}));

app.post('/api/auth/login',async(req,res,next)=>{
 try{
  const email=clean(req.body.email).toLowerCase(),password=String(req.body.password||'');
  const u=await get('SELECT * FROM users WHERE lower(email)=? AND active=1 AND can_login=1',[email]);
  if(!u||!verifyPassword(password,u.password_salt,u.password_hash))return res.status(401).json({ok:false,error:'بيانات الدخول غير صحيحة'});
  req.session.userId=u.user_id;
  const now=nowIso();
  await run('UPDATE users SET last_login=?,updated_at=? WHERE user_id=?',[now,now,u.user_id]);
  await audit(u.user_id,'LOGIN','USER',u.user_id,null,{email:u.email});
  res.json({ok:true});
 }catch(e){next(e);}
});
app.post('/api/auth/logout',requireAuth,async(req,res,next)=>{
 try{
  const uid=req.user.user_id;
  await audit(uid,'LOGOUT','USER',uid,null,null);
  req.session.destroy(()=>res.json({ok:true}));
 }catch(e){next(e);}
});
app.get('/api/bootstrap',async(req,res,next)=>{
 try{
  const user=await currentUser(req);
  if(!user)return res.json({ok:true,authenticated:false,business:{name:'مياه المدينة',subtitle:'منصة إدارة أعمال المياه الميدانية'}});
  res.json({ok:true,authenticated:true,business:{name:'مياه المدينة',subtitle:'منصة إدارة أعمال المياه الميدانية'},user,lookups:await lookupData(),stats:await stats()});
 }catch(e){next(e);}
});
app.get('/api/stats',requireAuth,requirePermission('DASHBOARD_VIEW'),async(_req,res,next)=>{
 try{res.json({ok:true,stats:await stats()});}catch(e){next(e);}
});

app.get('/api/works',requireAuth,requirePermission('WORK_VIEW'),async(req,res,next)=>{
 try{
  const page=Math.max(1,Number(req.query.page||1));
  const pageSize=Math.min(100,Math.max(10,Number(req.query.pageSize||25)));
  const offset=(page-1)*pageSize;
  const {where,args}=buildWorkWhere(req);
  const whereSql=' WHERE '+where.join(' AND ');
  const total=Number((await get('SELECT COUNT(*) AS n FROM works w'+whereSql,args)).n||0);
  const rows=(await all(workSelect+whereSql+' ORDER BY w.registered_at DESC,w.created_at DESC LIMIT ? OFFSET ?',[...args,pageSize,offset])).map(rowToWork);
  res.json({ok:true,page,pageSize,total,rows});
 }catch(e){next(e);}
});

app.get('/api/works/export.csv',requireAuth,requirePermission('WORK_VIEW'),async(req,res,next)=>{
 try{
  const {where,args}=buildWorkWhere(req);
  const rows=(await all(workSelect+' WHERE '+where.join(' AND ')+' ORDER BY w.registered_at DESC,w.created_at DESC',args)).map(rowToWork);
  const headers=['كود الحالة','رقم الريكوست','تاريخ التسجيل','رقم WFM','المنطقة','الحي','المراقب','المقاول','رقم تصريح بلدي','تصريح أمن وسلامة','وصف الموقع','خط العرض','خط الطول','وقت المباشرة','وقت الانتهاء','عمق الحفر','وصف الانكسار','حالة الإصلاح','الملاحظات'];
  const lines=[headers.map(csvCell).join(',')];
  for(const w of rows){
   lines.push([w.caseCode,w.requestNo,w.registeredAt,w.wfmNo,w.region,w.neighborhood,w.inspector,w.contractor,w.municipalityPermitNo,w.hasHsePermit?'نعم':'لا',w.locationText,w.latitude,w.longitude,w.startedAt,w.finishedAt,w.depthM,w.breakType,w.repairStatus,w.notes].map(csvCell).join(','));
  }
  const filename='madinah-water-works-'+DateTime.now().setZone(ZONE).toFormat('yyyyLLdd-HHmm')+'.csv';
  res.setHeader('Content-Type','text/csv; charset=utf-8');
  res.setHeader('Content-Disposition','attachment; filename="'+filename+'"');
  res.send('\uFEFF'+lines.join('\r\n'));
 }catch(e){next(e);}
});

app.get('/api/works/check-wfm',requireAuth,requirePermission('WORK_VIEW'),async(req,res,next)=>{
 try{
  const wfm=clean(req.query.wfm),excludeId=clean(req.query.excludeId);
  if(!wfm)return res.json({ok:true,duplicate:false,matches:[]});
  const countArgs=[wfm];
  let countSql='SELECT COUNT(*) AS n FROM works WHERE deleted_at IS NULL AND trim(wfm_no)=?';
  if(excludeId){countSql+=' AND work_id<>?';countArgs.push(excludeId);}
  const duplicate=Number((await get(countSql,countArgs)).n||0)>0;
  const where=['w.deleted_at IS NULL','trim(w.wfm_no)=?'],args=[wfm];
  if(excludeId){where.push('w.work_id<>?');args.push(excludeId);}
  applyWorkScope(req.user,where,args);
  const matches=(await all(workSelect+' WHERE '+where.join(' AND ')+' ORDER BY w.created_at DESC LIMIT 5',args)).map(rowToWork);
  res.json({ok:true,duplicate,matches});
 }catch(e){next(e);}
});

app.get('/api/works/:id/history',requireAuth,requirePermission('WORK_VIEW'),async(req,res,next)=>{
 try{
  const work=await get('SELECT work_id,created_by,region_id FROM works WHERE work_id=? AND deleted_at IS NULL',[req.params.id]);
  if(!work)return res.status(404).json({ok:false,error:'الحالة غير موجودة'});
  if(!workScopeAllows(req.user,work))return res.status(403).json({ok:false,error:'PERMISSION_DENIED'});
  const rows=await all(`SELECT a.audit_id AS id,a.action,a.created_at AS "createdAt",COALESCE(u.employee_name,'النظام') AS "userName"
   FROM audit_log a LEFT JOIN users u ON u.user_id=a.user_id
   WHERE a.entity_type='WORK' AND a.entity_id=? ORDER BY a.created_at DESC LIMIT 100`,[req.params.id]);
  res.json({ok:true,rows});
 }catch(e){next(e);}
});

app.get('/api/works/:id',requireAuth,requirePermission('WORK_VIEW'),async(req,res,next)=>{
 try{
  const row=await get(workSelect+' WHERE w.work_id=? AND w.deleted_at IS NULL',[req.params.id]);
  if(!row)return res.status(404).json({ok:false,error:'الحالة غير موجودة'});
  if(!workScopeAllows(req.user,row))return res.status(403).json({ok:false,error:'PERMISSION_DENIED'});
  const media=await all('SELECT media_id AS id,original_name AS "originalName",mime_type AS "mimeType",size_bytes AS "sizeBytes",relative_url AS "legacyUrl",uploaded_at AS "uploadedAt",CASE WHEN file_data IS NULL THEN 0 ELSE 1 END AS "hasData" FROM work_media WHERE work_id=? ORDER BY uploaded_at DESC',[req.params.id]);
  for(const m of media)m.url=Number(m.hasData)?'/api/media/'+m.id:m.legacyUrl;
  res.json({ok:true,work:rowToWork(row),media});
 }catch(e){next(e);}
});

app.post('/api/works',requireAuth,requirePermission('WORK_CREATE'),async(req,res,next)=>{
 try{
  const parsed=await validateWork(req.body||{});
  if(parsed.errors.length)return res.status(400).json({ok:false,errors:parsed.errors});
  const v=parsed.value;
  if(workScopeType(req.user)==='REGION'&&clean(v.regionId)!==clean(req.user.scope_value))return res.status(403).json({ok:false,error:'لا يمكن إنشاء حالة خارج المنطقة المخصصة للمستخدم'});
  const workId=id(),caseCode=makeCaseCode(),now=nowIso();
  await run(`INSERT INTO works(work_id,case_code,request_no,registered_at,region_id,neighborhood,inspector_id,contractor_id,municipality_permit_no,has_hse_permit,wfm_no,location_text,latitude,longitude,started_at,finished_at,depth_m,break_type_id,repair_status_id,notes,source,created_by,updated_by,created_at,updated_at)
   VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,[
   workId,caseCode,v.requestNo,v.registeredAt,v.regionId,v.neighborhood,v.inspectorId,v.contractorId,
   v.municipalityPermitNo,v.hasHsePermit,v.wfmNo,v.locationText,v.latitude,v.longitude,v.startedAt,v.finishedAt,
   v.depthM,v.breakTypeId,v.repairStatusId,v.notes,'APP',req.user.user_id,req.user.user_id,now,now
  ]);
  const created=rowToWork(await get(workSelect+' WHERE w.work_id=?',[workId]));
  await audit(req.user.user_id,'CREATE','WORK',workId,null,created);
  res.status(201).json({ok:true,work:created});
 }catch(e){next(e);}
});

app.put('/api/works/:id',requireAuth,requirePermission('WORK_EDIT'),async(req,res,next)=>{
 try{
  const existingRaw=await get(workSelect+' WHERE w.work_id=? AND w.deleted_at IS NULL',[req.params.id]);
  if(!existingRaw)return res.status(404).json({ok:false,error:'الحالة غير موجودة'});
  if(!workScopeAllows(req.user,existingRaw))return res.status(403).json({ok:false,error:'PERMISSION_DENIED'});
  if(!req.user.permissions.includes('WORK_EDIT_ALL')&&existingRaw.created_by!==req.user.user_id)return res.status(403).json({ok:false,error:'PERMISSION_DENIED'});
  const parsed=await validateWork(req.body||{});
  if(parsed.errors.length)return res.status(400).json({ok:false,errors:parsed.errors});
  const v=parsed.value;
  if(workScopeType(req.user)==='REGION'&&clean(v.regionId)!==clean(req.user.scope_value))return res.status(403).json({ok:false,error:'لا يمكن نقل الحالة خارج المنطقة المخصصة للمستخدم'});
  const now=nowIso();
  await run(`UPDATE works SET request_no=?,registered_at=?,region_id=?,neighborhood=?,inspector_id=?,contractor_id=?,municipality_permit_no=?,has_hse_permit=?,wfm_no=?,location_text=?,latitude=?,longitude=?,started_at=?,finished_at=?,depth_m=?,break_type_id=?,repair_status_id=?,notes=?,updated_by=?,updated_at=? WHERE work_id=?`,[
   v.requestNo,v.registeredAt,v.regionId,v.neighborhood,v.inspectorId,v.contractorId,v.municipalityPermitNo,v.hasHsePermit,
   v.wfmNo,v.locationText,v.latitude,v.longitude,v.startedAt,v.finishedAt,v.depthM,v.breakTypeId,v.repairStatusId,v.notes,
   req.user.user_id,now,req.params.id
  ]);
  const updated=rowToWork(await get(workSelect+' WHERE w.work_id=?',[req.params.id]));
  await audit(req.user.user_id,'UPDATE','WORK',req.params.id,rowToWork(existingRaw),updated);
  res.json({ok:true,work:updated});
 }catch(e){next(e);}
});

app.delete('/api/works/:id',requireAuth,requirePermission('WORK_DELETE'),async(req,res,next)=>{
 try{
  const existing=await get(workSelect+' WHERE w.work_id=? AND w.deleted_at IS NULL',[req.params.id]);
  if(!existing)return res.status(404).json({ok:false,error:'الحالة غير موجودة'});
  if(!workScopeAllows(req.user,existing))return res.status(403).json({ok:false,error:'PERMISSION_DENIED'});
  const now=nowIso();
  await run('UPDATE works SET deleted_at=?,updated_by=?,updated_at=? WHERE work_id=?',[now,req.user.user_id,now,req.params.id]);
  await audit(req.user.user_id,'DELETE','WORK',req.params.id,rowToWork(existing),null);
  res.json({ok:true});
 }catch(e){next(e);}
});

app.post('/api/works/:id/media',requireAuth,requirePermission('MEDIA_ADD'),upload.array('files',10),async(req,res,next)=>{
 try{
  const work=await get('SELECT work_id,created_by,region_id FROM works WHERE work_id=? AND deleted_at IS NULL',[req.params.id]);
  if(!work)return res.status(404).json({ok:false,error:'الحالة غير موجودة'});
  if(!workScopeAllows(req.user,work))return res.status(403).json({ok:false,error:'PERMISSION_DENIED'});
  if(!req.user.permissions.includes('WORK_EDIT_ALL')&&work.created_by!==req.user.user_id)return res.status(403).json({ok:false,error:'PERMISSION_DENIED'});
  const inserted=[];
  for(const file of req.files||[]){
   const mediaId=id(),uploadedAt=nowIso(),relativeUrl='/api/media/'+mediaId;
   await run(`INSERT INTO work_media(media_id,work_id,original_name,stored_name,mime_type,size_bytes,relative_url,file_data,uploaded_by,uploaded_at)
    VALUES(?,?,?,?,?,?,?,?,?,?)`,[
    mediaId,req.params.id,file.originalname,mediaId,file.mimetype,file.size,relativeUrl,file.buffer,req.user.user_id,uploadedAt
   ]);
   inserted.push({id:mediaId,originalName:file.originalname,mimeType:file.mimetype,sizeBytes:file.size,url:relativeUrl,uploadedAt});
  }
  await audit(req.user.user_id,'MEDIA_ADD','WORK',req.params.id,null,inserted.map(x=>({id:x.id,name:x.originalName})));
  res.status(201).json({ok:true,media:inserted});
 }catch(e){next(e);}
});

app.get('/api/media/:id',requireAuth,requirePermission('MEDIA_VIEW'),async(req,res,next)=>{
 try{
  const m=await get(`SELECT m.media_id,m.original_name,m.mime_type,m.file_data,m.relative_url,w.work_id,w.created_by,w.region_id
   FROM work_media m JOIN works w ON w.work_id=m.work_id
   WHERE m.media_id=? AND w.deleted_at IS NULL`,[req.params.id]);
  if(!m)return res.status(404).end();
  if(!workScopeAllows(req.user,m))return res.status(403).end();
  if(!m.file_data){
   if(m.relative_url&&m.relative_url.startsWith('/uploads/'))return res.redirect(m.relative_url);
   return res.status(404).end();
  }
  res.setHeader('Content-Type',m.mime_type||'application/octet-stream');
  res.setHeader('Content-Disposition','inline; filename*=UTF-8\'\''+encodeURIComponent(m.original_name||'file'));
  res.send(Buffer.from(m.file_data));
 }catch(e){next(e);}
});

app.get('/api/roles',requireAuth,requirePermission('USER_VIEW'),async(_req,res,next)=>{
 try{res.json({ok:true,rows:await roleData()});}catch(e){next(e);}
});

app.get('/api/users',requireAuth,requirePermission('USER_VIEW'),async(_req,res,next)=>{
 try{
  const rows=await all(`SELECT u.user_id AS id,u.employee_name AS name,u.job_title AS "jobTitle",u.email,
   u.role_id AS "roleId",r.role_name_ar AS "roleName",u.scope_type AS "scopeType",u.scope_value AS "scopeValue",
   u.can_login AS "canLogin",u.active,u.account_status AS "accountStatus",u.last_login AS "lastLogin",u.created_at AS "createdAt"
   FROM users u JOIN roles r ON r.role_id=u.role_id ORDER BY u.active DESC,u.employee_name`);
  res.json({ok:true,rows:rows.map(x=>({...x,canLogin:!!Number(x.canLogin),active:!!Number(x.active)}))});
 }catch(e){next(e);}
});

app.post('/api/users',requireAuth,requirePermission('USER_CREATE'),async(req,res,next)=>{
 try{
  const name=clean(req.body.name),jobTitle=clean(req.body.jobTitle),email=clean(req.body.email).toLowerCase();
  const password=String(req.body.password||''),roleId=clean(req.body.roleId);
  const scopeType=(clean(req.body.scopeType)||'ALL').toUpperCase(),scopeValue=clean(req.body.scopeValue);
  if(!['ALL','OWN','REGION'].includes(scopeType))return res.status(400).json({ok:false,error:'نطاق المستخدم غير صالح'});
  if(scopeType==='REGION'&&!await get('SELECT 1 FROM regions WHERE region_id=? AND active=1',[scopeValue]))return res.status(400).json({ok:false,error:'يجب اختيار منطقة صالحة لنطاق المستخدم'});
  if(!name||!email||!roleId||password.length<8)return res.status(400).json({ok:false,error:'الاسم والبريد والدور وكلمة مرور من 8 أحرف على الأقل مطلوبة'});
  if(!await get('SELECT role_id FROM roles WHERE role_id=? AND active=1',[roleId]))return res.status(400).json({ok:false,error:'الدور المحدد غير صالح'});
  if(await get('SELECT 1 FROM users WHERE lower(email)=?',[email]))return res.status(409).json({ok:false,error:'البريد الإلكتروني مستخدم بالفعل'});
  const userId=id(),c=hashPassword(password),now=nowIso();
  await run(`INSERT INTO users(user_id,employee_name,job_title,email,password_hash,password_salt,role_id,scope_type,scope_value,can_login,active,account_status,created_at,updated_at)
   VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,[
   userId,name,jobTitle,email,c.hash,c.salt,roleId,scopeType,scopeValue||null,bool(req.body.canLogin)?1:0,1,'ACTIVE',now,now
  ]);
  await audit(req.user.user_id,'CREATE','USER',userId,null,{name,jobTitle,email,roleId,scopeType,scopeValue});
  res.status(201).json({ok:true,id:userId});
 }catch(e){next(e);}
});

app.put('/api/users/:id',requireAuth,requirePermission('USER_EDIT'),async(req,res,next)=>{
 try{
  const existing=await get('SELECT * FROM users WHERE user_id=?',[req.params.id]);
  if(!existing)return res.status(404).json({ok:false,error:'المستخدم غير موجود'});
  const name=clean(req.body.name)||existing.employee_name,jobTitle=clean(req.body.jobTitle);
  const roleId=clean(req.body.roleId)||existing.role_id;
  const scopeType=(clean(req.body.scopeType)||existing.scope_type||'ALL').toUpperCase(),scopeValue=clean(req.body.scopeValue);
  if(!['ALL','OWN','REGION'].includes(scopeType))return res.status(400).json({ok:false,error:'نطاق المستخدم غير صالح'});
  if(scopeType==='REGION'&&!await get('SELECT 1 FROM regions WHERE region_id=? AND active=1',[scopeValue]))return res.status(400).json({ok:false,error:'يجب اختيار منطقة صالحة لنطاق المستخدم'});
  const active=req.body.active===undefined?Number(existing.active):bool(req.body.active);
  const canLogin=req.body.canLogin===undefined?Number(existing.can_login):bool(req.body.canLogin);
  if(req.params.id===req.user.user_id&&(!active||!canLogin))return res.status(400).json({ok:false,error:'لا يمكن إيقاف حسابك الحالي أو منع تسجيل الدخول له'});
  if(!await get('SELECT role_id FROM roles WHERE role_id=? AND active=1',[roleId]))return res.status(400).json({ok:false,error:'الدور المحدد غير صالح'});
  const now=nowIso(),password=String(req.body.password||'');
  if(password){
   if(password.length<8)return res.status(400).json({ok:false,error:'كلمة المرور يجب ألا تقل عن 8 أحرف'});
   const c=hashPassword(password);
   await run(`UPDATE users SET employee_name=?,job_title=?,role_id=?,scope_type=?,scope_value=?,can_login=?,active=?,account_status=?,password_hash=?,password_salt=?,updated_at=? WHERE user_id=?`,[
    name,jobTitle,roleId,scopeType,scopeValue||null,canLogin,active,active?'ACTIVE':'DISABLED',c.hash,c.salt,now,req.params.id
   ]);
  }else{
   await run(`UPDATE users SET employee_name=?,job_title=?,role_id=?,scope_type=?,scope_value=?,can_login=?,active=?,account_status=?,updated_at=? WHERE user_id=?`,[
    name,jobTitle,roleId,scopeType,scopeValue||null,canLogin,active,active?'ACTIVE':'DISABLED',now,req.params.id
   ]);
  }
  await audit(req.user.user_id,'UPDATE','USER',req.params.id,
   {name:existing.employee_name,roleId:existing.role_id,active:!!Number(existing.active)},
   {name,jobTitle,roleId,scopeType,scopeValue,canLogin:!!canLogin,active:!!active});
  res.json({ok:true});
 }catch(e){next(e);}
});

const lookupMap={
 regions:{table:'regions',idCol:'region_id'},
 inspectors:{table:'inspectors',idCol:'inspector_id'},
 contractors:{table:'contractors',idCol:'contractor_id'},
 breakTypes:{table:'break_types',idCol:'break_type_id'},
 repairStatuses:{table:'repair_statuses',idCol:'repair_status_id'}
};

app.post('/api/lookups/:type',requireAuth,requirePermission('SETTINGS_MANAGE'),async(req,res,next)=>{
 try{
  const cfg=lookupMap[req.params.type],name=clean(req.body.name);
  if(!cfg||!name)return res.status(400).json({ok:false,error:'بيانات غير صحيحة'});
  const newId=id();
  if(cfg.table==='repair_statuses')await run('INSERT INTO repair_statuses(repair_status_id,name,is_closed,active) VALUES(?,?,?,1)',[newId,name,bool(req.body.isClosed)]);
  else if(cfg.table==='regions')await run('INSERT INTO regions(region_id,name,active,sort_order) VALUES(?,?,1,999)',[newId,name]);
  else await run(`INSERT INTO ${cfg.table}(${cfg.idCol},name,active) VALUES(?,?,1)`,[newId,name]);
  await audit(req.user.user_id,'CREATE','LOOKUP_'+req.params.type,newId,null,{name});
  res.status(201).json({ok:true,id:newId,name,lookups:await lookupData()});
 }catch(e){
  if(String(e.message||'').toLowerCase().includes('unique'))return res.status(409).json({ok:false,error:'القيمة موجودة بالفعل'});
  next(e);
 }
});

app.get('/api/audit',requireAuth,requirePermission('AUDIT_VIEW'),async(_req,res,next)=>{
 try{
  const rows=await all(`SELECT a.audit_id,a.action,a.entity_type,a.entity_id,a.created_at,u.employee_name
   FROM audit_log a LEFT JOIN users u ON u.user_id=a.user_id ORDER BY a.created_at DESC LIMIT 100`);
  res.json({ok:true,rows});
 }catch(e){next(e);}
});

app.use(express.static(path.join(__dirname,'public'),{maxAge:process.env.NODE_ENV==='production'?'1h':0}));

app.use((req,res,next)=>{
 if(req.method==='GET'&&!req.path.startsWith('/api/')){
  return res.sendFile(path.join(__dirname,'public','index.html'));
 }
 next();
});

app.use((err,_req,res,_next)=>{
 console.error(err);
 if(err instanceof multer.MulterError)return res.status(400).json({ok:false,error:err.message});
 res.status(500).json({ok:false,error:process.env.NODE_ENV==='production'?'حدث خطأ غير متوقع':(err.message||'حدث خطأ غير متوقع')});
});

async function start(){
 if(process.env.NODE_ENV==='production'&&!usePostgres){
  throw new Error('DATABASE_URL is required in production. Refusing to start with ephemeral SQLite storage.');
 }
 await initDatabase();
 app.listen(PORT,'0.0.0.0',()=>console.log('Madinah Water Business running on http://localhost:'+PORT+' ['+(usePostgres?'postgres':'sqlite')+']'));
}
start().catch(err=>{console.error('Startup failed',err);process.exit(1);});
