// Open Syllabus Project — teaching score = how often assigned in university courses
// Free tier works without a key for basic queries; key stored as opensyllabus_api_key
const OS_BASE = 'https://api.opensyllabus.org/v1';

function resolveOSKey() {
  return localStorage.getItem('opensyllabus_api_key') || '';
}

async function fetchWithTimeout(url, options = {}, ms = 10000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...options, signal: ctrl.signal }).finally(() => clearTimeout(timer));
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
