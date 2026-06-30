import { useState, useCallback } from 'react';

const OA_BASE = 'https://api.openalex.org';
const OA_FIELDS = [
  'title', 'authorships', 'publication_year', 'cited_by_count',
  'fwci', 'type', 'primary_location', 'open_access',
  'cited_by_percentile_year', 'topics', 'biblio',
].join(',');

async function openAlexSearch(query, limit = 25) {
  const url = `${OA_BASE}/works?search=${encodeURIComponent(query)}&select=${OA_FIELDS}&per_page=${limit}&sort=cited_by_count:desc&mailto=canon-app`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.results || []).map(mapWork);
}

function mapWork(w) {
  return {
    id: w.id,
    title: w.title || '',
    authors: (w.authorships || []).map(a => a.author?.display_name).filter(Boolean).slice(0, 3).join(', '),
    year: w.publication_year,
    citationCount: w.cited_by_count ?? null,
    fwci: typeof w.fwci === 'number' ? w.fwci : null,
    type: w.type || null,
    venue: w.primary_location?.source?.display_name || null,
    isOA: w.open_access?.is_oa ?? false,
    oaUrl: w.open_access?.oa_url || null,
    percentile: w.cited_by_percentile_year?.min ?? null,
    topics: (w.topics || []).slice(0, 3).map(t => t.display_name),
    volume: w.biblio?.volume || null,
    issue: w.biblio?.issue || null,
  };
}

async function serpScholarSearch(query, apiKey, limit = 20) {
  const url = `https://serpapi.com/search.json?engine=google_scholar&q=${encodeURIComponent(query)}&api_key=${apiKey}&num=${limit}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.organic_results || []).map(r => ({
    title: r.title || '',
    authors: (r.publication_info?.authors || []).map(a => a.name).join(', '),
    year: r.publication_info?.summary?.match(/\d{4}/)?.[0] || null,
    citationCount: r.inline_links?.cited_by?.total || 0,
    snippet: r.snippet || '',
    link: r.link || '',
    fwci: null,
    isOA: false,
    type: null,
    venue: null,
  }));
}

function titleWords(title) {
  return title.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 4);
}

function titlesOverlap(a, b) {
  const wa = titleWords(a);
  const wb = titleWords(b);
  const shared = wa.filter(w => wb.includes(w));
  return shared.length >= Math.min(2, Math.floor(Math.min(wa.length, wb.length) * 0.4));
}

async function verifyWork(entry) {
  const query = [entry.title, entry.author].filter(Boolean).join(' ');
  const results = await openAlexSearch(query, 8);
  const match = results.find(r =>
    titlesOverlap(r.title, entry.title) &&
    (!entry.year || !r.year || Math.abs(r.year - parseInt(entry.year)) <= 3)
  );
  return {
    entry,
    found: !!match,
    ...( match ? {
      citationCount: match.citationCount,
      fwci: match.fwci,
      type: match.type,
      venue: match.venue,
      isOA: match.isOA,
      oaUrl: match.oaUrl,
      percentile: match.percentile,
      topics: match.topics,
      matchedTitle: match.title,
      matchedYear: match.year,
    } : {} ),
  };
}

export function useCanonValidator() {
  const [status, setStatus] = useState('idle');
  const [progress, setProgress] = useState('');
  const [results, setResults] = useState(null);

  const validate = useCallback(async (parsed) => {
    if (!parsed) return;
    setStatus('running');
    setProgress('Connecting to OpenAlex...');
    setResults(null);

    const serpKey = localStorage.getItem('canon_serp_key') || '';

    try {
      const topic = parsed.topic || '';
      const allEntries = parsed.tiers.flatMap(tier =>
        (tier.entries || []).map(e => ({ ...e, tierNumber: tier.number }))
      );

      const verifications = [];
      for (let i = 0; i < allEntries.length; i++) {
        const entry = allEntries[i];
        setProgress(`Verifying ${i + 1}/${allEntries.length}: ${entry.title.slice(0, 45)}...`);
        const result = await verifyWork(entry);
        verifications.push(result);
        await new Promise(r => setTimeout(r, 150));
      }

      setProgress('Fetching top works in the field from OpenAlex...');
      let topWorks = await openAlexSearch(topic, 50);
      if (topWorks.length < 20) {
        const more = await openAlexSearch(`${topic} foundational`, 25);
        topWorks = [...topWorks, ...more];
      }

      let scholarWorks = [];
      if (serpKey) {
        setProgress('Querying Google Scholar...');
        scholarWorks = await serpScholarSearch(`${topic} seminal`, serpKey, 20);
        await new Promise(r => setTimeout(r, 200));
        const more = await serpScholarSearch(`${topic} foundational text`, serpKey, 20);
        scholarWorks = [...scholarWorks, ...more];
      }

      const canonTitles = allEntries.map(e => e.title);
      const allExternal = [
        ...topWorks.filter(w => (w.citationCount || 0) > 200),
        ...scholarWorks.filter(w => (w.citationCount || 0) > 100),
      ];

      const seen = new Set();
      const missing = allExternal
        .filter(w => {
          if (!w.title || seen.has(w.title.toLowerCase().slice(0, 30))) return false;
          seen.add(w.title.toLowerCase().slice(0, 30));
          return !canonTitles.some(ct => titlesOverlap(ct, w.title));
        })
        .sort((a, b) => (b.citationCount || 0) - (a.citationCount || 0))
        .slice(0, 10);

      const notFound = verifications.filter(v => !v.found);
      const found = verifications.filter(v => v.found);
      const confidence = Math.round((found.length / Math.max(verifications.length, 1)) * 100);

      setResults({ verifications, missing, confidence, notFound, usedScholar: !!serpKey });
      setStatus('done');
      setProgress('');
    } catch (err) {
      console.error('Validation failed:', err);
      setStatus('error');
      setProgress('');
    }
  }, []);

  const reset = useCallback(() => {
    setStatus('idle');
    setResults(null);
    setProgress('');
  }, []);

  return { status, progress, results, validate, reset };
}
