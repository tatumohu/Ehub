const puppeteer = require('puppeteer');

(async () => {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  page.on('console', msg => {
    console.log('PAGE LOG:', msg.text());
  });
  page.on('pageerror', error => {
    console.error('CRITICAL PAGE ERROR:', error.message);
    console.error(error.stack);
  });

  console.log('Navigating to http://localhost:3000 as guest...');
  try {
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
  } catch (e) {
    console.error('Navigation error:', e.message);
  }
  
  console.log('Waiting 5 seconds for any async or rendering errors...');
  await new Promise(r => setTimeout(r, 5000));

  console.log('Closing browser...');
  await browser.close();
})();
