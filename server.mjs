import express from 'express';
import multer from 'multer';
import fs from 'fs';
import zlib from 'zlib';
import { parseLog } from './lib/log-parser.mjs';
import { analyze } from './lib/content-analyzer.mjs';
import { analyzeIntent } from './lib/intent-engine.mjs';
import { crawlSite } from './lib/site-crawler.mjs';
import { runMasterAudit } from './lib/master-audit.mjs';
import { runBatchAudit } from './lib/batch-processor.mjs';
import { findInternalLinks } from './lib/internal-link-finder.mjs';
import { checkCannibalization } from './lib/cannibalization-checker.mjs';
import { checkBrokenLinks } from './lib/broken-link-scanner.mjs';
import { analyzeGscFile } from './lib/gsc-analyzer.mjs';
import { saveAudit, getHistory, dbReady, getRankHistory } from './lib/db.mjs';
import { checkUrls } from './lib/bulk-status-checker.mjs';
import { discoverKeywords } from './lib/keyword-discovery.mjs';
import { clusterKeywords } from './lib/keyword-clusterer.mjs';
import { checkRankings } from './lib/rank-tracker.mjs';
import { generateSitemap, validateSitemap } from './lib/sitemap-tool.mjs';
import { analyzeRobots, testPathAccess } from './lib/robots-analyzer.mjs';
import { checkDuplicateContent } from './lib/duplicate-detector.mjs';
import { validateSchema } from './lib/schema-validator.mjs';
import puppeteer from 'puppeteer';
import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';

const app = express();

// Static asset caching & compression headers
app.use((req, res, next) => {
  const acceptEncoding = req.headers['accept-encoding'] || '';
  if (!acceptEncoding.match(/\b(gzip|deflate)\b/)) {
    return next();
  }

  const originalWrite = res.write;
  const originalEnd = res.end;

  let gzip;
  let isCompressing = false;

  const initCompression = () => {
    if (isCompressing) return true;
    const contentType = res.getHeader('Content-Type') || '';
    if (typeof contentType === 'string' && (contentType.includes('text/event-stream') || contentType.includes('application/pdf'))) {
      return false;
    }
    if (res.getHeader('Content-Encoding')) {
      return false;
    }

    if (acceptEncoding.includes('gzip')) {
      res.setHeader('Content-Encoding', 'gzip');
      res.removeHeader('Content-Length');
      gzip = zlib.createGzip();
      gzip.on('data', (chunk) => originalWrite.call(res, chunk));
      gzip.on('end', () => originalEnd.call(res));
      isCompressing = true;
      return true;
    } else if (acceptEncoding.includes('deflate')) {
      res.setHeader('Content-Encoding', 'deflate');
      res.removeHeader('Content-Length');
      gzip = zlib.createDeflate();
      gzip.on('data', (chunk) => originalWrite.call(res, chunk));
      gzip.on('end', () => originalEnd.call(res));
      isCompressing = true;
      return true;
    }
    return false;
  };

  res.write = function (chunk, encoding, callback) {
    if (initCompression()) {
      return gzip.write(chunk, encoding, callback);
    }
    return originalWrite.call(this, chunk, encoding, callback);
  };

  res.end = function (chunk, encoding, callback) {
    if (chunk) {
      if (initCompression()) {
        gzip.write(chunk, encoding);
      } else {
        return originalEnd.call(this, chunk, encoding, callback);
      }
    }
    if (isCompressing && gzip) {
      return gzip.end(callback);
    }
    return originalEnd.call(this, chunk, encoding, callback);
  };

  next();
});

app.use(express.static('public', {
  maxAge: '1d',
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'public, max-age=3600');
    } else if (filePath.endsWith('.css') || filePath.endsWith('.js') || filePath.endsWith('.png') || filePath.endsWith('.jpg') || filePath.endsWith('.svg') || filePath.endsWith('.ico')) {
      res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
    }
  }
}));

app.use(express.json());

const upload = multer({ dest: 'uploads/' });

// Helper for SSE
const createSSESender = (res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  return (type, data) => res.write(`data: ${JSON.stringify({ type, data })}\n\n`);
};

