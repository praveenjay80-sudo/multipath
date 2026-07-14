import { useState, useEffect, useMemo, useCallback } from 'react';
import { useReadingPath } from '../hooks/useReadingPath';
import ReadingOrderView from './ReadingOrderView';

const MODES = [
  { key: 'path',         label: 'Reading Path' },
  { key: 'canon',        label: 'Canon' },
  { key: 'curriculum',   label: 'Curriculum' },
  { key: 'dissertation', label: 'Dissertation' },
  { key: 'drift',        label: 'Canon Drift' },
  { key: 'consilience',  label: 'Consilience' },
  { key: 'inquiry',      label: 'Inquiry' },
  { key: 'reverse',      label: 'Prerequisites' },
  { key: 'spectrum',     label: 'Spectrum' },
  { key: 'intelligence', label: 'Field Intel' },
];

const TABLE_LABELS = {
  main:   'Main Classes (000–999)',
  table1: 'Table 1 — Standard Subdivisions',
  table2: 'Table 2 — Geographic Areas',
  table4: 'Table 4 — Language Subdivisions',
  table5: 'Table 5 — Ethnic & National Groups',
  table6: 'Table 6 — Languages',
};

const CLASS_COLORS = {
  '0': 'bg-stone-600', '1': 'bg-violet-600', '2': 'bg-amber-600', '3': 'bg-sky-600',
  '4': 'bg-fuchsia-600', '5': 'bg-emerald-600', '6': 'bg-blue-600', '7': 'bg-rose-600',
  '8': 'bg-indigo-600', '9': 'bg-orange-600',
};

function CodeBadge({ code }) {
  const color = CLASS_COLORS[code[0]] || 'bg-stone-500';
  return (
    <span className={`shrink-0 text-[8px] font-mono px-1 py-0.5 text-white ${color}`}>
      {code}
    </span>
  );
}

function recordLabel(r) {
  return r.le && r.le !== r.l ? r.le : r.l;
}

function RecordRow({ r, depth, onGenerate, mode }) {
  const label = recordLabel(r);
  const pl = 8 + depth * 20;
  return (
    <div
      className="group flex items-center gap-2 py-1 border-b border-stone-50 hover:bg-stone-50 transition-colors"
      style={{ paddingLeft: pl + 28, paddingRight: 8 }}
    >
      <button
        onClick={() => onGenerate(`${label} (DDC ${r.d})`, mode)}
        className="flex-1 min-w-0 flex items-baseline gap-2 text-left hover:underline decoration-stone-300"
      >
        <span className="text-xs text-stone-700 truncate">{label}</span>
        {r.le && r.le !== r.l && (
          <span className="text-[9px] font-mono text-stone-300 truncate">{r.l}</span>
        )}
        <span className="text-[9px] font-mono text-stone-300 shrink-0">{r.t}</span>
      </button>
      <a
        href={`https://lobid.org/gnd/${r.id}`}
        target="_blank" rel="noopener noreferrer"
        onClick={e => e.stopPropagation()}
        title="View GND record"
        className="shrink-0 opacity-0 group-hover:opacity-100 text-[9px] font-mono px-1.5 py-0.5 border border-stone-200 text-stone-400 hover:bg-stone-800 hover:text-white hover:border-stone-800 transition-all"
      >
        GND
      </a>
    </div>
  );
}

