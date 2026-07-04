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

// Root domains — de label used to search GND directly (no Wikidata needed for roots)
const DOMAINS = [
  { en: 'Philosophy',            de: 'Philosophie'           },
  { en: 'Mathematics',           de: 'Mathematik'            },
  { en: 'Physics',               de: 'Physik'                },
  { en: 'Chemistry',             de: 'Chemie'                },
  { en: 'Biology',               de: 'Biologie'              },
  { en: 'Computer Science',      de: 'Informatik'            },
  { en: 'Linguistics',           de: 'Linguistik'            },
  { en: 'Economics',             de: 'Wirtschaftswissenschaft'},
  { en: 'Law',                   de: 'Rechtswissenschaft'    },
  { en: 'History',               de: 'Geschichte'            },
  { en: 'Geography',             de: 'Geografie'             },
  { en: 'Psychology',            de: 'Psychologie'           },
  { en: 'Sociology',             de: 'Soziologie'            },
  { en: 'Medicine',              de: 'Medizin'               },
  { en: 'Arts',                  de: 'Kunst'                 },
  { en: 'Music',                 de: 'Musik'                 },
  { en: 'Literature',            de: 'Literatur'             },
  { en: 'Theology',              de: 'Theologie'             },
  { en: 'Political Science',     de: 'Politikwissenschaft'   },
  { en: 'Engineering',           de: 'Ingenieurwissenschaft' },
  { en: 'Architecture',          de: 'Architektur'           },
  { en: 'Education',             de: 'Erziehungswissenschaft'},
  { en: 'Anthropology',          de: 'Anthropologie'         },
  { en: 'Astronomy',             de: 'Astronomie'            },
  { en: 'Environmental Science', de: 'Umweltwissenschaft'    },
];

const ROOT_IDS = DOMAINS.map(d => 'domain-' + d.en);

// ── API helpers ───────────────────────────────────────────────────────────────

function gndSuffix(uri = '') {
  return uri.replace('https://d-nb.info/gnd/', '');
}

function fetchWithTimeout(url, ms = 12000) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(id));
}

// Search GND by German preferred name → return GND suffix like "4045791-6"
async function lobidSearchGndId(deName) {
  const params = new URLSearchParams({
    q: `preferredName:"${deName}"`,
    filter: 'type:SubjectHeading',
    format: 'json',
    size: '5',
  });
  const res = await fetchWithTimeout(`/api/gnd/search?${params}`);
  if (!res.ok) throw new Error(`lobid search HTTP ${res.status}`);
  const json = await res.json();
  const exact = json.member?.find(m => m.preferredName === deName) || json.member?.[0];
  if (!exact) throw new Error(`"${deName}" not found in GND`);
  return gndSuffix(exact.id);
}

// Fetch one GND record by its numeric ID suffix
async function fetchGND(gndId) {
  const res = await fetchWithTimeout(`/api/gnd/${gndId}`);
  if (!res.ok) throw new Error(`GND record HTTP ${res.status}`);
  return res.json();
}

// Translate GND suffixes → English via Wikidata SPARQL (proxied server-side)
async function sparqlEnglish(gndIds) {
  if (!gndIds.length) return {};
  const vals  = gndIds.slice(0, 40).map(id => `"${id}"`).join(' ');
  const query = `SELECT ?g ?label WHERE {
    VALUES ?g { ${vals} }
    ?item wdt:P227 ?g.
    ?item rdfs:label ?label.
    FILTER(LANG(?label)="en")
  }`;
  const res = await fetch(`/api/sparql?query=${encodeURIComponent(query)}`);
  if (!res.ok) return {};
  const json = await res.json();
  const out  = {};
  for (const b of json.results?.bindings || []) {
    out['https://d-nb.info/gnd/' + b.g.value] = b.label.value;
  }
  return out;
}

// ── Initial tree state ────────────────────────────────────────────────────────

function buildInitialNodes() {
  const nodes = {};
  for (const d of DOMAINS) {
    const id = 'domain-' + d.en;
    nodes[id] = {
      id,
      gndId:    null,
      de:       d.de,      // German term for lobid search
      enLabel:  d.en,
      deLabel:  d.de,
      expanded: false,
      loading:  false,
      error:    null,
      childIds: null,      // null = not yet fetched
    };
  }
  return nodes;
}

