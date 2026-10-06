const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const {google}=require('googleapis');
const {DateTime}=require('luxon');
const {all,get,run,id,nowIso}=require('./db');

const TZ='Asia/Riyadh';
const SPREADSHEET_ID=String(process.env.GOOGLE_SHEET_ID||'').trim();
const SHEET_NAME=String(process.env.GOOGLE_SHEET_NAME||'الاعمال').trim();
const APP_PUBLIC_URL=String(process.env.APP_PUBLIC_URL||'https://madinah-water-business.onrender.com').replace(/\/$/,'');
const ENABLED=String(process.env.GOOGLE_SYNC_ENABLED||'true').toLowerCase()!=='false';

let sheetsClient=null;
let targetSheetId=null;
let rowCache=null;
let processing=false;
let timer=null;

function qSheet(name){return "'" + String(name).replace(/'/g,"''") + "'";}
function googleConfigured(){return ENABLED&&!!SPREADSHEET_ID&&!!credentialsFromEnv();}

function credentialsFromEncryptedFile(){
  const keyB64=String(process.env.GOOGLE_CREDENTIALS_KEY||'').trim();
  const encryptedPath=String(process.env.GOOGLE_ENCRYPTED_CREDENTIALS_PATH||path.join(__dirname,'..','config','google-service-account.enc.json')).trim();
  if(!keyB64||!fs.existsSync(encryptedPath))return null;
  const key=Buffer.from(keyB64,'base64');
  if(key.length!==32)throw new Error('GOOGLE_CREDENTIALS_KEY must decode to 32 bytes');
  const payload=JSON.parse(fs.readFileSync(encryptedPath,'utf8'));
  const decipher=crypto.createDecipheriv('aes-256-gcm',key,Buffer.from(payload.iv,'base64'));
  decipher.setAuthTag(Buffer.from(payload.tag,'base64'));
  const plain=Buffer.concat([
    decipher.update(Buffer.from(payload.data,'base64')),
    decipher.final()
  ]).toString('utf8');
  return JSON.parse(plain);
}

function credentialsFromEnv(){
  const encrypted=credentialsFromEncryptedFile();
  if(encrypted)return encrypted;
  if(process.env.GOOGLE_SERVICE_ACCOUNT_B64){
    try{
      return JSON.parse(Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_B64,'base64').toString('utf8'));
    }catch(e){
      throw new Error('GOOGLE_SERVICE_ACCOUNT_B64 is not valid service-account JSON');
    }
  }
  if(process.env.GOOGLE_SERVICE_ACCOUNT_JSON){
    try{return JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);}
    catch(e){throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON');}
  }
  const configured=String(process.env.GOOGLE_CREDENTIALS_PATH||'').trim();
  const candidates=[
    configured,
    path.join(__dirname,'..','credentials.json')
  ].filter(Boolean);
  for(const p of candidates){
    if(fs.existsSync(p))return JSON.parse(fs.readFileSync(p,'utf8'));
  }
  return null;
}

async function getSheets(){
  if(sheetsClient)return sheetsClient;
  const creds=credentialsFromEnv();
  if(!creds)throw new Error('Google Service Account credentials are not configured');
  const auth=new google.auth.GoogleAuth({
    credentials:creds,
    scopes:['https://www.googleapis.com/auth/spreadsheets']
  });
  sheetsClient=google.sheets({version:'v4',auth});
  return sheetsClient;
}

async function getTargetSheetId(){
  if(targetSheetId!=null)return targetSheetId;
  const sheets=await getSheets();
  const meta=await sheets.spreadsheets.get({
    spreadsheetId:SPREADSHEET_ID,
    fields:'sheets.properties(sheetId,title)'
  });
  const sh=(meta.data.sheets||[]).find(x=>x.properties?.title===SHEET_NAME);
  if(!sh)throw new Error('Google Sheet tab not found: '+SHEET_NAME);
  targetSheetId=sh.properties.sheetId;
  return targetSheetId;
}

function sheetText(v){
  const s=String(v==null?'':v);
  return /^[=+\-@]/.test(s)?"'"+s:s;
}
function dt(v){
  if(!v)return null;
  const d=DateTime.fromISO(String(v),{setZone:true}).setZone(TZ);
  return d.isValid?d:null;
}
function dateText(v){const d=dt(v);return d?d.toFormat('dd/LL/yyyy'):'';}
function timeText(v){const d=dt(v);return d?d.toFormat('HH:mm'):'';}

async function getWorkForSync(workId){
  return get(`
    SELECT w.*,
      r.name AS region_name,
      i.name AS inspector_name,
      c.name AS contractor_name,
      b.name AS break_type_name,
      s.name AS repair_status_name,
      u.employee_name AS creator_name
    FROM works w
    LEFT JOIN regions r ON r.region_id=w.region_id
    LEFT JOIN inspectors i ON i.inspector_id=w.inspector_id
    LEFT JOIN contractors c ON c.contractor_id=w.contractor_id
    LEFT JOIN break_types b ON b.break_type_id=w.break_type_id
    LEFT JOIN repair_statuses s ON s.repair_status_id=w.repair_status_id
    LEFT JOIN users u ON u.user_id=w.created_by
    WHERE w.work_id=?
  `,[workId]);
}

async function workValues(work,operation){
  const media=await get('SELECT COUNT(*) AS n FROM work_media WHERE work_id=?',[work.work_id]);
  const mediaCount=Number(media?.n||0);
  const coords=(work.latitude!=null&&work.longitude!=null)?String(work.latitude)+', '+String(work.longitude):sheetText(work.location_text||'');
  const deepLink=APP_PUBLIC_URL+'/?work='+encodeURIComponent(work.work_id);
  const deleted=operation==='DELETE'||!!work.deleted_at;
  return [
    sheetText(work.request_no||''),
    dateText(work.registered_at),
    sheetText(work.region_name||''),
    sheetText(work.neighborhood||''),
    sheetText(work.inspector_name||''),
    sheetText(work.contractor_name||''),
    sheetText(work.municipality_permit_no||''),
    Number(work.has_hse_permit)?'نعم':'لا',
    sheetText(work.wfm_no||''),
    coords,
    dateText(work.started_at),
    timeText(work.started_at),
    dateText(work.finished_at),
    timeText(work.finished_at),
    deleted?'محذوف من التطبيق':deepLink+' | المرفقات: '+mediaCount,
    work.depth_m==null?'':Number(work.depth_m),
    sheetText(work.break_type_name||''),
    sheetText(work.repair_status_name||''),
    sheetText(work.notes||''),
    work.work_id,
    work.case_code||'',
    work.updated_at||nowIso(),
    deleted?'DELETED':'SYNCED'
  ];
}

async function refreshRowCache(){
  const sheets=await getSheets();
  const r=await sheets.spreadsheets.values.get({
    spreadsheetId:SPREADSHEET_ID,
    range:qSheet(SHEET_NAME)+'!T2:T',
    valueRenderOption:'UNFORMATTED_VALUE'
  });
  const vals=r.data.values||[];
  rowCache=new Map();
  vals.forEach((row,i)=>{
    const key=String(row?.[0]||'').trim();
    if(key)rowCache.set(key,i+2);
  });
  return rowCache;
}

async function findRow(workId){
  if(!rowCache)await refreshRowCache();
  return rowCache.get(String(workId))||null;
}

function rowFromUpdatedRange(updatedRange){
  const m=String(updatedRange||'').match(/![A-Z]+(\d+):[A-Z]+(\d+)/i);
  return m?Number(m[1]):null;
}

async function copyLegacyRowStructure(rowNumber){
  const sheets=await getSheets();
  const sheetId=await getTargetSheetId();
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId:SPREADSHEET_ID,
    requestBody:{requests:[
      {copyPaste:{
        source:{sheetId,startRowIndex:1,endRowIndex:2,startColumnIndex:0,endColumnIndex:19},
        destination:{sheetId,startRowIndex:rowNumber-1,endRowIndex:rowNumber,startColumnIndex:0,endColumnIndex:19},
        pasteType:'PASTE_FORMAT',
        pasteOrientation:'NORMAL'
      }},
      {copyPaste:{
        source:{sheetId,startRowIndex:1,endRowIndex:2,startColumnIndex:0,endColumnIndex:19},
        destination:{sheetId,startRowIndex:rowNumber-1,endRowIndex:rowNumber,startColumnIndex:0,endColumnIndex:19},
        pasteType:'PASTE_DATA_VALIDATION',
        pasteOrientation:'NORMAL'
      }}
    ]}
  });
}

