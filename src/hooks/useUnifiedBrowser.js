import { useState, useCallback, useRef, useMemo } from 'react';
import { harvestAll } from '../utils/harvestData';
import { syllabusHarvest, seminalPapersHarvest } from '../utils/syllabusHarvest';
import { parseAll } from '../utils/entityParser';
import { buildEntityIndex } from './useEntityIndex';

const resolveApiKey = () =>
  import.meta.env.VITE_ANTHROPIC_API_KEY || localStorage.getItem('canon_api_key') || '';

const SONNET = 'claude-sonnet-4-6';
const HAIKU = 'claude-haiku-4-5-20251001';

// ── Section Prompts (unchanged) ────────────────────────────────────────────

const QUESTIONS_PROMPT = `You are an expert in the given topic. List the most fundamental questions — both answered and open — that define this field.

Use ### headers for each question. For each:
- Formulate the question precisely in plain English
- State whether it is settled, contested, or genuinely open
- Why it matters — what hinges on the answer
- 2–3 landmark works that addressed it (with authors and years)

List at least 8 questions. Start with the deepest, most foundational ones.`;

const CONCEPTS_PROMPT = `Map every essential concept in the given topic. Organize into three tiers.

### Tier 1: Prerequisite Concepts
Concepts someone must understand before engaging with this topic at all.

### Tier 2: Core Concepts
The central concepts this field actually studies.

### Tier 3: Advanced Concepts
Sophisticated concepts encountered in the research frontier.

For each concept, write one clear sentence defining it. List at least 20 concepts total across all three tiers.`;

const SCHOOLS_PROMPT = `Map every significant school of thought within or bearing on the given topic.

Use ### headers for each school. For each:
- Core tenets (what they believe)
- Key figures (with their signature contributions)
- What evidence supports their position
- What they cannot explain (the tension)
- Key works that define the school

Include ALL significant schools, not just the currently dominant ones. Write in clear English.`;

const PREREQUISITES_PROMPT = `You are designing a structured LEARNING PATH — the sequence of resources a complete beginner needs to acquire before they can meaningfully engage with the given topic at the research level.

Use exactly these four ### headers in this order. Each phase must show ONLY resources that are genuinely useful for someone learning the topic — no research papers or scholarly monographs in early phases.

### Phase 0: What you need BEFORE this topic (background from other fields)
The mathematical, scientific, or conceptual background someone needs from outside this field. Examples: linear algebra before quantum mechanics, basic probability before machine learning, intro sociology before political theory. List 4–6 specific resources that the average learner should already know or read first. Name actual books/courses/lectures.

### Phase 1: Gentle introductions (popular books, essays, videos)
Resources written for the educated layperson — no equations, no jargon, just the core ideas. 3–5 entries. These are NOT textbooks. They orient the learner to what the field is and why it matters.

### Phase 2: Foundational preparation (introductory textbooks)
The standard undergraduate-level textbooks that establish the formal vocabulary and basic techniques. 4–6 entries. These are rigorous but accessible to a first-time learner. Do NOT include graduate texts or research monographs here.

### Phase 3: Core engagement (the canonical works everyone reads)
The intermediate-to-advanced books and papers that define what every working scholar in this field has internalized. 5–8 entries. These are rigorous graduate-level works. Include the seminal textbooks AND the most-cited foundational papers.

For every work, format as: "Title" by Author (Year) — one-sentence note on why this specific resource is at this phase.

CRITICAL: Phase 0 must be background from OTHER fields, not works in this field. Phase 1 must be popular/non-technical. Phase 2 must be introductory textbooks. Only Phase 3 should be graduate/research-level. If you put a research paper in Phase 0/1/2, the learning path is broken.`;

const CANON_PROMPT = `Produce the definitive reading list for the given topic. Organize into 6 learning stages using ### headers.

Stage 0: Popular / Gentle Introduction
Stage 1: Foundational Textbooks
Stage 2: Core Papers (seminal, must-read)
Stage 3: Advanced Monographs & Surveys
Stage 4: Contemporary Frontier
Stage 5: Specialized Deep Cuts

For each work, format as: "Title" by Author (Year) — one-sentence annotation. Prefer landmark works.

Include at least 25 works across all stages. Never omit a canonical work.`;

const THINKERS_PROMPT = `Identify the most important thinkers in the given topic — those who shaped its development and current state.

Organize into two sections using ### headers.

### Foundational Thinkers
Historical figures who created or transformed the field. For each: their key idea, what changed because of it, and their most important work.

### Active Researchers
Currently productive researchers driving the frontier. For each: their specific contribution to this topic, their signature paper, and what they are working on now.

Include at least 12 thinkers total. Write in clear English.`;

