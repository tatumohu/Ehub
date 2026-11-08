import assert from 'node:assert/strict';
import fs from 'node:fs';
import puppeteer from 'puppeteer';
const base=process.env.TEST_URL||'http://localhost:3101',out='/tmp/ehub-card-orientation';fs.mkdirSync(out,{recursive:true});
const browser=await puppeteer.launch({headless:true});let page;const errors=[],results=[];
async function api(path,method='GET',body,id,status=200){const res=await fetch(base+path,{method,headers:{'content-type':'application/json',...(id?{'x-user-id':String(id)}:{})},...(body?{body:JSON.stringify(body)}:{})});const data=await res.json();assert.equal(res.status,status,JSON.stringify(data));return data}
async function click(selector){const el=await page.waitForSelector(selector,{visible:true});await el.evaluate(e=>e.scrollIntoView({block:'center'}));assert.ok(await el.evaluate(e=>{const r=e.getBoundingClientRect(),p=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return r.left>=0&&r.right<=innerWidth+1&&p&&(p===e||e.contains(p))}),'Control must be reachable: '+selector);await el.click()}
async function button(text){for(const el of await page.$$('button'))if((await el.evaluate(e=>e.textContent)).trim()===text){await el.evaluate(e=>e.scrollIntoView({block:'center'}));await el.click();return}throw new Error('No button: '+text)}
async function fill(selector,value){await click(selector);await page.$eval(selector,e=>e.select());await page.keyboard.sendCharacter(value)}
async function open(){await click('[aria-label="名刺を作成・登録"]');await button('名刺を作成');await page.waitForSelector('[data-testid="card-designer"]')}
async function save(id){await click('[role="dialog"] button[type="submit"]');await page.waitForFunction(()=>!document.querySelector('[role="dialog"]'));return (await api(`/api/users/${id}/business-card`,'GET',undefined,id)).card}
async function portraitCanvas(){assert.equal(await page.$eval('[data-testid="card-design-canvas"]',e=>e.getAttribute('viewBox')),'0 0 550 910');assert.equal(await page.$eval('[aria-label="名刺の向き"]',e=>e.value),'portrait')}
async function bounds(){assert.ok(await page.$eval('[role="dialog"]',e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight+1}),'Dialog fits');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal overflow')}
async function profileRatio(portrait){const el=await page.waitForSelector('[data-testid="card-design-artwork"]',{visible:true});await el.evaluate(e=>e.scrollIntoView({block:'center'}));const r=await el.evaluate(e=>{const r=e.getBoundingClientRect();return {w:r.width,h:r.height,x:r.x,y:r.y}});assert.ok(Math.abs(r.w/r.h-(portrait?55/91:91/55))<0.01,'Profile paper uses actual orientation');assert.ok(r.x>=0&&r.x+r.w<=page.viewport().width+1&&r.y>=0&&r.y+r.h<=page.viewport().height+1,'Profile card fits');}
try {
 for(const [width,height,mobile] of [[320,568,true],[390,844,true],[844,390,true],[1024,768,false],[1440,900,false]]){
  const context=await browser.createBrowserContext();page=await context.newPage();page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(e.message));await page.setViewport({width,height,isMobile:mobile,hasTouch:mobile});
  const user=await api('/api/login/username','POST',{username:`Orientation ${width}`});await page.goto(base,{waitUntil:'networkidle2'});await page.evaluate(u=>{localStorage.setItem('ehub_user',JSON.stringify(u));localStorage.setItem('ehub_language','ja')},user);await page.goto(base+'/profile',{waitUntil:'networkidle2'});await open();
  assert.equal(await page.$eval('[aria-label="名刺の向き"]',e=>e.value),'landscape');
  await click('[data-card-layer="name"]');await fill('[aria-label="文字内容"]','縦型の氏名');
  await page.select('[aria-label="名刺の向き"]','portrait');await portraitCanvas();await bounds();
  await click('[aria-label="元に戻す"]');assert.equal(await page.$eval('[aria-label="名刺の向き"]',e=>e.value),'landscape');await click('[aria-label="やり直す"]');await portraitCanvas();
  await page.select('[aria-label="追加する文字の種類"]','company');await button('文字を追加');await fill('[aria-label="文字内容"]','縦型カンパニー');
  await button('図形');await button('円を追加');await fill('[aria-label="幅"]','100');await fill('[aria-label="高さ"]','100');await fill('[aria-label="X位置"]','360');await fill('[aria-label="Y位置"]','650');
  await button('画像');const image=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=80;c.height=80;const x=c.getContext('2d');x.fillStyle='#10b981';x.fillRect(0,0,80,80);return c.toDataURL()});fs.writeFileSync(out+'/image.png',Buffer.from(image.split(',')[1],'base64'));await (await page.$('input[aria-label="デザイン画像"]')).uploadFile(out+'/image.png');await page.waitForFunction(()=>document.querySelectorAll('[data-card-layer]').length===5);await fill('[aria-label="幅"]','100');await fill('[aria-label="高さ"]','100');await fill('[aria-label="X位置"]','360');await fill('[aria-label="Y位置"]','780');
  await button('ウラ面');await button('文字');await page.select('[aria-label="追加する文字の種類"]','custom');await button('文字を追加');await fill('[aria-label="文字内容"]','縦型の裏面');await button('オモテ面');
  // Switching to landscape and back keeps every object and both faces.
  await page.select('[aria-label="名刺の向き"]','landscape');assert.equal(await page.$$eval('[data-card-layer]',e=>e.length),5);await page.select('[aria-label="名刺の向き"]','portrait');await portraitCanvas();
  // A real pointer/touch drag in portrait must map to portrait coordinates.
  await click('[data-card-layer="name"]');await fill('[aria-label="X位置"]','20');await fill('[aria-label="Y位置"]','400');await fill('[aria-label="幅"]','250');await fill('[aria-label="高さ"]','90');
  const layer=await page.$('[data-card-element="name"]');await layer.evaluate(e=>e.scrollIntoView({block:'center'}));const r=await layer.boundingBox();
  if(mobile){const cdp=await page.createCDPSession();const x=r.x+r.width/2,y=r.y+r.height/2;await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+12,y:y+6,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach()}
  else {await page.mouse.move(r.x+r.width/2,r.y+r.height/2);await page.mouse.down();await page.mouse.move(r.x+r.width/2+12,r.y+r.height/2+6,{steps:5});await page.mouse.up()}
  assert.equal(await page.$eval('[data-card-layer="name"]',e=>e.getAttribute('aria-pressed')),'true','Drag targets the intended text layer');
  assert.ok(await page.$eval('[aria-label="X位置"]',e=>Number(e.value))>20,'Portrait drag works');
  const first=await save(user.id);assert.equal(first.design.orientation,'portrait');assert.equal(first.design.front.elements.length,5);assert.equal(first.design.back.elements.length,1);await profileRatio(true);await page.screenshot({path:`${out}/${width}-profile-portrait.png`});
  await page.reload({waitUntil:'networkidle2'});await profileRatio(true);await button('裏面を表示');assert.ok(await page.$eval('[data-testid="card-design-artwork"]',e=>e.textContent.includes('縦型の裏面')));await profileRatio(true);await button('表面を表示');
  await open();await portraitCanvas();assert.equal(await page.$$eval('[data-card-layer]',e=>e.length),5);
  const company=first.design.front.elements.find(e=>e.field==='company');await click(`[data-card-layer="${company.id}"]`);await fill('[aria-label="文字内容"]','縦型の再編集');await bounds();await page.$eval('[data-testid="card-designer"]',e=>e.scrollIntoView({block:'start'}));await page.screenshot({path:`${out}/${width}-editor-portrait.png`});
  const second=await save(user.id);assert.ok(second.design.front.elements.some(e=>e.text==='縦型の再編集'));await page.reload({waitUntil:'networkidle2'});assert.ok(await page.$eval('[data-testid="card-design-artwork"]',e=>e.textContent.includes('縦型の再編集')));
  // A collected portrait uses the same document and renderer on the contact profile.
  const collector=await api('/api/login/username','POST',{username:`Collector ${width}`}),identity=await api('/api/business-cards/identity','POST',{},user.id);await api('/api/business-cards/collect','POST',{token:identity.token},collector.id);assert.equal((await api('/api/business-cards/collection','GET',null,collector.id))[0].design.orientation,'portrait');
  await open();await page.select('[aria-label="名刺の向き"]','landscape');const horizontal=await save(user.id);assert.equal(horizontal.design.orientation,'landscape');await profileRatio(false);await page.reload({waitUntil:'networkidle2'});await open();assert.equal(await page.$eval('[aria-label="名刺の向き"]',e=>e.value),'landscape');
  // All templates preserve the currently selected orientation, including blank.
  await page.select('[aria-label="名刺の向き"]','portrait');for(const t of ['basic','band','blank']){await page.select('[aria-label="テンプレート"]',t);await portraitCanvas()}
  await click('[aria-label="名刺画面を閉じる"]');
  const legacy=structuredClone(horizontal);delete legacy.design.orientation;const legacyResult=await api(`/api/users/${user.id}/business-card`,'PUT',legacy,user.id);assert.equal(legacyResult.card.design.orientation,'landscape');await page.reload({waitUntil:'networkidle2'});await profileRatio(false);await open();assert.equal(await page.$eval('[aria-label="名刺の向き"]',e=>e.value),'landscape');await click('[aria-label="名刺画面を閉じる"]');
  const bad=structuredClone(second);bad.design.orientation='unsupported';await api(`/api/users/${user.id}/business-card`,'PUT',bad,user.id,400);
  results.push({width,height,mobile,orientationToggle:true,save:true,reedit:true,profile:true,frontAndBack:true,drag:true});console.log('Card orientation passed',width,height);await context.close();page=null;
 }
 assert.deepEqual(errors,[]);console.log(JSON.stringify({orientationWorkflows:results,screenshots:out}));
} finally {if(page)await page.screenshot({path:out+'/last.png'}).catch(()=>{});fs.writeFileSync(out+'/results.json',JSON.stringify({results,errors},null,2));await browser.close()}
