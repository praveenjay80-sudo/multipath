import { useState, useMemo, useCallback, memo } from 'react';

// ── Constants ─────────────────────────────────────────────────────────────────
const DIMS = [
  { key: 'time',        icon: '⧖', label: 'Time',        color: 'text-violet-700 bg-violet-50 border-violet-200',  dot: 'bg-violet-400' },
  { key: 'space',       icon: '✦', label: 'Space',       color: 'text-blue-700   bg-blue-50   border-blue-200',    dot: 'bg-blue-400'   },
  { key: 'matter',      icon: '◉', label: 'Matter',      color: 'text-emerald-700 bg-emerald-50 border-emerald-200', dot: 'bg-emerald-400' },
  { key: 'observer',    icon: '◎', label: 'Observer',    color: 'text-amber-700  bg-amber-50  border-amber-200',   dot: 'bg-amber-400'  },
  { key: 'energy',      icon: '⚡', label: 'Energy',      color: 'text-orange-700 bg-orange-50 border-orange-200',  dot: 'bg-orange-400' },
  { key: 'information', icon: '⧉', label: 'Information', color: 'text-rose-700   bg-rose-50   border-rose-200',    dot: 'bg-rose-400'   },
];

const MODES = [
  { key: 'canon',        label: 'Canon',         color: 'text-blue-700   bg-blue-50   hover:bg-blue-100   border-blue-200'   },
  { key: 'curriculum',   label: 'Curriculum',    color: 'text-sky-700    bg-sky-50    hover:bg-sky-100    border-sky-200'    },
  { key: 'dissertation', label: 'Dissertation',  color: 'text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border-indigo-200' },
  { key: 'reverse',      label: 'Prerequisites', color: 'text-violet-700 bg-violet-50 hover:bg-violet-100 border-violet-200' },
  { key: 'drift',        label: 'Canon Drift',   color: 'text-amber-700  bg-amber-50  hover:bg-amber-100  border-amber-200'  },
  { key: 'consilience',  label: 'Consilience',   color: 'text-teal-700   bg-teal-50   hover:bg-teal-100   border-teal-200'   },
  { key: 'inquiry',      label: 'Inquiry',       color: 'text-rose-700   bg-rose-50   hover:bg-rose-100   border-rose-200'   },
  { key: 'spectrum',     label: 'Spectrum',       color: 'text-cyan-700   bg-cyan-50   hover:bg-cyan-100   border-cyan-200'   },
  { key: 'intelligence', label: 'Field Intel',   color: 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-200' },
  { key: 'overall',      label: 'Overall',       color: 'text-stone-700  bg-stone-50  hover:bg-stone-100  border-stone-200'  },
];

const SECTION_TABS = [
  { key: 'schools',   label: 'Schools',   accent: 'border-violet-600 text-violet-700', inactive: 'text-violet-400 hover:text-violet-600' },
  { key: 'works',     label: 'Works',     accent: 'border-amber-600  text-amber-700',  inactive: 'text-amber-400  hover:text-amber-600'  },
  { key: 'personas',  label: 'Personas',  accent: 'border-teal-600   text-teal-700',   inactive: 'text-teal-400   hover:text-teal-600'   },
  { key: 'dilemmas',  label: 'Dilemmas',  accent: 'border-rose-600   text-rose-700',   inactive: 'text-rose-400   hover:text-rose-600'   },
];

const WORKS_PER_PAGE = 60;
const OA_BASE = 'https://ontologicalatlas.com';

const ExternalIcon = () => (
  <svg width="10" height="10" viewBox="0 0 12 12" fill="none" className="inline-block ml-0.5">
    <path d="M5 2H2a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    <path d="M8 1h3m0 0v3m0-3L5.5 6.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// ── Mode Picker ───────────────────────────────────────────────────────────────
function ModePicker({ name, onSelect, onClose }) {
  return (
    <div className="px-4 pb-3 pt-2 bg-stone-50 border-t border-stone-100 mt-2">
      <p className="text-xs text-stone-400 mb-2 font-mono">Generate with:</p>
      <div className="flex flex-wrap gap-1.5">
        {MODES.map(m => (
          <button key={m.key}
            onClick={() => { onClose(); onSelect(name, m.key); }}
            className={`text-xs px-2 py-1 border rounded-sm transition-colors ${m.color}`}
          >{m.label}</button>
        ))}
      </div>
    </div>
  );
}

// ── School Card ───────────────────────────────────────────────────────────────
const SchoolCard = memo(function SchoolCard({ school, onSelect }) {
  const [expanded, setExpanded] = useState(false);
  const [dimTab, setDimTab] = useState(null);
  const dims = school.dimensions || {};
  const hasDim = d => dims[d] && dims[d].length > 5;

  return (
    <div className={`border rounded transition-all ${expanded ? 'border-violet-200 bg-violet-50/30' : 'border-stone-200 bg-white hover:border-stone-300'}`}>
      {/* Header */}
      <button onClick={() => setExpanded(e => !e)}
        className="w-full text-left px-4 py-3 flex items-start gap-3">
        <span className="text-xs font-mono text-stone-300 shrink-0 pt-0.5 w-8">#{school.num}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="text-sm font-bold text-stone-900">{school.name}</span>
            {school.agency && (
              <span className="text-[10px] font-mono text-violet-600 bg-violet-50 border border-violet-200 px-1.5 py-0.5 rounded-full shrink-0">
                {school.agency}
              </span>
            )}
          </div>
          <div className="text-xs text-stone-400 mb-1">{school.thinkers}</div>
          <p className="text-xs text-stone-600 leading-relaxed line-clamp-2">{school.description}</p>
          {/* Dimension indicators */}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {DIMS.map(d => (
              <span key={d.key}
                className={`text-[11px] px-1.5 py-0.5 border rounded font-mono transition-opacity ${hasDim(d.key) ? d.color : 'text-stone-300 bg-stone-50 border-stone-100 opacity-50'}`}
                title={d.label}>
                {d.icon}
              </span>
            ))}
            <span className="text-[10px] text-stone-300 font-mono ml-1">⚗ {school.experiments} · ⚔ {school.debates}</span>
          </div>
        </div>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className={`shrink-0 mt-1 text-stone-400 transition-transform ${expanded ? 'rotate-180' : ''}`}>
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {/* Expanded */}
      {expanded && (
        <div className="border-t border-violet-100">
          {/* Full description */}
          {school.description && (
            <div className="px-4 py-3 text-xs text-stone-600 leading-relaxed border-b border-stone-100">
              {school.description}
            </div>
          )}
          {/* Worldview */}
          {school.worldview && (
            <div className="px-4 py-3 border-b border-stone-100">
              <p className="text-[10px] font-mono font-semibold text-stone-400 uppercase tracking-widest mb-1">Worldview</p>
              <p className="text-xs text-stone-600 leading-relaxed">{school.worldview}</p>
            </div>
          )}
          {/* Six Dimensions */}
          {DIMS.some(d => hasDim(d.key)) && (
            <div className="px-4 py-3 border-b border-stone-100">
              <p className="text-[10px] font-mono font-semibold text-stone-400 uppercase tracking-widest mb-2">Six Dimensions</p>
              <div className="flex gap-1.5 flex-wrap mb-3">
                {DIMS.filter(d => hasDim(d.key)).map(d => (
                  <button key={d.key}
                    onClick={() => setDimTab(dimTab === d.key ? null : d.key)}
                    className={`text-[11px] px-2 py-1 border rounded-sm font-mono transition-colors ${dimTab === d.key ? d.color : 'text-stone-500 bg-stone-50 border-stone-200 hover:bg-stone-100'}`}>
                    {d.icon} {d.label}
                  </button>
                ))}
              </div>
              {dimTab && dims[dimTab] && (
                <div className={`text-xs leading-relaxed p-3 rounded border ${DIMS.find(d=>d.key===dimTab)?.color}`}>
                  {dims[dimTab]}
                </div>
              )}
            </div>
          )}
          {/* Moral + Practical */}
          <div className="grid grid-cols-2 gap-0 border-b border-stone-100">
            {school.moralImplications && (
              <div className="px-4 py-3 border-r border-stone-100">
                <p className="text-[10px] font-mono font-semibold text-stone-400 uppercase tracking-widest mb-1">Moral</p>
                <p className="text-xs text-stone-600 leading-relaxed">{school.moralImplications}</p>
              </div>
            )}
            {school.practicalImplications && (
              <div className="px-4 py-3">
                <p className="text-[10px] font-mono font-semibold text-stone-400 uppercase tracking-widest mb-1">Practical</p>
                <p className="text-xs text-stone-600 leading-relaxed">{school.practicalImplications}</p>
              </div>
            )}
          </div>
          {/* External link */}
          <div className="px-4 py-2 flex items-center gap-3 border-b border-stone-100">
            <a href={`${OA_BASE}/schools/${school.slug}/`} target="_blank" rel="noreferrer"
              className="text-xs text-stone-400 hover:text-violet-600 transition-colors font-mono flex items-center gap-1">
              View on Ontological Atlas <ExternalIcon />
            </a>
          </div>
          <ModePicker name={school.name} onSelect={onSelect} onClose={() => setExpanded(false)} />
        </div>
      )}
    </div>
  );
});

// ── Work Card ─────────────────────────────────────────────────────────────────
const WorkCard = memo(function WorkCard({ work, onSelect }) {
  const [expanded, setExpanded] = useState(false);
  const topInfluences = (work.influences || []).slice(0, 4);

  return (
    <div className={`border rounded transition-all ${expanded ? 'border-amber-200 bg-amber-50/20' : 'border-stone-200 bg-white hover:border-stone-300'}`}>
      <button onClick={() => setExpanded(e => !e)} className="w-full text-left px-4 py-3 flex items-start gap-3">
        <span className="text-xs font-mono text-stone-300 shrink-0 pt-0.5 w-10">#{work.num}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <span className="text-sm font-bold text-stone-900 leading-snug">{work.title}</span>
          </div>
          <div className="text-xs text-stone-400 mt-0.5">{work.authorDate}</div>
          {work.form && <div className="text-xs text-stone-400 italic mt-0.5">{work.form}</div>}
          {work.tagline && <p className="text-xs text-stone-600 mt-1.5 leading-relaxed">{work.tagline}</p>}
          {topInfluences.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {topInfluences.map((inf, i) => (
                <span key={i} className="text-[10px] font-mono px-1.5 py-0.5 bg-amber-50 border border-amber-200 text-amber-700 rounded-full">
                  {inf.pct}% {inf.school}
                </span>
              ))}
            </div>
          )}
        </div>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className={`shrink-0 mt-1 text-stone-400 transition-transform ${expanded ? 'rotate-180' : ''}`}>
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      {expanded && (
        <div className="border-t border-amber-100">
          <div className="px-4 py-2 flex items-center gap-3 border-b border-stone-100">
            <a href={`${OA_BASE}/works/${work.slug}/`} target="_blank" rel="noreferrer"
              className="text-xs text-stone-400 hover:text-amber-600 transition-colors font-mono flex items-center gap-1">
              View on Ontological Atlas <ExternalIcon />
            </a>
          </div>
          <ModePicker name={work.title} onSelect={onSelect} onClose={() => setExpanded(false)} />
        </div>
      )}
    </div>
  );
});

// ── Persona Card ──────────────────────────────────────────────────────────────
const PersonaCard = memo(function PersonaCard({ persona, onSelect }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className={`border rounded transition-all ${expanded ? 'border-teal-200 bg-teal-50/20' : 'border-stone-200 bg-white hover:border-stone-300'}`}>
      <button onClick={() => setExpanded(e => !e)} className="w-full text-left px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <span className="text-sm font-bold text-stone-900 block leading-snug">{persona.name}</span>
            {persona.dates && <span className="text-xs text-stone-400 font-mono">{persona.dates}</span>}
            {persona.description && <p className="text-xs text-stone-600 mt-1 leading-relaxed line-clamp-2">{persona.description}</p>}
          </div>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className={`shrink-0 mt-1 text-stone-400 transition-transform ${expanded ? 'rotate-180' : ''}`}>
            <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </button>
      {expanded && (
        <div className="border-t border-teal-100">
          {persona.description && (
            <div className="px-4 py-3 text-xs text-stone-600 leading-relaxed border-b border-stone-100">
              {persona.description}
            </div>
          )}
          <div className="px-4 py-2 flex items-center gap-3 border-b border-stone-100">
            <a href={`${OA_BASE}/personas/${persona.slug}/`} target="_blank" rel="noreferrer"
              className="text-xs text-stone-400 hover:text-teal-600 transition-colors font-mono flex items-center gap-1">
              View on Ontological Atlas <ExternalIcon />
            </a>
          </div>
          <ModePicker name={persona.name} onSelect={onSelect} onClose={() => setExpanded(false)} />
        </div>
      )}
    </div>
  );
});

