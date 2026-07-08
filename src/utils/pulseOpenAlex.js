const MAILTO = 'mailto=canon-app@praveen.dev';

async function fetchWithTimeout(url, options = {}, ms = 12000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...options, signal: ctrl.signal }).finally(() => clearTimeout(timer));
}

function extractAuthors(authorships) {
  return (authorships || []).slice(0, 3).map(a => a.author?.display_name).filter(Boolean).join(', ');
}

function oaWork(w) {
  return {
    title: w.title,
    authors: extractAuthors(w.authorships),
    year: w.publication_year,
    citationCount: w.cited_by_count || 0,
    fwci: w.fwci ?? null,
    type: w.type,
    isOA: w.open_access?.is_oa || false,
    oaUrl: w.open_access?.oa_url || null,
    venue: w.primary_location?.source?.display_name || null,
    doi: w.doi || null,
    countsByYear: w.counts_by_year || [],
  };
}

export function recentCitationVelocity(work) {
  const counts = work.countsByYear || [];
  const sorted = [...counts].sort((a, b) => b.year - a.year);
  return sorted.slice(0, 2).reduce((sum, c) => sum + (c.cited_by_count || 0), 0);
}

// Topic ids from fetchOpenAlexTaxonomy() are full URLs (https://openalex.org/T10883);
// the filter param wants the bare id.
function bareId(id) {
  return id.split('/').pop();
}

export async function fetchTopicWorks(topicId, limit = 30) {
  const url = `https://api.openalex.org/works?filter=topics.id:${encodeURIComponent(bareId(topicId))}&select=title,authorships,publication_year,cited_by_count,fwci,type,open_access,primary_location,doi,counts_by_year&sort=cited_by_count:desc&per_page=${limit}&${MAILTO}`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`OpenAlex fetch failed: ${res.status}`);
  const json = await res.json();
  return (json.results || []).map(oaWork);
}
