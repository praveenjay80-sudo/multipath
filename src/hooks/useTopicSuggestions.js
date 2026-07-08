import { useState, useCallback } from 'react';

function resolveApiKey() {
  return import.meta.env.VITE_ANTHROPIC_API_KEY || localStorage.getItem('canon_api_key') || '';
}

async function fetchSuggestions(field, subfield) {
  const apiKey = resolveApiKey();
  if (!apiKey) throw new Error('Add an Anthropic API key in Settings to use this.');

  const system = `You generate precise, well-scoped research topic names within an academic field, for a researcher choosing what to explore next in a citation database. Topics must be specific enough to search meaningfully — narrower and more current than a broad subfield name — and phrased the way they would appear as an actual research topic or subject area, not a full sentence or question.`;

  const user = `Field: ${field}
Subfield: ${subfield}

List 15-20 specific research topics within this subfield. One per line, no numbering, no bullets, no explanation — just the topic name.`;

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
      max_tokens: 600,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });

  if (!res.ok) throw new Error(`API error ${res.status}`);
  const data = await res.json();
  const text = data.content[0]?.text || '';
  return [...new Set(
    text
      .split('\n')
      .map(line => line.replace(/^[\s\-*•\d.)]+/, '').trim())
      .filter(Boolean)
  )];
}

export function useTopicSuggestions() {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const suggest = useCallback(async (field, subfield) => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchSuggestions(field, subfield);
      setSuggestions(list);
    } catch (e) {
      setError(e.message || 'Failed to get suggestions.');
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setSuggestions([]);
    setError(null);
  }, []);

  return { suggestions, loading, error, suggest, reset };
}
