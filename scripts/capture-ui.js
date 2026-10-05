const puppeteer=require('puppeteer-core');
const fs=require('fs');
const path=require('path');

function loadEnv(){
  const o={};
  for(const raw of fs.readFileSync(path.join(__dirname,'..','.env'),'utf8').split(/\r?\n/)){
    const line=raw.trim(); if(!line||line.startsWith('#'))continue;
    const i=line.indexOf('='); if(i>0)o[line.slice(0,i).trim()]=line.slice(i+1).trim();
  }
  return o;
}
(async()=>{
  const e=loadEnv();
  const browser=await puppeteer.launch({
    executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless:true,
    args:['--no-sandbox','--disable-gpu']
  });
  const page=await browser.newPage();
  await page.setViewport({width:1440,height:1100,deviceScaleFactor:1});
  await page.goto('http://localhost:'+(e.PORT||3035),{waitUntil:'networkidle0'});
  await page.type('#loginPassword',e.ADMIN_PASSWORD);
  await Promise.all([
    page.click('#loginForm button[type="submit"]'),
    page.waitForSelector('#appView:not(.hidden)',{timeout:10000})
  ]);
  await new Promise(r=>setTimeout(r,700));
  await page.screenshot({path:path.join(__dirname,'..','preview-entry-desktop.png'),fullPage:true});
  await page.setViewport({width:390,height:844,deviceScaleFactor:1});
  await page.reload({waitUntil:'networkidle0'});
  await page.waitForSelector('#appView:not(.hidden)',{timeout:10000});
  await new Promise(r=>setTimeout(r,500));
  await page.screenshot({path:path.join(__dirname,'..','preview-entry-mobile.png'),fullPage:true});
  const info=await page.evaluate(()=>({
    title:document.title,
    visibleView:[...document.querySelectorAll('.view')].find(x=>x.classList.contains('active'))?.id||'',
    fieldsets:document.querySelectorAll('#workForm fieldset').length,
    navItems:[...document.querySelectorAll('.nav-item:not(.hidden) b')].map(x=>x.textContent.trim()),
    errors:[...document.querySelectorAll('.form-error')].map(x=>x.textContent.trim()).filter(Boolean)
  }));
  console.log(JSON.stringify(info,null,2));
  await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
