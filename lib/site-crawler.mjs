import { parse } from 'node-html-parser';

export async function crawlSite(startUrl, maxPages = 100, onProgress, onPageCrawled) {
  let baseUrl;
  try {
    const urlObj = new URL(startUrl);
    baseUrl = urlObj.origin;
  } catch(e) {
    throw new Error('Invalid start URL.');
  }

  const queue = [startUrl];
  const visited = new Set();
  const queuedUrls = new Set([startUrl]);
  
  const normalizeUrl = (raw, base) => {
    try {
      const u = new URL(raw, base);
      // Ignore hash fragments so we don't crawl the same page multiple times
      u.hash = '';
      return u.href;
    } catch (e) {
      return null;
    }
  };

  while (queue.length > 0 && visited.size < maxPages) {
    const currentUrl = queue.shift();
    if (visited.has(currentUrl)) continue;
    
    visited.add(currentUrl);
    onProgress(`Crawling: ${currentUrl} (${visited.size}/${maxPages})`);

    const result = {
      url: currentUrl,
      status: 0,
      title: 'N/A',
      titleLength: 0,
      description: 'N/A',
      descriptionLength: 0,
      internalLinks: 0,
      externalLinks: 0,
      error: null
    };

    try {
      const res = await fetch(currentUrl, {
        headers: { 'User-Agent': 'SEO-Studio-Bot/1.0' },
        signal: AbortSignal.timeout(10000)
      });
      
      result.status = res.status;
      
      if (res.headers.get('content-type')?.includes('text/html')) {
        const html = await res.text();
        const root = parse(html);

        const titleEl = root.querySelector('title');
        if (titleEl) {
          result.title = titleEl.text.trim();
          result.titleLength = result.title.length;
        }

        const metaDescEl = root.querySelector('meta[name="description"]');
        if (metaDescEl) {
          result.description = metaDescEl.getAttribute('content') || '';
          result.descriptionLength = result.description.length;
        }

        const links = root.querySelectorAll('a');
        for (const link of links) {
          const href = link.getAttribute('href');
          if (!href || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) continue;

          const absUrl = normalizeUrl(href, currentUrl);
          if (!absUrl) continue;

          if (absUrl.startsWith(baseUrl)) {
            result.internalLinks++;
            // Enqueue new internal links if we haven't visited them and they aren't already queued
            if (!visited.has(absUrl) && !queuedUrls.has(absUrl)) {
              queue.push(absUrl);
              queuedUrls.add(absUrl);
            }
          } else {
            result.externalLinks++;
          }
        }
      }
    } catch (err) {
      result.error = err.message;
    }
    
    // Stream result live
    onPageCrawled(result);
  }
  
  return { totalCrawled: visited.size };
}
