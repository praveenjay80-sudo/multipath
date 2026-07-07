import { useState, useCallback, useRef, useMemo } from 'react';
import { syllabusHarvest, seminalPapersHarvest } from '../utils/syllabusHarvest';
import { parseSpectrumQuestions } from '../utils/parseSpectrumQuestions';
import { parseSpectrumConcepts, extractReadingListSection, extractAnswerParagraphs } from '../utils/parseSpectrumConcepts';

function resolveApiKey() {
  return import.meta.env.VITE_ANTHROPIC_API_KEY || localStorage.getItem('canon_api_key') || '';
}

function extractSearchTerm(question) {
  const stop = new Set([
    'what', 'why', 'how', 'when', 'where', 'who', 'which',
    'is', 'are', 'does', 'do', 'did', 'was', 'were', 'has', 'have', 'had',
    'can', 'could', 'will', 'would', 'should', 'might', 'must',
    'the', 'a', 'an', 'it', 'its', 'this', 'that', 'there',
  ]);
  const words = question
    .replace(/[?!.,;:]/g, '')
    .split(/\s+/)
    .filter(w => w && !stop.has(w.toLowerCase()));
  return words.slice(0, 4).join(' ') || question.replace(/[?]/g, '').trim();
}

const QUESTIONS_SYSTEM_PROMPT = `You are an expert at identifying real, everyday questions whose complete and rigorous answer requires synthesizing insight from multiple academic disciplines — not questions that merely touch several fields on the surface, but questions that are structurally impossible to answer fully from within a single discipline.

CRITICAL: Output ONLY the structured text below. No markdown. No bold. No preamble. Start your response with "QUESTION 1:" and nothing before it.

QUESTION 1: [a real, concrete, everyday question a person could plausibly actually wonder — not an invented cross-disciplinary prompt]
DISCIPLINES: [comma-separated list of every discipline a complete answer genuinely requires, each followed by its level in parentheses — one of: Foundational, Core Abstract Structures, Fundamental Methods, Specific Theories & Applied; e.g. "Neuroscience (Fundamental Methods), Developmental Psychology (Fundamental Methods), Physiology (Specific Theories & Applied)"]
SPANS: [one sentence: specifically why no single discipline could fully answer this]

QUESTION 2: [...]
...

Rules:
- Generate exactly 6 questions
- Every question must be something a person could plausibly wonder in daily life — reject anything that reads like a textbook prompt engineered to sound cross-disciplinary
- Reject questions answerable from a single discipline, even if they sound broad or important
- DISCIPLINES must list 3 or more genuinely necessary fields — do not pad with tangentially related ones
- Tier labels must be exactly one of: Foundational, Core Abstract Structures, Fundamental Methods, Specific Theories & Applied`;

const ANSWER_SYSTEM_PROMPT = `You are an expert at building rigorous but plain-language transdisciplinary answers to real-life questions.

Given a real-life question that requires synthesizing multiple academic disciplines, and literature harvested for it, produce every load-bearing concept needed for a complete answer explained in plain language with nothing relevant omitted, a staged reading list of real works covering every perspective and angle relevant to the question, and a detailed synthesized answer that explicitly connects the concepts and works into one coherent answer.

CRITICAL: Output ONLY the structured text below. No markdown. No bold. No preamble. Start your response with "QUESTION:" and nothing before it.

QUESTION: [restate the question precisely]

CONCEPT: [name]
DISCIPLINE: [field]
TIER: [Foundational | Core Abstract Structures | Fundamental Methods | Specific Theories & Applied]
EXPLANATION: [plain-language explanation any curious adult could follow, with no unglossed jargon — as long as needed to be complete]
RELEVANCE: [exactly how this concept contributes to answering the specific question — not a generic description]

[repeat CONCEPT block for every load-bearing concept — do not cap the number, do not skip a discipline that appears in the reading list or answer below]

READING LIST:
PHASE 1: [name] (Weeks [range])
[one sentence: this phase's focus, and how it bridges from the previous phase]
- Title by Author (Year) — rationale connecting this work to the question
- [repeat — include every work genuinely needed to cover every perspective and angle this phase's disciplines bring to the question; do not cap the count, but do not pad with redundant or non-canonical works]

PHASE 2: [...]
...

ANSWER:
[a detailed, multi-paragraph synthesized answer — 4 to 6 paragraphs, separated by blank lines — that explicitly names and connects the concepts above and cites specific works from the reading list by title as it builds the case; this must read as a complete, standalone answer to the question, not a summary of the sections above]

Rules:
- Include every concept genuinely load-bearing for a complete answer to the question — comprehensiveness is required, plain language is required, and neither may be sacrificed for the other
- EXPLANATION must assume no prior training in the field, but must not omit anything a complete answer needs
- RELEVANCE must tie directly back to the specific question asked, not restate the concept
- Reading list works must be real; prefer works from the harvested data provided; supplement from your own knowledge only where the data has a genuine gap for a needed discipline
- Reading list must cover every perspective and angle each discipline brings to the question — do not let one discipline dominate at the expense of others, and do not cap the number of works per phase
- Phase 1 assumes zero prior knowledge in any of the disciplines involved
- Produce 4 to 6 phases total, each bridging naturally from the one before
- ANSWER must reference every concept from the CONCEPTS section and cite specific works from the READING LIST by title — it must be a genuine synthesis, not a recap
- ANSWER must give every identified discipline proportionate voice — no single field's view should dominate the synthesis`;

