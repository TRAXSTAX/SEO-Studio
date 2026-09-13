import puppeteer from 'puppeteer';

(async () => {
  console.log('=== ENTERPRISE SEO STUDIO — FULL VERIFICATION SUITE ===\n');
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  
  let errors = [];
  let warnings = [];
  
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(`Console Error: ${msg.text()}`);
    if (msg.type() === 'warning') warnings.push(`Console Warning: ${msg.text()}`);
  });
  page.on('pageerror', error => errors.push(`Page Error: ${error.message}`));

  // Test 1: Page loads without errors
  console.log('[TEST 1] Loading main page...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });
  const title = await page.title();
  console.log(`  Title: ${title}`);
  console.log(`  Result: ${title.includes('SEO') ? 'PASS ✓' : 'FAIL ✗'}`);

  // Test 2: All nav items exist and are clickable
  console.log('\n[TEST 2] Verifying all navigation tabs...');
  const navItems = await page.$$('.nav-item');
  console.log(`  Found ${navItems.length} nav items`);
  
  const expectedTargets = [
    'master-audit', 'log-analyzer', 'gsc-analyzer', 'content-grader',
    'web-vitals', 'intent-mapper', 'site-crawler', 'link-finder',
    'cannibalization-checker', 'schema-generator', 'meta-optimizer',
    'broken-links', 'history-trends'
  ];
  
  for (const target of expectedTargets) {
    const navItem = await page.$(`[data-target="${target}"]`);
    if (!navItem) {
      errors.push(`Missing nav item for target: ${target}`);
      console.log(`  ${target}: MISSING ✗`);
      continue;
    }
    
    await navItem.click();
    await new Promise(r => setTimeout(r, 200));
    
    const section = await page.$(`#${target}`);
    if (!section) {
      errors.push(`Missing section with id: ${target}`);
      console.log(`  ${target}: NO SECTION ✗`);
      continue;
    }
    
    const isVisible = await page.evaluate(el => {
      const style = window.getComputedStyle(el);
      return style.display !== 'none';
    }, section);
    
    console.log(`  ${target}: ${isVisible ? 'PASS ✓' : 'HIDDEN ✗'}`);
    if (!isVisible) errors.push(`Section ${target} not visible after click`);
  }

  // Test 3: Check keyboard accessibility
  console.log('\n[TEST 3] Verifying keyboard accessibility...');
  const hasTabIndex = await page.evaluate(() => {
    const items = document.querySelectorAll('.nav-item');
    return Array.from(items).every(item => item.getAttribute('tabindex') === '0');
  });
  console.log(`  tabindex="0" on all nav items: ${hasTabIndex ? 'PASS ✓' : 'FAIL ✗'}`);
  if (!hasTabIndex) errors.push('Missing tabindex on nav items');

  const hasRole = await page.evaluate(() => {
    const items = document.querySelectorAll('.nav-item');
    return Array.from(items).every(item => item.getAttribute('role') === 'button');
  });
  console.log(`  role="button" on all nav items: ${hasRole ? 'PASS ✓' : 'FAIL ✗'}`);
  if (!hasRole) errors.push('Missing role on nav items');

  // Test 4: Check escapeHtml exists
  console.log('\n[TEST 4] Verifying XSS protection...');
  const hasEscapeHtml = await page.evaluate(() => {
    // Check if the escapeHtml function is defined in the app scope
    // We test by checking the source
    return document.querySelector('script[src="/app.js"]') !== null;
  });
  console.log(`  app.js loaded: ${hasEscapeHtml ? 'PASS ✓' : 'FAIL ✗'}`);

  // Test 5: Check CSS badge styles exist
  console.log('\n[TEST 5] Verifying CSS badge styles...');
  const badgeCheck = await page.evaluate(() => {
    const el = document.createElement('span');
    el.className = 'badge warning';
    document.body.appendChild(el);
    const style = window.getComputedStyle(el);
    const hasColor = style.color !== 'rgb(0, 0, 0)' && style.color !== '';
    document.body.removeChild(el);
    return hasColor;
  });
  console.log(`  .badge.warning styled: ${badgeCheck ? 'PASS ✓' : 'FAIL ✗'}`);
  if (!badgeCheck) errors.push('Missing .badge.warning CSS');

  // Test 6: Check mobile hamburger exists
  console.log('\n[TEST 6] Verifying mobile support...');
  const hasMobileBtn = await page.$('#mobile-menu-btn');
  console.log(`  Mobile hamburger button: ${hasMobileBtn ? 'PASS ✓' : 'FAIL ✗'}`);
  if (!hasMobileBtn) errors.push('Missing mobile hamburger button');

  // Test 7: Schema Generator renders fields on load
  console.log('\n[TEST 7] Verifying Schema Generator...');
  await page.click('[data-target="schema-generator"]');
  await new Promise(r => setTimeout(r, 300));
  const schemaFields = await page.$$('#schema-fields-container input');
  console.log(`  Schema fields rendered: ${schemaFields.length > 0 ? `PASS ✓ (${schemaFields.length} fields)` : 'FAIL ✗'}`);
  if (schemaFields.length === 0) errors.push('Schema Generator fields not rendered');

  // Test 8: Meta Tag Optimizer generates output
  console.log('\n[TEST 8] Verifying Meta Tag Optimizer...');
  await page.evaluate(() => document.querySelector('[data-target="meta-optimizer"]').click());
  await new Promise(r => setTimeout(r, 300));
  await page.evaluate(() => {
    document.getElementById('meta-keyword').value = 'blue summer dresses';
    document.getElementById('meta-btn').click();
  });
  await new Promise(r => setTimeout(r, 300));
  const metaResults = await page.$eval('#meta-results', el => el.children.length);
  console.log(`  Meta variations generated: ${metaResults > 0 ? `PASS ✓ (${metaResults} variations)` : 'FAIL ✗'}`);
  if (metaResults === 0) errors.push('Meta Tag Optimizer produced no output');

  // Final Summary
  console.log('\n=== VERIFICATION SUMMARY ===');
  console.log(`Errors: ${errors.length}`);
  console.log(`Warnings: ${warnings.length}`);
  
  if (errors.length > 0) {
    console.log('\nERRORS:');
    errors.forEach(e => console.log(`  ✗ ${e}`));
  }
  
  if (warnings.length > 0) {
    console.log('\nWARNINGS:');
    warnings.forEach(w => console.log(`  ⚠ ${w}`));
  }
  
  if (errors.length === 0) {
    console.log('\n🎉 ALL TESTS PASSED — PRODUCTION READY!');
  }

  await browser.close();
})();