// Delay helper
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ==========================================
// 1. Log Analyzer
// ==========================================
app.post('/api/logs/upload', upload.single('logfile'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
  const send = createSSESender(res);
  try {
    await parseLog(
      req.file.path, 
      (count) => send('progress', `Parsed ${count.toLocaleString()} lines...`),
      (stats) => {
        send('complete', stats);
        res.end();
      }
    );
  } catch (err) {
    console.error('Log Upload Error:', err);
    send('error', err.message);
    res.end();
  } finally {
    if (req.file?.path) {
      try { fs.unlinkSync(req.file.path); } catch(e) {}
    }
  }
});

// ==========================================
// 1.5. GSC Analyzer
// ==========================================
app.post('/api/gsc/upload', upload.single('csvfile'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
  try {
    const results = await analyzeGscFile(req.file.path);
    res.json(results);
  } catch (err) {
    console.error('GSC Upload Error:', err);
    res.status(500).json({ error: err.message });
  } finally {
    if (req.file?.path) {
      try { fs.unlinkSync(req.file.path); } catch(e) {}
    }
  }
});

// ==========================================
// 2. Content Grader
// ==========================================
app.post('/api/grader/analyze', async (req, res) => {
  const { keyword, draft } = req.body || {};
  if (!keyword) return res.status(400).json({ error: 'Keyword is required' });
  const send = createSSESender(res);
  try {
    await analyze(
      keyword,
      draft || '',
      (msg) => send('progress', msg),
      (results) => {
        send('complete', results);
        res.end();
      },
      (err) => {
        console.error('Content Grader Callback Error:', err);
        send('error', err);
        res.end();
      }
    );
  } catch (error) {
    console.error('Content Grader Error:', error);
    send('error', error.message);
    res.end();
  }
});

// ==========================================
// 3. Web Vitals
// ==========================================
app.post('/api/vitals/audit', async (req, res) => {
  const { url } = req.body || {};
  if (!url) return res.status(400).json({ error: 'URL is required' });
  try { new URL(url); } catch (e) { return res.status(400).json({ error: 'Invalid URL format' }); }
  const send = createSSESender(res);
  
  let chrome;
  try {
    send('progress', 'Booting headless Chrome...');
    chrome = await chromeLauncher.launch({ chromeFlags: ['--headless'] });
    const options = {
      logLevel: 'error',
      output: 'json',
      onlyCategories: ['performance'],
      port: chrome.port,
    };
    
    send('progress', `Running Lighthouse Core Web Vitals audit on ${url}... (this takes ~10s)`);
    const runnerResult = await lighthouse(url, options);
    const report = JSON.parse(runnerResult.report);
    
    send('progress', 'Audit complete. Parsing metrics...');
    const metrics = {
      lcp: report.audits['largest-contentful-paint'],
      cls: report.audits['cumulative-layout-shift'],
      tbt: report.audits['total-blocking-time'],
      fcp: report.audits['first-contentful-paint']
    };
    
    send('complete', {
      score: Math.round(report.categories.performance.score * 100),
      metrics,
      diagnostics: report.audits['diagnostics']
    });
  } catch (error) {
    console.error('Core Web Vitals Audit Error:', error);
    send('error', 'Audit failed: ' + error.message);
  } finally {
    if (chrome) {
      try { await chrome.kill(); } catch (e) { console.warn('Chrome kill EPERM ignored'); }
    }
    setTimeout(() => res.end(), 500);
  }
});

// ==========================================
// 4. Intent Mapper
// ==========================================
app.post('/api/intent/map', async (req, res) => {
  const { keywords } = req.body || {};
  if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
    return res.status(400).json({ error: 'Array of keywords is required.' });
  }
  const send = createSSESender(res);
  try {
    const results = [];
    for (let i = 0; i < keywords.length; i++) {
      const keyword = keywords[i];
      send('progress', `Mapping intent for: "${keyword}" (${i + 1}/${keywords.length})`);
      const result = await analyzeIntent(keyword);
      results.push(result);
      send('result', result);
      if (i < keywords.length - 1) await delay(1000);
    }
    send('complete', { total: results.length, data: results });
  } catch (error) {
    console.error('Intent Mapping Error:', error);
    send('error', error.message);
  } finally {
    res.end();
  }
});

