// Uses native global fetch
import { parse } from 'node-html-parser';

/**
 * Checks URLs for duplicate / thin content using SimHash and word shingles.
 * @param {Array<string>} urls 
 * @param {Function} onProgress 
 * @param {Function} onResult 
 * @returns {Promise<Object>}
 */
export async function checkDuplicateContent(urls, onProgress = null, onResult = null) {
  const notify = (msg) => { if (onProgress) onProgress(msg); };

  const cleanUrls = Array.from(new Set(urls.map(u => u.trim()).filter(u => u.startsWith('http'))));
  if (cleanUrls.length === 0) return { duplicates: [], thinPages: [] };

  notify(`Fetching ${cleanUrls.length} pages to extract main content...`);

  const pagesData = [];

  // Fetch in chunks of 5
  for (let i = 0; i < cleanUrls.length; i += 5) {
    const chunk = cleanUrls.slice(i, i + 5);
    notify(`Fetching pages ${i + 1} - ${Math.min(i + 5, cleanUrls.length)} of ${cleanUrls.length}...`);

    await Promise.all(chunk.map(async (url) => {
      try {
        const res = await fetch(url, {
          headers: { 'User-Agent': 'SEO-Studio-Bot/2.0' },
          signal: AbortSignal.timeout(8000)
        });
        if (!res.ok) return;

        const html = await res.text();
        const root = parse(html);

        // Remove nav, footer, script, style tags for main body text
        root.querySelectorAll('nav, footer, header, script, style, noscript, svg').forEach(el => el.remove());
        const bodyText = (root.querySelector('body')?.textContent || '').replace(/\s+/g, ' ').trim();
        const wordCount = bodyText ? bodyText.split(/\s+/).length : 0;
        const shingles = generateShingles(bodyText);

        pagesData.push({ url, wordCount, shingles, textSnippet: bodyText.substring(0, 150) });
      } catch (e) {
        // Skip failed fetches
      }
    }));
  }

  notify(`Content extracted for ${pagesData.length} pages. Comparing similarity...`);

  const duplicatePairs = [];
  const thinPages = pagesData.filter(p => p.wordCount < 300);

  // Compare all pairs
  for (let i = 0; i < pagesData.length; i++) {
    for (let j = i + 1; j < pagesData.length; j++) {
      const pageA = pagesData[i];
      const pageB = pagesData[j];

      const similarity = calculateJaccardSimilarity(pageA.shingles, pageB.shingles);
      const similarityPct = Math.round(similarity * 100);

      if (similarityPct >= 60) {
        const pair = {
          urlA: pageA.url,
          urlB: pageB.url,
          similarity: similarityPct,
          status: similarityPct >= 85 ? 'Exact / Near-Exact Duplicate' : 'High Similarity Overlap'
        };
        duplicatePairs.push(pair);
        if (onResult) onResult({ type: 'duplicate', data: pair });
      }
    }
  }

  notify(`Analysis complete. Found ${duplicatePairs.length} duplicate pairs and ${thinPages.length} thin pages.`);

  return {
    totalChecked: pagesData.length,
    duplicatePairs,
    thinPages: thinPages.map(p => ({ url: p.url, wordCount: p.wordCount }))
  };
}

// Generate 3-word sliding window shingles
function generateShingles(text) {
  const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean);
  const shingles = new Set();
  for (let i = 0; i < words.length - 2; i++) {
    shingles.add(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
  }
  return shingles;
}

function calculateJaccardSimilarity(setA, setB) {
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}
