const express = require('express');
const session = require('express-session');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { google } = require('googleapis');
const { DateTime } = require('luxon');
const XLSX = require('xlsx');

function loadEnv(){
  const file=path.join(__dirname,'.env');
  if(!fs.existsSync(file)) return;
  for(const raw of fs.readFileSync(file,'utf8').split(/\r?\n/)){
    const line=raw.trim();
    if(!line || line.startsWith('#')) continue;
    const i=line.indexOf('=');
    if(i<0) continue;
    const key=line.slice(0,i).trim();
    const value=line.slice(i+1).trim();
    if(!(key in process.env)) process.env[key]=value;
  }
}
loadEnv();

const app=express();
const PORT=Number(process.env.PORT||3012);
const SPREADSHEET_ID=String(process.env.SPREADSHEET_ID||'').trim();
const CREDENTIALS_PATH=String(process.env.GOOGLE_CREDENTIALS_PATH||'').trim();
const AUTH_SHEET=String(process.env.AUTH_SHEET||'Dashboard Users').trim();
const CACHE_MS=20*1000;
const SNAPSHOT_PATH=path.join(__dirname,'data-snapshot.json');
let cache={at:0,data:null};
function readSnapshot(){
  try{
    if(!fs.existsSync(SNAPSHOT_PATH))return null;
    const data=JSON.parse(fs.readFileSync(SNAPSHOT_PATH,'utf8'));
    if(!data || typeof data!=='object')return null;
    return data;
  }catch(error){
    console.warn('Snapshot read warning:',error.message);
    return null;
  }
}

app.disable('x-powered-by');
app.use(express.json({limit:'10mb'}));
app.use(express.urlencoded({extended:false}));
const SESSION_SECRET=process.env.SESSION_SECRET||crypto.randomBytes(48).toString('hex');
app.use(session({
  name:'vd_urgent_sid',
  secret:SESSION_SECRET,
  resave:false,
  saveUninitialized:false,
  cookie:{httpOnly:true,sameSite:'lax',secure:false,maxAge:8*60*60*1000}
}));