// ==========================================
// 5. Site Crawler
// ==========================================
app.post('/api/crawler/start', async (req, res) => {
  const { url, maxPages } = req.body || {};
  if (!url) return res.status(400).json({ error: 'URL is required' });
  try { new URL(url); } catch (e) { return res.status(400).json({ error: 'Invalid URL format' }); }
  
  const send = createSSESender(res);
  try {
    const result = await crawlSite(
      url,
      maxPages || 50,
      (msg) => send('progress', msg),
      (pageData) => send('result', pageData)
    );
    send('complete', result);
  } catch (error) {
    console.error('Site Crawler Error:', error);
    send('error', error.message);
  } finally {
    res.end();
  }
});

// ==========================================
// 6. Master Audit
// ==========================================
app.post('/api/master/audit', async (req, res) => {
  const { url, keyword } = req.body || {};
  if (!url || !keyword) return res.status(400).json({ error: 'URL and Keyword are required' });
  try { new URL(url); } catch (e) { return res.status(400).json({ error: 'Invalid URL format' }); }
  
  const send = createSSESender(res);
  try {
    const result = await runMasterAudit(
      url, 
      keyword, 
      (msg) => send('progress', msg)
    );
    await saveAudit(url, keyword, result.vitals?.score || 0, result.content?.score || 0, result.overallScore || 0);
    send('complete', result);
  } catch (error) {
    console.error('Master Audit Error:', error);
    send('error', error.message);
  } finally {
    res.end();
  }
});

// ==========================================
// 6.5. Master Audit (Batch Mode)
// ==========================================
app.post('/api/master/batch', async (req, res) => {
  const { sitemapUrl, keyword } = req.body || {};
  if (!sitemapUrl || !keyword) return res.status(400).json({ error: 'Sitemap URL and Keyword are required' });
  try { new URL(sitemapUrl); } catch (e) { return res.status(400).json({ error: 'Invalid Sitemap URL format' }); }
  
  const send = createSSESender(res);
  try {
    const result = await runBatchAudit(
      sitemapUrl, 
      keyword, 
      (type, msg) => send(type, msg)
    );
    send('complete', result);
  } catch (error) {
    console.error('Batch Audit Error:', error);
    send('error', error.message);
  } finally {
    res.end();
  }
});

// ==========================================
// 6.75. Internal Link Finder
// ==========================================
app.post('/api/links/find', async (req, res) => {
  const { sitemapUrl, targetUrl, keyword } = req.body || {};
  if (!sitemapUrl || !targetUrl || !keyword) {
    return res.status(400).json({ error: 'Sitemap URL, Target URL, and Keyword are required' });
  }
  
  try { new URL(sitemapUrl); new URL(targetUrl); } catch (e) { 
    return res.status(400).json({ error: 'Invalid URL format' }); 
  }
  
  const send = createSSESender(res);
  try {
    const result = await findInternalLinks(
      sitemapUrl, 
      targetUrl, 
      keyword, 
      (type, msg) => send(type, msg)
    );
    send('complete', result);
  } catch (error) {
    console.error('Internal Links Error:', error);
    send('error', error.message);
  } finally {
    res.end();
  }
});

// ==========================================
// 6.8. Cannibalization Checker
// ==========================================
app.post('/api/cannibalization/check', async (req, res) => {
  const { sitemapUrl } = req.body || {};
  if (!sitemapUrl) {
    return res.status(400).json({ error: 'Sitemap URL is required' });
  }
  try { new URL(sitemapUrl); } catch (e) { return res.status(400).json({ error: 'Invalid URL format' }); }
  
  const send = createSSESender(res);
  try {
    const result = await checkCannibalization(
      sitemapUrl, 
      (type, msg) => send(type, msg)
    );
    send('complete', result);
  } catch (error) {
    console.error('Cannibalization Check Error:', error);
    send('error', error.message);
  } finally {
    res.end();
  }
});

// ==========================================
// 6.92. Broken Links Checker
// ==========================================
app.post('/api/links/broken', async (req, res) => {
  const { url } = req.body || {};
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }
  try { new URL(url); } catch (e) { return res.status(400).json({ error: 'Invalid URL format' }); }
  
  const send = createSSESender(res);
  try {
    const result = await checkBrokenLinks(
      url, 
      (type, msg) => send(type, msg)
    );
    send('complete', result);
  } catch (error) {
    console.error('Broken Links Check Error:', error);
    send('error', error.message);
  } finally {
    res.end();
  }
});

