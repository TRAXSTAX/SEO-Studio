import { parse } from 'node-html-parser';
import puppeteer from 'puppeteer';
import { removeStopwords } from 'stopword';

export async function analyze(keyword, draftText, onProgress, onComplete, onError) {
  let browser;
  try {
    onProgress('Searching DuckDuckGo for top competitors...');
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(keyword)}`;
    
    // Boot headless browser to fetch search results (bypasses bot block)
    browser = await puppeteer.launch({
      headless: "new",
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36');
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
    
    const html = await page.content();
    const root = parse(html);
    
    const links = root.querySelectorAll('a.result__snippet');
    let urls = links.map(a => a.getAttribute('href')).filter(href => href && (href.startsWith('http') || href.startsWith('//')));
    // DuckDuckGo redirects sometimes look like //duckduckgo.com/l/?uddg=https...
    urls = urls.map(u => {
      if (u.includes('uddg=')) {
        try {
          return decodeURIComponent(u.split('uddg=')[1].split('&')[0]);
        } catch (e) { return u; }
      }
      return u;
    });

    urls = [...new Set(urls)].slice(0, 5);
    
    let allCompetitorText = '';
    if (urls.length === 0) {
      onProgress('Using default semantic dictionary for keyword fallback...');
      allCompetitorText = `${keyword} optimization analysis search strategy authority keywords content quality page speed technical audit backlinks indexing user experience performance ranking authority schema metadata internal links SERP tracking`;
    } else {
      onProgress(`Found ${urls.length} competitors. Scraping contents...`);
      
      for (let i = 0; i < urls.length; i++) {
        onProgress(`Scraping competitor ${i + 1}/${urls.length}: ${urls[i]}`);
        let page;
        try {
          page = await browser.newPage();
          await page.goto(urls[i], { waitUntil: 'networkidle2', timeout: 15000 });
          
          // Extract visible text from main areas
          const text = await page.evaluate(() => {
            const main = document.querySelector('article, main, .content, #content') || document.body;
            if (!main) return '';
            const elements = main.querySelectorAll('script, style, nav, footer, header');
            elements.forEach(el => el.remove());
            return main.innerText;
          });
          
          allCompetitorText += ' ' + text;
        } catch (err) {
          console.warn(`Failed to scrape ${urls[i]}: ${err.message}`);
        } finally {
          if (page) try { await page.close(); } catch(e) {}
        }
      }
    }
    
    onProgress('Analyzing semantic entities (NLP)...');

    // Simple NLP Pipeline
    const entities = extractEntities(allCompetitorText);
    
    onProgress('Scoring your draft against competitors...');
    
    const draftTextLower = draftText.toLowerCase();
    let score = 0;
    const missing = [];
    const found = [];

    entities.forEach(entity => {
      if (draftTextLower.includes(entity)) {
        score++;
        found.push(entity);
      } else {
        missing.push(entity);
      }
    });

    const percentage = entities.length > 0 ? score / entities.length : 0;
    let grade = 'F';
    if (percentage > 0.9) grade = 'A+';
    else if (percentage > 0.8) grade = 'A';
    else if (percentage > 0.7) grade = 'B';
    else if (percentage > 0.6) grade = 'C';
    else if (percentage > 0.4) grade = 'D';

    onComplete({
      grade,
      score,
      total: entities.length,
      percentage: Math.round(percentage * 100),
      found,
      missing,
      competitorsScraped: urls.length
    });

  } catch (error) {
    console.error("Analyzer Error:", error);
    onError(error.message);
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (e) {}
    }
  }
}

function extractEntities(text) {
  // Normalize and split into words
  const words = text.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '') // remove punctuation
    .split(/\s+/)
    .filter(w => w.length > 2); // remove very short words

  // Remove stopwords
  const cleanWords = removeStopwords(words);
  
  // Count frequency (unigrams)
  const freq = {};
  cleanWords.forEach(w => {
    freq[w] = (freq[w] || 0) + 1;
  });

  // Extract bigrams (two-word phrases)
  const bigrams = {};
  for (let i = 0; i < cleanWords.length - 1; i++) {
    const bigram = `${cleanWords[i]} ${cleanWords[i+1]}`;
    bigrams[bigram] = (bigrams[bigram] || 0) + 1;
  }

  // Combine and sort
  const allFreq = { ...freq };
  // Give bigrams slightly more weight in ranking if they appear multiple times
  Object.keys(bigrams).forEach(bg => {
     if (bigrams[bg] > 2) {
         allFreq[bg] = bigrams[bg] * 2; 
     }
  });

  const sorted = Object.entries(allFreq)
    .sort((a, b) => b[1] - a[1])
    .filter(a => isNaN(a[0])) // filter out pure numbers
    .map(a => a[0])
    .slice(0, 30); // Top 30 semantic entities

  return sorted;
}
