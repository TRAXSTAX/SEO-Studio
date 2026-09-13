import { parse } from 'node-html-parser';

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

export async function findInternalLinks(sitemapUrl, targetUrl, keyword, onProgress) {
  onProgress('progress', 'Fetching sitemap...');
  const urls = await fetchSitemapUrls(sitemapUrl);
  
  if (urls.length === 0) {
    throw new Error('No URLs found in the provided sitemap.');
  }

  onProgress('progress', `Found ${urls.length} URLs. Scanning for opportunities...`);
  
  let opportunities = [];
  let scannedCount = 0;
  
  const targetUrlObj = new URL(targetUrl);
  const normalizedTarget = targetUrlObj.origin + targetUrlObj.pathname;

  for (const url of urls) {
    scannedCount++;
    
    // Skip the target URL itself
    if (url === targetUrl || url === normalizedTarget) continue;

    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'SEO-Studio-Bot/1.0' },
        signal: AbortSignal.timeout(10000)
      });
      
      if (!res.ok) continue;
      
      const html = await res.text();
      const root = parse(html);
      
      const main = root.querySelector('main, article, .content, #content') || root.querySelector('body');
      if (!main) continue;

      main.querySelectorAll('script, style, nav, footer, header').forEach(el => el.remove());
      
      const text = main.text.replace(/\s+/g, ' ').trim().toLowerCase();
      
      if (text.includes(keyword.toLowerCase())) {
        
        let alreadyLinks = false;
        const allLinks = root.querySelectorAll('a');
        for (const link of allLinks) {
          const href = link.getAttribute('href');
          if (href) {
            try {
              const absUrl = new URL(href, url);
              if (absUrl.origin + absUrl.pathname === normalizedTarget) {
                alreadyLinks = true;
                break;
              }
            } catch (e) {
            }
          }
        }

        if (!alreadyLinks) {
          const opportunity = {
            sourceUrl: url,
            targetUrl: targetUrl,
            keyword: keyword
          };
          opportunities.push(opportunity);
          onProgress('result', opportunity);
        }
      }
    } catch (err) {
      console.warn(`Error scanning ${url}: ${err.message}`);
    }
  }

  onProgress('progress', 'Scan Complete!');
  return { scanned: scannedCount, opportunities: opportunities.length };
}
