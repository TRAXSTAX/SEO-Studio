import puppeteer from 'puppeteer';

(async () => {
  console.log('=== STARTING END-TO-END PUPPETEER AUDIT ===');
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  let consoleErrors = 0;
  let pageErrors = 0;

  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.error('🔴 BROWSER CONSOLE ERROR:', msg.text());
      consoleErrors++;
    }
  });

  page.on('pageerror', error => {
    console.error('🔴 UNHANDLED PAGE ERROR:', error.message);
    pageErrors++;
  });

  console.log('Navigating to http://localhost:3000...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });

  // 1. SERP Snippet Previewer test
  console.log('\nTesting SERP Snippet Previewer...');
  const serpNav = await page.$('[data-target="serp-previewer"]');
  if (serpNav) {
    await serpNav.click();
    await page.type('#serp-title', 'Best SEO Software Tool Suite 2026');
    await page.type('#serp-desc', 'Full feature 23-in-1 enterprise technical SEO tools suite built with Node.js and modern glassmorphism design.');
    const renderTitle = await page.$eval('#serp-render-title', el => el.textContent);
    console.log('✓ SERP Preview Render Title:', renderTitle);
  }

  // 2. Meta Optimizer test
  console.log('\nTesting Meta Tag Optimizer...');
  const metaNav = await page.$('[data-target="meta-optimizer"]');
  if (metaNav) {
    await metaNav.click();
    await page.type('#meta-keyword', 'seo tools');
    await page.click('#meta-btn');
    await new Promise(r => setTimeout(r, 200));
    const metaResults = await page.$eval('#meta-results', el => el.children.length);
    console.log(`✓ Meta Optimizer generated ${metaResults} variations`);
  }

  // 3. Schema Generator test
  console.log('\nTesting Schema Generator...');
  const schemaNav = await page.$('[data-target="schema-generator"]');
  if (schemaNav) {
    await schemaNav.click();
    await page.click('#schema-btn');
    await new Promise(r => setTimeout(r, 200));
    const schemaCode = await page.$eval('#schema-output', el => el.textContent);
    console.log('✓ Schema Generator Code Output length:', schemaCode.length);
  }

  // 4. Keyword Discovery test
  console.log('\nTesting Keyword Discovery...');
  const kwNav = await page.$('[data-target="keyword-discovery"]');
  if (kwNav) {
    await kwNav.click();
    await page.type('#kw-discovery-seed', 'running shoes');
    await page.click('#kw-discovery-btn');
    // Wait for SSE completion or progress
    await new Promise(r => setTimeout(r, 3000));
    const kwStatus = await page.$eval('#kw-discovery-status', el => el.textContent);
    console.log('✓ Keyword Discovery Status:', kwStatus);
  }

  // 5. Keyword Clustering test
  console.log('\nTesting Keyword Clustering...');
  const clusterNav = await page.$('[data-target="keyword-clustering"]');
  if (clusterNav) {
    await clusterNav.click();
    await page.type('#kw-cluster-text', 'best running shoes\ntop running shoes\nmarathon training guide');
    await page.click('#kw-cluster-btn');
    await new Promise(r => setTimeout(r, 500));
    const clusterCount = await page.$eval('#kw-cluster-count', el => el.textContent);
    console.log(`✓ Keyword Clusterer found ${clusterCount} clusters`);
  }

  // 6. Robots.txt Analyzer test
  console.log('\nTesting Robots.txt Analyzer...');
  const robotsNav = await page.$('[data-target="robots-analyzer"]');
  if (robotsNav) {
    await robotsNav.click();
    await page.type('#robots-url', 'https://example.com');
    await page.click('#robots-btn');
    await new Promise(r => setTimeout(r, 1500));
    const robotsStatus = await page.$eval('#robots-status', el => el.textContent);
    console.log('✓ Robots Analyzer Status:', robotsStatus);
  }

  // 7. Sitemap Tool test
  console.log('\nTesting Sitemap Generator...');
  const sitemapNav = await page.$('[data-target="sitemap-tool"]');
  if (sitemapNav) {
    await sitemapNav.click();
    await page.type('#sitemap-gen-urls', 'https://example.com\nhttps://example.com/about');
    await page.click('#sitemap-gen-btn');
    await new Promise(r => setTimeout(r, 500));
    const xmlVal = await page.$eval('#sitemap-xml-output', el => el.value);
    console.log('✓ Sitemap Generator XML output contains urlset:', xmlVal.includes('urlset'));
  }

  await browser.close();

  console.log('\n========================================');
  console.log(`E2E Audit Complete: ${consoleErrors} Console Errors, ${pageErrors} Page Errors.`);
  console.log('========================================');

  if (consoleErrors > 0 || pageErrors > 0) {
    process.exit(1);
  }
})();
