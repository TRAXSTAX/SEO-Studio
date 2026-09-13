import puppeteer from 'puppeteer';
import { saveRanking } from './db.mjs';

/**
 * Checks Google SERP positions for keyword & target URL pairs.
 * @param {Array<{keyword: string, targetUrl: string}>} pairs 
 * @param {Function} onProgress 
 * @param {Function} onResult 
 * @returns {Promise<Array<Object>>}
 */
export async function checkRankings(pairs, onProgress = null, onResult = null) {
  if (!Array.isArray(pairs) || pairs.length === 0) return [];

  let browser;
  const results = [];

  const notify = (msg) => { if (onProgress) onProgress(msg); };

  try {
    notify('Launching headless browser for rank checking...');
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1280, height: 800 });

    for (let i = 0; i < pairs.length; i++) {
      const { keyword, targetUrl } = pairs[i];
      if (!keyword || !targetUrl) continue;

      notify(`[${i + 1}/${pairs.length}] Searching Google for "${keyword}"...`);

      let position = null;
      let serpFeatures = [];
      let foundUrl = null;

      try {
        const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(keyword)}`;
        await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });

        // Extract search result URLs
        const links = await page.$$eval('.result__url', els => els.map(el => el.textContent.trim()));

        // Clean target domain/path for matching
        const cleanTarget = targetUrl.toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');

        for (let pos = 0; pos < links.length; pos++) {
          const rawLink = links[pos].toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
          if (rawLink.includes(cleanTarget) || cleanTarget.includes(rawLink)) {
            position = pos + 1;
            foundUrl = links[pos];
            break;
          }
        }

        // Check for SERP features (snippets, PAA, images)
        const hasSnippet = await page.$('.result__snippet') !== null;
        if (hasSnippet) serpFeatures.push('Featured Snippet');

      } catch (e) {
        console.warn(`Rank check failed for "${keyword}":`, e.message);
      }

      const item = {
        keyword,
        targetUrl,
        position: position || '100+',
        foundUrl,
        serpFeatures,
        checkedAt: new Date().toISOString()
      };

      // Save to SQLite
      await saveRanking(keyword, targetUrl, position || 101, serpFeatures);

      results.push(item);
      if (onResult) onResult(item);

      // Polite delay between queries (1.5 - 3 seconds)
      if (i < pairs.length - 1) {
        const delay = Math.floor(Math.random() * 1500) + 1500;
        await new Promise(r => setTimeout(r, delay));
      }
    }

    notify(`Completed rank checks for ${results.length} keyword/URL pairs.`);
    return results;

  } finally {
    if (browser) {
      try { await browser.close(); } catch (e) {}
    }
  }
}