function NodeRow({ node, depth, openSet, onToggle, onGenerate, mode, bucketIndex }) {
  const hasChildren = node.children?.length > 0;
  const isLeaf = !hasChildren;
  const isOpen = openSet.has(node.bucketKey);
  const pl = 8 + depth * 20;
  const records = isLeaf ? (bucketIndex.get(node.bucketKey) || []) : null;

  return (
    <>
      <div
        className="flex items-start gap-2 py-1.5 border-b border-stone-50 group hover:bg-stone-50 transition-colors"
        style={{ paddingLeft: pl, paddingRight: 8 }}
      >
        <button
          onClick={() => onToggle(node.bucketKey)}
          className="shrink-0 w-5 h-5 flex items-center justify-center mt-0.5"
        >
          {isOpen
            ? <span className="text-[9px] text-blue-500">▼</span>
            : <span className="text-[9px] text-stone-400 group-hover:text-blue-500">▶</span>}
        </button>
        <div className="flex-1 min-w-0 flex items-baseline gap-2">
          <CodeBadge code={node.code} />
          <span className={`leading-snug truncate ${depth === 0 ? 'font-semibold text-stone-900 text-sm' : depth === 1 ? 'font-medium text-stone-800 text-sm' : 'text-stone-700 text-xs'}`}>
            {node.label ? node.label : `DDC ${node.code}`}
          </span>
          {node.label && (
            <span className="text-[9px] font-mono text-stone-300 shrink-0">{node.code}</span>
          )}
          <span className="text-[9px] font-mono text-stone-300 shrink-0">{node.count.toLocaleString()}</span>
        </div>
      </div>

      {isOpen && hasChildren && node.children.map(child => (
        <NodeRow key={child.bucketKey} node={child} depth={depth + 1}
          openSet={openSet} onToggle={onToggle} onGenerate={onGenerate} mode={mode} bucketIndex={bucketIndex} />
      ))}

      {isOpen && isLeaf && records.slice(0, 200).map(r => (
        <RecordRow key={r.id + r.d} r={r} depth={depth} onGenerate={onGenerate} mode={mode} />
      ))}
      {isOpen && isLeaf && records.length > 200 && (
        <div style={{ paddingLeft: pl + 28 }} className="py-1 text-[9px] font-mono text-stone-300">
          +{(records.length - 200).toLocaleString()} more — use search to find a specific one
        </div>
      )}
    </>
  );
}

