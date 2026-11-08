import assert from 'node:assert/strict';
import fs from 'node:fs';
import puppeteer from 'puppeteer';
import jsQR from 'jsqr';
import {PNG} from 'pngjs';

const base=process.env.TEST_URL||'http://localhost:3101';
const out='/tmp/ehub-card-qr-exchange';fs.mkdirSync(out,{recursive:true});
const browser=await puppeteer.launch({headless:true});
const contexts=[],errors=[],results=[];let active;
async function api(path,id){const response=await fetch(base+path,{headers:id?{'x-user-id':String(id)}:{}});assert.equal(response.status,200);return response.json()}
async function click(page,selector){const el=await page.waitForSelector(selector,{visible:true});await el.evaluate(e=>e.scrollIntoView({block:'center'}));assert.ok(await el.evaluate(e=>{const r=e.getBoundingClientRect(),n=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return r.left>=0&&r.right<=innerWidth+1&&n&&(n===e||e.contains(n))}),'Control must be operable: '+selector);await el.click()}
async function button(page,text){for(const el of await page.$$('button'))if((await el.evaluate(e=>e.textContent)).trim()===text){await el.evaluate(e=>e.scrollIntoView({block:'center'}));await el.click();return}throw new Error('Button not found: '+text)}
async function fill(page,selector,value){await click(page,selector);await page.$eval(selector,e=>e.select());await page.keyboard.sendCharacter(value)}
async function makeUser(width,height,mobile,orientation){const context=await browser.createBrowserContext();contexts.push(context);const page=await context.newPage();active=page;await page.bringToFront();page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));page.on('console',message=>{if(message.type()==='error'&&/TypeError|ReferenceError/.test(message.text()))errors.push(message.text())});await page.setViewport({width,height,isMobile:mobile,hasTouch:mobile});
 await page.evaluateOnNewDocument(()=>{window.__stops=0;Object.defineProperty(navigator.mediaDevices,'getUserMedia',{configurable:true,value:async()=>{
  if(!window.__qrFrame)throw new DOMException('Test uses file input when no QR frame is configured','NotAllowedError');
  const img=new Image();img.src=window.__qrFrame;await img.decode();const canvas=document.createElement('canvas');canvas.width=img.width;canvas.height=img.height;canvas.getContext('2d').drawImage(img,0,0);const stream=canvas.captureStream(10);for(const t of stream.getTracks()){const stop=t.stop.bind(t);t.stop=()=>{window.__stops++;stop()}}return stream;
 }})});
 const r=await fetch(base+'/api/login/username',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username:`Exchange ${orientation} ${width}`})});assert.equal(r.status,200);const user=await r.json();
 await page.goto(base,{waitUntil:'networkidle2'});await page.evaluate(u=>{localStorage.setItem('ehub_user',JSON.stringify(u));localStorage.setItem('ehub_language','ja')},user);await page.goto(base+'/profile',{waitUntil:'networkidle2'});
 const name=(orientation==='portrait'?'縦型':'横型')+width;
 const fields={name,company:orientation==='portrait'?'縦型会社':'横型会社',role:'開発',email:`u${user.id}@e.test`,phone:'0312345678',website:'https://e.test'};
 await click(page,'[aria-label="名刺を作成・登録"]');await page.select('[aria-label="名刺の向き"]',orientation);await page.select('[aria-label="テンプレート"]','basic');
 for(const [key,value] of Object.entries(fields))await fill(page,`input[name="${key}"]`,value);
 for(const key of ['company','role','email','phone','website']){await page.select('[aria-label="追加する文字の種類"]',key);await button(page,'文字を追加');await fill(page,'[aria-label="文字サイズ"]','20')}
 await button(page,'ウラ面');await page.select('[aria-label="追加する文字の種類"]','custom');await button(page,'文字を追加');await fill(page,'[aria-label="文字内容"]',`${name}の裏面`);await button(page,'オモテ面');
 await click(page,'[role="dialog"] button[type="submit"]');await page.waitForFunction(()=>!document.querySelector('[role="dialog"]'));await page.waitForSelector('[data-testid="card-design-artwork"]');
 const card=(await api(`/api/users/${user.id}/business-card`,user.id)).card;assert.equal(card.design.orientation,orientation);assert.equal(card.design.front.elements.filter(e=>e.kind==='text').length,6);
 await click(page,'[aria-label="自分のQRコードを表示"]');const img=await page.waitForSelector('img[alt="自分の名刺QRコード"]');const qr=await img.evaluate(e=>e.src);const png=PNG.sync.read(Buffer.from(qr.split(',')[1],'base64'));const code=jsQR(new Uint8ClampedArray(png.data),png.width,png.height);assert.ok(code,'Application QR decodes');const link=new URL(code.data);assert.equal(link.origin,base);assert.equal(link.pathname,`/profile/${user.id}`);assert.ok(link.searchParams.get('card'));
 const file=`${out}/${width}-${orientation}-qr.png`;fs.writeFileSync(file,Buffer.from(qr.split(',')[1],'base64'));await click(page,'[aria-label="名刺画面を閉じる"]');return {page,user,fields,card,qr,file,orientation};
}
async function receive(receiver,sender,method){const page=receiver.page;active=page;await page.bringToFront();await page.goto(base+'/profile',{waitUntil:'networkidle2'});await page.evaluate(frame=>{window.__qrFrame=frame;window.__stops=0},method==='camera'?sender.qr:null);await click(page,'[aria-label="自分のQRコードを表示"]');await button(page,'相手のQRコードを読み取る');
 if(method==='file')await (await page.waitForSelector('input[aria-label="QRコードの画像"]')).uploadFile(sender.file);
 await page.waitForFunction(name=>document.querySelector('[role="dialog"] h2')?.textContent==='取り込んだ名刺'&&[...document.querySelectorAll('[role="dialog"] [data-testid="card-design-artwork"]')].some(e=>e.textContent.includes(name)),{},sender.fields.name).catch(e=>{throw new Error(`QR receive failed (${method}): ${errors.join('; ')||e.message}`)});
 for(const value of Object.values(sender.fields))assert.ok(await page.$eval('[role="dialog"] [data-testid="card-design-artwork"]',(e,value)=>e.textContent.includes(value),value),'Received preview includes '+value);
 if(method==='camera')assert.ok(await page.evaluate(()=>window.__stops>0),'Camera stream is stopped after receiving');
 await click(page,'[aria-label="名刺画面を閉じる"]');
}
async function importedProfile(receiver,sender,width,orientation=sender.orientation){const page=receiver.page;active=page;await page.bringToFront();await click(page,'[data-testid="profile-following-button"]');await page.waitForSelector(`[data-profile-list-user="${sender.user.id}"]`);await click(page,'#profile-list-tab-business-cards');await page.waitForFunction(id=>document.getElementById('profile-user-list-panel')?.getAttribute('aria-busy')==='false'&&!!document.querySelector(`[data-profile-list-user="${id}"]`),{},sender.user.id);assert.equal(await page.$$eval('[data-profile-list-user]',els=>els.length),1,'Exactly one imported user');
 await page.screenshot({path:`${out}/${width}-${sender.orientation}-imported-tab.png`});await click(page,`[data-profile-list-user="${sender.user.id}"]`);await page.waitForFunction(id=>location.pathname===`/profile/${id}`,{},sender.user.id);await page.waitForFunction(name=>document.querySelector('[data-testid="card-design-artwork"]')?.textContent.includes(name),{},sender.fields.name);
 assert.ok(!await page.$('[aria-label="名刺を作成・登録"]'),'Recipient cannot edit the contact card');
 const expected=orientation==='portrait'?'0 0 550 910':'0 0 910 550';assert.equal(await page.$eval('[data-testid="card-design-artwork"]',e=>e.getAttribute('viewBox')),expected);
 for(const value of Object.values(sender.fields))assert.ok(await page.$eval('[data-testid="card-design-artwork"]',(e,value)=>e.textContent.includes(value),value),'Contact front includes '+value);
 const paper=await page.$('[data-testid="card-design-artwork"]');await paper.evaluate(e=>e.scrollIntoView({block:'center'}));const size=await paper.evaluate(e=>{const r=e.getBoundingClientRect();return {w:r.width,h:r.height,x:r.x,y:r.y}});assert.ok(Math.abs(size.w/size.h-(orientation==='portrait'?55/91:91/55))<0.01,'Actual rendered orientation');assert.ok(size.x>=0&&size.x+size.w<=page.viewport().width+1&&size.y>=0&&size.y+size.h<=page.viewport().height+1,'Card fits viewport');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal overflow');
 await page.screenshot({path:`${out}/${width}-${sender.orientation}-contact-profile.png`});
 await button(page,'裏面を表示');assert.ok(await page.$eval('[data-testid="card-design-artwork"]',(e,name)=>e.textContent.includes(`${name}の裏面`),sender.fields.name),'Correct contact back');assert.equal(await page.$eval('[data-testid="card-design-artwork"]',e=>e.getAttribute('viewBox')),expected);await button(page,'表面を表示');
 await page.reload({waitUntil:'networkidle2'});await page.waitForFunction(name=>document.querySelector('[data-testid="card-design-artwork"]')?.textContent.includes(name),{},sender.fields.name);assert.equal(await page.$eval('[data-testid="card-design-artwork"]',e=>e.getAttribute('viewBox')),expected);
 const collection=await api('/api/business-cards/collection',receiver.user.id),following=await api(`/api/users/${receiver.user.id}/subscriptions`);assert.equal(collection.length,1);assert.equal(following.filter(u=>u.id===sender.user.id).length,1);assert.equal(collection[0].user_id,sender.user.id);assert.equal(collection[0].design.orientation,orientation);for(const key of ['name','company','role','email','phone','website'])assert.equal(collection[0][key],sender.fields[key],'Collection retains '+key);
}
try{
 const sizes=[[320,568,true],[390,844,true],[844,390,true],[1024,768,false],[1440,900,false]].slice(0,Number(process.env.QR_EXCHANGE_LIMIT)||5);
 for(const [width,height,mobile] of sizes){
  const portrait=await makeUser(width,height,mobile,'portrait'),landscape=await makeUser(width,height,mobile,'landscape');
  for(const [receiver,sender,method] of [[landscape,portrait,'file'],[portrait,landscape,'camera']]){
   await receive(receiver,sender,method);await importedProfile(receiver,sender,width);
   // Repeated QR exchange must not duplicate the user, card, or following relationship.
   await receive(receiver,sender,method);await importedProfile(receiver,sender,width);
   results.push({width,height,mobile,orientation:sender.orientation,qr:method,profile:true,frontAndBack:true,reload:true,noDuplicates:true});console.log('QR exchange passed',width,height,sender.orientation,method);
  }
  if(width===390||width===1440){
   const page=portrait.page;active=page;await page.bringToFront();await page.goto(base+'/profile',{waitUntil:'networkidle2'});await click(page,'[aria-label="名刺を作成・登録"]');await fill(page,'input[name="company"]','更新後の会社');await page.select('[aria-label="名刺の向き"]','landscape');await click(page,'[role="dialog"] button[type="submit"]');await page.waitForFunction(()=>!document.querySelector('[role="dialog"]'));portrait.fields.company='更新後の会社';
   await landscape.page.goto(base+'/profile',{waitUntil:'networkidle2'});await importedProfile(landscape,portrait,width,'landscape');
   console.log('Exchanged card update passed',width);
  }
  for(const item of [portrait,landscape])await item.page.browserContext().close();active=null;
 }
 assert.deepEqual(errors,[],'No browser errors');console.log(JSON.stringify({exchangeFlows:results.length,results,screenshots:out}));
}catch(e){console.error('Browser errors:',JSON.stringify(errors));throw e}
finally{if(active&&!active.isClosed())await active.screenshot({path:out+'/last.png'}).catch(()=>{});fs.writeFileSync(out+'/results.json',JSON.stringify({results,errors},null,2));await browser.close()}
