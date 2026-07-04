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

// Top-level LCSH subject headings with known sh IDs
const DOMAINS = [
  { label: 'Philosophy',            id: 'sh85100849' },
  { label: 'Mathematics',           id: 'sh85082139' },
  { label: 'Physics',               id: 'sh85101653' },
  { label: 'Chemistry',             id: 'sh85022986' },
  { label: 'Biology',               id: 'sh85014238' },
  { label: 'Computer Science',      id: 'sh89003287' },
  { label: 'Linguistics',           id: 'sh85077222' },
  { label: 'Economics',             id: 'sh85040939' },
  { label: 'Law',                   id: 'sh85075116' },
  { label: 'History',               id: 'sh85061232' },
  { label: 'Geography',             id: 'sh85053986' },
  { label: 'Psychology',            id: 'sh85108459' },
  { label: 'Sociology',             id: 'sh85123889' },
  { label: 'Medicine',              id: 'sh85083063' },
  { label: 'Music',                 id: 'sh85088762' },
  { label: 'Literature',            id: 'sh85077507' },
  { label: 'Religion',              id: 'sh85112549' },
  { label: 'Political Science',     id: 'sh85104440' },
  { label: 'Engineering',           id: 'sh85043235' },
  { label: 'Architecture',          id: 'sh85006507' },
  { label: 'Education',             id: 'sh85040989' },
  { label: 'Anthropology',          id: 'sh85005516' },
  { label: 'Astronomy',             id: 'sh85009003' },
  { label: 'Environmental Sciences',id: 'sh85044203' },
  { label: 'Social Sciences',       id: 'sh85123900' },
];

const ROOT_IDS = DOMAINS.map(d => 'lcsh-' + d.id);

// ── API ───────────────────────────────────────────────────────────────────────

async function fetchChildren(lcshId) {
  const res = await fetch(`/api/lcsh/${lcshId}`);
  if (!res.ok) throw new Error(`LCSH HTTP ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(json.error);
  return json.narrower || [];
}

// ── Initial state ─────────────────────────────────────────────────────────────

function buildInitialNodes() {
  const nodes = {};
  for (const d of DOMAINS) {
    const id = 'lcsh-' + d.id;
    nodes[id] = {
      id, lcshId: d.id, label: d.label,
      expanded: false, loading: false, error: null, childIds: null,
    };
  }
  return nodes;
}

// ── TreeNode ──────────────────────────────────────────────────────────────────

function TreeNode({ nodeId, nodes, depth, onToggle, onGenerate, mode }) {
  const node = nodes[nodeId];
  if (!node) return null;

  const isLeaf = Array.isArray(node.childIds) && node.childIds.length === 0;
  const pl     = 8 + depth * 20;

  return (
    <div>
      <div
        className="flex items-start gap-2 py-1.5 border-b border-stone-50 last:border-0 hover:bg-stone-50 group transition-colors"
        style={{ paddingLeft: pl, paddingRight: 8 }}
      >
        <button
          onClick={() => onToggle(nodeId)}
          disabled={node.loading || isLeaf}
          className="shrink-0 w-5 h-5 flex items-center justify-center mt-0.5 disabled:cursor-default"
        >
          {node.loading
            ? <span className="text-[10px] text-blue-400 animate-pulse font-mono">⋯</span>
            : isLeaf
            ? <span className="text-[9px] text-stone-200">·</span>
            : node.expanded
            ? <span className="text-[9px] text-blue-500">▼</span>
            : <span className="text-[9px] text-stone-400 group-hover:text-blue-500">▶</span>}
        </button>

        <div className="flex-1 min-w-0">
          <span className={`${depth === 0 ? 'font-semibold text-stone-900' : 'font-medium text-stone-800'} text-sm leading-snug`}>
            {node.label}
          </span>
          {node.error && (
            <span className="ml-2 text-[9px] font-mono text-red-400">{node.error}</span>
          )}
        </div>

        <div className="shrink-0 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          {node.lcshId && (
            <a
              href={`https://id.loc.gov/authorities/subjects/${node.lcshId}.html`}
              target="_blank" rel="noopener noreferrer"
              className="text-[8px] font-mono text-blue-400 hover:underline"
            >LC↗</a>
          )}
          <button
            onClick={() => onGenerate(node.label, mode)}
            className="text-[8px] font-mono px-2 py-0.5 bg-stone-900 text-white hover:bg-stone-700 transition-colors"
          >
            → {MODES.find(m => m.key === mode)?.label || 'Canon'}
          </button>
        </div>
      </div>

      {node.expanded && node.childIds?.length > 0 && (
        <div>
          {node.childIds.map(cid => (
            <TreeNode key={cid} nodeId={cid} nodes={nodes} depth={depth + 1}
              onToggle={onToggle} onGenerate={onGenerate} mode={mode} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

export default function KeywordsView({ onGenerate }) {
  const [mode,  setMode]  = useState('canon');
  const [nodes, setNodes] = useState(buildInitialNodes);

  const toggleNode = useCallback(async (nodeId) => {
    const node = nodes[nodeId];
    if (!node || node.loading) return;

    if (node.expanded) {
      setNodes(prev => ({ ...prev, [nodeId]: { ...prev[nodeId], expanded: false } }));
      return;
    }
    if (node.childIds !== null) {
      setNodes(prev => ({ ...prev, [nodeId]: { ...prev[nodeId], expanded: true } }));
      return;
    }

    setNodes(prev => ({ ...prev, [nodeId]: { ...prev[nodeId], loading: true, error: null } }));

    try {
      const children = await fetchChildren(node.lcshId);

      const newNodes = {};
      const childIds = [];
      for (const c of children) {
        const cid = 'lcsh-' + c.id;
        newNodes[cid] = {
          id: cid, lcshId: c.id, label: c.label,
          expanded: false, loading: false, error: null, childIds: null,
        };
        childIds.push(cid);
      }

      setNodes(prev => ({
        ...prev,
        ...newNodes,
        [nodeId]: { ...prev[nodeId], expanded: true, loading: false, childIds },
      }));
    } catch (e) {
      setNodes(prev => ({
        ...prev,
        [nodeId]: { ...prev[nodeId], loading: false, error: e.message },
      }));
    }
  }, [nodes]);

  return (
    <div className="mt-8 space-y-6">
      <div className="border-b border-stone-200 pb-4">
        <div className="flex items-baseline gap-3 mb-1">
          <h2 className="text-2xl font-bold tracking-tight text-stone-900">Subject Vocabulary</h2>
          <span className="text-[8px] font-mono font-bold px-1.5 py-0.5 bg-red-700 text-white">LCSH</span>
        </div>
        <p className="text-sm text-stone-500 max-w-2xl leading-relaxed">
          Library of Congress Subject Headings — the authoritative controlled vocabulary for academic subjects.
          Click ▶ to expand any heading into its narrower terms.
        </p>
      </div>

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

      <div className="flex gap-4 text-[9px] font-mono text-stone-400">
        <span><span className="text-blue-500">▶</span> expand · <span className="text-blue-500">▼</span> collapse · <span className="text-stone-300">·</span> leaf</span>
        <span className="text-stone-300">hover any row for Generate button · LC↗ opens LOC record</span>
      </div>

      <div className="border border-stone-200 bg-white">
        {ROOT_IDS.map(id => (
          <TreeNode key={id} nodeId={id} nodes={nodes} depth={0}
            onToggle={toggleNode} onGenerate={onGenerate} mode={mode} />
        ))}
      </div>
    </div>
  );
}
