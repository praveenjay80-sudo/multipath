import { useState, useEffect, useMemo } from 'react';

const MODES = [
  { key: 'canon',        label: 'Canon' },
  { key: 'curriculum',   label: 'Curriculum' },
  { key: 'dissertation', label: 'Dissertation' },
  { key: 'drift',        label: 'Drift' },
  { key: 'consilience',  label: 'Consilience' },
  { key: 'inquiry',      label: 'Inquiry' },
  { key: 'reverse',      label: 'Prerequisites' },
];

// Strip LaTeX math delimiters for display
function clean(str) {
  return str
    .replace(/\$([^$]+)\$/g, '$1')   // $x$ → x
    .replace(/\\["'`^~]([a-zA-Z])/g, '$1') // \"{u} → u (approximate)
    .replace(/\\\\/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export default function MSCView({ onGenerate }) {
  const [data,      setData]      = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [mode,      setMode]      = useState('canon');
  const [selected,  setSelected]  = useState(null); // top-level code
  const [subSel,    setSubSel]    = useState(null); // secondary code
  const [search,    setSearch]    = useState('');

  useEffect(() => {
    fetch('/data/msc.json')
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  const modeLabel = MODES.find(m => m.key === mode)?.label || 'Canon';

  // Flat list for search
  const allKeywords = useMemo(() => {
    if (!data) return [];
    const flat = [];
    for (const top of data) {
      for (const sub of top.children) {
        for (const kw of sub.keywords) {
          flat.push({ keyword: clean(kw.keyword), code: kw.code, topName: top.name, topCode: top.code });
        }
      }
    }
    return flat;
  }, [data]);

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q || !allKeywords.length) return [];
    return allKeywords.filter(k => k.keyword.toLowerCase().includes(q)).slice(0, 60);
  }, [search, allKeywords]);

  const activeTop = useMemo(() => data?.find(d => d.code === selected), [data, selected]);

  const activeSub = useMemo(() => {
    if (!activeTop || !subSel) return null;
    return activeTop.children.find(c => c.code === subSel);
  }, [activeTop, subSel]);

  if (loading) return (
    <div className="mt-8 text-sm font-mono text-stone-400">Loading MSC vocabulary…</div>
  );
  if (error) return (
    <div className="mt-8 text-sm font-mono text-red-500">Error: {error}</div>
  );

  return (
    <div className="mt-8 space-y-5">
      {/* Header */}
      <div className="border-b border-stone-200 pb-4">
        <div className="flex items-baseline gap-3 mb-1">
          <h2 className="text-2xl font-bold tracking-tight text-stone-900">Mathematics Subject Classification</h2>
          <span className="text-[8px] font-mono font-bold px-1.5 py-0.5 bg-emerald-700 text-white">MSC 2020</span>
        </div>
        <p className="text-sm text-stone-500 max-w-2xl">
          {allKeywords.length.toLocaleString()} keywords across 63 MSC top-level categories.
          Select a field, drill into subcategories, or search.
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

      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search keywords…"
        className="w-full max-w-sm px-3 py-1.5 text-sm border border-stone-300 font-mono focus:outline-none focus:border-stone-500"
      />

      {/* Search results */}
      {search.trim() ? (
        <div className="border border-stone-200 bg-white">
          {searchResults.length === 0
            ? <div className="p-4 text-sm text-stone-400 font-mono">No matches</div>
            : searchResults.map((k, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-1.5 border-b border-stone-50 hover:bg-stone-50 group transition-colors">
                <span className="text-[9px] font-mono text-stone-400 shrink-0 w-12">{k.code}</span>
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-stone-800">{k.keyword}</span>
                  <span className="ml-2 text-[9px] text-stone-400">{k.topName}</span>
                </div>
                <button
                  onClick={() => onGenerate(k.keyword, mode)}
                  className="shrink-0 text-[8px] font-mono px-2 py-0.5 bg-stone-900 text-white hover:bg-stone-700 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  → {modeLabel}
                </button>
              </div>
            ))}
        </div>
      ) : (
        /* Two-panel browser */
        <div className="flex gap-0 border border-stone-200 bg-white" style={{ minHeight: 480 }}>
          {/* Left: top-level categories */}
          <div className="w-64 shrink-0 border-r border-stone-200 overflow-y-auto" style={{ maxHeight: 560 }}>
            {data.map(top => {
              const total = top.children.reduce((s, c) => s + c.keywords.length, 0);
              const isActive = selected === top.code;
              return (
                <button
                  key={top.code}
                  onClick={() => { setSelected(top.code); setSubSel(null); }}
                  className={`w-full text-left px-3 py-2 border-b border-stone-50 transition-colors flex items-start gap-2
                    ${isActive ? 'bg-stone-900 text-white' : 'hover:bg-stone-50 text-stone-700'}`}
                >
                  <span className={`text-[9px] font-mono shrink-0 mt-0.5 ${isActive ? 'text-stone-300' : 'text-stone-400'}`}>{top.code}</span>
                  <div className="flex-1 min-w-0">
                    <div className={`text-xs leading-snug ${isActive ? 'font-medium' : ''}`}>{top.name}</div>
                    <div className={`text-[9px] font-mono mt-0.5 ${isActive ? 'text-stone-400' : 'text-stone-300'}`}>{total.toLocaleString()}</div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right: subcategories + keywords */}
          <div className="flex-1 overflow-y-auto" style={{ maxHeight: 560 }}>
            {!activeTop ? (
              <div className="p-6 text-sm text-stone-400 font-mono">← Select a category</div>
            ) : !subSel ? (
              /* Show subcategory chips */
              <div className="p-4 space-y-3">
                <div className="text-xs font-mono text-stone-400 uppercase tracking-widest mb-3">
                  {activeTop.name} — {activeTop.children.reduce((s,c) => s + c.keywords.length, 0).toLocaleString()} keywords
                </div>
                <div className="flex flex-wrap gap-2">
                  {activeTop.children.map(sub => (
                    <button
                      key={sub.code}
                      onClick={() => setSubSel(sub.code)}
                      className="px-3 py-1.5 border border-stone-200 text-xs font-mono text-stone-700 hover:bg-stone-900 hover:text-white hover:border-stone-900 transition-colors"
                    >
                      {sub.code} <span className="text-stone-400 ml-1">{sub.keywords.length}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              /* Show keywords for selected subcategory */
              <div>
                <div className="flex items-center gap-3 px-4 py-2.5 border-b border-stone-100 bg-stone-50 sticky top-0">
                  <button
                    onClick={() => setSubSel(null)}
                    className="text-[9px] font-mono text-stone-400 hover:text-stone-700"
                  >
                    ← {activeTop.code}
                  </button>
                  <span className="text-xs font-mono font-bold text-stone-700">{subSel}</span>
                  <span className="text-[9px] font-mono text-stone-400">{activeSub?.keywords.length} keywords</span>
                </div>
                {activeSub?.keywords.map((kw, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 px-4 py-1.5 border-b border-stone-50 hover:bg-stone-50 group transition-colors"
                  >
                    <span className="text-[9px] font-mono text-stone-300 shrink-0 w-12">{kw.code}</span>
                    <span className="flex-1 text-xs text-stone-700">{clean(kw.keyword)}</span>
                    <button
                      onClick={() => onGenerate(clean(kw.keyword), mode)}
                      className="shrink-0 text-[8px] font-mono px-2 py-0.5 bg-stone-900 text-white hover:bg-stone-700 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      → {modeLabel}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
