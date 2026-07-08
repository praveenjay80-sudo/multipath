import { useState, useCallback, useRef } from 'react';
import { fetchTopicWorks, fetchTopicWorksByText, resolveOpenAlexTopicId, aggregateTopAuthors, fetchAuthorStats } from '../utils/pulseOpenAlex';

const WORKER_BASE = 'https://canon-enrichment.canonworks.workers.dev';

function resolveApiKey() {
  return import.meta.env.VITE_ANTHROPIC_API_KEY || localStorage.getItem('canon_api_key') || '';
}

// Every other Claude caller in this app streams and explicitly filters for
// text_delta events, skipping any other content-block type (e.g. thinking).
// These are the app's only non-streaming calls, and grabbing content[0]
// blindly assumes the first block is always the text block — if a non-text
// block (like extended thinking) precedes it, content[0].text is undefined
// and everything downstream silently parses nothing. Confirmed as the cause
// of generateReadingOrder repeatedly parsing to all-empty on real topics.
function extractText(data) {
  return (data.content || []).find(b => b.type === 'text')?.text || '';
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
    const text = extractText(data).trim();
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

// One-line definitions so generation is consistent rather than guessed
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

// Chasing precision through OpenAlex classification (real works, but
// forced into whatever the citation-ranked set happened to contain) kept
// hitting the same wall: citation rank has nothing to do with pedagogical
// role, and word-overlap search kept letting unrelated papers through no
// matter how the query was tightened. This generates the reading list
// directly from Claude's own knowledge instead — comprehensive per stage,
// not constrained to a pre-fetched database pool. The tradeoff is explicit
// and disclosed in the UI: these works are not cross-checked against
// OpenAlex, so verify anything load-bearing yourself (the Google Scholar
// links on each entry are a real, deterministic search — not AI-generated
// — for exactly that purpose).
async function generateReadingOrder(topicName, subfieldName) {
  const apiKey = resolveApiKey();
  if (!apiKey) return null;

  const stageBlock = READING_STAGES.map(s => `STAGE: ${s}\n(${STAGE_DEFINITIONS[s]})`).join('\n\n');
  const system = `You build comprehensive, pedagogically-ordered reading lists for academic topics. Only name real, verifiable books and papers you are confident actually exist, with accurate author and year. Never invent or approximate a title, author, or year you are not sure of — it is far better to list fewer genuinely real works in a stage than to pad it with an invented one.`;
  // A topic name alone can be ambiguous across fields (confirmed: "Advanced
  // Algebra and Geometry" picked under the Mathematical Physics subfield
  // still generated a pure-math reading list, because nothing told Claude
  // which subfield's lens to read the topic through). Naming the subfield
  // explicitly disambiguates which reading of the topic is wanted.
  const topicLine = subfieldName
    ? `Topic: "${topicName}", specifically as studied within the "${subfieldName}" subfield — not how a different field would treat a similarly-named topic. If this subfield gives the topic a distinct character or angle (e.g. its physics/applied treatment rather than the pure-math one, or vice versa), the reading list must reflect that angle throughout, not a generic version of the topic.`
    : `Topic: "${topicName}"`;
  const user = `${topicLine}

Build a comprehensive reading list for this topic, organized into exactly these six pedagogical stages in this order:

${stageBlock}

For each stage, list every genuinely relevant real work you know of — no arbitrary cap, but don't pad with marginal or invented entries. Format:

STAGE: <stage name>
- Title by Author (Year) — one-sentence rationale for why it belongs in this specific stage
- Title by Author (Year) — rationale
...

If you don't know of a genuine work for a stage, write exactly "- None known" under that stage instead of inventing one. Use the exact stage names given, in the exact order given.

Plain text only — no markdown bold/italic (**...**, *...*), no headers (#), no numbered lists. Every stage line must start with the literal text "STAGE: " and every entry line must start with a literal "- ", exactly as shown above.`;

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
        model: 'claude-sonnet-5',
        max_tokens: 6000,
        system,
        messages: [{ role: 'user', content: user }],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return parseReadingOrder(extractText(data));
  } catch {
    return null;
  }
}

