const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  page.on('console', msg => console.log('LOG:', msg.text()));
  await page.evaluate(() => {
    try {
      document.createElement("div<");
    } catch (e) {
      console.log('Error 5:', e.message);
    }
  });
  await browser.close();
})();
