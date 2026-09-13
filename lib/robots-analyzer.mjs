// Uses native global fetch

/**
 * Fetches and analyzes robots.txt for a given target domain or URL.
 * @param {string} inputUrl 
 * @returns {Promise<Object>} Analysis results & parsed directives
 */
export async function analyzeRobots(inputUrl) {
  let targetUrl = inputUrl.trim();
  if (!targetUrl.startsWith('http')) {
    targetUrl = 'https://' + targetUrl;
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(targetUrl);
  } catch (e) {
    throw new Error('Invalid URL format');
  }

  const robotsUrl = `${parsedUrl.protocol}//${parsedUrl.host}/robots.txt`;

  const res = await fetch(robotsUrl, {
    headers: { 'User-Agent': 'SEO-Studio-Bot/2.0' },
    signal: AbortSignal.timeout(7000)
  });

  if (!res.ok) {
    if (res.status === 404) {
      return {
        robotsUrl,
        found: false,
        issues: [{ type: 'info', message: 'No robots.txt file found (404). Search engines have full access to crawl all pages.' }],
        sitemaps: [],
        rules: []
      };
    }
    throw new Error(`Failed to fetch robots.txt (HTTP ${res.status})`);
  }

  const text = await res.text();
  const lines = text.split('\n');

  const sitemaps = [];
  const rules = [];
  const issues = [];

  let currentAgent = '*';

  lines.forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) return;

    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) return;

    const directive = line.substring(0, colonIdx).trim().toLowerCase();
    const value = line.substring(colonIdx + 1).trim();

    if (directive === 'user-agent') {
      currentAgent = value;
    } else if (directive === 'disallow') {
      rules.push({ agent: currentAgent, type: 'Disallow', path: value, line: index + 1 });
      if (value === '/' && currentAgent === '*') {
        issues.push({ type: 'error', message: 'CRITICAL: Site disallows all crawlers (Disallow: / for User-agent: *)' });
      }
      if (value.includes('/wp-content/uploads/') || value.includes('/images/')) {
        issues.push({ type: 'warning', message: `Disallow directive blocks image assets: "${value}"` });
      }
      if (value.includes('.css') || value.includes('.js')) {
        issues.push({ type: 'warning', message: `Disallow directive blocks CSS/JS render assets: "${value}"` });
      }
    } else if (directive === 'allow') {
      rules.push({ agent: currentAgent, type: 'Allow', path: value, line: index + 1 });
    } else if (directive === 'sitemap') {
      sitemaps.push(value);
    }
  });

  if (sitemaps.length === 0) {
    issues.push({ type: 'warning', message: 'No Sitemap directive found in robots.txt' });
  } else {
    issues.push({ type: 'success', message: `Found ${sitemaps.length} Sitemap directive(s)` });
  }

  if (issues.filter(i => i.type === 'error').length === 0) {
    issues.push({ type: 'success', message: 'robots.txt is syntactically valid and non-blocking' });
  }

  return {
    robotsUrl,
    found: true,
    rawText: text,
    sitemaps,
    rules,
    issues
  };
}

/**
 * Tests if a path is allowed for a given user-agent based on parsed rules.
 * @param {Array<Object>} rules 
 * @param {string} testPath 
 * @param {string} userAgent 
 * @returns {Object} { allowed: boolean, matchedRule: Object|null }
 */
export function testPathAccess(rules = [], testPath = '/', userAgent = 'Googlebot') {
  const cleanPath = testPath.startsWith('/') ? testPath : '/' + testPath;
  const agentLower = userAgent.toLowerCase();

  // Filter rules matching userAgent or '*'
  const matchingRules = rules.filter(r => r.agent === '*' || r.agent.toLowerCase().includes(agentLower));

  let matchedRule = null;
  let allowed = true;

  // Find longest prefix match
  let longestMatchLen = -1;

  matchingRules.forEach(r => {
    if (!r.path) return;
    if (cleanPath.startsWith(r.path) && r.path.length > longestMatchLen) {
      longestMatchLen = r.path.length;
      matchedRule = r;
      allowed = r.type === 'Allow';
    }
  });

  return {
    testPath: cleanPath,
    userAgent,
    allowed,
    matchedRule: matchedRule ? `${matchedRule.type}: ${matchedRule.path} (line ${matchedRule.line})` : 'Default Allow'
  };
}
