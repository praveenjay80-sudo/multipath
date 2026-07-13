import { useState, useCallback, useRef } from 'react';
import { harvestAll } from '../utils/harvestData';
import { syllabusHarvest, seminalPapersHarvest } from '../utils/syllabusHarvest';

const resolveApiKey = () =>
  import.meta.env.VITE_ANTHROPIC_API_KEY || localStorage.getItem('canon_api_key') || '';

const SONNET = 'claude-sonnet-5';
const HAIKU = 'claude-haiku-4-5-20251001';

// ── Section Prompts ────────────────────────────────────────────────────────

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

const PREREQUISITES_PROMPT = `Design the complete entry path for someone who wants to seriously engage with the given topic. Organize as 4 phases using ### headers.

Phase 1: What to read first (gentle introductions, popular books)
Phase 2: Foundational preparation (prerequisite textbooks, essential background)
Phase 3: Core engagement (the central textbooks and papers everyone reads)
Phase 4: Research readiness (what to read to join the conversation)

For each work, include: Title by Author (Year) — one-sentence why it matters. Be practical and honest.`;

const CANON_PROMPT = `Produce the definitive reading list for the given topic. Organize into 6 learning stages using ### headers.

Stage 0: Popular / Gentle Introduction
Stage 1: Foundational Textbooks
Stage 2: Core Papers (seminal, must-read)
Stage 3: Advanced Monographs & Surveys
Stage 4: Contemporary Frontier
Stage 5: Specialized Deep Cuts

For each work, list: Title by Author (Year) — one-sentence annotation. Prefer landmark works.

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

// ── Section definitions ─────────────────────────────────────────────────────

export const SECTION_DEFS = [
  { key: 'questions',     label: 'Fundamental Questions',       model: SONNET, needsHarvest: false, icon: '?' },
  { key: 'concepts',      label: 'Complete Concept Map',        model: SONNET, needsHarvest: false, icon: '◇' },
  { key: 'schools',       label: 'Schools of Thought',          model: SONNET, needsHarvest: false, icon: '⊕' },
  { key: 'prerequisites', label: 'Prerequisite Path',           model: SONNET, needsHarvest: false, icon: '→' },
  { key: 'canon',         label: 'Canon by Learning Stage',     model: SONNET, needsHarvest: true,  icon: '📖' },
  { key: 'thinkers',      label: 'Thinkers & Researchers',      model: SONNET, needsHarvest: true,  icon: '👤' },
  { key: 'methodologies', label: 'Methodologies & Tools',       model: SONNET, needsHarvest: false, icon: '⚙' },
  { key: 'adjacent',      label: 'Adjacent Fields',             model: SONNET, needsHarvest: false, icon: '↔' },
  { key: 'consilience',   label: 'Consilience (All Disciplines)', model: SONNET, needsHarvest: false, icon: '◈' },
  { key: 'frontier',      label: 'Open Problems & Controversies', model: SONNET, needsHarvest: true, icon: '⧩' },
  { key: 'timeline',      label: 'Intellectual Timeline',       model: HAIKU,  needsHarvest: false, icon: '⊞' },
  { key: 'conferences',   label: 'Conferences & Journals',      model: HAIKU,  needsHarvest: false, icon: '◉' },
];

const INIT_SECTIONS = Object.fromEntries(
  SECTION_DEFS.map(s => [s.key, { phase: 'idle', content: '' }])
);

// ── Streaming helper ────────────────────────────────────────────────────────

async function streamSection(system, userMsg, signal, onChunk, maxTokens, model) {
  const apiKey = resolveApiKey();
  if (!apiKey) throw new Error('Anthropic API key is required');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: model || SONNET,
      max_tokens: maxTokens || 4096,
      stream: true,
      messages: [
        { role: 'user', content: userMsg },
      ],
      system: system,
    }),
    signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => 'Unknown error');
    throw new Error(`Claude API error ${res.status}: ${text}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data: ')) continue;
      const data = trimmed.slice(6).trim();
      if (!data || data === '[DONE]') continue;
      try {
        const parsed = JSON.parse(data);
        if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
          onChunk(parsed.delta.text);
        }
      } catch { /* skip malformed SSE */ }
    }
  }
}

// ── Hook ────────────────────────────────────────────────────────────────────

