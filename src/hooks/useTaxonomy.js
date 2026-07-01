import { useState, useCallback } from 'react';
import { TAXONOMY_SYSTEM_PROMPT } from '../constants/prompts';

function resolveApiKey() {
  return import.meta.env.VITE_ANTHROPIC_API_KEY || localStorage.getItem('canon_api_key') || '';
}

export function useTaxonomy() {
  const [taxonomy, setTaxonomy] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetch = useCallback(async (topic) => {
    const apiKey = resolveApiKey();
    if (!apiKey) return;

    setLoading(true);
    setTaxonomy(null);
    setError(null);

    try {
      const response = await window.fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 400,
          system: TAXONOMY_SYSTEM_PROMPT,
          messages: [{ role: 'user', content: `Topic: ${topic}` }],
        }),
      });

      if (!response.ok) { setError('Failed to analyse topic'); return; }
      const data = await response.json();
      const text = data.content?.[0]?.text || '';
      const jsonMatch = text.match(/\{[\s\S]+\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.subfields?.length) setTaxonomy(parsed);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const clear = useCallback(() => {
    setTaxonomy(null);
    setLoading(false);
    setError(null);
  }, []);

  return { taxonomy, loading, error, fetch, clear };
}
