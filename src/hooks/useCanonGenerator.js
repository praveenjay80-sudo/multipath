import { useState, useRef, useCallback, useEffect } from 'react';
import {
  CANDIDATE_SYSTEM_PROMPT,
  COMPOSE_SYSTEM_PROMPT,
  REFINE_SYSTEM_PROMPT,
  CANDIDATE_MESSAGES,
  ENRICH_MESSAGES,
  COMPOSE_MESSAGES,
  REFINE_MESSAGES,
} from '../constants/prompts';

const WORKER_URL = import.meta.env.VITE_WORKER_URL || '';

function resolveApiKey() {
  return import.meta.env.VITE_ANTHROPIC_API_KEY || localStorage.getItem('canon_api_key') || '';
}

async function* streamCompletion(systemPrompt, userMessage, signal, maxTokens = 8000) {
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
      model: 'claude-sonnet-4-6',
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

function parseCandidates(text) {
  return text.split('\n')
    .map(l => l.trim())
    .filter(l => l.startsWith('CANDIDATE:'))
    .map(l => {
      const parts = l.slice('CANDIDATE:'.length).trim().split('|').map(p => p.trim());
      if (parts.length < 2 || !parts[0]) return null;
      return {
        title: parts[0],
        author: parts[1] || '',
        year: parts[2] || '',
        type: (parts[3] || '').toLowerCase().includes('paper') ? 'paper' : 'book',
        reason: parts[4] || '',
      };
    })
    .filter(Boolean);
}

function citKey(title) {
  return title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 60);
}

async function scholarLookup(title, author) {
  if (!WORKER_URL) return null;
  try {
    const params = new URLSearchParams({ title, ...(author ? { author } : {}) });
    const res = await fetch(`${WORKER_URL}/enrich?${params}`);
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

function titleWords(t) {
  return t.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 3);
}
function titlesMatch(a, b) {
  const wa = titleWords(a), wb = titleWords(b);
  if (!wa.length || !wb.length) return false;
  const shared = wa.filter(w => wb.includes(w)).length;
  return shared >= Math.max(1, Math.floor(Math.min(wa.length, wb.length) * 0.5));
}

async function crossrefFallback(title, author) {
  const q = [title, author].filter(Boolean).join(' ');
  try {
    const res = await fetch(`https://api.crossref.org/works?query=${encodeURIComponent(q)}&rows=3&mailto=canon-app@example.com`);
    if (!res.ok) return null;
    const { message } = await res.json();
    const match = (message?.items || []).find(item => titlesMatch((item.title || [])[0] || '', title));
    if (!match) return null;
    return { citationCount: match['is-referenced-by-count'] ?? null };
  } catch { return null; }
}

export function useCanonGenerator() {
  const [phase, setPhase] = useState('idle');
  const [content, setContent] = useState('');
  const [topic, setTopic] = useState('');
  const [error, setError] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [candidateCitations, setCandidateCitations] = useState({});
  const [enrichProgress, setEnrichProgress] = useState({ current: 0, total: 0 });
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

  const generateCanon = useCallback(async (inputTopic) => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    const { signal } = abortRef.current;

    setTopic(inputTopic);
    setContent('');
    setError(null);
    setCandidates([]);
    setCandidateCitations({});
    setEnrichProgress({ current: 0, total: 0 });
    setRefinements([]);

    try {
      // Pass 1: Generate candidate list
      setPhase('candidates');
      cycleMessages(CANDIDATE_MESSAGES);
      let candidateText = '';
      for await (const token of streamCompletion(CANDIDATE_SYSTEM_PROMPT, inputTopic, signal, 2000)) {
        candidateText += token;
      }
      if (signal.aborted) return null;

      const parsedCandidates = parseCandidates(candidateText);
      setCandidates(parsedCandidates);

      // Pass 2: Enrich all candidates in parallel
      setPhase('enriching');
      cycleMessages(ENRICH_MESSAGES);
      setEnrichProgress({ current: 0, total: parsedCandidates.length });

      const citMap = {};
      await Promise.all(parsedCandidates.map(async (c) => {
        if (signal.aborted) return;
        const gs = await scholarLookup(c.title, c.author);
        const data = gs?.citationCount != null ? gs : await crossrefFallback(c.title, c.author);
        if (data?.citationCount != null) {
          const key = citKey(c.title);
          citMap[key] = { citationCount: data.citationCount, scholarLink: gs?.link || null };
          setCandidateCitations(prev => ({ ...prev, [key]: citMap[key] }));
        }
        setEnrichProgress(prev => ({ ...prev, current: prev.current + 1 }));
      }));
      if (signal.aborted) return null;

      // Pass 3: Compose with citation context
      setPhase('composing');
      cycleMessages(COMPOSE_MESSAGES);

      const candidateContext = parsedCandidates.map((c, i) => {
        const cit = citMap[citKey(c.title)];
        const citStr = cit?.citationCount != null
          ? `${cit.citationCount.toLocaleString()} citations`
          : 'not found in Scholar index';
        return `${i + 1}. ${c.title} -- ${c.author} (${c.year}) | ${c.type} | ${citStr}\n   ${c.reason}`;
      }).join('\n');

      const composeMessage = `Topic: ${inputTopic}\n\nCandidate works with Google Scholar citation data:\n${candidateContext}\n\nCompose the authoritative canon selecting from these candidates.`;

      let result = '';
      for await (const token of streamCompletion(COMPOSE_SYSTEM_PROMPT, composeMessage, signal, 10000)) {
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

  const getCandidateCitation = useCallback((title) => {
    return candidateCitations[citKey(title)] || null;
  }, [candidateCitations]);

  const loadContent = useCallback((loadedTopic, loadedContent) => {
    abortRef.current?.abort();
    stopMessages();
    setTopic(loadedTopic);
    setContent(loadedContent);
    setPhase('complete');
    setError(null);
    setCandidates([]);
    setCandidateCitations({});
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
    setCandidates([]);
    setCandidateCitations({});
    setEnrichProgress({ current: 0, total: 0 });
    setRefinements([]);
  }, []);

  useEffect(() => {
    return () => { if (msgIntervalRef.current) clearInterval(msgIntervalRef.current); };
  }, []);

  return { phase, content, topic, error, candidates, candidateCitations, enrichProgress, refinements, loadingMessage, getCandidateCitation, generateCanon, refineCanon, loadContent, cancel, reset };
}