async function syncWorkToSheet(workId,operation='UPSERT'){
  if(!googleConfigured())throw new Error('Google Sheets sync is not configured');
  const work=await getWorkForSync(workId);
  if(!work)throw new Error('Work not found for sync: '+workId);
  const values=await workValues(work,operation);
  const sheets=await getSheets();
  let row=await findRow(workId);

  if(row){
    await sheets.spreadsheets.values.update({
      spreadsheetId:SPREADSHEET_ID,
      range:qSheet(SHEET_NAME)+'!A'+row+':W'+row,
      valueInputOption:'USER_ENTERED',
      requestBody:{values:[values]}
    });
  }else{
    const a=await sheets.spreadsheets.values.append({
      spreadsheetId:SPREADSHEET_ID,
      range:qSheet(SHEET_NAME)+'!A:W',
      valueInputOption:'USER_ENTERED',
      insertDataOption:'INSERT_ROWS',
      requestBody:{values:[values]}
    });
    row=rowFromUpdatedRange(a.data.updates?.updatedRange);
    if(!row){
      rowCache=null;
      await refreshRowCache();
      row=await findRow(workId);
    }
    if(row){
      await copyLegacyRowStructure(row);
      if(!rowCache)rowCache=new Map();
      rowCache.set(String(workId),row);
    }
  }
  return {workId,row,operation};
}

