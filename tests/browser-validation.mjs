import puppeteer from 'puppeteer';
import fs from 'node:fs';
const base=process.env.TEST_URL||'http://localhost:3100';
const browser=await puppeteer.launch({headless:true});
const page=await browser.newPage();
await page.setViewport({width:1440,height:1000});
const results=[];let errors=[],failures=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('response',r=>{if(r.url().startsWith(base+'/api/')&&r.status()>=500)failures.push(r.url()+':'+r.status())});
const paths=['/vision','/projects','/store','/','/create','/search','/chat','/completed','/purchases','/cart','/list','/notifications','/profile','/profile/1','/idea/1','/project/1','/compile/1','/memos','/contracts','/chat/idea/1','/network/1'];
try {
for(const signedIn of [false,true]){
 if(signedIn){
  const user=await(await fetch(base+'/api/login/username',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username:'QA-Browser'})})).json();
  await page.evaluate(user=>localStorage.setItem('ehub_user',JSON.stringify(user)),user);
  const idea=await(await fetch(base+'/api/ideas',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({author_id:user.id,title:'Browser chat fixture',description:'QA'})})).json();
  paths[paths.indexOf('/chat/idea/1')]=`/chat/idea/${idea.id}`;
 }
 for(const route of paths){
  errors=[];failures=[];
  await page.goto(base+route,{waitUntil:'networkidle2',timeout:30000});
  await page.waitForFunction(()=>document.querySelector('#root')?.textContent?.length>20,{timeout:10000}).catch(e=>errors.push('No rendered UI'));
  const expectedRoute=route==='/compile/1'?'/project/1':['/','/search','/memos','/contracts'].includes(route)?'/vision':route==='/completed'?'/store':route;
  if(signedIn && new URL(page.url()).pathname!==expectedRoute)errors.push('Unexpected redirect to '+new URL(page.url()).pathname);
  const text=await page.$eval('#root',el=>el.innerText);
  if(signedIn && text.includes('Which account do you want to start with?'))errors.push('Unexpected account setup overlay');
  if(/Something went wrong|予期せぬエラー/.test(text))errors.push('Error boundary rendered');
  results.push({route,signedIn,ok:!errors.length&&!failures.length,errors:[...errors],failures:[...failures]});
 }
}
await page.setViewport({width:390,height:844});
for(const route of ['/','/create','/search','/profile','/memos','/contracts']){
 errors=[];failures=[];
 await page.goto(base+route,{waitUntil:'networkidle2',timeout:30000});
 const text=await page.$eval('#root',el=>el.innerText);
 if(text.length<20)errors.push('No rendered UI');
 results.push({route,signedIn:true,mobile:true,ok:!errors.length&&!failures.length,errors:[...errors],failures:[...failures]});
}
await page.screenshot({path:'/tmp/ehub-browser-validation.png',fullPage:true});
}finally{await browser.close();fs.writeFileSync('/tmp/ehub-browser-validation.json',JSON.stringify(results,null,2));}
console.log(JSON.stringify({checks:results.length,passed:results.filter(r=>r.ok).length,failed:results.filter(r=>!r.ok)},null,2));
if(results.some(r=>!r.ok))process.exitCode=1;