const METHODOLOGIES_PROMPT = `Map the key methodologies used in the given topic.

For each methodology (use ### headers):
- What it is and when to use it
- What kinds of questions it answers
- Its strengths and limitations
- 1–2 landmark works that exemplify this methodology
- What tools or techniques it requires

Cover theoretical, empirical, computational, and qualitative approaches as applicable.`;

const ADJACENT_FIELDS_PROMPT = `Map every adjacent field that connects to or intersects with the given topic.

Use ### headers for each adjacent field. For each:
- How it connects (shared concepts, methods, or questions)
- The most interesting intersection — what sits at the border
- Key works that bridge the two fields
- One open question at the intersection

Include at least 6 adjacent fields. Write in clear English.`;

const CONSILIENCE_PROMPT = `Identify every academic discipline that genuinely bears on the given topic. For each, write:

### [Discipline name]
**Their lens:** The angle from which this discipline approaches the topic.
**What they contribute:** The specific insight, data, or method this discipline brings.
**Blind spot:** What they miss by approaching it their way.
**Key work:** One work that shows this discipline at its best on this topic.

After all disciplines, write a ### Synthesis section that identifies:
- Where multiple disciplines converge on the same conclusion (strength)
- Where they genuinely disagree (tension — this is where new work lies)
- What no single discipline can see alone

Be exhaustive. Include every discipline with a genuinely distinct insight.`;

const FRONTIER_PROMPT = `Map the frontier of the given topic — where research is currently happening and what is genuinely unsolved.

Use ### headers for three sections.

### Open Problems
At least 6 genuinely unsolved questions. For each: formulate precisely, why it's hard, what has been tried, who is working on it.

### Active Controversies
At least 4 debates where reasonable researchers disagree. For each: what each side claims, what evidence each side has, what would settle it.

### Emerging Research Fronts
At least 3 areas with accelerating activity. For each: what it is, why now, the key recent papers, and what comes next.`;

const CONFERENCES_PROMPT = `List the major conferences, journals, and professional societies in the given topic.

Use ### headers for three sections.

### Conferences
The top 4–6 conferences or annual meetings. For each: name, typical topics, frequency, and why to attend.

### Journals
The top 6–8 journals. For each: name, scope, impact tier (flagship / specialist / emerging), and what kinds of papers they publish.

### Professional Societies & Communities
The main organizations, mailing lists, and online communities where researchers in this field gather.

Be concise and practical.`;

const TIMELINE_PROMPT = `Produce a concise intellectual history of the given topic as a series of landmark events.

Format each entry as a bullet:
- **Year** — Event description. Person/Work responsible.

Cover:
- The founding of the field (earliest formative works)
- Key breakthroughs (paradigm shifts, decisive experiments, theorems)
- Major surveys or textbooks that codified the discipline
- Contemporary milestones (last 10 years)

List at least 12 events spanning the full history.`;

const PROMPTS = {
  questions: QUESTIONS_PROMPT,
  concepts: CONCEPTS_PROMPT,
  schools: SCHOOLS_PROMPT,
  prerequisites: PREREQUISITES_PROMPT,
  canon: CANON_PROMPT,
  thinkers: THINKERS_PROMPT,
  methodologies: METHODOLOGIES_PROMPT,
  adjacent: ADJACENT_FIELDS_PROMPT,
  consilience: CONSILIENCE_PROMPT,
  frontier: FRONTIER_PROMPT,
  timeline: TIMELINE_PROMPT,
  conferences: CONFERENCES_PROMPT,
};

// ── Section definitions ─────────────────────────────────────────────────────

export const SECTION_DEFS = [
  { key: 'questions',     label: 'Fundamental Questions',        model: SONNET, needsHarvest: false, maxTokens: 4096 },
  { key: 'concepts',      label: 'Complete Concept Map',         model: SONNET, needsHarvest: false, maxTokens: 4096 },
  { key: 'schools',       label: 'Schools of Thought',           model: SONNET, needsHarvest: false, maxTokens: 4096 },
  { key: 'prerequisites', label: 'Prerequisite Path',            model: SONNET, needsHarvest: false, maxTokens: 4096 },
  { key: 'canon',         label: 'Canon by Learning Stage',      model: SONNET, needsHarvest: true,  maxTokens: 6144 },
  { key: 'thinkers',      label: 'Thinkers & Researchers',       model: SONNET, needsHarvest: true,  maxTokens: 4096 },
  { key: 'methodologies', label: 'Methodologies & Tools',        model: SONNET, needsHarvest: false, maxTokens: 4096 },
  { key: 'adjacent',      label: 'Adjacent Fields',              model: SONNET, needsHarvest: false, maxTokens: 4096 },
  { key: 'consilience',   label: 'Consilience (All Disciplines)', model: SONNET, needsHarvest: false, maxTokens: 6144 },
  { key: 'frontier',      label: 'Open Problems & Controversies', model: SONNET, needsHarvest: true, maxTokens: 6144 },
  { key: 'timeline',      label: 'Intellectual Timeline',        model: HAIKU,  needsHarvest: false, maxTokens: 3072 },
  { key: 'conferences',   label: 'Conferences & Journals',       model: HAIKU,  needsHarvest: false, maxTokens: 3072 },
];