async function enqueueWorkSync(workId,operation='UPSERT'){
  if(!ENABLED)return;
  const now=nowIso();
  await run(`
    INSERT INTO sheet_sync_queue(sync_id,work_id,operation,status,attempts,next_attempt_at,last_error,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?)
    ON CONFLICT(work_id) DO UPDATE SET
      operation=excluded.operation,
      status='PENDING',
      attempts=0,
      next_attempt_at=NULL,
      last_error=NULL,
      updated_at=excluded.updated_at
  `,[id(),workId,operation,'PENDING',0,null,null,now,now]);
  setTimeout(()=>processSyncQueue().catch(e=>console.error('Google sync worker:',e.message)),50).unref?.();
}

async function markSuccess(item){
  await run("UPDATE sheet_sync_queue SET status='SYNCED',attempts=attempts+1,next_attempt_at=NULL,last_error=NULL,updated_at=? WHERE sync_id=?",[nowIso(),item.sync_id]);
}
async function markFailure(item,error){
  const attempts=Number(item.attempts||0)+1;
  const delaySeconds=Math.min(1800,Math.max(30,30*Math.pow(2,Math.min(attempts-1,6))));
  const next=DateTime.now().setZone(TZ).plus({seconds:delaySeconds}).toUTC().toISO();
  await run("UPDATE sheet_sync_queue SET status='ERROR',attempts=?,next_attempt_at=?,last_error=?,updated_at=? WHERE sync_id=?",
    [attempts,next,String(error?.message||error).slice(0,1500),nowIso(),item.sync_id]);
}

async function processSyncQueue(limit=10){
  if(processing||!googleConfigured())return;
  processing=true;
  try{
    const now=nowIso();
    const items=await all(`
      SELECT * FROM sheet_sync_queue
      WHERE status IN ('PENDING','ERROR')
        AND (next_attempt_at IS NULL OR next_attempt_at<=?)
      ORDER BY updated_at ASC
      LIMIT ?
    `,[now,limit]);
    for(const item of items){
      try{
        await syncWorkToSheet(item.work_id,item.operation);
        await markSuccess(item);
      }catch(e){
        console.error('Google Sheets sync failed',item.work_id,e.message);
        await markFailure(item,e);
      }
    }
  }finally{
    processing=false;
  }
}

async function queueExistingWorks(){
  if(!googleConfigured())return;
  const rows=await all(`
    SELECT w.work_id,w.deleted_at
    FROM works w
    LEFT JOIN sheet_sync_queue q ON q.work_id=w.work_id
    WHERE q.work_id IS NULL
    ORDER BY w.created_at
  `);
  for(const w of rows)await enqueueWorkSync(w.work_id,w.deleted_at?'DELETE':'UPSERT');
}

async function getGoogleSyncStatus(){
  const counts=await all("SELECT status,COUNT(*) AS n FROM sheet_sync_queue GROUP BY status");
  const out={configured:googleConfigured(),spreadsheetId:SPREADSHEET_ID,sheetName:SHEET_NAME,pending:0,errors:0,synced:0};
  for(const r of counts){
    if(r.status==='PENDING')out.pending=Number(r.n||0);
    else if(r.status==='ERROR')out.errors=Number(r.n||0);
    else if(r.status==='SYNCED')out.synced=Number(r.n||0);
  }
  const last=await get("SELECT updated_at,last_error FROM sheet_sync_queue ORDER BY updated_at DESC LIMIT 1");
  out.lastActivity=last?.updated_at||null;
  out.lastError=last?.last_error||null;
  return out;
}

async function startGoogleSyncWorker(){
  if(!googleConfigured()){
    console.warn('Google Sheets sync disabled or not configured');
    return;
  }
  await getTargetSheetId();
  await queueExistingWorks();
  await processSyncQueue(50);
  if(timer)clearInterval(timer);
  timer=setInterval(()=>processSyncQueue().catch(e=>console.error('Google sync timer:',e.message)),60000);
  timer.unref?.();
  console.log('Google Sheets sync active:',SPREADSHEET_ID,SHEET_NAME);
}

module.exports={
  enqueueWorkSync,
  processSyncQueue,
  startGoogleSyncWorker,
  getGoogleSyncStatus,
  syncWorkToSheet,
  googleConfigured
};
