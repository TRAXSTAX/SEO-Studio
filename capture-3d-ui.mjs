import puppeteer from 'puppeteer';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const screenshotPath = 'C:\\Users\\PC\\.gemini\\antigravity\\brain\\b88fad24-1ff0-4793-adc8-44e6d25ef8ad\\godlike_3d_ui_preview.jpg';

(async () => {
  console.log('Capturing 3D UI screenshot...');
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1000));

  await page.screenshot({ path: screenshotPath, type: 'jpeg', quality: 90 });
  console.log('Screenshot saved to:', screenshotPath);
  await browser.close();
})();
