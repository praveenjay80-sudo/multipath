import { useState, useCallback, useRef } from 'react';
import { fetchTopicWorks, fetchTopicWorksByText, fetchStageBackfillWorks, resolveOpenAlexTopicId, aggregateTopAuthors, fetchAuthorStats } from '../utils/pulseOpenAlex';

const WORKER_BASE = 'https://canon-enrichment.canonworks.workers.dev';

function resolveApiKey() {
  return import.meta.env.VITE_ANTHROPIC_API_KEY || localStorage.getItem('canon_api_key') || '';
}

// Last line of defense for the text-search fallback path: even with a
// subfield filter and a boolean-AND query, word overlap can still let through
// a work that's genuinely unrelated (confirmed: Lions' calculus-of-variations
// paper matched "Topological Quantum Field Theory" because it carries
// "Mathematical Physics" as one of its OpenAlex subfields and mentions
// "quantum field theory" in passing). Asks Claude to keep only works that are
// actually about the topic. Fails soft to the unfiltered list on any error —
// showing possibly-noisy results beats a blank panel from a transient failure.
async function claudeValidateWorks(topicName, works) {
  const apiKey = resolveApiKey();
  if (!apiKey || !works.length) return works;

  const list = works.map((w, i) => `${i}. ${w.title}${w.authors ? ` — ${w.authors}` : ''}${w.year ? ` (${w.year})` : ''}`).join('\n');
  const system = `You check whether academic works genuinely belong to a specific research topic. Be strict: a work that merely shares a word with the topic name, or is from a different subfield that happens to mention it in passing, does not count.`;
  const user = `Topic: "${topicName}"

Works:
${list}

List only the numbers of works that are genuinely, substantively about this topic. One number per line, nothing else. If none qualify, respond with exactly: NONE`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        system,
        messages: [{ role: 'user', content: user }],
      }),
    });
    if (!res.ok) return works;
    const data = await res.json();
    const text = (data.content?.[0]?.text || '').trim();
    if (/^NONE$/i.test(text)) return [];
    const keep = new Set(text.split('\n').map(l => parseInt(l.trim(), 10)).filter(n => !Number.isNaN(n)));
    if (!keep.size) return works;
    return works.filter((_, i) => keep.has(i));
  } catch {
    return works;
  }
}

// A pedagogical reading sequence for the Works panel's optional "Reading Order"
// view — where a learner would naturally encounter each work, not how highly
// cited it is. Exported so PulseView can render group headers in this exact
// order without duplicating the list.
export const READING_STAGES = [
  'Historical Context & Intuition',
  'Foundational Textbooks',
  'Mathematical Rigor',
  'Advanced Concepts',
  'Specialized Topics',
  'Philosophical Frameworks',
];

// One-line definitions so classification is consistent rather than guessed
// from the stage name alone — without these, "Advanced Concepts" vs.
// "Specialized Topics" vs. "Mathematical Rigor" is ambiguous even to a human.
const STAGE_DEFINITIONS = {
  'Historical Context & Intuition': 'a gentle, accessible work that explains the motivating problem and builds physical/conceptual intuition in plain terms — NOT the original technical paper that founded the field, even if it is historically first; a dense original research paper belongs in Mathematical Rigor or Advanced Concepts instead, however historically important it is',
  'Foundational Textbooks': 'a standard textbook or expository work establishing the core definitions and baseline theory',
  'Mathematical Rigor': 'focused on precise, formal derivations or proofs that establish the theory rigorously',
  'Advanced Concepts': 'extends the core theory into more advanced or technically demanding territory',
  'Specialized Topics': 'a narrow application, subtopic, or niche extension within the field',
  'Philosophical Frameworks': 'addresses foundational, interpretive, or meta-level questions about the theory itself',
};

function normalizeStageName(s) {
  return s.toLowerCase().replace(/[^a-z0-9\s&]/g, '').trim();
}

// Shared "<number>: <stage name>" parser — tolerant of case/punctuation drift
// in Claude's response (e.g. "foundational textbooks.") but still requires
// the full normalized name to match one of the six exactly, no partial credit.
function parseStageMap(text) {
  const byNormalized = new Map(READING_STAGES.map(s => [normalizeStageName(s), s]));
  const map = {};
  for (const line of (text || '').split('\n')) {
    const m = line.match(/^\s*(\d+)\s*:\s*(.+?)\s*$/);
    if (!m) continue;
    const idx = parseInt(m[1], 10);
    const stage = byNormalized.get(normalizeStageName(m[2]));
    if (!Number.isNaN(idx) && stage) map[idx] = stage;
  }
  return map;
}