// ── TreeNode component ────────────────────────────────────────────────────────

function TreeNode({ nodeId, nodes, depth, onToggle, onGenerate, mode }) {
  const node = nodes[nodeId];
  if (!node) return null;

  const isLeaf = Array.isArray(node.childIds) && node.childIds.length === 0;
  const pl     = 8 + depth * 20;
  const showDe = node.deLabel && node.deLabel !== node.enLabel;

  return (
    <div>
      {/* Row */}
      <div
        className="flex items-start gap-2 py-1.5 border-b border-stone-50 last:border-0 hover:bg-stone-50 group transition-colors"
        style={{ paddingLeft: pl, paddingRight: 8 }}
      >
        {/* Toggle icon */}
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

        {/* Labels */}
        <div className="flex-1 min-w-0">
          <span className={`${depth === 0 ? 'font-semibold text-stone-900' : 'font-medium text-stone-800'} text-sm leading-snug`}>
            {node.enLabel}
          </span>
          {showDe && (
            <span className="ml-1.5 text-[9px] font-mono text-stone-400">{node.deLabel}</span>
          )}
          {node.error && (
            <span className="ml-2 text-[9px] font-mono text-red-400">{node.error}</span>
          )}
        </div>

        {/* Hover actions */}
        <div className="shrink-0 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          {node.gndId && (
            <a href={`https://lobid.org/gnd/${node.gndId}`} target="_blank" rel="noopener noreferrer"
              className="text-[8px] font-mono text-blue-400 hover:underline">GND↗</a>
          )}
          <button
            onClick={() => onGenerate(node.enLabel, mode)}
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

    // Collapse
    if (node.expanded) {
      setNodes(prev => ({ ...prev, [nodeId]: { ...prev[nodeId], expanded: false } }));
      return;
    }

    // Re-expand already-loaded children
    if (node.childIds !== null) {
      setNodes(prev => ({ ...prev, [nodeId]: { ...prev[nodeId], expanded: true } }));
      return;
    }

    // Start loading
    setNodes(prev => ({ ...prev, [nodeId]: { ...prev[nodeId], loading: true, error: null } }));

    try {
      // 1. Resolve GND ID (domain nodes use German name → lobid search)
      let gndId = node.gndId;
      if (!gndId) gndId = await lobidSearchGndId(node.de || node.enLabel);

      // 2. Fetch GND record
      const record   = await fetchGND(gndId);
      const narrower = [
        ...(record.narrowerTermInstantial || []),
        ...(record.narrowerTermGeneral    || []),
      ];

      // 3. Phase 1 — render German labels immediately
      const newNodes = {};
      const childIds = [];
      for (const t of narrower) {
        const cid = 'gnd-' + gndSuffix(t.id);
        newNodes[cid] = {
          id: cid, gndId: gndSuffix(t.id), de: t.label,
          enLabel: t.label, deLabel: t.label,
          expanded: false, loading: false, error: null, childIds: null,
        };
        childIds.push(cid);
      }

      setNodes(prev => ({
        ...prev,
        ...newNodes,
        [nodeId]: { ...prev[nodeId], gndId, expanded: true, loading: false, childIds },
      }));

      // 4. Phase 2 — translate to English via SPARQL (background, never throws)
      if (narrower.length > 0) {
        const suffixes = narrower.map(t => gndSuffix(t.id)).filter(Boolean);
        const enMap    = await sparqlEnglish(suffixes).catch(() => ({}));

        if (Object.keys(enMap).length > 0) {
          setNodes(prev => {
            const updates = {};
            for (const cid of childIds) {
              const child = prev[cid];
              if (!child) continue;
              const en = enMap['https://d-nb.info/gnd/' + child.gndId];
              if (en) updates[cid] = { ...child, enLabel: en };
            }
            return Object.keys(updates).length ? { ...prev, ...updates } : prev;
          });
        }
      }
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
          German National Authority File (Deutsche Nationalbibliothek). Click ▶ to expand any concept —
          German labels appear immediately, English translations load in the background via Wikidata.
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
