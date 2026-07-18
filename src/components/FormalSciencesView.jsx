import { useState, useEffect, useRef, useMemo } from 'react';
import ExplainContent from './ExplainContent';
import { resolveAnthropicApiKey, streamExplanation } from '../utils/explainConcept';
import { scholarUrl, googleBooksUrl } from './WorkSourceLink';
import { fetchTopicWorksByText, fetchTopicWorks, resolveOpenAlexTopicId, aggregateTopAuthors, recentCitationVelocity } from '../utils/pulseOpenAlex';
import { filterRelevantByTitle, annotateWorks, classifyConceptLevels, CONCEPT_LEVELS } from '../utils/claudeRelevance';

const BRANCH_COLORS = [
  { bg: 'bg-stone-800',   bar: 'bg-stone-700',   text: 'text-stone-700',   border: 'border-stone-700',   active: 'bg-stone-800 text-white border-stone-800',    hover: 'hover:bg-stone-800 hover:text-white hover:border-stone-800'    },
  { bg: 'bg-sky-700',     bar: 'bg-sky-600',     text: 'text-sky-700',     border: 'border-sky-700',     active: 'bg-sky-700 text-white border-sky-700',        hover: 'hover:bg-sky-700 hover:text-white hover:border-sky-700'        },
  { bg: 'bg-amber-700',   bar: 'bg-amber-600',   text: 'text-amber-700',   border: 'border-amber-700',   active: 'bg-amber-700 text-white border-amber-700',    hover: 'hover:bg-amber-700 hover:text-white hover:border-amber-700'    },
  { bg: 'bg-teal-700',    bar: 'bg-teal-600',    text: 'text-teal-700',    border: 'border-teal-700',    active: 'bg-teal-700 text-white border-teal-700',      hover: 'hover:bg-teal-700 hover:text-white hover:border-teal-700'      },
  { bg: 'bg-rose-700',    bar: 'bg-rose-600',    text: 'text-rose-700',    border: 'border-rose-700',    active: 'bg-rose-700 text-white border-rose-700',      hover: 'hover:bg-rose-700 hover:text-white hover:border-rose-700'      },
  { bg: 'bg-violet-700',  bar: 'bg-violet-600',  text: 'text-violet-700',  border: 'border-violet-700',  active: 'bg-violet-700 text-white border-violet-700',  hover: 'hover:bg-violet-700 hover:text-white hover:border-violet-700'  },
  { bg: 'bg-indigo-700',  bar: 'bg-indigo-600',  text: 'text-indigo-700',  border: 'border-indigo-700',  active: 'bg-indigo-700 text-white border-indigo-700',  hover: 'hover:bg-indigo-700 hover:text-white hover:border-indigo-700'  },
  { bg: 'bg-emerald-700', bar: 'bg-emerald-600', text: 'text-emerald-700', border: 'border-emerald-700', active: 'bg-emerald-700 text-white border-emerald-700',hover: 'hover:bg-emerald-700 hover:text-white hover:border-emerald-700' },
];

