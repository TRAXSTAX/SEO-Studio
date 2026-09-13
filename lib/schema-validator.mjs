// Uses native global fetch
import { parse } from 'node-html-parser';

/**
 * Extracts and validates JSON-LD / Microdata structured schemas from a webpage URL.
 * @param {string} url 
 * @returns {Promise<Object>}
 */
export async function validateSchema(url) {
  let targetUrl = url.trim();
  if (!targetUrl.startsWith('http')) {
    targetUrl = 'https://' + targetUrl;
  }

  const res = await fetch(targetUrl, {
    headers: { 'User-Agent': 'SEO-Studio-Bot/2.0' },
    signal: AbortSignal.timeout(8000)
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch page: HTTP ${res.status}`);
  }

  const html = await res.text();
  const root = parse(html);

  // Extract all <script type="application/ld+json"> blocks
  const scriptEls = root.querySelectorAll('script[type="application/ld+json"]');
  const schemasFound = [];
  const globalIssues = [];

  if (scriptEls.length === 0) {
    globalIssues.push({ type: 'warning', message: 'No JSON-LD structured data (<script type="application/ld+json">) found on this page.' });
  }

  scriptEls.forEach((script, idx) => {
    const rawContent = script.textContent.trim();
    if (!rawContent) return;

    let json;
    try {
      json = JSON.parse(rawContent);
    } catch (e) {
      schemasFound.push({
        index: idx + 1,
        type: 'Invalid JSON',
        rawContent,
        issues: [{ type: 'error', message: 'Syntax Error: Could not parse JSON-LD payload. Fix invalid JSON characters.' }]
      });
      return;
    }

    // Handle @graph array or single object
    const schemaItems = Array.isArray(json) ? json : (json['@graph'] || [json]);

    schemaItems.forEach((item, itemIdx) => {
      const type = item['@type'] || 'Unknown / Missing @type';
      const context = item['@context'];
      const issues = [];

      // Base checks
      if (!context) {
        issues.push({ type: 'warning', message: 'Missing @context (expected "https://schema.org")' });
      }

      if (!item['@type']) {
        issues.push({ type: 'error', message: 'Missing required property "@type"' });
      }

      // Type-specific field validations
      if (type === 'Product') {
        if (!item.name) issues.push({ type: 'error', message: 'Product schema missing required field "name"' });
        if (!item.offers) issues.push({ type: 'warning', message: 'Product schema recommended field "offers" is missing' });
        if (!item.aggregateRating) issues.push({ type: 'info', message: 'Product schema optional field "aggregateRating" is missing' });
      } else if (type === 'Article' || type === 'NewsArticle' || type === 'BlogPosting') {
        if (!item.headline) issues.push({ type: 'error', message: 'Article schema missing required field "headline"' });
        if (!item.author) issues.push({ type: 'warning', message: 'Article schema recommended field "author" is missing' });
        if (!item.datePublished) issues.push({ type: 'warning', message: 'Article schema recommended field "datePublished" is missing' });
        if (!item.image) issues.push({ type: 'info', message: 'Article schema recommended field "image" is missing' });
      } else if (type === 'FAQPage') {
        if (!item.mainEntity || !Array.isArray(item.mainEntity)) {
          issues.push({ type: 'error', message: 'FAQPage schema requires "mainEntity" array of Question objects' });
        }
      } else if (type === 'LocalBusiness' || type === 'Organization') {
        if (!item.name) issues.push({ type: 'error', message: 'Missing required field "name"' });
        if (!item.address) issues.push({ type: 'warning', message: 'Missing recommended field "address"' });
        if (!item.telephone) issues.push({ type: 'info', message: 'Missing optional field "telephone"' });
      }

      if (issues.filter(i => i.type === 'error').length === 0) {
        issues.push({ type: 'success', message: `Valid ${type} schema structure!` });
      }

      schemasFound.push({
        index: `${idx + 1}.${itemIdx + 1}`,
        type,
        context: context || 'None',
        propertiesCount: Object.keys(item).length,
        jsonPayload: item,
        issues
      });
    });
  });

  return {
    url: targetUrl,
    totalSchemas: schemasFound.length,
    schemas: schemasFound,
    globalIssues
  };
}
