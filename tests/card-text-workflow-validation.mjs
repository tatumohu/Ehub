import assert from 'node:assert/strict';
import fs from 'node:fs';
import puppeteer from 'puppeteer';

const base = process.env.TEST_URL || 'http://localhost:3101';
const out = '/tmp/ehub-card-text-workflow';
fs.mkdirSync(out, {recursive: true});
const browser = await puppeteer.launch({headless: true});
let page = await browser.newPage();
page.setDefaultTimeout(12000);
const errors = [], results = [];
page.on('pageerror', e => errors.push(e.message));
async function click(selector) {
  const el = await page.waitForSelector(selector, {visible: true});
  await el.evaluate(e => e.scrollIntoView({block: 'center'}));
  assert.ok(await el.evaluate(e => {
    const r = e.getBoundingClientRect(), top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return r.left >= 0 && r.right <= innerWidth + 1 && top && (top === e || e.contains(top));
  }), 'Control must fit and be clickable: ' + selector);
  await el.click();
}
async function button(text) {
  const buttons = await page.$$('button');
  for (const el of buttons) if ((await el.evaluate(e => e.textContent)).trim() === text) {
    await el.evaluate(e => e.scrollIntoView({block: 'center'})); await el.click(); return;
  }
  throw new Error('Missing button ' + text);
}
async function fill(selector, value) {
  await click(selector); await page.$eval(selector, e => e.select()); await page.keyboard.sendCharacter(value);
}
async function open() {
  await click('[aria-label="名刺を作成・登録"]');
  await button('名刺を作成');
  await page.waitForSelector('[data-testid="card-designer"]');
}
async function textCount() {return page.$$eval('[data-card-element] text', els => els.length);}
async function save(id) {
  await click('[role="dialog"] button[type="submit"]');
  await page.waitForFunction(() => !document.querySelector('[role="dialog"]'));
  const res = await fetch(`${base}/api/users/${id}/business-card`,{headers:{'x-user-id':String(id)}});
  assert.equal(res.status, 200);
  return (await res.json()).card.design;
}
async function layout() {
  assert.ok(await page.$eval('[role="dialog"]', e => {
    const r = e.getBoundingClientRect();
    return r.left >= 0 && r.right <= innerWidth + 1 && r.top >= 0 && r.bottom <= innerHeight + 1;
  }), 'Dialog fits screen');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'No horizontal overflow');
}
try {
  await page.goto(base, {waitUntil: 'networkidle2'});
  for (const [width, height, mobile] of [[320,568,true], [390,844,true], [844,390,true], [1024,768,false], [1440,900,false]]) {
    await page.close();
    const context = await browser.createBrowserContext();
    page = await context.newPage(); page.setDefaultTimeout(12000);
    page.on('pageerror', e => errors.push(e.message));
    await page.setViewport({width, height, isMobile: mobile, hasTouch: mobile});
    await page.goto(base, {waitUntil: 'networkidle2'});
    const res = await fetch(base + '/api/login/username', {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({username:`Text workflow ${width}`})});
    const user = await res.json();
    await page.evaluate(user => {localStorage.setItem('ehub_user',JSON.stringify(user)); localStorage.setItem('ehub_language','ja');}, user);
    await page.goto(base + '/profile', {waitUntil:'networkidle2'});
    await open(); await layout();
    assert.equal(await textCount(), 1, 'Initial card has exactly one text field');
    await page.screenshot({path:`${out}/${width}-initial.png`});
    await click('[data-card-layer="name"]');
    await fill('[aria-label="文字内容"]', '検証 氏名');
    // Company can start from basic information, then be edited independently on the canvas.
    await fill('input[name="company"]', '基本情報の会社');
    const fields = [['company','会社・所属','検証会社株式会社'], ['role','役職','プロダクト担当'], ['email','メールアドレス','qa@example.com'], ['phone','電話番号','090-1234-5678'], ['website','Webサイト','https://example.com']];
    for (const [key, label, value] of fields) {
      await page.select('[aria-label="追加する文字の種類"]', key);
      await button('文字を追加');
      if (key === 'company') assert.equal(await page.$eval('[aria-label="文字内容"]', e => e.value), '基本情報の会社', 'Company prefills from basic information');
      await fill('[aria-label="文字内容"]', value);
      assert.ok(await page.$eval('[data-card-layer][aria-pressed="true"]', (e, label) => e.textContent.includes(label), label), 'Layer retains field label after editing');
    }
    await page.select('[aria-label="追加する文字の種類"]', 'custom'); await button('文字を追加');
    await fill('[aria-label="文字内容"]', '削除対象の自由な文字');
    assert.equal(await textCount(), 7, 'All added fields are visible');
    await click('[aria-label="要素を削除"]');
    assert.equal(await textCount(), 6, 'Deletion removes only selected text');
    await layout();
    const saved = await save(user.id);
    assert.equal(saved.front.elements.filter(e => e.kind === 'text').length, 6);
    for (const [key, , value] of fields) assert.ok(saved.front.elements.some(e => e.field === key && e.text === value), 'Typed field persists: ' + key);
    assert.ok(!JSON.stringify(saved).includes('削除対象の自由な文字'), 'Deleted field is absent from storage');
    await page.reload({waitUntil:'networkidle2'});
    assert.ok(await page.$eval('[data-testid="card-design-artwork"]', e => e.textContent.includes('検証会社株式会社') && e.textContent.includes('検証 氏名')), 'Profile renders saved content after reload');
    await open(); assert.equal(await textCount(), 6, 'Reopen preserves fields');
    const company = saved.front.elements.find(e => e.field === 'company');
    await click(`[data-card-layer="${company.id}"]`);
    await fill('[aria-label="文字内容"]', '再編集後の会社');
    const role = saved.front.elements.find(e => e.field === 'role');
    await click(`[data-card-layer="${role.id}"]`); await click('[aria-label="要素を削除"]');
    const updated = await save(user.id);
    assert.ok(updated.front.elements.some(e => e.field === 'company' && e.text === '再編集後の会社'), 'Reedited text persists');
    assert.ok(!updated.front.elements.some(e => e.id === role.id), 'Deletion from saved card persists');
    await page.reload({waitUntil:'networkidle2'}); await open();
    assert.equal(await textCount(), 5, 'Reopening never recreates deleted fields');
    await click(`[data-card-layer="${company.id}"]`);
    assert.equal(await page.$eval('[aria-label="文字内容"]', e => e.value), '再編集後の会社');
    await layout();
    await page.$eval('[data-testid="card-designer"]', e => e.scrollIntoView({block:'start'}));
    await page.screenshot({path:`${out}/${width}-reedited.png`});
    await click('[aria-label="名刺画面を閉じる"]');
    results.push({width,height,mobile,initialOne:true,add:true,edit:true,delete:true,save:true,reedit:true});
    console.log('Text workflow passed',width,height);
  }
  assert.deepEqual(errors, [], 'No runtime errors');
  console.log(JSON.stringify({textWorkflows:results,screenshots:out}));
} finally {
  await page.screenshot({path:out+'/last.png'}).catch(()=>{});
  fs.writeFileSync(out+'/results.json',JSON.stringify({results,errors},null,2));
  await browser.close();
}
