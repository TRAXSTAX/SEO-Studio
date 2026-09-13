import puppeteer from 'puppeteer';

const BASE_URL = 'http://localhost:3000';
const SITEMAP_URL = `${BASE_URL}/sitemap.xml`;
const TEST_PAGE_URL = `${BASE_URL}/index.html`;

// Helper to read SSE streams
async function readSSEStream(res) {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let done = false;
  let rawText = '';
  const events = [];

  while (!done) {
    const { value, done: readerDone } = await reader.read();
    done = readerDone;
    if (value) {
      const chunk = decoder.decode(value, { stream: true });
      rawText += chunk;
      const lines = chunk.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            events.push(JSON.parse(line.substring(6)));
          } catch (e) {
            // Raw text fallback
          }
        }
      }
    }
  }
  return { rawText, events };
}

// Result reporter
const results = {
  apiTests: [],
  dbVerifications: [],
  puppeteerTest: { passed: false, errors: [], navCount: 0 }
};

function recordApiTest(name, endpoint, passed, details = '') {
  results.apiTests.push({ name, endpoint, passed, details });
  console.log(`[API] ${passed ? '✓ PASS' : '✗ FAIL'} - ${name} (${endpoint}) ${details ? `- ${details}` : ''}`);
}

function recordDbVerification(name, passed, details = '') {
  results.dbVerifications.push({ name, passed, details });
  console.log(`[DB]  ${passed ? '✓ PASS' : '✗ FAIL'} - ${name} ${details ? `- ${details}` : ''}`);
}

console.log('===============================================================');
console.log('  ENTERPRISE SEO STUDIO — PRODUCTION END-TO-END TEST RUNNER');
console.log('===============================================================\n');

// -------------------------------------------------------------------
// 1. BACKEND API & DATABASE TRANSACTION SUITE (Native Fetch)
// -------------------------------------------------------------------
console.log('--- SECTION 1: API ENDPOINTS & DATABASE TRANSACTIONS ---\n');

