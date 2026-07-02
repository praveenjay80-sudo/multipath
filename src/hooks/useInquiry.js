import { useState, useCallback, useRef, useMemo } from 'react';
import { seminalPapersHarvest } from '../utils/syllabusHarvest';
import { parseInquiry } from '../utils/parseInquiry';

function resolveApiKey() {
  return import.meta.env.VITE_ANTHROPIC_API_KEY || localStorage.getItem('canon_api_key') || '';
}

const SYSTEM_PROMPT = `You are an expert in research frontiers. Given a topic, identify the most important open questions — questions where the answer would genuinely advance understanding and where serious researchers are currently blocked. Include as many as the field genuinely has.

CRITICAL: Output ONLY the structured text below. No markdown. No bold. No preamble. Start your response with "TOPIC:" and nothing before it.

TOPIC: [topic as given]
OVERVIEW: [why this area is intellectually alive right now and what makes progress genuinely hard]

QUESTION 1: [precise, technical formulation — specific enough that a researcher could work on it]
PLAIN: [one sentence explaining this without jargon — what a curious non-expert would understand]
MATTERS: [what concretely changes if this gets answered — what becomes possible, what fails to make sense]
HARD: [the specific structural reason progress is blocked — name the type: empirical gap, conceptual confusion, mathematical barrier, or philosophical impasse — and say exactly what makes it that type]
TRIED: [name specific approaches or research programs that have been attempted and why they fell short]
ACTION: [what the most active researchers are currently doing and from what angle]
ENTRY: [one paper or book that best shows the depth of this problem; prefer works from the provided data; format: Author (Year), Title]

QUESTION 2: [...]
...

OPEN TERRITORY: [what unlocks if even half of these questions get answered — what it means for this field and adjacent areas]

Rules:
- Questions must be genuinely open — not answerable by looking them up
- Each question must be distinct with no overlap in what it is asking
- PLAIN must be accessible to an intelligent non-expert
- HARD must name the specific type of difficulty and what specifically creates the block
- TRIED must name specific approaches or programs, not vague generalities
- ENTRY must prefer works from the provided data; if none is relevant, use your knowledge`;

export function useInquiry() {
  const [phase, setPhase] = useState('idle');
  const [content, setContent] = useState('');
  const [paperCount, setPaperCount] = useState(0);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  const generate = useCallback(async (topic) => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    const { signal } = abortRef.current;

    setContent('');
    setPaperCount(0);
    setError(null);
    setPhase('harvesting');

    const apiKey = resolveApiKey();
    if (!apiKey) {
      setError('No API key set.');
      setPhase('error');
      return;
    }

    let papers = [];
    try {
      papers = await seminalPapersHarvest(topic);
      if (signal.aborted) return;
      setPaperCount(papers.length);
    } catch { papers = []; }

    if (signal.aborted) return;
    setPhase('generating');

    const paperData = papers.length > 0
      ? papers.slice(0, 40).map(p =>
          `- "${p.title}"${p.authors ? ` by ${p.authors}` : ''}${p.year ? ` (${p.year})` : ''} -- ${p.influentialCitationCount?.toLocaleString() || 0} influential citations`
        ).join('\n')
      : '(No paper data)';

    const userMessage = `Generate open questions for: ${topic}

=== INFLUENTIAL PAPERS (Semantic Scholar) ===
${paperData}

Use papers from this list for ENTRY fields where relevant. The papers show the current research landscape — use them to ground your questions in real research activity.`;

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-5',
          max_tokens: 7000,
          stream: true,
          system: SYSTEM_PROMPT,
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
                setContent(result);
              }
            } catch {}
          }
        }
      } finally { reader.releaseLock(); }

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
    setPaperCount(0);
    setError(null);
  }, []);

  const parsed = useMemo(() => parseInquiry(content), [content]);

  return { phase, content, paperCount, error, parsed, generate, reset };
}
