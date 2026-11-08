import puppeteer from 'puppeteer';
import fs from 'node:fs';
const base=process.env.TEST_URL||'http://localhost:3103';
const out=process.env.RESPONSIVE_OUTPUT||'/tmp/ehub-responsive';fs.mkdirSync(out,{recursive:true});
const browser=await puppeteer.launch({headless:true});const page=await browser.newPage();
const api=async(p,body)=>await(await fetch(base+p,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)})).json();
const user=await api('/api/login/username',{username:'Responsive QA'});
const idea=await api('/api/ideas',{author_id:user.id,title:'地域の課題を解決する新しいアイデアと長い見出しのレイアウト検証',description:'<p>'+('地域での共創と新しい取り組みについて。'.repeat(20))+'</p>'});
const project=await api('/api/projects',{author_id:user.id,title:'Responsive Project',description:'<p>Responsive project description.</p>'});
await page.goto(base,{waitUntil:'networkidle2'});
await page.evaluate(u=>{localStorage.setItem('ehub_user',JSON.stringify(u));localStorage.setItem('ehub_language','ja')},user);
const results=[];
async function audit(label){
 const issues=await page.evaluate(()=>{
  const w=innerWidth;return [...document.querySelectorAll('#root *')].flatMap(el=>{
   const r=el.getBoundingClientRect(),s=getComputedStyle(el);
   if(el.closest('[data-responsive-carousel]'))return [];
   if(r.width<2||r.height<2||r.bottom<0||r.top>innerHeight||s.visibility==='hidden'||s.display==='none'||el.closest('svg'))return [];
   if(r.left>=-1&&r.right<=w+1)return [];
   for(let p=el.parentElement;p&&p!==document.body;p=p.parentElement){const st=getComputedStyle(p);if(['auto','scroll'].includes(st.overflowX)&&p.scrollWidth>p.clientWidth+1)return []}
   return [{tag:el.tagName,text:(el.textContent||'').slice(0,65),left:Math.round(r.left),right:Math.round(r.right),class:el.className}];
  }).slice(0,12)
 });
 if(label==='account-menu'){
  const clipped=await page.$eval('[data-account-popover]',el=>{const r=el.getBoundingClientRect();return r.left < 0 || r.right > innerWidth+1 || r.bottom > innerHeight-50});
  if(clipped)issues.push({text:'Account menu does not fit viewport'});
 }
 if(label==='/create'){
  const overlap=await page.evaluate(()=>{const badge=document.querySelector('[data-post-badge]')?.getBoundingClientRect();if(!badge)return true;return [...document.querySelectorAll('[data-post-toolbar] button')].some(el=>{const r=el.getBoundingClientRect();return r.width>0&&Math.min(r.right,badge.right)-Math.max(r.left,badge.left)>2&&Math.min(r.bottom,badge.bottom)-Math.max(r.top,badge.top)>2})});
  if(overlap)issues.push({text:'Posting badge overlaps toolbar controls'});
 }
 const name=label.replace(/[^a-z0-9-]/gi,'_');
 await page.screenshot({path:`${out}/${page.viewport().width}-${name}.png`});
 results.push({width:page.viewport().width,height:page.viewport().height,screen:label,issues});
}
try{
for(const [width,height] of [[320,568],[390,844],[768,1024],[1024,768],[1440,900],[844,390]]){
 await page.setViewport({width,height});
 for(const route of ['/vision','/projects','/store','/profile','/create','/search','/list','/contracts','/memos','/chat','/cart','/notifications',`/idea/${idea.id}`,`/project/${project.id}`]){
  await page.goto(base+route,{waitUntil:'domcontentloaded'});await page.waitForSelector('main');await new Promise(r=>setTimeout(r,450));
  await audit(route);
  if(route==='/profile'){
   await page.locator('#btn-user-account-menu').click();await new Promise(r=>setTimeout(r,350));await audit('account-menu');await page.locator('#btn-user-account-menu').click();
   await page.locator('button[title="メニュー / 設定"],button[title="Menu / Settings"]').click();await new Promise(r=>setTimeout(r,350));await audit('profile-settings');
   await page.locator('button ::-p-text(言語)').click();await new Promise(r=>setTimeout(r,100));await audit('settings-language');
  }
 }
 console.log('Audited width',width);
}
}finally{await browser.close();fs.writeFileSync(out+'/results.json',JSON.stringify(results,null,2));}
const failed=results.filter(r=>r.issues.length);console.log(JSON.stringify({screens:results.length,failures:failed.map(r=>({...r,issues:r.issues.slice(0,3)}))},null,2));if(failed.length)process.exitCode=1;
