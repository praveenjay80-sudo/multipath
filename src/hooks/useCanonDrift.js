import { useState, useCallback, useRef, useMemo } from 'react';
import { driftHarvest } from '../utils/driftHarvest';
import { parseCanonDrift } from '../utils/parseCanonDrift';

function resolveApiKey() {
  return import.meta.env.VITE_ANTHROPIC_API_KEY || localStorage.getItem('canon_api_key') || '';
}

const SYSTEM_PROMPT = `You are an intellectual historian of academic fields. You have citation data from OpenAlex (showing which works accumulated the most citations across history) and Open Syllabus data (showing what is being taught in universities TODAY). Your task: trace how this field's canon has shifted across four eras — what rose, what faded, and what the drift reveals about where the field is heading.

CRITICAL: Output ONLY the structured text below. No markdown. No bold. No preamble. Start your response with "FIELD:" and nothing before it.

FIELD: [field name]
DRIFT SUMMARY: [3-4 sentences: the overall intellectual arc of this field — the major paradigm shifts, what drove them, and the current trajectory]

---

ERA: Pre-1985 -- [name this era, e.g. "Classical Foundations"]
SHIFT: [2 sentences: what intellectual project dominated this era and what it established or failed to establish]
- Title by Author (Year) -- N citations -- DEFINING -- why it defined this era
- Title by Author (Year) -- N citations -- DEFINING -- its canonical role

ERA: 1985-1999 -- [name this era]
SHIFT: [2 sentences: what changed from the previous era and why]
- Title by Author (Year) -- N citations -- DEFINING -- why it defined this era
- Title by Author (Year) -- N citations -- RISING -- why it was ascending
- Title by Author (Year) -- N citations -- FADING -- why it was being eclipsed

ERA: 2000-2012 -- [name this era]
SHIFT: [2 sentences]
- Title by Author (Year) -- N citations -- DEFINING -- ...
- Title by Author (Year) -- N citations -- RISING -- ...
- Title by Author (Year) -- N citations -- FADING -- ...

ERA: 2013-Now -- [name this era]
SHIFT: [2 sentences: what defines the current moment]
- Title by Author (Year) -- N citations -- DEFINING -- ...
- Title by Author (Year) -- N citations -- RISING -- currently ascending, why
- Title by Author (Year) -- N citations -- WATCH -- emerging work that may define the next era

---

DRIFT REVEALS: [2-3 sentences: what this historical drift tells us about where the field is heading — what kind of work will likely dominate the next era]

Rules:
- Use ONLY works from the provided data
- 3-6 works per era; omit an era entirely if the data has no relevant works from that period
- Every work line must have exactly this structure: Title by Author (Year) -- N citations -- TRAJECTORY -- reason
- TRAJECTORY must be one of: DEFINING, RISING, FADING, WATCH
- SHIFT must explain the intellectual reason for the change, not just name it
- DRIFT REVEALS must be forward-looking and specific, not a summary of what was already said
- Do not repeat works across eras`;

export function useCanonDrift() {
  const [phase, setPhase] = useState('idle');
  const [topic, setTopic] = useState('');
  const [content, setContent] = useState('');
  const [totalWorks, setTotalWorks] = useState(0);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  const generate = useCallback(async (inputTopic) => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    const { signal } = abortRef.current;

    setTopic(inputTopic);
    setContent('');
    setTotalWorks(0);
    setError(null);
    setPhase('harvesting');

    const apiKey = resolveApiKey();
    if (!apiKey) {
      setError('No API key set.');
      setPhase('error');
      return;
    }

    let ospSection = '', historicalSection = '', count = 0;
    try {
      const result = await driftHarvest(inputTopic);
      if (signal.aborted) return;
      ospSection = result.ospSection;
      historicalSection = result.historicalSection;
      count = result.totalWorks;
      setTotalWorks(count);
    } catch { ospSection = ''; historicalSection = ''; }

    if (signal.aborted) return;
    setPhase('generating');

    const userMessage = `Trace the canon drift for: ${inputTopic}

=== CURRENT TEACHING (Open Syllabus -- works assigned in universities today) ===
${ospSection || '(No OSP data available)'}

=== HISTORICAL IMPACT BY ERA (OpenAlex -- top-cited works, grouped by publication decade) ===
${historicalSection || '(No historical data available)'}

Use only works from these lists. The OSP data shows what is currently canonical in teaching; the historical data shows which works defined each era by citation impact.`;

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
    setTopic('');
    setTotalWorks(0);
    setError(null);
  }, []);

  const parsed = useMemo(() => parseCanonDrift(content), [content]);

  return { phase, topic, content, totalWorks, error, parsed, generate, reset };
}
