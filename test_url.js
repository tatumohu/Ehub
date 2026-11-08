import puppeteer from 'puppeteer';
(async () => {
    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
    page.on('requestfailed', request => console.log('REQUEST FAILED:', request.url(), request.failure()?.errorText || ''));
    try {
      await page.goto("https://ais-dev-f73gi237zqag5cwufyazgg-226222392878.asia-east1.run.app", { waitUntil: 'networkidle2' });
      await new Promise(r => setTimeout(r, 2000));
      const html = await page.content();
      console.log('PAGE HTML:', html);
    } catch(e) {
      console.error(e.message);
    }
    await browser.close();
})();
