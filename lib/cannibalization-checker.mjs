import { parse } from 'node-html-parser';
import { eng } from 'stopword';

// Helper: remove stopwords and get unique sorted core tokens
function getCoreIntent(text) {
  if (!text) return '';
  const cleaned = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
  let tokens = cleaned.split(/\s+/).filter(t => t.length > 2);
  
  // Remove common English stopwords
  tokens = tokens.filter(t => !eng.includes(t));
  
  // Return a sorted signature string
  return [...new Set(tokens)].sort().join(' ');
}

async function fetchSitemapUrls(sitemapUrl) {
  try {
    const res = await fetch(sitemapUrl, {
      signal: AbortSignal.timeout(30000)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
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

export async function checkCannibalization(sitemapUrl, onProgress) {
  onProgress('progress', 'Fetching sitemap...');
  const urls = await fetchSitemapUrls(sitemapUrl);
  
  if (urls.length === 0) {
    throw new Error('No URLs found in the provided sitemap.');
  }

  onProgress('progress', `Found ${urls.length} URLs. Analyzing semantic intent...`);
  
  // Map of signature -> array of page details
  const intentMap = new Map();
  let scannedCount = 0;

  for (const url of urls) {
    scannedCount++;
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'SEO-Studio-Bot/1.0' },
        signal: AbortSignal.timeout(10000)
      });
      
      if (!res.ok) continue;
      
      const html = await res.text();
      const root = parse(html);
      
      const title = root.querySelector('title')?.text || '';
      const h1 = root.querySelector('h1')?.text || '';
      
      // Combine Title and H1 for core intent
      const combined = `${title} ${h1}`;
      const signature = getCoreIntent(combined);
      
      // We only care about pages with substantial intent signatures (e.g. at least 2 strong words)
      if (signature.split(' ').length >= 2) {
        if (!intentMap.has(signature)) {
          intentMap.set(signature, []);
        }
        intentMap.get(signature).push({
          url,
          title: title.trim().replace(/\s+/g, ' '),
          h1: h1.trim().replace(/\s+/g, ' ')
        });
      }
      
    } catch (err) {
      // Ignore fetch timeouts or parsing errors on individual pages
      console.warn(`Error scanning ${url}: ${err.message}`);
    }
    
    if (scannedCount % 5 === 0) {
      onProgress('progress', `Scanned ${scannedCount} / ${urls.length} pages...`);
    }
  }

  onProgress('progress', 'Scan Complete! Identifying conflicts...');
  
  const conflicts = [];
  for (const [signature, pages] of intentMap.entries()) {
    if (pages.length > 1) {
      conflicts.push({
        intent: signature,
        pages: pages
      });
      // Stream each conflict to the frontend as it's discovered during the final phase
      onProgress('conflict', { intent: signature, pages: pages });
    }
  }

  // Sort conflicts by severity (number of competing pages)
  conflicts.sort((a, b) => b.pages.length - a.pages.length);

  return { scanned: scannedCount, conflictsFound: conflicts.length, conflicts };
}