// ==========================================
// 7. History
// ==========================================
app.get('/api/history', async (req, res) => {
  try {
    const url = req.query.url;
    const history = await getHistory(url);
    res.json(history);
  } catch (err) {
    console.error('History API Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 8. PDF Export
// ==========================================
app.post('/api/export-pdf', async (req, res) => {
  const { htmlContent } = req.body || {};
  if (!htmlContent) return res.status(400).json({ error: 'No HTML content provided' });

  // Sanitize: strip script, iframe, object, embed, form tags
  const sanitized = htmlContent.replace(/<(script|iframe|object|embed|form)[^>]*>[\s\S]*?<\/\1>/gi, '').replace(/<(script|iframe|object|embed|form)[^>]*\/>/gi, '');

  let browser;
  try {
    browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    
    const styledHtml = `
      <html>
        <head>
          <style>
            body { font-family: 'Inter', sans-serif; padding: 20px; color: #1e293b; }
            h1, h2, h3 { color: #0f172a; }
            .card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; margin-bottom: 20px; }
            .metric { font-size: 24px; font-weight: bold; color: #4f46e5; }
            .grade { display: inline-block; padding: 5px 10px; border-radius: 4px; font-weight: bold; }
          </style>
        </head>
        <body>
          <h1>SEO Master Audit Report</h1>
          ${sanitized}
        </body>
      </html>
    `;

    await page.setContent(styledHtml, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '20px', bottom: '20px', left: '20px', right: '20px' } });
    
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Length': pdfBuffer.length,
      'Content-Disposition': 'attachment; filename="SEO_Audit_Report.pdf"'
    });
    res.send(pdfBuffer);
  } catch (err) {
    console.error('PDF Export Error:', err);
    res.status(500).json({ error: err.message });
  } finally {
    if (browser) {
      try { await browser.close(); } catch (e) {}
    }
  }
});

// ==========================================
// Bulk HTTP Status Checker
// ==========================================
app.post('/api/bulk/check', async (req, res) => {
  const { urls } = req.body || {};
  if (!urls || !Array.isArray(urls) || urls.length === 0) {
    return res.status(400).json({ error: 'Provide an array of URLs' });
  }
  if (urls.length > 500) {
    return res.status(400).json({ error: 'Maximum 500 URLs per request' });
  }
  const send = createSSESender(res);
  try {
    const summary = await checkUrls(
      urls,
      (progress) => send('progress', progress),
      (result) => send('result', result)
    );
    send('complete', summary);
    res.end();
  } catch (err) {
    console.error('Bulk Check Error:', err);
    send('error', err.message);
    res.end();
  }
});

