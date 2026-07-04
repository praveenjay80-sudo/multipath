import { useState, useMemo } from 'react';
import { roots as RAW } from '../data/tesamat.json';

const MODES = [
  { key: 'canon',        label: 'Canon' },
  { key: 'curriculum',   label: 'Curriculum' },
  { key: 'dissertation', label: 'Dissertation' },
  { key: 'drift',        label: 'Drift' },
  { key: 'consilience',  label: 'Consilience' },
  { key: 'inquiry',      label: 'Inquiry' },
  { key: 'reverse',      label: 'Prerequisites' },
];

// ── Row ───────────────────────────────────────────────────────────────────────

function Row({ node, depth, open, onToggle, onGenerate, mode }) {
  const hasChildren = node.children?.length > 0;
  const pl = 8 + depth * 18;
  const modeLabel = MODES.find(m => m.key === mode)?.label || 'Canon';

  return (
    <div
      className="flex items-start gap-2 py-1 border-b border-stone-50 last:border-0 hover:bg-stone-50 group transition-colors"
      style={{ paddingLeft: pl, paddingRight: 8 }}
    >
      <button
        onClick={() => hasChildren && onToggle(node.es)}
        disabled={!hasChildren}
        className="shrink-0 w-5 h-5 flex items-center justify-center mt-0.5 disabled:cursor-default"
      >
        {hasChildren
          ? open
            ? <span className="text-[9px] text-blue-500">▼</span>
            : <span className="text-[9px] text-stone-400 group-hover:text-blue-500">▶</span>
          : <span className="text-[9px] text-stone-200">·</span>}
      </button>

      <div className="flex-1 min-w-0">
        <span className={`${depth === 0 ? 'font-semibold text-stone-900 text-sm' : depth === 1 ? 'font-medium text-stone-800 text-sm' : 'text-stone-700 text-xs'} leading-snug`}>
          {node.en}
        </span>
        {node.es !== node.en && (
          <span className="ml-1.5 text-[9px] font-mono text-stone-400">{node.es}</span>
        )}
      </div>

      <div className="shrink-0 flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onGenerate(node.en, mode)}
          className="text-[8px] font-mono px-2 py-0.5 bg-stone-900 text-white hover:bg-stone-700 transition-colors"
        >
          → {modeLabel}
        </button>
      </div>
    </div>
  );
}

function SubTree({ nodes, depth, openSet, onToggle, onGenerate, mode }) {
  return nodes.map(node => (
    <div key={node.es}>
      <Row node={node} depth={depth} open={openSet.has(node.es)}
        onToggle={onToggle} onGenerate={onGenerate} mode={mode} />
      {openSet.has(node.es) && node.children?.length > 0 && (
        <SubTree nodes={node.children} depth={depth + 1}
          openSet={openSet} onToggle={onToggle} onGenerate={onGenerate} mode={mode} />
      )}
    </div>
  ));
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function KeywordsView({ onGenerate }) {
  const [mode,    setMode]    = useState('canon');
  const [openSet, setOpenSet] = useState(new Set());
  const [search,  setSearch]  = useState('');

  const onToggle = (key) => setOpenSet(prev => {
    const next = new Set(prev);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  });

  // Flatten all nodes for search
  const allNodes = useMemo(() => {
    const flat = [];
    function walk(nodes, breadcrumb) {
      for (const n of nodes) {
        flat.push({ ...n, breadcrumb });
        if (n.children?.length) walk(n.children, [...breadcrumb, n.en]);
      }
    }
    RAW.forEach(root => walk([root], []));
    return flat;
  }, []);

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return allNodes.filter(n =>
      n.en.toLowerCase().includes(q) || n.es.toLowerCase().includes(q)
    ).slice(0, 40);
  }, [search, allNodes]);

  return (
    <div className="mt-8 space-y-6">
      {/* Header */}
      <div className="border-b border-stone-200 pb-4">
        <div className="flex items-baseline gap-3 mb-1">
          <h2 className="text-2xl font-bold tracking-tight text-stone-900">Mathematics Vocabulary</h2>
          <span className="text-[8px] font-mono font-bold px-1.5 py-0.5 bg-blue-700 text-white">Tesamat</span>
        </div>
        <p className="text-sm text-stone-500 max-w-2xl leading-relaxed">
          UCM Mathematics Thesaurus — 998 terms with broader/narrower relationships.
          Click ▶ to expand. Hover any row to generate a reading list.
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
        placeholder="Search terms…"
        className="w-full max-w-sm px-3 py-1.5 text-sm border border-stone-300 font-mono focus:outline-none focus:border-stone-500"
      />

      {/* Results / Tree */}
      {search.trim() ? (
        <div className="border border-stone-200 bg-white">
          {searchResults.length === 0
            ? <div className="p-4 text-sm text-stone-400 font-mono">No matches</div>
            : searchResults.map(n => (
              <div key={n.es}
                className="flex items-start gap-2 py-1.5 px-3 border-b border-stone-50 hover:bg-stone-50 group transition-colors">
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-stone-800">{n.en}</span>
                  {n.es !== n.en && <span className="ml-1.5 text-[9px] font-mono text-stone-400">{n.es}</span>}
                  {n.breadcrumb.length > 0 && (
                    <span className="ml-2 text-[9px] text-stone-400">{n.breadcrumb.join(' › ')}</span>
                  )}
                </div>
                <button
                  onClick={() => onGenerate(n.en, mode)}
                  className="shrink-0 text-[8px] font-mono px-2 py-0.5 bg-stone-900 text-white hover:bg-stone-700 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  → {MODES.find(m => m.key === mode)?.label || 'Canon'}
                </button>
              </div>
            ))}
        </div>
      ) : (
        <div className="border border-stone-200 bg-white">
          <SubTree nodes={RAW} depth={0}
            openSet={openSet} onToggle={onToggle} onGenerate={onGenerate} mode={mode} />
        </div>
      )}
    </div>
  );
}