// ── Dilemma Card ──────────────────────────────────────────────────────────────
const DilemmaCard = memo(function DilemmaCard({ dilemma, onSelect }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className={`border rounded transition-all ${expanded ? 'border-rose-200 bg-rose-50/20' : 'border-stone-200 bg-white hover:border-stone-300'}`}>
      <button onClick={() => setExpanded(e => !e)} className="w-full text-left px-4 py-3 flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <span className="text-sm font-semibold text-stone-900 leading-snug block">{dilemma.title}</span>
          {dilemma.description && <p className="text-xs text-stone-500 mt-1 leading-relaxed line-clamp-2">{dilemma.description}</p>}
        </div>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className={`shrink-0 mt-1 text-stone-400 transition-transform ${expanded ? 'rotate-180' : ''}`}>
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      {expanded && (
        <div className="border-t border-rose-100">
          {dilemma.description && (
            <div className="px-4 py-3 text-xs text-stone-600 leading-relaxed border-b border-stone-100">
              {dilemma.description}
            </div>
          )}
          <div className="px-4 py-2 flex items-center gap-3 border-b border-stone-100">
            <a href={`${OA_BASE}/dilemmas/${dilemma.slug}/`} target="_blank" rel="noreferrer"
              className="text-xs text-stone-400 hover:text-rose-600 transition-colors font-mono flex items-center gap-1">
              View on Ontological Atlas <ExternalIcon />
            </a>
          </div>
          <ModePicker name={dilemma.title} onSelect={onSelect} onClose={() => setExpanded(false)} />
        </div>
      )}
    </div>
  );
});

