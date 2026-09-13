// Uses native global fetch
import { parse } from 'node-html-parser';

/**
 * Generates an XML sitemap string from an array of URLs.
 * @param {Array<string>} urls 
 * @returns {string} XML string
 */
export function generateSitemap(urls = []) {
  const cleanUrls = Array.from(new Set(urls.map(u => u.trim()).filter(u => u.startsWith('http'))));
  const dateStr = new Date().toISOString().split('T')[0];

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

  cleanUrls.forEach(url => {
    const isHome = url.replace(/^https?:\/\//, '').replace(/\/$/, '').indexOf('/') === -1;
    const priority = isHome ? '1.0' : '0.8';
    xml += '  <url>\n';
    xml += `    <loc>${escapeXml(url)}</loc>\n`;
    xml += `    <lastmod>${dateStr}</lastmod>\n`;
    xml += `    <changefreq>${isHome ? 'daily' : 'weekly'}</changefreq>\n`;
    xml += `    <priority>${priority}</priority>\n`;
    xml += '  </url>\n';
  });

  xml += '</urlset>';
  return xml;
}

function escapeXml(str) {
  return str.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
}

/**
 * Validates a sitemap XML URL by fetching it and checking contained URLs.
 * @param {string} sitemapUrl 
 * @param {Function} onProgress 
 * @param {Function} onResult 
 * @returns {Promise<Object>}
 */
export async function validateSitemap(sitemapUrl, onProgress = null, onResult = null) {
  const notify = (msg) => { if (onProgress) onProgress(msg); };

  notify(`Fetching sitemap from ${sitemapUrl}...`);

  const res = await fetch(sitemapUrl, {
    headers: { 'User-Agent': 'SEO-Studio-Bot/2.0' },
    signal: AbortSignal.timeout(10000)
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch sitemap: HTTP ${res.status}`);
  }

  const xmlText = await res.text();

  // Extract all <loc> tags
  const locMatches = [...xmlText.matchAll(/<loc>(.*?)<\/loc>/gi)].map(m => m[1].trim());

  if (locMatches.length === 0) {
    throw new Error('No <loc> tags found in sitemap XML');
  }

  notify(`Found ${locMatches.length} URLs in sitemap. Validating HTTP status...`);

  const uniqueLocs = Array.from(new Set(locMatches));
  const duplicatesCount = locMatches.length - uniqueLocs.length;

  const results = [];
  let healthy = 0;
  let broken = 0;
  let redirects = 0;

  // Process in batches of 8
  const BATCH_SIZE = 8;
  for (let i = 0; i < uniqueLocs.length; i += BATCH_SIZE) {
    const chunk = uniqueLocs.slice(i, i + BATCH_SIZE);
    notify(`Validating URLs ${i + 1} - ${Math.min(i + BATCH_SIZE, uniqueLocs.length)} of ${uniqueLocs.length}...`);

    await Promise.all(chunk.map(async (url) => {
      let status = 0;
      let error = null;
      let responseTime = 0;
      const startTime = Date.now();

      try {
        const checkRes = await fetch(url, {
          method: 'HEAD',
          headers: { 'User-Agent': 'SEO-Studio-Bot/2.0' },
          redirect: 'manual',
          signal: AbortSignal.timeout(5000)
        });
        status = checkRes.status;
        responseTime = Date.now() - startTime;
      } catch (e) {
        error = e.message;
      }

      if (status >= 200 && status < 300) healthy++;
      else if (status >= 300 && status < 400) redirects++;
      else broken++;

      const item = { url, status, error, responseTime };
      results.push(item);
      if (onResult) onResult(item);
    }));
  }

  notify(`Sitemap validation complete.`);

  return {
    total: locMatches.length,
    unique: uniqueLocs.length,
    duplicatesCount,
    healthy,
    redirects,
    broken,
    results
  };
}