async function streamClaude({ apiKey, model, maxTokens, system, userMessage, signal, onChunk }) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      stream: true,
      system,
      messages: [{ role: 'user', content: userMessage }],
    }),
    signal,
  });

  if (!response.ok) {
    let msg = `API error ${response.status}`;
    try { const err = await response.json(); msg = err.error?.message || msg; } catch {}
    throw new Error(msg);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '', result = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (!data || data === '[DONE]') continue;
        try {
          const event = JSON.parse(data);
          if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
            result += event.delta.text;
            onChunk(result);
          }
        } catch {}
      }
    }
  } finally { reader.releaseLock(); }

  return result;
}

export function useSpectrum() {
  const [phase, setPhase] = useState('idle'); // idle | listing | listed | harvesting | generating | complete | error
  const [listContent, setListContent] = useState('');
  const [question, setQuestion] = useState('');
  const [content, setContent] = useState('');
  const [dataCount, setDataCount] = useState(0);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  const runAnswer = useCallback(async (q) => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    const { signal } = abortRef.current;

    setQuestion(q);
    setContent('');
    setDataCount(0);
    setError(null);
    setPhase('harvesting');

    const apiKey = resolveApiKey();
    if (!apiKey) {
      setError('No API key set.');
      setPhase('error');
      return;
    }

    const searchTerm = extractSearchTerm(q);

    let textbooks = [], papers = [];
    try {
      [textbooks, papers] = await Promise.all([
        syllabusHarvest(searchTerm),
        seminalPapersHarvest(searchTerm),
      ]);
      if (signal.aborted) return;
      setDataCount(textbooks.length + papers.length);
    } catch { textbooks = []; papers = []; }

    if (signal.aborted) return;
    setPhase('generating');

    const ospData = textbooks.length > 0
      ? textbooks.slice(0, 70).map(w =>
          `- ${w.title}${w.authors ? ` by ${w.authors}` : ''}${w.year ? ` (${w.year})` : ''}`
        ).join('\n')
      : '(No syllabus data)';

    const paperData = papers.length > 0
      ? papers.slice(0, 50).map(p =>
          `- "${p.title}"${p.authors ? ` by ${p.authors}` : ''}${p.year ? ` (${p.year})` : ''} -- ${p.influentialCitationCount?.toLocaleString() || 0} influential citations`
        ).join('\n')
      : '(No Semantic Scholar data)';

    const userMessage = `Build the transdisciplinary concept breakdown and staged reading list for this real-life question: ${q}

The data below was harvested using the search term "${searchTerm}". Use works from these lists for the reading list — these are real works, pick the ones most relevant to each phase.

=== TEXTBOOKS AND COURSE MATERIALS (Open Syllabus Project) ===
${ospData}

=== RESEARCH PAPERS (Semantic Scholar, by influential citations) ===
${paperData}

Identify every discipline and concept genuinely load-bearing for a complete answer, then sequence real works from the data above into a staged reading path.`;

    try {
      await streamClaude({
        apiKey,
        model: 'claude-sonnet-5',
        maxTokens: 24000,
        system: ANSWER_SYSTEM_PROMPT,
        userMessage,
        signal,
        onChunk: (result) => setContent(result),
      });
      if (!signal.aborted) setPhase('complete');
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err.message || 'Generation failed.');
        setPhase('error');
      } else {
        setPhase('idle');
      }
    }
  }, []);

  const generateQuestions = useCallback(async (topic) => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    const { signal } = abortRef.current;

    setListContent('');
    setQuestion('');
    setContent('');
    setDataCount(0);
    setError(null);
    setPhase('listing');

    const apiKey = resolveApiKey();
    if (!apiKey) {
      setError('No API key set.');
      setPhase('error');
      return;
    }

    try {
      await streamClaude({
        apiKey,
        model: 'claude-sonnet-5',
        maxTokens: 6000,
        system: QUESTIONS_SYSTEM_PROMPT,
        userMessage: `Generate real-life transdisciplinary questions for: ${topic}`,
        signal,
        onChunk: (result) => setListContent(result),
      });
      if (!signal.aborted) setPhase('listed');
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err.message || 'Generation failed.');
        setPhase('error');
      } else {
        setPhase('idle');
      }
    }
  }, []);

  const selectQuestion = useCallback((candidate) => {
    runAnswer(candidate.question);
  }, [runAnswer]);

  const submitDirectQuestion = useCallback((text) => {
    setListContent('');
    runAnswer(text);
  }, [runAnswer]);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setPhase('idle');
    setListContent('');
    setQuestion('');
    setContent('');
    setDataCount(0);
    setError(null);
  }, []);

  const listParsed = useMemo(() => parseSpectrumQuestions(listContent), [listContent]);
  const parsed = useMemo(() => parseSpectrumConcepts(content), [content]);
  const readingListText = useMemo(() => extractReadingListSection(content), [content]);
  const answerParagraphs = useMemo(() => extractAnswerParagraphs(content), [content]);

  return {
    phase, error, question,
    listContent, listParsed, generateQuestions,
    content, dataCount, parsed, readingListText, answerParagraphs,
    selectQuestion, submitDirectQuestion, reset,
  };
}
