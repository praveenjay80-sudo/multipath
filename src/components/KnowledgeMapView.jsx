import { useState, useEffect, useMemo } from 'react';
import { useReadingPath } from '../hooks/useReadingPath';
import ReadingOrderView from './ReadingOrderView';

const MODES = [
  { key: 'path',         label: 'Reading Path' },
  { key: 'canon',        label: 'Canon' },
  { key: 'curriculum',   label: 'Curriculum' },
  { key: 'dissertation', label: 'Dissertation' },
  { key: 'drift',        label: 'Drift' },
  { key: 'consilience',  label: 'Consilience' },
  { key: 'inquiry',      label: 'Inquiry' },
  { key: 'reverse',      label: 'Prerequisites' },
];

const DOMAIN_COLORS = {
  'Humanities':       { tab: 'border-violet-600 text-violet-700', dot: 'bg-violet-500', active: 'bg-violet-600' },
  'Social science':   { tab: 'border-sky-600 text-sky-700',       dot: 'bg-sky-500',    active: 'bg-sky-600' },
  'Natural science':  { tab: 'border-emerald-600 text-emerald-700', dot: 'bg-emerald-500', active: 'bg-emerald-600' },
  'Formal science':   { tab: 'border-amber-600 text-amber-700',   dot: 'bg-amber-500',  active: 'bg-amber-600' },
  'Applied science':  { tab: 'border-rose-600 text-rose-700',     dot: 'bg-rose-500',   active: 'bg-rose-600' },
};