// A first-pass "None known" is often an incomplete recall, not an honest
// answer — confirmed: the main call missed Sklar's "Physics and Chance,"
// Albert's "Time and Chance," and Hemmo & Shenker's "The Road to Maxwell's
// Demon" for Philosophical Frameworks under statistical mechanics, despite
// all three being standard references in that exact area. One focused
// follow-up per empty stage — considering just that stage instead of all
// six at once — gives Claude a real second chance to recall something
// genuine before the UI accepts that nothing exists. Still not allowed to
// invent: broadening to adjacent/less-famous-but-real work is fine, making
// something up is not.
async function retryEmptyStage(topicName, subfieldName, stage) {
  const apiKey = resolveApiKey();
  if (!apiKey) return [];

  const topicLine = subfieldName
    ? `Topic: "${topicName}", specifically within the "${subfieldName}" subfield`
    : `Topic: "${topicName}"`;
  const system = `You recall real, verifiable academic works for a specific reading-list stage. A first attempt found nothing for this stage — think harder before agreeing that's correct. Only name works you are confident actually exist, with accurate author and year. Never invent one — if truly nothing exists after genuinely reconsidering, say so.`;
  const user = `${topicLine}

Stage: ${stage} (${STAGE_DEFINITIONS[stage]})

An earlier pass found no work for this stage. Think again, specifically: classic or standard references you might not have considered first time, less-famous but genuine works, or works from a slightly broader/adjacent angle that still genuinely fit this stage for this topic.

If you can now think of genuine work, list it:
- Title by Author (Year) — one-sentence rationale for why it fits this specific stage

If you are still confident nothing genuine exists for this stage even after reconsidering, respond with exactly: NONE

Plain text only — no markdown, no headers, no numbered lists.`;

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
        model: 'claude-sonnet-5',
        max_tokens: 1000,
        system,
        messages: [{ role: 'user', content: user }],
      }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const text = stripLineMarkdown(extractText(data).trim());
    if (/^NONE$/i.test(text)) return [];
    const entries = [];
    for (const raw of text.split('\n')) {
      const line = stripLineMarkdown(raw);
      const bulletMatch = line.match(/^(?:[-*•]|\d+[.)])\s*(.+)$/);
      if (!bulletMatch) continue;
      const entryText = bulletMatch[1].trim();
      if (/^none known$/i.test(entryText) || /^none$/i.test(entryText)) continue;
      const entry = parseReadingOrderEntry(entryText);
      if (entry) entries.push(entry);
    }
    return entries;
  } catch {
    return [];
  }
}

// "Title by Author (Year) — rationale" mirrors the citation format used
// throughout the rest of the app's Claude-generated reading lists.
function parseReadingOrderEntry(line) {
  // Prefer the em-dash separator asked for; fall back to a plain " - " (with
  // spaces on both sides, so it won't fire on a hyphenated word in a title).
  let [head, ...rest] = line.split(/\s+—\s+/);
  if (!rest.length && / - /.test(line)) [head, ...rest] = line.split(/ - /);
  const rationale = rest.join(' — ').trim();
  const yearMatch = head.match(/\((\d{4})\)\s*$/);
  const year = yearMatch ? yearMatch[1] : null;
  const withoutYear = (yearMatch ? head.slice(0, yearMatch.index) : head).trim();
  const byIdx = withoutYear.toLowerCase().lastIndexOf(' by ');
  const title = byIdx >= 0 ? withoutYear.slice(0, byIdx).trim() : withoutYear;
  const authors = byIdx >= 0 ? withoutYear.slice(byIdx + 4).trim() : '';
  if (!title) return null;
  return { title, authors, year, rationale };
}

// Strips markdown the model adds despite being told not to (bold/italic
// emphasis, heading hashes) — without this, a single "**STAGE: ...**" line
// fails the literal STAGE: match, `current` never gets set, and every entry
// after it gets silently dropped (confirmed: an entire real, comprehensive
// response for "Stochastic processes and statistical mechanics" parsed to
// six empty stages because of exactly this).
function stripLineMarkdown(line) {
  return line
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/^#{1,6}\s*/, '')
    .trim();
}

// Matches a header line to one of the six stages regardless of whether the
// literal "STAGE:" prefix, a trailing colon, or leading numbering survived —
// checks whether the line, once that scaffolding is stripped, IS one of the
// six stage names, rather than requiring an exact literal keyword. This is
// what actually saved a second empty-everything failure ("Quantum chaos and
// semiclassical analysis"): the earlier fix only tolerated markdown *around*
// "STAGE:", but the model had dropped that literal prefix entirely and
// written the bare stage name as its own heading line instead.
function matchStageHeader(line, byNormalized) {
  const candidate = line
    .replace(/^STAGE:\s*/i, '')
    .replace(/^\d+[.)]\s*/, '')
    .replace(/:\s*$/, '')
    .trim();
  return byNormalized.get(normalizeStageName(candidate)) || null;
}

