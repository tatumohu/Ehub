const puppeteer = require('puppeteer');

(async () => {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.error('CRITICAL PAGE ERROR:', error.message));

  console.log('Navigating...');
  try {
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
    const content = await page.content();
    console.log('Final verification - Page content length:', content.length);
  } catch (e) {
    console.error('Error:', e.message);
  }

  await browser.close();
})();
