/**
 * Groups keywords into semantic clusters using n-gram overlap and Jaccard similarity.
 * @param {Array<string>} keywords - List of raw keyword strings
 * @param {number} threshold - Similarity threshold (0.1 to 0.7, default 0.3)
 * @returns {{ clusters: Array<{ label: string, keywords: string[], size: number }>, unclustered: string[] }}
 */
export function clusterKeywords(keywords = [], threshold = 0.3) {
  if (!Array.isArray(keywords) || keywords.length === 0) {
    return { clusters: [], unclustered: [] };
  }

  // Stopwords to filter out when tokenizing n-grams
  const STOPWORDS = new Set([
    'a', 'an', 'the', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'and', 'or', 'is', 'are', 'by', 'how', 'what', 'why', 'can', 'best', 'top'
  ]);

  // Helper: tokenize text into unigrams & bigrams
  const tokenize = (text) => {
    const words = text.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 1 && !STOPWORDS.has(w));

    const ngrams = new Set(words);
    for (let i = 0; i < words.length - 1; i++) {
      ngrams.add(`${words[i]} ${words[i + 1]}`);
    }
    return ngrams;
  };

  // Helper: Jaccard similarity between two token sets
  const jaccardSimilarity = (setA, setB) => {
    if (setA.size === 0 || setB.size === 0) return 0;
    let intersection = 0;
    for (const item of setA) {
      if (setB.has(item)) intersection++;
    }
    const union = setA.size + setB.size - intersection;
    return union === 0 ? 0 : intersection / union;
  };

  // Pre-tokenize all clean keywords
  const cleanList = Array.from(new Set(keywords.map(k => k.trim()).filter(Boolean)));
  const itemTokens = cleanList.map(kw => ({
    keyword: kw,
    tokens: tokenize(kw)
  }));

  const assigned = new Array(itemTokens.length).fill(false);
  const clusters = [];

  // Group keywords iteratively based on pairwise similarity
  for (let i = 0; i < itemTokens.length; i++) {
    if (assigned[i]) continue;

    const currentCluster = [itemTokens[i].keyword];
    assigned[i] = true;

    // Union of tokens in the current cluster
    const clusterTokens = new Set(itemTokens[i].tokens);

    for (let j = i + 1; j < itemTokens.length; j++) {
      if (assigned[j]) continue;

      const sim = jaccardSimilarity(clusterTokens, itemTokens[j].tokens);
      if (sim >= threshold) {
        currentCluster.push(itemTokens[j].keyword);
        assigned[j] = true;
        // Merge tokens
        itemTokens[j].tokens.forEach(t => clusterTokens.add(t));
      }
    }

    if (currentCluster.length > 1) {
      // Determine cluster label: find the most frequent non-stopword in the cluster
      const wordCounts = {};
      currentCluster.forEach(kw => {
        kw.toLowerCase().split(/\s+/).forEach(w => {
          if (!STOPWORDS.has(w) && w.length > 2) {
            wordCounts[w] = (wordCounts[w] || 0) + 1;
          }
        });
      });

      const topWords = Object.entries(wordCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(e => e[0].toUpperCase());

      const label = topWords.length > 0 ? topWords.join(' & ') + ' Cluster' : `Cluster ${clusters.length + 1}`;

      clusters.push({
        label,
        keywords: currentCluster,
        size: currentCluster.length
      });
    } else {
      // Unmark so singletons can be collected as unclustered
      assigned[i] = false;
    }
  }

  // Collect unclustered keywords
  const unclustered = [];
  for (let i = 0; i < itemTokens.length; i++) {
    if (!assigned[i]) {
      unclustered.push(itemTokens[i].keyword);
    }
  }

  // Sort clusters by size descending
  clusters.sort((a, b) => b.size - a.size);

  return { clusters, unclustered };
}
