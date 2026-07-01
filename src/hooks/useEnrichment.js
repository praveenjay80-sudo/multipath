import { useState, useCallback, useRef } from 'react';

const OA_BASE = 'https://api.openalex.org';
const OA_FIELDS = 'title,publication_year,cited_by_count,fwci,type,open_access,cited_by_percentile_year,primary_location,authorships';

function fetchWithTimeout(url, ms = 8000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(timer));
}

function titleWords(t) {
  return t.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 3);
}

function titlesMatch(a, b) {
  const wa = titleWords(a), wb = titleWords(b);
  if (!wa.length || !wb.length) return false;
  const shared = wa.filter(w => wb.includes(w)).length;
  // 0.75 threshold prevents false matches between same-author books with partial title overlap
  // (e.g. "Pattern Recognition and Machine Learning" vs "Neural Networks for Pattern Recognition")
  const threshold = Math.max(1, Math.floor(Math.min(wa.length, wb.length) * 0.75));
  return shared >= threshold;
}

// CrossRef — DOI, type, year, first author
async function crossrefLookup(title, author) {
  const q = [title, author].filter(Boolean).join(' ');
  try {
    const res = await fetchWithTimeout(`https://api.crossref.org/works?query=${encodeURIComponent(q)}&rows=5&mailto=canon-app@example.com`);
    if (!res.ok) return null;
    const { message } = await res.json();
    const match = (message?.items || []).find(item => titlesMatch((item.title || [])[0] || '', title));
    if (!match) return null;
    const year = match.published?.['date-parts']?.[0]?.[0] ?? null;
    const firstAuthor = match.author?.[0]
      ? [match.author[0].given, match.author[0].family].filter(Boolean).join(' ')
      : null;
    return { type: match.type || null, doi: match.DOI || null, year, firstAuthor };
  } catch { return null; }
}

// OpenAlex — FWCI, Open Access, percentile, venue, year, first author
async function oaLookup(title) {
  const encoded = encodeURIComponent(title);
  try {
    let res = await fetchWithTimeout(`${OA_BASE}/works?filter=title.search:${encoded}&select=${OA_FIELDS}&per_page=5&mailto=canon-app`);
    let results = [];
    if (res.ok) { const data = await res.json(); results = data.results || []; }
    if (!results.length) {
      res = await fetchWithTimeout(`${OA_BASE}/works?search=${encoded}&select=${OA_FIELDS}&per_page=8&mailto=canon-app`);
      if (res.ok) { const data = await res.json(); results = data.results || []; }
    }
    const match = results.find(r => titlesMatch(r.title || '', title));
    if (!match) return null;
    const firstAuthor = match.authorships?.[0]?.author?.display_name || null;
    return {
      fwci: typeof match.fwci === 'number' ? match.fwci : null,
      type: match.type || null,
      isOA: match.open_access?.is_oa ?? false,
      oaUrl: match.open_access?.oa_url || null,
      percentile: match.cited_by_percentile_year?.min ?? null,
      venue: match.primary_location?.source?.display_name || null,
      year: match.publication_year ?? null,
      firstAuthor,
    };
  } catch { return null; }
}