export default function KnowledgeMapView({ onGenerate }) {
  const [data,     setData]     = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [mode,     setMode]     = useState('path');
  const [domain,   setDomain]   = useState(null);
  const [group,    setGroup]    = useState(null);
  const [search,   setSearch]   = useState('');
  const readingPath = useReadingPath();

  useEffect(() => {
    fetch('/data/knowledge-map.json')
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(raw => {
        const filtered = raw.filter(d => d.groups?.length > 0 && d.name !== 'Further reading');
        setData(filtered);
        setDomain(filtered[0]?.name ?? null);
        setLoading(false);
      })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  const modeLabel = MODES.find(m => m.key === mode)?.label || 'Canon';

  const activeDomain = useMemo(() => data?.find(d => d.name === domain), [data, domain]);
  const activeGroup  = useMemo(() => activeDomain?.groups.find(g => g.name === group), [activeDomain, group]);

  // Flat list for search
  const allFields = useMemo(() => {
    if (!data) return [];
    const flat = [];
    for (const dom of data) {
      for (const grp of dom.groups) {
        for (const fld of grp.fields) {
          flat.push({ name: fld.name, subs: fld.subs, domain: dom.name, group: grp.name });
          for (const sub of fld.subs) {
            flat.push({ name: sub, subs: [], domain: dom.name, group: grp.name, parent: fld.name });
          }
        }
      }
    }
    return flat;
  }, [data]);

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return allFields.filter(f => f.name.toLowerCase().includes(q)).slice(0, 50);
  }, [search, allFields]);

  const switchDomain = (name) => { setDomain(name); setGroup(null); };

  const handleGenerate = (topic, m) => {
    if (m === 'path') {
      readingPath.generate(topic);
    } else {
      onGenerate(topic, m);
    }
  };

  if (loading) return <div className="mt-8 text-sm font-mono text-stone-400">Loading knowledge map…</div>;
  if (error)   return <div className="mt-8 text-sm font-mono text-red-500">Error: {error}</div>;

  const totalFields = data.reduce((s, d) => s + d.groups.reduce((s2, g) => s2 + g.fields.length, 0), 0);

  return (
    <div className="mt-8 space-y-5">
      {/* Header */}
      <div className="border-b border-stone-200 pb-4">
        <div className="flex items-baseline gap-3 mb-1">
          <h2 className="text-2xl font-bold tracking-tight text-stone-900">Knowledge Map</h2>
          <span className="text-[8px] font-mono font-bold px-1.5 py-0.5 bg-stone-800 text-white">All Disciplines</span>
        </div>
        <p className="text-sm text-stone-500 max-w-2xl">
          {totalFields.toLocaleString()} fields across 5 domains — Humanities, Social Science, Natural Science,
          Formal Science, Applied Science. Browse or search, then generate a reading list.
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
        type="text" value={search} onChange={e => setSearch(e.target.value)}
        placeholder="Search any field or sub-discipline…"
        className="w-full max-w-sm px-3 py-1.5 text-sm border border-stone-300 font-mono focus:outline-none focus:border-stone-500"
      />

      {/* Search results */}
      {search.trim() ? (
        <div className="border border-stone-200 bg-white">
          {searchResults.length === 0
            ? <div className="p-4 text-sm text-stone-400 font-mono">No matches</div>
            : searchResults.map((f, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2 border-b border-stone-50 hover:bg-stone-50 group transition-colors">
                <div className={`shrink-0 w-1.5 h-1.5 rounded-full ${DOMAIN_COLORS[f.domain]?.dot || 'bg-stone-400'}`} />
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-stone-800">{f.name}</span>
                  {f.parent && <span className="ml-1 text-[10px] text-stone-400">in {f.parent}</span>}
                  <span className="ml-2 text-[9px] text-stone-400">{f.group} · {f.domain}</span>
                </div>
                <button onClick={() => handleGenerate(f.name, mode)}
                  className="shrink-0 text-[8px] font-mono px-2 py-0.5 bg-stone-900 text-white hover:bg-stone-700 opacity-0 group-hover:opacity-100 transition-opacity">
                  → {modeLabel}
                </button>
              </div>
            ))}
        </div>
      ) : (
        /* Main browser */
        <div className="border border-stone-200 bg-white">
          {/* Domain tabs */}
          <div className="flex border-b border-stone-200 overflow-x-auto">
            {data.map(d => {
              const col = DOMAIN_COLORS[d.name] || { tab: 'border-stone-600 text-stone-700' };
              const isActive = domain === d.name;
              return (
                <button key={d.name} onClick={() => switchDomain(d.name)}
                  className={`px-4 py-2.5 text-xs font-mono whitespace-nowrap -mb-px border-b-2 transition-colors
                    ${isActive ? col.tab + ' font-semibold bg-stone-50' : 'border-transparent text-stone-400 hover:text-stone-700'}`}>
                  {d.name}
                </button>
              );
            })}
          </div>

          <div className="flex" style={{ minHeight: 500 }}>
            {/* Groups sidebar */}
            <div className="w-52 shrink-0 border-r border-stone-200 overflow-y-auto" style={{ maxHeight: 560 }}>
              {activeDomain?.groups.map(g => {
                const isActive = group === g.name;
                const col = DOMAIN_COLORS[domain] || { active: 'bg-stone-700' };
                return (
                  <button key={g.name} onClick={() => setGroup(g.name)}
                    className={`w-full text-left px-3 py-2 text-xs border-b border-stone-50 transition-colors
                      ${isActive ? col.active + ' text-white' : 'text-stone-600 hover:bg-stone-50'}`}>
                    <div>{g.name}</div>
                    <div className={`text-[9px] font-mono mt-0.5 ${isActive ? 'text-white/60' : 'text-stone-400'}`}>
                      {g.fields.length} fields
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Fields panel */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ maxHeight: 560 }}>
              {!activeGroup ? (
                <div className="text-sm text-stone-400 font-mono">← Select a discipline group</div>
              ) : (
                <>
                  <div className="text-[10px] font-mono text-stone-400 uppercase tracking-widest">
                    {activeGroup.name} — {activeGroup.fields.length} fields
                  </div>
                  {activeGroup.fields.map((f, i) => (
                    <div key={i} className="group">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-stone-800">{f.name}</span>
                        <button onClick={() => onGenerate(f.name, mode)}
                          className="text-[8px] font-mono px-2 py-0.5 bg-stone-900 text-white hover:bg-stone-700 opacity-0 group-hover:opacity-100 transition-opacity">
                          → {modeLabel}
                        </button>
                      </div>
                      {f.subs.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {f.subs.map((s, j) => (
                            <button key={j} onClick={() => handleGenerate(s, mode)}
                              className="text-[10px] font-mono px-2 py-0.5 border border-stone-200 text-stone-500 hover:bg-stone-900 hover:text-white hover:border-stone-900 transition-colors">
                              {s}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Inline Reading Path panel */}
      {(readingPath.status !== 'idle') && (
        <div className="border border-stone-200 bg-white">
          <div className="flex items-center justify-between px-4 py-3 border-b border-stone-200 bg-stone-50">
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono font-bold text-stone-700">Reading Path</span>
              <span className="text-sm text-stone-500">{readingPath.topic}</span>
              {readingPath.status === 'loading' && (
                <span className="flex gap-0.5">
                  <span className="loading-dot" />
                  <span className="loading-dot" />
                  <span className="loading-dot" />
                </span>
              )}
            </div>
            <button onClick={readingPath.clear}
              className="text-[9px] font-mono text-stone-400 hover:text-stone-700 px-2 py-0.5 border border-stone-200 hover:border-stone-400 transition-colors">
              ✕ close
            </button>
          </div>
          <div className="p-4">
            <ReadingOrderView
              content={readingPath.content}
              isStreaming={readingPath.status === 'loading'}
            />
          </div>
        </div>
      )}
    </div>
  );
}
