import assert from 'node:assert/strict';
import fs from 'node:fs';
import puppeteer from 'puppeteer';
import {PNG} from 'pngjs';
const base=process.env.TEST_URL||'http://localhost:3101',out='/tmp/ehub-following-card-tabs';
fs.mkdirSync(out,{recursive:true});
let checks=0;
const check=(condition,message)=>{assert.ok(condition,message);checks++};
async function api(path,method='GET',body,id){const response=await fetch(base+path,{method,headers:{'content-type':'application/json',...(id?{'x-user-id':String(id)}:{})},...(body?{body:JSON.stringify(body)}:{})});assert.equal(response.status,200);return response.json()}
const owner=await api('/api/login/username','POST',{username:'Card tabs owner'}),normal=await api('/api/login/username','POST',{username:'Ordinary following'}),contact=await api('/api/login/username','POST',{username:'Collected contact'}),empty=await api('/api/login/username','POST',{username:'Empty collection'});
await api(`/api/users/${normal.id}/subscribe`,'POST',{subscriber_id:owner.id});
const identity=await api('/api/business-cards/identity','POST',{},contact.id);
await api('/api/business-cards/collect','POST',{token:identity.token},owner.id);
const browser=await puppeteer.launch({headless:true});let page;const errors=[];
async function click(selector){const el=await page.waitForSelector(selector,{visible:true});await el.evaluate(e=>e.scrollIntoView({block:'center'}));check(await el.evaluate(e=>{const r=e.getBoundingClientRect(),top=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return r.left>=0&&r.right<=innerWidth+1&&top&&(top===e||e.contains(top))}),'Control reachable: '+selector);await el.click()}
async function ready(){await page.waitForFunction(()=>document.getElementById('profile-user-list-panel')?.getAttribute('aria-busy')==='false')}
async function open(){await click('[data-testid="profile-following-button"]');await ready()}
async function modalBounds(){check(await page.$eval('[data-testid="profile-user-list-dialog"]',e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight+1}),'Dialog fits viewport');check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal overflow')}
async function makePage(user,width,height){if(page)await page.close();const context=await browser.createBrowserContext();page=await context.newPage();page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(e.message));await page.setViewport({width,height,deviceScaleFactor:1});await page.goto(base,{waitUntil:'networkidle2'});await page.evaluate(u=>{localStorage.setItem('ehub_user',JSON.stringify(u));localStorage.setItem('ehub_language','ja')},user);await page.goto(base+'/profile',{waitUntil:'networkidle2'})}
async function fixtureImage(portrait){return page.evaluate(portrait=>{const c=document.createElement('canvas');c.width=portrait?550:910;c.height=portrait?910:550;const x=c.getContext('2d');x.fillStyle='white';x.fillRect(0,0,c.width,c.height);x.fillStyle='#ef4444';x.fillRect(0,0,c.width,70);x.fillStyle='#2563eb';x.fillRect(0,c.height-70,c.width,70);x.fillStyle='#0f172a';x.font='38px sans-serif';x.fillText(portrait?'Portrait business card':'Landscape business card',25,c.height/2);return c.toDataURL('image/png')},portrait)}
try {
 for(const [width,height] of [[320,568],[390,844],[844,390],[1024,768],[1440,900]]){
  await makePage(owner,width,height);check(!await page.$('[aria-label="名刺"] button:has(svg.lucide-images)'),'Standalone collected-card button is removed');await open();
  check(await page.$$eval('[data-profile-list-user]',els=>els.length)===2,'Following contains normal and collected users');
  await click('#profile-list-tab-business-cards');await ready();await modalBounds();
  check(await page.$$eval('[data-profile-list-user]',els=>els.length)===1,'Collected tab contains only imported user');
  check(!!await page.$(`[data-profile-list-user="${contact.id}"]`),'Correct imported user ID');
  check(!await page.$(`[data-profile-list-user="${normal.id}"]`),'Ordinary following is excluded from imported tab');
  await page.screenshot({path:`${out}/${width}-collected-tab.png`});
  await click('#profile-list-tab-subscriptions');await ready();check(await page.$$eval('[data-profile-list-user]',els=>els.length)===2,'Switching back restores complete following list');
  await page.focus('#profile-list-tab-subscriptions');await page.keyboard.press('ArrowRight');await ready();check(await page.$eval('#profile-list-tab-business-cards',e=>e.getAttribute('aria-selected'))==='true','Keyboard switches tab');
  await click(`[data-profile-list-user="${contact.id}"]`);await page.waitForFunction(id=>location.pathname===`/profile/${id}`,{},contact.id);
  check(!await page.$('[data-testid="profile-user-list-dialog"]'),'Selecting imported user closes list');
  // On another user's profile, their collection must not be replaced by the viewer's collection.
  await open();check(!await page.$('#profile-list-tab-business-cards'),'Collection tab is private to own profile');await click('[aria-label="ユーザー一覧を閉じる"]');
  for(const portrait of [true,false]){
   const image=await fixtureImage(portrait);
   await api(`/api/users/${contact.id}/business-card`,'PUT',{name:'名刺の縦横確認',company:'Layout test',role:'',email:'',phone:'',website:'',style:'blue',source:'photo',image},contact.id);
   await page.reload({waitUntil:'networkidle2'});const el=await page.waitForSelector('[data-testid="business-card-photo"]',{visible:true});await el.evaluate(async e=>{await e.decode();e.scrollIntoView({block:'center'})});
   const r=await el.evaluate(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,nw:e.naturalWidth,nh:e.naturalHeight,fit:getComputedStyle(e).objectFit}});
   check((portrait?r.nh>r.nw:r.nw>r.nh)&&r.fit==='contain','Photo preserves source orientation and uses contain');
   check(r.x>=0&&r.x+r.width<=width+1&&r.y>=0&&r.y+r.height<=height+1,'Entire photo area fits screen');
   const screenshot=await page.screenshot({path:`${out}/${width}-${portrait?'portrait':'landscape'}.png`});const png=PNG.sync.read(screenshot);
   const scale=Math.min(r.width/r.nw,r.height/r.nh),contentHeight=r.nh*scale,top=r.y+(r.height-contentHeight)/2;
   const pixel=(x,y)=>{const i=(Math.floor(y)*png.width+Math.floor(x))*4;return [...png.data.subarray(i,i+3)]};
   const a=pixel(r.x+r.width/2,top+contentHeight*.03),b=pixel(r.x+r.width/2,top+contentHeight*.97);
   check(a[0]>180&&a[1]<130&&b[2]>150&&b[0]<100,'Top and bottom of photo are both visible, without cropping');
  }
  console.log('Following tabs and photo orientation passed',width,height);
 }
 await makePage(empty,390,844);await open();await click('#profile-list-tab-business-cards');await ready();check(await page.$eval('#profile-user-list-panel',e=>e.textContent.includes('取り込んだ名刺はまだありません')),'Empty collection has explicit message');await click('[aria-label="ユーザー一覧を閉じる"]');
 // Failed loads can be retried, and a slow following response cannot overwrite the collected tab.
 await makePage(owner,390,844);let failCollection=true,slowFollowing=false;
 await page.setRequestInterception(true);page.on('request',request=>{const path=new URL(request.url()).pathname;if(path==='/api/business-cards/collection'&&failCollection){request.respond({status:503,contentType:'application/json',body:'{}'});return}if(path===`/api/users/${owner.id}/subscriptions`&&slowFollowing){setTimeout(()=>{if(!request.isInterceptResolutionHandled())request.continue().catch(()=>{})},350);return}request.continue().catch(()=>{})});
 await open();await click('#profile-list-tab-business-cards');await ready();check(!!await page.$('#profile-user-list-panel [role="alert"]'),'Failed request displays error');failCollection=false;await click('#profile-user-list-panel [role="alert"] button');await page.waitForSelector('[data-profile-list-user]');await ready();check(await page.$$eval('[data-profile-list-user]',els=>els.length)===1,'Retry recovers collected list');
 slowFollowing=true;await click('#profile-list-tab-subscriptions');await click('#profile-list-tab-business-cards');await ready();await new Promise(r=>setTimeout(r,500));check(await page.$$eval('[data-profile-list-user]',els=>els.length)===1,'Slow previous request cannot overwrite active tab');
 check(!errors.length,'No browser runtime errors: '+errors.join(','));console.log(JSON.stringify({followingCardChecks:checks,screenshots:out}));
} finally {if(page)await page.screenshot({path:out+'/last.png'}).catch(()=>{});await browser.close()}