try {
  // 1. Log Analyzer Upload
  try {
    const logData = `127.0.0.1 - - [10/May/2026:13:55:36 +0000] "GET /index.html HTTP/1.1" 200 2326 "-" "Googlebot/2.1 (+http://www.google.com/bot.html)"\n`;
    const formData = new FormData();
    formData.append('logfile', new Blob([logData], { type: 'text/plain' }), 'test.log');
    const res = await fetch(`${BASE_URL}/api/logs/upload`, { method: 'POST', body: formData });
    const { events } = await readSSEStream(res);
    const completeEvt = events.find(e => e.type === 'complete');
    if (completeEvt && completeEvt.data.totalLines > 0) {
      recordApiTest('Log Analyzer Upload', '/api/logs/upload', true, `Parsed ${completeEvt.data.totalLines} lines`);
    } else {
      recordApiTest('Log Analyzer Upload', '/api/logs/upload', false, 'Missing complete event');
    }
  } catch (err) {
    recordApiTest('Log Analyzer Upload', '/api/logs/upload', false, err.message);
  }

  // 2. GSC Analyzer Upload
  try {
    const csvData = `Top queries,Clicks,Impressions,CTR,Position\nseo tools,50,500,10%,2.5\nbest seo software,12,300,4%,12.1\n`;
    const formData = new FormData();
    formData.append('csvfile', new Blob([csvData], { type: 'text/csv' }), 'gsc.csv');
    const res = await fetch(`${BASE_URL}/api/gsc/upload`, { method: 'POST', body: formData });
    if (res.ok) {
      const data = await res.json();
      recordApiTest('GSC Analyzer Upload', '/api/gsc/upload', true, `Processed ${data.totalRows} queries`);
    } else {
      recordApiTest('GSC Analyzer Upload', '/api/gsc/upload', false, `HTTP ${res.status}`);
    }
  } catch (err) {
    recordApiTest('GSC Analyzer Upload', '/api/gsc/upload', false, err.message);
  }

  // 3. Content Grader
  try {
    const res = await fetch(`${BASE_URL}/api/grader/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keyword: 'seo automation', draft: 'A complete guide to automating SEO tasks and content grader analysis.' })
    });
    const { events } = await readSSEStream(res);
    const completeEvt = events.find(e => e.type === 'complete');
    if (completeEvt && typeof completeEvt.data.score === 'number') {
      recordApiTest('Content Grader', '/api/grader/analyze', true, `Grade: ${completeEvt.data.grade}, Score: ${completeEvt.data.score}`);
    } else {
      recordApiTest('Content Grader', '/api/grader/analyze', false, 'No score returned');
    }
  } catch (err) {
    recordApiTest('Content Grader', '/api/grader/analyze', false, err.message);
  }

  // 4. Core Web Vitals
  try {
    const res = await fetch(`${BASE_URL}/api/vitals/audit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: TEST_PAGE_URL })
    });
    const { events } = await readSSEStream(res);
    const completeEvt = events.find(e => e.type === 'complete');
    if (completeEvt && typeof completeEvt.data.score === 'number') {
      recordApiTest('Web Vitals Audit', '/api/vitals/audit', true, `Score: ${completeEvt.data.score}`);
    } else {
      recordApiTest('Web Vitals Audit', '/api/vitals/audit', false, 'No complete event');
    }
  } catch (err) {
    recordApiTest('Web Vitals Audit', '/api/vitals/audit', false, err.message);
  }

  // 5. Intent Mapper
  try {
    const res = await fetch(`${BASE_URL}/api/intent/map`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keywords: ['buy shoes online', 'how to rank on google'] })
    });
    const { events } = await readSSEStream(res);
    const completeEvt = events.find(e => e.type === 'complete');
    if (completeEvt && completeEvt.data.total === 2) {
      recordApiTest('Intent Mapper', '/api/intent/map', true, `Mapped ${completeEvt.data.total} keywords`);
    } else {
      recordApiTest('Intent Mapper', '/api/intent/map', false, 'Unexpected response structure');
    }
  } catch (err) {
    recordApiTest('Intent Mapper', '/api/intent/map', false, err.message);
  }

  // 6. Site Crawler
  try {
    const res = await fetch(`${BASE_URL}/api/crawler/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: TEST_PAGE_URL, maxPages: 2 })
    });
    const { events } = await readSSEStream(res);
    const completeEvt = events.find(e => e.type === 'complete');
    if (completeEvt) {
      recordApiTest('Site Crawler', '/api/crawler/start', true, `Crawled ${completeEvt.data.totalCrawled} pages`);
    } else {
      recordApiTest('Site Crawler', '/api/crawler/start', false, 'No complete event');
    }
  } catch (err) {
    recordApiTest('Site Crawler', '/api/crawler/start', false, err.message);
  }

  // 7. Master Audit (Single) — Writes DB Transaction
  const testAuditUrl = `${BASE_URL}/index.html`;
  const testAuditKw = 'Enterprise SEO';
  try {
    const res = await fetch(`${BASE_URL}/api/master/audit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: testAuditUrl, keyword: testAuditKw })
    });
    const { events } = await readSSEStream(res);
    const completeEvt = events.find(e => e.type === 'complete');
    if (completeEvt && typeof completeEvt.data.overallScore === 'number') {
      recordApiTest('Master Audit Single', '/api/master/audit', true, `Overall Score: ${completeEvt.data.overallScore}`);
    } else {
      recordApiTest('Master Audit Single', '/api/master/audit', false, 'Failed to complete master audit');
    }
  } catch (err) {
    recordApiTest('Master Audit Single', '/api/master/audit', false, err.message);
  }

  // 8. Master Audit (Batch)
  try {
    const res = await fetch(`${BASE_URL}/api/master/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sitemapUrl: SITEMAP_URL, keyword: 'seo audit' })
    });
    const { events } = await readSSEStream(res);
    const completeEvt = events.find(e => e.type === 'complete');
    if (completeEvt && Array.isArray(completeEvt.data)) {
      recordApiTest('Master Audit Batch', '/api/master/batch', true, `Batch audited ${completeEvt.data.length} URLs`);
    } else {
      recordApiTest('Master Audit Batch', '/api/master/batch', false, 'Batch audit failed');
    }
  } catch (err) {
    recordApiTest('Master Audit Batch', '/api/master/batch', false, err.message);
  }

  // 9. Internal Link Finder
  try {
    const res = await fetch(`${BASE_URL}/api/links/find`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sitemapUrl: SITEMAP_URL, targetUrl: TEST_PAGE_URL, keyword: 'seo' })
    });
    const { events } = await readSSEStream(res);
    const completeEvt = events.find(e => e.type === 'complete');
    if (completeEvt && typeof completeEvt.data.scanned === 'number') {
      recordApiTest('Internal Link Finder', '/api/links/find', true, `Scanned ${completeEvt.data.scanned} pages, ${completeEvt.data.opportunities} opportunities`);
    } else {
      recordApiTest('Internal Link Finder', '/api/links/find', false, 'Link finder failed');
    }
  } catch (err) {
    recordApiTest('Internal Link Finder', '/api/links/find', false, err.message);
  }

  // 10. Cannibalization Checker
  try {
    const res = await fetch(`${BASE_URL}/api/cannibalization/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sitemapUrl: SITEMAP_URL })
    });
    const { events } = await readSSEStream(res);
    const completeEvt = events.find(e => e.type === 'complete');
    if (completeEvt && typeof completeEvt.data.scanned === 'number') {
      recordApiTest('Cannibalization Checker', '/api/cannibalization/check', true, `Conflicts found: ${completeEvt.data.conflictsFound}`);
    } else {
      recordApiTest('Cannibalization Checker', '/api/cannibalization/check', false, 'Cannibalization check failed');
    }
  } catch (err) {
    recordApiTest('Cannibalization Checker', '/api/cannibalization/check', false, err.message);
  }

  // 11. Broken Links Scanner
  try {
    const res = await fetch(`${BASE_URL}/api/links/broken`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: TEST_PAGE_URL })
    });
    const { events } = await readSSEStream(res);
    const completeEvt = events.find(e => e.type === 'complete');
    if (completeEvt) {
      recordApiTest('Broken Links Scanner', '/api/links/broken', true, `Audited page links: ${completeEvt.data.scannedUrl || TEST_PAGE_URL}`);
    } else {
      recordApiTest('Broken Links Scanner', '/api/links/broken', false, 'Broken links scan failed');
    }
  } catch (err) {
    recordApiTest('Broken Links Scanner', '/api/links/broken', false, err.message);
  }

  // 12. History API — Verification of DB Transaction from Master Audit
  try {
    const res = await fetch(`${BASE_URL}/api/history?url=${encodeURIComponent(testAuditUrl)}`);
    if (res.ok) {
      const history = await res.json();
      recordApiTest('Audit History GET', '/api/history', true, `Retrieved ${history.length} records`);
      const matched = history.find(h => h.url === testAuditUrl && h.keyword === testAuditKw);
      if (matched) {
        recordDbVerification('Audit DB Transaction Save & Retrieve', true, `Verified audit record id #${matched.id} saved to SQLite DB (Overall score: ${matched.overall_score})`);
      } else {
        recordDbVerification('Audit DB Transaction Save & Retrieve', false, `Record for ${testAuditUrl} not found in DB`);
      }
    } else {
      recordApiTest('Audit History GET', '/api/history', false, `HTTP ${res.status}`);
      recordDbVerification('Audit DB Transaction Save & Retrieve', false, 'HTTP error on history endpoint');
    }
  } catch (err) {
    recordApiTest('Audit History GET', '/api/history', false, err.message);
    recordDbVerification('Audit DB Transaction Save & Retrieve', false, err.message);
  }

  // 13. Export PDF
  try {
    const res = await fetch(`${BASE_URL}/api/export-pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ htmlContent: '<h1>SEO Audit Test Report</h1><p>Production verification content.</p>' })
    });
    const contentType = res.headers.get('content-type') || '';
    if (res.ok && contentType.includes('application/pdf')) {
      const buffer = await res.arrayBuffer();
      recordApiTest('Export PDF Generator', '/api/export-pdf', true, `PDF generated size: ${buffer.byteLength} bytes`);
    } else {
      recordApiTest('Export PDF Generator', '/api/export-pdf', false, `Status ${res.status}, content-type: ${contentType}`);
    }
  } catch (err) {
    recordApiTest('Export PDF Generator', '/api/export-pdf', false, err.message);
  }

  // 14. Bulk HTTP Status Checker
  try {
    const res = await fetch(`${BASE_URL}/api/bulk/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls: [TEST_PAGE_URL] })
    });
    const { events } = await readSSEStream(res);
    const completeEvt = events.find(e => e.type === 'complete');
    if (completeEvt && completeEvt.data.total === 1) {
      recordApiTest('Bulk Status Checker', '/api/bulk/check', true, `Checked ${completeEvt.data.total} URLs (Healthy: ${completeEvt.data.healthy})`);
    } else {
      recordApiTest('Bulk Status Checker', '/api/bulk/check', false, 'Bulk check failed');
    }
  } catch (err) {
    recordApiTest('Bulk Status Checker', '/api/bulk/check', false, err.message);
  }

  // 15. Heading Structure Analyzer
  try {
    const res = await fetch(`${BASE_URL}/api/headings/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: TEST_PAGE_URL })
    });
    if (res.ok) {
      const data = await res.json();
      recordApiTest('Heading Structure Analyzer', '/api/headings/analyze', true, `Found ${data.total} headings`);
    } else {
      recordApiTest('Heading Structure Analyzer', '/api/headings/analyze', false, `HTTP ${res.status}`);
    }
  } catch (err) {
    recordApiTest('Heading Structure Analyzer', '/api/headings/analyze', false, err.message);
  }

  // 16. Keyword Discovery
  try {
    const res = await fetch(`${BASE_URL}/api/keywords/discover`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seed: 'technical seo', language: 'en', country: 'us' })
    });
    const { events } = await readSSEStream(res);
    const completeEvt = events.find(e => e.type === 'complete');
    if (completeEvt && Array.isArray(completeEvt.data)) {
      recordApiTest('Keyword Discovery', '/api/keywords/discover', true, `Discovered ${completeEvt.data.length} keywords`);
    } else {
      recordApiTest('Keyword Discovery', '/api/keywords/discover', false, 'Discovery failed');
    }
  } catch (err) {
    recordApiTest('Keyword Discovery', '/api/keywords/discover', false, err.message);
  }

  // 17. Keyword Clustering
  try {
    const res = await fetch(`${BASE_URL}/api/keywords/cluster`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keywords: ['seo tools', 'best seo tools', 'buy running shoes', 'running shoes sale'], threshold: 0.3 })
    });
    if (res.ok) {
      const data = await res.json();
      recordApiTest('Keyword Clustering', '/api/keywords/cluster', true, `Clustered into ${data.clusters ? data.clusters.length : 'N/A'} groups`);
    } else {
      recordApiTest('Keyword Clustering', '/api/keywords/cluster', false, `HTTP ${res.status}`);
    }
  } catch (err) {
    recordApiTest('Keyword Clustering', '/api/keywords/cluster', false, err.message);
  }

  // 18. Rank Tracker Check — Writes DB Transaction
  const testRankKw = 'prod test rank kw';
  const testRankUrl = `${BASE_URL}/index.html`;
  try {
    const res = await fetch(`${BASE_URL}/api/rank/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pairs: [{ keyword: testRankKw, targetUrl: testRankUrl }] })
    });
    const { events } = await readSSEStream(res);
    const completeEvt = events.find(e => e.type === 'complete');
    if (completeEvt && completeEvt.data.total === 1) {
      recordApiTest('Rank Tracker Check', '/api/rank/check', true, `Checked rankings for ${completeEvt.data.total} pair`);
    } else {
      recordApiTest('Rank Tracker Check', '/api/rank/check', false, 'Rank check failed');
    }
  } catch (err) {
    recordApiTest('Rank Tracker Check', '/api/rank/check', false, err.message);
  }

  // 19. Rank History GET — Verification of DB Transaction from Rank Check
  try {
    const res = await fetch(`${BASE_URL}/api/rank/history?keyword=${encodeURIComponent(testRankKw)}&url=${encodeURIComponent(testRankUrl)}&days=30`);
    if (res.ok) {
      const history = await res.json();
      recordApiTest('Rank History GET', '/api/rank/history', true, `Retrieved ${history.length} records`);
      const matched = history.find(h => h.keyword === testRankKw && h.target_url === testRankUrl);
      if (matched) {
        recordDbVerification('Rank History DB Transaction Save & Retrieve', true, `Verified rank record id #${matched.id} saved to SQLite DB (Position: ${matched.position})`);
      } else {
        recordDbVerification('Rank History DB Transaction Save & Retrieve', false, `Record for ${testRankKw} not found in DB`);
      }
    } else {
      recordApiTest('Rank History GET', '/api/rank/history', false, `HTTP ${res.status}`);
      recordDbVerification('Rank History DB Transaction Save & Retrieve', false, 'HTTP error on rank history endpoint');
    }
  } catch (err) {
    recordApiTest('Rank History GET', '/api/rank/history', false, err.message);
    recordDbVerification('Rank History DB Transaction Save & Retrieve', false, err.message);
  }

  // 20. Sitemap Generator
  try {
    const res = await fetch(`${BASE_URL}/api/sitemap/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls: [`${BASE_URL}/page1`, `${BASE_URL}/page2`] })
    });
    const contentType = res.headers.get('content-type') || '';
    if (res.ok && contentType.includes('xml')) {
      const xml = await res.text();
      const valid = xml.includes('<urlset') && xml.includes(`${BASE_URL}/page1`);
      recordApiTest('Sitemap Generator', '/api/sitemap/generate', valid, valid ? `XML generated: ${xml.length} bytes` : 'Invalid XML output');
    } else {
      recordApiTest('Sitemap Generator', '/api/sitemap/generate', false, `Status ${res.status}`);
    }
  } catch (err) {
    recordApiTest('Sitemap Generator', '/api/sitemap/generate', false, err.message);
  }

  // 21. Sitemap Validator
  try {
    const res = await fetch(`${BASE_URL}/api/sitemap/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sitemapUrl: SITEMAP_URL })
    });
    const { events } = await readSSEStream(res);
    const completeEvt = events.find(e => e.type === 'complete');
    if (completeEvt && typeof completeEvt.data.total === 'number') {
      recordApiTest('Sitemap Validator', '/api/sitemap/validate', true, `Total URLs in sitemap: ${completeEvt.data.total}`);
    } else {
      recordApiTest('Sitemap Validator', '/api/sitemap/validate', false, 'Validation failed');
    }
  } catch (err) {
    recordApiTest('Sitemap Validator', '/api/sitemap/validate', false, err.message);
  }

  // 22. Robots.txt Analyzer
  try {
    const res = await fetch(`${BASE_URL}/api/robots/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: TEST_PAGE_URL })
    });
    if (res.ok) {
      const data = await res.json();
      recordApiTest('Robots Analyzer', '/api/robots/analyze', true, `Extracted ${data.rules ? data.rules.length : 0} rules`);
    } else {
      recordApiTest('Robots Analyzer', '/api/robots/analyze', false, `HTTP ${res.status}`);
    }
  } catch (err) {
    recordApiTest('Robots Analyzer', '/api/robots/analyze', false, err.message);
  }

  // 23. Robots.txt Test Access Path
  try {
    const res = await fetch(`${BASE_URL}/api/robots/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rules: [{ agent: '*', type: 'Disallow', path: '/admin' }], testPath: '/admin', userAgent: 'Googlebot' })
    });
    if (res.ok) {
      const data = await res.json();
      recordApiTest('Robots Access Test', '/api/robots/test', data.allowed === false, `Allowed: ${data.allowed}`);
    } else {
      recordApiTest('Robots Access Test', '/api/robots/test', false, `HTTP ${res.status}`);
    }
  } catch (err) {
    recordApiTest('Robots Access Test', '/api/robots/test', false, err.message);
  }

  // 24. Duplicate Content Detector
  try {
    const res = await fetch(`${BASE_URL}/api/duplicate/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls: [TEST_PAGE_URL, BASE_URL] })
    });
    const { events } = await readSSEStream(res);
    const completeEvt = events.find(e => e.type === 'complete');
    if (completeEvt && typeof completeEvt.data.totalChecked === 'number') {
      recordApiTest('Duplicate Content Detector', '/api/duplicate/check', true, `Analyzed ${completeEvt.data.totalChecked} URLs`);
    } else {
      recordApiTest('Duplicate Content Detector', '/api/duplicate/check', false, 'Duplicate check failed');
    }
  } catch (err) {
    recordApiTest('Duplicate Content Detector', '/api/duplicate/check', false, err.message);
  }

  // 25. Structured Data Schema Validator
  try {
    const res = await fetch(`${BASE_URL}/api/schema/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: TEST_PAGE_URL })
    });
    if (res.ok) {
      const data = await res.json();
      recordApiTest('Schema Validator', '/api/schema/validate', true, `Schemas found: ${data.schemas ? data.schemas.length : 0}`);
    } else {
      recordApiTest('Schema Validator', '/api/schema/validate', false, `HTTP ${res.status}`);
    }
  } catch (err) {
    recordApiTest('Schema Validator', '/api/schema/validate', false, err.message);
  }

} catch (globalApiErr) {
  console.error('Fatal API Suite Error:', globalApiErr);
}

