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

// Root domains — English label + Wikidata Q-ID for GND resolution
const DOMAINS = [
  { en: 'Philosophy',           qid: 'Q5891'    },
  { en: 'Mathematics',          qid: 'Q395'     },
  { en: 'Physics',              qid: 'Q413'     },
  { en: 'Chemistry',            qid: 'Q2329'    },
  { en: 'Biology',              qid: 'Q420'     },
  { en: 'Computer Science',     qid: 'Q21198'   },
  { en: 'Linguistics',          qid: 'Q8162'    },
  { en: 'Economics',            qid: 'Q8134'    },
  { en: 'Law',                  qid: 'Q7748'    },
  { en: 'History',              qid: 'Q309'     },
  { en: 'Geography',            qid: 'Q1071'    },
  { en: 'Psychology',           qid: 'Q9418'    },
  { en: 'Sociology',            qid: 'Q21201'   },
  { en: 'Medicine',             qid: 'Q11190'   },
  { en: 'Arts',                 qid: 'Q735'     },
  { en: 'Music',                qid: 'Q638'     },
  { en: 'Literature',           qid: 'Q8242'    },
  { en: 'Theology',             qid: 'Q34178'   },
  { en: 'Political Science',    qid: 'Q36442'   },
  { en: 'Engineering',          qid: 'Q11023'   },
  { en: 'Architecture',         qid: 'Q12271'   },
  { en: 'Education',            qid: 'Q8434'    },
  { en: 'Anthropology',         qid: 'Q23404'   },
  { en: 'Astronomy',            qid: 'Q333'     },
  { en: 'Environmental Science',qid: 'Q2027596' },
];

// ── API pipeline ──────────────────────────────────────────────────────────────

function gndSuffix(uri) {
  return (uri || '').replace('https://d-nb.info/gnd/', '');
}

// Q-ID → GND identifier (P227)
async function wdGetGndId(qid) {
  const res = await fetch(
    `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${qid}&props=claims&format=json&origin=*`
  );
  if (!res.ok) throw new Error(`Wikidata: HTTP ${res.status}`);
  const json = await res.json();
  return json.entities?.[qid]?.claims?.P227?.[0]?.mainsnak?.datavalue?.value || null;
}

// Fetch GND record by numeric suffix like "4038936-4"
async function fetchGNDRecord(gndId) {
  const res = await fetch(`https://lobid.org/gnd/${gndId}?format=json`);
  if (!res.ok) throw new Error(`GND: HTTP ${res.status}`);
  return res.json();
}

// Batch-translate GND suffixes → English via one Wikidata SPARQL call
async function sparqlEnglish(gndIds) {
  if (!gndIds.length) return {};
  const vals = gndIds.slice(0, 40).map(id => `"${id}"`).join(' ');
  const query = `SELECT ?g ?label WHERE {
    VALUES ?g { ${vals} }
    ?item wdt:P227 ?g.
    ?item rdfs:label ?label.
    FILTER(LANG(?label)="en")
  }`;
  const res = await fetch(
    `https://query.wikidata.org/sparql?query=${encodeURIComponent(query)}&format=json`,
    { headers: { Accept: 'application/sparql-results+json' } }
  );
  if (!res.ok) return {};
  const json = await res.json();
  const out = {};
  for (const b of json.results?.bindings || []) {
    // key = full GND URI so it matches term.id in GND records
    out['https://d-nb.info/gnd/' + b.g.value] = b.label.value;
  }
  return out;
}

// Load children for a node: fetch GND record → get narrower terms → get English labels
async function loadChildren(node) {
  let gndId = node.gndId;

  // If domain node, resolve GND ID via Wikidata first
  if (!gndId && node.qid) {
    gndId = await wdGetGndId(node.qid);
    if (!gndId) throw new Error(`No GND entry found for ${node.enLabel}`);
  }

  const record  = await fetchGNDRecord(gndId);
  const narrower = [
    ...(record.narrowerTermInstantial || []),
    ...(record.narrowerTermGeneral    || []),
  ];

  // Batch-fetch English labels from Wikidata in one SPARQL call
  const suffixes = narrower.map(t => gndSuffix(t.id)).filter(Boolean);
  const enMap    = await sparqlEnglish(suffixes).catch(() => ({}));

  const children = narrower.map(t => ({
    id:      'gnd-' + gndSuffix(t.id),
    gndId:   gndSuffix(t.id),
    qid:     null,
    enLabel: enMap[t.id] || t.label,   // English if found, German fallback
    deLabel: t.label,
    expanded:     false,
    loading:      false,
    error:        null,
    childIds:     null,   // null = not yet loaded
    hasChildren:  true,   // assume yes until proven leaf
  }));

  return { gndId, children };
}

// ── Initial flat node map ─────────────────────────────────────────────────────

function buildInitialNodes() {
  const nodes = {};
  for (const d of DOMAINS) {
    const id = 'domain-' + d.en;
    nodes[id] = {
      id,
      gndId:    null,
      qid:      d.qid,
      enLabel:  d.en,
      deLabel:  '',
      expanded: false,
      loading:  false,
      error:    null,
      childIds: null,
    };
  }
  return nodes;
}

const ROOT_IDS = DOMAINS.map(d => 'domain-' + d.en);

