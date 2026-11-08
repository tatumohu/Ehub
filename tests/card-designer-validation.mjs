import puppeteer from 'puppeteer';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import QRCode from 'qrcode';
const base=process.env.TEST_URL||'http://localhost:3101',out='/tmp/ehub-card-designer';fs.mkdirSync(out,{recursive:true});let checks=0;
const check=(value,message)=>{assert.ok(value,message);checks++};
async function api(path,method='GET',body,id,status=200){const r=await fetch(base+path,{method,headers:{'content-type':'application/json',...(id?{'x-user-id':String(id)}:{})},...(body?{body:JSON.stringify(body)}:{})});const d=await r.json();assert.equal(r.status,status,JSON.stringify(d));checks++;return d}
const user=await api('/api/login/username','POST',{username:'Designer QA'});
const browser=await puppeteer.launch({headless:true});let page;const errors=[];
async function click(selector){const el=await page.waitForSelector(selector,{visible:true});await el.evaluate(e=>e.scrollIntoView({block:'center'}));await el.click();}
async function button(text){const buttons=await page.$$('button');for(const b of buttons){if((await b.evaluate(e=>e.textContent)).trim()===text){await b.evaluate(e=>e.scrollIntoView({block:'center'}));await b.click();return}}throw new Error('Missing button '+text)}
async function fill(selector,value){await click(selector);await page.$eval(selector,e=>e.select());await page.keyboard.sendCharacter(value);}
async function open(){await click('[aria-label="名刺を作成・登録"]');await button('名刺を作成');await page.waitForSelector('[data-testid="card-designer"]')}
async function save(){await button('作成して登録');await page.waitForFunction(()=>!document.querySelector('[role="dialog"]'));return (await api(`/api/users/${user.id}/business-card`,'GET',undefined,user.id)).card}
async function close(){await click('[aria-label="名刺画面を閉じる"]')}
async function count(){return page.$$eval('[data-card-layer]',els=>els.length)}
async function documentDesign(){const card=await save();await open();return card.design}
async function drag(selector,dx,dy){const el=await page.waitForSelector(selector);await el.evaluate(e=>e.scrollIntoView({block:'center'}));const box=await el.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+dx,box.y+box.height/2+dy,{steps:8});await page.mouse.up()}
try{
 page=await browser.newPage();page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(e.message));await page.setViewport({width:1440,height:1000});await page.goto(base,{waitUntil:'networkidle2'});await page.evaluate(u=>{localStorage.setItem('ehub_user',JSON.stringify(u));localStorage.setItem('ehub_language','ja')},user);await page.goto(base+'/profile',{waitUntil:'networkidle2'});await open();
 check(await count()===2,'initial template contains one name field and its accent');
 check(await page.$$eval('[data-card-element] text',els=>els.length)===1,'new card starts with one text field');
 await page.screenshot({path:out+'/initial-single-text.png'});
 await page.select('[aria-label="テンプレート"]','blank');check(await count()===0,'blank template');await click('[aria-label="元に戻す"]');check(await count()===2,'undo template');await click('[aria-label="やり直す"]');check(await count()===0,'redo template');
 await button('文字を追加');await fill('[aria-label="文字内容"]','自由にデザイン\nE-hub Business Card');await page.select('[aria-label="書体"]','serif');await fill('[aria-label="文字サイズ"]','40');await button('太字');await page.select('[aria-label="文字揃え"]','center');await fill('[aria-label="幅"]','700');await fill('[aria-label="高さ"]','140');await fill('[aria-label="X位置"]','80');await fill('[aria-label="Y位置"]','100');
 await drag('[data-card-element]',40,20);const movedX=await page.$eval('[aria-label="X位置"]',e=>Number(e.value));check(movedX>80,'drag moves text');await click('[aria-label="元に戻す"]');check(await page.$eval('[aria-label="X位置"]',e=>Number(e.value))===80,'one undo reverses full drag');await click('[aria-label="やり直す"]');
 const width=await page.$eval('[aria-label="幅"]',e=>Number(e.value));await drag('[data-testid="card-resize-handle"]',20,15);check(await page.$eval('[aria-label="幅"]',e=>Number(e.value))>width,'resize handle resizes text');
 await click('[aria-label="要素を複製"]');check(await count()===2,'duplicate layer');await click('[aria-label="要素を削除"]');check(await count()===1,'delete layer');await click('[aria-label="元に戻す"]');check(await count()===2,'undo deletion');await click('[aria-label="要素を削除"]');
 await button('図形');await button('四角を追加');await fill('[aria-label="回転角度"]','15');await button('名刺の中央に配置');await click('[aria-label="背面へ"]');const ids=await page.$$eval('[data-card-layer]',els=>els.map(e=>e.getAttribute('data-card-layer')));check(ids.length===2,'layer order usable');
 await button('図形');await button('円を追加');await fill('[aria-label="幅"]','90');await fill('[aria-label="高さ"]','90');await fill('[aria-label="X位置"]','700');
 await button('画像');await QRCode.toFile(out+'/logo.png','https://example.com',{width:180});await (await page.$('input[aria-label="デザイン画像"]')).uploadFile(out+'/logo.png');await page.waitForFunction(()=>document.querySelectorAll('[data-card-layer]').length===4);
 await button('ウラ面');check(await count()===0,'back starts empty');await button('文字');await button('文字を追加');await fill('[aria-label="文字内容"]','裏面のメッセージ');await button('グリッド');await button('ガイド');await click('[aria-label="拡大"]');check(await page.$eval('[aria-label="キャンバス操作"]',e=>e.textContent.includes('125%')),'zoom');await button('100%').catch(async()=>{await button('125%')});
 const saved=await save();check(saved.design.front.elements.length===4&&saved.design.back.elements.length===1,'both faces persisted');check(saved.design.front.elements.some(e=>e.kind==='image'&&e.src.startsWith('data:image/png')),'image design persisted');check(saved.design.front.elements[0].kind==='rect','layer order persisted');
 await page.waitForSelector('[data-testid="card-design-artwork"]');await button('裏面を表示');check(await page.$eval('[data-testid="card-design-artwork"]',e=>e.textContent.includes('裏面のメッセージ')),'profile renders back');await button('表面を表示');
 await page.reload({waitUntil:'networkidle2'});check(await page.$eval('[data-testid="card-design-artwork"]',e=>e.textContent.includes('自由にデザイン')),'custom card survives reload');await open();check(await count()===4,'reopening retains editable objects');await close();
 // Reject untrusted layout payloads, including external image URLs and invalid geometry.
 const broken=structuredClone(saved);broken.design.version=999;await api(`/api/users/${user.id}/business-card`,'PUT',broken,user.id,400);
 for(const patch of [{x:-1},{width:99999},{color:'url(https://example.com)'},{rotation:Infinity}]){const body=structuredClone(saved);Object.assign(body.design.front.elements[0],patch);await api(`/api/users/${user.id}/business-card`,'PUT',body,user.id,400)}
 const external=structuredClone(saved);external.design.front.elements.find(e=>e.kind==='image').src='https://example.com/track.png';await api(`/api/users/${user.id}/business-card`,'PUT',external,user.id,400);
 const duplicate=structuredClone(saved);duplicate.design.front.elements.push(duplicate.design.front.elements[0]);await api(`/api/users/${user.id}/business-card`,'PUT',duplicate,user.id,400);
 check((await api(`/api/users/${user.id}/business-card`,'GET',undefined,user.id)).card.design.front.elements.length===4,'invalid saves preserve previous design');
 // Follow QR exchange continues to return editable design to collected-card views.
 const contact=await api('/api/login/username','POST',{username:'Designer Contact'});const identity=await api('/api/business-cards/identity','POST',{},user.id);await api('/api/business-cards/collect','POST',{token:identity.token},contact.id);const collection=await api('/api/business-cards/collection','GET',null,contact.id);check(collection[0].design.front.elements.length===4,'collected-card list includes design');
 for(const [w,h] of [[320,568],[390,844],[640,568],[768,1024],[1024,768],[1440,900],[844,390]]){
  await page.setViewport({width:w,height:h});await open();
  check(await page.$eval('[role="dialog"]',el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight+1}),'dialog fits '+w);
  check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no horizontal page overflow '+w);
  for(const selector of ['[data-testid="card-design-canvas"]','[aria-label="名刺画面を閉じる"]','[aria-label="編集パネル"] button','[aria-label="表示パネル"] button','[role="dialog"] button[type="submit"]']){
   const el=await page.$(selector);await el.evaluate(e=>e.scrollIntoView({block:'center'}));const hit=await el.evaluate(e=>{const r=e.getBoundingClientRect();const n=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return r.left>=0&&r.right<=innerWidth+1&&!!n&&(n===e||e.contains(n))});check(hit,'control reachable '+selector+' '+w);
  }
  await page.$eval('[data-testid="card-designer"]',e=>e.scrollIntoView({block:'start'}));await page.screenshot({path:`${out}/${w}-designer.png`});
  // Even on narrow screens, layers can select and expose editable controls.
  await click('[data-card-layer]');await page.waitForSelector('[data-testid="card-element-controls"]');await close();
 }
 // Touch gestures use the same canvas coordinates and remain usable on mobile.
 await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true});await open();await button('ウラ面');await button('図形');await button('四角を追加');await fill('[aria-label="幅"]','100');await fill('[aria-label="高さ"]','80');
 const layerId=await page.$eval('[data-card-layer][aria-pressed="true"]',e=>e.getAttribute('data-card-layer'));const layer=await page.$(`[data-card-element="${layerId}"]`);await layer.evaluate(e=>e.scrollIntoView({block:'center'}));const box=await layer.boundingBox(),cdp=await page.createCDPSession();const x=box.x+box.width/2,y=box.y+box.height/2;
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+12,y:y+8,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});check(await page.$eval('[aria-label="X位置"]',e=>Number(e.value))>100,'touch moves layer on mobile');await cdp.detach();await close();
 check(!errors.length,'no runtime errors: '+errors.join(','));console.log(JSON.stringify({cardDesignerChecks:checks,screenshots:out}));
}finally{if(page)await page.screenshot({path:out+'/last.png'}).catch(()=>{});await browser.close()}