// -------------------------------------------------------------------
// 2. HEADLESS PUPPETEER FRONTEND NAVIGATION & CONSOLE ERROR SUITE
// -------------------------------------------------------------------
console.log('\n--- SECTION 2: HEADLESS PUPPETEER FRONTEND AUDIT ---\n');

let browser;
try {
  browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  await page.setRequestInterception(true);
  page.on('request', req => {
    if (req.url().includes('jsdelivr') || req.url().includes('cdnjs')) {
      req.respond({ status: 200, contentType: 'application/javascript', body: '// mock CDN' });
    } else {
      req.continue();
    }
  });

  const consoleErrors = [];
  const pageErrors = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(`[Console Error] ${msg.text()}`);
      console.log(`  ✗ [Browser Console Error] ${msg.text()}`);
    }
  });

  page.on('pageerror', err => {
    pageErrors.push(`[Page Error] ${err.message}`);
    console.log(`  ✗ [Browser Uncaught Page Error] ${err.message}`);
  });

  console.log('[Puppeteer] Navigating to http://localhost:3000...');
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  const pageTitle = await page.title();
  console.log(`[Puppeteer] Loaded page title: "${pageTitle}"`);

  // Ensure all details sections in sidebar are expanded
  await page.evaluate(() => {
    document.querySelectorAll('details').forEach(d => d.open = true);
  });

  // Query all sidebar nav items
  const navItems = await page.$$('.nav-item');
  console.log(`[Puppeteer] Found ${navItems.length} sidebar category navigation items.`);

  let clickedCount = 0;
  for (const navItem of navItems) {
    const target = await page.evaluate(el => el.getAttribute('data-target'), navItem);
    const label = await page.evaluate(el => el.textContent.trim(), navItem);
    
    await navItem.click();
    clickedCount++;
    
    // Brief pause to allow DOM render cycle execution
    await new Promise(r => setTimeout(r, 150));
    
    // Verify target section has 'active' class
    const isActive = await page.evaluate(t => {
      const el = document.getElementById(t);
      return el ? el.classList.contains('active') : false;
    }, target);

    if (!isActive) {
      consoleErrors.push(`Nav item "${target}" clicked but section #${target} is not active`);
    }
  }

  console.log(`[Puppeteer] Clicked through all ${clickedCount} sidebar categories.`);

  const totalErrors = consoleErrors.length + pageErrors.length;
  results.puppeteerTest = {
    passed: totalErrors === 0,
    errors: [...consoleErrors, ...pageErrors],
    navCount: clickedCount
  };

  if (totalErrors === 0) {
    console.log(`[Puppeteer] ✓ PASS - Clean UI navigation across ${clickedCount} categories with 0 browser console errors.`);
  } else {
    console.log(`[Puppeteer] ✗ FAIL - Encountered ${totalErrors} browser errors during navigation.`);
  }

} catch (puppeteerErr) {
  console.error('[Puppeteer] Fatal Test Execution Error:', puppeteerErr);
  results.puppeteerTest.errors.push(puppeteerErr.message);
  results.puppeteerTest.passed = false;
} finally {
  if (browser) await browser.close();
}

