import { useState, useCallback, useRef } from 'react';

const OA_BASE = 'https://api.openalex.org';
const OA_FIELDS = 'title,publication_year,cited_by_count,fwci,type,open_access,cited_by_percentile_year,primary_location';

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

// CrossRef — DOI, type, publisher
async function crossrefLookup(title, author) {
  const q = [title, author].filter(Boolean).join(' ');
  try {
    const res = await fetch(`https://api.crossref.org/works?query=${encodeURIComponent(q)}&rows=5&mailto=canon-app@example.com`);
    if (!res.ok) return null;
    const { message } = await res.json();
    const match = (message?.items || []).find(item => titlesMatch((item.title || [])[0] || '', title));
    if (!match) return null;
    return {
      type: match.type || null,
      doi: match.DOI || null,
    };
  } catch { return null; }
}

// OpenAlex — FWCI, Open Access, percentile, venue
async function oaLookup(title) {
  const encoded = encodeURIComponent(title);
  try {
    let res = await fetch(`${OA_BASE}/works?filter=title.search:${encoded}&select=${OA_FIELDS}&per_page=5&mailto=canon-app`);
    let results = [];
    if (res.ok) { const data = await res.json(); results = data.results || []; }
    if (!results.length) {
      res = await fetch(`${OA_BASE}/works?search=${encoded}&select=${OA_FIELDS}&per_page=8&mailto=canon-app`);
      if (res.ok) { const data = await res.json(); results = data.results || []; }
    }
    const match = results.find(r => titlesMatch(r.title || '', title));
    if (!match) return null;
    return {
      fwci: typeof match.fwci === 'number' ? match.fwci : null,
      type: match.type || null,
      isOA: match.open_access?.is_oa ?? false,
      oaUrl: match.open_access?.oa_url || null,
      percentile: match.cited_by_percentile_year?.min ?? null,
      venue: match.primary_location?.source?.display_name || null,
    };
  } catch { return null; }
}

async function oaTopicSearch(topic, limit = 40) {
  const url = `${OA_BASE}/works?search=${encodeURIComponent(topic)}&select=title,authorships,publication_year,cited_by_count,fwci,type,open_access,primary_location&per_page=${limit}&sort=cited_by_count:desc&mailto=canon-app`;
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const { results = [] } = await res.json();
    return results.map(w => ({
      title: w.title || '',
      authors: (w.authorships || []).map(a => a.author?.display_name).filter(Boolean).slice(0, 3).join(', '),
      year: w.publication_year,
      citationCount: w.cited_by_count ?? null,
      fwci: typeof w.fwci === 'number' ? w.fwci : null,
      type: w.type || null,
      isOA: w.open_access?.is_oa ?? false,
      oaUrl: w.open_access?.oa_url || null,
      venue: w.primary_location?.source?.display_name || null,
    }));
  } catch { return []; }
}

export function useEnrichment() {
  const [status, setStatus] = useState('idle');
  const [citations, setCitations] = useState({});
  const [missing, setMissing] = useState([]);
  const [progress, setProgress] = useState('');
  const [found, setFound] = useState(0);
  const abortRef = useRef(null);

  function citationKey(title) {
    return title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 60);
  }

  function getCitation(title) {
    return citations[citationKey(title)] || null;
  }

  const enrich = useCallback(async (parsed) => {
    if (!parsed) return;
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setStatus('running');
    setCitations({});
    setMissing([]);
    setFound(0);

    const entries = parsed.tiers.flatMap(t => t.entries || []);
    const topic = parsed.topic || '';
    let foundCount = 0;

    try {
      for (let i = 0; i < entries.length; i++) {
        if (abortRef.current?.signal.aborted) break;
        const entry = entries[i];
        setProgress(`${i + 1}/${entries.length} — ${entry.title.slice(0, 40)}`);

        // CrossRef (DOI + type) and OpenAlex (FWCI + OA) in parallel
        // Scholar citation counts come from the generator's candidate enrichment
        const [cr, oa] = await Promise.all([
          crossrefLookup(entry.title, entry.author),
          oaLookup(entry.title),
        ]);

        if (cr || oa) {
          foundCount++;
          setFound(foundCount);
          const merged = {
            type: cr?.type ?? oa?.type ?? null,
            fwci: oa?.fwci ?? null,
            isOA: oa?.isOA ?? false,
            oaUrl: oa?.oaUrl ?? null,
            percentile: oa?.percentile ?? null,
            venue: oa?.venue ?? null,
            doi: cr?.doi ?? null,
          };
          setCitations(prev => ({ ...prev, [citationKey(entry.title)]: merged }));
        }

        await new Promise(r => setTimeout(r, 150));
      }

      if (!abortRef.current?.signal.aborted && topic) {
        setProgress('Scanning for missing high-impact works...');
        const topWorks = await oaTopicSearch(topic, 40);
        const canonTitles = entries.map(e => e.title);
        const seen = new Set();
        const gaps = topWorks
          .filter(w => {
            if (!w.title || (w.citationCount || 0) < 300) return false;
            const key = w.title.toLowerCase().slice(0, 30);
            if (seen.has(key)) return false;
            seen.add(key);
            return !canonTitles.some(ct => titlesMatch(ct, w.title));
          })
          .slice(0, 8);
        setMissing(gaps);
      }

      setStatus('done');
      setProgress('');
    } catch {
      setStatus('done');
      setProgress('');
    }
  }, []);

  const clear = useCallback(() => {
    abortRef.current?.abort();
    setStatus('idle');
    setCitations({});
    setMissing([]);
    setProgress('');
    setFound(0);
  }, []);

  return { status, progress, found, getCitation, missing, enrich, clear };
}
