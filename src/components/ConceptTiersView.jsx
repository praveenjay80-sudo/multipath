import { useState, useRef, useEffect } from 'react';
import { useReadingPath } from '../hooks/useReadingPath';
import ReadingOrderView from './ReadingOrderView';
import ExplainContent from './ExplainContent';
import { resolveAnthropicApiKey, streamExplanation } from '../utils/explainConcept';

const TIER_COLORS = [
  { bg: 'bg-violet-700', text: 'text-violet-700', active: 'bg-violet-700 text-white border-violet-700', hover: 'hover:bg-violet-700 hover:text-white hover:border-violet-700' },
  { bg: 'bg-sky-700',    text: 'text-sky-700',    active: 'bg-sky-700 text-white border-sky-700',       hover: 'hover:bg-sky-700 hover:text-white hover:border-sky-700'       },
  { bg: 'bg-teal-700',   text: 'text-teal-700',   active: 'bg-teal-700 text-white border-teal-700',     hover: 'hover:bg-teal-700 hover:text-white hover:border-teal-700'     },
  { bg: 'bg-amber-700',  text: 'text-amber-700',  active: 'bg-amber-700 text-white border-amber-700',   hover: 'hover:bg-amber-700 hover:text-white hover:border-amber-700'   },
];

function LoadingDots() {
  return (
    <span className="flex gap-0.5">
      <span className="loading-dot"/><span className="loading-dot"/><span className="loading-dot"/>
    </span>
  );
}

