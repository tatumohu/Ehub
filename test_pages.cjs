const puppeteer = require('puppeteer');

(async () => {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => {
    console.error('PAGE ERROR TRIGGERED:', error.message);
    console.error(error.stack);
  });

  console.log('Navigating to http://localhost:3000 as guest first...');
  await page.goto('http://localhost:3000');
  await new Promise(r => setTimeout(r, 2000));

  console.log('Navigating to other URLs to test...');
  const paths = ['/profile', '/search', '/memo', '/network', '/completed', '/purchase-history'];
  for (const path of paths) {
    console.log(`Navigating to http://localhost:3000${path}...`);
    try {
      await page.goto(`http://localhost:3000${path}`);
      await new Promise(r => setTimeout(r, 1000));
    } catch (e) {
      console.error(`Error navigating to ${path}:`, e.message);
    }
  }

  console.log('Now setting localStorage with valid user (ID 1)...');
  await page.goto('http://localhost:3000');
  await page.evaluate(() => {
    localStorage.setItem('ehub_user', JSON.stringify({
      id: 1,
      username: 'Alice',
      avatar: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Alice',
      account_type: 'individual',
      org_plan: 'basic',
      is_account_type_selected: 1
    }));
  });
  await page.reload();
  await new Promise(r => setTimeout(r, 2000));

  for (const path of paths) {
    console.log(`Navigating as Alice to http://localhost:3000${path}...`);
    try {
      await page.goto(`http://localhost:3000${path}`);
      await new Promise(r => setTimeout(r, 1000));
    } catch (e) {
      console.error(`Error navigating to ${path} as Alice:`, e.message);
    }
  }

  console.log('Closing browser...');
  await browser.close();
})();