export default function DDCGndView({ onGenerate }) {
  const [tree,      setTree]      = useState(null);
  const [flatData,  setFlatData]  = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [mode,      setMode]      = useState('path');
  const [openSet,   setOpenSet]   = useState(new Set());
  const [search,    setSearch]    = useState('');
  const readingPath = useReadingPath();

  useEffect(() => {
    fetch('/data/ddc-gnd-hierarchy.json')
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(d => { setTree(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
    fetch('/data/ddc-gnd-flat.json')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setFlatData(d); })
      .catch(() => {});
  }, []);

  const bucketIndex = useMemo(() => {
    const map = new Map();
    if (!flatData) return map;
    for (const r of flatData) {
      if (!map.has(r.b)) map.set(r.b, []);
      map.get(r.b).push(r);
    }
    return map;
  }, [flatData]);

  const handleGenerate = useCallback((topic, m) => {
    if (m === 'path') readingPath.generate(topic);
    else onGenerate(topic, m);
  }, [onGenerate, readingPath]);

  const onToggle = bucketKey => setOpenSet(prev => {
    const next = new Set(prev);
    next.has(bucketKey) ? next.delete(bucketKey) : next.add(bucketKey);
    return next;
  });

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q || q.length < 2 || !flatData) return [];
    const out = [];
    for (const r of flatData) {
      const label = recordLabel(r);
      if (label.toLowerCase().includes(q) || r.d.includes(q) || r.id === q) {
        out.push(r);
        if (out.length >= 100) break;
      }
    }
    return out;
  }, [search, flatData]);

  if (loading) return <div className="mt-8 text-sm font-mono text-stone-400">Loading DDC–GND…</div>;
  if (error)   return <div className="mt-8 text-sm font-mono text-red-500">Error: {error}</div>;

  const totalRecords = flatData ? flatData.length : null;
  const translatedRecords = flatData ? flatData.filter(r => r.le && r.le !== r.l).length : null;

  return (
    <div className="mt-8 space-y-5">

      <div className="border-b border-stone-200 pb-4">
        <div className="flex items-baseline gap-3 mb-2 flex-wrap">
          <h2 className="text-2xl font-bold tracking-tight text-stone-900">DDC – GND Classification</h2>
          <span className="text-[8px] font-mono font-bold px-1.5 py-0.5 bg-stone-800 text-white">DNB SPARQL</span>
          {totalRecords != null && (
            <span className="text-[8px] font-mono font-bold px-1.5 py-0.5 bg-stone-700 text-white">
              {totalRecords.toLocaleString()} GND records
            </span>
          )}
          {translatedRecords != null && (
            <span className="text-[8px] font-mono font-bold px-1.5 py-0.5 bg-emerald-700 text-white">
              {translatedRecords.toLocaleString()} translated to English
            </span>
          )}
        </div>
        <p className="text-[10px] font-mono text-stone-400 mb-2">
          DDC class/division/section captions adapted from Wikipedia's{' '}
          <a href="https://en.wikipedia.org/wiki/List_of_Dewey_Decimal_classes" target="_blank" rel="noopener noreferrer" className="underline hover:text-stone-600">
            List of Dewey Decimal classes
          </a>{' '}
          (CC BY-SA 4.0) — official Dewey captions are an OCLC-licensed product and are not reproduced here.
        </p>
        <p className="text-sm text-stone-500">
          Every GND (Gemeinsame Normdatei) authority record aligned to a Dewey Decimal Classification number, sourced live from the German National Library's SPARQL endpoint.
          Select a mode, then click any entry to generate.
        </p>
      </div>

      <div>
        <p className="text-[10px] font-mono text-stone-400 uppercase tracking-widest mb-2">Generate as</p>
        <div className="flex flex-wrap gap-1.5">
          {MODES.map(m => (
            <button key={m.key} onClick={() => setMode(m.key)}
              className={`px-3 py-1.5 text-xs font-mono border transition-all ${
                mode === m.key
                  ? 'bg-stone-900 text-white border-stone-900'
                  : 'bg-white text-stone-500 border-stone-200 hover:border-stone-400 hover:text-stone-800'
              }`}>
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search GND records or DDC codes…"
        className="w-full max-w-sm px-3 py-1.5 text-sm border border-stone-300 font-mono focus:outline-none focus:border-stone-500"
      />

      {search.trim() ? (
        <div className="border border-stone-200 bg-white">
          {search.trim().length < 2
            ? <div className="p-4 text-sm text-stone-400 font-mono">Type at least 2 characters…</div>
            : !flatData
            ? <div className="p-4 text-sm text-stone-400 font-mono">Search index still loading…</div>
            : searchResults.length === 0
            ? <div className="p-4 text-sm text-stone-400 font-mono">No matches</div>
            : searchResults.map((r, i) => {
              const label = recordLabel(r);
              return (
                <div key={r.id + i} className="group flex items-center gap-2 px-3 py-2 border-b border-stone-50 hover:bg-stone-50 transition-colors">
                  <button
                    onClick={() => handleGenerate(`${label} (DDC ${r.d})`, mode)}
                    className="flex-1 flex flex-col text-left min-w-0 gap-0.5"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <CodeBadge code={r.d} />
                      <span className="text-sm text-stone-800 hover:underline decoration-stone-300 truncate">{label}</span>
                      {r.le && r.le !== r.l && (
                        <span className="text-[9px] font-mono text-stone-300 truncate">({r.l})</span>
                      )}
                    </div>
                    <span className="text-[10px] font-mono text-stone-400 pl-5 truncate">{r.t}</span>
                  </button>
                  <a
                    href={`https://lobid.org/gnd/${r.id}`}
                    target="_blank" rel="noopener noreferrer"
                    className="opacity-0 group-hover:opacity-100 shrink-0 text-[9px] font-mono px-1.5 py-0.5 border border-stone-200 text-stone-400 hover:bg-stone-800 hover:text-white hover:border-stone-800 transition-all"
                  >GND</a>
                </div>
              );
            })
          }
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(tree).map(([rootKey, nodes]) => (
            <div key={rootKey} className="border border-stone-200 bg-white">
              <div className="px-3 py-1.5 bg-stone-50 border-b border-stone-100">
                <span className="text-[9px] font-mono text-stone-500 uppercase tracking-wide">{TABLE_LABELS[rootKey] || rootKey}</span>
              </div>
              {nodes.map(root => (
                <NodeRow key={root.bucketKey} node={root} depth={0}
                  openSet={openSet} onToggle={onToggle}
                  onGenerate={handleGenerate} mode={mode} bucketIndex={bucketIndex} />
              ))}
            </div>
          ))}
        </div>
      )}

      {readingPath.status !== 'idle' && (
        <div className="border border-stone-200 bg-white">
          <div className="flex items-center justify-between px-4 py-3 border-b border-stone-200 bg-stone-50">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-xs font-mono font-bold text-stone-700 shrink-0">Reading Path</span>
              <span className="text-sm text-stone-500 truncate">{readingPath.topic}</span>
              {readingPath.status === 'loading' && (
                <span className="flex gap-0.5 shrink-0">
                  <span className="loading-dot" /><span className="loading-dot" /><span className="loading-dot" />
                </span>
              )}
            </div>
            <button
              onClick={readingPath.clear}
              className="shrink-0 text-[9px] font-mono text-stone-400 hover:text-stone-700 px-2 py-0.5 border border-stone-200 hover:border-stone-400 transition-colors"
            >
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