// ==========================================
// Heading Structure Analyzer
// ==========================================
app.post('/api/headings/analyze', async (req, res) => {
  const { url } = req.body || {};
  if (!url) return res.status(400).json({ error: 'URL is required' });
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'SEO-Studio-Bot/2.0' },
      signal: AbortSignal.timeout(15000)
    });
    const html = await response.text();
    const { parse } = await import('node-html-parser');
    const root = parse(html);
    const headings = [];
    root.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(el => {
      headings.push({
        level: parseInt(el.tagName.charAt(1)),
        text: el.text.trim().substring(0, 200)
      });
    });
    
    // Detect issues
    const issues = [];
    const h1Count = headings.filter(h => h.level === 1).length;
    if (h1Count === 0) issues.push({ type: 'error', message: 'No H1 tag found' });
    if (h1Count > 1) issues.push({ type: 'warning', message: `Multiple H1 tags found (${h1Count})` });
    
    for (let i = 1; i < headings.length; i++) {
      if (headings[i].level > headings[i-1].level + 1) {
        issues.push({ type: 'warning', message: `Skipped heading level: H${headings[i-1].level} → H${headings[i].level} ("${headings[i].text.substring(0, 40)}...")` });
      }
    }
    
    headings.forEach(h => {
      if (!h.text || h.text.length === 0) {
        issues.push({ type: 'error', message: `Empty H${h.level} tag found` });
      }
    });
    
    if (issues.length === 0) issues.push({ type: 'success', message: 'No structural issues detected!' });
    
    res.json({ headings, issues, total: headings.length });
  } catch (err) {
    console.error('Headings Analysis Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 17. Keyword Discovery
// ==========================================
app.post('/api/keywords/discover', async (req, res) => {
  const { seed, language, country } = req.body || {};
  if (!seed) return res.status(400).json({ error: 'Seed keyword is required' });
  const send = createSSESender(res);
  try {
    const results = await discoverKeywords(seed, { language, country }, (msg) => send('progress', msg));
    send('complete', results);
  } catch (err) {
    console.error('Keyword Discovery Error:', err);
    send('error', err.message);
  } finally {
    res.end();
  }
});

// ==========================================
// 18. Keyword Clustering
// ==========================================
app.post('/api/keywords/cluster', async (req, res) => {
  try {
    const { keywords, threshold } = req.body || {};
    if (!Array.isArray(keywords) || keywords.length === 0) {
      return res.status(400).json({ error: 'Keywords array is required' });
    }
    const results = clusterKeywords(keywords, threshold || 0.3);
    res.json(results);
  } catch (err) {
    console.error('Keyword Clustering Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 19. Rank Tracker
// ==========================================
app.post('/api/rank/check', async (req, res) => {
  const { pairs } = req.body || {};
  if (!Array.isArray(pairs) || pairs.length === 0) {
    return res.status(400).json({ error: 'Keyword/URL pairs array required' });
  }
  const send = createSSESender(res);
  try {
    const results = await checkRankings(
      pairs,
      (msg) => send('progress', msg),
      (item) => send('result', item)
    );
    send('complete', { total: results.length });
  } catch (err) {
    console.error('Rank Check Error:', err);
    send('error', err.message);
  } finally {
    res.end();
  }
});

app.get('/api/rank/history', async (req, res) => {
  const { keyword, url, days } = req.query;
  try {
    const history = await getRankHistory(keyword, url, days || 30);
    res.json(history);
  } catch (err) {
    console.error('Rank History Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 20. Sitemap Generator & Validator
// ==========================================
app.post('/api/sitemap/generate', (req, res) => {
  try {
    const { urls } = req.body || {};
    if (!Array.isArray(urls) || urls.length === 0) {
      return res.status(400).json({ error: 'URLs array is required' });
    }
    const xml = generateSitemap(urls);
    res.type('application/xml').send(xml);
  } catch (err) {
    console.error('Sitemap Generation Error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/sitemap/validate', async (req, res) => {
  const { sitemapUrl } = req.body || {};
  if (!sitemapUrl) return res.status(400).json({ error: 'Sitemap URL is required' });
  const send = createSSESender(res);
  try {
    const summary = await validateSitemap(
      sitemapUrl,
      (msg) => send('progress', msg),
      (item) => send('result', item)
    );
    send('complete', summary);
  } catch (err) {
    console.error('Sitemap Validation Error:', err);
    send('error', err.message);
  } finally {
    res.end();
  }
});

// ==========================================
// 21. Robots.txt Analyzer
// ==========================================
app.post('/api/robots/analyze', async (req, res) => {
  const { url } = req.body || {};
  if (!url) return res.status(400).json({ error: 'URL is required' });
  try {
    const results = await analyzeRobots(url);
    res.json(results);
  } catch (err) {
    console.error('Robots Analysis Error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/robots/test', (req, res) => {
  try {
    const { rules, testPath, userAgent } = req.body || {};
    const result = testPathAccess(rules, testPath, userAgent);
    res.json(result);
  } catch (err) {
    console.error('Robots Path Test Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 22. Duplicate Content Detector
// ==========================================
app.post('/api/duplicate/check', async (req, res) => {
  const { urls } = req.body || {};
  if (!Array.isArray(urls) || urls.length === 0) {
    return res.status(400).json({ error: 'URLs array is required' });
  }
  const send = createSSESender(res);
  try {
    const summary = await checkDuplicateContent(
      urls,
      (msg) => send('progress', msg),
      (item) => send('result', item)
    );
    send('complete', summary);
  } catch (err) {
    console.error('Duplicate Check Error:', err);
    send('error', err.message);
  } finally {
    res.end();
  }
});

// ==========================================
// 23. Structured Data Validator
// ==========================================
app.post('/api/schema/validate', async (req, res) => {
  const { url } = req.body || {};
  if (!url) return res.status(400).json({ error: 'URL is required' });
  try {
    const results = await validateSchema(url);
    res.json(results);
  } catch (err) {
    console.error('Schema Validation Error:', err);
    res.status(500).json({ error: err.message });
  }
});

dbReady.then(() => {
  app.listen(3000, () => {
    console.log('Enterprise SEO Studio running on http://localhost:3000');
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
