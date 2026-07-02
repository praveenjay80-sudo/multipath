import { useState, useRef, useCallback, useEffect } from 'react';
import {
  DATA_FIRST_COMPOSE_PROMPT,
  SUBFIELD_COMPOSE_PROMPT,
  REFINE_SYSTEM_PROMPT,
  HARVEST_MESSAGES,
  SCORE_MESSAGES,
  DATA_COMPOSE_MESSAGES,
  REFINE_MESSAGES,
} from '../constants/prompts';
import { harvestAll } from '../utils/harvestData';
import { rankWorks, formatForCompose } from '../utils/scoreWorks';

function resolveApiKey() {
  return import.meta.env.VITE_ANTHROPIC_API_KEY || localStorage.getItem('canon_api_key') || '';
}

async function* streamCompletion(systemPrompt, userMessage, signal, maxTokens = 10000) {
  const apiKey = resolveApiKey();
  if (!apiKey) throw new Error('No API key set. Enter your Anthropic API key in the settings panel.');

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
      max_tokens: maxTokens,
      stream: true,
      system: systemPrompt,
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
  let buffer = '';
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
          if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') yield event.delta.text;
        } catch {}
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export function useCanonGenerator() {
  const [phase, setPhase] = useState('idle');
  const [content, setContent] = useState('');
  const [topic, setTopic] = useState('');
  const [error, setError] = useState(null);
  const [harvestedWorks, setHarvestedWorks] = useState([]);
  const [harvestCounts, setHarvestCounts] = useState(null);
  const [refinements, setRefinements] = useState([]);
  const [loadingMessage, setLoadingMessage] = useState('');
  const abortRef = useRef(null);
  const msgIntervalRef = useRef(null);

  function cycleMessages(messages) {
    if (msgIntervalRef.current) clearInterval(msgIntervalRef.current);
    let i = 0;
    setLoadingMessage(messages[0]);
    msgIntervalRef.current = setInterval(() => {
      i = (i + 1) % messages.length;
      setLoadingMessage(messages[i]);
    }, 2500);
  }

  function stopMessages() {
    if (msgIntervalRef.current) { clearInterval(msgIntervalRef.current); msgIntervalRef.current = null; }
    setLoadingMessage('');
  }

  const generateCanon = useCallback(async (inputTopic, mode = 'full') => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    const { signal } = abortRef.current;

    setTopic(inputTopic);
    setContent('');
    setError(null);
    setHarvestedWorks([]);
    setHarvestCounts(null);
    setRefinements([]);

    try {
      // ── Pass 1: Harvest from OpenAlex + Semantic Scholar + Open Library ──
      setPhase('harvesting');
      cycleMessages(HARVEST_MESSAGES);

      const { merged, counts } = await harvestAll(inputTopic, (msg) => setLoadingMessage(msg));
      if (signal.aborted) return null;
      setHarvestCounts(counts);

      // ── Pass 2: Score and rank ────────────────────────────────────────────
      setPhase('scoring');
      cycleMessages(SCORE_MESSAGES);

      const ranked = rankWorks(merged);
      setHarvestedWorks(ranked);
      if (signal.aborted) return null;

      // Limit to top 60 works for the compose prompt to keep tokens manageable
      const top = ranked.slice(0, 60);

      // ── Pass 3: LLM organises verified works into canon ───────────────────
      setPhase('composing');
      cycleMessages(DATA_COMPOSE_MESSAGES);

      const totalRaw = Object.values(counts).reduce((a, b) => a + b, 0);
      const harvestSummary =
        `Sources: ${Object.entries(counts).map(([k, v]) => `${k} (${v})`).join(' · ')}\n` +
        `Total raw results: ${totalRaw} → ${merged.length} unique after deduplication\n` +
        `Showing top ${top.length} ranked by composite bibliometric score.\n\n`;

      const isSubfield = mode === 'subfield';
      const systemPrompt = isSubfield ? SUBFIELD_COMPOSE_PROMPT : DATA_FIRST_COMPOSE_PROMPT;
      const composeMessage = isSubfield
        ? `Subfield: ${inputTopic}\n\n${harvestSummary}Ranked verified works:\n${formatForCompose(top)}\n\nCompose the focused subfield canon. Add missing standard textbooks as [STANDARD TEXTBOOK — not in citation databases].`
        : `Topic: ${inputTopic}\n\n${harvestSummary}Ranked verified works:\n${formatForCompose(top)}\n\nCompose the authoritative canon selecting from these verified works. You may add up to 5 historical works you know to be foundational but which predate digital citation indexing (mark them [HISTORICAL]).`;

      let result = '';
      for await (const token of streamCompletion(systemPrompt, composeMessage, signal, 10000)) {
        result += token;
        setContent(result);
      }
      if (signal.aborted) return null;

      stopMessages();
      setPhase('complete');
      return result;
    } catch (err) {
      stopMessages();
      if (err.name === 'AbortError') { setPhase('idle'); return null; }
      setError(err.message || 'Generation failed. Please try again.');
      setPhase('error');
      return null;
    }
  }, []);

  const refineCanon = useCallback(async (request) => {
    if (!content) return;
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    const { signal } = abortRef.current;
    setPhase('refining');
    cycleMessages(REFINE_MESSAGES);
    try {
      const userMessage = `Current canon:\n${content}\n\nRefinement request: ${request}`;
      let result = '';
      for await (const token of streamCompletion(REFINE_SYSTEM_PROMPT, userMessage, signal, 10000)) {
        result += token;
        setContent(result);
      }
      if (signal.aborted) return;
      stopMessages();
      setRefinements(prev => [...prev, request]);
      setPhase('complete');
    } catch (err) {
      stopMessages();
      if (err.name !== 'AbortError') { setError(err.message || 'Refinement failed.'); setPhase('error'); }
      else setPhase('complete');
    }
  }, [content]);

  // Kept for backward compat — harvested works double as "candidates" for display
  const getCandidateCitation = useCallback((title) => {
    const key = title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 60);
    const work = harvestedWorks.find(w =>
      w.title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 60) === key
    );
    if (!work) return null;
    return { citationCount: work.citationCount || null, scholarLink: null };
  }, [harvestedWorks]);

  const loadContent = useCallback((loadedTopic, loadedContent) => {
    abortRef.current?.abort();
    stopMessages();
    setTopic(loadedTopic);
    setContent(loadedContent);
    setPhase('complete');
    setError(null);
    setHarvestedWorks([]);
    setHarvestCounts(null);
    setRefinements([]);
  }, []);

  const cancel = useCallback(() => { abortRef.current?.abort(); stopMessages(); setPhase('idle'); }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    stopMessages();
    setPhase('idle');
    setContent('');
    setError(null);
    setTopic('');
    setHarvestedWorks([]);
    setHarvestCounts(null);
    setRefinements([]);
  }, []);

  useEffect(() => {
    return () => { if (msgIntervalRef.current) clearInterval(msgIntervalRef.current); };
  }, []);

  return {
    phase, content, topic, error,
    harvestedWorks, harvestCounts,
    // Legacy names kept so App.jsx/CandidatePreview don't need changes
    candidates: harvestedWorks,
    candidateCitations: Object.fromEntries(
      harvestedWorks.map(w => [
        w.title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 60),
        { citationCount: w.citationCount || null }
      ])
    ),
    enrichProgress: { current: harvestedWorks.length, total: harvestedWorks.length },
    refinements, loadingMessage,
    getCandidateCitation, generateCanon, refineCanon, loadContent, cancel, reset,
  };
}
