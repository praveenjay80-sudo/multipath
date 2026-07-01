import { syllabusSearch } from './syllabusHarvest';

const OA_BASE   = 'https://api.openalex.org';
const S2_BASE   = 'https://api.semanticscholar.org/graph/v1';
const OL_BASE   = 'https://openlibrary.org';
const GB_BASE   = 'https://www.googleapis.com/books/v1';
const MAILTO    = 'canon-app@praveen.dev';

// Serial/noise keywords — Open Library returns these as high-edition "books"
const SERIAL_WORDS = [
  'advances in', 'progress in', 'annual review', 'proceedings of',
  'handbook of', 'encyclopedia of', 'reviews of', 'topics in',
  'methods in', 'perspectives in', 'frontiers in', 'current topics',
  'lecture notes', 'nato', 'symposium', 'workshop',
];

function isSerial(title) {
  const t = (title || '').toLowerCase();
  return SERIAL_WORDS.some(w => t.startsWith(w) || t.includes(` ${w}`));
}

// Topic relevance: at least one meaningful topic word must appear in the title
function topicWords(topic) {
  return topic.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 3);
}

function isTopicRelevant(title, topic) {
  const tw = topicWords(topic);
  if (!tw.length) return true;
  const t = (title || '').toLowerCase();
  return tw.some(w => t.includes(w));
}

function fetchWithTimeout(url, ms = 12000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(timer));
}

function oaWork(w, sourceTag) {
  return {
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
    source: sourceTag,
    influentialCitationCount: null,
    editionCount: null,
  };
}

// ── 1. OpenAlex: top papers by all-time citations ────────────────────────────
async function harvestOAPapers(topic, limit = 60) {
  const fields = 'title,authorships,publication_year,cited_by_count,fwci,type,open_access,primary_location,doi';
  const url = `${OA_BASE}/works?search=${encodeURIComponent(topic)}&filter=type:article&select=${fields}&per_page=${limit}&sort=cited_by_count:desc&mailto=${MAILTO}`;
  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) return [];
    const { results = [] } = await res.json();
    return results
      .filter(w => w.title && (w.cited_by_count || 0) > 10)
      .map(w => oaWork(w, 'openalex-papers'));
  } catch { return []; }
}

// ── 2. OpenAlex: top books by citations ─────────────────────────────────────
async function harvestOABooks(topic, limit = 30) {
  const fields = 'title,authorships,publication_year,cited_by_count,fwci,type,open_access,primary_location,doi';
  const url = `${OA_BASE}/works?search=${encodeURIComponent(topic)}&filter=type:book&select=${fields}&per_page=${limit}&sort=cited_by_count:desc&mailto=${MAILTO}`;
  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) return [];
    const { results = [] } = await res.json();
    return results
      .filter(w => w.title && !isSerial(w.title) && (w.cited_by_count || 0) > 5)
      .map(w => oaWork(w, 'openalex-books'));
  } catch { return []; }
}

// ── 3. OpenAlex: recent works (last 15 years) for Contemporary section ───────
async function harvestOARecent(topic, limit = 20) {
  const fields = 'title,authorships,publication_year,cited_by_count,fwci,type,open_access,primary_location,doi';
  const year = new Date().getFullYear() - 15;
  const url = `${OA_BASE}/works?search=${encodeURIComponent(topic)}&filter=publication_year:>${year}&select=${fields}&per_page=${limit}&sort=cited_by_count:desc&mailto=${MAILTO}`;
  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) return [];
    const { results = [] } = await res.json();
    return results
      .filter(w => w.title && (w.cited_by_count || 0) > 50)
      .map(w => ({ ...oaWork(w, 'openalex-recent'), isRecent: true }));
  } catch { return []; }
}

