import { runMasterAudit } from './master-audit.mjs';
import { saveAudit } from './db.mjs';
import { parse } from 'node-html-parser'; // using node-html-parser to roughly parse xml tags

async function fetchSitemapUrls(sitemapUrl) {
  try {
    const res = await fetch(sitemapUrl, {
      signal: AbortSignal.timeout(30000)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    // Rough parsing of <loc> tags using regex to avoid heavy xml parsers
    const locs = [];
    const regex = /<loc>(.*?)<\/loc>/g;
    let match;
    while ((match = regex.exec(xml)) !== null) {
      locs.push(match[1].trim());
    }
    return locs;
  } catch (err) {
    throw new Error(`Failed to parse sitemap: ${err.message}`);
  }
}

export async function runBatchAudit(sitemapUrl, keyword, onProgress) {
  onProgress('progress', 'Fetching sitemap...');
  const urls = await fetchSitemapUrls(sitemapUrl);
  
  if (urls.length === 0) {
    throw new Error('No URLs found in the provided sitemap.');
  }

  onProgress('progress', `Found ${urls.length} URLs. Starting batch audit...`);
  
  const results = [];
  let index = 0;

  // We process sequentially to avoid crashing Lighthouse/Puppeteer
  for (const url of urls) {
    index++;
    onProgress('progress', `\n[${index}/${urls.length}] Auditing: ${url}`);
    try {
      const result = await runMasterAudit(url, keyword, (msg) => {
        // Suppress detailed progress messages from individual audits to keep the batch stream clean,
        // or prefix them. We'll prefix them.
        onProgress('progress', `  > ${msg}`);
      });
      
      await saveAudit(url, keyword, result.vitals?.score || 0, result.content?.score || 0, result.overallScore || 0);
      results.push({ url, status: 'Success', score: result.overallScore });
    } catch (e) {
      onProgress('progress', `  > Error auditing ${url}: ${e.message}`);
      results.push({ url, status: 'Failed', error: e.message });
    }
  }

  onProgress('progress', 'Batch Audit Complete!');
  return results;
}
