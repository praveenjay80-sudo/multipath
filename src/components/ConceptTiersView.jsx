import { useState, useRef, useEffect } from 'react';
import { useReadingPath } from '../hooks/useReadingPath';
import ReadingOrderView from './ReadingOrderView';

const TIER_COLORS = [
  { bg: 'bg-violet-700', text: 'text-violet-700', active: 'bg-violet-700 text-white border-violet-700', hover: 'hover:bg-violet-700 hover:text-white hover:border-violet-700' },
  { bg: 'bg-sky-700',    text: 'text-sky-700',    active: 'bg-sky-700 text-white border-sky-700',       hover: 'hover:bg-sky-700 hover:text-white hover:border-sky-700'       },
  { bg: 'bg-teal-700',   text: 'text-teal-700',   active: 'bg-teal-700 text-white border-teal-700',     hover: 'hover:bg-teal-700 hover:text-white hover:border-teal-700'     },
  { bg: 'bg-amber-700',  text: 'text-amber-700',  active: 'bg-amber-700 text-white border-amber-700',   hover: 'hover:bg-amber-700 hover:text-white hover:border-amber-700'   },
];

function resolveApiKey() {
  return import.meta.env.VITE_ANTHROPIC_API_KEY || localStorage.getItem('canon_api_key') || '';
}

async function streamExplanation(concept, apiKey, signal, onChunk) {
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
      max_tokens: 500,
      stream: true,
      system: `You explain scientific concepts to complete beginners — people with no maths, no science, no jargon.
Use an everyday analogy first. Plain language only. Two to three short paragraphs.
End with a single sentence: "Why it matters: ..."`,
      messages: [{ role: 'user', content: `Explain "${concept}" to a complete beginner.` }],
    }),
    signal,
  });

  if (!res.ok) {
    let msg = `API error ${res.status}`;
    try { const err = await res.json(); msg = err.error?.message || msg; } catch {}
    throw new Error(msg);
  }

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '', text = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split('\n'); buf = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const d = line.slice(6).trim();
        if (!d || d === '[DONE]') continue;
        try {
          const ev = JSON.parse(d);
          if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta') {
            text += ev.delta.text;
            onChunk(text);
          }
        } catch {}
      }
    }
  } finally { reader.releaseLock(); }
  return text;
}

