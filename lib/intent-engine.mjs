const INTENT_PATTERNS = {
  Informational: [
    'how to', 'what is', 'what are', 'why', 'when', 'where', 'who', 'which', 
    'guide', 'tutorial', 'tips', 'ideas', 'examples', 'definition', 'meaning', 
    'difference between', 'explain', 'learn', 'understanding'
  ],
  Transactional: [
    'buy', 'price', 'cheap', 'deal', 'discount', 'coupon', 'order', 'purchase', 
    'sale', 'shipping', 'delivery', 'subscribe', 'download', 'hire', 'book', 
    'rent', 'for sale', 'shop', 'free trial'
  ],
  Commercial: [
    'best', 'top', 'review', 'reviews', 'vs', 'versus', 'comparison', 'compare', 
    'alternative', 'alternatives', 'pros and cons', 'worth it', 'should i', 
    'is it good', 'recommend'
  ],
  Navigational: [
    'login', 'sign in', 'sign up', 'account', 'dashboard', 'support', 'contact', 
    'customer service', 'official', 'website', '.com', '.org', '.net'
  ]
};

/**
 * Helper to classify a single keyword synchronously
 */
function classifySingle(keyword) {
  const scores = {
    Informational: 0,
    Transactional: 0,
    Commercial: 0,
    Navigational: 0
  };
  
  const signals = [];
  const lowerKeyword = keyword.toLowerCase();

  for (const [intent, patterns] of Object.entries(INTENT_PATTERNS)) {
    for (const pattern of patterns) {
      let isMatch = false;
      if (pattern.startsWith('.')) {
        isMatch = lowerKeyword.includes(pattern);
      } else {
        // Use word boundaries to avoid partial matches like "top" in "stop"
        const regex = new RegExp(`\\b${pattern}\\b`, 'i');
        isMatch = regex.test(keyword);
      }
      
      if (isMatch) {
        scores[intent] += 1;
        signals.push(pattern);
      }
    }
  }

  let totalScore = 0;
  let maxScore = -1;
  let dominantIntent = 'Informational';

  for (const [intent, score] of Object.entries(scores)) {
    totalScore += score;
    if (score > maxScore) {
      maxScore = score;
      dominantIntent = intent;
    }
  }

  // Fallback if no patterns match
  if (totalScore === 0) {
    return {
      keyword,
      intent: 'Informational',
      confidence: 50,
      signals: []
    };
  }

  // Calculate confidence based on the ratio of maxScore to total matched patterns
  const confidence = Math.round((maxScore / totalScore) * 100);

  return {
    keyword,
    intent: dominantIntent,
    confidence,
    signals
  };
}

/**
 * Analyze a single keyword's intent (async for backward compatibility)
 * @param {string} keyword 
 * @returns {Promise<Object>}
 */
export async function analyzeIntent(keyword) {
  return classifySingle(keyword);
}

/**
 * Instantly classify an array of keywords
 * @param {string[]} keywords 
 * @returns {Object[]}
 */
export function classifyIntentBatch(keywords) {
  if (!Array.isArray(keywords)) {
    return [];
  }
  return keywords.map(classifySingle);
}
