import { useState, useMemo, useRef } from 'react';
import CanonInput from './components/CanonInput';
import CanonOutput from './components/CanonOutput';
import Sidebar from './components/Sidebar';
import ActionBar from './components/ActionBar';
import LoadingState from './components/LoadingState';
import CandidatePreview from './components/CandidatePreview';
import ApiKeyInput from './components/ApiKeyInput';
import { useCanonGenerator } from './hooks/useCanonGenerator';
import { useCanonHistory } from './hooks/useCanonHistory';
import { useEnrichment } from './hooks/useEnrichment';
import { useWorkExplainer } from './hooks/useWorkExplainer';
import { parseCanon } from './utils/parseCanon';
import { copyMarkdown } from './utils/exportMarkdown';

function WorkRow({ w }) {
  return (
    <div className="pb-3 border-b border-stone-100 last:border-0 last:pb-0">
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="font-semibold text-sm text-stone-800">{w.title}</span>
        {w.year && <span className="text-stone-400 text-xs">({w.year})</span>}
      </div>
      {w.authors && <div className="text-xs text-stone-500 mt-0.5">{w.authors}</div>}
      <div className="flex flex-wrap gap-2 mt-1.5">
        {w.citationCount != null && (
          <span className="text-xs font-mono text-stone-500">{w.citationCount.toLocaleString()} citations</span>
        )}
        {w.fwci != null && <span className="text-xs text-stone-500">FWCI {w.fwci.toFixed(2)}</span>}
        {w.venue && <span className="text-xs text-stone-400 italic">{w.venue}</span>}
        {w.isOA && w.oaUrl && (
          <a href={w.oaUrl} target="_blank" rel="noreferrer" className="text-xs text-emerald-600 hover:underline">Open Access</a>
        )}
      </div>
    </div>
  );
}

function MissingWorksPanel({ missing }) {
  if (!missing.length) return null;
  const definitive = missing.filter(w => w.gapTier === 'definitive');
  const possible = missing.filter(w => w.gapTier === 'possible');
  return (
    <div className="mt-6 space-y-4">
      {definitive.length > 0 && (
        <div className="border border-red-200 bg-red-50 p-5">
          <div className="flex items-center gap-2 mb-3">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-red-600 shrink-0">
              <path d="M6 1L11 10H1L6 1Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
              <path d="M6 4.5v2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              <circle cx="6" cy="8" r="0.6" fill="currentColor"/>
            </svg>
            <h3 className="text-xs font-mono uppercase tracking-widest text-red-700">
              Likely Missing — {definitive.length} high-impact {definitive.length === 1 ? 'work' : 'works'} with 5k+ citations not in canon
            </h3>
          </div>
          <div className="space-y-3">{definitive.map((w, i) => <WorkRow key={i} w={w} />)}</div>
        </div>
      )}
      {possible.length > 0 && (
        <div className="border border-amber-200 bg-amber-50 p-5">
          <h3 className="text-xs font-mono uppercase tracking-widest text-amber-700 mb-3">
            Possibly Missing — {possible.length} cited {possible.length === 1 ? 'work' : 'works'} (500–5k citations) not in canon
          </h3>
          <div className="space-y-3">{possible.map((w, i) => <WorkRow key={i} w={w} />)}</div>
        </div>
      )}
    </div>
  );
}

