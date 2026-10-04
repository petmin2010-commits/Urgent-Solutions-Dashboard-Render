'use strict';

function installParityServer(ctx){
  const {
    app,requireAuth,buildData,getCache,clearCache,clean,norm,XLSX,DateTime,
    sheetsApi,SPREADSHEET_ID,q,RAW_EXPORT_SOURCES,exportRowIsReal,columnLetter
  }=ctx;

  function dashboardMonitorSummary(data){
    const d=data||getCache()?.data||{};
    const c=getCache()||{};
    return {
      ok:true,
      sourceMode:d.sourceMode||'live',
      updatedAt:d.updatedAt||null,
      cacheAgeMs:c.at?Date.now()-c.at:null,
      projects:d.summaries?.projects??0,
      actualPermits:d.summaries?.actualPermits??0,
      lines:d.summaries?.lines??0,
      highRiskProjects:d.summaries?.highRiskProjects??0,
      qualityIssues:d.summaries?.qualityIssues??0,
      matchedGap:d.summaries?.matchedGap??0
    };
  }

  function projectNewsRows(d){
    const s=d?.summaries||{},pt=d?.permitTiming||{},rows=[];
    if((s.highRiskProjects||0)>0)rows.push({level:'high',text:'يوجد '+s.highRiskProjects+' مشروعًا بمخاطر مرتفعة/حرجة وتحتاج أولوية متابعة.'});
    if((pt.expiring||0)>0)rows.push({level:'medium',text:'يوجد '+pt.expiring+' تصريحًا أوشك على الانتهاء خلال نافذة المتابعة.'});
    if((pt.expired||0)>0)rows.push({level:'high',text:'يوجد '+pt.expired+' تصريحًا منتهيًا وفق التواريخ المسجلة.'});
    if((s.matchedGap||0)>0)rows.push({level:'medium',text:'فجوة الأمتار المطابقة تبلغ '+s.matchedGap+' متر وتحتاج مراجعة التسويات.'});
    if((s.qualityIssues||0)>0)rows.push({level:'medium',text:'رصد '+s.qualityIssues+' ملاحظة جودة بيانات عبر المصادر المرتبطة.'});
    if((s.designPending||0)>0)rows.push({level:'info',text:'يوجد '+s.designPending+' خطًا بديلًا قيد التصميم/الاعتماد.'});
    if((s.designStatusConflict||0)>0)rows.push({level:'high',text:'رصد '+s.designStatusConflict+' تعارضًا بين حالة التصميم وتاريخ الاعتماد.'});
    if(!rows.length)rows.push({level:'ok',text:'لا توجد مؤشرات حرجة جديدة في آخر قراءة؛ المتابعة مستمرة.'});
    return rows;
  }

  app.get('/api/monitor/summary',requireAuth,async(req,res)=>{
    try{const d=await buildData(false);res.set('Cache-Control','no-store').json(dashboardMonitorSummary(d))}
    catch(e){res.status(500).json({ok:false,message:e.message})}
  });
  app.get('/api/monitor/full',requireAuth,async(req,res)=>{
    try{
      const d=await buildData(false);
      res.set('Cache-Control','no-store').json({
        ok:true,summary:dashboardMonitorSummary(d),news:projectNewsRows(d),
        quality:(d.quality||[]).slice(0,100),
        risks:(d.projects||[]).filter(x=>/حرج|مرتفع/.test(String(x.riskLevel))).slice(0,100)
      });
    }catch(e){res.status(500).json({ok:false,message:e.message})}
  });
  app.get('/api/monitor',requireAuth,async(req,res)=>{
    try{const d=await buildData(false);res.set('Cache-Control','no-store').json({ok:true,...dashboardMonitorSummary(d),news:projectNewsRows(d)})}
    catch(e){res.status(500).json({ok:false,message:e.message})}
  });

  app.post('/api/rpc',requireAuth,async(req,res)=>{
    try{
      const method=clean(req.body?.method),args=req.body?.args||{};
      if(method==='clearDashboardCache'){clearCache();return res.json({ok:true,result:{ok:true}})}
      const d=await buildData(false);let result;
      if(method==='getBootData'||method==='getPageData')result=d;
      else if(method==='getMonitorData')result=dashboardMonitorSummary(d);
      else if(method==='getFullMonitorData')result={summary:dashboardMonitorSummary(d),quality:d.quality||[],risks:(d.projects||[]).filter(x=>/حرج|مرتفع/.test(String(x.riskLevel)))};
      else if(method==='getProjectNews')result={updatedAt:d.updatedAt,source:'live-sheet-analysis',retentionHours:72,rows:projectNewsRows(d)};
      else if(method==='getWorkOrder360'){
        const qv=norm(args.query||args.workOrder||args.project||'');
        const projects=(d.projects||[]).filter(x=>[x.no,x.name,x.contractor,x.owner,x.municipality].some(v=>norm(v).includes(qv))).slice(0,25);
        result={
          projects,
          lines:(d.lines||[]).filter(x=>projects.some(p=>norm(x.owner)===norm(p.owner)&&norm(x.contractor)===norm(p.contractor))).slice(0,100),
          permits:(d.permits||[]).filter(x=>projects.some(p=>norm(x.owner)===norm(p.owner)||norm(x.contractor)===norm(p.contractor))).slice(0,100)
        };
      }else return res.status(400).json({ok:false,error:'UNKNOWN_METHOD'});
      res.json({ok:true,result});
    }catch(e){res.status(500).json({ok:false,error:e.message})}
  });

  function ruleAnalysis(d){
    const s=d.summaries||{},pt=d.permitTiming||{};
    return {
      current:'إجمالي المشاريع '+(s.projects||0)+'، التصاريح الفعلية '+(s.actualPermits||0)+'، الخطوط البديلة '+(s.lines||0)+'.',
      risks:'المشاريع عالية المخاطر: '+(s.highRiskProjects||0)+'، التصاريح المنتهية: '+(pt.expired||0)+'، ملاحظات جودة البيانات: '+(s.qualityIssues||0)+'.',
      actions:(s.highRiskProjects||0)>0?'ابدأ بالمشاريع الحرجة ثم التصاريح المنتهية وفجوات الأمتار، مع إغلاق ملاحظات جودة البيانات.':'استمرار المتابعة الدورية مع التركيز على التصاريح والضمانات والتسويات.'
    };
  }

  app.post('/api/ai/analyze',requireAuth,async(req,res)=>{
    try{
      const d=await buildData(false),fallback=ruleAnalysis(d);
      const key=String(process.env.OPENAI_API_KEY||'').trim();
      if(!key)return res.json({ok:true,mode:'rule-engine',analysis:fallback});
      const payload={
        model:process.env.OPENAI_MODEL||'gpt-5-mini',
        input:[
          {role:'system',content:[{type:'input_text',text:'You are an operations analyst. Return concise Arabic JSON with keys current, risks, actions.'}]},
          {role:'user',content:[{type:'input_text',text:JSON.stringify({page:req.body?.page||'',summaries:d.summaries||{},permitTiming:d.permitTiming||{},management:d.management||{}})}]}
        ],
        text:{format:{type:'json_schema',name:'urgent_analysis',schema:{type:'object',properties:{current:{type:'string'},risks:{type:'string'},actions:{type:'string'}},required:['current','risks','actions'],additionalProperties:false},strict:true}}
      };
      const rr=await fetch('https://api.openai.com/v1/responses',{
        method:'POST',
        headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},
        body:JSON.stringify(payload)
      });
      if(!rr.ok)return res.json({ok:true,mode:'rule-engine-fallback',analysis:fallback});
      const jj=await rr.json();let txt=jj.output_text||'';
      if(!txt&&Array.isArray(jj.output))for(const o of jj.output)for(const c of(o.content||[]))if(c.text)txt+=c.text;
      let analysis=fallback;try{analysis=JSON.parse(txt)}catch{}
      res.json({ok:true,mode:'responses-api',analysis});
    }catch(e){res.status(500).json({ok:false,error:e.message})}
  });

  function excelAllowed(req){
    const p=req.session?.user?.permissions||[];
    return !p.length||p.includes('*')||p.some(x=>norm(x)===norm('تصدير تقرير اكسيل')||norm(x)===norm('تصدير تقرير Excel'));
  }
  function requireExcelAccess(req,res,next){if(excelAllowed(req))return next();return res.status(403).json({ok:false,error:'EXCEL_ACCESS_DENIED'})}
  async function rawSheetValues(sheet){
    const range=RAW_EXPORT_SOURCES[sheet];if(!range)throw new Error('UNKNOWN_SOURCE');
    const sheets=await sheetsApi();
    const r=await sheets.spreadsheets.values.get({spreadsheetId:SPREADSHEET_ID,range:q(sheet)+'!'+range,valueRenderOption:'FORMATTED_VALUE'});
    return r.data.values||[];
  }

  app.get('/api/excel-export/sheets',requireAuth,requireExcelAccess,async(req,res)=>{
    try{
      const list=[];
      for(const title of Object.keys(RAW_EXPORT_SOURCES)){
        const vals=await rawSheetValues(title),head=vals[0]||[];
        list.push({title,headerRow:1,rowCount:Math.max(0,vals.length-1),columns:head.map((v,i)=>({index:i,letter:columnLetter(i),label:clean(v)||('عمود '+columnLetter(i))}))});
      }
      res.json({ok:true,spreadsheetTitle:'مقاولين الحلول العاجلة الجديد',sheets:list});
    }catch(e){res.status(500).json({ok:false,error:e.message})}
  });

  app.get('/api/excel-export/columns',requireAuth,requireExcelAccess,async(req,res)=>{
    try{
      const sheet=clean(req.query.sheet),vals=await rawSheetValues(sheet),head=vals[0]||[];
      res.json({ok:true,sheet,headerRow:1,columns:head.map((v,i)=>({index:i,letter:columnLetter(i),label:clean(v)||('عمود '+columnLetter(i))}))});
    }catch(e){res.status(400).json({ok:false,error:e.message})}
  });

  app.post('/api/excel-export/filter-options',requireAuth,requireExcelAccess,async(req,res)=>{
    try{
      const sheet=clean(req.body?.sheet),cols=(req.body?.columns||[]).map(Number),vals=await rawSheetValues(sheet),rows=vals.slice(1);
      const filters=cols.map(i=>{
        const counts=new Map();rows.forEach(r=>{const v=String(r[i]??'');counts.set(v,(counts.get(v)||0)+1)});
        return {index:i,label:clean(vals[0]?.[i])||columnLetter(i),letter:columnLetter(i),values:[...counts].sort((a,b)=>String(a[0]).localeCompare(String(b[0]),'ar',{numeric:true})).map(([value,count])=>({value,count}))};
      });
      res.json({ok:true,sheet,rowCount:rows.length,filters});
    }catch(e){res.status(400).json({ok:false,error:e.message})}
  });

  app.post('/api/excel-export',requireAuth,requireExcelAccess,async(req,res)=>{
    try{
      const sheet=clean(req.body?.sheet),cols=[...new Set((req.body?.columns||[]).map(Number).filter(Number.isInteger))].sort((a,b)=>a-b),excluded=req.body?.excludeFilters||{},vals=await rawSheetValues(sheet);
      if(!cols.length)throw new Error('اختر عمودًا واحدًا على الأقل');
      const head=vals[0]||[],rows=vals.slice(1).filter(r=>exportRowIsReal(sheet,r)).filter(r=>cols.every(i=>!(Array.isArray(excluded[String(i)])&&excluded[String(i)].map(String).includes(String(r[i]??'')))));
      const aoa=[cols.map(i=>head[i]??''),...rows.map(r=>cols.map(i=>r[i]??''))];
      const wb=XLSX.utils.book_new(),ws=XLSX.utils.aoa_to_sheet(aoa);
      ws['!cols']=cols.map((i,pos)=>({wch:Math.min(50,Math.max(12,...aoa.slice(0,300).map(r=>String(r[pos]??'').length+2)))}));
      XLSX.utils.book_append_sheet(wb,ws,String(sheet).slice(0,31));
      const buffer=XLSX.write(wb,{type:'buffer',bookType:'xlsx'}),stamp=DateTime.now().setZone('Asia/Riyadh').toFormat('yyyyLLdd_HHmmss'),filename='Excel_Report_Jeddah_'+sheet.replace(/[\\/:*?"<>|]/g,'-')+'_'+stamp+'.xlsx';
      res.set('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.set('Content-Disposition',"attachment; filename*=UTF-8''"+encodeURIComponent(filename));
      res.send(buffer);
    }catch(e){res.status(400).json({ok:false,error:e.message})}
  });
}
module.exports=installParityServer;
