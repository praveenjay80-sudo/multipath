import { useState, useCallback, useRef, useMemo } from 'react';
import { syllabusHarvest, seminalPapersHarvest } from '../utils/syllabusHarvest';
import { parseDissertation } from '../utils/parseDissertation';

function resolveApiKey() {
  return import.meta.env.VITE_ANTHROPIC_API_KEY || localStorage.getItem('canon_api_key') || '';
}

const SYSTEM_PROMPT = `You are a senior academic advisor preparing a PhD student for their qualifying examination. The student has a specific research question. Your job: build the exact reading list they must master before their committee meeting — not a general introduction to the field, but the precise literature a serious candidate is expected to know cold.

CRITICAL: Output ONLY the structured text below. No markdown. No bold. No preamble. Start your response with "QUESTION:" and nothing before it.

QUESTION: [the research question as given]
FIELD: [primary academic field]
SUBFIELD: [specific subfield or domain]
COMMITTEE NOTE: [2-3 sentences: what a qualifying committee in this area actually tests — what distinguishes a prepared from an underprepared candidate, what they probe first]

---

TIER 1: Field Foundations
[2 sentences: why these works are non-negotiable regardless of the specific question]
- Title by Author (Year) -- why essential for any serious researcher here
  -> Must master: [specific arguments, theorems, or chapters the committee will probe]

TIER 2: Domain Literature
[2 sentences: the core scholarship of the specific domain the question sits within]
- Title by Author (Year) -- what it contributes to this domain
  -> Must master: [what to know deeply]

TIER 3: Your Question
[2 sentences: works that directly engage the research question itself]
- Title by Author (Year) -- how it addresses or illuminates the question
  -> Must master: [specific claims or findings examiners will expect]

TIER 4: Methods
[1-2 sentences: the methodological toolkit needed for this kind of research]
- Title by Author (Year) -- what method or approach it teaches
  -> Must master: [techniques or frameworks to be able to discuss]

TIER 5: The Contested Ground
[2 sentences: the live debates the student must be able to argue within, not just describe]
- Title by Author (Year) -- what position it takes and why it is contested
  -> Must master: [the specific controversy and what a sophisticated answer sounds like]

---

EXAM PREP: [2-3 sentences: what qualifying exam questions look like in this area — typical question formats and what a strong answer demonstrates]
TIMELINE: [Estimated months to read and master everything at 3-4 hours daily]
ADVISOR NOTE: [One sentence a good PhD advisor would say before this exam — the single most important thing]

Rules:
- Use ONLY works from the provided data lists
- 3-5 works per tier; omit a tier entirely if no appropriate works exist for it
- Works in Tier 3 must directly engage the specific research question, not just the general field
- MUST MASTER lines must be specific: cite chapters, theorems, arguments, or methodological steps — not vague "themes"
- ADVISOR NOTE must be concrete and memorable, not generic
- Do not repeat works across tiers`;

export function useDissertationMode() {
  const [phase, setPhase] = useState('idle');
  const [question, setQuestion] = useState('');
  const [content, setContent] = useState('');
  const [dataCount, setDataCount] = useState(0);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  const generate = useCallback(async (inputQuestion) => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    const { signal } = abortRef.current;

    setQuestion(inputQuestion);
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

    let textbooks = [], papers = [];
    try {
      [textbooks, papers] = await Promise.all([
        syllabusHarvest(inputQuestion),
        seminalPapersHarvest(inputQuestion),
      ]);
      if (signal.aborted) return;
      setDataCount(textbooks.length + papers.length);
    } catch { textbooks = []; papers = []; }

    if (signal.aborted) return;
    setPhase('generating');

    const ospData = textbooks.length > 0
      ? textbooks.slice(0, 60).map(w =>
          `- ${w.title}${w.authors ? ` by ${w.authors}` : ''}${w.year ? ` (${w.year})` : ''} -- ${w.syllabusCount} university courses`
        ).join('\n')
      : '(No OSP data)';

    const paperData = papers.length > 0
      ? papers.slice(0, 40).map(p =>
          `- "${p.title}"${p.authors ? ` by ${p.authors}` : ''}${p.year ? ` (${p.year})` : ''} -- ${p.influentialCitationCount.toLocaleString()} influential citations`
        ).join('\n')
      : '(No Semantic Scholar data)';

    const userMessage = `Build a qualifying exam reading list for this PhD research question: ${inputQuestion}

=== TEXTBOOKS (Open Syllabus Project) ===
${ospData}

=== RESEARCH PAPERS (Semantic Scholar, by influential citations) ===
${paperData}

Use only works from these lists. Assign textbooks to tiers where they serve as foundational or methodological grounding; assign papers to tiers where they directly engage the question or its debates.`;

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
          max_tokens: 6000,
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
    setQuestion('');
    setDataCount(0);
    setError(null);
  }, []);

  const parsed = useMemo(() => parseDissertation(content), [content]);

  return { phase, question, content, dataCount, error, parsed, generate, reset };
}
