import { useState, useCallback, useRef } from 'react';
import { fetchTopicWorks, fetchTopicWorksByText, aggregateTopAuthors, fetchAuthorStats } from '../utils/pulseOpenAlex';

const WORKER_BASE = 'https://canon-enrichment.canonworks.workers.dev';

// Google Scholar has no public API, and SerpAPI (the paid proxy for it) does not
// send CORS headers and shouldn't have its key exposed client-side anyway — so
// this must go through the canon-enrichment Cloudflare Worker's /scholar-search
// route, not straight to serpapi.com. A user-supplied key (if set) is passed
// through and takes priority server-side over the worker's own shared key.
async function serpScholarSearch(query, apiKey, limit = 20) {
  const params = new URLSearchParams({ q: query, num: String(limit) });
  if (apiKey) params.set('key', apiKey);
  try {
    const res = await fetch(`${WORKER_BASE}/scholar-search?${params}`);
    const data = await res.json().catch(() => null);
    if (!res.ok || !Array.isArray(data)) return { ok: false, results: [] };
    return { ok: true, results: data };
  } catch {
    return { ok: false, results: [] };
  }
}

async function fetchInfluentialByDoi(dois) {
  if (!dois.length) return [];
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12000);
  try {
    const res = await fetch(
      'https://api.semanticscholar.org/graph/v1/paper/batch?fields=title,authors,year,citationCount,influentialCitationCount',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: dois.map(d => `DOI:${d.replace(/^https?:\/\/doi\.org\//i, '')}`) }),
        signal: ctrl.signal,
      }
    );
    if (!res.ok) return [];
    const json = await res.json();
    return (json || [])
      .filter(Boolean)
      .map(p => ({
        title: p.title,
        authors: (p.authors || []).slice(0, 3).map(a => a.name).join(', '),
        year: p.year,
        citationCount: p.citationCount || 0,
        influentialCitationCount: p.influentialCitationCount || 0,
      }))
      .filter(p => p.influentialCitationCount > 0)
      .sort((a, b) => b.influentialCitationCount - a.influentialCitationCount);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

export function usePulse() {
  const [phase, setPhase] = useState('idle'); // idle | loading | complete | error
  const [error, setError] = useState(null);
  const [topicName, setTopicName] = useState('');
  const [isTextMatch, setIsTextMatch] = useState(false);
  const [mostCited, setMostCited] = useState([]);
  const [topAuthors, setTopAuthors] = useState([]);
  const [mostInfluential, setMostInfluential] = useState([]);
  const [scholar, setScholar] = useState([]);
  const [scholarFailed, setScholarFailed] = useState(false);
  const [scholarLoading, setScholarLoading] = useState(false);
  const cancelRef = useRef({ aborted: false });

  const hasScholarKey = !!localStorage.getItem('canon_serp_key');

  const select = useCallback(async (topicId, name) => {
    cancelRef.current.aborted = true;
    const token = { aborted: false };
    cancelRef.current = token;

    setPhase('loading');
    setError(null);
    setTopicName(name);
    setIsTextMatch(!topicId);
    setMostCited([]);
    setTopAuthors([]);
    setMostInfluential([]);
    setScholar([]);
    setScholarFailed(false);

    const serpKey = localStorage.getItem('canon_serp_key') || '';

    try {
      const [works, scholarOutcome] = await Promise.all([
        topicId ? fetchTopicWorks(topicId, 30) : fetchTopicWorksByText(name, 30),
        serpScholarSearch(name, serpKey, 20),
      ]);
      if (token.aborted) return;

      setMostCited(works);
      setScholar(scholarOutcome.results);
      setScholarFailed(!scholarOutcome.ok);

      const authors = aggregateTopAuthors(works);
      const dois = works.map(w => w.doi).filter(Boolean).slice(0, 30);
      // H-index/i10-index are career-wide (not scoped to this topic), so they
      // need their own batched authors call — capped at 50 ids per request.
      const [influential, authorStats] = await Promise.all([
        fetchInfluentialByDoi(dois),
        fetchAuthorStats(authors.slice(0, 50).map(a => a.id)),
      ]);
      if (token.aborted) return;
      setMostInfluential(influential);
      setTopAuthors(authors.map(a => ({ ...a, hIndex: authorStats[a.id]?.hIndex ?? null })));

      setPhase('complete');
    } catch (err) {
      if (!token.aborted) {
        setError(err.message || 'Failed to load live data.');
        setPhase('error');
      }
    }
  }, []);

  // Re-fetches only the Scholar panel — used right after a SerpAPI key is saved
  // from Pulse's own inline prompt, without re-running the OpenAlex/S2 calls.
  const refreshScholar = useCallback(async () => {
    if (!topicName) return;
    const serpKey = localStorage.getItem('canon_serp_key') || '';
    setScholarLoading(true);
    const outcome = await serpScholarSearch(topicName, serpKey, 20);
    setScholar(outcome.results);
    setScholarFailed(!outcome.ok);
    setScholarLoading(false);
  }, [topicName]);

  const reset = useCallback(() => {
    cancelRef.current.aborted = true;
    setPhase('idle');
    setError(null);
    setTopicName('');
    setIsTextMatch(false);
    setMostCited([]);
    setTopAuthors([]);
    setMostInfluential([]);
    setScholar([]);
    setScholarFailed(false);
  }, []);

  return {
    phase, error, topicName, isTextMatch, mostCited, topAuthors, mostInfluential, scholar, scholarFailed, scholarLoading,
    hasScholarKey, select, reset, refreshScholar,
  };
}
