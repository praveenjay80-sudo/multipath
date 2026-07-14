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

const PATCHES_KEY = 'udc_new_codes';
const CHECKED_KEY = 'udc_last_checked';

function loadPatches() {
  try { return JSON.parse(localStorage.getItem(PATCHES_KEY) || '[]'); } catch { return []; }
}
function savePatches(p) {
  try { localStorage.setItem(PATCHES_KEY, JSON.stringify(p)); } catch {}
}

function titleCase(str) {
  return str.split(' ').map(w =>
    w.length > 3 ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w.toLowerCase()
  ).join(' ');
}

function timeAgo(ts) {
  if (!ts) return null;
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function CodeBadge({ code }) {
  const color = CLASS_COLORS[code[0]] || 'bg-stone-500';
  return (
    <span className={`shrink-0 text-[8px] font-mono px-1 py-0.5 text-white ${color}`}>
      {code}
    </span>
  );
}

function NodeRow({ node, depth, openSet, onToggle, onGenerate, selectedMode, activeTopic, activeStatus }) {
  const hasChildren = node.children?.length > 0;
  const isOpen = openSet.has(node.code);
  const pl = 8 + depth * 20;
  const topic = `${titleCase(node.name)} (UDC ${node.code})`;
  const isActive = activeTopic === topic && selectedMode === 'path';

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
          onClick={() => onGenerate(topic, selectedMode)}
          className="flex-1 min-w-0 flex items-baseline gap-2 text-left hover:underline decoration-stone-300"
        >
          <CodeBadge code={node.code} />
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
          <span className={`shrink-0 text-[9px] font-mono mt-0.5 ${activeStatus === 'loading' ? 'text-stone-400 animate-pulse' : 'text-stone-700'}`}>
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

      {isOpen && hasChildren && node.children.map(child => (
        <NodeRow key={child.code} node={child} depth={depth + 1}
          openSet={openSet} onToggle={onToggle} onGenerate={onGenerate}
          selectedMode={selectedMode} activeTopic={activeTopic} activeStatus={activeStatus} />
      ))}

      {isOpen && node.terms?.length > 0 && !hasChildren && (
        <div style={{ paddingLeft: pl + 28 }} className="pb-1">
          <div className="flex flex-wrap gap-1 py-1">
            {node.terms.slice(0, 40).map((t, i) => (
              <button key={i} onClick={() => onGenerate(t, selectedMode)}
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
  const [data,        setData]        = useState(null);
  const [flatData,    setFlatData]    = useState(null);   // full 63k flat list (udc-codes.json)
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const [mode,        setMode]        = useState('path');
  const [openSet,     setOpenSet]     = useState(new Set());
  const [search,      setSearch]      = useState('');
  const [newCodes,    setNewCodes]    = useState(() => loadPatches());
  const [checking,    setChecking]    = useState(false);
  const [checkError,  setCheckError]  = useState(null);
  const [newCount,    setNewCount]    = useState(0);
  const [dismissed,   setDismissed]   = useState(false);
  const [lastChecked, setLastChecked] = useState(() => {
    try { return parseInt(localStorage.getItem(CHECKED_KEY), 10) || null; } catch { return null; }
  });
  const readingPath = useReadingPath();

  useEffect(() => {
    // Load hierarchical tree
    fetch('/data/udc-full.json')
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
    // Load full flat 63k list for search + counter (optional — fails gracefully)
    fetch('/data/udc-codes.json')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setFlatData(d); })
      .catch(() => {});
  }, []);

  const handleGenerate = useCallback((topic, m) => {
    if (m === 'path') readingPath.generate(topic);
    else onGenerate(topic, m);
  }, [onGenerate, readingPath]);

  const onToggle = code => setOpenSet(prev => {
    const next = new Set(prev);
    next.has(code) ? next.delete(code) : next.add(code);
    return next;
  });

  const checkForNewCodes = async () => {
    setChecking(true);
    setCheckError(null);
    try {
      const res = await fetch('/api/udc-new-terms');
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const { entries } = await res.json();
      const existing = new Set(loadPatches().map(e => e.id));
      const fresh = entries.filter(e => !existing.has(e.id));
      const all = [...loadPatches(), ...fresh];
      savePatches(all);
      const now = Date.now();
      try { localStorage.setItem(CHECKED_KEY, now.toString()); } catch {}
      setNewCodes(all);
      setNewCount(fresh.length);
      setLastChecked(now);
      setDismissed(false);
    } catch (e) {
      setCheckError(e.message);
    } finally {
      setChecking(false);
    }
  };

  // Augment the hierarchy with flat-data entries that aren't already in the tree
  const augmentedData = useMemo(() => {
    if (!data) return null;
    if (!flatData) return data;

    const hierarchyCodes = new Set();
    function collectCodes(nodes) {
      for (const n of nodes) { hierarchyCodes.add(n.code); collectCodes(n.children || []); }
    }
    collectCodes(data);

    const knownCodes = new Set(hierarchyCodes);
    const parentToKids = {};

    // Sort ascending by code length so parents are seen before children
    const sorted = [...flatData].sort((a, b) => a.code.length - b.code.length);
    for (const entry of sorted) {
      if (hierarchyCodes.has(entry.code)) continue;
      let parentCode = null;
      for (let i = entry.code.length - 1; i > 0; i--) {
        const prefix = entry.code.slice(0, i);
        if (knownCodes.has(prefix)) { parentCode = prefix; break; }
      }
      if (!parentCode) continue;
      if (!parentToKids[parentCode]) parentToKids[parentCode] = [];
      parentToKids[parentCode].push({ code: entry.code, name: entry.label, children: [], terms: [] });
      knownCodes.add(entry.code);
    }

    function augmentNode(node) {
      const flatKids = (parentToKids[node.code] || []).map(augmentNode);
      return { ...node, children: [...(node.children || []).map(augmentNode), ...flatKids] };
    }
    return data.map(augmentNode);
  }, [data, flatData]);

  // Flatten hierarchy for search, carrying parent breadcrumb
  const allNodes = useMemo(() => {
    if (!augmentedData) return [];
    const flat = [];
    function walk(nodes, depth, parentName) {
      if (depth > 6) return;
      for (const n of nodes) {
        flat.push({ code: n.code, name: titleCase(n.name), parent: parentName });
        if (n.children?.length) walk(n.children, depth + 1, titleCase(n.name));
      }
    }
    walk(augmentedData, 0, null);
    return flat;
  }, [augmentedData]);

  // Code → name lookup for deriving parent context from flat codes
  const codeToName = useMemo(() => {
    const map = {};
    for (const n of allNodes) map[n.code] = n.name;
    return map;
  }, [allNodes]);

  function inferParent(code) {
    // Try dropping trailing segments (dots, commas, hyphens as separators)
    for (let i = code.length - 1; i > 0; i--) {
      const prefix = code.slice(0, i);
      if (codeToName[prefix]) return codeToName[prefix];
    }
    return null;
  }

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q || q.length < 2) return [];
    const baseList = flatData
      ? flatData.map(e => ({ code: e.code, name: titleCase(e.label), parent: inferParent(e.code) }))
      : allNodes;
    const baseMatches = baseList
      .filter(n => n.name.toLowerCase().includes(q) || n.code.toLowerCase().includes(q));
    const seen = new Set(baseMatches.map(n => n.code));
    const newMatches = newCodes
      .filter(e => !seen.has(e.code) && (titleCase(e.label).toLowerCase().includes(q) || e.code.toLowerCase().includes(q)))
      .map(e => ({ code: e.code, name: titleCase(e.label), parent: inferParent(e.code), isNew: true }));
    return [...baseMatches, ...newMatches].slice(0, 80);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, allNodes, flatData, newCodes, codeToName]);

  if (loading) return <div className="mt-8 text-sm font-mono text-stone-400">Loading UDC…</div>;
  if (error)   return <div className="mt-8 text-sm font-mono text-red-500">Error: {error}</div>;

  const tree = augmentedData || data;

  let totalNodes = 0, totalTerms = 0;
  function countTree(n) { totalNodes++; totalTerms += n.terms?.length || 0; n.children?.forEach(countTree); }
  data.forEach(countTree);

  // Group new codes by date for display
  const newByDate = {};
  for (const e of newCodes) {
    const d = e.addedDate || 'Unknown date';
    if (!newByDate[d]) newByDate[d] = [];
    newByDate[d].push(e);
  }

  const pathActive = readingPath.status !== 'idle';

  return (
    <div className="mt-8 flex gap-6 items-start">

      <div className={`space-y-5 min-w-0 ${pathActive ? 'flex-1' : 'w-full'}`}>

      {/* Header */}
      <div className="border-b border-stone-200 pb-4">
        <div className="flex items-baseline gap-3 mb-2">
          <h2 className="text-2xl font-bold tracking-tight text-stone-900">Universal Decimal Classification</h2>
          <span className="text-[8px] font-mono font-bold px-1.5 py-0.5 bg-stone-800 text-white">ETH-UDK</span>
          <span className="text-[8px] font-mono font-bold px-1.5 py-0.5 bg-stone-700 text-white">
            {(flatData ? flatData.length + newCodes.length : totalNodes + newCodes.length).toLocaleString()} codes
          </span>
          {newCodes.length > 0 && (
            <span className="text-[8px] font-mono font-bold px-1.5 py-0.5 bg-emerald-700 text-white">
              +{newCodes.length} new
            </span>
          )}
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <p className="text-sm text-stone-500">
            {flatData ? `${flatData.length.toLocaleString()} codes searchable` : `${totalNodes.toLocaleString()} nodes`}
            {' · '}{totalTerms.toLocaleString()} terms · 9 main classes.
            Select a mode, then click any entry to generate.
          </p>
          <button
            onClick={checkForNewCodes}
            disabled={checking}
            className="shrink-0 text-[9px] font-mono px-2.5 py-1 border border-stone-300 text-stone-600 hover:bg-stone-900 hover:text-white hover:border-stone-900 transition-all disabled:opacity-40"
          >
            {checking ? '···' : '↻ Check for New Codes'}
          </button>
          {lastChecked && (
            <span className="text-[9px] font-mono text-stone-400">Last checked {timeAgo(lastChecked)}</span>
          )}
        </div>
        {checkError && (
          <p className="text-xs text-red-600 mt-1.5 font-mono">{checkError}</p>
        )}
        {!dismissed && newCount > 0 && (
          <div className="mt-2 flex items-center gap-2 text-xs font-mono bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-emerald-800">
            <span className="font-bold">{newCount} new code{newCount !== 1 ? 's' : ''} found</span>
            <span className="text-emerald-500 ml-1">— see New Codes section below</span>
            <button onClick={() => setDismissed(true)} className="ml-auto text-stone-400 hover:text-stone-700">✕</button>
          </div>
        )}
      </div>

      {/* Mode selector */}
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

      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search UDC nodes…"
        className="w-full max-w-sm px-3 py-1.5 text-sm border border-stone-300 font-mono focus:outline-none focus:border-stone-500"
      />

      {search.trim() ? (
        /* Search results */
        <div className="border border-stone-200 bg-white">
          {search.trim().length < 2
            ? <div className="p-4 text-sm text-stone-400 font-mono">Type at least 2 characters…</div>
            : searchResults.length === 0
            ? <div className="p-4 text-sm text-stone-400 font-mono">No matches</div>
            : searchResults.map((n, i) => {
              // Context-aware topic: include parent discipline for disambiguation
              const contextTopic = n.parent
                ? `${n.name} — ${n.parent} (UDC ${n.code})`
                : `${n.name} (UDC ${n.code})`;
              return (
                <div key={i} className="group flex items-center gap-2 px-3 py-2 border-b border-stone-50 hover:bg-stone-50 transition-colors">
                  <button
                    onClick={() => handleGenerate(contextTopic, mode)}
                    className="flex-1 flex flex-col text-left min-w-0 gap-0.5"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <CodeBadge code={n.code} />
                      <span className="text-sm text-stone-800 hover:underline decoration-stone-300 truncate">{n.name}</span>
                      {n.isNew && (
                        <span className="shrink-0 text-[8px] font-mono px-1 py-0.5 bg-emerald-100 text-emerald-700 border border-emerald-200">NEW</span>
                      )}
                    </div>
                    {n.parent && (
                      <span className="text-[10px] font-mono text-stone-400 pl-5 truncate">
                        in {n.parent}
                      </span>
                    )}
                  </button>
                  <a
                    href={`https://www.worldcat.org/search?q=su%3A${encodeURIComponent(n.name)}`}
                    target="_blank" rel="noopener noreferrer"
                    className="opacity-0 group-hover:opacity-100 shrink-0 text-[9px] font-mono px-1.5 py-0.5 border border-stone-200 text-stone-400 hover:bg-stone-800 hover:text-white hover:border-stone-800 transition-all"
                  >WorldCat</a>
                </div>
              );
            })
          }
        </div>
      ) : (
        <>
          {/* Main UDC hierarchy tree */}
          <div className="border border-stone-200 bg-white">
            {tree.map(root => (
              <NodeRow key={root.code} node={root} depth={0}
                openSet={openSet} onToggle={onToggle}
                onGenerate={handleGenerate} selectedMode={mode}
                activeTopic={readingPath.topic} activeStatus={readingPath.status} />
            ))}
          </div>

          {/* New codes section */}
          {newCodes.length > 0 && (
            <div className="border border-emerald-200 bg-white">
              <div className="px-4 py-2.5 bg-emerald-50 border-b border-emerald-200 flex items-center gap-3">
                <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-emerald-700">
                  New Codes
                </span>
                <span className="text-[8px] font-mono text-emerald-500">{newCodes.length} entries</span>
              </div>
              {Object.entries(newByDate).map(([date, entries]) => (
                <div key={date}>
                  <div className="px-4 py-1.5 bg-stone-50 border-b border-stone-100">
                    <span className="text-[8px] font-mono text-stone-400 uppercase tracking-wide">{date}</span>
                  </div>
                  {entries.map((e, i) => (
                    <div key={i} className="group flex items-center gap-3 px-4 py-2 border-b border-stone-50 hover:bg-stone-50 transition-colors">
                      <button
                        onClick={() => handleGenerate(`${titleCase(e.label)} (UDC ${e.code})`, mode)}
                        className="flex-1 flex items-center gap-2 text-left min-w-0"
                      >
                        <CodeBadge code={e.code} />
                        <span className="text-sm text-stone-800 hover:underline decoration-stone-300 truncate">
                          {titleCase(e.label)}
                        </span>
                      </button>
                      <a
                        href={`https://www.worldcat.org/search?q=su%3A${encodeURIComponent(titleCase(e.label))}`}
                        target="_blank" rel="noopener noreferrer"
                        className="opacity-0 group-hover:opacity-100 shrink-0 text-[9px] font-mono px-1.5 py-0.5 border border-stone-200 text-stone-400 hover:bg-stone-800 hover:text-white hover:border-stone-800 transition-all"
                      >WorldCat</a>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      </div>

      {pathActive && (
        <div className="hidden lg:block w-[420px] shrink-0 sticky top-4 border border-stone-200 bg-white max-h-[calc(100vh-2rem)] overflow-y-auto">
          <div className="flex items-center justify-between px-4 py-3 border-b border-stone-200 bg-stone-50 sticky top-0">
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

      {pathActive && (
        <div className="lg:hidden w-full border border-stone-200 bg-white">
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
