import { useState, useCallback } from 'react';
import { ACADEMIC_TAXONOMY } from '../constants/academicTaxonomy';
import { TAXONOMY_SYSTEM_PROMPT } from '../constants/prompts';

const MODEL = 'claude-haiku-4-5-20251001';

function getApiKey() {
  return import.meta.env.VITE_ANTHROPIC_API_KEY || localStorage.getItem('canon_api_key') || '';
}

async function fetchSubSubfields(subfield) {
  const apiKey = getApiKey();
  if (!apiKey) return [];
  try {
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
        messages: [{ role: 'user', content: subfield }],
      }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const text = data.content?.[0]?.text || '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return [];
    const parsed = JSON.parse(match[0]);
    return Array.isArray(parsed.subfields) ? parsed.subfields : [];
  } catch { return []; }
}

export function useFieldNavigation() {
  // sub-subfields fetched via LLM: { [subfieldKey]: string[] }
  const [subSubfields, setSubSubfields] = useState({});
  // expanded top-level fields
  const [expandedFields, setExpandedFields] = useState(new Set());
  // expanded subfields (for sub-subfield reveal)
  const [expandedSubfields, setExpandedSubfields] = useState(new Set());
  const [loadingKey, setLoadingKey] = useState(null);

  const clickTopLevel = useCallback((field) => {
    setExpandedFields(prev => {
      const next = new Set(prev);
      if (next.has(field)) { next.delete(field); } else { next.add(field); }
      return next;
    });
  }, []);

  const clickSubfield = useCallback(async (parent, subfield) => {
    const key = `${parent}::${subfield}`;
    setExpandedSubfields(prev => {
      const next = new Set(prev);
      if (next.has(key)) { next.delete(key); } else { next.add(key); }
      return next;
    });

    if (!subSubfields[key]) {
      setLoadingKey(key);
      const subs = await fetchSubSubfields(subfield);
      setSubSubfields(prev => ({ ...prev, [key]: subs }));
      setLoadingKey(null);
    }
  }, [subSubfields]);

  const isFieldExpanded = useCallback((field) => expandedFields.has(field), [expandedFields]);
  const isSubfieldExpanded = useCallback((key) => expandedSubfields.has(key), [expandedSubfields]);

  // Subfields for a top-level field — instant from hardcoded taxonomy
  const getSubfields = useCallback((field) => ACADEMIC_TAXONOMY[field] || [], []);

  // Sub-subfields for a subfield — LLM fetched
  const getSubSubfields = useCallback((key) => subSubfields[key] || null, [subSubfields]);

  const isLoading = useCallback((key) => loadingKey === key, [loadingKey]);

  const clear = useCallback(() => {
    setSubSubfields({});
    setExpandedFields(new Set());
    setExpandedSubfields(new Set());
    setLoadingKey(null);
  }, []);

  return {
    clickTopLevel,
    clickSubfield,
    isFieldExpanded,
    isSubfieldExpanded,
    getSubfields,
    getSubSubfields,
    isLoading,
    clear,
  };
}
