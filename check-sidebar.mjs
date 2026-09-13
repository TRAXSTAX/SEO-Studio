import puppeteer from 'puppeteer';

(async () => {
  console.log('Inspecting page layout in Puppeteer...');
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  page.on('pageerror', err => console.error('BROWSER ERROR:', err.message));

  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });

  const sidebarMetrics = await page.evaluate(() => {
    const sidebar = document.querySelector('.sidebar');
    const bgCanvas = document.querySelector('#bg-canvas');
    const container = document.querySelector('.app-container');
    const main = document.querySelector('main');
    
    if (!sidebar) return { found: false };
    
    const sRect = sidebar.getBoundingClientRect();
    const cStyle = window.getComputedStyle(sidebar);
    
    return {
      found: true,
      rect: { left: sRect.left, top: sRect.top, width: sRect.width, height: sRect.height },
      display: cStyle.display,
      visibility: cStyle.visibility,
      opacity: cStyle.opacity,
      zIndex: cStyle.zIndex,
      position: cStyle.position,
      left: cStyle.left,
      bgCanvasZIndex: bgCanvas ? window.getComputedStyle(bgCanvas).zIndex : null,
      containerDisplay: container ? window.getComputedStyle(container).display : null,
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight
    };
  });

  console.log('Sidebar metrics:', JSON.stringify(sidebarMetrics, null, 2));

  await browser.close();
})();
