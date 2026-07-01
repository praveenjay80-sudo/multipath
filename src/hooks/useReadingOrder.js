import { useState, useCallback, useRef } from 'react';

function resolveApiKey() {
  return import.meta.env.VITE_ANTHROPIC_API_KEY || localStorage.getItem('canon_api_key') || '';
}

const SYSTEM_PROMPT = `You are a scholarly curriculum designer. Sequence the works from a reading canon into a progressive reading plan.

Output exactly this format — no preamble, no trailing summary:

PHASE 1: [Name] (Weeks [range])
[One sentence describing the pedagogical focus of this phase]
- [Title] by [Author] ([Year]) — [One sentence: why this work belongs at this stage]

PHASE 2: [Name] (Weeks [range])
[Focus sentence]
- ...

Rules:
- 4–5 phases with evocative names (e.g. Orientation, Core Theory, Technical Depth, Specialisation, Synthesis)
- 3–6 works per phase
- Week ranges must be cumulative and realistic: ~1–2 weeks per book, 2–4 days per paper
- Textbooks must be ordered strictly from introductory → undergraduate → graduate → advanced research level. Never place a graduate textbook before an introductory one.
- Papers and monographs slot in after the reader has the textbook foundation for that level
- First phase: most accessible, introductory-level works only; final phase: most advanced and specialised
- Every work in the canon must appear exactly once
- Rationale explains why the reader is ready for this work at this stage, referencing what they've already read`;

export function useReadingOrder() {
  const [status, setStatus] = useState('idle');
  const [content, setContent] = useState('');
  const abortRef = useRef(null);

  const generate = useCallback(async (canonContent) => {
    if (!canonContent) return;
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    const { signal } = abortRef.current;

    setStatus('loading');
    setContent('');

    const apiKey = resolveApiKey();
    if (!apiKey) { setStatus('error'); return; }

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
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 3000,
          stream: true,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: `Sequence this canon into a reading plan:\n\n${canonContent}` }],
        }),
        signal,
      });

      if (!response.ok) throw new Error(`API error ${response.status}`);

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

      if (!signal.aborted) setStatus('complete');
    } catch (err) {
      if (err.name !== 'AbortError') setStatus('error');
    }
  }, []);

  const clear = useCallback(() => {
    abortRef.current?.abort();
    setStatus('idle');
    setContent('');
  }, []);

  return { status, content, generate, clear };
}
