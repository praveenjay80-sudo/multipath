import { useState, useCallback, useRef } from 'react';
import { fetchTopicWorks, recentCitationVelocity } from '../utils/pulseOpenAlex';
import { syllabusSearch } from '../utils/syllabusHarvest';

async function serpScholarSearch(query, apiKey, limit = 20) {
  const url = `https://serpapi.com/search.json?engine=google_scholar&q=${encodeURIComponent(query)}&api_key=${apiKey}&num=${limit}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.organic_results || []).map(r => ({
      title: r.title || '',
      authors: (r.publication_info?.authors || []).map(a => a.name).join(', '),
      year: r.publication_info?.summary?.match(/\d{4}/)?.[0] || null,
      citationCount: r.inline_links?.cited_by?.total || 0,
      link: r.link || '',
    })).sort((a, b) => b.citationCount - a.citationCount);
  } catch {
    return [];
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
  const [mostCited, setMostCited] = useState([]);
  const [rising, setRising] = useState([]);
  const [mostAssigned, setMostAssigned] = useState([]);
  const [mostInfluential, setMostInfluential] = useState([]);
  const [scholar, setScholar] = useState([]);
  const cancelRef = useRef({ aborted: false });

  const hasScholarKey = !!localStorage.getItem('canon_serp_key');

  const select = useCallback(async (topicId, name) => {
    cancelRef.current.aborted = true;
    const token = { aborted: false };
    cancelRef.current = token;

    setPhase('loading');
    setError(null);
    setTopicName(name);
    setMostCited([]);
    setRising([]);
    setMostAssigned([]);
    setMostInfluential([]);
    setScholar([]);

    const serpKey = localStorage.getItem('canon_serp_key') || '';

    try {
      const [works, ospResults, scholarResults] = await Promise.all([
        fetchTopicWorks(topicId, 30),
        syllabusSearch(name, 30).catch(() => []),
        serpKey ? serpScholarSearch(name, serpKey, 20) : Promise.resolve([]),
      ]);
      if (token.aborted) return;

      setMostCited(works);
      setRising([...works].sort((a, b) => recentCitationVelocity(b) - recentCitationVelocity(a)));
      setMostAssigned([...ospResults].sort((a, b) => (b.syllabusCount || 0) - (a.syllabusCount || 0)));
      setScholar(scholarResults);

      const dois = works.map(w => w.doi).filter(Boolean).slice(0, 30);
      const influential = await fetchInfluentialByDoi(dois);
      if (token.aborted) return;
      setMostInfluential(influential);

      setPhase('complete');
    } catch (err) {
      if (!token.aborted) {
        setError(err.message || 'Failed to load live data.');
        setPhase('error');
      }
    }
  }, []);

  const reset = useCallback(() => {
    cancelRef.current.aborted = true;
    setPhase('idle');
    setError(null);
    setTopicName('');
    setMostCited([]);
    setRising([]);
    setMostAssigned([]);
    setMostInfluential([]);
    setScholar([]);
  }, []);

  return {
    phase, error, topicName, mostCited, rising, mostAssigned, mostInfluential, scholar,
    hasScholarKey, select, reset,
  };
}