export function useUnifiedBrowser() {
  const [phase, setPhase] = useState('idle'); // idle | harvesting | streaming | complete | error
  const [topic, setTopic] = useState('');
  const [error, setError] = useState(null);
  const [sections, setSections] = useState(INIT_SECTIONS);
  const [dataCount, setDataCount] = useState(0);
  const [harvestedPapers, setHarvestedPapers] = useState([]);
  const [harvestedTextbooks, setHarvestedTextbooks] = useState([]);

  const harvestData = useRef(null);
  const abortRef = useRef(null);

  const completedCount = Object.values(sections)
    .filter(s => s.phase === 'complete').length;
  const activeCount = Object.values(sections)
    .filter(s => s.phase === 'streaming').length;

  const setSectionContent = useCallback((key, content) => {
    setSections(prev => ({
      ...prev,
      [key]: { ...prev[key], content: (prev[key].content || '') + content },
    }));
  }, []);

  const setSectionPhase = useCallback((key, phase) => {
    setSections(prev => ({
      ...prev,
      [key]: { ...prev[key], phase },
    }));
  }, []);

  const reset = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    setPhase('idle');
    setTopic('');
    setError(null);
    setSections(INIT_SECTIONS);
    setDataCount(0);
    setHarvestedPapers([]);
    setHarvestedTextbooks([]);
    harvestData.current = null;
  }, []);

  const run = useCallback(async (inputTopic) => {
    if (abortRef.current) abortRef.current.abort();
    const abort = new AbortController();
    abortRef.current = abort;

    reset();
    setTopic(inputTopic);
    setPhase('harvesting');

    const needsHarvestKeys = SECTION_DEFS.filter(s => s.needsHarvest).map(s => s.key);
    for (const key of needsHarvestKeys) setSectionPhase(key, 'waiting');

    // Harvest data for canon-dependent sections
    let papers = [];
    let textbooks = [];
    let ospWorks = [];
    let seminalWorks = [];

    try {
      const [hResult, ospResult, seminalResult] = await Promise.all([
        harvestAll(inputTopic, (msg) => {}),
        syllabusHarvest(inputTopic).catch(() => []),
        seminalPapersHarvest(inputTopic).catch(() => []),
      ]);

      papers = (hResult?.papers || []).slice(0, 60);
      textbooks = (hResult?.textbooks || []).slice(0, 40);
      ospWorks = ospResult.slice(0, 40);
      seminalWorks = seminalResult.slice(0, 40);

      setHarvestedPapers(papers);
      setHarvestedTextbooks(textbooks);
      setDataCount(papers.length + textbooks.length + ospWorks.length + seminalWorks.length);
    } catch (e) {
      // Can proceed without harvest data — Claude supplements from knowledge
    }

    setPhase('streaming');

    const dataContext = [
      ...papers.map(w => `- "${w.title}" by ${w.authors || 'Unknown'} (${w.year || '?'}) — ${w.citationCount || 0} citations`),
      ...textbooks.map(w => `- "${w.title}" by ${w.authors || 'Unknown'} (${w.year || '?'}) — Textbook`),
      ...ospWorks.map(w => `- "${w.title}" by ${w.authors || 'Unknown'} — Taught in ${w.syllabusCount || 0} courses`),
      ...seminalWorks.map(w => `- "${w.title}" by ${w.authors || 'Unknown'} (${w.year || '?'}) — ${w.influentialCitationCount || 0} influential citations`),
    ].join('\n');

    // Fire all sections in parallel
    const tasks = SECTION_DEFS.map(def => {
      const userMsg = def.needsHarvest && dataContext
        ? `Topic: ${inputTopic}\n\nHarvested data:\n${dataContext}\n\nYour task:\n${def.label}`
        : `Topic: ${inputTopic}\n\nYour task:\n${def.label}`;

      const systemPrompt = (() => {
        switch (def.key) {
          case 'questions':     return QUESTIONS_PROMPT;
          case 'concepts':      return CONCEPTS_PROMPT;
          case 'schools':       return SCHOOLS_PROMPT;
          case 'prerequisites': return PREREQUISITES_PROMPT;
          case 'canon':         return CANON_PROMPT;
          case 'thinkers':      return THINKERS_PROMPT;
          case 'methodologies': return METHODOLOGIES_PROMPT;
          case 'adjacent':      return ADJACENT_FIELDS_PROMPT;
          case 'consilience':   return CONSILIENCE_PROMPT;
          case 'frontier':      return FRONTIER_PROMPT;
          case 'timeline':      return TIMELINE_PROMPT;
          case 'conferences':   return CONFERENCES_PROMPT;
          default:              return '';
        }
      })();

      return async () => {
        if (abort.signal.aborted) return;
        setSectionPhase(def.key, 'streaming');
        try {
          const maxTokens = ['canon', 'consilience', 'frontier'].includes(def.key) ? 6144 : 4096;
          await streamSection(
            systemPrompt,
            userMsg,
            abort.signal,
            (chunk) => setSectionContent(def.key, chunk),
            maxTokens,
            def.model
          );
          if (!abort.signal.aborted) {
            setSectionPhase(def.key, 'complete');
          }
        } catch (e) {
          if (e.name === 'AbortError') return;
          setSectionPhase(def.key, 'error');
          setSectionContent(def.key, `\n\n*Failed: ${e.message}*`);
        }
      };
    });

    // Fire all sections in parallel
    await Promise.allSettled(tasks.map(t => t()));

    if (!abort.signal.aborted) {
      setPhase('complete');
    }
  }, [reset, setSectionContent, setSectionPhase]);

  return {
    phase, topic, error,
    sections, completedCount, activeCount,
    dataCount, harvestedPapers, harvestedTextbooks,
    run, reset,
  };
}