const MODES = [
  { key: 'canon',        label: 'Canon',        color: 'text-blue-700    bg-blue-50    hover:bg-blue-100    border-blue-300' },
  { key: 'curriculum',   label: 'Curriculum',   color: 'text-sky-700     bg-sky-50     hover:bg-sky-100     border-sky-300' },
  { key: 'dissertation', label: 'Dissertation', color: 'text-indigo-700  bg-indigo-50  hover:bg-indigo-100  border-indigo-300' },
  { key: 'reverse',      label: 'Prerequisites',color: 'text-violet-700  bg-violet-50  hover:bg-violet-100  border-violet-300' },
  { key: 'drift',        label: 'Canon Drift',  color: 'text-amber-700   bg-amber-50   hover:bg-amber-100   border-amber-300' },
  { key: 'consilience',  label: 'Consilience',  color: 'text-teal-700    bg-teal-50    hover:bg-teal-100    border-teal-300' },
  { key: 'inquiry',      label: 'Inquiry',      color: 'text-rose-700    bg-rose-50    hover:bg-rose-100    border-rose-300' },
  { key: 'spectrum',     label: 'Spectrum',     color: 'text-cyan-700    bg-cyan-50    hover:bg-cyan-100    border-cyan-300' },
  { key: 'intelligence', label: 'Field Intel',  color: 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-300' },
];

// Only branches with a genuine, well-established historical sequence get a
// timeline — forcing one onto e.g. Data Science or Systems Science would be
// fabricated pedagogy, not real history. Each entry matches a real top-level
// node name in that branch's tree (formal-sciences-taxonomy.json).
const TIMELINES = {
  Logic: [
    { era: 'c. 350 BCE–1854', name: 'Historical & Traditional Logic', desc: "Aristotle's syllogisms, medieval terminist logic, and Boole's 1854 algebraization — logic before the 20th-century formal turn.", match: 'Historical & Traditional Logic' },
    { era: '1879–1980', name: 'Formal Systems', desc: "Frege's Begriffsschrift launches classical propositional/predicate logic; Kripke's 1959–63 semantics adds the modal, constructive, many-valued, substructural, and paraconsistent families.", match: 'Formal Systems' },
    { era: '1920s–present', name: 'Metalogic', desc: 'Proof theory (Gentzen), model theory, computability (Turing), and set theory (Zermelo, Cohen) — logic studying its own formal systems.', match: 'Metalogic' },
    { era: '1936–present', name: 'Algebraic & Categorical Logic', desc: "Stone's representation theorem, then topos theory, recast logical systems as algebraic/categorical structures.", match: 'Algebraic & Categorical Logic' },
    { era: '1934–present', name: 'Type Theory', desc: "Church's lambda calculus through Martin-Löf and homotopy type theory — proofs as programs.", match: 'Type Theory' },
    { era: '1970s–present', name: 'Defeasible & Uncertain Reasoning', desc: 'Non-monotonic logic, default reasoning, and belief revision, developed largely within AI research.', match: 'Defeasible & Uncertain Reasoning' },
    { era: 'Antiquity–present', name: 'Philosophical Logic', desc: 'Theories of truth, the liar paradox, and logical consequence — questions logic has carried since before it was formalized.', match: 'Philosophical Logic' },
    { era: '1970s–present', name: 'Applied & Interface Logics', desc: 'Montague grammar and logic programming — logic put to work in linguistics and computer science.', match: 'Applied & Interface Logics' },
  ],
  Mathematics: [
    { era: 'Antiquity–present', name: 'Foundations', desc: "From Euclid's axiomatic method to Zermelo's set theory and Gödel's incompleteness theorems — what math's own rules are.", match: 'Foundations' },
    { era: '820–present', name: 'Algebra', desc: "Al-Khwarizmi's algebra, Galois's group theory, and modern homological/categorical algebra.", match: 'Algebra' },
    { era: '1665–present', name: 'Analysis', desc: "Newton and Leibniz's calculus, made fully rigorous by Cauchy and Weierstrass in the 19th century.", match: 'Analysis' },
    { era: 'c. 300 BCE–present', name: 'Geometry & Topology', desc: "Euclid's Elements through Riemann's differential geometry and 20th-century algebraic topology.", match: 'Geometry & Topology' },
    { era: 'Antiquity–present', name: 'Number Theory', desc: "From Euclid's primes to Wiles's 1994 proof of Fermat's Last Theorem via elliptic curves.", match: 'Number Theory' },
    { era: '1666–present', name: 'Discrete Mathematics & Combinatorics', desc: "Leibniz's early combinatorics through modern graph theory and Ramsey theory.", match: 'Discrete Mathematics & Combinatorics' },
    { era: '1654–present', name: 'Probability (mathematical)', desc: "Pascal and Fermat's correspondence on games of chance, formalized by Kolmogorov's 1933 axioms.", match: 'Probability (mathematical)' },
    { era: '20th century–present', name: 'Applied Mathematics', desc: 'Mathematical physics, optimization, and control theory — mathematics built for other sciences.', match: 'Applied Mathematics' },
  ],
};

function wikipediaUrl(query) {
  return `https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(query)}&title=Special:Search`;
}
function openAlexSearchUrl(query) {
  return `https://openalex.org/works?search=${encodeURIComponent(query)}`;
}
function nodeDomId(branchName, nodeName) {
  return `nd-${branchName}-${nodeName}`.replace(/[^a-zA-Z0-9-]/g, '_');
}
function isBookType(type) {
  return type === 'book' || type === 'monograph' || type === 'book-chapter' || type === 'edited-book' || type === 'dissertation';
}

function LoadingDots() {
  return (
    <span className="flex gap-0.5">
      <span className="loading-dot"/><span className="loading-dot"/><span className="loading-dot"/>
    </span>
  );
}

// A work counts as "rising" when a large share of its lifetime citations landed
// in the last 2 years — catches recently-accelerating works that a flat
// total-citations sort buries under older, larger-but-cooling classics.
function isRising(work) {
  if (!work.citationCount || work.citationCount < 10) return false;
  const velocity = recentCitationVelocity(work);
  return velocity / work.citationCount >= 0.3;
}

// Shared "feature button" look — every clickable action gets a real pill with
// a background and border, not muted grey text, so the page's affordances
// read at a glance instead of blending into metadata.
const PILL_BASE = 'inline-flex items-center gap-1 text-xs font-mono font-semibold px-2 py-1 border rounded-sm transition-colors';
const PILL_SCHOLAR = `${PILL_BASE} text-sky-700 bg-sky-50 border-sky-300 hover:bg-sky-100`;
const PILL_OPENALEX = `${PILL_BASE} text-violet-700 bg-violet-50 border-violet-300 hover:bg-violet-100`;
const PILL_WIKI = `${PILL_BASE} text-stone-700 bg-stone-100 border-stone-300 hover:bg-stone-200`;
const PILL_DOI = `${PILL_BASE} text-stone-600 bg-white border-stone-300 hover:bg-stone-50`;
const PILL_OA = `${PILL_BASE} text-emerald-700 bg-emerald-50 border-emerald-300 hover:bg-emerald-100`;

function WorksList({ works, status, error, wasFiltered, matchType }) {
  const researchers = useMemo(() => (works ? aggregateTopAuthors(works).slice(0, 10) : []), [works]);

  if (status === 'loading') {
    return <div className="flex items-center gap-2 py-3 text-base text-stone-500"><LoadingDots /> Fetching cited works from OpenAlex…</div>;
  }
  if (status === 'error') {
    return <div className="text-base text-red-600 py-3">{error || 'Failed to fetch works.'}</div>;
  }
  if (!works || works.length === 0) {
    return <div className="text-base text-stone-400 py-3">No OpenAlex works indexed under this exact phrase or a matching topic — genuinely thin coverage, not a broken search.</div>;
  }
  return (
    <div>
      {matchType === 'topic' && (
        <div className="text-xs font-mono text-emerald-600 mb-3">Matched to a real OpenAlex topic — precise, not text-search-derived.</div>
      )}
      {wasFiltered && (
        <div className="text-xs font-mono text-stone-400 mb-3">
          Claude-checked for relevance — OpenAlex's own text match runs loose on niche topic names.
          {works.length < 3 && ' Thin result: this is likely a classic/foundational topic whose canonical works predate strong citation indexing, or don’t use this exact phrase as a title match — not a broken search.'}
          {' '}"Why"/"Focus" notes below are Claude's inference from title/author/year, not verified page numbers.
        </div>
      )}
      <div className="space-y-4">
        {works.map((w, i) => {
          const book = isBookType(w.type);
          return (
            <div key={i} className="border-b border-stone-100 pb-4 last:border-0">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-xs font-mono font-bold text-stone-500 flex-shrink-0">{(w.citationCount || 0).toLocaleString()}×</span>
                {isRising(w) && (
                  <span className="text-xs font-mono font-bold text-orange-600 flex-shrink-0" title="30%+ of lifetime citations in the last 2 years">
                    ↗ RISING
                  </span>
                )}
                <span className="text-base text-stone-800 font-semibold">{w.title}</span>
              </div>
              <div className="text-sm text-stone-500 mt-0.5">
                {w.authors}{w.authors && w.year ? ' · ' : ''}{w.year}
              </div>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                <a href={scholarUrl(w.title)} target="_blank" rel="noreferrer" className={PILL_SCHOLAR}>
                  Scholar
                </a>
                {book && (
                  <a href={googleBooksUrl(w.title)} target="_blank" rel="noreferrer" className={PILL_OPENALEX}>
                    Books
                  </a>
                )}
                {w.doi && (
                  <a href={`https://doi.org/${w.doi.replace(/^https?:\/\/doi\.org\//, '')}`} target="_blank" rel="noreferrer" className={PILL_DOI}>
                    DOI
                  </a>
                )}
                {w.isOA && w.oaUrl && (
                  <a href={w.oaUrl} target="_blank" rel="noreferrer" className={PILL_OA}>
                    Open Access ↗
                  </a>
                )}
              </div>
              {w.annotation && (w.annotation.relevance || w.annotation.focus) && (
                <div className="mt-2 pl-3 border-l-4 border-amber-300 bg-amber-50 py-1.5 text-sm text-stone-600 leading-snug space-y-1">
                  {w.annotation.relevance && <div><span className="text-amber-700 font-mono text-xs font-bold uppercase mr-1.5">Why</span>{w.annotation.relevance}</div>}
                  {w.annotation.focus && <div><span className="text-amber-700 font-mono text-xs font-bold uppercase mr-1.5">Focus</span>{w.annotation.focus}</div>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {researchers.length > 0 && (
        <div className="mt-5 pt-4 border-t border-stone-200">
          <div className="text-xs font-mono font-bold uppercase tracking-widest text-stone-400 mb-2">Most Cited Researchers</div>
          <div className="space-y-1.5">
            {researchers.map((r, i) => (
              <div key={r.id || i} className="flex items-baseline justify-between text-sm">
                <span className="text-stone-700 font-medium">{r.name}</span>
                <span className="font-mono font-bold text-stone-500">{r.citationCount.toLocaleString()}×</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Each leaf card owns its own open/closed state and its own Explain/Works
// fetches — several cards can be open across a branch at once, each
// independently loading, instead of one global "selected topic" side panel.
function ConceptCard({ topic, breadcrumb, colors, sharedElsewhere, crossBranches, onJumpToBranch, onGenerate }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('explain'); // 'explain' | 'works'
  const [explainer, setExplainer] = useState({ text: '', status: 'idle' });
  const [works, setWorks] = useState({ status: 'idle', items: [], error: '', wasFiltered: false, matchType: '' });
  const explAbortRef = useRef(null);
  const worksAbortRef = useRef(null);

  async function loadExplain() {
    const apiKey = resolveAnthropicApiKey();
    if (!apiKey) { setExplainer({ text: 'No Anthropic API key set — add one in Settings to generate an explanation.', status: 'error' }); return; }
    explAbortRef.current?.abort();
    explAbortRef.current = new AbortController();
    setExplainer({ text: '', status: 'loading' });
    try {
      await streamExplanation(topic, apiKey, explAbortRef.current.signal, text => setExplainer({ text, status: 'loading' }));
      setExplainer(prev => ({ ...prev, status: 'done' }));
    } catch (e) {
      if (e.name !== 'AbortError') setExplainer({ text: '', status: 'error' });
    }
  }

  async function loadWorks() {
    worksAbortRef.current?.abort();
    const ctrl = new AbortController();
    worksAbortRef.current = ctrl;
    setWorks({ status: 'loading', items: [], error: '', wasFiltered: false, matchType: '' });

    async function annotateInBackground(items) {
      if (!items.length) return;
      const annotations = await annotateWorks(topic, items.map(w => ({ title: w.title, authors: w.authors, year: w.year })));
      if (ctrl.signal.aborted) return;
      setWorks(prev => ({ ...prev, items: prev.items.map((w, i) => ({ ...w, annotation: annotations[i] })) }));
    }

    try {
      // 1. Try resolving to a real OpenAlex Topic first (same Jaccard-match
      // Pulse mode uses for Claude-suggested topics) — an exact topics.id
      // filter is precise on its own, no free-text noise, no Claude filtering
      // needed. This is what actually fixes "no works" for short/generic
      // concept names ("Truth-functional connectives") that don't read as a
      // real paper-title phrase but do match a real OpenAlex topic.
      const topicId = await resolveOpenAlexTopicId(topic);
      if (ctrl.signal.aborted) return;
      if (topicId) {
        const items = await fetchTopicWorks(topicId, 15);
        if (ctrl.signal.aborted) return;
        if (items.length > 0) {
          setWorks({ status: 'done', items, error: '', wasFiltered: false, matchType: 'topic' });
          annotateInBackground(items);
          return;
        }
      }

      // 2. Fall back to boolean-AND text search + Claude relevance filter.
      const raw = await fetchTopicWorksByText(topic, 40, null);
      if (ctrl.signal.aborted) return;
      const pass1 = await filterRelevantByTitle(topic, raw.map(w => ({ title: w.title, authors: w.authors, year: w.year, _w: w })));
      if (ctrl.signal.aborted) return;
      let finalItems = pass1.items.map(i => i._w);
      let wasFiltered = pass1.wasFiltered;

      // 3. If Claude rejected every candidate, the topic name alone was too
      // generic/ambiguous for text search ("Hilbert-style systems" alone
      // pulled in SciPy and physics-ML papers — nothing to do with proof
      // theory). Retry once with the immediate parent category appended for
      // disambiguation, e.g. "Hilbert-style systems Proof Theory". Showing
      // confidently-wrong raw results instead (a prior version of this) was
      // worse than an honest empty state, so that fallback was removed —
      // this retry is the real fix, not a fake-it fallback.
      if (finalItems.length === 0 && breadcrumb) {
        const parts = breadcrumb.split(' › ');
        const parent = parts[parts.length - 1];
        if (parent && parent !== topic) {
          const raw2 = await fetchTopicWorksByText(`${topic} ${parent}`, 40, null);
          if (ctrl.signal.aborted) return;
          const pass2 = await filterRelevantByTitle(topic, raw2.map(w => ({ title: w.title, authors: w.authors, year: w.year, _w: w })));
          if (ctrl.signal.aborted) return;
          finalItems = pass2.items.map(i => i._w);
          wasFiltered = pass2.wasFiltered;
        }
      }

      setWorks({ status: 'done', items: finalItems, error: '', wasFiltered, matchType: 'filtered' });
      if (finalItems.length) annotateInBackground(finalItems);
    } catch (err) {
      if (!ctrl.signal.aborted) setWorks({ status: 'error', items: [], error: err.message, wasFiltered: false });
    }
  }

  function toggleOpen() {
    const next = !open;
    setOpen(next);
    if (next && explainer.status === 'idle') loadExplain();
  }

  function switchTab(t) {
    setTab(t);
    if (t === 'works' && works.status === 'idle') loadWorks();
  }

  function handleModeClick(key) {
    if (onGenerate) onGenerate(topic, key);
  }

  return (
    <div className={`border-2 ${open ? colors.border : 'border-stone-200'} bg-white transition-colors`}>
      <button
        onClick={toggleOpen}
        aria-label={sharedElsewhere ? `${topic} — also appears in another branch` : topic}
        title={sharedElsewhere ? 'Also appears in another branch' : undefined}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-stone-50 transition-colors"
      >
        <span className="text-base font-semibold text-stone-800 inline-flex items-center gap-1.5">
          {topic}
          {sharedElsewhere && <span className="text-amber-500 text-lg leading-none" title="Also appears in another branch">⧉</span>}
        </span>
        <span className={`text-sm font-bold ${colors.text} transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>

      {open && (
        <div className="px-3 pb-4">
          <div className="text-xs font-mono text-stone-400 mb-2 truncate">{breadcrumb}</div>
          <div className="flex flex-wrap gap-1.5 mb-3">
            <a href={scholarUrl(topic)} target="_blank" rel="noreferrer" className={PILL_SCHOLAR}>Scholar ↗</a>
            <a href={openAlexSearchUrl(topic)} target="_blank" rel="noreferrer" className={PILL_OPENALEX}>OpenAlex ↗</a>
            <a href={wikipediaUrl(topic)} target="_blank" rel="noreferrer" className={PILL_WIKI}>Wikipedia ↗</a>
          </div>

          <div className="inline-flex gap-0 bg-stone-100 p-1 mb-3 rounded-sm">
            <button
              onClick={() => switchTab('explain')}
              className={`text-xs font-mono font-bold uppercase px-3 py-1.5 rounded-sm transition-colors ${tab === 'explain' ? `${colors.active}` : 'text-stone-500 hover:text-stone-800'}`}
            >
              Explain
            </button>
            <button
              onClick={() => switchTab('works')}
              className={`text-xs font-mono font-bold uppercase px-3 py-1.5 rounded-sm transition-colors ${tab === 'works' ? `${colors.active}` : 'text-stone-500 hover:text-stone-800'}`}
            >
              Works
            </button>
            {((tab === 'explain' && explainer.status === 'loading') || (tab === 'works' && works.status === 'loading')) && (
              <span className="flex items-center px-2"><LoadingDots /></span>
            )}
          </div>

          {tab === 'explain' && (
            explainer.status === 'error' && !explainer.text
              ? <div className="text-base text-red-600">Error generating explanation.</div>
              : explainer.status === 'idle'
                ? <div className="text-base text-stone-400">—</div>
                : <ExplainContent text={explainer.text} />
          )}
          {tab === 'works' && <WorksList works={works.items} status={works.status} error={works.error} wasFiltered={works.wasFiltered} matchType={works.matchType} />}

          {crossBranches.length > 0 && (
            <div className="mt-3 pt-3 border-t border-stone-200">
              <div className="text-xs font-mono font-bold text-amber-600 uppercase mb-1.5">Also in:</div>
              <div className="flex flex-wrap gap-1.5">
                {crossBranches.map((e, i) => (
                  <button
                    key={i}
                    onClick={() => onJumpToBranch(e.branch)}
                    className="text-xs font-mono font-semibold px-2 py-1 border-2 border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:border-amber-400 transition-colors rounded-sm"
                  >
                    {e.branch}
                  </button>
                ))}
              </div>
            </div>
          )}

          {onGenerate && (
            <div className="mt-3 pt-3 border-t border-stone-200">
              <div className="text-xs font-mono font-bold text-stone-500 uppercase mb-1.5">Generate with:</div>
              <div className="flex flex-wrap gap-1.5">
                {MODES.map(m => (
                  <button
                    key={m.key}
                    onClick={() => handleModeClick(m.key)}
                    className={`text-xs font-mono font-bold px-2.5 py-1.5 border-2 transition-colors rounded-sm ${m.color}`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// A group of leaf concepts (a node whose direct children are all leaves) gets
// an opt-in "By Level" toggle that sorts them into Foundational/Intermediate/
// Advanced/Research — mirrors Pulse's Ranked | Reading Order toggle, so it
// never auto-fires a Claude call just from expanding a branch.
function LeafGroup({ node, branchName, path, colors, leafIndex, onJumpToBranch, onGenerate }) {
  const [byLevel, setByLevel] = useState(false);
  const [levels, setLevels] = useState(null);
  const [classifying, setClassifying] = useState(false);
  const topics = node.children.map(c => c.name);

  async function toggleByLevel() {
    if (!byLevel && !levels && !classifying) {
      setClassifying(true);
      const result = await classifyConceptLevels(node.name, topics);
      setLevels(result);
      setClassifying(false);
    }
    setByLevel(v => !v);
  }

  const grouped = useMemo(() => {
    if (!levels) return null;
    const buckets = new Map(CONCEPT_LEVELS.map(l => [l, []]));
    buckets.set('Unclassified', []);
    topics.forEach((t, i) => {
      const lvl = levels[i] && buckets.has(levels[i]) ? levels[i] : 'Unclassified';
      buckets.get(lvl).push(t);
    });
    return buckets;
  }, [levels, topics]);

  function renderCard(topic, key) {
    const occurrences = leafIndex.get(topic) || [];
    const sharedElsewhere = occurrences.length > 1;
    const crossBranches = occurrences.filter(e => e.branch !== branchName || e.path !== path);
    return (
      <ConceptCard
        key={key}
        topic={topic}
        breadcrumb={`${branchName} › ${path}`}
        colors={colors}
        sharedElsewhere={sharedElsewhere}
        crossBranches={crossBranches}
        onJumpToBranch={onJumpToBranch}
        onGenerate={onGenerate}
      />
    );
  }

  return (
    <div>
      <div className="flex items-center justify-end mb-2">
        <button
          onClick={toggleByLevel}
          className="text-xs font-mono font-bold text-violet-700 bg-violet-50 hover:bg-violet-100 border-2 border-violet-300 hover:border-violet-400 px-2.5 py-1.5 rounded-sm transition-colors flex items-center gap-1.5"
        >
          {classifying ? <LoadingDots /> : (byLevel ? 'Flat' : '✨ By Level')}
        </button>
      </div>
      {byLevel && grouped ? (
        <div className="space-y-4">
          {[...CONCEPT_LEVELS, 'Unclassified'].map(lvl => {
            const lvlTopics = grouped.get(lvl);
            if (!lvlTopics || lvlTopics.length === 0) return null;
            return (
              <div key={lvl}>
                <div className="text-xs font-mono font-bold text-stone-500 mb-2 tracking-wide">{lvl.toUpperCase()}</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {lvlTopics.map((topic, ti) => renderCard(topic, `${lvl}-${ti}`))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {topics.map((topic, ti) => renderCard(topic, ti))}
        </div>
      )}
    </div>
  );
}

// Recursive: a category node with any non-leaf children renders as an
// expandable section; a node whose children are all leaves hands off to
// LeafGroup (which adds the By-Level toggle); a true leaf never reaches here
// (its parent renders it via LeafGroup/ConceptCard directly).
function TreeNode({ node, depth, branchName, path, colors, leafIndex, onJumpToBranch, onGenerate }) {
  const [open, setOpen] = useState(depth === 0);
  const allChildrenAreLeaves = node.children.length > 0 && node.children.every(c => c.children.length === 0);
  const descendantLeafCount = useMemo(() => {
    let n = 0;
    const walk = (nodes) => nodes.forEach(c => { if (c.children.length === 0) n++; else walk(c.children); });
    walk(node.children);
    return n;
  }, [node]);
  const fullPath = path ? `${path} › ${node.name}` : node.name;

  return (
    <div id={nodeDomId(branchName, node.name)} className={depth === 0 ? 'border-2 border-stone-200 bg-white' : ''}>
      <button
        onClick={() => setOpen(o => !o)}
        className={depth === 0
          ? `w-full flex items-center justify-between gap-2 px-4 py-3 ${colors.bg} text-white text-left`
          : `w-full flex items-center justify-between gap-2 py-1.5 text-left ${colors.text} font-semibold`}
      >
        <span className={depth === 0 ? 'font-bold text-base' : 'text-sm'}>{node.name}</span>
        <span className={`flex items-center gap-2 flex-shrink-0 ${depth === 0 ? 'text-xs font-mono opacity-70' : 'text-xs font-mono text-stone-400'}`}>
          {descendantLeafCount}
          <span className={`transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
        </span>
      </button>

      {open && (
        <div className={depth === 0 ? 'p-4 space-y-4' : 'pl-4 border-l-2 border-stone-100 ml-1 mt-1.5 mb-2 space-y-3'}>
          {allChildrenAreLeaves ? (
            <LeafGroup node={node} branchName={branchName} path={fullPath} colors={colors} leafIndex={leafIndex} onJumpToBranch={onJumpToBranch} onGenerate={onGenerate} />
          ) : (
            node.children.map((child, i) => (
              child.children.length === 0
                ? (() => {
                    const occurrences = leafIndex.get(child.name) || [];
                    const sharedElsewhere = occurrences.length > 1;
                    const crossBranches = occurrences.filter(e => e.branch !== branchName || e.path !== fullPath);
                    return (
                      <ConceptCard
                        key={i}
                        topic={child.name}
                        breadcrumb={`${branchName} › ${fullPath}`}
                        colors={colors}
                        sharedElsewhere={sharedElsewhere}
                        crossBranches={crossBranches}
                        onJumpToBranch={onJumpToBranch}
                        onGenerate={onGenerate}
                      />
                    );
                  })()
                : (
                  <TreeNode
                    key={i}
                    node={child}
                    depth={depth + 1}
                    branchName={branchName}
                    path={fullPath}
                    colors={colors}
                    leafIndex={leafIndex}
                    onJumpToBranch={onJumpToBranch}
                    onGenerate={onGenerate}
                  />
                )
            ))
          )}
        </div>
      )}
    </div>
  );
}

function HistoricalArc({ branchName, colors }) {
  const eras = TIMELINES[branchName];
  if (!eras) return null;
  return (
    <div className="border-2 border-stone-200 bg-white p-4 mb-5 overflow-x-auto">
      <div className="text-xs font-mono font-bold uppercase tracking-widest text-stone-500 mb-3">Historical Arc</div>
      <div className="flex gap-0 min-w-max">
        {eras.map((e, i) => (
          <button
            key={i}
            onClick={() => document.getElementById(nodeDomId(branchName, e.match))?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            className={`text-left w-52 flex-shrink-0 px-3 py-2.5 border-l-4 ${colors.border} hover:bg-stone-50 transition-colors`}
          >
            <div className="text-xs font-mono font-bold text-stone-400">{e.era}</div>
            <div className={`text-sm font-bold ${colors.text} mt-0.5 mb-1`}>{e.name}</div>
            <div className="text-sm text-stone-500 leading-snug">{e.desc}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

// Filters a tree, keeping any node whose name matches or that has a
// descendant that matches. Non-leaf nodes with a direct match keep all
// their children (so matching a category shows everything under it).
function filterTree(nodes, q) {
  if (!q) return nodes;
  const out = [];
  for (const n of nodes) {
    const nameHit = n.name.toLowerCase().includes(q);
    if (n.children.length === 0) {
      if (nameHit) out.push(n);
      continue;
    }
    if (nameHit) { out.push(n); continue; }
    const filteredChildren = filterTree(n.children, q);
    if (filteredChildren.length > 0) out.push({ ...n, children: filteredChildren });
  }
  return out;
}

export default function FormalSciencesView({ onGenerate }) {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [viewMode, setViewMode] = useState('overview'); // 'overview' | 'browse'
  const [activeBranchIndex, setActiveBranchIndex] = useState(0);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetch('/data/formal-sciences-taxonomy.json')
      .then(r => { if (!r.ok) throw new Error(`Failed to load (${r.status})`); return r.json(); })
      .then(json => { if (!cancelled) { setData(json); setStatus('done'); } })
      .catch(err => { if (!cancelled) { setErrorMsg(err.message); setStatus('error'); } });
    return () => { cancelled = true; };
  }, []);

  function countLeaves(nodes) {
    let n = 0;
    for (const node of nodes) n += node.children.length === 0 ? 1 : countLeaves(node.children);
    return n;
  }
  function countNodes(nodes) {
    let n = nodes.length;
    for (const node of nodes) n += countNodes(node.children);
    return n;
  }

  const totals = useMemo(() => {
    if (!data) return { nodes: 0, concepts: 0 };
    let nodes = 0, concepts = 0;
    data.forEach(b => { nodes += countNodes(b.tree); concepts += countLeaves(b.tree); });
    return { nodes, concepts };
  }, [data]);

  // leaf concept name -> every {branch, path} it appears under, for cross-branch links
  const leafIndex = useMemo(() => {
    const idx = new Map();
    if (!data) return idx;
    function walk(nodes, branch, path) {
      nodes.forEach(n => {
        const fullPath = path ? `${path} › ${n.name}` : n.name;
        if (n.children.length === 0) {
          if (!idx.has(n.name)) idx.set(n.name, []);
          idx.get(n.name).push({ branch, path });
        } else {
          walk(n.children, branch, fullPath);
        }
      });
    }
    data.forEach(b => walk(b.tree, b.branch, ''));
    return idx;
  }, [data]);

  function openBranchFromOverview(bi) {
    setViewMode('browse');
    setActiveBranchIndex(bi);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function jumpToBranch(branchName) {
    const bi = data.findIndex(b => b.branch === branchName);
    if (bi >= 0) { setViewMode('browse'); setActiveBranchIndex(bi); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  }

  const q = search.trim().toLowerCase();
  const maxBranchConcepts = useMemo(() => {
    if (!data) return 1;
    return Math.max(...data.map(b => countLeaves(b.tree)));
  }, [data]);

  return (
    <div className="mt-8">
      <div className="border-b border-stone-200 pb-4 mb-6">
        <div className="flex items-baseline gap-3 mb-1.5">
          <h2 className="text-3xl font-bold tracking-tight text-stone-900">Formal Sciences Taxonomy</h2>
          {status === 'done' && (
            <span className="text-xs font-mono font-bold px-2 py-1 bg-stone-800 text-white rounded-sm">
              {data.length} branches · {totals.nodes.toLocaleString()} nodes · {totals.concepts.toLocaleString()} concepts
            </span>
          )}
        </div>
        <p className="text-base text-stone-600 max-w-2xl leading-relaxed">
          Logic, Mathematics, Statistics, Theoretical CS, AI, Game Theory, Systems Theory, Theoretical Linguistics,
          Decision Theory, Systems Science, Data Science, Information Theory, Computer Science, and Cryptography —
          a real nested hierarchy (paradigms containing subfields containing concepts, several levels deep), not a
          flat list. Expand any concept for a Claude-generated explanation or its most-cited works (OpenAlex, live,
          Google Scholar/Books/DOI/Open-Access links included).
        </p>

        {viewMode === 'browse' && (
          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={() => setViewMode('overview')}
              className="text-sm font-mono font-bold text-stone-600 hover:text-stone-900 bg-white border-2 border-stone-300 hover:border-stone-500 px-3 py-1.5 rounded-sm transition-colors"
            >
              ← Overview
            </button>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Filter anywhere in the tree…"
              className="flex-1 max-w-md text-base border-2 border-stone-300 px-3 py-1.5 rounded-sm focus:outline-none focus:border-stone-600"
            />
          </div>
        )}
      </div>

      {status === 'loading' && (
        <div className="flex items-center gap-3 py-1">
          <LoadingDots />
          <span className="text-base font-mono text-stone-500">Loading taxonomy…</span>
        </div>
      )}
      {status === 'error' && <div className="text-base font-mono text-red-600 py-4">{errorMsg}</div>}

      {/* ---------- Overview: branch cards with concept-count bars ---------- */}
      {status === 'done' && viewMode === 'overview' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {data.map((branch, bi) => {
            const c = BRANCH_COLORS[bi % BRANCH_COLORS.length];
            const branchConcepts = countLeaves(branch.tree);
            const pct = Math.max(4, Math.round((branchConcepts / maxBranchConcepts) * 100));
            return (
              <button
                key={branch.branch}
                onClick={() => openBranchFromOverview(bi)}
                className="text-left border-2 border-stone-200 p-4 hover:border-stone-500 hover:shadow-sm transition-all bg-white rounded-sm"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-bold text-lg text-stone-900">{branch.branch}</span>
                  <span className="text-sm font-mono font-bold text-stone-500 tabular-nums flex-shrink-0">{branchConcepts.toLocaleString()}</span>
                </div>
                <p className="text-sm text-stone-600 mt-1 leading-snug line-clamp-2">{branch.tagline}</p>
                <div className="mt-3 h-2 bg-stone-100 w-full rounded-sm">
                  <div className={`h-2 ${c.bar} rounded-sm`} style={{ width: `${pct}%` }} />
                </div>
                <div className="text-xs font-mono font-bold text-stone-400 mt-1.5">{branch.tree.length} top-level paradigms{TIMELINES[branch.branch] ? ' · historical arc' : ''}</div>
              </button>
            );
          })}
        </div>
      )}

      {/* ---------- Browse: one sub-tab per branch, recursive tree ---------- */}
      {status === 'done' && viewMode === 'browse' && (() => {
        const branch = data[activeBranchIndex];
        const bi = activeBranchIndex;
        const c = BRANCH_COLORS[bi % BRANCH_COLORS.length];
        const branchConcepts = countLeaves(branch.tree);
        const visibleTree = filterTree(branch.tree, q);

        return (
          <div>
            <div className="flex flex-wrap gap-1 border-b-2 border-stone-200 mb-4">
              {data.map((b, i) => {
                const bc = BRANCH_COLORS[i % BRANCH_COLORS.length];
                const isActive = i === activeBranchIndex;
                return (
                  <button
                    key={b.branch}
                    onClick={() => setActiveBranchIndex(i)}
                    className={`px-3 py-2.5 text-sm font-mono -mb-0.5 border-b-4 transition-colors ${
                      isActive ? `${bc.text} border-current font-bold` : 'text-stone-400 border-transparent hover:text-stone-700 font-semibold'
                    }`}
                  >
                    {b.branch}
                  </button>
                );
              })}
            </div>

            <div className={`px-4 py-3.5 ${c.bg} text-white mb-4 rounded-sm`}>
              <div className="flex items-baseline gap-3">
                <span className="font-bold text-lg">{branch.branch}</span>
                <span className="text-xs font-mono font-bold opacity-70">{branchConcepts.toLocaleString()} concepts</span>
              </div>
              <p className="text-sm opacity-90 mt-1 leading-snug">{branch.tagline}</p>
            </div>

            <HistoricalArc branchName={branch.branch} colors={c} />

            {visibleTree.length === 0 && (
              <div className="text-base text-stone-400 py-2">Nothing in this branch matches "{search}".</div>
            )}

            <div className="space-y-4">
              {visibleTree.map((node, i) => (
                <TreeNode
                  key={i}
                  node={node}
                  depth={0}
                  branchName={branch.branch}
                  path=""
                  colors={c}
                  leafIndex={leafIndex}
                  onJumpToBranch={jumpToBranch}
                  onGenerate={onGenerate}
                />
              ))}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
