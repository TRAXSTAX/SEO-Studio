const BASE_URL = 'http://localhost:3000';

async function testPost(endpoint, body, isSSE = false) {
  console.log(`\n[API TEST] POST ${endpoint}...`);
  try {
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    }
    
    if (isSSE) {
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let output = '';
      while (!done) {
        const { value, done: readerDone } = await reader.read();
        if (value) {
          output += decoder.decode(value);
        }
        done = readerDone;
      }
      console.log(`✓ [SSE] ${endpoint} -> Output length: ${output.length} bytes`);
      return { success: true };
    } else {
      const text = await res.text();
      let data = text;
      try { data = JSON.parse(text); } catch (e) {}
      console.log(`✓ [OK] ${endpoint} -> Response:`, typeof data === 'string' ? data.slice(0, 100) : JSON.stringify(data).slice(0, 100));
      return { success: true, data };
    }
  } catch (err) {
    console.error(`✕ [FAIL] POST ${endpoint}:`, err.message);
    return { success: false, error: err.message };
  }
}

async function testGet(endpoint) {
  console.log(`\n[API TEST] GET ${endpoint}...`);
  try {
    const res = await fetch(`${BASE_URL}${endpoint}`);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    }
    const data = await res.json().catch(() => res.text());
    console.log(`✓ [GET] ${endpoint} -> Response:`, JSON.stringify(data).slice(0, 120));
    return { success: true, data };
  } catch (err) {
    console.error(`✕ [FAIL] GET ${endpoint}:`, err.message);
    return { success: false, error: err.message };
  }
}

async function runTests() {
  console.log('=== STARTING BACKEND API SUITE AUDIT ===');
  const tests = [
    () => testPost('/api/intent/map', { keywords: ["buy shoes online", "what is seo"] }, true),
    () => testPost('/api/keywords/discover', { seed: "seo tools" }, true),
    () => testPost('/api/keywords/cluster', { keywords: ["seo tools", "best seo tools", "buy shoes", "running shoes"] }),
    () => testPost('/api/sitemap/generate', { urls: ["https://example.com", "https://example.com/about"] }),
    () => testPost('/api/robots/analyze', { url: "https://example.com" }),
    () => testPost('/api/robots/test', { rules: [{ agent: "*", type: "Disallow", path: "/admin" }], testPath: "/admin", userAgent: "Googlebot" }),
    () => testPost('/api/headings/analyze', { url: "https://example.com" }),
    () => testPost('/api/schema/validate', { url: "https://example.com" }),
    () => testPost('/api/bulk/check', { urls: ["https://example.com"] }, true),
    () => testGet('/api/history'),
    () => testGet('/api/rank/history?keyword=seo&url=https://example.com')
  ];

  let passed = 0;
  let failed = 0;

  for (const t of tests) {
    const result = await t();
    if (result.success) passed++;
    else failed++;
  }

  console.log(`\n========================================`);
  console.log(`Backend API Audit Complete: ${passed} PASSED, ${failed} FAILED.`);
  console.log(`========================================`);
  
  if (failed > 0) process.exit(1);
}

runTests();
