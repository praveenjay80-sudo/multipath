import { useState, useCallback, useRef, useMemo } from 'react';
import { syllabusHarvest, seminalPapersHarvest } from '../utils/syllabusHarvest';
import { parseNoesis } from '../utils/parseNoesis';

function resolveApiKey() {
  return import.meta.env.VITE_ANTHROPIC_API_KEY || localStorage.getItem('canon_api_key') || '';
}

function extractSearchTerm(topic) {
  const stop = new Set([
    'what', 'why', 'how', 'when', 'where', 'who', 'which',
    'is', 'are', 'does', 'do', 'did', 'was', 'were', 'has', 'have', 'had',
    'can', 'could', 'will', 'would', 'should', 'might', 'must',
    'the', 'a', 'an', 'it', 'its', 'this', 'that', 'there',
  ]);
  const words = topic
    .replace(/[?!.,;:]/g, '')
    .split(/\s+/)
    .filter(w => w && !stop.has(w.toLowerCase()));
  return words.slice(0, 4).join(' ') || topic.replace(/[?]/g, '').trim();
}

const SYSTEM_PROMPT = `You are an expert at building a complete map of what it takes to fully understand a topic intellectually — not just its core concepts, but every dimension a genuine understanding requires.

Given a topic, produce a six-station understanding map plus two cross-cutting dimensions: the topic's level on a four-tier ladder, and the disciplinary angles a complete understanding must be approached from.

CRITICAL: Output ONLY the structured text below. No markdown. No bold. No preamble. Start your response with "TOPIC:" and nothing before it.

TOPIC: [restated]
TIER: [Foundational | Core Abstract Structures | Fundamental Methods | Specific Theories & Applied]
LEVEL WHY: [one sentence: why this topic sits at this tier]
ANGLES: [Discipline — why this angle matters; semicolon-separated; home discipline first, then as many neighboring/distant disciplines as genuinely change the answer, uncapped]

STATION 1: ORIENT
QUESTION: [the precise, specific question this topic resolves to]
PREREQUISITES: [what you must already know before starting]

STATION 2: GRASP
CONCEPTS: [Concept — plain-language one-line explanation; semicolon-separated; every load-bearing concept, uncapped]
INTUITION: [the analogy or mental model that makes it click before the formalism does]
NOTATION: [the precise terminology or notation needed to manipulate it]
METHOD: [how to actually derive, apply, or produce it yourself]

STATION 3: PROVE
WORKS: [Title by Author (Year) — rationale connecting it to this topic; semicolon-separated; prefer works from the harvested data provided; uncapped]
EXAMPLES: [one concrete worked example, described in enough detail to actually work through]
ALTERNATIVES: [a genuinely different formulation or lens on the same idea]

STATION 4: CONTEXTUALIZE
THINKERS: [Name — their specific angle or contribution; semicolon-separated; uncapped]
SCHOOLS: [School or tradition — what stance it takes; semicolon-separated]
HISTORY: [the problem or event that originally motivated this]
DEBATES: [where it's still contested, and by whom]

STATION 5: APPLY
CASES: [a real-world case where this gets used; semicolon-separated; uncapped]
BOUNDARIES: [where it stops being true or stops applying]
MISCONCEPTIONS: [a common misconception, and why it's wrong; semicolon-separated]

STATION 6: EXTEND
POSTREQUISITES: [what this unlocks once mastered]
OPEN: [what's still unsettled about this exact idea, not the whole field]
SYNTHESIS: [a multi-paragraph answer, separated by blank lines, connecting every station above into one coherent account of the topic]

Rules:
- Every semicolon-separated list is uncapped — include everything genuinely load-bearing, but do not pad with redundant or non-canonical entries
- WORKS must be real works; prefer the harvested data provided; supplement from your own knowledge only where the data has a genuine gap
- ANGLES must list every discipline that changes the answer, not just the topic's home field
- CONCEPTS explanations must be plain language, assuming no prior training in the field
- SYNTHESIS must be a genuine connective account naming concepts, works, and thinkers from the stations above — not a recap`;

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

export function useNoesis() {
  const [phase, setPhase] = useState('idle'); // idle | harvesting | generating | complete | error
  const [content, setContent] = useState('');
  const [dataCount, setDataCount] = useState(0);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  const generate = useCallback(async (topic) => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    const { signal } = abortRef.current;

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

    const searchTerm = extractSearchTerm(topic);

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

    const userMessage = `Build the six-station understanding map for: ${topic}

The data below was harvested using the search term "${searchTerm}". Use works from these lists for the WORKS station — these are real works, pick the ones most relevant.

=== TEXTBOOKS AND COURSE MATERIALS (Open Syllabus Project) ===
${ospData}

=== RESEARCH PAPERS (Semantic Scholar, by influential citations) ===
${paperData}

Build the complete map: level, angles, and all six stations.`;

    try {
      await streamClaude({
        apiKey,
        model: 'claude-sonnet-5',
        maxTokens: 28000,
        system: SYSTEM_PROMPT,
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

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setPhase('idle');
    setContent('');
    setDataCount(0);
    setError(null);
  }, []);

  const parsed = useMemo(() => parseNoesis(content), [content]);

  return { phase, error, content, dataCount, parsed, generate, reset };
}