const INIT_SECTIONS = Object.fromEntries(
  SECTION_DEFS.map(s => [s.key, { phase: 'idle', content: '' }])
);

// ── Streaming helper ────────────────────────────────────────────────────────

async function streamSection(system, userMsg, signal, onChunk, maxTokens, model) {
  const key = resolveApiKey();
  if (!key) throw new Error('No API key set — add one in Settings.');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: model || SONNET,
      max_tokens: maxTokens || 4096,
      stream: true,
      system,
      messages: [{ role: 'user', content: userMsg }],
    }),
    signal,
  });

  if (!res.ok) {
    let msg = `API error ${res.status}`;
    try { const e = await res.json(); msg = e.error?.message || msg; } catch {}
    throw new Error(msg);
  }

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  let accumulated = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const d = line.slice(6).trim();
        if (!d || d === '[DONE]') continue;
        try {
          const ev = JSON.parse(d);
          if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta') {
            accumulated += ev.delta.text;
            onChunk(accumulated);
          }
        } catch { /* skip malformed */ }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// ── Hook ────────────────────────────────────────────────────────────────────

export function useUnifiedBrowser() {
  const [phase, setPhase] = useState('idle');
  const [topic, setTopic] = useState('');
  const [error, setError] = useState(null);
  const [sections, setSections] = useState(() => ({ ...INIT_SECTIONS }));
  const [dataCount, setDataCount] = useState(0);
  const [harvestedPapers, setHarvestedPapers] = useState([]);
  const [harvestedTextbooks, setHarvestedTextbooks] = useState([]);
  const [selectedEntity, setSelectedEntity] = useState(null);
  const abortRef = useRef(null);
  const dataBlockRef = useRef('');

  const completedCount = Object.values(sections).filter(s => s.phase === 'complete').length;
  const activeCount = Object.values(sections).filter(s => s.phase === 'streaming').length;

  // Parse entities from all completed sections
  const parsedEntities = useMemo(() => {
    const all = { works: [], concepts: [], researchers: [] };
    for (const def of SECTION_DEFS) {
      const sec = sections[def.key];
      if (!sec?.content) continue;
      const parsed = parseAll(sec.content);
      all.works.push(...parsed.works);
      all.concepts.push(...parsed.concepts);
      all.researchers.push(...parsed.researchers);
    }
    // Dedupe
    const seen = { works: new Set(), concepts: new Set(), researchers: new Set() };
    const out = { works: [], concepts: [], researchers: [] };
    for (const w of all.works) {
      const k = `${w.title.toLowerCase()}|${w.firstAuthor.toLowerCase()}`;
      if (seen.works.has(k)) continue;
      seen.works.add(k);
      out.works.push(w);
    }
    for (const c of all.concepts) {
      if (seen.concepts.has(c.name.toLowerCase())) continue;
      seen.concepts.add(c.name.toLowerCase());
      out.concepts.push(c);
    }
    for (const r of all.researchers) {
      if (seen.researchers.has(r.name.toLowerCase())) continue;
      seen.researchers.has(r.name.toLowerCase());
      seen.researchers.add(r.name.toLowerCase());
      out.researchers.push(r);
    }
    return out;
  }, [sections]);

  // Build the relationship index from harvested data + parsed entities
  const entityIndex = useMemo(
    () => buildEntityIndex(harvestedPapers, parsedEntities),
    [harvestedPapers, parsedEntities]
  );

  const openEntity = useCallback((entity) => {
    setSelectedEntity(entity);
  }, []);

  const closeEntity = useCallback(() => {
    setSelectedEntity(null);
  }, []);

  const setSectionState = useCallback((key, update) => {
    setSections(prev => ({
      ...prev,
      [key]: typeof update === 'function' ? update(prev[key]) : { ...prev[key], ...update },
    }));
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setPhase('idle');
    setTopic('');
    setError(null);
    setSections({ ...INIT_SECTIONS });
    setDataCount(0);
    setHarvestedPapers([]);
    setHarvestedTextbooks([]);
    setSelectedEntity(null);
  }, []);

  const run = useCallback(async (inputTopic, sectionKeys = null) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const { signal } = controller;

    setTopic(inputTopic);
    setError(null);
    setDataCount(0);
    setHarvestedPapers([]);
    setHarvestedTextbooks([]);
    setSelectedEntity(null);

    // Mark skipped sections upfront
    const selectedSet = sectionKeys ? new Set(sectionKeys) : null;
    const initSections = Object.fromEntries(
      SECTION_DEFS.map(s => [s.key, {
        phase: selectedSet && !selectedSet.has(s.key) ? 'skipped' : 'idle',
        content: '',
      }])
    );
    setSections(initSections);
    setPhase('harvesting');

    const apiKey = resolveApiKey();
    if (!apiKey) {
      setError('No API key set — add one in Settings.');
      setPhase('error');
      return;
    }

    let works = [];
    let ospWorks = [];
    let seminalWorks = [];

    try {
      const [hResult, ospResult, seminalResult] = await Promise.all([
        harvestAll(inputTopic).catch(() => ({ merged: [], counts: {} })),
        syllabusHarvest(inputTopic).catch(() => []),
        seminalPapersHarvest(inputTopic).catch(() => []),
      ]);

      if (signal.aborted) return;

      works = (hResult?.merged || []).slice(0, 80);
      ospWorks = (ospResult || []).slice(0, 40);
      seminalWorks = (seminalResult || []).slice(0, 40);

      setHarvestedPapers(works);
      setHarvestedTextbooks(ospWorks);
      setDataCount(works.length + ospWorks.length + seminalWorks.length);
    } catch {
      // proceed without data
    }

    if (signal.aborted) return;
    setPhase('streaming');

    const workLines = works.slice(0, 60).map(w =>
      `- "${w.title}" by ${w.authors || 'Unknown'}${w.year ? ` (${w.year})` : ''} — ${w.citationCount || 0} citations`
    ).join('\n');
    const ospLines = ospWorks.slice(0, 40).map(w =>
      `- "${w.title}" by ${w.authors || 'Unknown'} — Taught in ${w.syllabusCount || 0} courses`
    ).join('\n');
    const seminalLines = seminalWorks.slice(0, 40).map(w =>
      `- "${w.title}" by ${w.authors || 'Unknown'}${w.year ? ` (${w.year})` : ''} — ${w.influentialCitationCount || 0} influential citations`
    ).join('\n');

    const dataBlock = `\n\n=== HARVESTED WORKS ===\n${workLines || '(none)'}\n\n=== MOST TAUGHT (Open Syllabus) ===\n${ospLines || '(none)'}\n\n=== SEMINAL PAPERS ===\n${seminalLines || '(none)'}`;
    dataBlockRef.current = dataBlock;

    const defsToRun = selectedSet
      ? SECTION_DEFS.filter(d => selectedSet.has(d.key))
      : SECTION_DEFS;

    await Promise.all(
      defsToRun.map(async (def) => {
        if (signal.aborted) return;
        setSectionState(def.key, { phase: 'streaming', content: '' });

        const userMsg = def.needsHarvest
          ? `Topic: ${inputTopic}${dataBlock}`
          : `Topic: ${inputTopic}`;

        try {
          await streamSection(
            PROMPTS[def.key],
            userMsg,
            signal,
            (text) => setSectionState(def.key, { phase: 'streaming', content: text }),
            def.maxTokens,
            def.model
          );
          if (!signal.aborted) {
            setSectionState(def.key, prev => ({ ...prev, phase: 'complete' }));
          }
        } catch (err) {
          if (signal.aborted) return;
          setSectionState(def.key, {
            phase: 'error',
            content: `*Failed: ${err.message || 'Generation failed.'}*`,
          });
        }
      })
    );

    if (!signal.aborted) setPhase('complete');
  }, [setSectionState]);

  const regenerateSection = useCallback(async (key) => {
    const def = SECTION_DEFS.find(d => d.key === key);
    if (!def || !topic) return;
    const controller = new AbortController();
    const { signal } = controller;
    setSectionState(key, { phase: 'streaming', content: '' });
    const userMsg = def.needsHarvest
      ? `Topic: ${topic}${dataBlockRef.current}`
      : `Topic: ${topic}`;
    try {
      await streamSection(
        PROMPTS[key], userMsg, signal,
        (text) => setSectionState(key, { phase: 'streaming', content: text }),
        def.maxTokens, def.model
      );
      if (!signal.aborted) setSectionState(key, prev => ({ ...prev, phase: 'complete' }));
    } catch (err) {
      if (signal.aborted) return;
      setSectionState(key, { phase: 'error', content: `*Failed: ${err.message}*` });
    }
  }, [topic, setSectionState]);

  return {
    phase, topic, error,
    sections, completedCount, activeCount,
    dataCount, harvestedPapers, harvestedTextbooks,
    parsedEntities, entityIndex,
    selectedEntity, openEntity, closeEntity,
    run, reset, regenerateSection,
  };
}
