import puppeteer from 'puppeteer';import assert from 'node:assert/strict';import fs from 'node:fs';
const base=process.env.TEST_URL||'http://localhost:3101';
const api=async(path,body)=>{const r=await fetch(base+path,{method:body?'POST':'GET',headers:{'content-type':'application/json'},body:body?JSON.stringify(body):undefined});const data=await r.json();assert.equal(r.status,200,JSON.stringify(data));return data;};
const user=await api('/api/login/username',{username:'New Navigation QA'});
const outsider=await api('/api/login/username',{username:'Other Navigation QA'});
const recruitment=await api('/api/projects',{author_id:user.id,title:'QA Public Recruitment',description:'QA recruitment body',is_recruitment:1});
const proposal=await api('/api/projects',{author_id:user.id,title:'QA Private Proposal',description:'QA proposal body',is_recruitment:1,is_private:1,permitted_users:JSON.stringify([user.id])});
await api('/api/projects',{author_id:outsider.id,title:'QA Hidden Proposal',description:'Private',is_recruitment:1,is_private:1,permitted_users:'[]'});
for(const type of ['project','idea']){
 const item=await api(type==='idea'?'/api/ideas':'/api/projects',{author_id:user.id,title:'QA '+type+' Buyout',description:'Buyout QA'});
 await api('/api/buyouts',{item_type:type,item_id:item.id,creator_id:user.id,buyout_type:'fixed',price:1000});
}
const browser=await puppeteer.launch({headless:true});const results=[];const errors=[];let page;
try{
 page=await browser.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
 await page.setViewport({width:390,height:844});await page.goto(base,{waitUntil:'networkidle2'});
 assert.equal(new URL(page.url()).pathname,'/vision');
 await page.locator('[data-testid="open-login"]').click();await page.locator('input[placeholder="Enter your username"]').fill(user.username);await page.locator('[data-testid="login-form"] button[type="submit"]').click();await page.waitForSelector('#btn-user-account-menu');
 const labels=await page.$$eval('[data-testid="primary-navigation"] a',nodes=>nodes.map(n=>n.textContent.trim()));assert.deepEqual(labels,['Vision','Project','Chat','Store','Profile']);assert.equal(await page.$('[data-bottom-popover]'),null);results.push('Five direct footer links without footer modals');
 const long='A long Vision with <literal markup> & emoji 🌱\n'+('文字数制限のない投稿本文です。'.repeat(1000))+'\nEND OF LONG VISION';
 await page.locator('[data-testid="vision-create-button"]').click();await page.waitForSelector('#vision-body');await page.focus('#vision-body');await page.keyboard.sendCharacter(long);assert.equal(await page.$eval('#vision-body',el=>el.maxLength),-1);
 await page.locator('[data-testid="vision-composer"] button[type="submit"]').click();
 await page.waitForFunction(()=>[...document.querySelectorAll('[data-testid="vision-post"]')].some(n=>n.textContent.includes('END OF LONG VISION')));
 const created=(await api('/api/projects?user_id='+user.id)).find(p=>p.description.includes('END OF LONG VISION'));
 const decoded=await page.evaluate(html=>new DOMParser().parseFromString(html.replace(/<br>/g,'\n'),'text/html').body.textContent,created.description);
 assert.equal(decoded,long);assert.equal(await page.$('#vision-body'),null);results.push('Long Vision submission preserves full text and literal markup');
 assert.equal(await page.$eval('[data-testid="vision-post"] a.whitespace-pre-wrap',el=>getComputedStyle(el).webkitLineClamp),'6');
 let first=await page.$('[data-testid="vision-post"]');
 await first.$('button[aria-label="Like"]').then(b=>b.click());await page.waitForFunction(()=>document.querySelector('[data-testid="vision-post"] button[aria-label="Like"]')?.getAttribute('aria-pressed')==='true');
 await first.$('button[aria-label="Save"]').then(b=>b.click());await page.waitForFunction(()=>document.querySelector('[data-testid="vision-post"] button[aria-label="Save"]')?.getAttribute('aria-pressed')==='true');
 await page.reload({waitUntil:'networkidle2'});await page.waitForFunction(()=>document.querySelector('[data-testid="vision-post"] button[aria-label="Like"]')?.getAttribute('aria-pressed')==='true');results.push('Likes and saved posts survive reload');
 await page.locator('[data-testid="primary-navigation"] a ::-p-text(Project)').click();await page.waitForFunction(()=>location.pathname==='/projects');await page.waitForFunction(()=>document.body.textContent.includes('QA Public Recruitment')&&document.body.textContent.includes('QA Private Proposal'));
 assert.ok(!(await page.$eval('body',el=>el.textContent)).includes('QA Hidden Proposal'));results.push('Project combines public recruitment and permitted proposals');
 await page.locator('a ::-p-text(QA Public Recruitment)').click();await page.waitForFunction(()=>/^\/project\/\d+$/.test(location.pathname));assert.equal(await page.$eval('[data-testid="primary-navigation"] a[aria-current="page"]',el=>el.textContent.trim()),'Project');results.push('Project details preserve the active section');
 for(const [label,expectedPrivate,title] of [['Create recruitment',0,'QA UI Recruitment'],['Create proposal',1,'QA UI Proposal']]){
  await page.goto(base+'/projects',{waitUntil:'networkidle2'});await page.locator(`a ::-p-text(${label})`).click();
  await page.focus('textarea[placeholder="Slide Title"]');await page.keyboard.sendCharacter(title);
  await page.focus('.ql-editor');await page.keyboard.sendCharacter('Created through the Project hub UI');
  await page.locator('[data-post-toolbar] button ::-p-text(Publish)').click();await page.waitForFunction(()=>/^\/project\/\d+$/.test(location.pathname));
  const id=new URL(page.url()).pathname.split('/').pop();const saved=await api('/api/projects/'+id+'?user_id='+user.id);assert.equal(saved.is_recruitment,1);assert.equal(saved.is_private,expectedPrivate);
 }
 results.push('Recruitment and proposal creation through Project UI');
 await page.goto(base+'/projects',{waitUntil:'networkidle2'});
 await page.locator('nav[aria-label="Project filters"] a ::-p-text(Proposals)').click();await page.waitForFunction(()=>location.search.includes('type=offer'));await page.waitForFunction(()=>document.body.textContent.includes('QA Private Proposal'));assert.ok(!(await page.$eval('body',el=>el.textContent)).includes('QA Public Recruitment'));results.push('Proposal filtering preserves visibility');
 await page.locator('[data-testid="primary-navigation"] a ::-p-text(Chat)').click();await page.waitForFunction(()=>location.pathname==='/chat');assert.equal(await page.$('[data-bottom-popover]'),null);results.push('Chat opens directly');
 await page.locator('button ::-p-text(Direct)').click();await page.waitForFunction(()=>location.search.includes('tab=direct'));await page.reload({waitUntil:'networkidle2'});assert.equal(await page.$eval('button[aria-pressed="true"]',el=>el.textContent.trim()),'Direct');results.push('Direct chat selection survives reload');
 await page.locator('[data-testid="primary-navigation"] a ::-p-text(Store)').click();await page.waitForFunction(()=>location.pathname==='/store');
 for(const [label,tab] of [['Purchase History','purchase'],['Cart','cart']]){await page.locator(`button ::-p-text(${label})`).click();await page.waitForFunction(t=>new URLSearchParams(location.search).get('tab')===t,{},tab)}results.push('Store purchase history and cart remain reachable');
 await page.locator('nav[aria-label="Store categories"] a ::-p-text(Buyout)').click();await page.waitForFunction(()=>document.body.textContent.includes('QA project Buyout')&&document.body.textContent.includes('QA idea Buyout'));results.push('Store includes both Project and Idea buyouts');
 await page.locator('[data-testid="open-search"]').click();await page.waitForSelector('[data-search-dialog]');
 await page.locator('[data-search-filter="project"]').click();await page.focus('[data-search-dialog] input');await page.keyboard.type('QA');
 await page.waitForFunction(()=>document.querySelector('[data-search-dialog]')?.textContent.includes('QA UI Recruitment'));
 assert.ok(!(await page.$eval('[data-search-dialog]',el=>el.textContent)).includes('QA Hidden Proposal'));results.push('Global search uses Project classification and private visibility');
 await page.goto(base+'/vision',{waitUntil:'networkidle2'});
 await page.locator('button[title="通知"]').click();await page.waitForFunction(()=>location.pathname==='/notifications');results.push('Notifications remain in the header');
 for(const [old,target] of [['/','/vision'],['/search','/vision'],['/completed','/store'],['/list?type=recruitment','/projects'],['/list?type=offer','/projects'],['/list?type=buyout','/store']]){
  await page.goto(base+old,{waitUntil:'networkidle2'});assert.equal(new URL(page.url()).pathname,target);
 }results.push('Legacy links redirect to new sections');
 for(const [width,height] of [[320,568],[390,844],[640,568],[768,1024],[1024,768],[1440,900],[844,390]]){
  await page.setViewport({width,height});
  for(const route of ['/vision','/projects','/projects?type=offer','/chat','/store','/store?tab=buyout','/profile']){
   await page.goto(base+route,{waitUntil:'domcontentloaded'});await page.waitForSelector('[data-testid="primary-navigation"]');await new Promise(r=>setTimeout(r,180));
   const bounds=await page.$$eval('[data-testid="primary-navigation"] a',nodes=>nodes.map(el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom}}));assert.ok(bounds.every(r=>r.left>=0&&r.right<=width&&r.bottom<=height));
   if(route==='/vision'){assert.ok(await page.$('[data-testid="vision-create-button"]'));assert.equal(await page.$('#vision-body'),null);}
   if(width===390&&['/vision','/projects','/store'].includes(route))await page.screenshot({path:`/tmp/ehub-redesign-${route.slice(1)}.png`});
  }
 }results.push('Seven sections at seven viewport sizes');
 assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:results,viewportChecks:49},null,2));
}catch(e){await page.screenshot({path:'/tmp/ehub-redesign-failure.png'}).catch(()=>{});throw e;}finally{await browser.close();fs.writeFileSync('/tmp/ehub-navigation-redesign.json',JSON.stringify({results,errors},null,2))}
