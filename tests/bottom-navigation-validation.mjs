import puppeteer from 'puppeteer';import assert from 'node:assert/strict';
const base=process.env.TEST_URL||'http://localhost:3101';const browser=await puppeteer.launch({headless:true});
try{const page=await browser.newPage();await page.goto(base,{waitUntil:'networkidle2'});
for(const [width,height] of [[320,568],[390,844],[640,568],[672,568],[680,420],[768,1024],[1024,768],[1440,900],[844,390],[320,360]]){
 await page.setViewport({width,height});
 const links=await page.$$eval('[data-testid="primary-navigation"] a',nodes=>nodes.map(el=>{const r=el.getBoundingClientRect();return {label:el.textContent.trim(),left:r.left,right:r.right,bottom:r.bottom,href:el.getAttribute('href')}}));
 assert.deepEqual(links.map(l=>l.label),['Vision','Project','Chat','Store','Profile']);assert.ok(links.every(l=>l.left>=0&&l.right<=width&&l.bottom<=height));assert.equal(await page.$('[data-bottom-popover]'),null);
}
for(const route of ['/projects','/chat','/store','/profile','/vision']){
 await page.locator(`[data-testid="primary-navigation"] a[href="${route}"]`).click();await page.waitForFunction(path=>location.pathname===path,{},route);assert.equal(await page.$('[data-bottom-popover]'),null);
}
console.log('Five direct footer links, 10 viewport sizes and navigation: PASS');
}finally{await browser.close()}
