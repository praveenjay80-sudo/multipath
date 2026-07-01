// Composite scoring for harvested works.
// Papers: weighted toward influential citations + raw citations + cross-source presence
// Books:  weighted toward edition count (canonicity) + cross-source presence + citations

function logNorm(value, max) {
  if (!max || max <= 0) return 0;
  return Math.log1p(value || 0) / Math.log1p(max);
}

function scoreWork(work, maxCitations, maxInfluential, maxEditions) {
  const crossSourceBonus = Math.min((work.sources?.length || 1) - 1, 2) * 0.15;
  const recencyBonus = work.year && work.year >= 2010 ? 0.05 : 0;

  const isBook = work.type === 'book' || (work.editionCount || 0) > 0;

  let score;
  if (isBook) {
    const editionScore  = logNorm(work.editionCount || 0, maxEditions) * 0.45;
    const citationScore = logNorm(work.citationCount || 0, maxCitations) * 0.30;
    score = editionScore + citationScore + crossSourceBonus + recencyBonus;
  } else {
    const influentialScore = logNorm(work.influentialCitationCount || 0, maxInfluential) * 0.45;
    const citationScore    = logNorm(work.citationCount || 0, maxCitations) * 0.35;
    score = influentialScore + citationScore + crossSourceBonus + recencyBonus;
  }

  return Math.min(score, 1);
}

export function rankWorks(merged) {
  const maxCitations   = Math.max(...merged.map(w => w.citationCount || 0), 1);
  const maxInfluential = Math.max(...merged.map(w => w.influentialCitationCount || 0), 1);
  const maxEditions    = Math.max(...merged.map(w => w.editionCount || 0), 1);

  return merged
    .map(w => ({ ...w, score: scoreWork(w, maxCitations, maxInfluential, maxEditions) }))
    .sort((a, b) => b.score - a.score);
}

// Format the ranked list for the LLM compose prompt
export function formatForCompose(ranked) {
  return ranked.map((w, i) => {
    const isBook = w.type === 'book' || (w.editionCount || 0) > 0;
    const signals = [];
    if (w.citationCount > 0) signals.push(`${w.citationCount.toLocaleString()} citations`);
    if (w.influentialCitationCount > 0) signals.push(`${w.influentialCitationCount} highly influential citations`);
    if (w.editionCount > 0) signals.push(`${w.editionCount} editions`);
    if (w.fwci != null) signals.push(`FWCI ${w.fwci.toFixed(2)}`);
    const sourceStr = (w.sources || [w.source]).join(', ');
    return `${i + 1}. [${isBook ? 'BOOK' : 'PAPER'}] ${w.title}` +
      (w.authors ? ` — ${w.authors}` : '') +
      (w.year ? ` (${w.year})` : '') +
      `\n   Signals: ${signals.join(' · ') || 'no data'} | Sources: ${sourceStr}` +
      (w.venue ? ` | Venue: ${w.venue}` : '');
  }).join('\n');
}