// Search-query hints used to backfill a stage that comes up empty after
// classifying the citation-ranked set — citation rank has nothing to do with
// whether a work is historically-intuitive or philosophically-framed, so a
// stage can be genuinely well-represented in the literature while still
// missing entirely from the top-N-by-citations pool this app otherwise fetches.
const STAGE_QUERY_HINTS = {
  'Historical Context & Intuition': 'history introduction overview',
  'Foundational Textbooks': 'textbook introduction',
  'Mathematical Rigor': 'rigorous theory foundations',
  'Advanced Concepts': 'advanced theory',
  'Specialized Topics': 'special topics applications',
  'Philosophical Frameworks': 'philosophy foundations interpretation',
};

function dedupeKey(w) {
  return w.doi || w.title.toLowerCase().slice(0, 60);
}

// None of these six stages are derivable from OpenAlex's numeric metadata
// (citations, FWCI, type, venue) — placing a specific work requires judging
// what it's actually about, which needs Claude. Unlike claudeValidateWorks,
// this only runs when the user explicitly switches to the Reading Order view
// (never on the default load), so Pulse's data stays AI-free by default.
async function classifyWorksByStage(topicName, works) {
  const apiKey = resolveApiKey();
  if (!apiKey || !works.length) return null;

  const list = works.map((w, i) => `${i}. ${w.title}${w.authors ? ` — ${w.authors}` : ''}${w.year ? ` (${w.year})` : ''}`).join('\n');
  const stageList = READING_STAGES.map(s => `${s} (${STAGE_DEFINITIONS[s]})`).join('\n');
  const system = `You place academic works into the stage where a learner would naturally encounter them while working through a topic, in this fixed pedagogical order:\n${stageList}\n\nAssign each work to exactly one stage — the single best fit, not every stage it could arguably touch.`;
  const user = `Topic: "${topicName}"

Works:
${list}

For every work number, output one line in exactly this format:
<number>: <stage name>

Use only these exact stage names, spelled exactly as given: ${READING_STAGES.join(' / ')}`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 800,
        system,
        messages: [{ role: 'user', content: user }],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const map = parseStageMap(data.content?.[0]?.text);
    return Object.keys(map).length ? map : null;
  } catch {
    return null;
  }
}

// Backfill candidates come from a search that's already precision-constrained
// (see fetchStageBackfillWorks) — but that's a query-level guarantee, not a
// judgment call, and it's a second, independent search separate from the one
// that produced the main pool, so it gets its own relevance check rather than
// trusting query construction alone. Combines "is this genuinely about the
// topic" and "does it fit the stage it was fetched for" into one call instead
// of two, using the fetched-for stage (embedded in brackets) as the candidate
// Claude must independently confirm — not just accept at face value.
async function classifyBackfillCandidates(topicName, candidates) {
  const apiKey = resolveApiKey();
  if (!apiKey || !candidates.length) return {};

  const list = candidates.map((w, i) =>
    `${i}. [fetched for: ${w._targetStage}] ${w.title}${w.authors ? ` — ${w.authors}` : ''}${w.year ? ` (${w.year})` : ''}`
  ).join('\n');
  const system = `You verify candidates found by a targeted backfill search for a reading-sequence gap. For each, confirm BOTH that it is genuinely, substantively about the given topic AND that it truly fits the stage shown in brackets — reject anything off-topic or mismatched even if it superficially matched the search keywords.`;
  const user = `Topic: "${topicName}"

Candidates:
${list}

For each number that passes both checks, output one line:
<number>: <the stage name from its brackets, spelled exactly>

Omit any number that fails either check entirely. If none pass, respond with exactly: NONE`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        system,
        messages: [{ role: 'user', content: user }],
      }),
    });
    if (!res.ok) return {};
    const data = await res.json();
    const text = (data.content?.[0]?.text || '').trim();
    if (/^NONE$/i.test(text)) return {};
    return parseStageMap(text);
  } catch {
    return {};
  }
}

