import { useState, useCallback, useRef } from 'react';
import { syllabusHarvest, seminalPapersHarvest } from '../utils/syllabusHarvest';

const resolveApiKey = () =>
  import.meta.env.VITE_ANTHROPIC_API_KEY || localStorage.getItem('canon_api_key') || '';

const SONNET = 'claude-sonnet-5';
const HAIKU = 'claude-haiku-4-5-20251001';

// All prompts produce markdown-formatted output (###, **, -, prose) for StreamingText renderer.

const ORIENTATION_PROMPT = `Write 3 rich, flowing paragraphs orienting an intelligent reader to the given topic. No headers. No bullet points. Just prose.

Paragraph 1: What this topic actually is — not the title restated but what it studies, explains, or attempts to settle. Define the key terms immediately. State what is genuinely known versus genuinely contested.

Paragraph 2: The central tension — the deepest disagreement, the hardest unsolved problem, the question that splits intelligent people. Explain why the tension is genuine: what each side is right about, and why neither can fully explain what the other explains.

Paragraph 3: What is at stake. Why this matters beyond academics — what it illuminates about human experience, the natural world, or society. What would concretely change if we understood it better.

Write in clear, direct English. No jargon without immediate definition. Never use "in this essay", "I will argue", or self-referential phrases.`;

const DEVELOPMENT_PROMPT = `Map the intellectual history of the given topic in a flowing narrative organized into 4 eras. Use ### headers for each era.

### Founding Era ([approximate dates])
The problem the field was created to solve. Founding figures and their central contributions. What the foundational assumptions were and why they felt natural at the time. Then list 3-5 key works: **Title** by Author (Year) — one sentence on its role.

### Classical Era ([approximate dates])
How the field matured. The central debates that defined it. Which works became canonical and why. What the paradigm settled into. 3-5 key works in the same format.

### Modern Era ([approximate dates])
What challenged the classical consensus. New methods, frameworks, or findings that disrupted the field. The major controversies and how they played out. 3-5 key works.

### Current Era ([approximate dates to present])
Where the field stands now. What is agreed, what is contested. Tag 4-6 current works or programs: **DEFINING** / **RISING** / **FADING** / **WATCH** — with one sentence each on why.

### What the Drift Reveals
2-3 sentences: what the historical arc tells us about where the field is heading.

Use works from the provided data where relevant. Supplement from your knowledge for any era not well covered by the data. Write in clear, accessible English.`;

const LANDSCAPE_PROMPT = `Map every significant school of thought in the given field. Use ### headers for each school, then map the key exchanges.

For each school:

### [School Name]
**What they claim**: The core position in plain language — what they believe and why.
**Central figures**: Names and their specific contributions (one line each).
**Key works**: 3-5 essential works — **Title** by Author (Year).
**Why this view has force**: The strongest evidence or arguments supporting this position.
**What it cannot explain**: The specific phenomena or findings this school struggles most to account for.

After all schools:

### The Central Exchanges
For each major documented confrontation between schools: what exactly is at issue (state it as a specific proposition), the strongest argument on each side, and where it stands now.

### The Deepest Contested Claim
State the single most contested proposition in this field as a specific, debatable claim — not a topic label. Give the strongest case FOR and the strongest case AGAINST (3-4 sentences each).

Include ALL significant schools. Write in plain English. Define every technical term when it first appears.`;

const ASSUMPTIONS_PROMPT = `Audit what the given field takes for granted. Write in three sections.

### Founding Assumptions
What assumptions were built in at birth — what the field was designed to study and what it was designed to ignore. Include: **Roads Not Taken** — real alternatives that existed at the founding and were passed over, and why.

### Hidden Axioms
For each major assumption the field currently holds but does not question, use this structure:

**[State the assumption as a specific claim]**
Why practitioners don't notice it — what makes it feel like obvious fact rather than a choice. What the field systematically gets wrong because of it — give a concrete example. What a field that did NOT hold this assumption would study or find instead.

Identify at least 4-5 hidden axioms.

### Current Paradigm
Name the dominant research program. State its core commitments plainly. List 3-5 specific named anomalies it cannot explain. Rate its stability: **stable** / **stressed** / **crumbling** / **shifting** — with 2-3 sentences of evidence. Name the real challengers: specific researchers and their specific claims.

Write in plain English. Every technical term defined when it first appears.`;

const CONSILIENCE_PROMPT = `Identify every academic discipline that genuinely bears on the given topic. For each, write:

### [Discipline Name]
**Their angle**: The unique perspective this field brings — what it can see that others cannot.
**What they find**: What this field's research actually says — specific findings, mechanisms, and frameworks, not just "they study X."
**Key works**: 3-5 essential works from this discipline's perspective — **Title** by Author (Year). Prefer provided data; supplement from knowledge for disciplines not well represented.

After all disciplines:

### Where Disciplines Converge
Where multiple fields independently reach the same conclusion — name specific findings, not just "they agree."

### Where They Conflict
Where fields most importantly contradict each other — name exactly what disagrees, why, and what would have to be true to resolve it.

### The Synthesis
What becomes visible only when all perspectives are held together — the most complete answer available, which no single field can reach alone.

Include every discipline with genuinely distinct insight. Write in plain English throughout.`;

