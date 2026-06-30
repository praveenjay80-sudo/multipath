import { useState, useCallback, useRef } from 'react';

function resolveApiKey() {
  return import.meta.env.VITE_ANTHROPIC_API_KEY || localStorage.getItem('canon_api_key') || '';
}

async function fetchExplanation(title, author, topic) {
  const apiKey = resolveApiKey();
  if (!apiKey) throw new Error('No API key set.');

  const system = `You are explaining canonical academic works to serious students. Be specific and practical. Name actual works, theorems, and concepts — never use vague academic praise.`;

  const user = `Explain "${title}"${author ? ` by ${author}` : ''} to someone studying ${topic || 'this field'}.

Respond in exactly this structure:

**What you will learn**
[2–3 sentences naming the specific knowledge, mental models, methods, or frameworks a careful reader gains from this work. Name actual concepts, equations, or techniques — not vague skills.]

**Prerequisite works**
[Bullet list of 3–5 specific books or papers a reader should have completed first, with one sentence each on why that prerequisite matters for reading this work. Name actual titles.]

**What this unlocks**
[1–2 sentences: which specific works in the canon or field become accessible or more meaningful after completing this one.]`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 700,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });

  if (!res.ok) throw new Error(`API error ${res.status}`);
  const data = await res.json();
  return data.content[0]?.text || '';
}

function entryKey(title) {
  return title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 50);
}

export function useWorkExplainer(topic) {
  const [explanations, setExplanations] = useState({});
  const loadingRef = useRef({});

  const explain = useCallback(async (title, author) => {
    const key = entryKey(title);
    if (explanations[key] || loadingRef.current[key]) return;

    loadingRef.current[key] = true;
    // Set loading state by storing a sentinel
    setExplanations(prev => ({ ...prev, [key]: 'loading' }));

    try {
      const text = await fetchExplanation(title, author, topic);
      setExplanations(prev => ({ ...prev, [key]: text }));
    } catch {
      setExplanations(prev => ({ ...prev, [key]: 'error' }));
    } finally {
      loadingRef.current[key] = false;
    }
  }, [topic, explanations]);

  function getExplanation(title) {
    return explanations[entryKey(title)] || null;
  }

  return { explain, getExplanation };
}
