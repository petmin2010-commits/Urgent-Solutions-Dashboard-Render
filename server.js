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
app.set('trust proxy',1);
const PORT=Number(process.env.PORT||3012);
const SPREADSHEET_ID=String(process.env.SPREADSHEET_ID||'').trim();
const CREDENTIALS_PATH=String(process.env.GOOGLE_CREDENTIALS_PATH||'').trim();
const AUTH_SHEET=String(process.env.AUTH_SHEET||'Dashboard Users').trim();
const CACHE_MS=20*1000;
const SNAPSHOT_PATH=path.join(__dirname,'data-snapshot.json');
let cache={at:0,data:null};
const STALE_CACHE_MS=5*60*1000;
let buildDataInFlight=null;
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
app.set('trust proxy',1);
app.use(express.json({limit:'10mb'}));
app.use(express.urlencoded({extended:false}));
const SESSION_SECRET=process.env.SESSION_SECRET||crypto.randomBytes(48).toString('hex');
app.use(session({
  name:'vd_urgent_sid',
  secret:SESSION_SECRET,
  resave:false,
  saveUninitialized:false,
  rolling:true,
  cookie:{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',maxAge:8*60*60*1000}
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
  if(process.env.GOOGLE_SERVICE_ACCOUNT_B64){
    const decoded=Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_B64,'base64').toString('utf8');
    return JSON.parse(decoded);
  }
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
    scopes:['https://www.googleapis.com/auth/spreadsheets']
  });
  return google.sheets({version:'v4',auth});
}
function q(name){return "'" + String(name).replace(/'/g,"''") + "'";}

let sourceSheetLinksCache={at:0,map:{}};
async function sourceSheetLinks_(sheets){
  if(Date.now()-sourceSheetLinksCache.at<10*60*1000&&Object.keys(sourceSheetLinksCache.map).length)return sourceSheetLinksCache.map;
  const r=await sheets.spreadsheets.get({spreadsheetId:SPREADSHEET_ID,fields:'sheets.properties(sheetId,title)'});
  const map={};
  for(const sh of r.data.sheets||[]){
    const p=sh.properties||{},title=clean(p.title);
    if(title)map[title]='https://docs.google.com/spreadsheets/d/'+SPREADSHEET_ID+'/edit#gid='+String(p.sheetId);
  }
  sourceSheetLinksCache={at:Date.now(),map};
  return map;
}

const SMART_HISTORY_SHEET='Dashboard History';
const SMART_HISTORY_HEADERS=[
  'date','timestamp','project','projects','permits','permitMeters','lines','lineMeters','coverage',
  'highRisk','expired','expiring','quality','complaints','designPending','gap','handover','health',
  'newIssues','resolvedIssues','issueKeysJson','categoriesJson','contractorsJson','version'
];
const THURSDAY_PROGRESS_SHEET='VD Thursday Progress';
const THURSDAY_PROGRESS_HEADERS=[
  'date','timestamp','project','overallRate','totalOrders','completed','sectionMetricsJson','summaryJson','version'
];
const PROJECT_NEWS_SHEET='Dashboard News';
const PROJECT_NEWS_HEADERS=[
  'timestamp','eventKey','priority','category','title','summary','source','sourceSheet','sheetUrl','active','stateJson','lastSeen','version'
];

async function ensureSystemSheet_(title,headers,rowCount=5000){
  const sheets=await sheetsApi();
  const meta=await sheets.spreadsheets.get({
    spreadsheetId:SPREADSHEET_ID,
    fields:'sheets.properties(sheetId,title,gridProperties(columnCount))'
  });
  const found=(meta.data.sheets||[]).find(s=>s.properties?.title===title);
  if(!found){
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId:SPREADSHEET_ID,
      requestBody:{requests:[{addSheet:{properties:{
        title,gridProperties:{rowCount,columnCount:headers.length},rightToLeft:true
      }}}]}
    });
  }else if(Number(found.properties?.gridProperties?.columnCount||0)<headers.length){
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId:SPREADSHEET_ID,
      requestBody:{requests:[{updateSheetProperties:{
        properties:{sheetId:found.properties.sheetId,gridProperties:{columnCount:headers.length}},
        fields:'gridProperties.columnCount'
      }}]}
    });
  }
  const lastCol=columnLetter_(headers.length-1);
  await sheets.spreadsheets.values.update({
    spreadsheetId:SPREADSHEET_ID,
    range:q(title)+'!A1:'+lastCol+'1',
    valueInputOption:'RAW',
    requestBody:{values:[headers]}
  });
  sourceSheetLinksCache={at:0,map:{}};
  return sheets;
}
function columnLetter_(index){
  let n=Number(index)+1,s='';
  while(n>0){const r=(n-1)%26;s=String.fromCharCode(65+r)+s;n=Math.floor((n-1)/26)}
  return s;
}
function safeJsonParse_(v,fallback){try{return JSON.parse(String(v||''))}catch{return fallback}}
function smartNum_(v){const x=Number(v);return Number.isFinite(x)?Math.round(x*10)/10:0}
function smartIssueHashes_(keys){
  return [...new Set((Array.isArray(keys)?keys:[]).slice(0,2200).map(x=>
    crypto.createHash('sha1').update(String(x||'')).digest('hex').slice(0,12)
  ))];
}
function smartHistoryRowToObj_(r,rowNumber){
  return {
    rowNumber,
    date:String(r[0]||''),timestamp:String(r[1]||''),project:String(r[2]||''),
    projects:smartNum_(r[3]),permits:smartNum_(r[4]),permitMeters:smartNum_(r[5]),
    lines:smartNum_(r[6]),lineMeters:smartNum_(r[7]),coverage:smartNum_(r[8]),
    highRisk:smartNum_(r[9]),expired:smartNum_(r[10]),expiring:smartNum_(r[11]),
    quality:smartNum_(r[12]),complaints:smartNum_(r[13]),designPending:smartNum_(r[14]),
    gap:smartNum_(r[15]),handover:smartNum_(r[16]),health:smartNum_(r[17]),
    newIssues:smartNum_(r[18]),resolvedIssues:smartNum_(r[19]),
    issueKeys:safeJsonParse_(r[20],[]),categories:safeJsonParse_(r[21],{}),contractors:safeJsonParse_(r[22],{}),
    version:String(r[23]||'')
  };
}
async function saveSmartHistory(payload){
  const sheets=await ensureSystemSheet_(SMART_HISTORY_SHEET,SMART_HISTORY_HEADERS,5000);
  const zone='Asia/Riyadh',now=DateTime.now().setZone(zone),today=now.toISODate(),timestamp=now.toFormat('yyyy-LL-dd HH:mm:ss');
  const summary=payload?.summary&&typeof payload.summary==='object'?payload.summary:{};
  const categories=payload?.categories&&typeof payload.categories==='object'?payload.categories:{};
  const contractors=payload?.contractors&&typeof payload.contractors==='object'?payload.contractors:{};
  const issueKeys=smartIssueHashes_(payload?.issueKeys);
  const raw=(await sheets.spreadsheets.values.get({
    spreadsheetId:SPREADSHEET_ID,range:q(SMART_HISTORY_SHEET)+'!A2:X5000',valueRenderOption:'UNFORMATTED_VALUE'
  })).data.values||[];
  const history=raw.map((r,i)=>smartHistoryRowToObj_(r,i+2)).filter(x=>x.date);
  const previous=[...history].filter(x=>x.date<today).sort((a,b)=>b.date.localeCompare(a.date))[0]||null;
  const previousKeys=new Set(previous?.issueKeys||[]),currentKeys=new Set(issueKeys);
  const newIssues=previous?issueKeys.filter(k=>!previousKeys.has(k)).length:0;
  const resolvedIssues=previous?[...previousKeys].filter(k=>!currentKeys.has(k)).length:0;
  const row=[
    today,timestamp,'إدارة الحلول العاجلة',
    smartNum_(summary.projects),smartNum_(summary.permits),smartNum_(summary.permitMeters),
    smartNum_(summary.lines),smartNum_(summary.lineMeters),smartNum_(summary.coverage),
    smartNum_(summary.highRisk),smartNum_(summary.expired),smartNum_(summary.expiring),
    smartNum_(summary.quality),smartNum_(summary.complaints),smartNum_(summary.designPending),
    smartNum_(summary.gap),smartNum_(summary.handover),smartNum_(summary.health),
    newIssues,resolvedIssues,JSON.stringify(issueKeys),JSON.stringify(categories),JSON.stringify(contractors),'v2'
  ];
  const todayRow=history.find(x=>x.date===today);
  if(todayRow){
    await sheets.spreadsheets.values.update({
      spreadsheetId:SPREADSHEET_ID,range:q(SMART_HISTORY_SHEET)+'!A'+todayRow.rowNumber+':X'+todayRow.rowNumber,
      valueInputOption:'RAW',requestBody:{values:[row]}
    });
  }else{
    await sheets.spreadsheets.values.append({
      spreadsheetId:SPREADSHEET_ID,range:q(SMART_HISTORY_SHEET)+'!A:X',
      valueInputOption:'RAW',insertDataOption:'INSERT_ROWS',requestBody:{values:[row]}
    });
  }
  const current=smartHistoryRowToObj_(row,todayRow?.rowNumber||history.length+2);
  const full=[...history.filter(x=>x.date!==today),current].sort((a,b)=>a.date.localeCompare(b.date));
  const memoryHistory=full.slice(-180).map(x=>({
    date:x.date,timestamp:x.timestamp,projects:x.projects,permits:x.permits,permitMeters:x.permitMeters,
    lines:x.lines,lineMeters:x.lineMeters,coverage:x.coverage,highRisk:x.highRisk,expired:x.expired,expiring:x.expiring,
    quality:x.quality,complaints:x.complaints,designPending:x.designPending,gap:x.gap,handover:x.handover,health:x.health,
    newIssues:x.newIssues,resolvedIssues:x.resolvedIssues,categories:x.categories||{},contractors:x.contractors||{}
  }));
  const changes={};
  for(const k of ['projects','permits','permitMeters','lines','lineMeters','coverage','highRisk','expired','expiring','quality','complaints','designPending','gap','handover','health']){
    changes[k]=previous?smartNum_(summary[k])-smartNum_(previous[k]):0;
  }
  changes.newIssues=newIssues;changes.resolvedIssues=resolvedIssues;
  return {
    ok:true,source:'google-sheet',sheet:SMART_HISTORY_SHEET,today,updatedAt:timestamp,
    current:{date:today,...summary,newIssues,resolvedIssues},
    previous:previous?{...previous,issueKeys:undefined,categories:undefined,contractors:undefined}:null,
    changes,
    history:memoryHistory.slice(-30),memoryHistory,
    memoryCoverage:{days:memoryHistory.length,from:memoryHistory[0]?.date||today,to:memoryHistory[memoryHistory.length-1]?.date||today}
  };
}
function thursdayProgressNum_(v){
  const x=Number(v);return Number.isFinite(x)?Math.max(0,Math.min(100,Math.round(x*10)/10)):0;
}
function isThursdaySnapshotDate_(dateStr){
  const d=DateTime.fromISO(String(dateStr||''),{zone:'Asia/Riyadh'}).startOf('day');
  return !!(d.isValid&&d.weekday===4);
}
async function syncThursdayProgressHistory(payload){
  const sheets=await ensureSystemSheet_(THURSDAY_PROGRESS_SHEET,THURSDAY_PROGRESS_HEADERS,2500);
  const now=DateTime.now().setZone('Asia/Riyadh'),today=now.toISODate(),timestamp=now.toFormat('yyyy-LL-dd HH:mm:ss');
  const sections=Array.isArray(payload?.sections)?payload.sections.slice(0,30).map(x=>({
    key:clean(x?.key),label:clean(x?.label),rate:thursdayProgressNum_(x?.rate),
    total:Math.max(0,Number(x?.total||0)),completed:Math.max(0,Number(x?.completed||0))
  })):[];
  const summary=payload?.summary&&typeof payload.summary==='object'?payload.summary:{};
  const overallRate=thursdayProgressNum_(payload?.overallRate);
  const totalOrders=Math.max(0,Number(payload?.totalOrders||0)),completed=Math.max(0,Number(payload?.completed||0));
  const raw=(await sheets.spreadsheets.values.get({
    spreadsheetId:SPREADSHEET_ID,range:q(THURSDAY_PROGRESS_SHEET)+'!A2:I2500',valueRenderOption:'UNFORMATTED_VALUE'
  })).data.values||[];
  const rows=raw.map((r,i)=>({
    row:i+2,date:String(r[0]||''),timestamp:String(r[1]||''),project:String(r[2]||''),
    overallRate:thursdayProgressNum_(r[3]),totalOrders:Number(r[4]||0),completed:Number(r[5]||0),
    sections:safeJsonParse_(r[6],[]),summary:safeJsonParse_(r[7],{})
  })).filter(x=>x.date);
  const isThursday=now.weekday===4;
  const outRow=[today,timestamp,'إدارة الحلول العاجلة',overallRate,totalOrders,completed,JSON.stringify(sections),JSON.stringify(summary),'v2'];
  const current=rows.find(x=>x.date===today);
  const currentObj={row:current?.row||rows.length+2,date:today,timestamp,project:'إدارة الحلول العاجلة',overallRate,totalOrders,completed,sections,summary};
  if(isThursday){
    if(current){
      await sheets.spreadsheets.values.update({
        spreadsheetId:SPREADSHEET_ID,range:q(THURSDAY_PROGRESS_SHEET)+'!A'+current.row+':I'+current.row,
        valueInputOption:'RAW',requestBody:{values:[outRow]}
      });
    }else{
      await sheets.spreadsheets.values.append({
        spreadsheetId:SPREADSHEET_ID,range:q(THURSDAY_PROGRESS_SHEET)+'!A:I',
        valueInputOption:'RAW',insertDataOption:'INSERT_ROWS',requestBody:{values:[outRow]}
      });
    }
  }
  let snapshots=rows.filter(x=>isThursdaySnapshotDate_(x.date)&&x.date!==today);
  if(isThursday)snapshots.push(currentObj);
  snapshots=snapshots.sort((a,b)=>a.date.localeCompare(b.date));
  const previous=[...snapshots].reverse().find(x=>x.date<today)||null;
  const prevMap=new Map((previous?.sections||[]).map(x=>[x.key,x]));
  const sectionChanges=sections.map(x=>({
    key:x.key,label:x.label,current:x.rate,
    previous:prevMap.has(x.key)?thursdayProgressNum_(prevMap.get(x.key).rate):null,
    delta:prevMap.has(x.key)?Math.round((x.rate-thursdayProgressNum_(prevMap.get(x.key).rate))*10)/10:null
  }));
  return {
    ok:true,source:'google-sheet',sheet:THURSDAY_PROGRESS_SHEET,updatedAt:timestamp,
    trend:snapshots.slice(-16).map(x=>({week:x.date,date:x.date,label:DateTime.fromISO(x.date,{zone:'Asia/Riyadh'}).toFormat('dd/LL'),overallRate:x.overallRate,totalOrders:x.totalOrders,completed:x.completed,sections:x.sections||[],summary:x.summary||{}})),
    previousWeek:previous,baselineDate:previous?.date||null,snapshotToday:isThursday,
    overallDelta:previous?Math.round((overallRate-previous.overallRate)*10)/10:null,sectionChanges
  };
}

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