// -------------------------------------------------------------------
// 3. FINAL SUMMARY REPORT
// -------------------------------------------------------------------
console.log('\n===============================================================');
console.log('                 FINAL TEST RUNNER SUMMARY REPORT               ');
console.log('===============================================================');

const apiPassed = results.apiTests.filter(t => t.passed).length;
const apiFailed = results.apiTests.filter(t => !t.passed).length;
const dbPassed = results.dbVerifications.filter(t => t.passed).length;
const dbFailed = results.dbVerifications.filter(t => !t.passed).length;

console.log(`API Endpoints Tested: ${results.apiTests.length}`);
console.log(`  - Passed: ${apiPassed}`);
console.log(`  - Failed: ${apiFailed}`);

console.log(`\nDB Transactions Verified: ${results.dbVerifications.length}`);
console.log(`  - Passed: ${dbPassed}`);
console.log(`  - Failed: ${dbFailed}`);

console.log(`\nPuppeteer Headless UI Audit:`);
console.log(`  - Categories Navigated: ${results.puppeteerTest.navCount}`);
console.log(`  - Browser Console Errors: ${results.puppeteerTest.errors.length}`);
console.log(`  - Status: ${results.puppeteerTest.passed ? 'PASSED ✓' : 'FAILED ✗'}`);

const overallSuccess = apiFailed === 0 && dbFailed === 0 && results.puppeteerTest.passed;

console.log('\n---------------------------------------------------------------');
if (overallSuccess) {
  console.log('  🎉 RESULT: ALL API, DB, AND UI TESTS PASSED SUCCESSFULLY!  ');
  console.log('---------------------------------------------------------------\n');
  process.exit(0);
} else {
  console.log('  ❌ RESULT: PRODUCTION TEST RUNNER DETECTED FAILURES!      ');
  console.log('---------------------------------------------------------------\n');
  process.exit(1);
}
