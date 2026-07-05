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

// UDC main class colors
const CLASS_COLORS = {
  '0': 'bg-stone-600',
  '1': 'bg-violet-600',
  '2': 'bg-amber-600',
  '3': 'bg-sky-600',
  '5': 'bg-emerald-600',
  '6': 'bg-blue-600',
  '7': 'bg-rose-600',
  '8': 'bg-indigo-600',
  '9': 'bg-orange-600',
};

function titleCase(str) {
  return str.split(' ').map(w =>
    w.length > 3 ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w.toLowerCase()
  ).join(' ');
}

function NodeRow({ node, depth, openSet, onToggle, onGenerate, modeLabel, activeTopic, activeStatus }) {
  const hasChildren = node.children?.length > 0;
  const isOpen = openSet.has(node.code);
  const pl = 8 + depth * 20;
  const mainClass = node.code[0];
  const colorClass = CLASS_COLORS[mainClass] || 'bg-stone-500';
  const isActive = activeTopic?.includes(`(UDC ${node.code})`);

  return (
    <>
      <div
        className={`flex items-start gap-2 py-1.5 border-b border-stone-50 group transition-colors ${isActive ? 'bg-stone-100' : 'hover:bg-stone-50'}`}
        style={{ paddingLeft: pl, paddingRight: 8 }}
      >
        <button
          onClick={() => hasChildren && onToggle(node.code)}
          disabled={!hasChildren}
          className="shrink-0 w-5 h-5 flex items-center justify-center mt-0.5 disabled:cursor-default"
        >
          {hasChildren
            ? isOpen
              ? <span className="text-[9px] text-blue-500">▼</span>
              : <span className="text-[9px] text-stone-400 group-hover:text-blue-500">▶</span>
            : <span className="text-[9px] text-stone-200">·</span>}
        </button>

        <button
          onClick={() => onGenerate(`${titleCase(node.name)} (UDC ${node.code})`, 'path')}
          className="flex-1 min-w-0 flex items-baseline gap-2 text-left hover:underline decoration-stone-300"
        >
          <span className={`shrink-0 text-[8px] font-mono px-1 py-0.5 text-white ${colorClass}`}>
            {node.code}
          </span>
          <span className={`leading-snug ${
            depth === 0 ? 'font-semibold text-stone-900 text-sm'
            : depth === 1 ? 'font-medium text-stone-800 text-sm'
            : 'text-stone-700 text-xs'
          }`}>
            {titleCase(node.name)}
          </span>
          {node.terms?.length > 0 && (
            <span className="text-[9px] font-mono text-stone-300">{node.terms.length}</span>
          )}
        </button>

        {isActive && (
          <span className={`shrink-0 text-[9px] font-mono mt-0.5 ${activeStatus === 'loading' ? 'text-stone-400' : 'text-stone-700'}`}>
            {activeStatus === 'loading' ? '···' : '◆'}
          </span>
        )}

        <a
          href={`https://www.worldcat.org/search?q=su%3A${encodeURIComponent(titleCase(node.name))}`}
          target="_blank" rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          title="Browse on WorldCat"
          className="shrink-0 opacity-0 group-hover:opacity-100 text-[9px] font-mono px-1.5 py-0.5 border border-stone-200 text-stone-400 hover:bg-stone-800 hover:text-white hover:border-stone-800 transition-all mt-0.5"
        >
          WorldCat
        </a>
      </div>

      {isOpen && hasChildren && (
        node.children.map(child => (
          <NodeRow key={child.code} node={child} depth={depth + 1}
            openSet={openSet} onToggle={onToggle} onGenerate={onGenerate} modeLabel={modeLabel}
            activeTopic={activeTopic} activeStatus={activeStatus} />
        ))
      )}

      {isOpen && node.terms?.length > 0 && !hasChildren && (
        <div style={{ paddingLeft: pl + 28 }} className="pb-1">
          <div className="flex flex-wrap gap-1 py-1">
            {node.terms.slice(0, 40).map((t, i) => (
              <button key={i} onClick={() => onGenerate(t, 'path')}
                className="text-[9px] font-mono px-1.5 py-0.5 border border-stone-200 text-stone-500 hover:bg-stone-900 hover:text-white hover:border-stone-900 transition-colors">
                {titleCase(t)}
              </button>
            ))}
            {node.terms.length > 40 && (
              <span className="text-[9px] font-mono text-stone-300 py-0.5">+{node.terms.length - 40} more</span>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default function UDCView({ onGenerate }) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [mode,    setMode]    = useState('path');
  const [openSet, setOpenSet] = useState(new Set());
  const [search,  setSearch]  = useState('');
  const readingPath = useReadingPath();

  useEffect(() => {
    fetch('/data/udc-full.json')
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  const modeLabel = MODES.find(m => m.key === mode)?.label || 'Reading Path';

  const onToggle = code => setOpenSet(prev => {
    const next = new Set(prev);
    next.has(code) ? next.delete(code) : next.add(code);
    return next;
  });

  const handleGenerate = (topic, m) => {
    if (m === 'path') readingPath.generate(topic);
    else onGenerate(topic, m);
  };

  // Flatten for search (only up to 3 levels for performance)
  const allNodes = useMemo(() => {
    if (!data) return [];
    const flat = [];
    function walk(nodes, depth) {
      if (depth > 3) return;
      for (const n of nodes) {
        flat.push({ code: n.code, name: titleCase(n.name) });
        if (n.children?.length) walk(n.children, depth + 1);
      }
    }
    walk(data, 0);
    return flat;
  }, [data]);

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return allNodes.filter(n => n.name.toLowerCase().includes(q) || n.code.includes(q)).slice(0, 50);
  }, [search, allNodes]);

  if (loading) return <div className="mt-8 text-sm font-mono text-stone-400">Loading UDC…</div>;
  if (error)   return <div className="mt-8 text-sm font-mono text-red-500">Error: {error}</div>;

  let totalNodes = 0, totalTerms = 0;
  function countTree(n) { totalNodes++; totalTerms += n.terms?.length || 0; n.children?.forEach(countTree); }
  data.forEach(countTree);

  return (
    <div className="mt-8 space-y-5">
      {/* Header */}
      <div className="border-b border-stone-200 pb-4">
        <div className="flex items-baseline gap-3 mb-1">
          <h2 className="text-2xl font-bold tracking-tight text-stone-900">Universal Decimal Classification</h2>
          <span className="text-[8px] font-mono font-bold px-1.5 py-0.5 bg-stone-800 text-white">ETH-UDK Full</span>
        </div>
        <p className="text-sm text-stone-500 max-w-2xl">
          {totalNodes.toLocaleString()} nodes · {totalTerms.toLocaleString()} terms across 9 UDC main classes.
          Expand any branch, search, click → to generate a reading path.
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
      <input type="text" value={search} onChange={e => setSearch(e.target.value)}
        placeholder="Search UDC nodes…"
        className="w-full max-w-sm px-3 py-1.5 text-sm border border-stone-300 font-mono focus:outline-none focus:border-stone-500"
      />

      {search.trim() ? (
        <div className="border border-stone-200 bg-white">
          {searchResults.length === 0
            ? <div className="p-4 text-sm text-stone-400 font-mono">No matches</div>
            : searchResults.map((n, i) => (
              <div key={i} className="group flex items-center gap-3 px-3 py-2 border-b border-stone-50 hover:bg-stone-50 transition-colors">
                <button onClick={() => handleGenerate(`${n.name} (UDC ${n.code})`, mode)}
                  className="flex-1 flex items-center gap-3 text-left">
                  <span className={`text-[8px] font-mono px-1 py-0.5 text-white shrink-0 ${CLASS_COLORS[n.code[0]] || 'bg-stone-500'}`}>
                    {n.code}
                  </span>
                  <span className="text-sm text-stone-800 hover:underline decoration-stone-300">{n.name}</span>
                </button>
                <a
                  href={`https://www.worldcat.org/search?q=su%3A${encodeURIComponent(n.name)}`}
                  target="_blank" rel="noopener noreferrer"
                  className="opacity-0 group-hover:opacity-100 text-[9px] font-mono px-1.5 py-0.5 border border-stone-200 text-stone-400 hover:bg-stone-800 hover:text-white hover:border-stone-800 transition-all shrink-0"
                >WorldCat</a>
              </div>
            ))}
        </div>
      ) : (
        <div className="border border-stone-200 bg-white">
          {data.map(root => (
            <NodeRow key={root.code} node={root} depth={0}
              openSet={openSet} onToggle={onToggle}
              onGenerate={handleGenerate} modeLabel={modeLabel}
              activeTopic={readingPath.topic} activeStatus={readingPath.status} />
          ))}
        </div>
      )}

      {/* Inline Reading Path */}
      {readingPath.status !== 'idle' && (
        <div className="border border-stone-200 bg-white">
          <div className="flex items-center justify-between px-4 py-3 border-b border-stone-200 bg-stone-50">
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono font-bold text-stone-700">Reading Path</span>
              <span className="text-sm text-stone-500">{readingPath.topic}</span>
              {readingPath.status === 'loading' && (
                <span className="flex gap-0.5">
                  <span className="loading-dot" /><span className="loading-dot" /><span className="loading-dot" />
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
