import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

(async () => {
  console.log('Starting puppeteer...');
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
  
  const navItems = await page.$$('.nav-item');
  for (let i = 0; i < navItems.length; i++) {
    const item = navItems[i];
    const target = await page.evaluate(el => el.getAttribute('data-target'), item);
    await item.click();
    await new Promise(r => setTimeout(r, 200)); // wait for active class
    
    await page.screenshot({ path: `screenshot_${target}.png` });
    console.log(`Saved screenshot_${target}.png`);
  }
  
  await browser.close();
  console.log('Done.');
})();