export default function ConceptTiersView() {
  const [data,      setData]      = useState(null);
  const [status,    setStatus]    = useState('loading');
  const [errorMsg,  setErrorMsg]  = useState('');
  const [explainer, setExplainer] = useState({ concept: '', text: '', status: 'idle' });
  const explAbortRef = useRef(null);
  const readingPath  = useReadingPath();

  useEffect(() => {
    let cancelled = false;
    fetch('/data/concept-map.json')
      .then(r => { if (!r.ok) throw new Error(`Failed to load concept map (${r.status})`); return r.json(); })
      .then(json => { if (!cancelled) { setData(json); setStatus('done'); } })
      .catch(err => { if (!cancelled) { setErrorMsg(err.message); setStatus('error'); } });
    return () => { cancelled = true; };
  }, []);

  async function explain(concept) {
    const apiKey = resolveApiKey();
    if (!apiKey) return;
    explAbortRef.current?.abort();
    explAbortRef.current = new AbortController();
    setExplainer({ concept, text: '', status: 'loading' });
    try {
      await streamExplanation(concept, apiKey, explAbortRef.current.signal, text => {
        setExplainer(prev => ({ ...prev, text }));
      });
      setExplainer(prev => ({ ...prev, status: 'done' }));
    } catch (e) {
      if (e.name !== 'AbortError') setExplainer(prev => ({ ...prev, status: 'error' }));
    }
  }

  const totalConcepts = data
    ? data.reduce((s, t) => s + (t.groups?.reduce((ss, g) => ss + g.concepts.length, 0) ?? 0), 0)
    : 0;

  return (
    <div className="mt-8 space-y-6">
      {/* Header */}
      <div className="border-b border-stone-200 pb-4">
        <div className="flex items-baseline gap-3 mb-1">
          <h2 className="text-2xl font-bold tracking-tight text-stone-900">Concept Hierarchy of Human Knowledge</h2>
          {status === 'done' && (
            <span className="text-[8px] font-mono font-bold px-1.5 py-0.5 bg-stone-800 text-white">
              {totalConcepts.toLocaleString()} concepts · {data.length} tiers
            </span>
          )}
        </div>
        <p className="text-sm text-stone-500 max-w-2xl">
          All fundamental concepts across science, mathematics, medicine, law, and the humanities — ordered from pure abstraction to direct application.
          Click any concept for a reading path from zero · hover for the lightbulb to get a plain-English explanation.
        </p>
      </div>

      {/* Loading */}
      {status === 'loading' && (
        <div className="flex items-center gap-3 py-1">
          <span className="flex gap-0.5">
            <span className="loading-dot"/><span className="loading-dot"/><span className="loading-dot"/>
          </span>
          <span className="text-sm font-mono text-stone-500">Loading concept map…</span>
        </div>
      )}

      {/* Error */}
      {status === 'error' && (
        <div className="py-4 space-y-2">
          <div className="text-sm font-mono text-red-600">{errorMsg || 'Failed to load concept map.'}</div>
        </div>
      )}

      {/* Tier blocks */}
      {data && data.map((tier, ti) => {
        const c = TIER_COLORS[ti] || TIER_COLORS[TIER_COLORS.length - 1];
        const tierTotal = tier.groups?.reduce((s, g) => s + g.concepts.length, 0) ?? 0;
        return (
          <div key={tier.tier} className="border border-stone-200">
            <div className={`px-4 py-3 ${c.bg} text-white`}>
              <div className="flex items-baseline gap-3">
                <span className="text-[9px] font-mono font-bold opacity-60 tracking-widest">TIER {tier.tier}</span>
                <span className="font-bold text-sm">{tier.name}</span>
                <span className="text-[9px] font-mono opacity-50 ml-auto">{tierTotal.toLocaleString()} concepts</span>
              </div>
              <p className="text-[11px] opacity-75 mt-0.5 leading-snug">{tier.tagline}</p>
            </div>

            <div className="p-4 space-y-4 bg-white">
              {tier.groups?.map((group, gi) => (
                <div key={gi}>
                  <div className={`text-[9px] font-mono font-bold uppercase tracking-widest mb-2 ${c.text}`}>
                    {group.name}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {group.concepts.map((concept, ci) => {
                      const pathActive    = readingPath.topic === concept;
                      const explainActive = explainer.concept === concept;
                      return (
                        <span key={ci} className="group/chip inline-flex items-center gap-0">
                          {/* Reading path button — arrow icon appears on hover, pulses while loading */}
                          <button
                            onClick={() => readingPath.generate(concept)}
                            title="Generate reading path from zero"
                            className={`text-[11px] font-mono px-2 py-1 border transition-all inline-flex items-center gap-1.5 ${
                              pathActive ? c.active : `bg-white text-stone-700 border-stone-200 ${c.hover}`
                            }`}
                          >
                            {concept}
                            <svg
                              className={`shrink-0 w-[9px] h-[9px] transition-opacity ${
                                pathActive ? 'opacity-90' : 'opacity-0 group-hover/chip:opacity-35'
                              } ${pathActive && readingPath.status === 'loading' ? 'animate-pulse' : ''}`}
                              viewBox="0 0 9 9" fill="none"
                            >
                              <path d="M2 4.5h5M5 2l2.5 2.5L5 7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </button>

                          {/* Explain button — lightbulb icon, always faintly visible */}
                          <button
                            onClick={() => explain(concept)}
                            title="Explain to a beginner"
                            className={`py-1 px-1.5 border-y border-r transition-all flex items-center ${
                              explainActive
                                ? 'bg-stone-900 text-white border-stone-900'
                                : 'bg-stone-50 text-stone-400 border-stone-200 opacity-25 group-hover/chip:opacity-100 hover:bg-stone-900 hover:text-white hover:border-stone-900'
                            }`}
                          >
                            <svg className="w-[9px] h-[9px]" viewBox="0 0 9 9" fill="none">
                              <path d="M4.5 1a2 2 0 011.5 3.3c-.25.28-.3.5-.3.7H3.3c0-.2-.05-.42-.3-.7A2 2 0 014.5 1z" stroke="currentColor" strokeWidth="1" strokeLinejoin="round"/>
                              <path d="M3.3 6.2h2.4M3.8 7.5h1.4" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
                            </svg>
                          </button>
                        </span>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* Explanation panel */}
      {explainer.status !== 'idle' && (
        <div className="border border-stone-200 bg-white">
          <div className="flex items-center justify-between px-4 py-3 border-b border-stone-200 bg-stone-50">
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono font-bold text-stone-700">Explain</span>
              <span className="text-sm text-stone-500">{explainer.concept}</span>
              {explainer.status === 'loading' && (
                <span className="flex gap-0.5">
                  <span className="loading-dot"/><span className="loading-dot"/><span className="loading-dot"/>
                </span>
              )}
            </div>
            <button onClick={() => setExplainer({ concept: '', text: '', status: 'idle' })}
              className="text-[9px] font-mono text-stone-400 hover:text-stone-700 px-2 py-0.5 border border-stone-200 hover:border-stone-400 transition-colors">
              ✕ close
            </button>
          </div>
          <div className="p-4 text-sm text-stone-700 leading-relaxed whitespace-pre-wrap">
            {explainer.text || (explainer.status === 'loading' ? '' : 'Error generating explanation.')}
          </div>
        </div>
      )}

      {/* Reading Path panel */}
      {readingPath.status !== 'idle' && (
        <div className="border border-stone-200 bg-white">
          <div className="flex items-center justify-between px-4 py-3 border-b border-stone-200 bg-stone-50">
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono font-bold text-stone-700">Reading Path</span>
              <span className="text-sm text-stone-500">{readingPath.topic}</span>
              {readingPath.status === 'loading' && (
                <span className="flex gap-0.5">
                  <span className="loading-dot"/><span className="loading-dot"/><span className="loading-dot"/>
                </span>
              )}
            </div>
            <button onClick={readingPath.clear}
              className="text-[9px] font-mono text-stone-400 hover:text-stone-700 px-2 py-0.5 border border-stone-200 hover:border-stone-400 transition-colors">
              ✕ close
            </button>
          </div>
          <div className="p-4">
            <ReadingOrderView content={readingPath.content} isStreaming={readingPath.status === 'loading'} />
          </div>
        </div>
      )}
    </div>
  );
}