const CANON_PROMPT = `Produce the definitive reading list for the given topic. Organize by reading stage.

### Stage 1 — Orientation
For readers with no background. 3-5 works. For each: **Title** by Author (Year) — one sentence on what it gives the reader.

### Stage 2 — Foundation
The essential primary texts and landmark works. 6-10 works. For each: **Title** by Author (Year) — what it contributes and what background helps before reading it.

### Stage 3 — Core Scholarship
Works that defined the field's current state. 6-10 works. For each: **Title** by Author (Year) — what it argues and why it is essential.

### Stage 4 — Advanced and Frontier
For specialists and active researchers. 5-8 works at the research edge. For each: **Title** by Author (Year) — what frontier problem it addresses.

### Reading Order
A single numbered sequence of all works above. For each entry: **[N]. Title** — one sentence explaining what this work builds on and what it opens up for the reader.

Prefer works from the provided data. Never omit a canonical work just because it is absent from the data — supplement from knowledge for any stage.`;

const PREREQUISITES_PROMPT = `Map what someone needs to know before seriously engaging with the given topic. Organize as a 4-phase entry path.

### Phase 0 — Starting Point
Where a motivated beginner with broad education actually begins. What prior knowledge is genuinely required (almost always less than assumed). The single best first entry point with a one-sentence reason why.

### Phase 1 — Essential Background
The foundational knowledge from adjacent fields needed to engage meaningfully. For each: **[What it is]** — why it is needed and one specific resource to acquire it.

### Phase 2 — Conceptual Foundations
The key concepts and frameworks someone needs to have encountered before the core literature makes sense. For each: **[Concept]** — a plain one-sentence definition.

### Phase 3 — Entry into the Field
The 3-5 works that mark the transition from "prepared beginner" to "participant in the conversation." For each: **Title** by Author — what specifically it does for a reader at this stage.

Be practical and honest. Do not require more than is genuinely necessary to engage with the primary literature.`;

const INQUIRY_PROMPT = `Identify the most important open questions in the given topic — where the answer would genuinely advance understanding and where serious researchers are currently blocked.

### Overview
Why this area is intellectually alive right now. What makes progress genuinely hard in general.

For each open question, use this structure:

### Question [N]: [Precise formulation]
**Plain language**: What this is asking without jargon.
**Why it matters**: What concretely changes if this gets answered.
**Why it's hard**: The specific structural reason — empirical gap / conceptual confusion / mathematical barrier / philosophical impasse. Name the exact obstacle.
**What's been tried**: Specific approaches or research programs and why they fell short.
**Who's working on it**: What active researchers are doing and from what angle.
**Entry point**: One paper or book that best shows the depth of this problem (prefer provided data).

### What Unlocks
What becomes possible if even half these questions get answered — for this field and adjacent areas.

Include as many genuinely open questions as the field has. Questions must be genuinely unsolved, not answerable by looking them up.`;

const PATH_PROMPT = `Design the complete mastery path for the given topic in two sections.

### University Curriculum
A 5-8 course sequence from first-year undergraduate through research seminar. For each course:

**[Course title]** (Level: Year 1 / Year 2 / Year 3 / Year 4 / Graduate)
- Prerequisites: [prior courses or knowledge needed]
- Core texts: 3-5 books or papers
- Seminal papers: 2-3 landmark papers
- Outcome: what skills and understanding a student has upon completing this course.

### PhD Qualifying Reading List
The reading list for a doctoral qualifying exam. Five tiers:

**Tier 1 — Field Foundations**: Works every serious student must have read, regardless of subfield. For each: **Title** by Author (Year) — one sentence on what it is essential to know from it.

**Tier 2 — Core Theory**: The theoretical frameworks and their foundational texts. Same format.

**Tier 3 — Methods**: The methodological literature — how the field generates and evaluates evidence. Same format.

**Tier 4 — Contested Ground**: Active debates, recent challenges to consensus, emerging frameworks. For each: **Title** by Author (Year) — one sentence on what position it takes.

**Tier 5 — Adjacent Literatures**: Work from neighboring fields every serious scholar of this topic should know. Same format.

Use the provided data and supplement with canonical works from your knowledge.`;

