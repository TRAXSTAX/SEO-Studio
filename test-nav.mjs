import puppeteer from 'puppeteer';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));

(async () => {
  console.log('Launching puppeteer...');
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
  page.on('pageerror', error => console.error('BROWSER ERROR:', error.message));

  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });

  const navs = await page.$$('.nav-item');
  console.log(`Found ${navs.length} nav items.`);

  for (let i = 0; i < navs.length; i++) {
    const target = await navs[i].evaluate(el => el.getAttribute('data-target'));
    console.log(`\nClicking nav item: ${target}`);
    await navs[i].click();
    
    // Wait a bit
    await new Promise(r => setTimeout(r, 100));
    
    // Check if the section is visible and has active class
    const isActive = await page.evaluate(target => {
      const el = document.getElementById(target);
      return el ? el.classList.contains('active') : false;
    }, target);
    
    console.log(`${target} isActive: ${isActive}`);
  }

  await browser.close();
})();
