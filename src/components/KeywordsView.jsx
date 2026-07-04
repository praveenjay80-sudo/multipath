import { useState, useRef } from 'react';

const MODES = [
  { key: 'canon',        label: 'Canon' },
  { key: 'curriculum',   label: 'Curriculum' },
  { key: 'dissertation', label: 'Dissertation' },
  { key: 'drift',        label: 'Drift' },
  { key: 'consilience',  label: 'Consilience' },
  { key: 'inquiry',      label: 'Inquiry' },
  { key: 'reverse',      label: 'Prerequisites' },
];

// ── GND via lobid.org ─────────────────────────────────────────────────────────

async function searchGND(query) {
  const res = await fetch(
    `https://lobid.org/gnd/search?q=${encodeURIComponent(query)}&filter=type:SubjectHeading&format=json&size=12`
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  return json.member || [];
}

async function fetchWikidataEnglish(items) {
  // Collect Wikidata QIDs from GND sameAs
  const gndToQid = {};
  const qids = [];
  for (const item of items) {
    const wd = (item.sameAs || []).find(s => /wikidata\.org\/entity\/Q\d+/.test(s.id || ''));
    if (wd) {
      const qid = wd.id.match(/Q\d+/)?.[0];
      if (qid) { gndToQid[item.id] = qid; qids.push(qid); }
    }
  }
  if (qids.length === 0) return {};
  const res = await fetch(
    `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${qids.join('|')}&props=labels&languages=en&format=json&origin=*`
  );
  const json = await res.json();
  const result = {};
  for (const [gndId, qid] of Object.entries(gndToQid)) {
    const en = json.entities?.[qid]?.labels?.en?.value;
    if (en) result[gndId] = en;
  }
  return result;
}

// ── IDREF via idref.fr ────────────────────────────────────────────────────────

async function searchIDREF(query) {
  const res = await fetch(
    `https://www.idref.fr/Sru/Solr?q=${encodeURIComponent(query)}&fq=type_z:Rameau&wt=json&rows=12&fl=ppn_z,affcourt_r,afflong_z,type_z`
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  return json.response?.docs || [];
}

async function loadIDREFRecord(ppn) {
  const res = await fetch(`https://www.idref.fr/${ppn}.jsonld`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return parseSkos(await res.json(), ppn);
}

function parseSkos(jsonld, targetPpn) {
  const graph = [].concat(jsonld['@graph'] || jsonld);

  // id → { fr label, en label }
  const labelMap = {};
  for (const node of graph) {
    const id = node['@id'];
    if (!id) continue;
    const pref = [].concat(node['skos:prefLabel'] || []);
    const alt  = [].concat(node['skos:altLabel']  || []);
    const all  = [...pref, ...alt];
    const fr = all.find(l => l?.['@language'] === 'fr');
    const en = all.find(l => l?.['@language'] === 'en');
    labelMap[id] = {
      fr: fr?.['@value'] || '',
      en: en?.['@value'] || '',
    };
  }

  const targetId = `https://www.idref.fr/${targetPpn}`;
  const main = graph.find(n => n['@id'] === targetId)
    || graph.find(n => [].concat(n['@type'] || []).some(t => String(t).includes('Concept')));
  if (!main) return null;

  function resolve(field) {
    return [].concat(main[field] || [])
      .map(t => ({ id: String(t?.['@id'] || ''), ...labelMap[String(t?.['@id'] || '')] }))
      .filter(t => t.fr || t.en);
  }

  const prefArr = [].concat(main['skos:prefLabel'] || []);
  const altArr  = [].concat(main['skos:altLabel']  || []);
  const frPref  = prefArr.find(l => l?.['@language'] === 'fr') || prefArr[0];
  const enPref  = altArr.find(l => l?.['@language'] === 'en')
               || prefArr.find(l => l?.['@language'] === 'en');

  // Wikidata sameAs from IDREF record
  const sameAs   = [].concat(main['owl:sameAs'] || main['skos:exactMatch'] || []);
  const wikidata = sameAs.find(s => /wikidata/.test(s?.['@id'] || s || ''));
  const wdId     = wikidata?.['@id'] || (typeof wikidata === 'string' ? wikidata : null);

  return {
    frLabel:  frPref?.['@value'] || String(frPref || ''),
    enLabel:  enPref?.['@value'] || '',
    wdId,
    broader:  resolve('skos:broader'),
    narrower: resolve('skos:narrower'),
    related:  resolve('skos:related'),
  };
}

// ── Loading dots ──────────────────────────────────────────────────────────────

function Dots({ color = 'bg-stone-300' }) {
  return (
    <div className="flex gap-1.5 py-2">
      {[0, 1, 2].map(i => (
        <div key={i} className={`w-1.5 h-1.5 rounded-full animate-bounce ${color}`}
          style={{ animationDelay: `${i * 120}ms` }} />
      ))}
    </div>
  );
}

// ── Term chip ─────────────────────────────────────────────────────────────────

function Chip({ label, onClick }) {
  return (
    <button
      onClick={() => onClick(label)}
      className="text-[10px] font-mono px-2 py-0.5 bg-stone-50 border border-stone-200 text-stone-600 hover:bg-stone-100 hover:border-stone-500 hover:text-stone-900 transition-colors"
    >
      {label}
    </button>
  );
}

// ── Hierarchy block ───────────────────────────────────────────────────────────
// items: array of { fr, en } or strings; onSelect(label)

function HierarchyRow({ title, items, onSelect, max = 12 }) {
  if (!items || items.length === 0) return null;
  const shown  = items.slice(0, max);
  const hidden = items.length - max;
  return (
    <div className="flex items-start gap-2">
      <span className="shrink-0 text-[9px] font-mono text-stone-400 uppercase tracking-wider w-16 pt-0.5">{title}</span>
      <div className="flex flex-wrap gap-1">
        {shown.map((t, i) => {
          const display = typeof t === 'string' ? t : (t.en || t.fr || t.label || '');
          const sub     = typeof t === 'string' ? '' : (t.en ? t.fr : '');
          return display ? (
            <span key={i} className="flex flex-col">
              <Chip label={display} onClick={onSelect} />
              {sub && <span className="text-[8px] font-mono text-stone-300 px-2">{sub}</span>}
            </span>
          ) : null;
        })}
        {hidden > 0 && <span className="text-[10px] font-mono text-stone-300 self-center">+{hidden}</span>}
      </div>
    </div>
  );
}

// ── GND Card ──────────────────────────────────────────────────────────────────

function GNDCard({ item, enLabel, mode, onGenerate }) {
  const gndSuffix = (item.id || '').replace('https://d-nb.info/gnd/', '');
  const lobidUrl  = `https://lobid.org/gnd/${gndSuffix}`;
  const lcsh      = (item.sameAs || []).find(s => String(s.id || '').includes('id.loc.gov'));
  const wikidata  = (item.sameAs || []).find(s => /wikidata\.org\/entity\/Q/.test(s.id || ''));

  const broader  = [...(item.broaderTermInstantial || []), ...(item.broaderTermGeneral || [])];
  const narrower = [...(item.narrowerTermInstantial || []), ...(item.narrowerTermGeneral || [])];
  const related  = item.relatedTerm || [];
  const cats     = item.gndSubjectCategory || [];
  const displayEn = enLabel || item.preferredName;

  function termLabel(t) { return t.label || ''; }

  return (
    <div className="border border-blue-100 bg-white">
      {/* Top strip */}
      <div className="bg-blue-50 px-4 py-2.5 border-b border-blue-100 flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-[8px] font-mono font-bold px-1.5 py-0.5 bg-blue-600 text-white tracking-wider">GND</span>
            <span className="text-sm font-bold text-stone-900 leading-tight">{displayEn}</span>
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-[10px] font-mono text-stone-500">de: {item.preferredName}</span>
            {cats.map((c, i) => (
              <span key={i} className="text-[8px] font-mono px-1.5 py-0.5 bg-blue-100 text-blue-700">{c.label}</span>
            ))}
          </div>
        </div>
        <div className="shrink-0 flex gap-2 text-[9px] font-mono">
          <a href={lobidUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">GND↗</a>
          {lcsh && <a href={lcsh.id} target="_blank" rel="noopener noreferrer" className="text-orange-500 hover:underline">LC↗</a>}
          {wikidata && <a href={wikidata.id} target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:underline">WD↗</a>}
        </div>
      </div>

      {/* Hierarchy body */}
      <div className="px-4 py-3 space-y-2">
        <HierarchyRow
          title="broader"
          items={broader.map(t => ({ en: enLabel && t.label === item.preferredName ? displayEn : t.label, fr: '', label: t.label }))}
          onSelect={l => onGenerate(l, mode)}
        />
        <HierarchyRow
          title="related"
          items={related.map(t => ({ label: termLabel(t) }))}
          onSelect={l => onGenerate(l, mode)}
        />
        <HierarchyRow
          title="narrower"
          items={narrower.map(t => ({ label: termLabel(t) }))}
          onSelect={l => onGenerate(l, mode)}
          max={14}
        />
      </div>

      {/* Generate button */}
      <div className="px-4 pb-3">
        <button
          onClick={() => onGenerate(displayEn, mode)}
          className="text-[9px] font-mono font-bold px-3 py-1.5 bg-stone-900 text-white hover:bg-stone-700 transition-colors"
        >
          → {MODES.find(m => m.key === mode)?.label || 'Canon'}
        </button>
      </div>
    </div>
  );
}

// ── IDREF Card ────────────────────────────────────────────────────────────────

function IDREFCard({ item, mode, onGenerate }) {
  const ppn   = item.ppn_z;
  const label = item.affcourt_r || item.afflong_z || ppn;
  const url   = `https://www.idref.fr/${ppn}`;

  const [hier, setHier]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr]         = useState(null);
  const expanded              = useRef(false);

  async function toggle() {
    if (expanded.current) { setHier(null); expanded.current = false; return; }
    setLoading(true); setErr(null);
    try {
      const h = await loadIDREFRecord(ppn);
      setHier(h);
      expanded.current = true;
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  const enLabel = hier?.enLabel || '';
  const frLabel = hier?.frLabel || label;
  const displayEn = enLabel || frLabel;

  return (
    <div className="border border-purple-100 bg-white">
      {/* Top strip */}
      <div className="bg-purple-50 px-4 py-2.5 border-b border-purple-100 flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-[8px] font-mono font-bold px-1.5 py-0.5 bg-purple-600 text-white tracking-wider">IDREF</span>
            <span className="text-sm font-bold text-stone-900 leading-tight">{displayEn}</span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] font-mono text-stone-500">fr: {frLabel}</span>
            {enLabel && frLabel !== enLabel && (
              <span className="text-[8px] font-mono text-purple-400">RAMEAU</span>
            )}
          </div>
        </div>
        <a href={url} target="_blank" rel="noopener noreferrer"
          className="shrink-0 text-[9px] font-mono text-purple-500 hover:underline">IDREF↗</a>
      </div>

      {/* Hierarchy body (lazy) */}
      <div className="px-4 py-3 space-y-2">
        {loading && <Dots color="bg-purple-200" />}
        {err && <p className="text-[10px] font-mono text-red-500">{err}</p>}

        {hier && (
          <>
            <HierarchyRow
              title="broader"
              items={hier.broader}
              onSelect={l => onGenerate(l, mode)}
            />
            <HierarchyRow
              title="related"
              items={hier.related}
              onSelect={l => onGenerate(l, mode)}
            />
            <HierarchyRow
              title="narrower"
              items={hier.narrower}
              onSelect={l => onGenerate(l, mode)}
              max={14}
            />
          </>
        )}

        {!hier && !loading && (
          <p className="text-[10px] font-mono text-stone-300">Click "Load hierarchy" to see broader · narrower · related</p>
        )}
      </div>

      {/* Actions */}
      <div className="px-4 pb-3 flex gap-2">
        <button onClick={() => onGenerate(displayEn, mode)}
          className="text-[9px] font-mono font-bold px-3 py-1.5 bg-stone-900 text-white hover:bg-stone-700 transition-colors">
          → {MODES.find(m => m.key === mode)?.label || 'Canon'}
        </button>
        <button onClick={toggle} disabled={loading}
          className="text-[9px] font-mono px-3 py-1.5 border border-stone-200 text-stone-500 hover:border-stone-400 hover:text-stone-700 transition-colors disabled:opacity-40">
          {loading ? 'Loading…' : expanded.current ? 'Hide ▲' : 'Load hierarchy ▸'}
        </button>
      </div>
    </div>
  );
}

// ── Status bar ────────────────────────────────────────────────────────────────

function StatusBar({ label, color, status, count, error, fallbackUrl, query }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`text-[8px] font-mono font-bold px-1.5 py-0.5 ${color} text-white`}>{label}</span>
      {status === 'loading' && <span className="text-[10px] font-mono text-stone-400 animate-pulse">fetching…</span>}
      {status === 'done'    && <span className="text-[10px] font-mono text-stone-400">{count} results</span>}
      {status === 'error'   && (
        <span className="text-[10px] font-mono text-red-500">
          {error} ·{' '}
          <a href={fallbackUrl} target="_blank" rel="noopener noreferrer"
            className="underline hover:text-red-700">open directly ↗</a>
        </span>
      )}
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ label, hint }) {
  return (
    <div className="border border-stone-100 bg-stone-50 px-4 py-6 text-center space-y-1">
      <p className="text-xs font-mono text-stone-400">No {label} results</p>
      <p className="text-[10px] font-mono text-stone-300">{hint}</p>
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

export default function KeywordsView({ onGenerate }) {
  const [input, setInput]   = useState('');
  const [query, setQuery]   = useState('');
  const [mode, setMode]     = useState('canon');

  const [gndItems,  setGndItems]  = useState([]);
  const [idrefItems,setIdrefItems]= useState([]);
  const [enLabels,  setEnLabels]  = useState({});   // gndId → english label

  const [gndStatus,  setGndStatus]  = useState('idle');
  const [idrefStatus,setIdrefStatus]= useState('idle');
  const [gndErr,  setGndErr]  = useState('');
  const [idrefErr,setIdrefErr]= useState('');

  async function handleSearch() {
    const q = input.trim();
    if (!q) return;
    setQuery(q);
    setGndItems([]); setIdrefItems([]); setEnLabels({});

    // GND + Wikidata English labels
    setGndStatus('loading'); setGndErr('');
    searchGND(q)
      .then(async items => {
        setGndItems(items);
        setGndStatus('done');
        // Batch-fetch English labels from Wikidata
        const labels = await fetchWikidataEnglish(items).catch(() => ({}));
        setEnLabels(labels);
      })
      .catch(e => { setGndErr(e.message); setGndStatus('error'); });

    // IDREF
    setIdrefStatus('loading'); setIdrefErr('');
    searchIDREF(q)
      .then(items => { setIdrefItems(items); setIdrefStatus('done'); })
      .catch(e    => { setIdrefErr(e.message); setIdrefStatus('error'); });
  }

  const hasResults = gndStatus === 'done' || idrefStatus === 'done'
                  || gndStatus === 'error' || idrefStatus === 'error';

  return (
    <div className="mt-8 space-y-6">
      {/* Header */}
      <div className="border-b border-stone-200 pb-5">
        <div className="flex items-baseline gap-3 mb-1">
          <h2 className="text-2xl font-bold tracking-tight text-stone-900">Authority Keywords</h2>
          <div className="flex gap-1.5">
            <span className="text-[8px] font-mono font-bold px-1.5 py-0.5 bg-blue-600 text-white">GND</span>
            <span className="text-[8px] font-mono font-bold px-1.5 py-0.5 bg-purple-600 text-white">IDREF</span>
          </div>
        </div>
        <p className="text-sm text-stone-500 leading-relaxed max-w-2xl">
          Look up any concept in the German National Authority File (GND) and the French IDREF/RAMEAU
          vocabulary. Both show English translations with a structured broader → narrower → related
          hierarchy. Click any term to generate scholarly content.
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

      {/* Search bar */}
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          placeholder="e.g. Metaphysics, Quantum field theory, Postcolonialism, Thermodynamics…"
          className="flex-1 px-3 py-2.5 text-sm border border-stone-200 bg-white text-stone-900 placeholder-stone-300 focus:outline-none focus:border-stone-700 transition-colors"
        />
        <button onClick={handleSearch} disabled={!input.trim()}
          className="px-5 py-2 text-sm bg-stone-900 text-white hover:bg-stone-700 transition-colors disabled:opacity-40">
          Search
        </button>
      </div>

      {/* Results */}
      {query && (
        <div className="space-y-8">
          {/* ── GND ── */}
          <section className="space-y-3">
            <StatusBar
              label="GND" color="bg-blue-600"
              status={gndStatus} count={gndItems.length}
              error={gndErr}
              fallbackUrl={`https://lobid.org/gnd/search?q=${encodeURIComponent(query)}&filter=type:SubjectHeading`}
              query={query}
            />
            <p className="text-[9px] font-mono text-stone-400">
              Deutsche Nationalbibliothek · lobid.org · English labels via Wikidata
            </p>

            {gndStatus === 'loading' && (
              <div className="border border-blue-100 bg-blue-50 py-8 flex justify-center">
                <Dots color="bg-blue-300" />
              </div>
            )}
            {gndStatus === 'done' && gndItems.length === 0 && (
              <EmptyState label="GND" hint="Try a broader term or German spelling" />
            )}
            <div className="space-y-3">
              {gndItems.map((item, i) => (
                <GNDCard
                  key={item.id || i}
                  item={item}
                  enLabel={enLabels[item.id] || ''}
                  mode={mode}
                  onGenerate={onGenerate}
                />
              ))}
            </div>
          </section>

          {/* Divider */}
          {hasResults && <div className="border-t border-stone-100" />}

          {/* ── IDREF ── */}
          <section className="space-y-3">
            <StatusBar
              label="IDREF" color="bg-purple-600"
              status={idrefStatus} count={idrefItems.length}
              error={idrefErr}
              fallbackUrl={`https://www.idref.fr/Sru/Solr?q=${encodeURIComponent(query)}&fq=type_z:Rameau&wt=json`}
              query={query}
            />
            <p className="text-[9px] font-mono text-stone-400">
              Bibliothèque nationale de France · RAMEAU vocabulary · English labels via JSONLD record
            </p>

            {idrefStatus === 'loading' && (
              <div className="border border-purple-100 bg-purple-50 py-8 flex justify-center">
                <Dots color="bg-purple-300" />
              </div>
            )}
            {idrefStatus === 'done' && idrefItems.length === 0 && (
              <EmptyState label="IDREF/RAMEAU" hint="RAMEAU uses French — try searching in French (e.g. Métaphysique)" />
            )}
            <div className="space-y-3">
              {idrefItems.map((item, i) => (
                <IDREFCard
                  key={item.ppn_z || i}
                  item={item}
                  mode={mode}
                  onGenerate={onGenerate}
                />
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
