// Open Syllabus Project — teaching score = how often assigned in university courses
// Free tier works without a key for basic queries; key stored as opensyllabus_api_key
const OS_BASE = 'https://api.opensyllabus.org/v1';
const S2_BASE = 'https://api.semanticscholar.org/graph/v1';

function resolveOSKey() {
  return localStorage.getItem('opensyllabus_api_key') || '';
}

async function fetchWithTimeout(url, options = {}, ms = 10000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...options, signal: ctrl.signal }).finally(() => clearTimeout(timer));
}

export async function syllabusHarvest(topic) {
  const queries = [
    topic,
    `introduction to ${topic}`,
    `advanced ${topic}`,
    `${topic} textbook`,
  ];
  const results = await Promise.all(queries.map(q => syllabusSearch(q, 40)));
  const seen = new Set();
  const merged = [];
  for (const batch of results) {
    for (const work of batch) {
      const key = work.title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 40);
      if (key.length > 3 && !seen.has(key)) {
        seen.add(key);
        merged.push(work);
      }
    }
  }
  return merged.sort((a, b) => b.syllabusCount - a.syllabusCount).slice(0, 80);
}

export async function seminalPapersHarvest(topic) {
  const queries = [topic, `${topic} theory`, `${topic} foundations`];
  const results = await Promise.all(queries.map(q => seminalPapersSearch(q, 30)));
  const seen = new Set();
  const merged = [];
  for (const batch of results) {
    for (const paper of batch) {
      const key = paper.title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 40);
      if (key.length > 3 && !seen.has(key)) {
        seen.add(key);
        merged.push(paper);
      }
    }
  }
  return merged
    .filter(p => p.influentialCitationCount > 0)
    .sort((a, b) => b.influentialCitationCount - a.influentialCitationCount)
    .slice(0, 40);
}

async function seminalPapersSearch(query, limit = 30) {
  const url = `${S2_BASE}/paper/search?query=${encodeURIComponent(query)}&limit=${limit}&fields=title,authors,year,citationCount,influentialCitationCount,externalIds,openAccessPdf`;
  try {
    const res = await fetchWithTimeout(url, {}, 12000);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.data || []).map(p => ({
      title: p.title || '',
      authors: (p.authors || []).map(a => a.name || '').filter(Boolean).slice(0, 3).join(', '),
      year: p.year || null,
      citationCount: p.citationCount || 0,
      influentialCitationCount: p.influentialCitationCount || 0,
      doi: p.externalIds?.DOI || null,
      arxivId: p.externalIds?.ArXiv || null,
      oaUrl: p.openAccessPdf?.url || null,
    }));
  } catch { return []; }
}

export async function syllabusSearch(topic, limit = 25) {
  const apiKey = resolveOSKey();
  const headers = {};
  if (apiKey) headers['Authorization'] = `Token ${apiKey}`;

  const url = `${OS_BASE}/works/?q=${encodeURIComponent(topic)}&limit=${limit}&ordering=-score`;
  try {
    const res = await fetchWithTimeout(url, { headers });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results || []).map(w => ({
      title: w.title || '',
      authors: (w.authors || [])
        .map(a => typeof a === 'string' ? a : (a.name || a.display_name || ''))
        .filter(Boolean).slice(0, 3).join(', '),
      year: w.year || null,
      citationCount: 0,
      fwci: null,
      type: 'book',
      isOA: false,
      oaUrl: null,
      venue: null,
      doi: null,
      source: 'open-syllabus',
      influentialCitationCount: null,
      editionCount: null,
      teachingScore: typeof w.score === 'number' ? w.score : 0,
      syllabusCount: typeof w.count === 'number' ? w.count : 0,
      isTextbook: true,
    }));
  } catch { return []; }
}