// ── 4. Semantic Scholar: top papers by influential citations ─────────────────
async function harvestS2Papers(topic, limit = 40) {
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

// ── 5. Semantic Scholar: textbook-specific queries ───────────────────────────
// Queries "introduction to X", "fundamentals of X", "principles of X" etc.
// These hit the canonical textbooks that general topic searches miss.
async function harvestS2Textbooks(topic, limit = 20) {
  const queries = [
    `introduction to ${topic}`,
    `${topic} textbook`,
    `fundamentals of ${topic}`,
    `principles of ${topic}`,
    `advanced ${topic}`,
  ];
  const fields = 'title,authors,year,citationCount,influentialCitationCount,externalIds';
  const results = await Promise.all(
    queries.map(async q => {
      try {
        const url = `${S2_BASE}/paper/search?query=${encodeURIComponent(q)}&fields=${fields}&limit=${limit}`;
        const res = await fetchWithTimeout(url);
        if (!res.ok) return [];
        const { data = [] } = await res.json();
        return data.filter(p => p.title && (p.citationCount || 0) > 100);
      } catch { return []; }
    })
  );
  return results.flat().map(p => ({
    title: p.title,
    authors: (p.authors || []).map(a => a.name).filter(Boolean).slice(0, 3).join(', '),
    year: p.year ?? null,
    citationCount: p.citationCount ?? 0,
    fwci: null,
    type: 'book',
    isOA: false,
    oaUrl: null,
    venue: null,
    doi: p.externalIds?.DOI || null,
    source: 'semantic-scholar-textbooks',
    influentialCitationCount: p.influentialCitationCount ?? 0,
    editionCount: null,
    isTextbook: true,
  }));
}

// ── 6. Google Books: textbooks by ratings count ──────────────────────────────
// No API key needed for ~1000 req/day. Returns canonical textbooks that
// live in university libraries and are invisible to OpenAlex/Open Library.
async function harvestGoogleBooks(topic, limit = 20) {
  const queries = [
    `${topic} textbook`,
    `introduction to ${topic}`,
  ];
  const results = await Promise.all(
    queries.map(async q => {
      try {
        const url = `${GB_BASE}/volumes?q=${encodeURIComponent(q)}&printType=books&orderBy=relevance&maxResults=${limit}`;
        const res = await fetchWithTimeout(url);
        if (!res.ok) return [];
        const { items = [] } = await res.json();
        return items
          .map(item => item.volumeInfo)
          .filter(v => v.title && (v.ratingsCount || 0) >= 10 && !isSerial(v.title))
          .map(v => {
            const year = v.publishedDate ? parseInt(v.publishedDate.slice(0, 4)) : null;
            return {
              title: v.title,
              authors: (v.authors || []).slice(0, 3).join(', '),
              year,
              citationCount: 0,
              fwci: null,
              type: 'book',
              isOA: false,
              oaUrl: null,
              venue: null,
              doi: null,
              source: 'google-books',
              influentialCitationCount: null,
              editionCount: null,
              ratingsCount: v.ratingsCount || 0,
              avgRating: v.averageRating || 0,
              isTextbook: true,
            };
          });
      } catch { return []; }
    })
  );
  return results.flat();
}

// ── 7. Open Library: edition count with noise filtering ─────────────────────
async function harvestOpenLibrary(topic, limit = 30) {
  const fields = 'title,author_name,first_publish_year,edition_count,subject';
  const url = `${OL_BASE}/search.json?q=${encodeURIComponent(topic)}&fields=${fields}&limit=${limit}&sort=editions`;
  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) return [];
    const { docs = [] } = await res.json();
    return docs
      .filter(b => {
        if (!b.title || (b.edition_count || 0) < 3) return false;
        if (isSerial(b.title)) return false;                           // drop serials
        if (!isTopicRelevant(b.title, topic)) return false;            // must mention topic
        return true;
      })
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
        // Cap edition count at 20 so serials that slip through don't dominate scoring
        editionCount: Math.min(b.edition_count ?? 0, 20),
      }));
  } catch { return []; }
}

// ── Merge & deduplicate ──────────────────────────────────────────────────────
export function titleWords(t) {
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
      existing.sources = [...new Set([...(existing.sources || [existing.source]), work.source])];
      existing.citationCount      = Math.max(existing.citationCount || 0,      work.citationCount || 0);
      existing.influentialCitationCount = Math.max(existing.influentialCitationCount || 0, work.influentialCitationCount || 0);
      existing.editionCount       = Math.max(existing.editionCount || 0,       work.editionCount || 0);
      existing.ratingsCount       = Math.max(existing.ratingsCount || 0,       work.ratingsCount || 0);
      existing.fwci  = existing.fwci  ?? work.fwci;
      existing.isOA  = existing.isOA  || work.isOA;
      existing.oaUrl = existing.oaUrl || work.oaUrl;
      existing.doi   = existing.doi   || work.doi;
      existing.venue = existing.venue || work.venue;
      existing.isTextbook  = existing.isTextbook  || work.isTextbook;
      existing.isRecent    = existing.isRecent    || work.isRecent;
      existing.teachingScore = Math.max(existing.teachingScore || 0, work.teachingScore || 0);
      existing.syllabusCount = Math.max(existing.syllabusCount || 0, work.syllabusCount || 0);
      if (!existing.year && work.year) existing.year = work.year;
      if (!existing.authors && work.authors) existing.authors = work.authors;
      // Promote type: if any source calls it a book, it's a book
      if (work.type === 'book') existing.type = 'book';
    } else {
      merged.push({ ...work, sources: [work.source] });
    }
  }
  return merged;
}

// ── Export ───────────────────────────────────────────────────────────────────
export async function harvestAll(topic, onProgress) {
  onProgress?.('Querying OpenAlex, Semantic Scholar, Open Syllabus...');

  // Fire all 8 sources in parallel
  const [oaPapers, oaBooks, oaRecent, s2Papers, s2Textbooks, gbBooks, olBooks, syllabusBooks] = await Promise.all([
    harvestOAPapers(topic, 60),
    harvestOABooks(topic, 30),
    harvestOARecent(topic, 20),
    harvestS2Papers(topic, 40),
    harvestS2Textbooks(topic, 20),
    harvestGoogleBooks(topic, 20),
    harvestOpenLibrary(topic, 30),
    syllabusSearch(topic, 25),
  ]);

  const counts = {
    'OA papers':      oaPapers.length,
    'OA books':       oaBooks.length,
    'OA recent':      oaRecent.length,
    'S2 papers':      s2Papers.length,
    'S2 textbooks':   s2Textbooks.length,
    'Google Books':   gbBooks.length,
    'Open Library':   olBooks.length,
    'Open Syllabus':  syllabusBooks.length,
  };

  onProgress?.(`Merging ${Object.values(counts).reduce((a,b)=>a+b,0)} raw results from 8 sources...`);

  const merged = mergeWorks([oaPapers, oaBooks, oaRecent, s2Papers, s2Textbooks, gbBooks, olBooks, syllabusBooks]);

  return { merged, counts };
}
