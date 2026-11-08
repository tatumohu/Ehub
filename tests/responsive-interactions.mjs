import puppeteer from 'puppeteer';import assert from 'node:assert/strict';import fs from 'node:fs';
const base=process.env.TEST_URL||'http://localhost:3103';const browser=await puppeteer.launch({headless:true});const results=[];
try{const page=await browser.newPage();await page.goto(base,{waitUntil:'networkidle2'});const user=await(await fetch(base+'/api/login/username',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username:'Responsive UI Actions'})})).json();await page.evaluate(u=>localStorage.setItem('ehub_user',JSON.stringify(u)),user);
for(const [width,height] of [[320,568],[390,844],[768,1024],[1024,768],[1440,900],[844,390]]){
 await page.setViewport({width,height});await page.goto(base,{waitUntil:'networkidle2'});await page.waitForSelector('#btn-user-account-menu');
 await page.locator('[data-testid="open-search"]').click();await page.waitForSelector('[data-search-dialog]');await new Promise(r=>setTimeout(r,350));
 const bounds=await page.$eval('[data-search-dialog]',el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom}});
 const ok=bounds.left>=0&&bounds.right<=width&&bounds.top>=0&&bounds.bottom<=height;
 results.push({screen:'search-dialog',width,height,ok,bounds});await page.screenshot({path:`/tmp/ehub-responsive/${width}-search-dialog.png`});
}
for(const width of [320,1024]){
 await page.setViewport({width,height:568});await new Promise(r=>setTimeout(r,100));
 const ok=await page.$eval('[data-search-dialog]',el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.bottom<=innerHeight});
 results.push({screen:'search-live-resize',width,height:568,ok});
}
await page.setViewport({width:320,height:568});await page.goto(base+'/profile',{waitUntil:'domcontentloaded'});
await page.locator('button[title="Menu / Settings"],button[title="メニュー / 設定"]').click();
for(const width of [1024,320]){
 await page.setViewport({width,height:568});await new Promise(r=>setTimeout(r,150));
 const ok=await page.$eval('[data-settings-panel]',el=>{const r=el.getBoundingClientRect();return r.width>0&&r.left>=0&&r.right<=innerWidth});
 results.push({screen:'settings-live-resize',width,height:568,ok});
 await page.screenshot({path:`/tmp/ehub-responsive/${width}-settings-resized.png`});
}
}finally{await browser.close()}
fs.writeFileSync('/tmp/ehub-responsive/interactions.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results));assert.ok(results.every(r=>r.ok),'Search dialog clipped');
