// Exa search — the loop's exploration operator. Falls back to clearly-labeled
// mock results when EXA_API_KEY is missing or the request fails, so the
// machinery stays testable offline. Mock results are always marked "[mock]".
import './env.mjs';

export async function exaSearch(query, { numResults = 3 } = {}) {
  const key = process.env.EXA_API_KEY;
  if (!key || process.env.EXA_MOCK === '1') return mockResults(query, numResults);
  try {
    const res = await fetch('https://api.exa.ai/search', {
      method: 'POST',
      headers: { 'x-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        numResults,
        type: 'auto',
        contents: { highlights: { numSentences: 2, highlightsPerUrl: 1 } },
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`exa ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = await res.json();
    return (data.results || []).map((r) => ({
      title: r.title || r.url,
      url: r.url,
      snippet: (r.highlights && r.highlights[0]) || (r.text || '').slice(0, 280),
    }));
  } catch (e) {
    process.stderr.write(`  warn: exa search failed (${e.message}); using mock results\n`);
    return mockResults(query, numResults);
  }
}

function mockResults(query, n) {
  return Array.from({ length: n }, (_, i) => ({
    title: `[mock] Result ${i + 1} for "${query.slice(0, 60)}"`,
    url: `https://example.com/mock/${encodeURIComponent(query.slice(0, 30))}/${i + 1}`,
    snippet: `Mock snippet ${i + 1} — offline placeholder for development without an Exa key.`,
  }));
}
