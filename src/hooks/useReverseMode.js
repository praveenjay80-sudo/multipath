import { useState, useCallback, useRef, useMemo } from 'react';
import { parsePrerequisites } from '../utils/parsePrerequisites';

function resolveApiKey() {
  return import.meta.env.VITE_ANTHROPIC_API_KEY || localStorage.getItem('canon_api_key') || '';
}

const SYSTEM_PROMPT = `You are an expert academic advisor who maps the complete prerequisite knowledge needed to read and deeply understand a specific paper or book.

The user will give you a title (and possibly author/year). Your job:
1. Identify the work precisely
2. Assess what background it genuinely assumes
3. Generate a complete, gap-free prerequisite path from absolute foundations to the work itself

Output EXACTLY this format — no preamble, no text outside this structure:

WORK: [Full title — Author(s) (Year)]
FIELD: [Academic field · Subfield]
DIFFICULTY: [Undergraduate / Graduate / Research Level] — [one sentence: what mathematical or conceptual background it truly assumes]

CONTEXT: [2–3 sentences: what problem this work solves, what it achieves, and why a reader would want to understand it deeply]

---

PHASE 0: [Name] (Weeks [range])
[One sentence: what these works give the reader that makes everything else possible]
- [Title] by [Author] ([Year]) — [why this is needed; what specific concept or tool it provides]
  → Focus: [exact chapters, sections, or pages to read]. [What to skip and why.]

PHASE 1: [Name] (Weeks [range])
[One sentence: what capability this phase builds]
- [Title] by [Author] ([Year]) — [what it unlocks for the next phase]
  → Focus: [exact chapters, sections, or pages]. [What to skip.]

PHASE 2: [Name] (Weeks [range])
...

PHASE 3: [Name] (Weeks [range])
...

---

TOTAL PATH: [X–Y months from zero background to reading the target work productively]

---

BEYOND: [2–3 sentences: what intellectual territory opens up after mastering this work — what problems it enables you to attack, what fields it connects to, what debates it positions you to enter]

STREAM 1: [Name — e.g. Theoretical Deepening / Mathematical Foundations / Empirical Extensions]
[One sentence: what this stream develops]
- [Title] by [Author] ([Year]) — [why this is the natural next step after the target work]
  → Focus: [specific chapters/sections]

STREAM 2: [Name]
[One sentence: what this stream develops]
- [Title] by [Author] ([Year]) — [how it extends or challenges the target work]
  → Focus: [specific chapters/sections]

STREAM 3: [Name — optional, only if genuinely distinct]
...

Rules for a precise, gap-free path:
- Start truly from scratch: if the target work requires calculus, Phase 0 includes calculus. If it requires measure theory, include real analysis first.
- 3–5 phases; 3–6 works per phase
- Every work must be real and verifiable (actual title, author, year)
- Week ranges are cumulative across the full path
- Phases progress strictly: no phase should assume knowledge from a later phase
- Within each phase, works are ordered so each one prepares for the next
- The rationale for each work must name the specific concept, technique, or vocabulary it provides that the target work uses — not just "useful background"
- FOCUS LINES ARE MANDATORY for every work: name exact chapter numbers and titles, or page ranges, or named sections. State what to skip and why. Be precise — "Ch. 3–5" is not enough; write "Ch. 3 (Metric Spaces), Ch. 4 (Continuous Functions), Ch. 5 (Differentiation) — skip Ch. 6 (integration, not needed here)". For papers, name the specific sections.
- For textbooks: distinguish which chapters are essential prerequisites vs which are background reading vs which can be skipped entirely
- The final phase (Direct Prerequisites) must include the papers or books the target work directly and explicitly builds on
- If the target work is itself introductory (undergraduate level), compress to 2–3 phases only
- Never list the target work itself
- BEYOND is mandatory: 2–3 streams, 2–4 works each, with focus lines. Streams must be genuinely distinct directions (not just "more of the same"). Each stream should represent a different intellectual trajectory the target work enables.`;

export function useReverseMode() {
  const [phase, setPhase] = useState('idle'); // idle | working | complete | error
  const [content, setContent] = useState('');
  const [target, setTarget] = useState('');
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  const generate = useCallback(async (targetWork) => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    const { signal } = abortRef.current;

    setTarget(targetWork);
    setContent('');
    setError(null);
    setPhase('working');

    const apiKey = resolveApiKey();
    if (!apiKey) {
      setError('No API key set. Enter your Anthropic API key above.');
      setPhase('error');
      return;
    }

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
          messages: [{ role: 'user', content: `Map the complete prerequisite path for: ${targetWork}` }],
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
      let buffer = '';
      let result = '';

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
      } finally {
        reader.releaseLock();
      }

      if (!signal.aborted) setPhase('complete');
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err.message || 'Generation failed. Please try again.');
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
    setTarget('');
    setError(null);
  }, []);

  const parsed = useMemo(() => parsePrerequisites(content), [content]);

  return { phase, content, target, error, parsed, generate, reset };
}
