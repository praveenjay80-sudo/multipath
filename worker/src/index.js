const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

function titleWords(t) {
  return t.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 3);
}

function titlesMatch(a, b) {
  const wa = titleWords(a), wb = titleWords(b);
  if (!wa.length || !wb.length) return false;
  const shared = wa.filter(w => wb.includes(w)).length;
  const threshold = Math.max(1, Math.floor(Math.min(wa.length, wb.length) * 0.5));
  return shared >= threshold;
}

function extractYear(summary) {
  if (!summary) return null;
  const m = summary.match(/\b(19|20)\d{2}\b/);
  return m ? parseInt(m[0]) : null;
}

async function scholarSearch(title, author, apiKey) {
  const q = [title, author].filter(Boolean).join(' ');
  const url = `https://serpapi.com/search?engine=google_scholar&q=${encodeURIComponent(q)}&num=10&api_key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`SerpAPI ${res.status}`);
  const data = await res.json();
  const results = data.organic_results || [];

  // Collect all title matches, then pick the highest-cited one.
  // "First match" fails for short titles like "A Theory of Justice" where an
  // obscure paper can appear before the canonical work in Scholar results.
  const matches = results.filter(r => titlesMatch(r.title || '', title));
  if (!matches.length) return null;
  const match = matches.reduce((best, r) => {
    const bc = best.inline_links?.cited_by?.total ?? 0;
    const rc = r.inline_links?.cited_by?.total ?? 0;
    return rc > bc ? r : best;
  });

  return {
    citationCount: match.inline_links?.cited_by?.total ?? null,
    title: match.title,
    year: extractYear(match.publication_info?.summary),
    link: match.link || null,
  };
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS });
    }

    const url = new URL(request.url);

    if (url.pathname !== '/enrich') {
      return json({ error: 'Not found' }, 404);
    }

    const title = url.searchParams.get('title')?.trim();
    const author = url.searchParams.get('author')?.trim() || '';

    if (!title) return json({ error: 'title required' }, 400);
    if (!env.SERPAPI_KEY) return json({ error: 'SERPAPI_KEY not configured' }, 500);

    try {
      // Check KV cache first
      const cacheKey = `scholar:${title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 60)}`;
      if (env.CACHE) {
        const cached = await env.CACHE.get(cacheKey);
        if (cached) return json(JSON.parse(cached));
      }

      const result = await scholarSearch(title, author, env.SERPAPI_KEY);

      // Cache for 7 days
      if (env.CACHE && result) {
        await env.CACHE.put(cacheKey, JSON.stringify(result), { expirationTtl: 604800 });
      }

      return json(result);
    } catch (err) {
      return json({ error: err.message }, 500);
    }
  },
};