// ── Main View ─────────────────────────────────────────────────────────────────
export default function OntologicalAtlasView({
  status, schools, works, personas, dilemmas, crawlDate, error,
  onLoad, onSelect,
}) {
  const [section, setSection] = useState('schools');
  const [query, setQuery] = useState('');
  const [dimFilter, setDimFilter] = useState(null);
  const [worksPage, setWorksPage] = useState(1);
  const [scanStatus, setScanStatus] = useState('idle'); // idle | scanning | done | error
  const [scanResult, setScanResult] = useState(null);

  const handleSelect = useCallback((name, mode) => {
    if (onSelect) onSelect(name, mode);
  }, [onSelect]);

  // ── Search ────────────────────────────────────────────────────────────────
  const q = query.trim().toLowerCase();

  const filteredSchools = useMemo(() => {
    let list = schools;
    if (dimFilter) list = list.filter(s => s.dimensions?.[dimFilter] && s.dimensions[dimFilter].length > 5);
    if (!q) return list;
    return list.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.thinkers.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q)
    );
  }, [schools, q, dimFilter]);

  const filteredWorks = useMemo(() => {
    if (!q) return works;
    return works.filter(w =>
      w.title.toLowerCase().includes(q) ||
      w.authorDate.toLowerCase().includes(q) ||
      w.tagline.toLowerCase().includes(q)
    );
  }, [works, q]);

  const filteredPersonas = useMemo(() => {
    if (!q) return personas;
    return personas.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q)
    );
  }, [personas, q]);

  const filteredDilemmas = useMemo(() => {
    if (!q) return dilemmas;
    return dilemmas.filter(d =>
      d.title.toLowerCase().includes(q) ||
      d.description.toLowerCase().includes(q)
    );
  }, [dilemmas, q]);

  // Works pagination
  const worksTotalPages = Math.ceil(filteredWorks.length / WORKS_PER_PAGE);
  const pagedWorks = filteredWorks.slice((worksPage - 1) * WORKS_PER_PAGE, worksPage * WORKS_PER_PAGE);

  // Reset works page on search change
  const handleQuery = (v) => { setQuery(v); setWorksPage(1); };

  // ── Scan for new info ─────────────────────────────────────────────────────
  async function scanForNew() {
    setScanStatus('scanning');
    setScanResult(null);
    try {
      const fetchCount = async (path, pattern) => {
        const res = await fetch(`https://ontologicalatlas.com${path}`, { signal: AbortSignal.timeout(15000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const html = await res.text();
        const m = html.match(pattern);
        return m ? parseInt(m[1].replace(/,/g, '')) : null;
      };
      const [liveSchools, liveWorks, livePersonas, liveDilemmas] = await Promise.all([
        fetchCount('/schools/', /(\d[\d,]+)\s+of\s+\d[\d,]+\s+schools/i),
        fetchCount('/works/', /(\d[\d,]+)\s+of\s+\d[\d,]+\s+classified/i),
        fetchCount('/personas/', /(\d[\d,]+)\s+of\s+(\d[\d,]+)/i),
        fetchCount('/dilemmas/', /(\d[\d,]+)/i),
      ]);
      setScanResult({
        schools:  { stored: schools.length,  live: liveSchools },
        works:    { stored: works.length,    live: liveWorks   },
        personas: { stored: personas.length, live: livePersonas },
        dilemmas: { stored: dilemmas.length, live: liveDilemmas },
      });
      setScanStatus('done');
    } catch (e) {
      setScanStatus('error');
      setScanResult({ error: e.message });
    }
  }

  // ── Idle / Loading / Error ────────────────────────────────────────────────
  if (status === 'idle') return (
    <div className="mt-8 flex flex-col items-center gap-4 py-12">
      <div className="flex items-center gap-3 mb-1">
        {DIMS.map(d => <span key={d.key} className="text-lg">{d.icon}</span>)}
      </div>
      <p className="text-stone-400 text-sm font-mono">208 schools · 1,888 works · 461 personas · 57 dilemmas</p>
      <button onClick={onLoad} className="px-6 py-2.5 bg-stone-900 text-white text-sm font-mono hover:bg-stone-700 transition-colors">
        Load Ontological Atlas
      </button>
      <a href={OA_BASE} target="_blank" rel="noreferrer" className="text-xs text-stone-400 hover:text-stone-600 font-mono flex items-center gap-1">
        ontologicalatlas.com <ExternalIcon />
      </a>
    </div>
  );

  if (status === 'loading') return (
    <div className="mt-8 flex items-center gap-3 text-stone-400 py-12 justify-center">
      <span className="flex gap-0.5"><span className="loading-dot"/><span className="loading-dot"/><span className="loading-dot"/></span>
      <span className="text-sm font-mono">Loading atlas…</span>
    </div>
  );

  if (status === 'error') return (
    <div className="mt-8 text-red-600 text-sm py-8 text-center font-mono">{error}</div>
  );

  const sectionCounts = {
    schools: filteredSchools.length,
    works: filteredWorks.length,
    personas: filteredPersonas.length,
    dilemmas: filteredDilemmas.length,
  };

  return (
    <div className="mt-4">
      {/* ── Atlas header ── */}
      <div className="mb-5 pb-4 border-b border-stone-100">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3 mb-1.5">
              {DIMS.map(d => (
                <button key={d.key}
                  onClick={() => setDimFilter(dimFilter === d.key ? null : d.key)}
                  title={`Filter schools by ${d.label}`}
                  className={`text-base transition-all px-1.5 py-0.5 rounded border ${dimFilter === d.key ? DIMS.find(x=>x.key===d.key)?.color : 'text-stone-300 border-transparent hover:text-stone-600'}`}>
                  {d.icon}
                </button>
              ))}
              {dimFilter && (
                <span className="text-xs text-stone-400 font-mono">
                  filtering by {DIMS.find(d=>d.key===dimFilter)?.label}
                  <button onClick={() => setDimFilter(null)} className="ml-1 text-stone-400 hover:text-stone-700">✕</button>
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs text-stone-400 font-mono">{schools.length} schools · {works.length.toLocaleString()} works · {personas.length} personas · {dilemmas.length} dilemmas</span>
              {crawlDate && <span className="text-xs text-stone-300 font-mono">crawled {crawlDate}</span>}
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={scanForNew}
              disabled={scanStatus === 'scanning'}
              className="text-xs font-mono text-stone-400 hover:text-stone-700 transition-colors disabled:opacity-40"
            >
              {scanStatus === 'scanning' ? 'scanning…' : 'Scan for new info'}
            </button>
            <a href={OA_BASE} target="_blank" rel="noreferrer"
              className="text-xs text-stone-400 hover:text-stone-700 transition-colors font-mono flex items-center gap-1">
              ontologicalatlas.com <ExternalIcon />
            </a>
          </div>
        </div>

        {/* Scan results */}
        {scanStatus === 'done' && scanResult && !scanResult.error && (
          <div className="mt-3 border border-stone-200 bg-stone-50 rounded p-3">
            <p className="text-xs font-mono font-semibold text-stone-600 mb-2">Live vs stored counts:</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {Object.entries(scanResult).map(([key, val]) => {
                if (!val || typeof val !== 'object' || val.error) return null;
                const diff = val.live != null ? val.live - val.stored : null;
                return (
                  <div key={key} className="text-xs font-mono">
                    <span className="text-stone-500 capitalize">{key}</span>
                    <span className="text-stone-400 mx-1">·</span>
                    <span className="text-stone-700">{val.stored}</span>
                    {diff != null && diff > 0 && <span className="text-emerald-600 ml-1">+{diff} new</span>}
                    {diff === 0 && <span className="text-stone-300 ml-1">up to date</span>}
                  </div>
                );
              })}
            </div>
            {Object.values(scanResult).some(v => v?.live != null && v.live > v.stored) && (
              <p className="text-xs text-emerald-600 font-mono mt-2">Re-run the crawl script to update.</p>
            )}
          </div>
        )}
        {scanStatus === 'error' && (
          <div className="mt-3 border border-amber-200 bg-amber-50 rounded p-3 text-xs text-amber-700 font-mono">
            Scan failed (likely CORS from this domain). Run the crawl script directly at ontologicalatlas.com instead.
          </div>
        )}
      </div>

      {/* ── Search ── */}
      <div className="mb-4 flex gap-3">
        <input
          type="text" value={query} onChange={e => handleQuery(e.target.value)}
          placeholder="Search schools, works, personas, dilemmas…"
          className="flex-1 border border-stone-300 px-3 py-2 text-sm text-stone-700 placeholder-stone-300 focus:outline-none focus:border-stone-500"
        />
      </div>

      {/* ── Section tabs ── */}
      <div className="flex gap-0 border-b border-stone-200 mb-5">
        {SECTION_TABS.map(tab => (
          <button key={tab.key}
            onClick={() => { setSection(tab.key); setWorksPage(1); }}
            className={`px-4 py-2.5 text-sm font-mono -mb-px transition-colors border-b-2 ${
              section === tab.key ? `${tab.accent} font-semibold border-current` : `border-transparent ${tab.inactive}`
            }`}>
            {tab.label}
            <span className="ml-1.5 text-xs font-mono opacity-60">
              {sectionCounts[tab.key].toLocaleString()}
            </span>
          </button>
        ))}
      </div>

      {/* ── Schools ── */}
      {section === 'schools' && (
        <div className="space-y-2">
          {filteredSchools.length === 0
            ? <p className="text-stone-400 font-mono text-sm py-8 text-center">No schools match "{query}"</p>
            : filteredSchools.map(s => <SchoolCard key={s.slug} school={s} onSelect={handleSelect} />)
          }
        </div>
      )}

      {/* ── Works ── */}
      {section === 'works' && (
        <>
          <div className="space-y-2 mb-4">
            {pagedWorks.length === 0
              ? <p className="text-stone-400 font-mono text-sm py-8 text-center">No works match "{query}"</p>
              : pagedWorks.map(w => <WorkCard key={w.slug} work={w} onSelect={handleSelect} />)
            }
          </div>
          {worksTotalPages > 1 && (
            <div className="flex items-center justify-between py-3 border-t border-stone-100">
              <button onClick={() => setWorksPage(p => Math.max(1, p - 1))} disabled={worksPage === 1}
                className="text-xs font-mono text-stone-500 hover:text-stone-800 disabled:opacity-30 px-3 py-1 border border-stone-200 rounded">
                ← Prev
              </button>
              <span className="text-xs font-mono text-stone-400">
                {worksPage} / {worksTotalPages} · {filteredWorks.length.toLocaleString()} works
              </span>
              <button onClick={() => setWorksPage(p => Math.min(worksTotalPages, p + 1))} disabled={worksPage === worksTotalPages}
                className="text-xs font-mono text-stone-500 hover:text-stone-800 disabled:opacity-30 px-3 py-1 border border-stone-200 rounded">
                Next →
              </button>
            </div>
          )}
        </>
      )}

      {/* ── Personas ── */}
      {section === 'personas' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {filteredPersonas.length === 0
            ? <p className="text-stone-400 font-mono text-sm py-8 text-center col-span-2">No personas match "{query}"</p>
            : filteredPersonas.map(p => <PersonaCard key={p.slug} persona={p} onSelect={handleSelect} />)
          }
        </div>
      )}

      {/* ── Dilemmas ── */}
      {section === 'dilemmas' && (
        <div className="space-y-2">
          {filteredDilemmas.length === 0
            ? <p className="text-stone-400 font-mono text-sm py-8 text-center">No dilemmas match "{query}"</p>
            : filteredDilemmas.map(d => <DilemmaCard key={d.slug} dilemma={d} onSelect={handleSelect} />)
          }
        </div>
      )}
    </div>
  );
}
