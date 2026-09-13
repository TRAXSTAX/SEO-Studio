import { parse } from 'node-html-parser';
import { analyze } from './content-analyzer.mjs';
import { analyzeIntent } from './intent-engine.mjs';
import { generateActionPlan } from './action-planner.mjs';
import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';

async function fetchPageText(url) {
  try {
    const res = await fetch(url, { 
      headers: { 'User-Agent': 'SEO-Studio-Bot/1.0' },
      signal: AbortSignal.timeout(15000)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    const root = parse(html);
    
    // Extract metadata
    const title = root.querySelector('title')?.text?.trim() || 'Missing Title';
    const desc = root.querySelector('meta[name="description"]')?.getAttribute('content') || 'Missing Description';
    
    // Extract body text
    const main = root.querySelector('main, article, .content, #content') || root.querySelector('body');
    if (!main) return { text: '', title, desc };
    
    // Clean up scripts/styles
    main.querySelectorAll('script, style, nav, footer, header').forEach(el => el.remove());
    const text = main.text.replace(/\s+/g, ' ').trim();
    
    // Technical SEO
    const canonical = root.querySelector('link[rel="canonical"]')?.getAttribute('href') || null;
    const jsonLdNodes = root.querySelectorAll('script[type="application/ld+json"]');
    const jsonLd = jsonLdNodes.length > 0;
    
    // Quick link check
    const aTags = root.querySelectorAll('a');
    let brokenLinks = 0;
    aTags.forEach(a => {
      const href = a.getAttribute('href');
      // Just simulate a broken link check for speed (empty hrefs or javascript:void(0))
      if (!href || href === '#' || href.includes('javascript:')) brokenLinks++;
    });

    const technical = {
      canonical,
      jsonLd,
      brokenLinks,
      totalLinks: aTags.length
    };

    return { text, title, desc, technical };
  } catch (err) {
    throw new Error(`Failed to fetch page text: ${err.message}`);
  }
}

export async function runMasterAudit(url, keyword, onProgress) {
  const report = {
    url,
    keyword,
    vitals: null,
    onPage: null,
    content: null,
    intent: null,
    overallScore: 0
  };

  // 1. Fetch Page & Extract Text
  onProgress('Step 1: Fetching page content, metadata, and technical SEO...');
  const pageData = await fetchPageText(url);
  report.onPage = {
    title: pageData.title,
    titleLength: pageData.title.length,
    description: pageData.desc,
    descriptionLength: pageData.desc.length
  };
  report.technical = pageData.technical;

  // 2. Intent Mapper
  onProgress('Step 2: Classifying Search Intent...');
  report.intent = await analyzeIntent(keyword);

  // 3. Content Grader
  onProgress('Step 3: Grading content against Top 5 Competitors...');
  report.content = await new Promise((resolve, reject) => {
    analyze(
      keyword,
      pageData.text,
      (msg) => onProgress(`Content Grader: ${msg}`),
      (res) => resolve(res),
      (err) => reject(new Error(err))
    );
  });

  // 4. Web Vitals (Lighthouse)
  onProgress('Step 4: Running Core Web Vitals Audit (takes ~15s)...');
  let chrome;
  try {
    chrome = await chromeLauncher.launch({ chromeFlags: ['--headless'] });
    const options = {
      logLevel: 'error',
      output: 'json',
      onlyCategories: ['performance'],
      port: chrome.port
    };
    
    const runnerResult = await lighthouse(url, options);
    const audits = runnerResult.lhr.audits;
    
    report.vitals = {
      score: Math.round(runnerResult.lhr.categories.performance.score * 100),
      lcp: audits['largest-contentful-paint'].displayValue,
      cls: audits['cumulative-layout-shift'].displayValue,
      tbt: audits['total-blocking-time'].displayValue
    };
  } catch (err) {
    report.vitals = { error: err.message };
  } finally {
    if (chrome) {
      try { await chrome.kill(); } catch (e) { console.warn('Chrome kill EPERM ignored'); }
    }
  }

  // Calculate Overall Score (out of 100)
  let totalScore = 0;
  
  // Vitals = 33%
  if (report.vitals && report.vitals.score) {
    totalScore += (report.vitals.score / 100) * 33;
  }
  
  // Content = 33%
  if (report.content && report.content.percentage) {
    totalScore += (report.content.percentage / 100) * 33;
  }
  
  // OnPage basics = 34%
  let onPageScore = 34;
  if (report.onPage.titleLength < 10 || report.onPage.titleLength > 65) onPageScore -= 10;
  if (report.onPage.descriptionLength < 50 || report.onPage.descriptionLength > 160) onPageScore -= 10;
  
  // Check if keyword is in title
  if (!report.onPage.title.toLowerCase().includes(keyword.toLowerCase())) onPageScore -= 14;
  
  totalScore += Math.max(0, onPageScore);
  
  report.overallScore = Math.round(totalScore);

  onProgress('Step 5: Generating AI Action Plan...');
  report.actionPlan = generateActionPlan(report);

  onProgress('Audit Complete!');
  return report;
}