const clean=v=>String(v==null?'':v).replace(/\s+/g,' ').trim();
const num=v=>{
  const n=Number(String(v==null?'':v).replace(/,/g,'').replace(/٬/g,'').replace(/٫/g,'.'));
  return Number.isFinite(n)?n:0;
};
const norm=v=>clean(v).normalize('NFKC').replace(/[\u064B-\u065F\u0670]/g,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').toLowerCase();
const isActive=v=>!v || ['نعم','yes','active','فعال','مفعل','1','true'].includes(norm(v));
const splitPermissions=v=>[...new Set(clean(v).split(/[,،;|\n]+/).map(clean).filter(Boolean))];
function userImageUrl(v){
  const raw=String(v==null?'':v).trim();
  if(!raw)return '';
  const m=raw.match(/^=IMAGE\(\s*\"([^\"]+)\"/i);
  const url=(m?m[1]:raw).trim();
  return /^https?:\/\//i.test(url)?url:'';
}
const loginAttempts=new Map();
function loginKey(req,user){return String(req.ip||'')+'|'+String(user||'').toLowerCase()}
function loginAllowed(key){const now=Date.now(),x=loginAttempts.get(key);if(!x)return true;if(x.blockedUntil&&now<x.blockedUntil)return false;if(now-x.first>15*60*1000){loginAttempts.delete(key);return true}return true}
function loginFail(key){const now=Date.now(),x=loginAttempts.get(key)||{count:0,first:now,blockedUntil:0};x.count++;if(x.count>=5)x.blockedUntil=now+15*60*1000;loginAttempts.set(key,x)}

function parseDate(v){
  const s=clean(v);
  if(!s) return null;
  const formats=['yyyy-MM-dd','dd/MM/yyyy','d/M/yyyy','MM/dd/yyyy','M/d/yyyy','dd-MM-yyyy','d-M-yyyy'];
  for(const f of formats){
    const d=DateTime.fromFormat(s,f,{zone:'Asia/Riyadh'});
    if(d.isValid) return d.startOf('day');
  }
  const iso=DateTime.fromISO(s,{zone:'Asia/Riyadh'});
  return iso.isValid?iso.startOf('day'):null;
}

function credentials(){
  if(process.env.GOOGLE_SERVICE_ACCOUNT_JSON){
    return JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  }
  if(!CREDENTIALS_PATH || !fs.existsSync(CREDENTIALS_PATH)){
    throw new Error('Google credentials are not configured for Urgent Solutions Dashboard');
  }
  return JSON.parse(fs.readFileSync(CREDENTIALS_PATH,'utf8'));
}
async function sheetsApi(){
  const auth=new google.auth.GoogleAuth({
    credentials:credentials(),
    scopes:['https://www.googleapis.com/auth/spreadsheets.readonly']
  });
  return google.sheets({version:'v4',auth});
}
function q(name){return "'" + String(name).replace(/'/g,"''") + "'";}

async function readUsers(){
  try{
    const sheets=await sheetsApi();
    const r=await sheets.spreadsheets.values.get({
      spreadsheetId:SPREADSHEET_ID,
      range:q(AUTH_SHEET)+'!A:G',
      valueRenderOption:'FORMULA'
    });
    const rows=r.data.values||[];
    if(rows.length>1){
      return rows.slice(1).map(x=>({
        name:clean(x[0]), role:clean(x[1]), username:clean(x[2]).toLowerCase(),
        password:String(x[3]||''), active:isActive(x[4]), image:userImageUrl(x[5]),
        permissions:splitPermissions(x[6])
      })).filter(x=>x.username);
    }
  }catch(error){
    if(![400,404].includes(Number(error?.code||error?.response?.status||0))){
      console.warn('Auth sheet read warning:',error.message);
    }
  }
  const configuredPassword=String(process.env.DASHBOARD_ADMIN_PASSWORD||'');
  return [{
    name:'مدير النظام',role:'Administrator',
    username:clean(process.env.DASHBOARD_ADMIN_USER||'admin').toLowerCase(),
    password:configuredPassword,
    passwordHash:configuredPassword?'':'ec70eac897f6c85856ae49132b59ca05c170cc87cf9e4db38fc26bdf575db8de',
    active:true,image:'',permissions:['*']
  }];
}
function passwordMatches(user,password){
  if(!user)return false;
  if(user.password)return user.password===password;
  if(user.passwordHash){
    const hash=crypto.createHash('sha256').update('vd-urgent-solutions-2026'+String(password||'')).digest('hex');
    try{return crypto.timingSafeEqual(Buffer.from(hash),Buffer.from(user.passwordHash))}catch{return false}
  }
  return false;
}
function publicUser(u){
  return {name:u.name,role:u.role,username:u.username,image:u.image||'',permissions:u.permissions||[]};
}
function requireAuth(req,res,next){
  if(req.session?.user) return next();
  return res.status(401).json({ok:false,error:'AUTH_REQUIRED'});
}

app.get('/login',(req,res)=>res.sendFile(path.join(__dirname,'public','login.html')));
app.get('/index.html',(req,res)=>req.session?.user?res.sendFile(path.join(__dirname,'public','index.html')):res.redirect('/login'));
app.get('/',(req,res)=>req.session?.user?res.sendFile(path.join(__dirname,'public','index.html')):res.redirect('/login'));

app.get('/api/auth/me',(req,res)=>{
  if(!req.session?.user) return res.status(401).json({ok:false});
  res.set('Cache-Control','no-store').json({ok:true,user:req.session.user});
});
app.post('/api/auth/login',async(req,res)=>{
  try{
    const username=clean(req.body?.username).toLowerCase();
    const password=String(req.body?.password||'');
    const key=loginKey(req,username);
    if(!loginAllowed(key))return res.status(429).json({ok:false,error:'LOGIN_BLOCKED'});
    const users=await readUsers();
    const user=users.find(u=>u.username===username && u.active);
    if(!passwordMatches(user,password)){
      loginFail(key);
      return res.status(401).json({ok:false,error:'INVALID_CREDENTIALS'});
    }
    loginAttempts.delete(key);
    req.session.user=publicUser(user);
    return res.json({ok:true,user:req.session.user});
  }catch(error){
    console.error(error);
    return res.status(500).json({ok:false,error:'LOGIN_ERROR'});
  }
});
app.post('/api/auth/logout',(req,res)=>{
  if(!req.session) return res.json({ok:true});
  req.session.destroy(()=>res.json({ok:true}));
});

function projectRow(r,rowNumber){
  const permitRefs=clean(r[28]);
  const derivedPermitStatus=
    permitRefs==='تحت الاصدار'?'تحت الإصدار':
    permitRefs==='مشروع ملغي'?'مشروع ملغي':
    clean(r[34])||'غير محدد';
  return {
    row:rowNumber,
    no:clean(r[0]),name:clean(r[1]),contractStatus:clean(r[3]),
    department:clean(r[6]),projectType:clean(r[7]),branch:clean(r[8]),
    owner:clean(r[18]),contractor:clean(r[19]),municipality:clean(r[21]),district:clean(r[22]),street:clean(r[23]),locationLink:clean(r[24]),
    lat:num(r[25]),lon:num(r[26]),transactionNo:clean(r[27]),
    permitRefs,permitCount:num(r[30]),permitDuration:clean(r[31]),
    permitExpiry:clean(r[32]),permitDays:num(r[33]),permitStatus:derivedPermitStatus,
    permitStatusSheet:clean(r[34]),permitMeters:num(r[35]),
    guaranteeRef:clean(r[36]),guaranteeExpiry:clean(r[38]),guaranteeDays:num(r[39]),
    guaranteeStatus:clean(r[40])
  };
}
function permitRow(r,rowNumber){
  return {
    row:rowNumber,id:clean(r[0]),start:clean(r[1]),end:clean(r[2]),
    duration:clean(r[3]),meters:num(r[4]),owner:clean(r[5]),year:clean(r[7]),
    municipality:clean(r[8]),district:clean(r[9]),street:clean(r[10]),
    consultant:clean(r[11]),contractor:clean(r[12])
  };
}
function lineRow(r,rowNumber){
  return {
    row:rowNumber,ref:clean(r[0]),name:clean(r[1]),municipality:clean(r[2]),
    district:clean(r[3]),street:clean(r[4]),contractor:clean(r[11]),
    owner:clean(r[12]),designer:clean(r[13]),type:clean(r[14]),length:num(r[15]),
    diameter:clean(r[17]),designStatus:clean(r[19]),executionStatus:clean(r[25]),
    completion:clean(r[26]),completionReport:clean(r[27]),handoverLetter:clean(r[28]),
    handoverDate:clean(r[29]),ownerDue:num(r[31]),remaining:num(r[32]),year:clean(r[33])
  };
}
function refLineRow(r,rowNumber){
  return {row:rowNumber,name:clean(r[16]),type:clean(r[17]),length:num(r[18]),ref:clean(r[19])};
}
function complaintRow(r,rowNumber){
  return {row:rowNumber,text:clean(r[21]),status:clean(r[22]),link:clean(r[23])};
}

function pairKey(owner,contractor){return clean(owner)+'||'+clean(contractor);}
function buildSettlements(projects,lines){
  const due=new Map(),done=new Map();
  for(const p of projects){
    if(!p.owner||!p.contractor||!p.permitMeters) continue;
    const k=pairKey(p.owner,p.contractor);
    const x=due.get(k)||{owner:p.owner,contractor:p.contractor,meters:0};
    x.meters+=p.permitMeters; due.set(k,x);
  }
  for(const l of lines){
    if(!l.owner||!l.contractor||!l.length) continue;
    const k=pairKey(l.owner,l.contractor);
    const x=done.get(k)||{owner:l.owner,contractor:l.contractor,meters:0};
    x.meters+=l.length; done.set(k,x);
  }
  const keys=new Set([...due.keys(),...done.keys()]);
  return [...keys].map(k=>{
    const a=due.get(k)||done.get(k);
    const dueMeters=due.get(k)?.meters||0;
    const executedMeters=done.get(k)?.meters||0;
    const balance=dueMeters-executedMeters;
    return {
      owner:a.owner,contractor:a.contractor,dueMeters,executedMeters,
      adjustment:0,balance,
      status:balance>0?'عليه أمتار':balance<0?'له أمتار':'مستوفي الأمتار'
    };
  }).sort((a,b)=>Math.abs(b.balance)-Math.abs(a.balance));
}

function qualityChecks(projects,permits,lines,refLines){
  const issues=[];
  const permitPattern=/^(?:\d+|\d+-\d+)$/;
  for(const p of permits){
    if(p.start&&p.end && p.id && !permitPattern.test(p.id)){
      issues.push({severity:'high',category:'رقم التصريح',source:'info. new',row:p.row,message:'قيمة غير نمطية في رقم التصريح: '+p.id});
    }
    if(p.start&&p.end&&!p.owner){
      issues.push({severity:'medium',category:'بيانات التصريح',source:'info. new',row:p.row,message:'تصريح مؤرخ بدون مالك'});
    }
  }
  for(const p of projects){
    if(p.permitRefs==='تحت الاصدار' && norm(p.permitStatusSheet)!==norm('تحت الاصدار')){
      issues.push({severity:'medium',category:'منطق الحالة',source:'vd projects',row:p.row,message:'التصريح تحت الإصدار لكن حالة الشيت الحالية: '+(p.permitStatusSheet||'فارغة')});
    }
    const validCoords=Number.isFinite(Number(p.lat))&&Number.isFinite(Number(p.lon))&&Number(p.lat)>20&&Number(p.lat)<23&&Number(p.lon)>38&&Number(p.lon)<41;
    if(!validCoords){
      issues.push({severity:'medium',category:'الإحداثيات',source:'vd projects',row:p.row,message:'إحداثيات E/N مفقودة أو غير صالحة للرسم على خريطة جدة'});
    }
  }
  const lineRefs=new Set(lines.map(x=>x.ref).filter(Boolean));
  for(const r of refLines){
    if(r.ref&&!lineRefs.has(r.ref)){
      issues.push({severity:'high',category:'ربط الخطوط',source:'info. new',row:r.row,message:'مرجع خط غير موجود في Alternative lines: '+r.ref});
    }
  }
  for(const l of lines){
    if(!l.contractor) issues.push({severity:'medium',category:'بيانات الخط',source:'Alternative lines',row:l.row,message:'خط بدون مقاول'});
    if(!l.owner) issues.push({severity:'medium',category:'بيانات الخط',source:'Alternative lines',row:l.row,message:'خط بدون مالك'});
    if(!l.designStatus) issues.push({severity:'low',category:'التصميم',source:'Alternative lines',row:l.row,message:'حالة التصميم غير مسجلة'});
  }
  return issues;
}

function countBy(rows,field){
  const out={};
  for(const row of rows){
    const v=clean(row[field])||'غير محدد';
    out[v]=(out[v]||0)+1;
  }
  return out;
}
function sum(rows,field){return Math.round(rows.reduce((a,x)=>a+num(x[field]),0)*100)/100;}

async function buildData(force=false){
  if(!force && cache.data && Date.now()-cache.at<CACHE_MS) return cache.data;
  if(!SPREADSHEET_ID) throw new Error('SPREADSHEET_ID is missing');
  const sheets=await sheetsApi();
  const ranges=[
    q('vd projects')+'!A1:AX1009',
    q('Alternative lines')+'!A1:AK982',
    q('info. new')+'!A1:AB1000',
    q('owners')+'!A1:H300'
  ];
  const result=await sheets.spreadsheets.values.batchGet({
    spreadsheetId:SPREADSHEET_ID,ranges,valueRenderOption:'FORMATTED_VALUE'
  });
  const [projectValues=[],lineValues=[],infoValues=[],ownerValues=[]]=(result.data.valueRanges||[]).map(x=>x.values||[]);

  const projects=projectValues.slice(1).map((r,i)=>projectRow(r,i+2)).filter(x=>x.no||x.name);
  const lines=lineValues.slice(1).map((r,i)=>lineRow(r,i+2)).filter(x=>x.ref||x.name);
  const permits=infoValues.slice(1).map((r,i)=>permitRow(r,i+2)).filter(x=>x.id);
  const refLines=infoValues.slice(1).map((r,i)=>refLineRow(r,i+2)).filter(x=>x.ref||x.name);
  const complaints=infoValues.slice(1).map((r,i)=>complaintRow(r,i+2)).filter(x=>x.text);
  const owners=ownerValues.slice(1).map((r,i)=>({row:i+2,owner:clean(r[6]),meters:num(r[7])})).filter(x=>x.owner);

  const actualPermits=permits.filter(x=>x.start&&x.end);
  const underIssue=permits.filter(x=>norm(x.id)===norm('تحت الاصدار'));
  const cancelledPermits=permits.filter(x=>norm(x.id)===norm('مشروع ملغي'));
  const today=DateTime.now().setZone('Asia/Riyadh').startOf('day');
  const permitTiming={expired:0,expiring:0,valid:0,unknown:0};
  actualPermits.forEach(x=>{
    const d=parseDate(x.end);
    if(!d){permitTiming.unknown++;return}
    const days=Math.floor(d.diff(today,'days').days);
    if(days<0) permitTiming.expired++;
    else if(days<=7) permitTiming.expiring++;
    else permitTiming.valid++;
  });

  const settlements=buildSettlements(projects,lines);
  const quality=qualityChecks(projects,permits,lines,refLines);
  const data={
    updatedAt:DateTime.now().setZone('Asia/Riyadh').toISO(),
    projectTitle:'إدارة الحلول العاجلة',
    summaries:{
      projects:projects.length,
      actualPermits:actualPermits.length,
      underIssue:underIssue.length,
      cancelledPermits:cancelledPermits.length,
      permitMeters:sum(actualPermits,'meters'),
      lines:lines.length,
      lineMeters:sum(lines,'length'),
      complaints:complaints.length,
      qualityIssues:quality.length
    },
    permitTiming,
    distributions:{
      projectStatus:countBy(projects,'contractStatus'),
      projectType:countBy(projects,'projectType'),
      municipalities:countBy(projects,'municipality'),
      permitStatus:countBy(projects,'permitStatus'),
      guaranteeStatus:countBy(projects,'guaranteeStatus'),
      lineType:countBy(lines,'type'),
      designStatus:countBy(lines,'designStatus'),
      executionStatus:countBy(lines,'executionStatus'),
      permitYears:countBy(actualPermits,'year'),
      settlementStatus:countBy(settlements,'status')
    },
    projects,permits,actualPermits,lines,refLines,complaints,owners,settlements,quality,
    sourceHeaders:{
      projects:projectValues[0]||[],lines:lineValues[0]||[],info:infoValues[0]||[],owners:ownerValues[0]||[]
    }
  };
  cache={at:Date.now(),data};
  return data;
}

app.get('/api/data',requireAuth,async(req,res)=>{
  try{
    const data=await buildData(req.query.refresh==='1');
    res.set('Cache-Control','no-store').json({ok:true,...data});
  }catch(error){
    const snapshot=readSnapshot();
    if(snapshot){
      console.warn('Live data unavailable, serving snapshot:',error.message);
      const payload={...snapshot,sourceMode:'snapshot',liveError:error.message};
      return res.set('Cache-Control','no-store').json({ok:true,...payload});
    }
    console.error('Data API error:',error);
    res.status(500).json({ok:false,error:'DATA_LOAD_FAILED',message:error.message});
  }
});

const RAW_EXPORT_SOURCES={
  'vd projects':'A1:AX1009',
  'Alternative lines':'A1:AK982',
  'info. new':'A1:AB1000',
  'owners':'A1:H300'
};
function columnLetter(index){
  let n=Number(index)+1,s='';
  while(n>0){const r=(n-1)%26;s=String.fromCharCode(65+r)+s;n=Math.floor((n-1)/26)}
  return s;
}
function exportRowIsReal(sheet,row){
  if(sheet==='vd projects')return clean(row[0])!==''||clean(row[1])!=='';
  if(sheet==='Alternative lines')return clean(row[0])!==''||clean(row[1])!=='';
  if(sheet==='info. new')return row.some(v=>clean(v)!=='');
  if(sheet==='owners')return row.some(v=>clean(v)!=='');
  return row.some(v=>clean(v)!=='');
}
app.get('/api/export/source',requireAuth,async(req,res)=>{
  try{
    const sheet=clean(req.query.sheet);
    const range=RAW_EXPORT_SOURCES[sheet];
    if(!range)return res.status(400).json({ok:false,error:'UNKNOWN_SOURCE'});
    const sheets=await sheetsApi();
    const response=await sheets.spreadsheets.values.get({
      spreadsheetId:SPREADSHEET_ID,
      range:q(sheet)+'!'+range,
      valueRenderOption:'FORMATTED_VALUE'
    });
    const values=response.data.values||[];
    const header=values[0]||[];
    const dataRows=values.slice(1).filter(r=>exportRowIsReal(sheet,r));
    const width=Math.max(header.length,...dataRows.map(r=>r.length),0);
    const used=[];
    for(let c=0;c<width;c++){
      const hasData=clean(header[c])!==''||dataRows.some(r=>clean(r[c])!=='');
      if(hasData)used.push(c);
    }
    const columns=used.map(c=>({
      key:'c'+c,
      index:c,
      letter:columnLetter(c),
      header:clean(header[c]),
      label:(clean(header[c])||('عمود '+columnLetter(c)))+' ['+columnLetter(c)+']'
    }));
    const rows=dataRows.map((r,i)=>{
      const out={__row:i+2};
      columns.forEach(c=>{out[c.key]=r[c.index]??''});
      return out;
    });
    res.set('Cache-Control','no-store').json({ok:true,sheet,columns,rows,count:rows.length});
  }catch(error){
    const sheet=clean(req.query.sheet);
    const snapshot=readSnapshot();
    const fallback=snapshot?.rawSources?.[sheet];
    if(fallback?.ok){
      console.warn('Live export source unavailable, serving snapshot:',sheet,error.message);
      return res.set('Cache-Control','no-store').json({...fallback,sourceMode:'snapshot'});
    }
    console.error('Export source error:',error);
    res.status(500).json({ok:false,error:'SOURCE_LOAD_FAILED',message:error.message});
  }
});

app.post('/api/export/xlsx',requireAuth,(req,res)=>{
  try{
    const title=clean(req.body?.title)||'UrgentSolutions_Report';
    const columns=Array.isArray(req.body?.columns)?req.body.columns.slice(0,80):[];
    const rows=Array.isArray(req.body?.rows)?req.body.rows.slice(0,10000):[];
    const aoa=[columns.map(c=>clean(c.label||c.key))];
    for(const row of rows){
      aoa.push(columns.map(c=>row?.[c.key]??''));
    }
    const wb=XLSX.utils.book_new();
    const ws=XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols']=columns.map(c=>({wch:Math.min(45,Math.max(12,Number(c.width)||18))}));
    XLSX.utils.book_append_sheet(wb,ws,'Report');
    const buffer=XLSX.write(wb,{type:'buffer',bookType:'xlsx'});
    res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition',"attachment; filename*=UTF-8''"+encodeURIComponent(title+'.xlsx'));
    res.send(buffer);
  }catch(error){
    console.error(error);
    res.status(500).json({ok:false,error:'EXPORT_FAILED'});
  }
});

app.get('/api/health',async(req,res)=>{
  try{
    const sheets=await sheetsApi();
    await sheets.spreadsheets.values.get({spreadsheetId:SPREADSHEET_ID,range:q('vd projects')+'!A1:B2'});
    res.json({ok:true,project:'Urgent Solutions Dashboard',sheetConnected:true,sourceMode:'live',port:PORT});
  }catch(error){
    const snapshot=readSnapshot();
    if(snapshot){
      return res.json({ok:true,project:'Urgent Solutions Dashboard',sheetConnected:false,sourceMode:'snapshot',snapshotGeneratedAt:snapshot.snapshotGeneratedAt||null,port:PORT});
    }
    res.status(500).json({ok:false,sheetConnected:false,message:error.message});
  }
});

app.use(express.static(path.join(__dirname,'public'),{index:false,maxAge:'5m'}));

app.listen(PORT,()=>console.log('Urgent Solutions Dashboard: http://localhost:'+PORT));