export default function ConceptTiersView() {
  const [data,      setData]      = useState(null);
  const [status,    setStatus]    = useState('loading');
  const [errorMsg,  setErrorMsg]  = useState('');
  const [explainer, setExplainer] = useState({ concept: '', text: '', status: 'idle' });
  const [panelMode, setPanelMode] = useState('idle'); // 'idle' | 'path' | 'explain'
  const explAbortRef = useRef(null);
  const readingPath  = useReadingPath();

  useEffect(() => {
    let cancelled = false;
    fetch('/data/concept-map.json')
      .then(r => { if (!r.ok) throw new Error(`Failed to load (${r.status})`); return r.json(); })
      .then(json => { if (!cancelled) { setData(json); setStatus('done'); } })
      .catch(err => { if (!cancelled) { setErrorMsg(err.message); setStatus('error'); } });
    return () => { cancelled = true; };
  }, []);

  function handleReadingPath(concept) {
    readingPath.generate(concept);
    setPanelMode('path');
  }

  async function handleExplain(concept) {
    const apiKey = resolveAnthropicApiKey();
    if (!apiKey) return;
    explAbortRef.current?.abort();
    explAbortRef.current = new AbortController();
    setExplainer({ concept, text: '', status: 'loading' });
    setPanelMode('explain');
    try {
      await streamExplanation(concept, apiKey, explAbortRef.current.signal, text =>
        setExplainer(prev => ({ ...prev, text }))
      );
      setExplainer(prev => ({ ...prev, status: 'done' }));
    } catch (e) {
      if (e.name !== 'AbortError') setExplainer(prev => ({ ...prev, status: 'error' }));
    }
  }

  function closePanel(which) {
    if (which === 'path') {
      readingPath.clear();
      setPanelMode(explainer.status !== 'idle' ? 'explain' : 'idle');
    } else {
      explAbortRef.current?.abort();
      setExplainer({ concept: '', text: '', status: 'idle' });
      setPanelMode(readingPath.status !== 'idle' ? 'path' : 'idle');
    }
  }

  const totalConcepts = data
    ? data.reduce((s, t) => s + (t.groups?.reduce((ss, g) => ss + g.concepts.length, 0) ?? 0), 0)
    : 0;

  const panelOpen    = panelMode !== 'idle';
  const hasBoth      = readingPath.status !== 'idle' && explainer.status !== 'idle';
  const panelLoading = (panelMode === 'path' && readingPath.status === 'loading')
                    || (panelMode === 'explain' && explainer.status === 'loading');
  const panelLabel   = panelMode === 'path' ? readingPath.topic : explainer.concept;

  return (
    <div className="mt-8">
      {/* Full-width header */}
      <div className="border-b border-stone-200 pb-4 mb-6">
        <div className="flex items-baseline gap-3 mb-1">
          <h2 className="text-2xl font-bold tracking-tight text-stone-900">Concept Hierarchy of Human Knowledge</h2>
          {status === 'done' && (
            <span className="text-[8px] font-mono font-bold px-1.5 py-0.5 bg-stone-800 text-white">
              {totalConcepts.toLocaleString()} concepts · {data.length} tiers
            </span>
          )}
        </div>
        <p className="text-sm text-stone-500 max-w-2xl">
          All fundamental concepts across science, mathematics, medicine, law, and the humanities —
          ordered from pure abstraction to direct application.
          Click any concept for a reading path from zero · hover then click the lightbulb for a plain-English explanation.
        </p>
      </div>

      {/* Two-column layout */}
      <div className="flex gap-5 items-start">

        {/* Left: tier blocks */}
        <div className="flex-1 min-w-0 space-y-5">
          {status === 'loading' && (
            <div className="flex items-center gap-3 py-1">
              <LoadingDots />
              <span className="text-sm font-mono text-stone-500">Loading concept map…</span>
            </div>
          )}
          {status === 'error' && (
            <div className="text-sm font-mono text-red-600 py-4">{errorMsg}</div>
          )}

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
                              <button
                                onClick={() => handleReadingPath(concept)}
                                title="Reading path from zero"
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
                              <button
                                onClick={() => handleExplain(concept)}
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
        </div>

        {/* Right: sticky side panel */}
        {panelOpen && (
          <div className="w-[348px] flex-shrink-0">
            <div
              className="sticky top-4 border border-stone-200 bg-white flex flex-col"
              style={{ maxHeight: 'calc(100vh - 2rem)' }}
            >
              {/* Panel header */}
              <div className="flex items-center justify-between px-3 py-2.5 border-b border-stone-200 bg-stone-50 flex-shrink-0 gap-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {/* Tab switcher when both panels have content */}
                  {hasBoth ? (
                    <div className="flex gap-0 flex-shrink-0">
                      <button
                        onClick={() => setPanelMode('path')}
                        className={`text-[8px] font-mono font-bold px-2 py-1 border transition-colors ${
                          panelMode === 'path'
                            ? 'bg-stone-800 text-white border-stone-800'
                            : 'bg-white text-stone-400 border-stone-200 hover:text-stone-700'
                        }`}
                      >
                        PATH
                      </button>
                      <button
                        onClick={() => setPanelMode('explain')}
                        className={`text-[8px] font-mono font-bold px-2 py-1 border-y border-r transition-colors ${
                          panelMode === 'explain'
                            ? 'bg-stone-800 text-white border-stone-800'
                            : 'bg-white text-stone-400 border-stone-200 hover:text-stone-700'
                        }`}
                      >
                        EXPLAIN
                      </button>
                    </div>
                  ) : (
                    <span className="text-[8px] font-mono font-bold uppercase tracking-widest text-stone-400 flex-shrink-0">
                      {panelMode === 'path' ? 'Reading Path' : 'Explain'}
                    </span>
                  )}

                  <span className="text-xs text-stone-700 font-medium truncate">{panelLabel}</span>

                  {panelLoading && <LoadingDots />}
                </div>

                <button
                  onClick={() => closePanel(panelMode)}
                  className="text-[9px] font-mono text-stone-400 hover:text-stone-700 px-1.5 py-0.5 border border-stone-200 hover:border-stone-400 transition-colors flex-shrink-0"
                >
                  ✕
                </button>
              </div>

              {/* Scrollable content */}
              <div className="overflow-y-auto flex-1 p-4">
                {panelMode === 'explain' && (
                  explainer.status === 'error'
                    ? <div className="text-sm text-red-600">Error generating explanation.</div>
                    : <ExplainContent text={explainer.text} />
                )}
                {panelMode === 'path' && (
                  <ReadingOrderView
                    content={readingPath.content}
                    isStreaming={readingPath.status === 'loading'}
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