app.get('/login',(req,res)=>{res.set('Cache-Control','no-store, max-age=0');res.sendFile(path.join(__dirname,'public','login.html'))});
function sendDashboard(req,res){
  if(!req.session?.user)return res.redirect('/login');
  res.set('Cache-Control','no-store, max-age=0, must-revalidate');
  res.set('Pragma','no-cache');
  res.set('Expires','0');
  return res.sendFile(path.join(__dirname,'public','index.html'));
}
app.get('/index.html',sendDashboard);
app.get('/',sendDashboard);

app.get('/api/auth/photo',async(req,res)=>{
  try{
    res.set('Cache-Control','no-store, max-age=0');
    if(!req.session?.user?.username) return res.status(401).end();
    const users=await readUsers();
    const username=String(req.session.user.username||'').trim().toLowerCase();
    const user=users.find(u=>u.username===username);
    const imageUrl=String(user?.image||'').trim();
    if(!imageUrl) return res.status(404).end();
    const upstream=await fetch(imageUrl,{redirect:'follow'});
    if(!upstream.ok) return res.status(404).end();
    const contentType=upstream.headers.get('content-type')||'image/jpeg';
    if(!contentType.toLowerCase().startsWith('image/')) return res.status(415).end();
    const bytes=Buffer.from(await upstream.arrayBuffer());
    res.set('Content-Type',contentType);
    res.set('Content-Length',String(bytes.length));
    return res.status(200).send(bytes);
  }catch(error){
    console.error('User photo proxy error:',error);
    return res.status(500).end();
  }
});