async function oaTopicSearch(topic, limit = 50) {
  const url = `${OA_BASE}/works?search=${encodeURIComponent(topic)}&select=title,authorships,publication_year,cited_by_count,fwci,type,open_access,primary_location&per_page=${limit}&sort=cited_by_count:desc&mailto=canon-app`;
  try {
    const res = await fetchWithTimeout(url);
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
  const [verifications, setVerifications] = useState({});
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

  function getVerification(title) {
    return verifications[citationKey(title)] || null;
  }

  const enrich = useCallback(async (parsed) => {
    if (!parsed) return;
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setStatus('running');
    setCitations({});
    setVerifications({});
    setMissing([]);
    setFound(0);

    const entries = parsed.tiers.flatMap(t => t.entries || []);
    const topic = parsed.topic || '';
    let foundCount = 0;

    try {
      for (let i = 0; i < entries.length; i++) {
        if (abortRef.current?.signal.aborted) break;
        const entry = entries[i];
        setProgress(`Verifying ${i + 1}/${entries.length} — ${entry.title.slice(0, 40)}`);

        try {
          const [cr, oa] = await Promise.all([
            crossrefLookup(entry.title, entry.author),
            oaLookup(entry.title),
          ]);

          const dbYear = cr?.year ?? oa?.year ?? null;
          const llmYear = entry.year ? parseInt(entry.year) : null;
          const yearDiff = dbYear && llmYear ? Math.abs(dbYear - llmYear) : 0;

          // Author disambiguation — detect title-collision false matches
          // (e.g. Hatcher "Algebraic Topology" matching Spanier's same-titled book)
          const lastNameOf = (name) =>
            (name || '').split(/[\s,]+/).filter(Boolean).pop()?.toLowerCase() || '';
          const entryLastName = lastNameOf(entry.author?.split(',')[0]);
          const dbLastName = lastNameOf(cr?.firstAuthor ?? oa?.firstAuthor);
          const isTitleCollision = entryLastName.length > 3 && dbLastName.length > 3 &&
            !dbLastName.includes(entryLastName) && !entryLastName.includes(dbLastName);

          // Reprint suppression — pre-1975 papers indexed under their collected-volume year
          // (e.g. Weinberg 1967 showing as 1992 because reprinted in a collection)
          const isLikelyReprint = !!(llmYear && dbYear && dbYear > llmYear &&
            (dbYear - llmYear) > 20 && llmYear < 1975);

          const verifiedFound = !!(cr || oa) && !isTitleCollision;
          const showYearMismatch = yearDiff > 2 && !isLikelyReprint && !isTitleCollision;

          setVerifications(prev => ({
            ...prev,
            [citationKey(entry.title)]: {
              found: verifiedFound,
              source: verifiedFound ? (cr ? 'crossref' : 'openalex') : null,
              yearMismatch: showYearMismatch ? { llm: llmYear, db: dbYear } : null,
              dbFirstAuthor: cr?.firstAuthor ?? oa?.firstAuthor ?? null,
            },
          }));

          if (verifiedFound) {
            foundCount++;
            setFound(foundCount);
            setCitations(prev => ({
              ...prev,
              [citationKey(entry.title)]: {
                type: cr?.type ?? oa?.type ?? null,
                fwci: oa?.fwci ?? null,
                isOA: oa?.isOA ?? false,
                oaUrl: oa?.oaUrl ?? null,
                percentile: oa?.percentile ?? null,
                venue: oa?.venue ?? null,
                doi: cr?.doi ?? null,
              },
            }));
          }
        } catch {
          // Mark as unverified and continue — don't let one bad entry kill the loop
          setVerifications(prev => ({
            ...prev,
            [citationKey(entry.title)]: { found: false, source: null, yearMismatch: null, dbFirstAuthor: null },
          }));
        }

        await new Promise(r => setTimeout(r, 150));
      }

      if (!abortRef.current?.signal.aborted && topic) {
        setProgress('Scanning for missing high-impact works...');
        const topWorks = await oaTopicSearch(topic, 50);
        const canonTitles = entries.map(e => e.title);
        const seen = new Set();
        const gaps = topWorks
          .filter(w => {
            if (!w.title || (w.citationCount || 0) < 500) return false;
            const key = w.title.toLowerCase().slice(0, 30);
            if (seen.has(key)) return false;
            seen.add(key);
            return !canonTitles.some(ct => titlesMatch(ct, w.title));
          })
          .slice(0, 12)
          .map(w => ({
            ...w,
            // Definitive gap = >5k citations; possible = 500–5k
            gapTier: (w.citationCount || 0) >= 5000 ? 'definitive' : 'possible',
          }));
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
    setVerifications({});
    setMissing([]);
    setProgress('');
    setFound(0);
  }, []);

  return { status, progress, found, getCitation, getVerification, missing, enrich, clear };
}