export const SECTION_DEFS = [
  { key: 'orientation',  label: 'WHAT IS THIS',               color: 'stone',   prompt: ORIENTATION_PROMPT,   maxTokens: 1200, model: HAIKU  },
  { key: 'development', label: 'HOW IT DEVELOPED',            color: 'amber',   prompt: DEVELOPMENT_PROMPT,   maxTokens: 4000, model: SONNET },
  { key: 'landscape',   label: 'THE INTELLECTUAL LANDSCAPE',  color: 'teal',    prompt: LANDSCAPE_PROMPT,     maxTokens: 8000, model: SONNET },
  { key: 'assumptions', label: 'HIDDEN ASSUMPTIONS',          color: 'rose',    prompt: ASSUMPTIONS_PROMPT,   maxTokens: 5000, model: SONNET },
  { key: 'consilience', label: "EVERY DISCIPLINE'S ANSWER",   color: 'cyan',    prompt: CONSILIENCE_PROMPT,   maxTokens: 5000, model: SONNET },
  { key: 'canon',       label: 'THE ESSENTIAL WORKS',         color: 'blue',    prompt: CANON_PROMPT,         maxTokens: 4000, model: SONNET },
  { key: 'prereqs',     label: 'WHAT YOU NEED FIRST',         color: 'violet',  prompt: PREREQUISITES_PROMPT, maxTokens: 2000, model: HAIKU  },
  { key: 'inquiry',     label: 'THE OPEN FRONTIER',           color: 'indigo',  prompt: INQUIRY_PROMPT,       maxTokens: 5000, model: SONNET },
  { key: 'path',        label: 'THE PATH TO MASTERY',         color: 'emerald', prompt: PATH_PROMPT,          maxTokens: 4000, model: SONNET },
];

const INIT_SECTIONS = Object.fromEntries(SECTION_DEFS.map(s => [s.key, { phase: 'idle', content: '' }]));

async function streamSection(system, userMsg, signal, onChunk, maxTokens, model) {
  const key = resolveApiKey();
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({ model, max_tokens: maxTokens, stream: true, system, messages: [{ role: 'user', content: userMsg }] }),
    signal,
  });
  if (!res.ok) {
    let msg = `API error ${res.status}`;
    try { const e = await res.json(); msg = e.error?.message || msg; } catch {}
    throw new Error(msg);
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '', accumulated = '';
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
        } catch {}
      }
    }
  } finally { reader.releaseLock(); }
}

export function useOverallAggregator() {
  const [overallPhase, setOverallPhase] = useState('idle');
  const [question, setQuestion] = useState('');
  const [dataCount, setDataCount] = useState(0);
  const [error, setError] = useState(null);
  const [sections, setSections] = useState(() => ({ ...INIT_SECTIONS }));
  const abortRef = useRef(null);

  const setSectionState = useCallback((key, update) => {
    setSections(prev => ({
      ...prev,
      [key]: typeof update === 'function' ? update(prev[key]) : { ...prev[key], ...update },
    }));
  }, []);

  const run = useCallback(async (q) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const { signal } = controller;

    setQuestion(q);
    setError(null);
    setDataCount(0);
    setOverallPhase('harvesting');
    setSections({ ...INIT_SECTIONS });

    const apiKey = resolveApiKey();
    if (!apiKey) {
      setError('No API key set — add one in Settings.');
      setOverallPhase('error');
      return;
    }

    let textbooks = [], papers = [];
    try {
      [textbooks, papers] = await Promise.all([syllabusHarvest(q), seminalPapersHarvest(q)]);
      if (signal.aborted) return;
      setDataCount(textbooks.length + papers.length);
    } catch {}

    if (signal.aborted) return;
    setOverallPhase('generating');

    const ospData = textbooks.length > 0
      ? textbooks.slice(0, 60).map(w => `- ${w.title}${w.authors ? ` by ${w.authors}` : ''}${w.year ? ` (${w.year})` : ''}`).join('\n')
      : '(No syllabus data)';
    const paperData = papers.length > 0
      ? papers.slice(0, 40).map(p => `- "${p.title}"${p.authors ? ` by ${p.authors}` : ''}${p.year ? ` (${p.year})` : ''} -- ${p.influentialCitationCount?.toLocaleString() || 0} influential citations`).join('\n')
      : '(No paper data)';
    const dataBlock = `\n\n=== TEXTBOOKS AND COURSE MATERIALS (Open Syllabus Project) ===\n${ospData}\n\n=== SEMINAL PAPERS (Semantic Scholar) ===\n${paperData}`;

    // Sections that don't need harvested data (quick, no-harvest sections)
    const noData = new Set(['orientation', 'prereqs']);

    await Promise.all(
      SECTION_DEFS.map(async ({ key, prompt, maxTokens, model }) => {
        setSectionState(key, { phase: 'generating', content: '' });
        const userMsg = `Topic: ${q}${noData.has(key) ? '' : dataBlock}`;
        try {
          await streamSection(prompt, userMsg, signal, (text) => {
            setSectionState(key, { phase: 'generating', content: text });
          }, maxTokens, model);
          if (!signal.aborted) setSectionState(key, prev => ({ ...prev, phase: 'complete' }));
        } catch (err) {
          if (signal.aborted) return;
          setSectionState(key, { phase: 'error', content: err.message || 'Generation failed.' });
        }
      })
    );

    if (!signal.aborted) setOverallPhase('complete');
  }, [setSectionState]);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setOverallPhase('idle');
    setQuestion('');
    setDataCount(0);
    setError(null);
    setSections({ ...INIT_SECTIONS });
  }, []);

  const completedCount = Object.values(sections).filter(s => s.phase === 'complete').length;
  const generatingCount = Object.values(sections).filter(s => s.phase === 'generating').length;

  return {
    overallPhase, question, dataCount, error,
    sections, completedCount, generatingCount,
    run, reset,
  };
}
