import { useState, useCallback, useRef } from 'react';

function resolveApiKey() {
  return import.meta.env.VITE_ANTHROPIC_API_KEY || localStorage.getItem('canon_api_key') || '';
}

const SYSTEM_PROMPT = `You are a scholarly curriculum designer. Given a field or topic, generate a complete gap-free progressive reading path from absolute beginner to research frontier.

Output exactly this format — no preamble, no trailing summary:

PHASE 1: [Name] (Weeks [range])
[One sentence: what the reader can do after completing this phase]
- [Title] by [Author] ([Year]) — [why this is the right entry point; what foundation it lays]
- [Title] by [Author] ([Year]) — [what the previous work unlocked that makes this accessible]

PHASE 2: [Name] (Weeks [range])
[One sentence: the new capability unlocked]
- [Title] by [Author] ([Year]) — [how it builds on phase 1; what it adds]
...

Rules:
- 4–5 phases, 3–5 works per phase
- Phase 1: works a motivated beginner with zero background can open and understand
- Final phase: active research frontier — monographs, landmark papers, or recent syntheses
- Every work follows seamlessly from the one before — no unexplained jumps in difficulty
- Order within phases: concrete/applied before abstract/theoretical
- Rationale must name what the work gives the reader that enables the next work
- Canonical works only — no textbook filler or obscure titles`;

export function useReadingPath() {
  const [status,  setStatus]  = useState('idle');
  const [content, setContent] = useState('');
  const [topic,   setTopic]   = useState('');
  const abortRef = useRef(null);

  const generate = useCallback(async (topicName) => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    const { signal } = abortRef.current;

    setTopic(topicName);
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
          messages: [{ role: 'user', content: `Generate a progressive reading path for: ${topicName}` }],
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
    setTopic('');
  }, []);

  return { status, content, topic, generate, clear };
}
