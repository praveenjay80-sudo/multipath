import { useState, useCallback, useRef } from 'react';
import { TAXONOMY_SYSTEM_PROMPT } from '../constants/prompts';

const MODEL = 'claude-haiku-4-5-20251001';

async function fetchSubfields(fieldName, apiKey) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 400,
      system: TAXONOMY_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: fieldName }],
    }),
  });
  if (!res.ok) return [];
  const data = await res.json();
  const text = data.content?.[0]?.text || '';
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[0]);
    return Array.isArray(parsed.subfields) ? parsed.subfields : [];
  } catch { return []; }
}

export function useFieldNavigation() {
  // children: { [field]: string[] }
  const [children, setChildren] = useState({});
  // expanded: Set of expanded item names
  const [expanded, setExpanded] = useState(new Set());
  const [loadingField, setLoadingField] = useState(null);
  const apiKeyRef = useRef(null);

  // Read api key from localStorage (same key used elsewhere in app)
  function getApiKey() {
    return localStorage.getItem('anthropic_api_key') || '';
  }

  const clickTopLevel = useCallback(async (field) => {
    // Toggle expand; fetch subfields if not yet loaded
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(field)) {
        next.delete(field);
      } else {
        next.add(field);
      }
      return next;
    });

    if (!children[field]) {
      const apiKey = getApiKey();
      if (!apiKey) return;
      setLoadingField(field);
      const subs = await fetchSubfields(field, apiKey);
      setChildren(prev => ({ ...prev, [field]: subs }));
      setLoadingField(null);
    }
  }, [children]);

  const clickSubfield = useCallback(async (parent, subfield) => {
    const key = `${parent}::${subfield}`;
    // Toggle expand; fetch sub-subfields if not yet loaded
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });

    if (!children[key]) {
      const apiKey = getApiKey();
      if (!apiKey) return;
      setLoadingField(key);
      const subs = await fetchSubfields(subfield, apiKey);
      setChildren(prev => ({ ...prev, [key]: subs }));
      setLoadingField(null);
    }
  }, [children]);

  const isExpanded = useCallback((key) => expanded.has(key), [expanded]);
  const getChildren = useCallback((key) => children[key] || null, [children]);
  const isLoading = useCallback((key) => loadingField === key, [loadingField]);

  const clear = useCallback(() => {
    setChildren({});
    setExpanded(new Set());
    setLoadingField(null);
  }, []);

  return { clickTopLevel, clickSubfield, isExpanded, getChildren, isLoading, clear };
}
