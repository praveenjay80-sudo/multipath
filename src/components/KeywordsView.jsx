import { useState, useCallback } from 'react';

const MODES = [
  { key: 'canon',        label: 'Canon' },
  { key: 'curriculum',   label: 'Curriculum' },
  { key: 'dissertation', label: 'Dissertation' },
  { key: 'drift',        label: 'Drift' },
  { key: 'consilience',  label: 'Consilience' },
  { key: 'inquiry',      label: 'Inquiry' },
  { key: 'reverse',      label: 'Prerequisites' },
];

// Top-level academic domains — English label maps to GND German preferred name
const DOMAINS = [
  { en: 'Philosophy',         de: 'Philosophie' },
  { en: 'Mathematics',        de: 'Mathematik' },
  { en: 'Physics',            de: 'Physik' },
  { en: 'Chemistry',          de: 'Chemie' },
  { en: 'Biology',            de: 'Biologie' },
  { en: 'Computer Science',   de: 'Informatik' },
  { en: 'Linguistics',        de: 'Linguistik' },
  { en: 'Economics',          de: 'Wirtschaftswissenschaft' },
  { en: 'Law',                de: 'Rechtswissenschaft' },
  { en: 'History',            de: 'Geschichte' },
  { en: 'Geography',          de: 'Geografie' },
  { en: 'Psychology',         de: 'Psychologie' },
  { en: 'Sociology',          de: 'Soziologie' },
  { en: 'Medicine',           de: 'Medizin' },
  { en: 'Arts',               de: 'Kunst' },
  { en: 'Music',              de: 'Musik' },
  { en: 'Literature',         de: 'Literatur' },
  { en: 'Religion & Theology',de: 'Theologie' },
  { en: 'Political Science',  de: 'Politikwissenschaft' },
  { en: 'Engineering',        de: 'Ingenieurwissenschaft' },
  { en: 'Architecture',       de: 'Architektur' },
  { en: 'Education',          de: 'Erziehungswissenschaft' },
  { en: 'Anthropology',       de: 'Anthropologie' },
  { en: 'Astronomy',          de: 'Astronomie' },
  { en: 'Environmental Science', de: 'Umweltwissenschaft' },
];

// ── GND API ───────────────────────────────────────────────────────────────────

function gndSuffix(uri) {
  return (uri || '').replace('https://d-nb.info/gnd/', '');
}

