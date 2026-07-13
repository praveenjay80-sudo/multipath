// Build a relationship index from harvested works + parsed entities.
// Used to make concepts/works/authors clickable and show connections
// (which works share an author, which works mention a concept, etc.)

import { useMemo } from 'react';

// Normalize a title for fuzzy matching
function normTitle(s) {
  return (s || '').toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2 && !['the', 'and', 'for', 'with', 'from'].includes(w))
    .join(' ');
}

// Normalize an author name for matching
function normAuthor(s) {
  return (s || '').toLowerCase().trim()
    .replace(/[.,]/g, '')
    .replace(/\s+/g, ' ');
}

// Split a comma-separated author string into individual names
function splitAuthors(authorStr) {
  if (!authorStr) return [];
  return authorStr.split(/,\s*|\s+and\s+|\s+&\s+/)
    .map(s => s.trim())
    .filter(Boolean);
}

// Fuzzy title match: ≥50% of significant words overlap
function titlesMatch(a, b) {
  const na = normTitle(a);
  const nb = normTitle(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  const wa = new Set(na.split(/\s+/));
  const wb = nb.split(/\s+/);
  let match = 0;
  for (const w of wb) if (wa.has(w)) match++;
  return match / Math.max(wa.size, wb.length) >= 0.5;
}

// Author name match: last word of one must match last word of the other
// (handles "C. Darwin" vs "Charles Darwin")
function authorsMatch(a, b) {
  const na = normAuthor(a);
  const nb = normAuthor(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const lastA = na.split(' ').pop();
  const lastB = nb.split(' ').pop();
  return lastA === lastB;
}

export function buildEntityIndex(harvestedWorks, parsedEntities) {
  const workByTitle = new Map();
  const workById = new Map();
  const authorToWorks = new Map();
  const workToAuthors = new Map();
  const conceptToWorks = new Map();
  const workToConcepts = new Map();
  const authorProfile = new Map();

  // Index harvested works
  for (const w of harvestedWorks) {
    workByTitle.set(normTitle(w.title), w);
    if (w.doi) workById.set(w.doi, w);

    const authors = splitAuthors(w.authors);
    workToAuthors.set(w.title, authors);
    for (const a of authors) {
      const key = normAuthor(a);
      if (!authorToWorks.has(key)) authorToWorks.set(key, []);
      authorToWorks.get(key).push(w);

      if (!authorProfile.has(key)) {
        authorProfile.set(key, {
          name: a,
          works: [],
          totalCitations: 0,
          hIndexApprox: 0,
          firstYear: null,
          lastYear: null,
        });
      }
      const p = authorProfile.get(key);
      p.works.push(w);
      p.totalCitations += w.citationCount || 0;
      const y = w.year;
      if (y) {
        if (!p.firstYear || y < p.firstYear) p.firstYear = y;
        if (!p.lastYear || y > p.lastYear) p.lastYear = y;
      }
    }
  }

  // Match parsed works against harvested works
  for (const pw of (parsedEntities?.works || [])) {
    let bestMatch = null;
    for (const w of harvestedWorks) {
      if (titlesMatch(pw.title, w.title) && authorsMatch(pw.firstAuthor, w.authors?.split(',')[0])) {
        bestMatch = w;
        break;
      }
    }
    if (bestMatch) {
      // Use harvested metadata
      pw.matchedWork = bestMatch;
    } else {
      // Use parsed metadata as-is
      pw.matchedWork = null;
    }
  }

  // Match parsed concepts to works using ALL harvested papers + any parsed-only works.
  // Score: 2 = concept name in title/author, 1 = definition words in title, 0 = rest.
  const STOPWORDS = new Set(['the','a','an','and','or','of','in','on','at','to','for','with','by','from','is','are','was','were','be','been','being','it','its','this','that','these','those','as','if','then','than','so','but','not','no','yes','all','any','some','such','same','other','into','over','after','before','also','used','use','using','one','two','three','many','much','more','most','less','least','very','just','about','between','among','how','what','which','who','whom','whose','where','when','why','can','could','may','might','should','would','will','shall','do','does','did','done','have','has','had','having','make','makes','made','based','their','they','them','he','she','his','her','its','our','we','you','your','my','me','i']);
  const sigWords = (s) => (s || '').toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length >= 4 && !STOPWORDS.has(w));

  // Build combined work pool: all harvested papers + parsed-only works not in harvested set
  const harvestedKeys = new Set(harvestedWorks.map(w => normTitle(w.title)));
  const allWorksForScoring = [...harvestedWorks];
  for (const pw of (parsedEntities.works || [])) {
    if (!harvestedKeys.has(normTitle(pw.title))) {
      allWorksForScoring.push({
        title: pw.title,
        authors: pw.allAuthors,
        year: pw.year,
        _synthetic: true,
      });
    }
  }

  for (const c of (parsedEntities?.concepts || [])) {
    const cName = (c.name || '').toLowerCase();
    const cDefWords = sigWords(c.definition);
    const scored = [];
    for (const w of allWorksForScoring) {
      const titleLc = (w.title || '').toLowerCase();
      const authorLc = (w.authors || w.allAuthors || '').toLowerCase();
      let score = 0;
      if (cName && (titleLc.includes(cName) || authorLc.includes(cName))) score = 2;
      else if (cDefWords.some(dw => titleLc.includes(dw))) score = 1;
      scored.push({ work: w, score });
    }
    scored.sort((a, b) => b.score - a.score);
    conceptToWorks.set(c.name, scored);

    for (const { work, score } of scored) {
      if (score === 0) continue;
      if (!workToConcepts.has(work.title)) workToConcepts.set(work.title, new Set());
      workToConcepts.get(work.title).add(c.name);
    }
  }

  // Match parsed researchers to authors in harvested data
  for (const r of (parsedEntities?.researchers || [])) {
    const key = normAuthor(r.name);
    const profile = authorProfile.get(key);
    if (profile) {
      r.matchedAuthor = profile;
    }
    // Also build a concept->researcher relationship if we can
  }

  // Adjacent works: works that share at least one author
  const workToAdjacentWorks = new Map();
  for (const w of harvestedWorks) {
    const authors = splitAuthors(w.authors).map(normAuthor);
    const adjacent = new Set();
    for (const a of authors) {
      for (const otherWork of authorToWorks.get(a) || []) {
        if (otherWork.title !== w.title) {
          adjacent.add(otherWork.title);
        }
      }
    }
    workToAdjacentWorks.set(w.title, Array.from(adjacent)
      .map(t => harvestedWorks.find(x => x.title === t))
      .filter(Boolean)
      .slice(0, 5));
  }

  return {
    workByTitle,
    workById,
    authorToWorks,
    workToAuthors,
    workToConcepts,
    conceptToWorks,
    authorProfile,
    workToAdjacentWorks,
  };
}

export function useEntityIndex(harvestedWorks, parsedEntities) {
  return useMemo(
    () => buildEntityIndex(harvestedWorks, parsedEntities),
    [harvestedWorks, parsedEntities]
  );
}