// ── Tree node component ───────────────────────────────────────────────────────

function TreeNode({ nodeId, nodes, depth, onToggle, onGenerate, mode }) {
  const node = nodes[nodeId];
  if (!node) return null;

  const indent = depth * 20;
  const isLeaf = Array.isArray(node.childIds) && node.childIds.length === 0;
  const showEnglish = node.enLabel;
  const showGerman  = node.deLabel && node.deLabel !== node.enLabel;

  return (
    <div>
      <div
        className="flex items-start gap-2 py-1.5 border-b border-stone-50 last:border-0 hover:bg-stone-50 group transition-colors"
        style={{ paddingLeft: `${8 + indent}px`, paddingRight: '8px' }}
      >
        {/* Expand toggle */}
        <button
          onClick={() => onToggle(nodeId)}
          disabled={node.loading || isLeaf}
          className="shrink-0 w-5 h-5 flex items-center justify-center text-stone-400 hover:text-blue-600 disabled:cursor-default mt-0.5"
          title={isLeaf ? 'Leaf concept' : node.expanded ? 'Collapse' : 'Expand'}
        >
          {node.loading
            ? <span className="text-[10px] animate-pulse text-blue-400">⋯</span>
            : isLeaf
            ? <span className="text-[10px] text-stone-200">·</span>
            : node.expanded
            ? <span className="text-[9px] text-blue-500">▼</span>
            : <span className="text-[9px] text-stone-400 group-hover:text-blue-500">▶</span>
          }
        </button>

        {/* Labels */}
        <div className="flex-1 min-w-0">
          <span
            className={`text-sm ${depth === 0 ? 'font-semibold text-stone-900' : 'font-medium text-stone-800'} leading-snug`}
          >
            {showEnglish}
          </span>
          {showGerman && (
            <span className="ml-1.5 text-[10px] font-mono text-stone-400">{node.deLabel}</span>
          )}
          {node.error && (
            <span className="ml-2 text-[9px] font-mono text-red-400">{node.error}</span>
          )}
        </div>

        {/* Actions — show on hover */}
        <div className="shrink-0 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <a
            href={node.gndId ? `https://lobid.org/gnd/${node.gndId}` : '#'}
            target="_blank" rel="noopener noreferrer"
            onClick={e => { if (!node.gndId) e.preventDefault(); }}
            className="text-[8px] font-mono text-blue-400 hover:underline self-center"
          >
            GND↗
          </a>
          <button
            onClick={() => onGenerate(node.enLabel, mode)}
            className="text-[8px] font-mono px-2 py-0.5 bg-stone-900 text-white hover:bg-stone-700 transition-colors"
          >
            → {MODES.find(m => m.key === mode)?.label || 'Canon'}
          </button>
        </div>
      </div>

      {/* Children */}
      {node.expanded && node.childIds && node.childIds.length > 0 && (
        <div>
          {node.childIds.map(cid => (
            <TreeNode
              key={cid}
              nodeId={cid}
              nodes={nodes}
              depth={depth + 1}
              onToggle={onToggle}
              onGenerate={onGenerate}
              mode={mode}
            />
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

    // Collapse if already open
    if (node.expanded) {
      setNodes(prev => ({ ...prev, [nodeId]: { ...prev[nodeId], expanded: false } }));
      return;
    }

    // If children already loaded, just open
    if (node.childIds !== null) {
      setNodes(prev => ({ ...prev, [nodeId]: { ...prev[nodeId], expanded: true } }));
      return;
    }

    // Mark loading
    setNodes(prev => ({ ...prev, [nodeId]: { ...prev[nodeId], loading: true, error: null } }));

    try {
      const { gndId, children } = await loadChildren(node);

      const newNodes = {};
      const childIds = [];
      for (const child of children) {
        newNodes[child.id] = child;
        childIds.push(child.id);
      }

      setNodes(prev => ({
        ...prev,
        ...newNodes,
        [nodeId]: {
          ...prev[nodeId],
          gndId:    gndId || prev[nodeId].gndId,
          expanded: true,
          loading:  false,
          childIds,
        },
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
          <h2 className="text-2xl font-bold tracking-tight text-stone-900">GND Concept Hierarchy</h2>
          <span className="text-[8px] font-mono font-bold px-1.5 py-0.5 bg-blue-600 text-white">GND</span>
        </div>
        <p className="text-sm text-stone-500 max-w-2xl leading-relaxed">
          German National Authority File — click ▶ to expand any concept. GND is searched in German;
          all labels are translated to English via Wikidata automatically.
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

      {/* Legend */}
      <div className="flex items-center gap-4 text-[9px] font-mono text-stone-400">
        <span><span className="text-blue-500">▶</span> expand</span>
        <span><span className="text-blue-500">▼</span> collapse</span>
        <span><span className="text-stone-200">·</span> leaf node</span>
        <span className="text-stone-300">hover any row to see Generate button</span>
      </div>

      {/* Tree */}
      <div className="border border-stone-200 bg-white">
        {ROOT_IDS.map(id => (
          <TreeNode
            key={id}
            nodeId={id}
            nodes={nodes}
            depth={0}
            onToggle={toggleNode}
            onGenerate={onGenerate}
            mode={mode}
          />
        ))}
      </div>
    </div>
  );
}
