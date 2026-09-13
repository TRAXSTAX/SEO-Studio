// Uses native global fetch

/**
 * Discovers keyword ideas using Google Autocomplete and query expansions.
 * @param {string} seed - The seed keyword
 * @param {Object} options - Options (lang, country)
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<Array<{keyword: string, source: string, modifier: string}>>}
 */
export async function discoverKeywords(seed, options = {}, onProgress = null) {
  if (!seed || !seed.trim()) return [];
  const cleanSeed = seed.trim().toLowerCase();
  
  const results = new Map(); // keyword -> { keyword, source, modifier }
  
  const addKeyword = (kw, source, modifier) => {
    const k = kw.trim().toLowerCase();
    if (k && k !== cleanSeed && !results.has(k)) {
      results.set(k, { keyword: k, source, modifier });
    }
  };

  const notify = (msg) => {
    if (onProgress) onProgress(msg);
  };

  notify(`Fetching direct suggestions for "${cleanSeed}"...`);
  
  // Helper to fetch Google Autocomplete suggestions
  const fetchSuggestions = async (query) => {
    try {
      const url = `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(query)}`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        signal: AbortSignal.timeout(5000)
      });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data[1]) ? data[1] : [];
    } catch (e) {
      return [];
    }
  };

  // 1. Direct suggestions
  const direct = await fetchSuggestions(cleanSeed);
  direct.forEach(k => addKeyword(k, 'Direct Suggestion', '—'));

  // 2. Alphabet modifiers (a-z)
  notify(`Scanning A-Z modifiers...`);
  const alphabet = 'abcdefghijklmnopqrstuvwxyz'.split('');
  
  // Batch requests in groups of 5 to be polite
  for (let i = 0; i < alphabet.length; i += 5) {
    const chunk = alphabet.slice(i, i + 5);
    notify(`Scanning modifiers: ${chunk.join(', ').toUpperCase()}... (${results.size} found so far)`);
    
    await Promise.all(chunk.map(async (letter) => {
      const kwBefore = await fetchSuggestions(`${cleanSeed} ${letter}`);
      kwBefore.forEach(k => addKeyword(k, 'Alphabet Modifier', `${letter} (suffix)`));

      const kwAfter = await fetchSuggestions(`${letter} ${cleanSeed}`);
      kwAfter.forEach(k => addKeyword(k, 'Alphabet Modifier', `${letter} (prefix)`));
    }));
    
    // Polite delay
    await new Promise(r => setTimeout(r, 150));
  }

  // 3. Question & Preposition modifiers
  notify(`Scanning question & comparison modifiers...`);
  const questions = ['how to', 'what is', 'why does', 'can', 'where to', 'best', 'vs', 'for', 'with', 'without'];
  
  for (let i = 0; i < questions.length; i += 3) {
    const chunk = questions.slice(i, i + 3);
    await Promise.all(chunk.map(async (q) => {
      const suggestions = await fetchSuggestions(`${q} ${cleanSeed}`);
      suggestions.forEach(k => addKeyword(k, 'Question / Intent Modifier', q));
    }));
    await new Promise(r => setTimeout(r, 150));
  }

  notify(`Discovery complete! Found ${results.size} unique keywords.`);
  return Array.from(results.values());
}
