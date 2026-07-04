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

// Top-level academic domains with Wikidata QIDs
const DOMAINS = [
  { label: 'Philosophy',            qid: 'Q5891'   },
  { label: 'Mathematics',           qid: 'Q395'    },
  { label: 'Physics',               qid: 'Q413'    },
  { label: 'Chemistry',             qid: 'Q2329'   },
  { label: 'Biology',               qid: 'Q420'    },
  { label: 'Computer Science',      qid: 'Q21198'  },
  { label: 'Linguistics',           qid: 'Q8162'   },
  { label: 'Economics',             qid: 'Q8134'   },
  { label: 'Law',                   qid: 'Q7748'   },
  { label: 'History',               qid: 'Q309'    },
  { label: 'Geography',             qid: 'Q1071'   },
  { label: 'Psychology',            qid: 'Q9418'   },
  { label: 'Sociology',             qid: 'Q21201'  },
  { label: 'Medicine',              qid: 'Q11190'  },
  { label: 'Arts',                  qid: 'Q735'    },
  { label: 'Music',                 qid: 'Q638'    },
  { label: 'Literature',            qid: 'Q8242'   },
  { label: 'Theology',              qid: 'Q34178'  },
  { label: 'Political Science',     qid: 'Q36442'  },
  { label: 'Engineering',           qid: 'Q11023'  },
  { label: 'Architecture',          qid: 'Q12271'  },
  { label: 'Education',             qid: 'Q8434'   },
  { label: 'Anthropology',          qid: 'Q23404'  },
  { label: 'Astronomy',             qid: 'Q333'    },
  { label: 'Environmental Science', qid: 'Q188847' },
];

// ── API ───────────────────────────────────────────────────────────────────────

async function fetchSubfields(qid) {
  const query = `SELECT DISTINCT ?item ?label WHERE {
    ?item wdt:P279 wd:${qid}.
    ?item rdfs:label ?label.
    FILTER(LANG(?label)="en")
  } ORDER BY ?label LIMIT 80`;

  const res = await fetch(`/api/sparql?query=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error(`SPARQL HTTP ${res.status}`);
  const json = await res.json();
  return json.results?.bindings?.map(b => ({
    label: b.label.value,
    qid:   b.item.value.replace('http://www.wikidata.org/entity/', ''),
  })) || [];
}

// ── Initial tree state ────────────────────────────────────────────────────────

function buildInitialNodes() {
  const nodes = {};
  for (const d of DOMAINS) {
    const id = 'domain-' + d.qid;
    nodes[id] = {
      id, qid: d.qid, label: d.label,
      expanded: false, loading: false, error: null, childIds: null,
    };
  }
  return nodes;
}

const ROOT_IDS = DOMAINS.map(d => 'domain-' + d.qid);

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
        {/* Toggle */}
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

        {/* Label */}
        <div className="flex-1 min-w-0">
          <span className={`${depth === 0 ? 'font-semibold text-stone-900' : 'font-medium text-stone-800'} text-sm leading-snug`}>
            {node.label}
          </span>
          {node.error && (
            <span className="ml-2 text-[9px] font-mono text-red-400">{node.error}</span>
          )}
        </div>

        {/* Hover actions */}
        <div className="shrink-0 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <a
            href={`https://www.wikidata.org/wiki/${node.qid}`}
            target="_blank" rel="noopener noreferrer"
            className="text-[8px] font-mono text-blue-400 hover:underline"
          >WD↗</a>
          <button
            onClick={() => onGenerate(node.label, mode)}
            className="text-[8px] font-mono px-2 py-0.5 bg-stone-900 text-white hover:bg-stone-700 transition-colors"
          >
            → {MODES.find(m => m.key === mode)?.label || 'Canon'}
          </button>
        </div>
      </div>

      {/* Children */}
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
      const results = await fetchSubfields(node.qid);

      const newNodes = {};
      const childIds = [];
      for (const r of results) {
        const cid = 'wd-' + r.qid;
        newNodes[cid] = {
          id: cid, qid: r.qid, label: r.label,
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
      {/* Header */}
      <div className="border-b border-stone-200 pb-4">
        <div className="flex items-baseline gap-3 mb-1">
          <h2 className="text-2xl font-bold tracking-tight text-stone-900">Subject Vocabulary</h2>
          <span className="text-[8px] font-mono font-bold px-1.5 py-0.5 bg-blue-600 text-white">Wikidata</span>
        </div>
        <p className="text-sm text-stone-500 max-w-2xl leading-relaxed">
          Academic discipline hierarchy from Wikidata. Click ▶ to expand any subject into its subfields.
          Click → to generate a reading list for any concept.
        </p>
      </div>

      {/* Mode */}
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

      {/* Legend */}
      <div className="flex gap-4 text-[9px] font-mono text-stone-400">
        <span><span className="text-blue-500">▶</span> expand · <span className="text-blue-500">▼</span> collapse · <span className="text-stone-300">·</span> leaf</span>
        <span className="text-stone-300">hover any row for Generate button</span>
      </div>

      {/* Tree */}
      <div className="border border-stone-200 bg-white">
        {ROOT_IDS.map(id => (
          <TreeNode key={id} nodeId={id} nodes={nodes} depth={0}
            onToggle={toggleNode} onGenerate={onGenerate} mode={mode} />
        ))}
      </div>
    </div>
  );
}