app.get('/api/auth/me',async(req,res)=>{
  res.set('Cache-Control','no-store');
  if(!req.session?.user)return res.status(401).json({ok:false,authenticated:false});
  try{
    const username=String(req.session.user.username||'').trim().toLowerCase();
    const users=await readUsers();
    const user=users.find(u=>u.username===username&&u.active);
    if(!user){req.session.destroy(()=>{});return res.status(401).json({ok:false,authenticated:false})}
    req.session.user=publicUser(user);
    return res.json({ok:true,authenticated:true,user:req.session.user});
  }catch(error){
    console.error('Auth refresh error:',error);
    return res.json({ok:true,authenticated:true,user:req.session.user,staleAuth:true});
  }
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

function geoPair(a,b){
  const x=num(a),y=num(b);
  const xLat=x>20&&x<23,xLon=x>38&&x<41,yLat=y>20&&y<23,yLon=y>38&&y<41;
  if(xLat&&yLon)return {lat:x,lon:y};
  if(yLat&&xLon)return {lat:y,lon:x};
  return {lat:x,lon:y};
}
function projectRow(r,rowNumber){
  const geo=geoPair(r[25],r[26]);
  const permitRefs=clean(r[28]);
  const derivedPermitStatus=
    permitRefs==='تحت الاصدار'?'تحت الإصدار':
    permitRefs==='مشروع ملغي'?'مشروع ملغي':
    clean(r[34])||'غير محدد';
  return {
    row:rowNumber,
    no:clean(r[0]),name:clean(r[1]),contractStatus:clean(r[3]),company:clean(r[4]),contractNo:clean(r[5]),
    department:clean(r[6]),projectType:clean(r[7]),branch:clean(r[8]),startDate:clean(r[9]),endDate:clean(r[10]),
    owner:clean(r[18]),contractor:clean(r[19]),lab:clean(r[20]),municipality:clean(r[21]),district:clean(r[22]),street:clean(r[23]),locationLink:clean(r[24]),
    lat:geo.lat,lon:geo.lon,transactionNo:clean(r[27]),
    permitRefs,permitCount:num(r[30]),permitDuration:clean(r[31]),
    permitExpiry:clean(r[32]),permitDays:num(r[33]),permitStatus:derivedPermitStatus,
    permitStatusSheet:clean(r[34]),permitMeters:num(r[35]),
    guaranteeRef:clean(r[36]),guaranteeLink:clean(r[37]),guaranteeExpiry:clean(r[38]),guaranteeDays:num(r[39]),
    guaranteeStatus:clean(r[40]),handoverNo:clean(r[41]),handoverDate:clean(r[42]),handoverLink:clean(r[43]),
    clearance:clean(r[44]),pumpReportLink:clean(r[45])
  };
}
function permitRow(r,rowNumber){
  return {
    row:rowNumber,id:clean(r[0]),start:clean(r[1]),end:clean(r[2]),
    duration:clean(r[3]),meters:num(r[4]),owner:clean(r[5]),permitLink:clean(r[6]),year:clean(r[7]),
    helperMunicipality:clean(r[8]),helperDistrict:clean(r[9]),helperStreet:clean(r[10]),
    helperConsultant:clean(r[11]),helperContractor:clean(r[12])
  };
}
function lineRow(r,rowNumber){
  const geo=geoPair(r[6],r[7]);
  return {
    row:rowNumber,ref:clean(r[0]),name:clean(r[1]),municipality:clean(r[2]),
    district:clean(r[3]),street:clean(r[4]),locationLink:clean(r[5]),lat:geo.lat,lon:geo.lon,
    assignmentNo:clean(r[8]),assignmentLink:clean(r[9]),assignmentDate:clean(r[10]),contractor:clean(r[11]),
    owner:clean(r[12]),designer:clean(r[13]),type:clean(r[14]),length:num(r[15]),designLength:num(r[16]),
    diameter:clean(r[17]),designLink:clean(r[18]),designStatus:clean(r[19]),transactionNo:clean(r[20]),
    submissionDate:clean(r[21]),approvalDate:clean(r[22]),approvalLink:clean(r[23]),rev:clean(r[24]),
    executionStatus:clean(r[25]),completion:clean(r[26]),completionReport:clean(r[27]),handoverLetter:clean(r[28]),
    handoverDate:clean(r[29]),notes:clean(r[30]),ownerDue:num(r[31]),remaining:num(r[32]),year:clean(r[33])
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


function sheetColIndex(label){
  let n=0;
  for(const ch of String(label||'').toUpperCase())n=n*26+(ch.charCodeAt(0)-64);
  return Math.max(0,n-1);
}
function reportTableFromValues(values,startCol,endCol,startRow=3,endRow=100){
  const a=sheetColIndex(startCol),b=sheetColIndex(endCol),rows=[];
  for(let r=startRow-1;r<Math.min(endRow,values.length);r++){
    const src=values[r]||[],row=[];
    for(let c=a;c<=b;c++)row.push(clean(src[c]??''));
    if(row.some(v=>v!==''))rows.push(row);
  }
  return {headers:rows[0]||[],rows:rows.slice(1)};
}
function contractorReportFromValues(values,startCol){
  const s=sheetColIndex(startCol),pick=[0,1,2,3,4,6,7,8,9,10,11];
  const title=clean(values[1]?.[s]??''),total=clean(values[1]?.[s+10]??'');
  const headers=pick.map(i=>clean(values[2]?.[s+i]??''));
  const rows=[];
  for(let r=3;r<Math.min(100,values.length);r++){
    const src=values[r]||[],raw=Array.from({length:12},(_,i)=>clean(src[s+i]??''));
    const meaningful=[0,1,2,3,4,6,7,8,10,11].some(i=>raw[i]!=='');
    if(meaningful)rows.push(pick.map(i=>raw[i]));
  }
  return {title,total,headers,rows};
}
function buildSheetReports(values){
  const contractors=['AA','AM','AY','BK','BW','CI','CU'].map(c=>contractorReportFromValues(values,c));
  const neighborhood=reportTableFromValues(values,'DG','DI',3,100);
  const findGrand=table=>table.rows.find(r=>norm(r[0])===norm('Grand Total'))||[];
  const findBlank=table=>table.rows.find(r=>clean(r[0])==='')||[];
  return {
    sourceSheet:'reports',pivotCount:15,
    projectsByOwner:reportTableFromValues(values,'A','B',3,100),
    permitsByYear:reportTableFromValues(values,'D','F',3,30),
    permitsByContractor:reportTableFromValues(values,'G','I',3,40),
    permitsByOwner:reportTableFromValues(values,'J','L',3,100),
    linesByYear:reportTableFromValues(values,'N','Q',3,60),
    linesByContractor:reportTableFromValues(values,'R','U',3,60),
    linesByOwner:reportTableFromValues(values,'V','Y',3,100),
    contractors,
    linesByDistrict:neighborhood,
    audit:{
      districtPivotGrandCount:clean(findGrand(neighborhood)[2]||''),
      blankDistrictCount:clean(findBlank(neighborhood)[2]||''),
      districtPivotGrandMeters:clean(findGrand(neighborhood)[1]||'')
    }
  };
}

function splitPermitRefs(v){
  return clean(v).split(/[,،]+/).map(clean).filter(x=>x&&norm(x)!==norm('تحت الاصدار')&&norm(x)!==norm('مشروع ملغي'));
}
function enrichPermitsWithProjects(permits,projects){
  const index=new Map();
  for(const p of projects){
    for(const id of splitPermitRefs(p.permitRefs)){
      if(!index.has(norm(id)))index.set(norm(id),p);
    }
  }
  const today=DateTime.now().setZone('Asia/Riyadh').startOf('day');
  return permits.map(x=>{
    const p=index.get(norm(x.id)),end=parseDate(x.end);
    const expiryDays=end?Math.floor(end.diff(today,'days').days):null;
    const expiryBand=expiryDays===null?'غير محدد':expiryDays<0?'منتهي':expiryDays<=7?'0–7 أيام':expiryDays<=30?'8–30 يوم':expiryDays<=60?'31–60 يوم':'>60 يوم';
    return {
      ...x,
      projectNo:p?.no||'',projectName:p?.name||'',
      municipality:p?.municipality||'',district:p?.district||'',street:p?.street||'',
      contractor:p?.contractor||'',consultant:'أبعاد الرؤية',
      projectOwner:p?.owner||'',contractStatus:p?.contractStatus||'',
      permitStatus:p?.permitStatus||'',guaranteeStatus:p?.guaranteeStatus||'',
      expiryDays,expiryBand
    };
  });
}
function enrichLines(lines,today){
  return lines.map(l=>{
    const submission=parseDate(l.submissionDate),approval=parseDate(l.approvalDate),assignment=parseDate(l.assignmentDate);
    const approvalDays=submission&&approval?Math.round(approval.diff(submission,'days').days):null;
    const assignmentToSubmissionDays=assignment&&submission?Math.round(submission.diff(assignment,'days').days):null;
    const designAgeDays=submission&&!approval?Math.max(0,Math.round(today.diff(submission,'days').days)):0;
    const designLengthDiff=l.designLength&&l.length?Math.round((l.designLength-l.length)*100)/100:null;
    const designAgeBand=designAgeDays<=0?'غير نشط':designAgeDays<=30?'0–30 يوم':designAgeDays<=60?'31–60 يوم':designAgeDays<=180?'61–180 يوم':'>180 يوم';
    const approvalBand=approvalDays===null?'غير محدد':approvalDays<=7?'0–7 أيام':approvalDays<=30?'8–30 يوم':approvalDays<=60?'31–60 يوم':'>60 يوم';
    return {...l,approvalDays,assignmentToSubmissionDays,designAgeDays,designAgeBand,approvalBand,designLengthDiff,
      chronologyIssue:assignmentToSubmissionDays!==null&&assignmentToSubmissionDays<0};
  });
}
function enrichSettlements(rows){
  return rows.map(x=>{
    const coveragePct=x.dueMeters?Math.round((x.executedMeters/x.dueMeters)*1000)/10:null;
    const coverageBand=coveragePct===null?'بدون مستحق':coveragePct===0?'0%':coveragePct<50?'<50%':coveragePct<80?'50–79%':coveragePct<100?'80–99%':'≥100%';
    return {...x,coveragePct,coverageBand,balanceAbs:Math.abs(x.balance)};
  });
}
function projectRisk(project,pair){
  let score=0;const reasons=[];
  const permitDays=parseDate(project.permitExpiry)?.diff(DateTime.now().setZone('Asia/Riyadh').startOf('day'),'days').days;
  if(norm(project.permitRefs)===norm('تحت الاصدار')){score+=15;reasons.push('التصريح تحت الإصدار')}
  else if(permitDays!=null&&permitDays<0){score+=30;reasons.push('التصريح منتهي')}
  else if(permitDays!=null&&permitDays<=7){score+=25;reasons.push('التصريح خلال 7 أيام')}
  else if(permitDays!=null&&permitDays<=30){score+=18;reasons.push('التصريح خلال 30 يوم')}
  else if(permitDays!=null&&permitDays<=60){score+=10;reasons.push('التصريح خلال 60 يوم')}
  else if(!project.permitRefs){score+=12;reasons.push('لا توجد بيانات تصريح')}
  const gs=norm(project.guaranteeStatus);
  if(gs.includes(norm('منتهي'))){score+=25;reasons.push('الضمان منتهي')}
  else if(gs.includes(norm('أوشك'))){score+=15;reasons.push('الضمان يوشك على الانتهاء')}
  else if(gs.includes(norm('بانتظار'))){score+=15;reasons.push('بانتظار ضمان/تعهد')}
  else if(gs.includes(norm('تعهد'))){score+=4;reasons.push('يوجد تعهد بدل الضمان')}
  const cov=pair?.coveragePct;
  if(pair&&pair.dueMeters>0){
    if(cov===0){score+=20;reasons.push('لا توجد تغطية أمتار مطابقة')}
    else if(cov<50){score+=15;reasons.push('تغطية الأمتار أقل من 50%')}
    else if(cov<80){score+=10;reasons.push('تغطية الأمتار أقل من 80%')}
    else if(cov<100){score+=5;reasons.push('تغطية الأمتار أقل من 100%')}
  }
  if(!project.contractStatus){score+=8;reasons.push('حالة العقد غير محددة')}
  else if(norm(project.contractStatus).includes(norm('متوقف'))){score+=8;reasons.push('العقد متوقف')}
  const validCoords=Number(project.lat)>20&&Number(project.lat)<23&&Number(project.lon)>38&&Number(project.lon)<41;
  if(!validCoords){score+=5;reasons.push('إحداثيات غير مكتملة')}
  if(project.permitCount>=10){score+=7;reasons.push('ضغط تمديدات مرتفع جدًا')}
  else if(project.permitCount>=5){score+=5;reasons.push('ضغط تمديدات مرتفع')}
  else if(project.permitCount>=2){score+=3;reasons.push('تصاريح/تمديدات متعددة')}
  score=Math.min(100,score);
  const riskLevel=score>=60?'حرج':score>=40?'مرتفع':score>=20?'متوسط':'طبيعي';
  const extensionPressure=project.permitCount>=10?'مرتفع جدًا':project.permitCount>=5?'مرتفع':project.permitCount>=2?'متوسط':project.permitCount===1?'منخفض':'لا يوجد';
  return {score,riskLevel,reasons,extensionPressure,matchedCoveragePct:pair?.coveragePct??null,matchedBalance:pair?.balance??null};
}
function buildMunicipalitySummary(projects,lines){
  const map=new Map();
  const get=k=>{const key=clean(k)||'غير محدد';if(!map.has(key))map.set(key,{municipality:key,projects:0,permitMeters:0,lines:0,lineMeters:0,criticalProjects:0,pendingDesign:0});return map.get(key)};
  for(const p of projects){const x=get(p.municipality);x.projects++;x.permitMeters+=p.permitMeters;if(['حرج','مرتفع'].includes(p.riskLevel))x.criticalProjects++}
  for(const l of lines){const x=get(l.municipality);x.lines++;x.lineMeters+=l.length;if(!l.designStatus||/جاري|قيد/i.test(l.designStatus))x.pendingDesign++}
  return [...map.values()].map(x=>({...x,grossCoveragePct:x.permitMeters?Math.round((x.lineMeters/x.permitMeters)*1000)/10:null})).sort((a,b)=>b.permitMeters-a.permitMeters);
}
function buildTraceability(projects,lines){
  const byPair=new Map();
  for(const l of lines){const k=pairKey(l.owner,l.contractor);if(!byPair.has(k))byPair.set(k,[]);byPair.get(k).push(l)}
  return projects.map(p=>{
    const linked=byPair.get(pairKey(p.owner,p.contractor))||[];
    return {
      no:p.no,name:p.name,contractStatus:p.contractStatus,owner:p.owner,contractor:p.contractor,municipality:p.municipality,
      permitRefs:p.permitRefs,permitCount:p.permitCount,permitStatus:p.permitStatus,permitMeters:p.permitMeters,guaranteeStatus:p.guaranteeStatus,
      lineCount:linked.length,lineRefs:linked.map(x=>x.ref).filter(Boolean).join('، '),
      lineMeters:Math.round(linked.reduce((a,x)=>a+x.length,0)*100)/100,
      designStatuses:[...new Set(linked.map(x=>x.designStatus||'غير محدد'))].join('، '),
      executionStatuses:[...new Set(linked.map(x=>x.executionStatus||'غير محدد'))].join('، '),
      riskScore:p.riskScore,riskLevel:p.riskLevel,
      matchMethod:linked.length?'المالك + المقاول':'لا يوجد ربط مطابق'
    };
  });
}

function qualityChecks(projects,permits,lines,refLines,complaints){
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
    if(!p.contractStatus)issues.push({severity:'medium',category:'حالة العقد',source:'vd projects',row:p.row,message:'حالة العقد غير محددة'});
    if(!p.owner)issues.push({severity:'medium',category:'بيانات المشروع',source:'vd projects',row:p.row,message:'المشروع بدون مالك'});
    if(!p.contractor)issues.push({severity:'medium',category:'بيانات المشروع',source:'vd projects',row:p.row,message:'المشروع بدون مقاول تصريح'});
    if(!p.municipality)issues.push({severity:'low',category:'البلدية',source:'vd projects',row:p.row,message:'البلدية غير محددة'});
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
    if(!l.designer) issues.push({severity:'low',category:'التصميم',source:'Alternative lines',row:l.row,message:'المصمم غير مسجل'});
    if(!l.designStatus) issues.push({severity:'low',category:'التصميم',source:'Alternative lines',row:l.row,message:'حالة التصميم غير مسجلة'});
    if(l.chronologyIssue) issues.push({severity:'high',category:'تسلسل زمني',source:'Alternative lines',row:l.row,message:'تاريخ رفع التصميم يسبق تاريخ التكليف'});
    if(l.designStatus&&/جاري|قيد/i.test(l.designStatus)&&l.approvalDate)issues.push({severity:'high',category:'تعارض حالة التصميم',source:'Alternative lines',row:l.row,message:'الحالة تشير إلى اعتماد جارٍ رغم وجود تاريخ اعتماد: '+l.approvalDate});
    if(l.designStatus&&/جاري|قيد/i.test(l.designStatus)&&!l.approvalDate&&l.designAgeDays>60)issues.push({severity:'high',category:'اعتماد التصميم',source:'Alternative lines',row:l.row,message:'تصميم تحت المتابعة منذ '+l.designAgeDays+' يوم'});
  }
  for(const c of complaints||[]){
    if(!c.status)issues.push({severity:'medium',category:'الشكاوى',source:'info. new',row:c.row,message:'شكوى بدون حالة متابعة'});
    if(!c.link)issues.push({severity:'low',category:'الشكاوى',source:'info. new',row:c.row,message:'شكوى بدون ربط بخط بديل/حل'});
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
  if(!force && buildDataInFlight) return buildDataInFlight;
  const runner=(async()=>{
  if(!SPREADSHEET_ID) throw new Error('SPREADSHEET_ID is missing');
  const sheets=await sheetsApi();
  const ranges=[
    q('vd projects')+'!A1:AX1009',
    q('Alternative lines')+'!A1:AK982',
    q('info. new')+'!A1:AB1000',
    q('owners')+'!A1:H300',
    q('reports')+'!A1:DI100'
  ];
  const result=await sheets.spreadsheets.values.batchGet({
    spreadsheetId:SPREADSHEET_ID,ranges,valueRenderOption:'FORMATTED_VALUE'
  });
  const [projectValues=[],lineValues=[],infoValues=[],ownerValues=[],reportValues=[]]=(result.data.valueRanges||[]).map(x=>x.values||[]);
  let sourceSheetLinks={};
  try{sourceSheetLinks=await sourceSheetLinks_(sheets)}catch(error){console.warn('Source sheet-link metadata warning:',error.message)}

  let projects=projectValues.slice(1).map((r,i)=>projectRow(r,i+2)).filter(x=>x.no||x.name);
  let lines=lineValues.slice(1).map((r,i)=>lineRow(r,i+2)).filter(x=>x.ref||x.name);
  let permits=infoValues.slice(1).map((r,i)=>permitRow(r,i+2)).filter(x=>x.id);
  const refLines=infoValues.slice(1).map((r,i)=>refLineRow(r,i+2)).filter(x=>x.ref||x.name);
  const complaints=infoValues.slice(1).map((r,i)=>complaintRow(r,i+2)).filter(x=>x.text);
  const owners=ownerValues.slice(1).map((r,i)=>({row:i+2,owner:clean(r[6]),meters:num(r[7])})).filter(x=>x.owner);

  const today=DateTime.now().setZone('Asia/Riyadh').startOf('day');
  lines=enrichLines(lines,today);
  permits=enrichPermitsWithProjects(permits,projects);
  const actualPermits=permits.filter(x=>x.start&&x.end);
  const underIssue=permits.filter(x=>norm(x.id)===norm('تحت الاصدار'));
  const cancelledPermits=permits.filter(x=>norm(x.id)===norm('مشروع ملغي'));
  const permitTiming={expired:0,expiring:0,valid:0,unknown:0};
  actualPermits.forEach(x=>{
    const d=parseDate(x.end);
    if(!d){permitTiming.unknown++;return}
    const days=Math.floor(d.diff(today,'days').days);
    if(days<0) permitTiming.expired++;
    else if(days<=7) permitTiming.expiring++;
    else permitTiming.valid++;
  });

  let settlements=enrichSettlements(buildSettlements(projects,lines));
  const settlementMap=new Map(settlements.map(x=>[pairKey(x.owner,x.contractor),x]));
  projects=projects.map(p=>({...p,...projectRisk(p,settlementMap.get(pairKey(p.owner,p.contractor)))}));
  const municipalitySummary=buildMunicipalitySummary(projects,lines);
  const traceability=buildTraceability(projects,lines);
  const quality=qualityChecks(projects,permits,lines,refLines,complaints);
  const matchedDue=sum(settlements,'dueMeters'),matchedDone=sum(settlements,'executedMeters');
  const grossPermitMeters=sum(actualPermits,'meters'),grossLineMeters=sum(lines,'length');
  const riskCounts=countBy(projects,'riskLevel');
  const extensionPressure=countBy(projects,'extensionPressure');
  const designApprovalDays=lines.filter(x=>Number.isFinite(x.approvalDays)&&x.approvalDays>=0);
  const pendingDesignAging=lines.filter(x=>x.designAgeDays>0).sort((a,b)=>b.designAgeDays-a.designAgeDays);
  const sheetReports=buildSheetReports(reportValues);
  sheetReports.audit.actualAlternativeLineRows=lines.length;
  sheetReports.audit.countMismatch=clean(sheetReports.audit.districtPivotGrandCount)!==clean(lines.length);
  const data={
    updatedAt:DateTime.now().setZone('Asia/Riyadh').toISO(),
    projectTitle:'إدارة الحلول العاجلة',
    summaries:{
      projects:projects.length,
      actualPermits:actualPermits.length,
      underIssue:underIssue.length,
      cancelledPermits:cancelledPermits.length,
      permitMeters:grossPermitMeters,
      lines:lines.length,
      lineMeters:grossLineMeters,
      grossCoveragePct:grossPermitMeters?Math.round(grossLineMeters/grossPermitMeters*1000)/10:0,
      matchedCoveragePct:matchedDue?Math.round(matchedDone/matchedDue*1000)/10:0,
      matchedGap:Math.round((matchedDue-matchedDone)*100)/100,
      highRiskProjects:(riskCounts['حرج']||0)+(riskCounts['مرتفع']||0),
      mappedProjects:projects.filter(p=>Number(p.lat)>20&&Number(p.lat)<23&&Number(p.lon)>38&&Number(p.lon)<41).length,
      complaints:complaints.length,
      qualityIssues:quality.length,
      designApproved:lines.filter(x=>/معتمد|حزمة مصممة/i.test(x.designStatus)).length,
      designPending:lines.filter(x=>/جاري|قيد/i.test(x.designStatus)&&!x.approvalDate).length,
      designStatusConflict:lines.filter(x=>/جاري|قيد/i.test(x.designStatus)&&!!x.approvalDate).length,
      designMissing:lines.filter(x=>!x.designStatus).length,
      executionReady:lines.filter(x=>!!x.executionStatus).length
    },
    permitTiming,
    management:{
      riskCounts,extensionPressure,
      matchedDue,matchedDone,
      designApprovalAvgDays:designApprovalDays.length?Math.round(designApprovalDays.reduce((a,x)=>a+x.approvalDays,0)/designApprovalDays.length*10)/10:null,
      designApprovalMedianDays:designApprovalDays.length?[...designApprovalDays].sort((a,b)=>a.approvalDays-b.approvalDays)[Math.floor(designApprovalDays.length/2)].approvalDays:null,
      pendingDesignAging:pendingDesignAging.slice(0,20),
      handoverReadiness:{
        projectHandoverLetters:projects.filter(x=>x.handoverNo).length,
        projectClearances:projects.filter(x=>x.clearance).length,
        linesWithExecution:lines.filter(x=>x.executionStatus).length,
        linesWithHandover:lines.filter(x=>x.handoverDate||x.handoverLetter||x.completion||x.completionReport).length
      }
    },
    distributions:{
      projectStatus:countBy(projects,'contractStatus'),
      projectType:countBy(projects,'projectType'),
      municipalities:countBy(projects,'municipality'),
      permitStatus:countBy(projects,'permitStatus'),
      guaranteeStatus:countBy(projects,'guaranteeStatus'),
      riskLevel:riskCounts,
      extensionPressure,
      lineType:countBy(lines,'type'),
      designStatus:countBy(lines,'designStatus'),
      executionStatus:countBy(lines,'executionStatus'),
      permitYears:countBy(actualPermits,'year'),
      settlementStatus:countBy(settlements,'status')
    },
    projects,permits,actualPermits,lines,refLines,complaints,owners,settlements,municipalitySummary,traceability,quality,sheetReports,
    sourceHeaders:{
      projects:projectValues[0]||[],lines:lineValues[0]||[],info:infoValues[0]||[],owners:ownerValues[0]||[]
    },
    sourceSheetLinks
  };
  cache={at:Date.now(),data};
  return data;
  })();
  buildDataInFlight=runner;
  try{
    return await runner;
  }catch(error){
    if(cache.data && Date.now()-cache.at<STALE_CACHE_MS){
      return {...cache.data,sourceMode:'stale-cache',liveError:error.message};
    }
    throw error;
  }finally{
    if(buildDataInFlight===runner)buildDataInFlight=null;
  }
}

let dataBuildInFlight=null;
const DATA_STALE_MAX_MS=5*60*1000;
async function buildDataCoalesced(force=false){
  if(force)return buildData(true);
  if(cache.data&&Date.now()-cache.at<CACHE_MS)return cache.data;
  if(dataBuildInFlight)return dataBuildInFlight;
  dataBuildInFlight=buildData(false).finally(()=>{dataBuildInFlight=null});
  return dataBuildInFlight;
}

const PROJECT_NEWS_RETENTION_MS=72*60*60*1000;
const projectNewsState={snapshot:new Map(),events:new Map(),rowSnapshots:new Map()};
let projectNewsSheetHydrated=false,projectNewsSheetHydratePromise=null;

function projectNewsRowToObj_(r,rowNumber){
  return {
    rowNumber,
    timestamp:String(r[0]||''),eventKey:String(r[1]||''),priority:String(r[2]||''),
    category:String(r[3]||''),title:String(r[4]||''),summary:String(r[5]||''),
    source:String(r[6]||''),sourceSheet:String(r[7]||''),sheetUrl:String(r[8]||''),
    active:String(r[9]||''),stateJson:String(r[10]||''),lastSeen:String(r[11]||''),version:String(r[12]||'')
  };
}
async function hydrateProjectNewsSheet_(){
  if(projectNewsSheetHydrated)return;
  if(projectNewsSheetHydratePromise)return projectNewsSheetHydratePromise;
  projectNewsSheetHydratePromise=(async()=>{
    const sheets=await ensureSystemSheet_(PROJECT_NEWS_SHEET,PROJECT_NEWS_HEADERS,10000);
    const raw=(await sheets.spreadsheets.values.get({
      spreadsheetId:SPREADSHEET_ID,range:q(PROJECT_NEWS_SHEET)+'!A2:M10000',valueRenderOption:'UNFORMATTED_VALUE'
    })).data.values||[];
    const rows=raw.map((r,i)=>projectNewsRowToObj_(r,i+2)).filter(x=>x.eventKey);
    const stateRow=[...rows].reverse().find(x=>x.eventKey==='__STATE__');
    if(stateRow?.stateJson){
      const state=safeJsonParse_(stateRow.stateJson,{});
      if(Array.isArray(state.snapshot))projectNewsState.snapshot=new Map(state.snapshot);
    }
    const cutoff=Date.now()-PROJECT_NEWS_RETENTION_MS;
    for(const x of rows){
      if(x.eventKey==='__STATE__')continue;
      const ts=Date.parse(x.timestamp)||0;
      if(ts<cutoff&&clean(x.active)!=='نعم')continue;
      projectNewsState.events.set(x.eventKey,{
        show:'نعم',date:x.timestamp,priority:x.priority||'تحديث',category:x.category||'عام',
        title:x.title||'',summary:x.summary||'',source:x.source||'تحليل الشيتات',
        sourceSheet:x.sourceSheet||'',sheetUrl:x.sheetUrl||'',eventKey:x.eventKey
      });
    }
    projectNewsSheetHydrated=true;
  })().catch(e=>{console.warn('Project news sheet hydrate failed:',e.message||e)}).finally(()=>{projectNewsSheetHydratePromise=null});
  return projectNewsSheetHydratePromise;
}
async function persistProjectNewsSheet_(rows,activeIssueKeys,sheetLinks){
  try{
    const sheets=await ensureSystemSheet_(PROJECT_NEWS_SHEET,PROJECT_NEWS_HEADERS,10000);
    const raw=(await sheets.spreadsheets.values.get({
      spreadsheetId:SPREADSHEET_ID,range:q(PROJECT_NEWS_SHEET)+'!A2:M10000',valueRenderOption:'UNFORMATTED_VALUE'
    })).data.values||[];
    const existing=raw.map((r,i)=>projectNewsRowToObj_(r,i+2)).filter(x=>x.eventKey);
    const byKey=new Map(existing.map(x=>[x.eventKey,x]));
    const now=DateTime.now().setZone('Asia/Riyadh').toFormat('yyyy-LL-dd HH:mm:ss');
    const updates=[],appends=[];
    const makeRow=r=>[
      String(r.date||now),String(r.eventKey||''),String(r.priority||'تحديث'),String(r.category||'عام'),
      String(r.title||''),String(r.summary||''),String(r.source||'تحليل الشيتات'),String(r.sourceSheet||''),
      String(sheetLinks?.[r.sourceSheet]||r.sheetUrl||''),activeIssueKeys.has(r.eventKey)?'نعم':'لا','',now,'v1'
    ];
    for(const r of rows){
      const row=makeRow(r),old=byKey.get(r.eventKey);
      if(old)updates.push({range:q(PROJECT_NEWS_SHEET)+'!A'+old.rowNumber+':M'+old.rowNumber,values:[row]});
      else appends.push(row);
    }
    const statePayload={snapshot:[...projectNewsState.snapshot.entries()]};
    const stateRow=[now,'__STATE__','','','','','','','','نعم',JSON.stringify(statePayload),now,'v1'];
    const oldState=byKey.get('__STATE__');
    if(oldState)updates.push({range:q(PROJECT_NEWS_SHEET)+'!A'+oldState.rowNumber+':M'+oldState.rowNumber,values:[stateRow]});
    else appends.push(stateRow);
    if(updates.length){
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId:SPREADSHEET_ID,
        requestBody:{valueInputOption:'RAW',data:updates}
      });
    }
    if(appends.length){
      await sheets.spreadsheets.values.append({
        spreadsheetId:SPREADSHEET_ID,range:q(PROJECT_NEWS_SHEET)+'!A:M',
        valueInputOption:'RAW',insertDataOption:'INSERT_ROWS',requestBody:{values:appends}
      });
    }
  }catch(e){console.warn('Project news sheet persist failed:',e.message||e)}
}

function newsPriority_(count,total){
  const rate=total?Number(count||0)/Number(total||1):0;
  if(Number(count||0)>=20||rate>=0.20)return 'عاجل';
  if(Number(count||0)>=5||rate>=0.08)return 'مهم';
  return 'تحديث';
}
function newsEvent_(key,priority,category,title,summary,sourceSheet){
  const date=DateTime.now().setZone('Asia/Riyadh').toISO();
  projectNewsState.events.set(String(key),{
    show:'نعم',date,priority,category,title,summary:summary||'',
    source:'تحليل الشيتات',sourceSheet:clean(sourceSheet),eventKey:String(key)
  });
}
function newsObserve_(o){
  const value=Number(o.value||0),prev=projectNewsState.snapshot.get(o.key),unit=o.unit||'';
  projectNewsState.snapshot.set(o.key,value);
  if(o.silent)return;
  if(prev===undefined){
    if(o.kind==='issue'&&value>0)newsEvent_(o.key,newsPriority_(value,o.total),o.category,o.label+': '+formatNewsNumber_(value,unit),o.note||'',o.sourceSheet);
    else if(o.kind==='progress'&&o.initialNews&&value>0)newsEvent_(o.key,'تحديث',o.category,o.label+': '+formatNewsNumber_(value,unit),o.note||'',o.sourceSheet);
    return;
  }
  if(prev===value)return;
  const delta=Math.round((value-Number(prev||0))*10)/10,word=delta>0?'ارتفع':'انخفض';
  if(o.kind==='issue'){
    if(value===0&&prev>0)newsEvent_(o.key,'تحسن',o.category,'تم إغلاق '+o.label,'القيمة السابقة '+formatNewsNumber_(prev,unit)+' وأصبحت صفرًا.',o.sourceSheet);
    else if(value>0&&delta<0)newsEvent_(o.key,'تحسن',o.category,o.label+' '+word+' بمقدار '+formatNewsNumber_(Math.abs(delta),unit),'الحالي '+formatNewsNumber_(value,unit)+' مقابل '+formatNewsNumber_(prev,unit)+'.',o.sourceSheet);
    else if(value>0)newsEvent_(o.key,newsPriority_(value,o.total),o.category,o.label+' '+word+' بمقدار '+formatNewsNumber_(Math.abs(delta),unit),'الحالي '+formatNewsNumber_(value,unit)+' مقابل '+formatNewsNumber_(prev,unit)+'.',o.sourceSheet);
  }else{
    const good=(o.goodUp&&delta>0)||(o.goodDown&&delta<0);
    newsEvent_(o.key,good?'تحسن':'تحديث',o.category,o.label+' '+word+' بمقدار '+formatNewsNumber_(Math.abs(delta),unit),'الحالي '+formatNewsNumber_(value,unit)+' مقابل '+formatNewsNumber_(prev,unit)+'.',o.sourceSheet);
  }
}
function formatNewsNumber_(v,unit=''){
  const n=Number(v||0),x=Math.abs(n-Math.round(n))<0.0001?String(Math.round(n)):String(Math.round(n*10)/10);
  return x+(unit||'');
}
function newsRowValue_(v){return clean(v).replace(/\s+/g,' ').slice(0,180)}
function newsTrackRows_(pageKey,rows,idField,fields,category,sourceSheet){
  const current=new Map();
  for(const r of rows||[]){
    const id=newsRowValue_(r[idField]||r.row);
    if(!id)continue;
    const snap={};for(const [field] of fields)snap[field]=newsRowValue_(r[field]);
    current.set(id,snap);
  }
  const previous=projectNewsState.rowSnapshots.get(pageKey);
  projectNewsState.rowSnapshots.set(pageKey,current);
  if(!previous)return;
  let emitted=0;
  for(const [id,cur] of current){
    if(emitted>=35)break;
    const old=previous.get(id);
    if(!old)continue;
    for(const [field,label] of fields){
      const before=newsRowValue_(old[field]),after=newsRowValue_(cur[field]);
      if(before===after)continue;
      const sig=crypto.createHash('sha1').update(before+'→'+after).digest('hex').slice(0,8);
      const completed=/(منجز|مكتمل|معتمد|تم|ساري)/i.test(after);
      const priority=completed?'إنجاز':'تحديث';
      newsEvent_('row:change:'+pageKey+':'+id+':'+field+':'+sig,priority,category,
        label+' للمشروع/السجل «'+id+'» تغيرت من «'+(before||'فارغ')+'» إلى «'+(after||'فارغ')+'».',
        'تغيير مباشر تم رصده من بيانات Google Sheet.',sourceSheet);
      emitted++;if(emitted>=35)break;
    }
  }
}
function buildProjectNewsObservations_(d){
  const s=d.summaries||{},p=d.permitTiming||{},projects=d.projects||[],lines=d.lines||[],quality=d.quality||[],complaints=d.complaints||[];
  const totalProjects=Math.max(1,Number(s.projects||projects.length)),totalPermits=Math.max(1,Number(s.actualPermits||0)),totalLines=Math.max(1,Number(s.lines||lines.length));
  const riskyGuarantees=projects.filter(x=>/منتهي|اوشك|أوشك|حرج|بانتظار/.test(clean(x.guaranteeStatus))).length;
  const complaintsNoStatus=complaints.filter(x=>!clean(x.status)).length;
  const missingCoords=Math.max(0,Number(s.projects||0)-Number(s.mappedProjects||0));
  return [
    {key:'risk:high',kind:'issue',category:'مخاطر المشاريع',label:'المشاريع مرتفعة/حرجة المخاطر',value:s.highRiskProjects,total:totalProjects,sourceSheet:'vd projects',note:'المؤشر مشتق من التصاريح والضمانات والتسويات والعقد والإحداثيات وضغط التمديدات.'},
    {key:'dq:all',kind:'issue',category:'جودة البيانات',label:'ملاحظات جودة البيانات',value:s.qualityIssues,total:Math.max(1,totalProjects+totalLines),sourceSheet:'vd projects',note:'يشمل التعارضات والحقول المفقودة والقيم غير الطبيعية.'},
    {key:'permit:expired',kind:'issue',category:'التصاريح',label:'التصاريح المنتهية',value:p.expired,total:totalPermits,sourceSheet:'info. new'},
    {key:'permit:expiring',kind:'issue',category:'التصاريح',label:'التصاريح التي تنتهي خلال 7 أيام',value:p.expiring,total:totalPermits,sourceSheet:'info. new'},
    {key:'design:pending',kind:'issue',category:'الخطوط البديلة والتصميم',label:'التصاميم قيد المتابعة',value:s.designPending,total:totalLines,sourceSheet:'Alternative lines'},
    {key:'design:conflict',kind:'issue',category:'الخطوط البديلة والتصميم',label:'تعارضات حالة التصميم',value:s.designStatusConflict,total:totalLines,sourceSheet:'Alternative lines'},
    {key:'guarantee:risk',kind:'issue',category:'الضمانات',label:'مشروعات بضمان يحتاج متابعة',value:riskyGuarantees,total:totalProjects,sourceSheet:'vd projects'},
    {key:'complaints:nostatus',kind:'issue',category:'الشكاوى',label:'شكاوى بدون حالة متابعة',value:complaintsNoStatus,total:Math.max(1,complaints.length),sourceSheet:'info. new'},
    {key:'geo:missing',kind:'issue',category:'جودة البيانات',label:'مشروعات بدون إحداثيات صالحة',value:missingCoords,total:totalProjects,sourceSheet:'vd projects'},
    {key:'progress:coverage',kind:'progress',category:'الأمتار والتسويات',label:'نسبة تغطية الأمتار',value:s.matchedCoveragePct,unit:'%',goodUp:true,initialNews:true,sourceSheet:'vd projects'},
    {key:'progress:execution',kind:'progress',category:'التنفيذ والتسليم',label:'الخطوط ذات حالة تنفيذ مسجلة',value:s.executionReady,total:totalLines,goodUp:true,sourceSheet:'Alternative lines'},
    {key:'progress:handover',kind:'progress',category:'التنفيذ والتسليم',label:'الخطوط ذات مستند/تاريخ تسليم',value:d.management?.handoverReadiness?.linesWithHandover,total:totalLines,goodUp:true,sourceSheet:'Alternative lines'}
  ];
}
async function getProjectNews(){
  await hydrateProjectNewsSheet_();
  const d=await buildDataCoalesced(false);
  newsTrackRows_('projects',d.projects||[],'no',[
    ['riskLevel','مستوى المخاطر'],['permitStatus','حالة التصريح'],['guaranteeStatus','حالة الضمان'],['contractStatus','حالة العقد']
  ],'أخبار المشاريع','vd projects');
  newsTrackRows_('lines',d.lines||[],'ref',[
    ['designStatus','حالة التصميم'],['executionStatus','حالة التنفيذ'],['handoverDate','تاريخ التسليم']
  ],'أخبار الخطوط البديلة','Alternative lines');
  const observations=buildProjectNewsObservations_(d);observations.forEach(newsObserve_);
  const activeIssueKeys=new Set(observations.filter(o=>o.kind==='issue'&&Number(o.value||0)>0).map(o=>o.key));
  const cutoff=Date.now()-PROJECT_NEWS_RETENTION_MS;
  for(const [key,event] of projectNewsState.events){
    const ts=Date.parse(event.date)||0;if(ts<cutoff&&!activeIssueKeys.has(key))projectNewsState.events.delete(key);
  }
  const order={عاجل:0,مهم:1,إنجاز:2,تحسن:2,تحديث:3};
  const rows=[...projectNewsState.events.values()]
    .filter(r=>activeIssueKeys.has(r.eventKey)||(Date.parse(r.date)||0)>=cutoff)
    .sort((a,b)=>(Date.parse(b.date)||0)-(Date.parse(a.date)||0)||(order[a.priority]??9)-(order[b.priority]??9))
    .slice(0,180)
    .map(r=>({...r,sheetUrl:d.sourceSheetLinks?.[r.sourceSheet]||r.sheetUrl||''}));
  await persistProjectNewsSheet_(rows,activeIssueKeys,d.sourceSheetLinks||{});
  return {ok:true,updatedAt:d.updatedAt,source:'google-sheet-news',sheet:PROJECT_NEWS_SHEET,retentionHours:72,rows};
}

app.get('/api/data',requireAuth,async(req,res)=>{
  try{
    const data=await buildDataCoalesced(req.query.refresh==='1');
    res.set('Cache-Control','no-store').json({ok:true,...data});
  }catch(error){
    if(cache.data&&Date.now()-cache.at<DATA_STALE_MAX_MS){
      console.warn('Live data unavailable, serving stale cache:',error.message);
      return res.set('Cache-Control','no-store').json({ok:true,...cache.data,sourceMode:'stale-cache',liveError:error.message});
    }
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


app.get('/api/monitor/summary',requireAuth,async(req,res)=>{
  try{const d=await buildDataCoalesced(false);res.set('Cache-Control','no-store').json({ok:true,updatedAt:d.updatedAt,sourceMode:d.sourceMode||'live',summaries:d.summaries,permitTiming:d.permitTiming,distributions:d.distributions})}
  catch(error){res.status(500).json({ok:false,error:'MONITOR_FAILED',message:error.message})}
});
app.get('/api/monitor/full',requireAuth,async(req,res)=>{
  try{const d=await buildDataCoalesced(false);res.set('Cache-Control','no-store').json({ok:true,...d})}
  catch(error){res.status(500).json({ok:false,error:'MONITOR_FAILED',message:error.message})}
});
app.post('/api/rpc',requireAuth,async(req,res)=>{
  try{
    const method=clean(req.body?.method||req.body?.name),args=req.body?.args||req.body?.params||{};
    const arg0=Array.isArray(args)?(args[0]||{}):(args?.payload||args||{});
    if(method==='clearDashboardCache'){cache={at:0,data:null};dataBuildInFlight=null;return res.json({ok:true})}
    if(method==='saveSmartHistory')return res.json(await saveSmartHistory(arg0));
    if(method==='syncThursdayProgressHistory')return res.json(await syncThursdayProgressHistory(arg0));
    if(method==='getProjectNews')return res.json(await getProjectNews());
    const d=await buildDataCoalesced(false);
    if(method==='getMonitorData')return res.json({ok:true,updatedAt:d.updatedAt,summaries:d.summaries,permitTiming:d.permitTiming,distributions:d.distributions});
    if(method==='getFullMonitorData'||method==='getBootData')return res.json({ok:true,...d});
    if(method==='getProject360'){const qv=norm(args.project||args.no||args.query||'');const rows=(d.projects||[]).filter(x=>!qv||[x.no,x.name,x.owner,x.contractor,x.municipality].some(v=>norm(v).includes(qv))).slice(0,50);return res.json({ok:true,rows})}
    return res.status(400).json({ok:false,error:'UNKNOWN_RPC_METHOD'});
  }catch(error){res.status(500).json({ok:false,error:'RPC_FAILED',message:error.message})}
});
app.post('/api/ai/brief',requireAuth,async(req,res)=>{
  try{
    const key=String(process.env.OPENAI_API_KEY||'').trim();if(!key)return res.status(503).json({ok:false,error:'OPENAI_API_KEY_NOT_CONFIGURED'});
    const d=await buildDataCoalesced(false),page=clean(req.body?.page||'master');
    const facts={page,updatedAt:d.updatedAt,summaries:d.summaries,permitTiming:d.permitTiming,distributions:d.distributions,topRisks:(d.projects||[]).filter(x=>/مرتفع|حرج|high|critical/i.test(String(x.riskLevel||''))).slice(0,12).map(x=>({no:x.no,name:x.name,municipality:x.municipality,contractor:x.contractor,riskLevel:x.riskLevel,permitStatus:x.permitStatus,guaranteeStatus:x.guaranteeStatus}))};
    const prompt='أنت محلل تنفيذي لمشاريع الحلول العاجلة بأمانة جدة. حلل البيانات التالية فقط دون اختلاق معلومات. اكتب بالعربية: ملخص تنفيذي قصير، أهم 5 مخاطر/ملاحظات، أولويات التدخل، وما يحتاج قرار إداري. البيانات: '+JSON.stringify(facts);
    const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{'Authorization':'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.OPENAI_MODEL||'gpt-5-mini',input:prompt})});
    const j=await response.json();if(!response.ok)throw new Error(j?.error?.message||'OPENAI_REQUEST_FAILED');
    let text=String(j.output_text||'');if(!text&&Array.isArray(j.output)){for(const item of j.output){for(const c of item.content||[]){if(c.type==='output_text'&&c.text)text+=c.text+'\n'}}}
    return res.json({ok:true,text:text.trim(),model:process.env.OPENAI_MODEL||'gpt-5-mini'});
  }catch(error){console.error('AI brief error:',error);return res.status(500).json({ok:false,error:'AI_BRIEF_FAILED',message:error.message})}
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

app.get('/api/build-info',(req,res)=>{
  try{
    const appPath=path.join(__dirname,'public','app.js');
    const i18nPath=path.join(__dirname,'public','i18n.js');
    const indexPath=path.join(__dirname,'public','index.html');
    const appText=fs.existsSync(appPath)?fs.readFileSync(appPath,'utf8'):'';
    const indexText=fs.existsSync(indexPath)?fs.readFileSync(indexPath,'utf8'):'';
    res.set('Cache-Control','no-store').json({
      ok:true,
      appBytes:Buffer.byteLength(appText),
      appInteractive:appText.includes("onClick:(event,elements)"),
      i18nExists:fs.existsSync(i18nPath),
      indexV8:indexText.includes('/app.js?v=8'),
      release:process.env.APP_RELEASE||'local'
    });
  }catch(error){res.status(500).json({ok:false,message:error.message})}
});

app.use(express.static(path.join(__dirname,'public'),{
  index:false,
  maxAge:0,
  setHeaders(res){res.setHeader('Cache-Control','no-store, max-age=0')}
}));

app.listen(PORT,()=>console.log('Urgent Solutions Dashboard: http://localhost:'+PORT));