async function fetchGNDByName(deName) {
  const res = await fetch(
    `https://lobid.org/gnd/search?q=preferredName:${encodeURIComponent('"' + deName + '"')}&filter=type:SubjectHeading&format=json&size=5`
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  return (
    json.member?.find(m => m.preferredName === deName) ||
    json.member?.[0] ||
    null
  );
}

async function fetchGNDRecord(id) {
  const res = await fetch(`https://lobid.org/gnd/${id}?format=json`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ── Wikidata English labels ───────────────────────────────────────────────────

async function wikidataEnglish(gndItems) {
  const gndToQid = {};
  const qids = [];
  for (const item of gndItems) {
    if (!item?.id) continue;
    const wd = (item.sameAs || []).find(s => /wikidata\.org\/entity\/Q\d+/.test(s.id || ''));
    if (wd) {
      const qid = wd.id.match(/Q\d+/)?.[0];
      if (qid) { gndToQid[item.id] = qid; qids.push(qid); }
    }
  }
  if (!qids.length) return {};
  const res = await fetch(
    `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${qids.slice(0, 50).join('|')}&props=labels&languages=en&format=json&origin=*`
  );
  const json = await res.json();
  const out = {};
  for (const [gndId, qid] of Object.entries(gndToQid)) {
    const en = json.entities?.[qid]?.labels?.en?.value;
    if (en) out[gndId] = en;
  }
  return out;
}

// Fetch full records for narrower terms (parallel, max 20), then batch Wikidata
async function enrichNarrower(narrowerList) {
  const ids = narrowerList.slice(0, 20).map(t => gndSuffix(t.id));
  const records = await Promise.all(
    ids.map(id => fetchGNDRecord(id).catch(() => null))
  );
  const valid = records.filter(Boolean);
  const labels = await wikidataEnglish(valid).catch(() => ({}));
  // Map: narrower GND URI → english label
  const out = {};
  for (const r of valid) {
    if (r.id && labels[r.id]) out[r.id] = labels[r.id];
  }
  return out;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function Dots({ color = 'bg-stone-300' }) {
  return (
    <div className="flex gap-1.5 py-3 justify-center">
      {[0, 1, 2].map(i => (
        <div key={i} className={`w-1.5 h-1.5 rounded-full animate-bounce ${color}`}
          style={{ animationDelay: `${i * 120}ms` }} />
      ))}
    </div>
  );
}

function modeLabel(key) {
  return MODES.find(m => m.key === key)?.label || 'Canon';
}

// ── TermRow — one narrower/related/broader item ───────────────────────────────

function TermRow({ term, enLabel, onDrill, onGenerate, mode }) {
  const display = enLabel || term.label;
  const hasEn   = !!enLabel && enLabel !== term.label;

  return (
    <div className="flex items-center gap-2 py-1 border-b border-stone-50 last:border-0 group">
      <button
        onClick={() => onDrill(term)}
        className="flex-1 text-left text-sm text-stone-800 hover:text-blue-700 font-medium transition-colors truncate"
      >
        {display}
      </button>
      {hasEn && (
        <span className="shrink-0 text-[9px] font-mono text-stone-400 truncate max-w-[120px]">{term.label}</span>
      )}
      <div className="shrink-0 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onDrill(term)}
          className="text-[8px] font-mono px-1.5 py-0.5 border border-stone-200 text-stone-400 hover:border-blue-300 hover:text-blue-600 transition-colors"
        >
          expand ▸
        </button>
        <button
          onClick={() => onGenerate(display, mode)}
          className="text-[8px] font-mono px-1.5 py-0.5 bg-stone-900 text-white hover:bg-stone-700 transition-colors"
        >
          → {modeLabel(mode)}
        </button>
      </div>
    </div>
  );
}

// ── Concept panel — shows the loaded GND concept ──────────────────────────────

function ConceptPanel({ concept, enLabel, narrowerEnLabels, onDrill, onGenerate, mode }) {
  const broader  = [...(concept.broaderTermInstantial || []), ...(concept.broaderTermGeneral || [])];
  const narrower = [...(concept.narrowerTermInstantial || []), ...(concept.narrowerTermGeneral || [])];
  const related  = concept.relatedTerm || [];
  const cats     = concept.gndSubjectCategory || [];
  const lcsh     = (concept.sameAs || []).find(s => String(s.id || '').includes('id.loc.gov'));
  const wd       = (concept.sameAs || []).find(s => /wikidata\.org\/entity\/Q/.test(s.id || ''));
  const lobidUrl = `https://lobid.org/gnd/${gndSuffix(concept.id)}`;

  return (
    <div className="space-y-5">
      {/* Concept header */}
      <div className="border border-blue-100 bg-blue-50 px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[8px] font-mono font-bold px-1.5 py-0.5 bg-blue-600 text-white">GND</span>
              <h3 className="text-xl font-bold text-stone-900">{enLabel || concept.preferredName}</h3>
            </div>
            {enLabel && (
              <p className="text-xs font-mono text-stone-500">de: {concept.preferredName}</p>
            )}
            {cats.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {cats.map((c, i) => (
                  <span key={i} className="text-[8px] font-mono px-1.5 py-0.5 bg-blue-100 border border-blue-200 text-blue-700">
                    {c.label}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="shrink-0 flex gap-2 text-[9px] font-mono">
            <a href={lobidUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">GND↗</a>
            {lcsh && <a href={lcsh.id} target="_blank" rel="noopener noreferrer" className="text-orange-500 hover:underline">LC↗</a>}
            {wd   && <a href={wd.id}   target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:underline">WD↗</a>}
          </div>
        </div>

        {/* Broader context */}
        {broader.length > 0 && (
          <div className="mt-3 pt-3 border-t border-blue-200">
            <span className="text-[8px] font-mono text-blue-500 uppercase tracking-wider mr-2">Broader context:</span>
            {broader.map((t, i) => (
              <span key={i}>
                <button onClick={() => onDrill(t)}
                  className="text-xs font-mono text-blue-700 hover:underline">{t.label}</button>
                {i < broader.length - 1 && <span className="text-blue-300 mx-1">·</span>}
              </span>
            ))}
          </div>
        )}

        {/* Generate button */}
        <div className="mt-3">
          <button
            onClick={() => onGenerate(enLabel || concept.preferredName, mode)}
            className="text-[9px] font-mono font-bold px-3 py-1.5 bg-stone-900 text-white hover:bg-stone-700 transition-colors"
          >
            → {modeLabel(mode)}
          </button>
        </div>
      </div>

      {/* Related terms */}
      {related.length > 0 && (
        <div>
          <p className="text-[9px] font-mono text-stone-400 uppercase tracking-widest mb-2">
            Related terms <span className="text-stone-300 normal-case">({related.length})</span>
          </p>
          <div className="flex flex-wrap gap-1.5">
            {related.slice(0, 15).map((t, i) => (
              <button key={i} onClick={() => onDrill(t)}
                className="text-[10px] font-mono px-2 py-0.5 bg-white border border-stone-200 text-stone-600 hover:border-blue-400 hover:text-blue-700 transition-colors">
                {narrowerEnLabels[t.id] || t.label}
              </button>
            ))}
            {related.length > 15 && (
              <span className="text-[10px] font-mono text-stone-300 self-center">+{related.length - 15}</span>
            )}
          </div>
        </div>
      )}

      {/* Narrower terms — full list */}
      {narrower.length > 0 && (
        <div>
          <p className="text-[9px] font-mono text-stone-400 uppercase tracking-widest mb-2">
            Narrower terms <span className="text-stone-300 normal-case">({narrower.length})</span>
          </p>
          <div className="border border-stone-100 bg-white divide-y divide-stone-50">
            {narrower.map((t, i) => (
              <TermRow
                key={i}
                term={t}
                enLabel={narrowerEnLabels[t.id] || ''}
                onDrill={onDrill}
                onGenerate={onGenerate}
                mode={mode}
              />
            ))}
          </div>
        </div>
      )}

      {narrower.length === 0 && related.length === 0 && (
        <p className="text-xs font-mono text-stone-400 px-1">
          No narrower or related terms — this is a leaf concept in the GND hierarchy.
        </p>
      )}
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

export default function KeywordsView({ onGenerate }) {
  const [mode, setMode]           = useState('canon');
  const [activeDomain, setActiveDomain] = useState(null);

  // Drill-down state
  const [path, setPath]           = useState([]);  // [{ id, label, concept }]
  const [concept, setConcept]     = useState(null);
  const [enLabel, setEnLabel]     = useState('');
  const [narrowerEn, setNarrowerEn] = useState({});
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);

  async function loadConcept(gndItem, label) {
    setLoading(true);
    setError(null);
    setConcept(gndItem);
    setNarrowerEn({});

    // Get English for the concept itself
    const mainEn = await wikidataEnglish([gndItem]).catch(() => ({}));
    setEnLabel(mainEn[gndItem.id] || label || gndItem.preferredName);

    // Fetch English for narrower + related terms
    const allTerms = [
      ...(gndItem.narrowerTermInstantial || []),
      ...(gndItem.narrowerTermGeneral || []),
      ...(gndItem.relatedTerm || []),
    ];
    if (allTerms.length > 0) {
      const narrowEn = await enrichNarrower(allTerms).catch(() => ({}));
      setNarrowerEn(narrowEn);
    }
    setLoading(false);
  }

  const selectDomain = useCallback(async (domain) => {
    setActiveDomain(domain.en);
    setPath([]);
    setConcept(null);
    setEnLabel('');
    setNarrowerEn({});
    setLoading(true);
    setError(null);
    try {
      const item = await fetchGNDByName(domain.de);
      if (!item) throw new Error(`"${domain.de}" not found in GND`);
      await loadConcept(item, domain.en);
      setPath([{ id: item.id, enLabel: domain.en, deLabel: item.preferredName }]);
    } catch (e) {
      setError(e.message);
      setLoading(false);
    }
  }, []);

  const drillInto = useCallback(async (term) => {
    const id = gndSuffix(term.id);
    setLoading(true);
    setError(null);
    try {
      const item = await fetchGNDRecord(id);
      const prevEnLabel = narrowerEn[term.id] || term.label;
      await loadConcept(item, prevEnLabel);
      setPath(p => [...p, { id: item.id, enLabel: prevEnLabel, deLabel: item.preferredName }]);
    } catch (e) {
      setError(e.message);
      setLoading(false);
    }
  }, [narrowerEn]);

  const navigateTo = useCallback(async (idx) => {
    const crumb = path[idx];
    if (!crumb) return;
    const newPath = path.slice(0, idx + 1);
    setPath(newPath);
    const id = gndSuffix(crumb.id);
    setLoading(true);
    setError(null);
    try {
      const item = await fetchGNDRecord(id);
      await loadConcept(item, crumb.enLabel);
    } catch (e) {
      setError(e.message);
      setLoading(false);
    }
  }, [path]);

  return (
    <div className="mt-8 space-y-6">
      {/* Header */}
      <div className="border-b border-stone-200 pb-4">
        <div className="flex items-baseline gap-3 mb-1">
          <h2 className="text-2xl font-bold tracking-tight text-stone-900">GND Concept Hierarchy</h2>
          <span className="text-[8px] font-mono font-bold px-1.5 py-0.5 bg-blue-600 text-white">GND</span>
        </div>
        <p className="text-sm text-stone-500 max-w-2xl leading-relaxed">
          German National Authority File (Deutsche Nationalbibliothek). Browse 25 academic domains →
          drill into narrower concepts → click any term to generate scholarly content.
          English labels via Wikidata throughout.
        </p>
      </div>

      {/* Mode selector */}
      <div>
        <p className="text-[10px] font-mono text-stone-400 uppercase tracking-widest mb-2">Generate as</p>
        <div className="flex flex-wrap gap-1.5">
          {MODES.map(m => (
            <button key={m.key} onClick={() => setMode(m.key)}
              className={`px-3 py-1.5 text-xs font-mono border transition-all
                ${mode === m.key
                  ? 'bg-stone-900 text-white border-stone-900'
                  : 'bg-white text-stone-500 border-stone-200 hover:border-stone-400 hover:text-stone-800'}`}>
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Domain grid */}
      <div>
        <p className="text-[9px] font-mono text-stone-400 uppercase tracking-widest mb-2">Select a domain to explore</p>
        <div className="flex flex-wrap gap-1.5">
          {DOMAINS.map(d => (
            <button
              key={d.en}
              onClick={() => selectDomain(d)}
              className={`px-3 py-1.5 text-xs font-mono border transition-all
                ${activeDomain === d.en
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-stone-600 border-stone-200 hover:border-blue-400 hover:text-blue-700'}`}
            >
              {d.en}
            </button>
          ))}
        </div>
      </div>

      {/* Breadcrumb */}
      {path.length > 0 && (
        <div className="flex items-center flex-wrap gap-x-1 gap-y-1 text-sm font-mono">
          {path.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <span className="text-stone-300">›</span>}
              <button
                onClick={() => navigateTo(i)}
                className={`transition-colors ${
                  i === path.length - 1
                    ? 'text-blue-700 font-bold'
                    : 'text-stone-400 hover:text-stone-700'
                }`}
              >
                {crumb.enLabel}
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="border border-blue-100 bg-blue-50 py-12">
          <Dots color="bg-blue-300" />
          <p className="text-center text-xs font-mono text-blue-400 mt-1">
            Loading GND hierarchy + English labels…
          </p>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="border border-red-200 bg-red-50 px-4 py-4">
          <p className="text-xs font-mono text-red-600">{error}</p>
          <p className="text-[10px] font-mono text-stone-400 mt-1">
            GND may not have this exact term — try a neighbouring domain.
          </p>
        </div>
      )}

      {/* Concept panel */}
      {!loading && concept && (
        <ConceptPanel
          concept={concept}
          enLabel={enLabel}
          narrowerEnLabels={narrowerEn}
          onDrill={drillInto}
          onGenerate={onGenerate}
          mode={mode}
        />
      )}

      {/* Empty state */}
      {!loading && !concept && !error && (
        <div className="border border-stone-100 bg-stone-50 py-16 text-center">
          <p className="text-sm font-mono text-stone-400">Select a domain above to explore its GND hierarchy</p>
          <p className="text-[10px] font-mono text-stone-300 mt-1">
            Each domain shows narrower terms — click any to drill deeper
          </p>
        </div>
      )}
    </div>
  );
}