function RefinementUI({ onRefine, refinements, disabled }) {
  const [input, setInput] = useState('');

  function handleSubmit() {
    const v = input.trim();
    if (!v || disabled) return;
    onRefine(v);
    setInput('');
  }

  return (
    <div className="mt-8 pt-6 border-t border-stone-200">
      <p className="text-xs font-mono uppercase tracking-widest text-stone-400 mb-3">Refine this canon</p>
      {refinements.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {refinements.map((r, i) => (
            <span key={i} className="text-xs text-stone-400 bg-stone-100 px-2 py-1 leading-none">
              {r.length > 70 ? r.slice(0, 67) + '...' : r}
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          placeholder="e.g. Make orientation more accessible, add more recent works, focus on empirical methods..."
          disabled={disabled}
          className="flex-1 px-3 py-2.5 text-sm border border-stone-200 bg-white text-stone-900 placeholder-stone-300 focus:outline-none focus:border-stone-700 transition-colors disabled:opacity-50"
        />
        <button
          onClick={handleSubmit}
          disabled={!input.trim() || disabled}
          className="px-5 py-2 text-sm bg-stone-900 text-white hover:bg-stone-700 transition-colors disabled:opacity-40"
        >
          Refine
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const gen = useCanonGenerator();
  const hist = useCanonHistory();
  const enrichment = useEnrichment();
  const explainer = useWorkExplainer(gen.topic);
  const [inputTopic, setInputTopic] = useState('');
  const [shake, setShake] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const parsed = useMemo(() => parseCanon(gen.content), [gen.content]);

  const isGenerating = ['harvesting', 'scoring', 'composing'].includes(gen.phase);
  const isRefining = gen.phase === 'refining';
  const hasOutput = !!gen.content && gen.phase !== 'idle';

  // Trigger background CrossRef + OpenAlex enrichment once composition completes
  const prevPhase = useRef(null);
  useMemo(() => {
    if (gen.phase === 'complete' && prevPhase.current === 'composing' && parsed) {
      enrichment.enrich(parsed);
    }
    prevPhase.current = gen.phase;
  }, [gen.phase]);

  // Merge Scholar counts from generator with FWCI/DOI/OA from enrichment
  function getCitation(title) {
    const fromGen = gen.getCandidateCitation(title);
    const fromEnrich = enrichment.getCitation(title);
    if (!fromGen && !fromEnrich) return null;
    return {
      citationCount: fromGen?.citationCount ?? fromEnrich?.citationCount ?? null,
      scholarLink: fromGen?.scholarLink ?? null,
      fwci: fromEnrich?.fwci ?? null,
      type: fromEnrich?.type ?? null,
      isOA: fromEnrich?.isOA ?? false,
      oaUrl: fromEnrich?.oaUrl ?? null,
      percentile: fromEnrich?.percentile ?? null,
      venue: fromEnrich?.venue ?? null,
      doi: fromEnrich?.doi ?? null,
    };
  }

  function triggerShake() {
    setShake(true);
    setTimeout(() => setShake(false), 600);
  }

  function handleGenerate() {
    if (!inputTopic.trim()) { triggerShake(); return; }
    enrichment.clear();
    gen.generateCanon(inputTopic.trim());
  }

  function handleSave() {
    if (gen.content && gen.topic) hist.saveCanon(gen.topic, gen.content, 'full');
  }

  function handleLoad(item) {
    setInputTopic(item.topic);
    enrichment.clear();
    gen.loadContent(item.topic, item.content);
    setMobileSidebarOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleNew() {
    gen.reset();
    enrichment.clear();
    setInputTopic('');
  }

  return (
    <div className="min-h-screen" style={{ background: '#FAFAF9' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex gap-12">
          <div className="flex-1 min-w-0 py-12">
            <header className="mb-12">
              <h1 className="text-3xl font-semibold tracking-tight text-stone-900">Canon</h1>
              <p className="mt-1 text-stone-400 text-sm">Definitive reading lists for any academic field</p>
            </header>

            <ApiKeyInput />

            <CanonInput
              value={inputTopic}
              onChange={setInputTopic}
              onGenerate={handleGenerate}
              onQuickGenerate={handleGenerate}
              shake={shake}
              disabled={isGenerating || isRefining}
            />

            {/* Harvest + scoring phases */}
            {(gen.phase === 'harvesting' || gen.phase === 'scoring') && (
              <>
                <LoadingState phase={gen.phase} message={gen.loadingMessage} />
                {gen.harvestedWorks.length > 0 && (
                  <CandidatePreview
                    candidates={gen.harvestedWorks}
                    harvestCounts={gen.harvestCounts}
                  />
                )}
              </>
            )}

            {/* Composing phase */}
            {gen.phase === 'composing' && (
              <LoadingState phase={gen.phase} message={gen.loadingMessage} />
            )}

            {isRefining && <LoadingState phase="refining" message={gen.loadingMessage} />}

            {gen.phase === 'error' && (
              <div className="mt-8 p-5 bg-red-50 border border-red-200">
                <p className="font-medium text-red-900 text-sm">Generation failed</p>
                <p className="text-sm text-red-700 mt-1">{gen.error}</p>
                <button onClick={handleGenerate} className="mt-3 text-sm text-red-700 underline hover:no-underline">
                  Try again
                </button>
              </div>
            )}

            {hasOutput && parsed && (
              <CanonOutput
                parsed={parsed}
                isStreaming={gen.phase === 'composing' || isRefining}
                getCitation={getCitation}
                getVerification={enrichment.getVerification}
                onExplain={explainer.explain}
                getExplanation={explainer.getExplanation}
              />
            )}

            {hasOutput && !isGenerating && !isRefining && enrichment.status !== 'idle' && (
              <MissingWorksPanel missing={enrichment.missing} />
            )}

            {hasOutput && gen.phase !== 'error' && (
              <ActionBar
                onCopy={() => copyMarkdown(gen.content)}
                onSave={handleSave}
                onRegenerate={handleGenerate}
                onNew={handleNew}
                disabled={isGenerating || isRefining}
              />
            )}

            {gen.phase === 'complete' && (
              <RefinementUI
                onRefine={gen.refineCanon}
                refinements={gen.refinements}
                disabled={false}
              />
            )}
          </div>

          <div className="hidden lg:block w-64 shrink-0 py-12">
            <div className="sticky top-12">
              <Sidebar
                history={hist.history}
                onLoad={handleLoad}
                onDelete={hist.deleteCanon}
                onClearAll={hist.clearAll}
              />
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={() => setMobileSidebarOpen(true)}
        className="lg:hidden fixed bottom-6 right-6 bg-stone-900 text-white text-xs px-4 py-2.5 shadow-lg font-mono uppercase tracking-wider"
      >
        Saved {hist.history.length > 0 && `(${hist.history.length})`}
      </button>

      {mobileSidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileSidebarOpen(false)} />
          <div className="relative bg-white max-h-[70vh] overflow-y-auto p-6 shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <span className="text-xs font-mono uppercase tracking-widest text-stone-500">Saved Canons</span>
              <button onClick={() => setMobileSidebarOpen(false)} className="text-stone-400 hover:text-stone-700">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
                </svg>
              </button>
            </div>
            <Sidebar history={hist.history} onLoad={handleLoad} onDelete={hist.deleteCanon} onClearAll={hist.clearAll} />
          </div>
        </div>
      )}
    </div>
  );
}
