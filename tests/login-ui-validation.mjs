import puppeteer from 'puppeteer';
import assert from 'node:assert/strict';
const base=process.env.TEST_URL||'http://localhost:3101';
const browser=await puppeteer.launch({headless:true});
try{
 const page=await browser.newPage();page.setDefaultTimeout(10000);console.log('Login test: opening screen');await page.setViewport({width:1280,height:900});
 await page.goto(base,{waitUntil:'networkidle2'});
 await page.locator('[data-testid="open-login"]').click();
 await page.waitForSelector('input[placeholder="Enter your username"]');
 console.log('Login test: modal opened');
 const name='QA-UI-Login-'+Date.now();
 await page.locator('input[placeholder="Enter your username"]').fill(name);
 await page.locator('[data-testid="login-form"] button[type="submit"]').click();
 await page.waitForSelector(`img[alt="${name}"]`);
 await page.waitForSelector('[data-testid="login-form"]',{hidden:true});
 console.log('Login test: submitted');
 await page.reload({waitUntil:'networkidle2'});await page.waitForSelector(`img[alt="${name}"]`);
 console.log('Login test: persistence verified');
 const context=await browser.createBrowserContext();const offline=await context.newPage();
 await offline.goto(base,{waitUntil:'networkidle2'});
 await offline.locator('[data-testid="open-login"]').click();
 await offline.locator('input[placeholder="Enter your username"]').fill('QA-offline');
 await offline.setRequestInterception(true);
 offline.on('request',req=>req.url().endsWith('/api/login/username')?req.abort('failed'):req.continue());
 await offline.locator('[data-testid="login-form"] button[type="submit"]').click();await offline.waitForSelector('[role="alert"]');
 assert.match(await offline.$eval('[role="alert"]',el=>el.textContent),/Cannot connect/);
 assert.equal(await offline.$eval('[data-testid="login-form"] button[type="submit"]',el=>el.disabled),false);
 console.log('Login UI: sign-in button, submit, persistence and connection-error feedback PASS');
}finally{await browser.close()}
