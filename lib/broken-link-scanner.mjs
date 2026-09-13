import { parse } from 'node-html-parser';

export async function checkBrokenLinks(url, onProgress) {
  onProgress('progress', 'Fetching page HTML...');
  
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'SEO-Studio-Bot/1.0' },
      signal: AbortSignal.timeout(15000)
    });
    
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    
    const html = await res.text();
    const root = parse(html);
    
    onProgress('progress', 'Extracting external links...');
    const links = root.querySelectorAll('a[href]');
    
    // Parse the host of the target URL so we can identify external links
    const baseUrl = new URL(url);
    const externalLinks = [];
    
    for (const link of links) {
      const href = link.getAttribute('href');
      try {
        if (href.startsWith('http')) {
          const linkUrl = new URL(href);
          if (linkUrl.hostname !== baseUrl.hostname) {
            externalLinks.push(href);
          }
        }
      } catch (e) {
        // Invalid URL format, ignore
      }
    }
    
    // Deduplicate
    const uniqueLinks = [...new Set(externalLinks)];
    onProgress('progress', `Found ${uniqueLinks.length} external links. Auditing...`);
    
    let audited = 0;
    
    for (const link of uniqueLinks) {
      audited++;
      try {
        const headRes = await fetch(link, {
          method: 'HEAD',
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
          signal: AbortSignal.timeout(5000) // Fast timeout for link checks
        });
        
        let status = headRes.status;
        let health = status >= 400 ? 'Broken' : 'Healthy';
        
        onProgress('link', { url: link, status: status, health: health });
      } catch (e) {
        // If it fails to fetch (e.g. DNS error or timeout), treat it as broken
        onProgress('link', { url: link, status: 'TIMEOUT/ERROR', health: 'Broken' });
      }
      
      if (audited % 5 === 0) {
        onProgress('progress', `Audited ${audited} / ${uniqueLinks.length} links...`);
      }
    }
    
    onProgress('progress', 'Audit Complete!');
    return { audited: uniqueLinks.length };
    
  } catch (err) {
    throw new Error(`Failed to scan page: ${err.message}`);
  }
}
