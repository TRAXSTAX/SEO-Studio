import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  let errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(`Console Error: ${msg.text()}`);
    }
  });
  page.on('pageerror', error => {
    errors.push(`Page Error: ${error.message}`);
  });

  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
  
  // Click every navigation item to ensure no errors on switch
  const navItems = await page.$$('.nav-item');
  for (const item of navItems) {
    await item.click();
  }

  if (errors.length > 0) {
    console.log('Errors found:');
    console.log(errors.join('\n'));
  } else {
    console.log('No console errors found. UI loaded cleanly.');
  }

  await browser.close();
})();
