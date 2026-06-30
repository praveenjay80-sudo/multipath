import { useState, useCallback } from 'react';

const OA_BASE = 'https://api.openalex.org';
const OA_FIELDS = 'title,authorships,publication_year,cited_by_count,fwci,type,open_access,cited_by_percentile_year,primary_location';

function titleWords(t) {
  return t.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 4);
}

function titlesOverlap(a, b) {
  const wa = titleWords(a), wb = titleWords(b);
  return wa.filter(w => wb.includes(w)).length >= Math.min(2, Math.floor(Math.min(wa.length, wb.length) * 0.4));
}

async function fetchCitation(title, author, year) {
  const query = [title, author].filter(Boolean).join(' ');
  const url = `${OA_BASE}/works?search=${encodeURIComponent(query)}&select=${OA_FIELDS}&per_page=5&mailto=canon-app`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const { results = [] } = await res.json();
    const match = results.find(r =>
      titlesOverlap(r.title || '', title) &&
      (!year || !r.publication_year || Math.abs(r.publication_year - parseInt(year)) <= 3)
    );
    if (!match) return null;
    return {
      citationCount: match.cited_by_count ?? null,
      fwci: typeof match.fwci === 'number' ? match.fwci : null,
      type: match.type || null,
      isOA: match.open_access?.is_oa ?? false,
      oaUrl: match.open_access?.oa_url || null,
      percentile: match.cited_by_percentile_year?.min ?? null,
      venue: match.primary_location?.source?.display_name || null,
    };
  } catch {
    return null;
  }
}

export function useCitationData() {
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(false);

  const enrich = useCallback(async (parsed) => {
    if (!parsed) return;
    setData({});
    setLoading(true);

    const entries = parsed.tiers.flatMap(t => t.entries || []);

    for (const entry of entries) {
      const key = entry.title.toLowerCase().slice(0, 40);
      const result = await fetchCitation(entry.title, entry.author, entry.year);
      if (result) {
        setData(prev => ({ ...prev, [key]: result }));
      }
      await new Promise(r => setTimeout(r, 130));
    }

    setLoading(false);
  }, []);

  const clear = useCallback(() => {
    setData({});
    setLoading(false);
  }, []);

  function get(title) {
    return data[title.toLowerCase().slice(0, 40)] || null;
  }

  return { enrich, clear, get, loading };
}
