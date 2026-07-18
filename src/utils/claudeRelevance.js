// Shared by usePulse.js and the Theory Deep Dive sources (theoryPhysics.js,
// theoryCS.js, theoryMath.js). Originally usePulse.js's own claudeValidateWorks
// — generalized here so a second and third caller don't duplicate it.

export function resolveAnthropicApiKey() {
  return import.meta.env.VITE_ANTHROPIC_API_KEY || localStorage.getItem('canon_api_key') || '';
}

// Every other Claude caller in this app streams and explicitly filters for
// text_delta events, skipping any other content-block type (e.g. thinking).
// This (and its callers) are the app's only non-streaming calls, and grabbing
// content[0] blindly assumes the first block is always the text block — if a
// non-text block (like extended thinking) precedes it, content[0].text is
// undefined and everything downstream silently parses nothing. Confirmed as
// the cause of generateReadingOrder repeatedly parsing to all-empty on real
// topics (see usePulse.js history).
function extractText(data) {
  return (data.content || []).find(b => b.type === 'text')?.text || '';
}

// Checks whether a list of academic works genuinely belongs to a topic —
// used wherever the underlying source's own search is loose/fuzzy text
// matching rather than a precise filter (confirmed live across zbMATH, DBLP,
// and INSPIRE-HEP free-text search: real off-topic results and even a
// literal API placeholder string surfaced as a "title" — see Theory Deep
// Dive's junk-results fix). Fails soft: returns the unfiltered list with
// wasFiltered:false on any error or missing key — showing possibly-noisy
// results beats a blank panel from a transient failure. Items need only
// {title, authors?, year?}.
export async function filterRelevantByTitle(topicName, items) {
  const apiKey = resolveAnthropicApiKey();
  if (!apiKey || !items.length) return { items, wasFiltered: false };

  const list = items.map((w, i) => `${i}. ${w.title}${w.authors ? ` — ${w.authors}` : ''}${w.year ? ` (${w.year})` : ''}`).join('\n');
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
    if (!res.ok) return { items, wasFiltered: false };
    const data = await res.json();
    const text = extractText(data).trim();
    if (/^NONE$/i.test(text)) return { items: [], wasFiltered: true };
    const keep = new Set(text.split('\n').map(l => parseInt(l.trim(), 10)).filter(n => !Number.isNaN(n)));
    if (!keep.size) return { items, wasFiltered: false };
    return { items: items.filter((_, i) => keep.has(i)), wasFiltered: true };
  } catch {
    return { items, wasFiltered: false };
  }
}

// Adds a short "why this specific work matters for this specific topic" plus
// a "where to look" pointer (main theorem, key section, etc.) to each work.
// Only has title/authors/year to go on — explicitly told not to invent exact
// page/chapter numbers unless it's a well-known work, since that would be
// fabricated bibliographic detail, not inferred context. Fails soft: returns
// null annotations on any error, same convention as filterRelevantByTitle.
export async function annotateWorks(topicName, items) {
  const apiKey = resolveAnthropicApiKey();
  if (!apiKey || !items.length) return items.map(() => null);

  const list = items.map((w, i) => `${i}. "${w.title}" by ${w.authors || 'unknown author'} (${w.year || 'n.d.'})`).join('\n');
  const system = `For each academic work, given only its title, author, and year, and a specific topic it was matched to, write two short lines about it:
RELEVANCE: one sentence on what THIS work specifically contributes to the topic — not a generic summary of the field, the thing this particular paper/book actually did.
FOCUS: where in the work the material most relevant to the topic likely is (e.g. "the main theorem and its proof", "the introduction's motivating example", "the algorithm in section 3-ish"). Describe this in general terms inferable from the title/context and your own knowledge of the work. Do not invent specific page or chapter numbers unless you genuinely recognize this exact work and are confident about its structure.

Output format — exactly this, one block per work, in order, nothing else:
0.
RELEVANCE: ...
FOCUS: ...
1.
RELEVANCE: ...
FOCUS: ...`;
  const user = `Topic: "${topicName}"\n\nWorks:\n${list}`;

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
        max_tokens: 1200,
        system,
        messages: [{ role: 'user', content: user }],
      }),
    });
    if (!res.ok) return items.map(() => null);
    const data = await res.json();
    const text = extractText(data);

    const annotations = items.map(() => null);
    const blocks = text.split(/\n(?=\d+\.\s*$)/m);
    for (const block of blocks) {
      const idxMatch = block.match(/^(\d+)\./);
      if (!idxMatch) continue;
      const idx = parseInt(idxMatch[1], 10);
      const relMatch = block.match(/RELEVANCE:\s*(.+)/);
      const focMatch = block.match(/FOCUS:\s*(.+)/);
      if (idx >= 0 && idx < items.length && (relMatch || focMatch)) {
        annotations[idx] = { relevance: relMatch?.[1]?.trim() || '', focus: focMatch?.[1]?.trim() || '' };
      }
    }
    return annotations;
  } catch {
    return items.map(() => null);
  }
}

export const CONCEPT_LEVELS = ['Foundational', 'Intermediate', 'Advanced', 'Research'];

// Sorts a paradigm's flat concept list into a depth hierarchy — one Claude
// call per paradigm, batched. Opt-in only (never fires on its own): a Haiku
// call per paradigm the moment a branch renders would mean 16+ calls just
// from opening the Logic tab. Fails soft to null (caller falls back to the
// flat list) on any error or missing key.
export async function classifyConceptLevels(subfieldName, topics) {
  const apiKey = resolveAnthropicApiKey();
  if (!apiKey || !topics.length) return topics.map(() => null);

  const list = topics.map((t, i) => `${i}. ${t}`).join('\n');
  const system = `You classify concepts within the paradigm "${subfieldName}" into a depth/difficulty hierarchy. For each concept, assign exactly one level:
FOUNDATIONAL — assumed prerequisite knowledge, typically encountered first.
INTERMEDIATE — builds directly on foundational concepts; standard undergraduate/early-graduate material.
ADVANCED — graduate-level, assumes intermediate mastery.
RESEARCH — frontier or highly specialized, typically only encountered in research or advanced seminars.

Respond with exactly one line per concept, in order, in the format "N: LEVEL" (e.g. "0: FOUNDATIONAL"). Nothing else.`;
  const user = `Concepts:\n${list}`;

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
        max_tokens: 1500,
        system,
        messages: [{ role: 'user', content: user }],
      }),
    });
    if (!res.ok) return topics.map(() => null);
    const data = await res.json();
    const text = extractText(data);

    const levels = topics.map(() => null);
    const validSet = new Set(CONCEPT_LEVELS.map(l => l.toUpperCase()));
    for (const line of text.split('\n')) {
      const m = line.match(/^\s*(\d+)\s*:\s*([A-Z]+)/i);
      if (!m) continue;
      const idx = parseInt(m[1], 10);
      const lvl = m[2].toUpperCase();
      if (idx >= 0 && idx < topics.length && validSet.has(lvl)) {
        levels[idx] = CONCEPT_LEVELS.find(l => l.toUpperCase() === lvl);
      }
    }
    return levels;
  } catch {
    return topics.map(() => null);
  }
}