function parseReadingOrder(text) {
  const byNormalized = new Map(READING_STAGES.map(s => [normalizeStageName(s), s]));
  const groups = {};
  for (const s of READING_STAGES) groups[s] = [];
  let current = null;
  for (const raw of (text || '').split('\n')) {
    const line = stripLineMarkdown(raw);
    if (!line) continue;

    // Bullet markers: "-", "*", "•", or a leading "1." / "1)" — the model was
    // told to use "- " but tolerate the common alternates rather than drop
    // an otherwise-good entry over a formatting mismatch. Checked before the
    // header match so a numbered bullet line is never mistaken for a header.
    const bulletMatch = line.match(/^(?:[-*•]|\d+[.)])\s*(.+)$/);
    if (bulletMatch) {
      if (!current) continue;
      const entryText = bulletMatch[1].trim();
      if (/^none known$/i.test(entryText)) continue;
      const entry = parseReadingOrderEntry(entryText);
      if (entry) groups[current].push(entry);
      continue;
    }

    const stage = matchStageHeader(line, byNormalized);
    if (stage) current = stage;
  }
  return groups;
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
  const [readingStageGroups, setReadingStageGroups] = useState(null); // { [stage]: entries[] }
  const [readingStagesLoading, setReadingStagesLoading] = useState(false);
  const [readingStagesFailed, setReadingStagesFailed] = useState(false);
  const cancelRef = useRef({ aborted: false });
  const subfieldNameRef = useRef('');

  const hasScholarKey = !!localStorage.getItem('canon_serp_key');

  const select = useCallback(async (topicId, name, subfieldId, subfieldName) => {
    cancelRef.current.aborted = true;
    const token = { aborted: false };
    cancelRef.current = token;

    setPhase('loading');
    setError(null);
    setTopicName(name);
    subfieldNameRef.current = subfieldName || '';
    setMostCited([]);
    setTopAuthors([]);
    setMostInfluential([]);
    setScholar([]);
    setScholarFailed(false);
    setWasClaudeValidated(false);
    setReadingStageGroups(null);
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
  // until then) so picking a topic never runs this by default. Generates
  // directly from Claude's own knowledge (see generateReadingOrder) rather
  // than classifying a pre-fetched OpenAlex pool — deliberate, per repeated
  // precision issues with database-constrained classification.
  const loadReadingStages = useCallback(async () => {
    if (readingStageGroups || readingStagesLoading || !topicName) return;
    setReadingStagesLoading(true);
    setReadingStagesFailed(false);
    const subfieldName = subfieldNameRef.current;
    const groups = await generateReadingOrder(topicName, subfieldName);
    // Every stage coming back empty is essentially always a parsing failure,
    // not Claude genuinely knowing nothing — confirmed twice on mainstream
    // topics ("Stochastic processes and statistical mechanics", "Quantum
    // chaos and semiclassical analysis"). Surface it as a retryable failure
    // instead of silently claiming no genuine work exists for any stage.
    const hasAnyWork = groups && READING_STAGES.some(s => (groups[s] || []).length > 0);
    if (!hasAnyWork) {
      setReadingStagesFailed(true);
      setReadingStagesLoading(false);
      return;
    }

    // A first pass missing a stage is often incomplete recall, not an honest
    // "nothing exists" (confirmed: the first pass skipped Sklar's "Physics
    // and Chance," a standard reference, for Philosophical Frameworks under
    // statistical mechanics). One focused retry per still-empty stage before
    // accepting the gap.
    const emptyStages = READING_STAGES.filter(s => (groups[s] || []).length === 0);
    if (emptyStages.length) {
      const retries = await Promise.all(
        emptyStages.map(stage => retryEmptyStage(topicName, subfieldName, stage))
      );
      emptyStages.forEach((stage, i) => { groups[stage] = retries[i]; });
    }

    setReadingStageGroups(groups);
    setReadingStagesLoading(false);
  }, [topicName, readingStageGroups, readingStagesLoading]);

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
    setReadingStagesFailed(false);
  }, []);

  return {
    phase, error, topicName, isTextMatch, wasClaudeValidated, mostCited, topAuthors, mostInfluential, scholar, scholarFailed, scholarLoading,
    readingStageGroups, readingStagesLoading, readingStagesFailed, loadReadingStages,
    hasScholarKey, select, reset, refreshScholar,
  };
}
