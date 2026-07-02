import { syllabusSearch } from './syllabusHarvest';

const OA_BASE = 'https://api.openalex.org';
const MAILTO = 'canon-app@praveen.dev';

function fetchWithTimeout(url, ms = 12000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(timer));
}

async function fetchOABroad(topic, limit = 100) {
  const fields = 'title,authorships,publication_year,cited_by_count,type';
  const url = `${OA_BASE}/works?search=${encodeURIComponent(topic)}&sort=cited_by_count:desc&per-page=${limit}&select=${fields}&mailto=${MAILTO}`;
  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results || [])
      .filter(w => w.title && w.publication_year)
      .map(w => ({
        title: w.title,
        authors: (w.authorships || []).map(a => a.author?.display_name).filter(Boolean).slice(0, 3).join(', '),
        year: w.publication_year,
        citationCount: w.cited_by_count || 0,
        type: w.type || 'unknown',
      }));
  } catch { return []; }
}

function groupByEra(works) {
  const eras = {
    'Pre-1985': [],
    '1985-1999': [],
    '2000-2012': [],
    '2013-Now': [],
  };
  for (const w of works) {
    if (w.year < 1985) eras['Pre-1985'].push(w);
    else if (w.year < 2000) eras['1985-1999'].push(w);
    else if (w.year < 2013) eras['2000-2012'].push(w);
    else eras['2013-Now'].push(w);
  }
  // Top 20 per era by citations
  for (const key of Object.keys(eras)) {
    eras[key] = eras[key].sort((a, b) => b.citationCount - a.citationCount).slice(0, 20);
  }
  return eras;
}

export async function driftHarvest(topic) {
  const [oaWorks, ospWorks] = await Promise.all([
    fetchOABroad(topic, 120),
    syllabusSearch(topic, 40),
  ]);

  const eras = groupByEra(oaWorks);

  const formatEra = (label, works) => {
    if (!works.length) return '';
    return `--- ${label} ---\n` + works.map(w =>
      `- ${w.title}${w.authors ? ` by ${w.authors}` : ''} (${w.year}) -- ${w.citationCount.toLocaleString()} citations`
    ).join('\n');
  };

  const ospSection = ospWorks.length > 0
    ? ospWorks.slice(0, 30).map(w =>
        `- ${w.title}${w.authors ? ` by ${w.authors}` : ''}${w.year ? ` (${w.year})` : ''} -- ${w.syllabusCount} courses currently assigned`
      ).join('\n')
    : '(No OSP data available)';

  const historicalSection = [
    formatEra('Pre-1985', eras['Pre-1985']),
    formatEra('1985-1999', eras['1985-1999']),
    formatEra('2000-2012', eras['2000-2012']),
    formatEra('2013-Now', eras['2013-Now']),
  ].filter(Boolean).join('\n\n');

  return { ospSection, historicalSection, totalWorks: oaWorks.length + ospWorks.length };
}