// Google Scholar has no public API, and SerpAPI (the paid proxy for it) does not
// send CORS headers and shouldn't have its key exposed client-side anyway — so
// this must go through the canon-enrichment Cloudflare Worker's /scholar-search
// route, not straight to serpapi.com. A user-supplied key (if set) is passed
// through and takes priority server-side over the worker's own shared key.
async function serpScholarSearch(query, apiKey, limit = 20) {
  const params = new URLSearchParams({ q: query, num: String(limit) });
  if (apiKey) params.set('key', apiKey);
  try {
    const res = await fetch(`${WORKER_BASE}/scholar-search?${params}`);
    const data = await res.json().catch(() => null);
    if (!res.ok || !Array.isArray(data)) return { ok: false, results: [] };
    return { ok: true, results: data };
  } catch {
    return { ok: false, results: [] };
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
    // Semantic Scholar's batch response preserves input order (null for
    // unmatched), so zip the original doi back in by index — needed to cross-
    // reference these against the Works panel for the "cross-verified" badge.
    return (json || [])
      .map((p, i) => (p ? { ...p, doi: dois[i] } : null))
      .filter(Boolean)
      .map(p => ({
        title: p.title,
        authors: (p.authors || []).slice(0, 3).map(a => a.name).join(', '),
        year: p.year,
        citationCount: p.citationCount || 0,
        influentialCitationCount: p.influentialCitationCount || 0,
        doi: p.doi,
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
  const [isTextMatch, setIsTextMatch] = useState(false);
  const [wasClaudeValidated, setWasClaudeValidated] = useState(false);
  const [mostCited, setMostCited] = useState([]);
  const [topAuthors, setTopAuthors] = useState([]);
  const [mostInfluential, setMostInfluential] = useState([]);
  const [scholar, setScholar] = useState([]);
  const [scholarFailed, setScholarFailed] = useState(false);
  const [scholarLoading, setScholarLoading] = useState(false);
  const [readingStageGroups, setReadingStageGroups] = useState(null); // { [stage]: works[] }
  const [readingStagesUnclassified, setReadingStagesUnclassified] = useState([]);
  const [readingStagesLoading, setReadingStagesLoading] = useState(false);
  const [readingStagesFailed, setReadingStagesFailed] = useState(false);
  const cancelRef = useRef({ aborted: false });
  const topicMetaRef = useRef({ resolvedId: null, subfieldId: null });

  const hasScholarKey = !!localStorage.getItem('canon_serp_key');

  const select = useCallback(async (topicId, name, subfieldId) => {
    cancelRef.current.aborted = true;
    const token = { aborted: false };
    cancelRef.current = token;

    setPhase('loading');
    setError(null);
    setTopicName(name);
    setMostCited([]);
    setTopAuthors([]);
    setMostInfluential([]);
    setScholar([]);
    setScholarFailed(false);
    setWasClaudeValidated(false);
    setReadingStageGroups(null);
    setReadingStagesUnclassified([]);
    setReadingStagesFailed(false);

    const serpKey = localStorage.getItem('canon_serp_key') || '';

    try {
      // A Claude-suggested topic often matches a real OpenAlex topic almost
      // exactly (it was prompted to be phrased that way) — resolving to that
      // topic's real id gives exact topics.id filtering instead of falling
      // straight to word-overlap text search, which let unrelated papers
      // through even with the subfield constrained (confirmed: a calculus-of-
      // variations paper that happens to carry "Mathematical Physics" as one
      // of its OpenAlex subfields and mentions "quantum field theory" in
      // passing still matched "Topological Quantum Field Theory").
      const resolvedId = topicId || await resolveOpenAlexTopicId(name);
      if (token.aborted) return;
      setIsTextMatch(!resolvedId);
      topicMetaRef.current = { resolvedId, subfieldId };

      let [works, scholarOutcome] = await Promise.all([
        resolvedId ? fetchTopicWorks(resolvedId, 30) : fetchTopicWorksByText(name, 30, subfieldId),
        serpScholarSearch(name, serpKey, 20),
      ]);
      if (token.aborted) return;

      // Only the text-search fallback needs this — an exact topics.id match
      // (native or resolved) is already precise, and skipping this keeps the
      // common case free of an extra Claude round-trip.
      if (!resolvedId) {
        works = await claudeValidateWorks(name, works);
        if (token.aborted) return;
        setWasClaudeValidated(true);
      }

      setMostCited(works);
      setScholar(scholarOutcome.results);
      setScholarFailed(!scholarOutcome.ok);

      const authors = aggregateTopAuthors(works);
      const dois = works.map(w => w.doi).filter(Boolean).slice(0, 30);
      // H-index/i10-index are career-wide (not scoped to this topic), so they
      // need their own batched authors call — capped at 50 ids per request.
      const [influential, authorStats] = await Promise.all([
        fetchInfluentialByDoi(dois),
        fetchAuthorStats(authors.slice(0, 50).map(a => a.id)),
      ]);
      if (token.aborted) return;
      setMostInfluential(influential);
      setTopAuthors(authors.map(a => ({ ...a, hIndex: authorStats[a.id]?.hIndex ?? null })));

      setPhase('complete');
    } catch (err) {
      if (!token.aborted) {
        setError(err.message || 'Failed to load live data.');
        setPhase('error');
      }
    }
  }, []);

  // Re-fetches only the Scholar panel — used right after a SerpAPI key is saved
  // from Pulse's own inline prompt, without re-running the OpenAlex/S2 calls.
  const refreshScholar = useCallback(async () => {
    if (!topicName) return;
    const serpKey = localStorage.getItem('canon_serp_key') || '';
    setScholarLoading(true);
    const outcome = await serpScholarSearch(topicName, serpKey, 20);
    setScholar(outcome.results);
    setScholarFailed(!outcome.ok);
    setScholarLoading(false);
  }, [topicName]);

  // Only called when the user explicitly switches the Works panel to the
  // Reading Order view — cached per topic (readingStageGroups stays null
  // until then) so picking a topic never runs this by default.
  const loadReadingStages = useCallback(async () => {
    if (readingStageGroups || readingStagesLoading || !mostCited.length) return;
    setReadingStagesLoading(true);
    setReadingStagesFailed(false);

    const { resolvedId, subfieldId } = topicMetaRef.current;
    const seen = new Set(mostCited.map(dedupeKey));

    // The default citation-ranked fetch skews toward papers — explicitly pull
    // books too, so "Foundational Textbooks" has real candidates to classify
    // into rather than relying on one happening to be in the top-30-by-citations.
    const supplementalBooks = resolvedId
      ? await fetchTopicWorks(resolvedId, 15, 'book')
      : await fetchTopicWorksByText(topicName, 15, subfieldId, 'book');
    const pool = [...mostCited];
    for (const b of supplementalBooks) {
      const key = dedupeKey(b);
      if (!seen.has(key)) { seen.add(key); pool.push(b); }
    }

    const map = await classifyWorksByStage(topicName, pool);
    if (!map) {
      setReadingStagesFailed(true);
      setReadingStagesLoading(false);
      return;
    }

    const groups = {};
    for (const s of READING_STAGES) groups[s] = [];
    const unclassified = [];
    pool.forEach((w, i) => {
      const stage = map[i];
      if (stage) groups[stage].push(w);
      else unclassified.push(w);
    });

    // A stage can be empty not because no such work exists, but because
    // citation rank has nothing to do with a work's pedagogical role — go
    // looking specifically for that stage's character rather than leaving it
    // blank. Runs in parallel, only for stages that actually came up empty.
    const emptyStages = READING_STAGES.filter(s => groups[s].length === 0);
    if (emptyStages.length) {
      const perStage = await Promise.all(emptyStages.map(async stage => {
        const types = stage === 'Foundational Textbooks' ? 'book' : 'article|book';
        const candidates = await fetchStageBackfillWorks(topicName, STAGE_QUERY_HINTS[stage], 8, subfieldId, types);
        return { stage, candidates };
      }));

      const backfillCandidates = [];
      for (const { stage, candidates } of perStage) {
        for (const c of candidates) {
          const key = dedupeKey(c);
          if (!seen.has(key)) { seen.add(key); backfillCandidates.push({ ...c, _targetStage: stage }); }
        }
      }

      if (backfillCandidates.length) {
        // Relevance + stage-fit are both re-checked here (see
        // classifyBackfillCandidates) — fetchStageBackfillWorks' query already
        // requires every topic word present, but that's a query-level
        // guarantee, not a substitute for an independent judgment call.
        const backfillMap = await classifyBackfillCandidates(topicName, backfillCandidates);
        backfillCandidates.forEach((w, i) => {
          const stage = backfillMap[i];
          if (stage && stage === w._targetStage) {
            const { _targetStage, ...work } = w;
            groups[stage].push(work);
          }
        });
      }
    }

    setReadingStageGroups(groups);
    setReadingStagesUnclassified(unclassified);
    setReadingStagesLoading(false);
  }, [topicName, mostCited, readingStageGroups, readingStagesLoading]);

  const reset = useCallback(() => {
    cancelRef.current.aborted = true;
    setPhase('idle');
    setError(null);
    setTopicName('');
    setIsTextMatch(false);
    setWasClaudeValidated(false);
    setMostCited([]);
    setTopAuthors([]);
    setMostInfluential([]);
    setScholar([]);
    setScholarFailed(false);
    setReadingStageGroups(null);
    setReadingStagesUnclassified([]);
    setReadingStagesFailed(false);
  }, []);

  return {
    phase, error, topicName, isTextMatch, wasClaudeValidated, mostCited, topAuthors, mostInfluential, scholar, scholarFailed, scholarLoading,
    readingStageGroups, readingStagesUnclassified, readingStagesLoading, readingStagesFailed, loadReadingStages,
    hasScholarKey, select, reset, refreshScholar,
  };
}
