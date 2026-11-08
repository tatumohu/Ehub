import puppeteer from 'puppeteer';import assert from 'node:assert/strict';
const base=process.env.TEST_URL||'http://localhost:3000';const browser=await puppeteer.launch({headless:true});
try{const page=await browser.newPage();await page.setViewport({width:320,height:568});await page.setRequestInterception(true);
page.on('request',request=>{const u=new URL(request.url());if(u.origin===new URL(base).origin&&['/api/projects','/api/ideas'].includes(u.pathname)&&request.method()==='GET'){
const posts=u.pathname==='/api/ideas'?[]:[200,500].map((length,i)=>({id:i+1,title:'Text expansion',description:'あ'.repeat(length),author_id:1,author_name:'Reader',created_at:'2026-11-08T00:00:00Z',is_private:0,is_recruitment:0}));request.respond({status:200,contentType:'application/json',body:JSON.stringify(posts)});
}else request.continue()});await page.goto(base+'/vision',{waitUntil:'networkidle2'});await page.waitForSelector('[data-testid="vision-post"]');
const posts=await page.$$('[data-testid="vision-post"]');
for(const post of posts){const link=await post.$('a.whitespace-pre-wrap');const length=await link.evaluate(el=>el.textContent.length);const clamp=await link.evaluate(el=>getComputedStyle(el).webkitLineClamp);assert.equal(clamp,length===200?'none':'6');}
await page.locator('button ::-p-text(Read more)').click();
await page.waitForFunction(()=>[...document.querySelectorAll('[data-testid="vision-post"] a.whitespace-pre-wrap')].every(el=>getComputedStyle(el).webkitLineClamp==='none'));

console.log('Vision text: medium text fully visible and long text expandable PASS');
}finally{await browser.close()}
