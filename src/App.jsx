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
import { useFieldNavigation } from './hooks/useFieldNavigation';
import { useReadingOrder } from './hooks/useReadingOrder';
import { useReverseMode } from './hooks/useReverseMode';
import { useCurriculumMode } from './hooks/useCurriculumMode';
import { useDissertationMode } from './hooks/useDissertationMode';
import { useCanonDrift } from './hooks/useCanonDrift';
import { useConsilience } from './hooks/useConsilience';
import { useInquiry } from './hooks/useInquiry';
import { useSpectrum } from './hooks/useSpectrum';
import { usePulse } from './hooks/usePulse';
import { useFieldIntelligence } from './hooks/useFieldIntelligence';
import { parseCanon } from './utils/parseCanon';
import { copyMarkdown } from './utils/exportMarkdown';
import ReadingOrderView from './components/ReadingOrderView';
import ReverseInput from './components/ReverseInput';
import PrerequisiteView from './components/PrerequisiteView';
import CurriculumInput from './components/CurriculumInput';
import CurriculumView from './components/CurriculumView';
import DoctoralTopicsView from './components/DoctoralTopicsView';
import { useDoctoralTopics } from './hooks/useDoctoralTopics';
import DissertationInput from './components/DissertationInput';
import DissertationView from './components/DissertationView';
import CanonDriftInput from './components/CanonDriftInput';
import CanonDriftView from './components/CanonDriftView';
import ConsilienceInput from './components/ConsilienceInput';
import ConsilienceView from './components/ConsilienceView';
import InquiryInput from './components/InquiryInput';
import InquiryView from './components/InquiryView';
import SpectrumInput from './components/SpectrumInput';
import SpectrumQuestionsView from './components/SpectrumQuestionsView';
import SpectrumView from './components/SpectrumView';
import PulseInput from './components/PulseInput';
import PulseView from './components/PulseView';
import FieldIntelligenceInput from './components/FieldIntelligenceInput';
import FieldIntelligenceView from './components/FieldIntelligenceView';
import MathExplorerView from './components/MathExplorerView';
import ConceptTiersView from './components/ConceptTiersView';
import UDCView from './components/UDCView';
import AcademiaTopicsView from './components/AcademiaTopicsView';
import { useAcademiaTopics } from './hooks/useAcademiaTopics';
import OverallAggregatorInput from './components/OverallAggregatorInput';
import OverallAggregatorView from './components/OverallAggregatorView';
import { useOverallAggregator } from './hooks/useOverallAggregator';

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
            <h3 className="text-xs font-mono text-red-700">
              Likely Missing — {definitive.length} high-impact {definitive.length === 1 ? 'work' : 'works'} with 5k+ citations not in canon
            </h3>
          </div>
          <div className="space-y-3">{definitive.map((w, i) => <WorkRow key={i} w={w} />)}</div>
        </div>
      )}
      {possible.length > 0 && (
        <div className="border border-amber-200 bg-amber-50 p-5">
          <h3 className="text-xs font-mono text-amber-700 mb-3">
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
      <p className="text-xs font-mono text-stone-400 mb-3">Refine this canon</p>
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
  const fieldNav = useFieldNavigation();
  const readingOrder = useReadingOrder();
  const reverse = useReverseMode();
  const curriculum = useCurriculumMode();
  const doctoral = useDoctoralTopics();
  const academia = useAcademiaTopics();
  const dissertation = useDissertationMode();
  const drift = useCanonDrift();
  const consilience = useConsilience();
  const inquiry = useInquiry();
  const spectrum = useSpectrum();
  const pulse = usePulse();
  const fieldIntel = useFieldIntelligence();
  const aggregator = useOverallAggregator();
  const [inputTopic, setInputTopic] = useState('');
  const [shake, setShake] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [view, setView] = useState('canon');
  const [appMode, setAppMode] = useState('canon'); // 'canon' | 'reverse' | 'curriculum' | 'doctoral' | 'dissertation' | 'drift' | 'consilience' | 'inquiry' | 'spectrum' | 'deepdive' | 'pulse' | 'intelligence' | 'math' | 'concepts' | 'udc' | 'academia' | 'overall'

  const parsed = useMemo(() => parseCanon(gen.content), [gen.content]);

  const isGenerating = ['harvesting', 'scoring', 'composing'].includes(gen.phase);
  const isRefining = gen.phase === 'refining';
  const hasOutput = !!gen.content && gen.phase !== 'idle';

  const prevPhase = useRef(null);
  useMemo(() => {
    if (gen.phase === 'complete' &&
        (prevPhase.current === 'composing' || prevPhase.current === 'refining') &&
        parsed) {
      enrichment.enrich(parsed);
      if (readingOrder.status === 'idle') readingOrder.generate(gen.content);
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

  function handleViewToggle(v) {
    setView(v);
    if (v === 'reading-order' && readingOrder.status === 'idle') {
      readingOrder.generate(gen.content);
    }
  }

  function handleGenerate() {
    if (!inputTopic.trim()) { triggerShake(); return; }
    gen.reset();
    enrichment.clear();
    readingOrder.clear();
    setView('canon');
    gen.generateCanon(inputTopic.trim(), 'full');
  }

  function handleClickTopLevel(field) {
    fieldNav.clickTopLevel(field);
  }

  function handleClickSubfield(parent, sf) {
    fieldNav.clickSubfield(parent, sf);
  }

  function handleSelectTopic(topic) {
    enrichment.clear();
    readingOrder.clear();
    setView('canon');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    switch (appMode) {
      case 'curriculum':   curriculum.generate(topic);   break;
      case 'dissertation': dissertation.generate(topic); break;
      case 'drift':        drift.generate(topic);        break;
      case 'consilience':  consilience.generate(topic);  break;
      case 'inquiry':      inquiry.generate(topic);      break;
      case 'reverse':      reverse.generate(topic);      break;
      default:             gen.generateCanon(topic, 'subfield'); break;
    }
  }

  function handleDoctoralTopicClick(topicName, mode = 'canon') {
    enrichment.clear();
    readingOrder.clear();
    setView('canon');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setAppMode(mode);
    switch (mode) {
      case 'curriculum':   curriculum.generate(topicName);   break;
      case 'dissertation': dissertation.generate(topicName); break;
      case 'reverse':      reverse.generate(topicName);      break;
      case 'drift':        drift.generate(topicName);        break;
      case 'consilience':  consilience.generate(topicName);  break;
      case 'inquiry':      inquiry.generate(topicName);      break;
      case 'spectrum':     spectrum.submitDirectQuestion(topicName); break;
      case 'intelligence': fieldIntel.generate(topicName);   break;
      default:
        setInputTopic(topicName);
        gen.generateCanon(topicName, 'subfield');
    }
  }

  function handleConceptGenerate(topic, mode) {
    enrichment.clear();
    readingOrder.clear();
    setView('canon');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    switch (mode) {
      case 'curriculum':   setAppMode('curriculum');   curriculum.generate(topic);   break;
      case 'dissertation': setAppMode('dissertation'); dissertation.generate(topic); break;
      case 'drift':        setAppMode('drift');        drift.generate(topic);        break;
      case 'consilience':  setAppMode('consilience');  consilience.generate(topic);  break;
      case 'inquiry':      setAppMode('inquiry');      inquiry.generate(topic);      break;
      case 'reverse':      setAppMode('reverse');      reverse.generate(topic);      break;
      default:             setAppMode('canon');        gen.generateCanon(topic, 'subfield'); break;
    }
  }

  function handleClickSubSubfield(ssf) {
    handleSelectTopic(ssf);
  }

  function handleSave() {
    if (gen.content && gen.topic) hist.saveCanon(gen.topic, gen.content, 'full');
  }

  function handleLoad(item) {
    setInputTopic(item.topic);
    enrichment.clear();
    readingOrder.clear();
    setView('canon');
    gen.loadContent(item.topic, item.content);
    setMobileSidebarOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleNew() {
    gen.reset();
    enrichment.clear();
    readingOrder.clear();
    setView('canon');
    setInputTopic('');
  }

  return (
    <div className="min-h-screen" style={{ background: '#FAFAF9' }}>
      <div className="lg:pr-80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex-1 min-w-0 py-12">
            <header className="mb-10">
              <h1 className="text-6xl font-bold tracking-tight text-stone-900">Multipath</h1>
              <p className="mt-2 text-base text-stone-500 max-w-2xl leading-relaxed">
                From any question to a complete scholarly roadmap — reading lists, curricula, prerequisites, dissertations, prerequisite/postrequisite maps, canon drift over time, cross-disciplinary synthesis, frontier open questions, transdisciplinary real-life answers, live citation data, field intelligence, and a 2,575-concept map, across 12 modes.
              </p>

              {/* App mode toggle */}
              <div className="mt-6 flex flex-wrap border-b border-stone-200">
                <button
                  onClick={() => setAppMode('canon')}
                  className={`px-4 py-2.5 text-sm font-mono -mb-px transition-colors ${
                    appMode === 'canon'
                      ? 'border-b-2 border-blue-600 text-blue-700 font-semibold'
                      : 'border-b-2 border-transparent text-blue-500 hover:text-blue-700'
                  }`}
                >
                  Generate Canon
                </button>
                <button
                  onClick={() => setAppMode('reverse')}
                  className={`px-4 py-2.5 text-sm font-mono -mb-px transition-colors ${
                    appMode === 'reverse'
                      ? 'border-b-2 border-violet-600 text-violet-700 font-semibold'
                      : 'border-b-2 border-transparent text-violet-500 hover:text-violet-700'
                  }`}
                >
                  Pre &amp; Post Requisites
                </button>
                <button
                  onClick={() => setAppMode('curriculum')}
                  className={`px-4 py-2.5 text-sm font-mono -mb-px transition-colors ${
                    appMode === 'curriculum'
                      ? 'border-b-2 border-sky-600 text-sky-700 font-semibold'
                      : 'border-b-2 border-transparent text-sky-500 hover:text-sky-700'
                  }`}
                >
                  Curriculum
                </button>
                <button
                  onClick={() => setAppMode('dissertation')}
                  className={`px-4 py-2.5 text-sm font-mono -mb-px transition-colors ${
                    appMode === 'dissertation'
                      ? 'border-b-2 border-indigo-600 text-indigo-700 font-semibold'
                      : 'border-b-2 border-transparent text-indigo-500 hover:text-indigo-700'
                  }`}
                >
                  Dissertation
                </button>
                <button
                  onClick={() => setAppMode('drift')}
                  className={`px-4 py-2.5 text-sm font-mono -mb-px transition-colors ${
                    appMode === 'drift'
                      ? 'border-b-2 border-amber-500 text-amber-700 font-semibold'
                      : 'border-b-2 border-transparent text-amber-500 hover:text-amber-700'
                  }`}
                >
                  Canon Drift
                </button>
                <button
                  onClick={() => setAppMode('consilience')}
                  className={`px-4 py-2.5 text-sm font-mono -mb-px transition-colors ${
                    appMode === 'consilience'
                      ? 'border-b-2 border-teal-600 text-teal-700 font-semibold'
                      : 'border-b-2 border-transparent text-teal-500 hover:text-teal-700'
                  }`}
                >
                  Consilience
                </button>
                <button
                  onClick={() => setAppMode('inquiry')}
                  className={`px-4 py-2.5 text-sm font-mono -mb-px transition-colors ${
                    appMode === 'inquiry'
                      ? 'border-b-2 border-rose-600 text-rose-700 font-semibold'
                      : 'border-b-2 border-transparent text-rose-500 hover:text-rose-700'
                  }`}
                >
                  The Inquiry
                </button>
                <button
                  onClick={() => setAppMode('spectrum')}
                  className={`px-4 py-2.5 text-sm font-mono -mb-px transition-colors ${
                    appMode === 'spectrum'
                      ? 'border-b-2 border-cyan-600 text-cyan-700 font-semibold'
                      : 'border-b-2 border-transparent text-cyan-600 hover:text-cyan-700'
                  }`}
                >
                  Spectrum
                </button>
                <button
                  onClick={() => setAppMode('pulse')}
                  className={`px-4 py-2.5 text-sm font-mono -mb-px transition-colors ${
                    appMode === 'pulse'
                      ? 'border-b-2 border-lime-600 text-lime-700 font-semibold'
                      : 'border-b-2 border-transparent text-lime-600 hover:text-lime-800'
                  }`}
                >
                  Master Reading List
                </button>

                <button
                  onClick={() => setAppMode('intelligence')}
                  className={`ml-3 px-4 py-2 text-sm font-mono -mb-px transition-all flex items-center gap-2 ${
                    appMode === 'intelligence'
                      ? 'bg-emerald-700 text-white font-bold border-b-2 border-emerald-700 shadow-sm'
                      : 'border border-emerald-200 border-b-2 border-b-transparent text-emerald-700 font-semibold hover:bg-emerald-50'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${appMode === 'intelligence' ? 'bg-emerald-300' : 'bg-emerald-500'}`} />
                  Field Intelligence
                </button>
                <button
                  onClick={() => setAppMode('concepts')}
                  className={`px-4 py-2.5 text-sm font-mono -mb-px transition-colors ${
                    appMode === 'concepts'
                      ? 'border-b-2 border-fuchsia-600 text-fuchsia-700 font-semibold'
                      : 'border-b-2 border-transparent text-fuchsia-500 hover:text-fuchsia-700'
                  }`}
                >
                  Concept Map
                </button>
                <button
                  onClick={() => { setAppMode('doctoral'); if (doctoral.status === 'idle') doctoral.load(); }}
                  className={`px-4 py-2.5 text-sm font-mono -mb-px transition-colors ${
                    appMode === 'doctoral'
                      ? 'border-b-2 border-rose-600 text-rose-700 font-semibold'
                      : 'border-b-2 border-transparent text-rose-500 hover:text-rose-700'
                  }`}
                >
                  Doctoral Topics
                </button>
                <button
                  onClick={() => setAppMode('udc')}
                  className={`px-4 py-2.5 text-sm font-mono -mb-px transition-colors ${
                    appMode === 'udc'
                      ? 'border-b-2 border-teal-600 text-teal-700 font-semibold'
                      : 'border-b-2 border-transparent text-teal-500 hover:text-teal-700'
                  }`}
                >
                  UDC
                </button>
                <button
                  onClick={() => { setAppMode('academia'); if (academia.status === 'idle') academia.load(); }}
                  className={`px-4 py-2.5 text-sm font-mono -mb-px transition-colors ${
                    appMode === 'academia'
                      ? 'border-b-2 border-blue-600 text-blue-700 font-semibold'
                      : 'border-b-2 border-transparent text-blue-500 hover:text-blue-700'
                  }`}
                >
                  Academia
                </button>
                <button
                  onClick={() => setAppMode('overall')}
                  className={`ml-4 px-5 py-2 text-sm font-mono font-bold -mb-px transition-all ${
                    appMode === 'overall'
                      ? 'bg-stone-900 text-white border-b-2 border-stone-900'
                      : 'border border-stone-400 border-b-2 border-b-transparent text-stone-800 hover:bg-stone-100'
                  }`}
                >
                  OVERALL AGGREGATOR
                </button>
              </div>

              {/* Tab description */}
              <p className="mt-4 text-sm text-stone-500 leading-relaxed">
                {appMode === 'canon'
                  ? 'Definitive reading lists built from 8 live sources — OpenAlex, Semantic Scholar, Google Books, Open Library, and Open Syllabus. Organized into sections with auto-generated reading order.'
                  : appMode === 'reverse'
                  ? 'Paste any paper or book and get its complete intellectual map — a phase-by-phase prerequisite path with exact chapter focus, plus postrequisite streams showing what opens up after mastering it.'
                  : appMode === 'curriculum'
                  ? 'How universities worldwide actually teach any subject — organized into courses from first-year undergraduate to research seminar, with prerequisites, skills, milestones, textbooks, and seminal papers per course.'
                  : appMode === 'dissertation'
                  ? 'Enter a PhD research question and get the exact qualifying-exam reading list — tiers from field foundations to contested ground, each with Must Master annotations, plus Committee Note, Exam Prep, and Advisor Note.'
                  : appMode === 'drift'
                  ? "Trace how any field's canon has shifted across four eras — what rose, what faded, where it is heading. Each work tagged Defining, Rising, Fading, or Watch, grounded in real citation data."
                  : appMode === 'consilience'
                  ? "Enter any cross-disciplinary question and see what every field says — each discipline's lens, answer, and key works. Surfaces convergences, tensions, and a synthesis no single field can reach alone."
                  : appMode === 'inquiry'
                  ? 'Enter any field or topic and get the open questions at its frontier — precisely formulated, with what makes each hard, what has been tried, who is working on it, and the best entry point.'
                  : appMode === 'spectrum'
                  ? 'Enter a topic and get real-life questions whose complete answer genuinely spans multiple disciplines — or type your own. Get a plain-language concept breakdown and a staged reading list grounded in real literature.'
                  : appMode === 'pulse'
                  ? 'Pick a field, subfield, and topic (optionally ask Claude to suggest more specific ones) — see live citation counts, citation velocity, influential papers, and Google Scholar results right now. The data itself is always raw numbers from OpenAlex, Semantic Scholar, and Google Scholar — never AI-generated.'
                  : appMode === 'intelligence'
                  ? 'Map any field\'s complete intellectual landscape — all schools of thought, key interlocutors, and the central argument structure. Then audit its hidden assumptions and paradigm status.'
                  : appMode === 'knowledge'
                  ? ''
                  : appMode === 'concepts'
                  ? '600+ fundamental scientific concepts — from pure logic to applied models — ordered across 7 tiers by generality. Generated by Claude on first load, cached permanently. Click any concept for a reading path.'
                  : appMode === 'doctoral'
                  ? 'Browse PhD research topics across every academic field — sourced live from phd.nthrys.com. Click any topic to generate its canon.'
                  : appMode === 'udc'
                  ? 'Universal Decimal Classification — 9,000+ subject codes from ETH Zurich\'s library across 9 main classes. Select a mode, click any code to generate. Check for newly added codes.'
                  : appMode === 'academia'
                  ? 'Academia.edu topic hierarchy — 25 disciplines, 661 subtopics, and 200,000+ research interest tags across all fields of scholarship. 3 levels deep, fully searchable.'
                  : appMode === 'overall'
                  ? 'One question. Nine sections generated in parallel — orientation, historical development, intellectual landscape, hidden assumptions, every discipline\'s answer, essential works, what you need first, the open frontier, and the path to mastery.'
                  : ''}
              </p>
            </header>

            <ApiKeyInput />

            {appMode === 'canon' && (
              <CanonInput
                value={inputTopic}
                onChange={setInputTopic}
                onGenerate={handleGenerate}
                onQuickGenerate={handleGenerate}
                shake={shake}
                disabled={isGenerating || isRefining}
              />
            )}

            {appMode === 'reverse' && (
              <ReverseInput
                onGenerate={reverse.generate}
                disabled={reverse.phase === 'working'}
                shake={shake}
              />
            )}

            {appMode === 'curriculum' && (
              <CurriculumInput
                onGenerate={curriculum.generate}
                disabled={curriculum.phase === 'harvesting' || curriculum.phase === 'generating'}
              />
            )}

            {appMode === 'dissertation' && (
              <DissertationInput
                onGenerate={dissertation.generate}
                disabled={dissertation.phase === 'harvesting' || dissertation.phase === 'generating'}
              />
            )}

            {appMode === 'drift' && (
              <CanonDriftInput
                onGenerate={drift.generate}
                disabled={drift.phase === 'harvesting' || drift.phase === 'generating'}
              />
            )}

            {appMode === 'consilience' && (
              <ConsilienceInput
                onGenerate={consilience.generate}
                disabled={consilience.phase === 'harvesting' || consilience.phase === 'generating'}
              />
            )}

            {appMode === 'inquiry' && (
              <InquiryInput
                onGenerate={inquiry.generate}
                disabled={inquiry.phase === 'harvesting' || inquiry.phase === 'generating'}
              />
            )}

            {appMode === 'spectrum' && (
              <SpectrumInput
                onGenerateQuestions={spectrum.generateQuestions}
                onSubmitDirect={spectrum.submitDirectQuestion}
                disabled={['listing', 'harvesting', 'generating'].includes(spectrum.phase)}
              />
            )}

            {appMode === 'pulse' && (
              <PulseInput
                onSelect={pulse.select}
                disabled={pulse.phase === 'loading'}
              />
            )}

            {appMode === 'intelligence' && !fieldIntel.currentTopic && (
              <FieldIntelligenceInput
                onGenerate={fieldIntel.generate}
                disabled={false}
              />
            )}

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

            {hasOutput && parsed && gen.phase !== 'complete' && (
              <CanonOutput
                parsed={parsed}
                isStreaming={gen.phase === 'composing' || isRefining}
                getCitation={getCitation}
                getVerification={enrichment.getVerification}
                onExplain={explainer.explain}
                getExplanation={explainer.getExplanation}
              />
            )}

            {hasOutput && parsed && gen.phase === 'complete' && (
              <div className="mt-10">
                <div className="flex border-b border-stone-200 mb-6">
                  <button
                    onClick={() => handleViewToggle('canon')}
                    className={`px-4 py-2.5 text-xs font-mono -mb-px transition-colors ${
                      view === 'canon'
                        ? 'border-b-2 border-stone-900 text-stone-900'
                        : 'border-b-2 border-transparent text-stone-400 hover:text-stone-700'
                    }`}
                  >
                    Canon
                  </button>
                  <button
                    onClick={() => handleViewToggle('reading-order')}
                    className={`px-4 py-2.5 text-xs font-mono -mb-px transition-colors ${
                      view === 'reading-order'
                        ? 'border-b-2 border-stone-900 text-stone-900'
                        : 'border-b-2 border-transparent text-stone-400 hover:text-stone-700'
                    }`}
                  >
                    Reading Order
                  </button>
                </div>
                {view === 'canon' && (
                  <CanonOutput
                    parsed={parsed}
                    isStreaming={false}
                    getCitation={getCitation}
                    getVerification={enrichment.getVerification}
                    onExplain={explainer.explain}
                    getExplanation={explainer.getExplanation}
                    noTopMargin
                  />
                )}
                {view === 'reading-order' && (
                  <ReadingOrderView
                    content={readingOrder.content}
                    isStreaming={readingOrder.status === 'loading'}
                  />
                )}
              </div>
            )}

            {/* Reverse mode output */}
            {appMode === 'reverse' && reverse.phase === 'working' && (
              <div className="mt-8 border border-stone-200 bg-white px-6 py-5">
                <div className="flex items-center gap-2.5">
                  <span className="flex gap-0.5">
                    <span className="loading-dot" />
                    <span className="loading-dot" />
                    <span className="loading-dot" />
                  </span>
                  <span className="text-sm text-stone-500">Mapping prerequisite path from scratch...</span>
                </div>
              </div>
            )}

            {appMode === 'reverse' && reverse.phase === 'error' && (
              <div className="mt-8 p-5 bg-red-50 border border-red-200">
                <p className="font-medium text-red-900 text-sm">Failed</p>
                <p className="text-sm text-red-700 mt-1">{reverse.error}</p>
              </div>
            )}

            {appMode === 'reverse' && (reverse.phase === 'working' || reverse.phase === 'complete') && reverse.parsed && (
              <PrerequisiteView
                parsed={reverse.parsed}
                isStreaming={reverse.phase === 'working'}
              />
            )}

            {appMode === 'reverse' && reverse.phase === 'complete' && (
              <div className="mt-8 pt-6 border-t border-stone-200 flex gap-2">
                <button
                  onClick={() => navigator.clipboard.writeText(reverse.content)}
                  className="px-4 py-2 text-sm border border-stone-300 text-stone-700 hover:bg-stone-50 transition-colors"
                >
                  Copy Text
                </button>
                <button
                  onClick={reverse.reset}
                  className="px-4 py-2 text-sm bg-stone-900 text-white hover:bg-stone-700 transition-colors"
                >
                  New Search
                </button>
              </div>
            )}

            {/* Curriculum mode */}
            {appMode === 'curriculum' && curriculum.phase === 'harvesting' && (
              <div className="mt-8 border border-stone-200 bg-white px-6 py-5">
                <div className="flex items-center gap-2.5">
                  <span className="flex gap-0.5">
                    <span className="loading-dot" />
                    <span className="loading-dot" />
                    <span className="loading-dot" />
                  </span>
                  <span className="text-sm text-stone-500">Querying Open Syllabus + Semantic Scholar — gathering textbooks and seminal papers...</span>
                </div>
              </div>
            )}

            {appMode === 'curriculum' && curriculum.phase === 'generating' && (
              <div className="mt-8 border border-stone-200 bg-white px-6 py-5">
                <div className="flex items-center gap-2.5">
                  <span className="flex gap-0.5">
                    <span className="loading-dot" />
                    <span className="loading-dot" />
                    <span className="loading-dot" />
                  </span>
                  <span className="text-sm text-stone-500">
                    Building curriculum from {curriculum.ospWorks.length} syllabus works + {curriculum.seminalWorks.length} seminal papers...
                  </span>
                </div>
              </div>
            )}

            {appMode === 'curriculum' && curriculum.phase === 'error' && (
              <div className="mt-8 p-5 bg-red-50 border border-red-200">
                <p className="font-medium text-red-900 text-sm">Failed</p>
                <p className="text-sm text-red-700 mt-1">{curriculum.error}</p>
              </div>
            )}

            {appMode === 'curriculum' && (curriculum.phase === 'generating' || curriculum.phase === 'complete') && curriculum.parsed && (
              <CurriculumView
                parsed={curriculum.parsed}
                isStreaming={curriculum.phase === 'generating'}
                ospCount={curriculum.ospWorks.length}
                seminalCount={curriculum.seminalWorks.length}
              />
            )}

            {appMode === 'curriculum' && curriculum.phase === 'complete' && curriculum.parsed
              && !curriculum.parsed.topic && curriculum.parsed.courses.length === 0
              && curriculum.content && (
              <div className="mt-8">
                <p className="text-xs font-mono text-stone-400 mb-3">Raw Output (parse failed — check format)</p>
                <pre className="text-xs text-stone-600 whitespace-pre-wrap leading-relaxed border border-stone-200 p-4 bg-stone-50 max-h-96 overflow-y-auto">{curriculum.content}</pre>
              </div>
            )}

            {appMode === 'curriculum' && curriculum.phase === 'complete' && (
              <div className="mt-8 pt-6 border-t border-stone-200 flex gap-2">
                <button
                  onClick={() => navigator.clipboard.writeText(curriculum.content)}
                  className="px-4 py-2 text-sm border border-stone-300 text-stone-700 hover:bg-stone-50 transition-colors"
                >
                  Copy Text
                </button>
                <button
                  onClick={curriculum.reset}
                  className="px-4 py-2 text-sm bg-stone-900 text-white hover:bg-stone-700 transition-colors"
                >
                  New Curriculum
                </button>
              </div>
            )}

            {/* Dissertation mode */}
            {appMode === 'dissertation' && dissertation.phase === 'harvesting' && (
              <div className="mt-8 border border-stone-200 bg-white px-6 py-5">
                <div className="flex items-center gap-2.5">
                  <span className="flex gap-0.5">
                    <span className="loading-dot" /><span className="loading-dot" /><span className="loading-dot" />
                  </span>
                  <span className="text-sm text-stone-500">Gathering qualifying exam literature...</span>
                </div>
              </div>
            )}
            {appMode === 'dissertation' && dissertation.phase === 'generating' && (
              <div className="mt-8 border border-stone-200 bg-white px-6 py-5">
                <div className="flex items-center gap-2.5">
                  <span className="flex gap-0.5">
                    <span className="loading-dot" /><span className="loading-dot" /><span className="loading-dot" />
                  </span>
                  <span className="text-sm text-stone-500">Building reading list from {dissertation.dataCount} works...</span>
                </div>
              </div>
            )}
            {appMode === 'dissertation' && dissertation.phase === 'error' && (
              <div className="mt-8 p-5 bg-red-50 border border-red-200">
                <p className="font-medium text-red-900 text-sm">Failed</p>
                <p className="text-sm text-red-700 mt-1">{dissertation.error}</p>
              </div>
            )}
            {appMode === 'dissertation' && (dissertation.phase === 'generating' || dissertation.phase === 'complete') && dissertation.parsed && (
              <DissertationView parsed={dissertation.parsed} isStreaming={dissertation.phase === 'generating'} />
            )}
            {appMode === 'dissertation' && dissertation.phase === 'complete' && (
              <div className="mt-8 pt-6 border-t border-stone-200 flex gap-2">
                <button
                  onClick={() => navigator.clipboard.writeText(dissertation.content)}
                  className="px-4 py-2 text-sm border border-stone-300 text-stone-700 hover:bg-stone-50 transition-colors"
                >
                  Copy Text
                </button>
                <button
                  onClick={dissertation.reset}
                  className="px-4 py-2 text-sm bg-stone-900 text-white hover:bg-stone-700 transition-colors"
                >
                  New Reading List
                </button>
              </div>
            )}

            {/* Canon Drift mode */}
            {appMode === 'drift' && drift.phase === 'harvesting' && (
              <div className="mt-8 border border-stone-200 bg-white px-6 py-5">
                <div className="flex items-center gap-2.5">
                  <span className="flex gap-0.5">
                    <span className="loading-dot" /><span className="loading-dot" /><span className="loading-dot" />
                  </span>
                  <span className="text-sm text-stone-500">Harvesting historical and current citation data...</span>
                </div>
              </div>
            )}
            {appMode === 'drift' && drift.phase === 'generating' && (
              <div className="mt-8 border border-stone-200 bg-white px-6 py-5">
                <div className="flex items-center gap-2.5">
                  <span className="flex gap-0.5">
                    <span className="loading-dot" /><span className="loading-dot" /><span className="loading-dot" />
                  </span>
                  <span className="text-sm text-stone-500">Tracing canon drift from {drift.totalWorks} works across eras...</span>
                </div>
              </div>
            )}
            {appMode === 'drift' && drift.phase === 'error' && (
              <div className="mt-8 p-5 bg-red-50 border border-red-200">
                <p className="font-medium text-red-900 text-sm">Failed</p>
                <p className="text-sm text-red-700 mt-1">{drift.error}</p>
              </div>
            )}
            {appMode === 'drift' && (drift.phase === 'generating' || drift.phase === 'complete') && drift.parsed && (
              <CanonDriftView parsed={drift.parsed} isStreaming={drift.phase === 'generating'} />
            )}
            {appMode === 'drift' && drift.phase === 'complete' && (
              <div className="mt-8 pt-6 border-t border-stone-200 flex gap-2">
                <button
                  onClick={() => navigator.clipboard.writeText(drift.content)}
                  className="px-4 py-2 text-sm border border-stone-300 text-stone-700 hover:bg-stone-50 transition-colors"
                >
                  Copy Text
                </button>
                <button
                  onClick={drift.reset}
                  className="px-4 py-2 text-sm bg-stone-900 text-white hover:bg-stone-700 transition-colors"
                >
                  New Drift
                </button>
              </div>
            )}

            {/* Consilience mode */}
            {appMode === 'consilience' && consilience.phase === 'harvesting' && (
              <div className="mt-8 border border-stone-200 bg-white px-6 py-5">
                <div className="flex items-center gap-2.5">
                  <span className="flex gap-0.5">
                    <span className="loading-dot" /><span className="loading-dot" /><span className="loading-dot" />
                  </span>
                  <span className="text-sm text-stone-500">Gathering literature across disciplines...</span>
                </div>
              </div>
            )}
            {appMode === 'consilience' && consilience.phase === 'generating' && (
              <div className="mt-8 border border-stone-200 bg-white px-6 py-5">
                <div className="flex items-center gap-2.5">
                  <span className="flex gap-0.5">
                    <span className="loading-dot" /><span className="loading-dot" /><span className="loading-dot" />
                  </span>
                  <span className="text-sm text-stone-500">Synthesizing {consilience.dataCount} works across disciplines...</span>
                </div>
              </div>
            )}
            {appMode === 'consilience' && consilience.phase === 'error' && (
              <div className="mt-8 p-5 bg-red-50 border border-red-200">
                <p className="font-medium text-red-900 text-sm">Failed</p>
                <p className="text-sm text-red-700 mt-1">{consilience.error}</p>
              </div>
            )}
            {appMode === 'consilience' && (consilience.phase === 'generating' || consilience.phase === 'complete') && consilience.parsed && (
              <ConsilienceView parsed={consilience.parsed} isStreaming={consilience.phase === 'generating'} />
            )}
            {appMode === 'consilience' && consilience.phase === 'complete' && (
              <div className="mt-8 pt-6 border-t border-stone-200 flex gap-2">
                <button
                  onClick={() => navigator.clipboard.writeText(consilience.content)}
                  className="px-4 py-2 text-sm border border-stone-300 text-stone-700 hover:bg-stone-50 transition-colors"
                >
                  Copy Text
                </button>
                <button
                  onClick={consilience.reset}
                  className="px-4 py-2 text-sm bg-stone-900 text-white hover:bg-stone-700 transition-colors"
                >
                  New Question
                </button>
              </div>
            )}

            {/* Inquiry mode */}
            {appMode === 'inquiry' && inquiry.phase === 'harvesting' && (
              <div className="mt-8 border border-stone-200 bg-white px-6 py-5">
                <div className="flex items-center gap-2.5">
                  <span className="flex gap-0.5">
                    <span className="loading-dot" /><span className="loading-dot" /><span className="loading-dot" />
                  </span>
                  <span className="text-sm text-stone-500">Gathering frontier research papers...</span>
                </div>
              </div>
            )}
            {appMode === 'inquiry' && inquiry.phase === 'generating' && (
              <div className="mt-8 border border-stone-200 bg-white px-6 py-5">
                <div className="flex items-center gap-2.5">
                  <span className="flex gap-0.5">
                    <span className="loading-dot" /><span className="loading-dot" /><span className="loading-dot" />
                  </span>
                  <span className="text-sm text-stone-500">Mapping open questions from {inquiry.paperCount} papers...</span>
                </div>
              </div>
            )}
            {appMode === 'inquiry' && inquiry.phase === 'error' && (
              <div className="mt-8 p-5 bg-red-50 border border-red-200">
                <p className="font-medium text-red-900 text-sm">Failed</p>
                <p className="text-sm text-red-700 mt-1">{inquiry.error}</p>
              </div>
            )}
            {appMode === 'inquiry' && (inquiry.phase === 'generating' || inquiry.phase === 'complete') && inquiry.parsed && (
              <InquiryView parsed={inquiry.parsed} isStreaming={inquiry.phase === 'generating'} />
            )}
            {appMode === 'inquiry' && inquiry.phase === 'complete' && (
              <div className="mt-8 pt-6 border-t border-stone-200 flex gap-2">
                <button
                  onClick={() => navigator.clipboard.writeText(inquiry.content)}
                  className="px-4 py-2 text-sm border border-stone-300 text-stone-700 hover:bg-stone-50 transition-colors"
                >
                  Copy Text
                </button>
                <button
                  onClick={inquiry.reset}
                  className="px-4 py-2 text-sm bg-stone-900 text-white hover:bg-stone-700 transition-colors"
                >
                  New Inquiry
                </button>
              </div>
            )}

            {/* Spectrum mode */}
            {appMode === 'spectrum' && spectrum.phase === 'listing' && (
              <div className="mt-8 border border-stone-200 bg-white px-6 py-5">
                <div className="flex items-center gap-2.5">
                  <span className="flex gap-0.5">
                    <span className="loading-dot" /><span className="loading-dot" /><span className="loading-dot" />
                  </span>
                  <span className="text-sm text-stone-500">Finding questions that genuinely span disciplines...</span>
                </div>
              </div>
            )}
            {appMode === 'spectrum' && spectrum.phase === 'listed' && (
              <SpectrumQuestionsView
                listParsed={spectrum.listParsed}
                isStreaming={false}
                onSelect={spectrum.selectQuestion}
              />
            )}
            {appMode === 'spectrum' && spectrum.phase === 'harvesting' && (
              <div className="mt-8 border border-stone-200 bg-white px-6 py-5">
                <div className="flex items-center gap-2.5">
                  <span className="flex gap-0.5">
                    <span className="loading-dot" /><span className="loading-dot" /><span className="loading-dot" />
                  </span>
                  <span className="text-sm text-stone-500">Gathering literature across disciplines...</span>
                </div>
              </div>
            )}
            {appMode === 'spectrum' && spectrum.phase === 'generating' && (
              <div className="mt-8 border border-stone-200 bg-white px-6 py-5">
                <div className="flex items-center gap-2.5">
                  <span className="flex gap-0.5">
                    <span className="loading-dot" /><span className="loading-dot" /><span className="loading-dot" />
                  </span>
                  <span className="text-sm text-stone-500">Building the answer from {spectrum.dataCount} works...</span>
                </div>
              </div>
            )}
            {appMode === 'spectrum' && spectrum.phase === 'error' && (
              <div className="mt-8 p-5 bg-red-50 border border-red-200">
                <p className="font-medium text-red-900 text-sm">Failed</p>
                <p className="text-sm text-red-700 mt-1">{spectrum.error}</p>
              </div>
            )}
            {appMode === 'spectrum' && (spectrum.phase === 'generating' || spectrum.phase === 'complete') && spectrum.parsed && (
              <SpectrumView parsed={spectrum.parsed} readingListText={spectrum.readingListText} answerParagraphs={spectrum.answerParagraphs} isStreaming={spectrum.phase === 'generating'} />
            )}
            {appMode === 'spectrum' && spectrum.phase === 'complete' && (
              <div className="mt-8 pt-6 border-t border-stone-200 flex gap-2">
                <button
                  onClick={() => navigator.clipboard.writeText(spectrum.content)}
                  className="px-4 py-2 text-sm border border-stone-300 text-stone-700 hover:bg-stone-50 transition-colors"
                >
                  Copy Text
                </button>
                <button
                  onClick={spectrum.reset}
                  className="px-4 py-2 text-sm bg-stone-900 text-white hover:bg-stone-700 transition-colors"
                >
                  New Question
                </button>
              </div>
            )}

            {/* Pulse mode */}
            {appMode === 'pulse' && pulse.phase === 'loading' && (
              <div className="mt-8 border border-stone-200 bg-white px-6 py-5">
                <div className="flex items-center gap-2.5">
                  <span className="flex gap-0.5">
                    <span className="loading-dot" /><span className="loading-dot" /><span className="loading-dot" />
                  </span>
                  <span className="text-sm text-stone-500">Fetching live data...</span>
                </div>
              </div>
            )}
            {appMode === 'pulse' && pulse.phase === 'error' && (
              <div className="mt-8 p-5 bg-red-50 border border-red-200">
                <p className="font-medium text-red-900 text-sm">Failed</p>
                <p className="text-sm text-red-700 mt-1">{pulse.error}</p>
              </div>
            )}
            {appMode === 'pulse' && pulse.phase === 'complete' && (
              <PulseView
                topicName={pulse.topicName}
                isTextMatch={pulse.isTextMatch}
                wasClaudeValidated={pulse.wasClaudeValidated}
                mostCited={pulse.mostCited}
                topAuthors={pulse.topAuthors}
                mostInfluential={pulse.mostInfluential}
                scholar={pulse.scholar}
                scholarLoading={pulse.scholarLoading}
                scholarFailed={pulse.scholarFailed}
                onScholarKeySaved={pulse.refreshScholar}
                readingStageGroups={pulse.readingStageGroups}
                readingStagesLoading={pulse.readingStagesLoading}
                readingStagesFailed={pulse.readingStagesFailed}
                onLoadReadingStages={pulse.loadReadingStages}
              />
            )}
            {appMode === 'pulse' && pulse.phase === 'complete' && (
              <div className="mt-8 pt-6 border-t border-stone-200 flex gap-2">
                <button
                  onClick={pulse.reset}
                  className="px-4 py-2 text-sm bg-stone-900 text-white hover:bg-stone-700 transition-colors"
                >
                  New Topic
                </button>
              </div>
            )}

            {/* Field Intelligence mode */}
            {appMode === 'intelligence' && fieldIntel.landscapePhase === 'error' && (
              <div className="mt-8 p-5 bg-red-50 border border-red-200">
                <p className="font-medium text-red-900 text-sm">Failed</p>
                <p className="text-sm text-red-700 mt-1">{fieldIntel.error}</p>
              </div>
            )}
            {appMode === 'intelligence' && !!fieldIntel.currentTopic && (
              <FieldIntelligenceView
                landscapePhase={fieldIntel.landscapePhase}
                auditPhase={fieldIntel.auditPhase}
                bibPhase={fieldIntel.bibPhase}
                thinkersPhase={fieldIntel.thinkersPhase}
                parsedLandscape={fieldIntel.parsedLandscape}
                parsedAudit={fieldIntel.parsedAudit}
                parsedBib={fieldIntel.parsedBib}
                parsedThinkers={fieldIntel.parsedThinkers}
                dataCount={fieldIntel.dataCount}
                currentTopic={fieldIntel.currentTopic}
                landscapeContent={fieldIntel.landscapeContent}
                auditContent={fieldIntel.auditContent}
                bibContent={fieldIntel.bibContent}
                thinkersContent={fieldIntel.thinkersContent}
                onGenerateLandscape={fieldIntel.generateLandscape}
                onGenerateAudit={fieldIntel.generateAudit}
                onGenerateBib={fieldIntel.generateBib}
                onGenerateThinkers={fieldIntel.generateThinkers}
                onReset={fieldIntel.reset}
              />
            )}


            {/* Concept Map */}
            {appMode === 'concepts' && <ConceptTiersView onGenerate={handleConceptGenerate} />}

            {/* Doctoral Topics */}
            {appMode === 'doctoral' && (
              <DoctoralTopicsView
                status={doctoral.status}
                subjects={doctoral.subjects}
                topicsBySubject={doctoral.topicsBySubject}
                totalTopics={doctoral.totalTopics}
                error={doctoral.error}
                lastChecked={doctoral.lastChecked}
                updateCount={doctoral.updateCount}
                onLoad={doctoral.load}
                onCheckForUpdates={doctoral.checkForUpdates}
                onSelectTopic={handleDoctoralTopicClick}
              />
            )}

            {/* UDC */}
            {appMode === 'udc' && (
              <UDCView onGenerate={handleDoctoralTopicClick} />
            )}

            {/* Overall Aggregator */}
            {appMode === 'overall' && aggregator.overallPhase === 'idle' && (
              <OverallAggregatorInput
                onRun={aggregator.run}
                disabled={false}
              />
            )}
            {appMode === 'overall' && aggregator.overallPhase !== 'idle' && (
              <OverallAggregatorView
                question={aggregator.question}
                overallPhase={aggregator.overallPhase}
                dataCount={aggregator.dataCount}
                error={aggregator.error}
                sections={aggregator.sections}
                completedCount={aggregator.completedCount}
                generatingCount={aggregator.generatingCount}
                harvestedPapers={aggregator.harvestedPapers}
                harvestedTextbooks={aggregator.harvestedTextbooks}
                onReset={aggregator.reset}
              />
            )}

            {/* Academia.edu Topics */}
            {appMode === 'academia' && (
              <AcademiaTopicsView
                status={academia.status}
                disciplines={academia.disciplines}
                children={academia.children}
                slugs={academia.slugs}
                total={academia.total}
                crawlDate={academia.crawlDate}
                error={academia.error}
                onLoad={academia.load}
                onSelectTopic={handleDoctoralTopicClick}
                onCheckForUpdates={academia.checkForUpdates}
                scanStatus={academia.scanStatus}
                newTopics={academia.newTopics}
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
                onRefine={v => { readingOrder.clear(); setView('canon'); gen.refineCanon(v); }}
                refinements={gen.refinements}
                disabled={false}
              />
            )}
          </div>
        </div>
      </div>

      {/* Sidebar pinned to the true right edge of the viewport, independent of the centered content column */}
      <div className="hidden lg:block fixed top-0 right-0 h-screen w-80 overflow-y-auto border-l border-stone-200 px-6 py-12" style={{ background: '#FAFAF9' }}>
        <Sidebar
          history={hist.history}
          onLoad={handleLoad}
          onDelete={hist.deleteCanon}
          onClearAll={hist.clearAll}
          activeCanonTopic={gen.topic}
          onClickTopLevel={handleClickTopLevel}
          onClickSubfield={handleClickSubfield}
          onClickSubSubfield={handleClickSubSubfield}
          isFieldExpanded={fieldNav.isFieldExpanded}
          isSubfieldExpanded={fieldNav.isSubfieldExpanded}
          getSubfields={fieldNav.getSubfields}
          getSubSubfields={fieldNav.getSubSubfields}
          getFieldUrl={fieldNav.getFieldUrl}
          getSubfieldUrl={fieldNav.getSubfieldUrl}
          getTopicUrl={fieldNav.getTopicUrl}
          fieldNames={fieldNav.fieldNames}
          taxonomyLoading={fieldNav.taxonomyLoading}
          topicCount={fieldNav.topicCount}
          onSelectConcept={handleSelectTopic}
          disabled={isGenerating || isRefining}
        />
      </div>

      <button
        onClick={() => setMobileSidebarOpen(true)}
        className="lg:hidden fixed bottom-6 right-6 bg-stone-900 text-white text-xs px-4 py-2.5 shadow-lg font-mono uppercase tracking-wider"
      >
        {`Fields${hist.history.length > 0 ? ` · ${hist.history.length} saved` : ''}`}
      </button>

      {mobileSidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileSidebarOpen(false)} />
          <div className="relative bg-white max-h-[70vh] overflow-y-auto p-6 shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <span className="text-xs font-mono text-stone-500">
                Fields & Saved
              </span>
              <button onClick={() => setMobileSidebarOpen(false)} className="text-stone-400 hover:text-stone-700">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
                </svg>
              </button>
            </div>
            <Sidebar
              history={hist.history}
              onLoad={handleLoad}
              onDelete={hist.deleteCanon}
              onClearAll={hist.clearAll}
              activeCanonTopic={gen.topic}
              onClickTopLevel={handleClickTopLevel}
              onClickSubfield={handleClickSubfield}
              onClickSubSubfield={handleClickSubSubfield}
              isFieldExpanded={fieldNav.isFieldExpanded}
              isSubfieldExpanded={fieldNav.isSubfieldExpanded}
              getSubfields={fieldNav.getSubfields}
              getSubSubfields={fieldNav.getSubSubfields}
              getFieldUrl={fieldNav.getFieldUrl}
              getSubfieldUrl={fieldNav.getSubfieldUrl}
              getTopicUrl={fieldNav.getTopicUrl}
              fieldNames={fieldNav.fieldNames}
              disabled={isGenerating || isRefining}
            />
          </div>
        </div>
      )}
    </div>
  );
}
