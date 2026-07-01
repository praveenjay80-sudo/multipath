const OA_BASE = 'https://api.openalex.org';
const S2_BASE = 'https://api.semanticscholar.org/graph/v1';
const OL_BASE = 'https://openlibrary.org';
const MAILTO = 'canon-app@praveen.dev';

function fetchWithTimeout(url, ms = 10000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(timer));
}

// ── OpenAlex ────────────────────────────────────────────────────────────────
// Returns top works by citation count for the topic — papers and books
async function harvestOpenAlex(topic, limit = 80) {
  const fields = 'title,authorships,publication_year,cited_by_count,fwci,type,open_access,primary_location,doi';
  const url = `${OA_BASE}/works?search=${encodeURIComponent(topic)}&select=${fields}&per_page=${limit}&sort=cited_by_count:desc&mailto=${MAILTO}`;
  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) return [];
    const { results = [] } = await res.json();
    return results
      .filter(w => w.title && (w.cited_by_count || 0) > 0)
      .map(w => ({
        title: w.title,
        authors: (w.authorships || []).map(a => a.author?.display_name).filter(Boolean).slice(0, 3).join(', '),
        year: w.publication_year ?? null,
        citationCount: w.cited_by_count ?? 0,
        fwci: typeof w.fwci === 'number' ? w.fwci : null,
        type: w.type || 'unknown',
        isOA: w.open_access?.is_oa ?? false,
        oaUrl: w.open_access?.oa_url || null,
        venue: w.primary_location?.source?.display_name || null,
        doi: w.doi || null,
        source: 'openalex',
        influentialCitationCount: null,
        editionCount: null,
      }));
  } catch { return []; }
}

// ── Semantic Scholar ─────────────────────────────────────────────────────────
// Returns papers ranked by influential citations — a stronger quality signal
async function harvestSemanticScholar(topic, limit = 50) {
  const fields = 'title,authors,year,citationCount,influentialCitationCount,externalIds,openAccessPdf';
  const url = `${S2_BASE}/paper/search?query=${encodeURIComponent(topic)}&fields=${fields}&limit=${limit}`;
  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) return [];
    const { data = [] } = await res.json();
    return data
      .filter(p => p.title && (p.influentialCitationCount || 0) > 0)
      .map(p => ({
        title: p.title,
        authors: (p.authors || []).map(a => a.name).filter(Boolean).slice(0, 3).join(', '),
        year: p.year ?? null,
        citationCount: p.citationCount ?? 0,
        fwci: null,
        type: 'journal-article',
        isOA: !!p.openAccessPdf?.url,
        oaUrl: p.openAccessPdf?.url || null,
        venue: null,
        doi: p.externalIds?.DOI || null,
        source: 'semantic-scholar',
        influentialCitationCount: p.influentialCitationCount ?? 0,
        editionCount: null,
      }));
  } catch { return []; }
}

// ── Open Library ─────────────────────────────────────────────────────────────
// Returns books ranked by edition count — best free proxy for canonical status
async function harvestOpenLibrary(topic, limit = 30) {
  const fields = 'title,author_name,first_publish_year,edition_count,subject';
  const url = `${OL_BASE}/search.json?q=${encodeURIComponent(topic)}&fields=${fields}&limit=${limit}&sort=editions`;
  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) return [];
    const { docs = [] } = await res.json();
    return docs
      .filter(b => b.title && (b.edition_count || 0) >= 2)
      .map(b => ({
        title: b.title,
        authors: (b.author_name || []).slice(0, 3).join(', '),
        year: b.first_publish_year ?? null,
        citationCount: 0,
        fwci: null,
        type: 'book',
        isOA: false,
        oaUrl: null,
        venue: null,
        doi: null,
        source: 'open-library',
        influentialCitationCount: null,
        editionCount: b.edition_count ?? 0,
      }));
  } catch { return []; }
}

// ── Merge & deduplicate ──────────────────────────────────────────────────────
function titleKey(t) {
  return (t || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 50);
}

function titleWords(t) {
  return (t || '').toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 3);
}

function titlesMatch(a, b) {
  const wa = titleWords(a), wb = titleWords(b);
  if (!wa.length || !wb.length) return false;
  const shared = wa.filter(w => wb.includes(w)).length;
  return shared >= Math.max(1, Math.floor(Math.min(wa.length, wb.length) * 0.6));
}

function mergeWorks(lists) {
  const merged = [];

  for (const work of lists.flat()) {
    const existing = merged.find(m => titlesMatch(m.title, work.title));
    if (existing) {
      // Merge: take best data from each source
      existing.sources = [...(existing.sources || [existing.source]), work.source];
      existing.citationCount = Math.max(existing.citationCount || 0, work.citationCount || 0);
      existing.influentialCitationCount = Math.max(
        existing.influentialCitationCount || 0,
        work.influentialCitationCount || 0
      );
      existing.editionCount = Math.max(existing.editionCount || 0, work.editionCount || 0);
      existing.fwci = existing.fwci ?? work.fwci;
      existing.isOA = existing.isOA || work.isOA;
      existing.oaUrl = existing.oaUrl || work.oaUrl;
      existing.doi = existing.doi || work.doi;
      existing.venue = existing.venue || work.venue;
      if (!existing.year && work.year) existing.year = work.year;
      if (!existing.authors && work.authors) existing.authors = work.authors;
    } else {
      merged.push({ ...work, sources: [work.source] });
    }
  }

  return merged;
}

// ── Export ───────────────────────────────────────────────────────────────────
export async function harvestAll(topic, onProgress) {
  onProgress?.('Querying OpenAlex...');
  const [oa, s2, ol] = await Promise.all([
    harvestOpenAlex(topic, 80),
    harvestSemanticScholar(topic, 50),
    harvestOpenLibrary(topic, 30),
  ]);

  onProgress?.(`Found ${oa.length} via OpenAlex · ${s2.length} via Semantic Scholar · ${ol.length} via Open Library`);

  const merged = mergeWorks([oa, s2, ol]);
  return { merged, counts: { openalex: oa.length, semanticScholar: s2.length, openLibrary: ol.length } };
}
