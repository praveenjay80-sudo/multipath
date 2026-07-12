import { useState, useMemo } from 'react';

const MODES = [
  { key: 'canon',        label: 'Canon',         color: 'text-blue-700    bg-blue-50    hover:bg-blue-100    border-blue-200'    },
  { key: 'curriculum',   label: 'Curriculum',    color: 'text-sky-700     bg-sky-50     hover:bg-sky-100     border-sky-200'     },
  { key: 'dissertation', label: 'Dissertation',  color: 'text-indigo-700  bg-indigo-50  hover:bg-indigo-100  border-indigo-200'  },
  { key: 'reverse',      label: 'Prerequisites', color: 'text-violet-700  bg-violet-50  hover:bg-violet-100  border-violet-200'  },
  { key: 'drift',        label: 'Canon Drift',   color: 'text-amber-700   bg-amber-50   hover:bg-amber-100   border-amber-200'   },
  { key: 'consilience',  label: 'Consilience',   color: 'text-teal-700    bg-teal-50    hover:bg-teal-100    border-teal-200'    },
  { key: 'inquiry',      label: 'Inquiry',       color: 'text-rose-700    bg-rose-50    hover:bg-rose-100    border-rose-200'    },
  { key: 'spectrum',     label: 'Spectrum',      color: 'text-cyan-700    bg-cyan-50    hover:bg-cyan-100    border-cyan-200'    },
  { key: 'intelligence', label: 'Field Intel',   color: 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-200' },
];

const ExternalIcon = () => (
  <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
    <path d="M5 2H2a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    <path d="M8 1h3m0 0v3m0-3L5.5 6.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

function academiaUrl(slug) {
  return `https://www.academia.edu/Documents/in/${slug}`;
}

function ModePicker({ name, onSelect, onClose }) {
  return (
    <div className="px-4 pb-3 pt-2 bg-stone-50 border-t border-stone-100">
      <p className="text-xs text-stone-400 mb-2 font-mono">Generate with:</p>
      <div className="flex flex-wrap gap-1.5">
        {MODES.map(m => (
          <button
            key={m.key}
            onClick={() => { onClose(); onSelect(name, m.key); }}
            className={`text-xs px-2 py-1 border rounded-sm transition-colors ${m.color}`}
          >
            {m.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function L3Row({ name, slug, onSelect }) {
  const [modeOpen, setModeOpen] = useState(false);
  return (
    <div>
      <div className="flex items-center gap-1 group pl-14 pr-3 py-1 hover:bg-stone-50 transition-colors">
        <span className="text-stone-200 text-xs shrink-0 w-3 text-center select-none">·</span>
        <button
          onClick={() => setModeOpen(o => !o)}
          className="flex-1 text-left text-xs text-stone-500 hover:text-stone-900 transition-colors leading-snug"
        >
          {name}
        </button>
        <a
          href={academiaUrl(slug)}
          target="_blank"
          rel="noreferrer"
          onClick={e => e.stopPropagation()}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-stone-300 hover:text-stone-600 shrink-0 ml-1"
          title="Open on Academia.edu"
        >
          <ExternalIcon />
        </a>
      </div>
      {modeOpen && (
        <ModePicker name={name} onSelect={onSelect} onClose={() => setModeOpen(false)} />
      )}
    </div>
  );
}

function L2Row({ name, slug, children, slugs, onSelect, expanded, onToggleExpand }) {
  const [modeOpen, setModeOpen] = useState(false);
  const kids = children[name] || [];
  const hasKids = kids.length > 0;
  const [showAll, setShowAll] = useState(false);
  const LIMIT = 100;
  const visible = showAll ? kids : kids.slice(0, LIMIT);

  return (
    <div>
      <div className="flex items-center gap-1 group pl-5 pr-3 py-1.5 hover:bg-stone-50 transition-colors">
        {hasKids ? (
          <button
            onClick={onToggleExpand}
            className="shrink-0 text-stone-300 hover:text-stone-600 transition-colors w-4 flex items-center justify-center"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none"
              className={`transition-transform ${expanded ? 'rotate-90' : ''}`}
            >
              <path d="M3 2l4 3-4 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        ) : (
          <span className="text-stone-200 text-xs shrink-0 w-4 text-center select-none">—</span>
        )}
        <button
          onClick={() => setModeOpen(o => !o)}
          className="flex-1 text-left text-sm text-stone-700 hover:text-stone-900 transition-colors leading-snug"
        >
          {name}
        </button>
        {hasKids && (
          <span className="text-xs font-mono text-stone-300 shrink-0">{kids.length}</span>
        )}
        <a
          href={academiaUrl(slug)}
          target="_blank"
          rel="noreferrer"
          onClick={e => e.stopPropagation()}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-stone-300 hover:text-stone-600 shrink-0 ml-1"
          title="Open on Academia.edu"
        >
          <ExternalIcon />
        </a>
      </div>

      {modeOpen && (
        <ModePicker name={name} onSelect={onSelect} onClose={() => setModeOpen(false)} />
      )}

      {expanded && hasKids && (
        <div className="border-t border-stone-50">
          {visible.map(kid => (
            <L3Row key={kid} name={kid} slug={slugs[kid] || kid} onSelect={onSelect} />
          ))}
          {!showAll && kids.length > LIMIT && (
            <button
              onClick={() => setShowAll(true)}
              className="pl-14 py-1 text-xs text-stone-400 hover:text-stone-600 font-mono"
            >
              +{kids.length - LIMIT} more...
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function DisciplineRow({ name, slug, children, slugs, onSelect, expanded, onToggleExpand, expandedL2s, onToggleL2 }) {
  const [modeOpen, setModeOpen] = useState(false);
  const kids = children[name] || [];
  const hasKids = kids.length > 0;

  return (
    <div className="border border-stone-200">
      <div className="flex items-center group px-4 py-3 hover:bg-stone-50 transition-colors">
        <button
          onClick={() => setModeOpen(o => !o)}
          className="flex-1 text-left flex items-center gap-3 min-w-0"
        >
          <span className="text-sm font-semibold text-stone-800 truncate">{name}</span>
          {hasKids && (
            <span className="text-xs font-mono text-stone-400 bg-stone-100 px-1.5 py-0.5 shrink-0">
              {kids.length}
            </span>
          )}
        </button>
        <a
          href={academiaUrl(slug)}
          target="_blank"
          rel="noreferrer"
          onClick={e => e.stopPropagation()}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-stone-300 hover:text-stone-600 mr-3 shrink-0"
          title="Open on Academia.edu"
        >
          <ExternalIcon />
        </a>
        {hasKids && (
          <button
            onClick={onToggleExpand}
            className="text-stone-400 hover:text-stone-700 transition-colors shrink-0"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
              className={`transition-transform ${expanded ? 'rotate-180' : ''}`}
            >
              <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="square" strokeLinejoin="miter"/>
            </svg>
          </button>
        )}
      </div>

      {modeOpen && (
        <ModePicker name={name} onSelect={onSelect} onClose={() => setModeOpen(false)} />
      )}

      {expanded && hasKids && (
        <div className="border-t border-stone-100 divide-y divide-stone-50">
          {kids.map(kid => (
            <L2Row
              key={kid}
              name={kid}
              slug={slugs[kid] || kid}
              children={children}
              slugs={slugs}
              onSelect={onSelect}
              expanded={expandedL2s.has(kid)}
              onToggleExpand={() => onToggleL2(kid)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SearchRow({ name, slug, onSelect }) {
  const [modeOpen, setModeOpen] = useState(false);
  return (
    <div>
      <div className="flex items-center gap-2 group px-4 py-2 hover:bg-stone-50 transition-colors">
        <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-stone-300" />
        <button
          onClick={() => setModeOpen(o => !o)}
          className="flex-1 text-left text-sm text-stone-700 hover:text-stone-900 transition-colors"
        >
          {name}
        </button>
        <a
          href={academiaUrl(slug)}
          target="_blank"
          rel="noreferrer"
          onClick={e => e.stopPropagation()}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-stone-300 hover:text-stone-600 shrink-0"
          title="Open on Academia.edu"
        >
          <ExternalIcon />
        </a>
      </div>
      {modeOpen && (
        <ModePicker name={name} onSelect={onSelect} onClose={() => setModeOpen(false)} />
      )}
    </div>
  );
}

export default function AcademiaTopicsView({
  status, disciplines, children, slugs, total, crawlDate, error,
  onLoad, onSelectTopic, onCheckForUpdates, scanStatus, newTopics,
}) {
  const [search, setSearch] = useState('');
  const [expandedDiscs, setExpandedDiscs] = useState(new Set());
  const [expandedL2s, setExpandedL2s] = useState(new Set());

  const toggleDisc = name => setExpandedDiscs(prev => {
    const next = new Set(prev);
    next.has(name) ? next.delete(name) : next.add(name);
    return next;
  });

  const toggleL2 = name => setExpandedL2s(prev => {
    const next = new Set(prev);
    next.has(name) ? next.delete(name) : next.add(name);
    return next;
  });

  const allNames = useMemo(() => {
    if (!total) return [];
    const s = new Set(disciplines);
    for (const [k, kids] of Object.entries(children)) {
      s.add(k);
      for (const kid of kids) s.add(kid);
    }
    return [...s].sort();
  }, [disciplines, children, total]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return allNames.filter(n => n.toLowerCase().includes(q));
  }, [search, allNames]);

  const crawlAge = useMemo(() => {
    if (!crawlDate) return null;
    const days = Math.floor((Date.now() - new Date(crawlDate).getTime()) / 86400000);
    return days;
  }, [crawlDate]);

  const visibleCount = useMemo(() => {
    const q = search.trim();
    if (q) return Math.min(filtered.length, 200);
    let count = disciplines.length;
    for (const disc of expandedDiscs) {
      const l2kids = children[disc] || [];
      count += l2kids.length;
      for (const l2 of l2kids) {
        if (expandedL2s.has(l2)) {
          count += Math.min((children[l2] || []).length, 100);
        }
      }
    }
    return count;
  }, [search, filtered, disciplines, children, expandedDiscs, expandedL2s]);

  if (status === 'idle') {
    return (
      <div className="mt-10 text-center py-16">
        <p className="text-xs font-mono uppercase tracking-widest text-stone-400 mb-2">Academia.edu Topic Hierarchy</p>
        <p className="text-sm text-stone-500 mb-2 max-w-lg mx-auto">
          25 disciplines → 661 subtopics → 200,000+ research topics, sourced from Academia.edu's full classification
        </p>
        <p className="text-xs text-stone-400 mb-6">Loads on demand · cached after first use</p>
        <button
          onClick={onLoad}
          className="px-6 py-2.5 text-sm bg-stone-900 text-white hover:bg-stone-700 transition-colors"
        >
          Load Topics
        </button>
      </div>
    );
  }

  if (status === 'loading') {
    return (
      <div className="mt-10 flex items-center gap-2.5 text-stone-400">
        <span className="flex gap-0.5">
          <span className="loading-dot" /><span className="loading-dot" /><span className="loading-dot" />
        </span>
        <span className="text-sm">Loading Academia.edu topic hierarchy...</span>
      </div>
    );
  }

  if (status === 'error' && !disciplines.length) {
    return (
      <div className="mt-10 p-5 bg-red-50 border border-red-200">
        <p className="font-medium text-red-900 text-sm mb-1">Could not load topics</p>
        <p className="text-xs text-red-700">{error}</p>
        <button onClick={onLoad} className="mt-3 text-sm text-red-700 underline">Try again</button>
      </div>
    );
  }

  const q = search.trim();

  return (
    <div className="mt-8">
      {/* Header row: search + stats + scan */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        <div className="flex-1">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={`Search ${total.toLocaleString()}+ topics...`}
            className="w-full px-3 py-2.5 text-sm border border-stone-200 bg-white text-stone-900 placeholder-stone-300 focus:outline-none focus:border-stone-700 transition-colors"
          />
        </div>
        <span className="text-xs font-mono text-stone-400 shrink-0 flex items-center gap-2">
          <span className="bg-stone-100 text-stone-600 px-2 py-0.5 rounded">
            {visibleCount.toLocaleString()} visible
          </span>
          {q ? (
            <span>{filtered.length.toLocaleString()} matches · {total.toLocaleString()} total</span>
          ) : (
            <span>{total.toLocaleString()} total</span>
          )}
        </span>
      </div>

      {/* Crawl date + scan for updates */}
      <div className="flex items-center gap-3 mb-6 text-xs text-stone-400 font-mono">
        {crawlDate && (
          <span className={crawlAge > 30 ? 'text-amber-500' : ''}>
            Last crawled: {new Date(crawlDate).toLocaleDateString()} ({crawlAge}d ago)
          </span>
        )}
        <button
          onClick={() => onCheckForUpdates(children)}
          disabled={scanStatus === 'scanning'}
          className="text-stone-500 hover:text-stone-800 transition-colors disabled:opacity-50 underline underline-offset-2"
        >
          {scanStatus === 'scanning' ? 'Scanning...' : 'Scan for new topics'}
        </button>
        {scanStatus === 'done' && newTopics.length === 0 && (
          <span className="text-emerald-600">Up to date</span>
        )}
        {scanStatus === 'error' && (
          <span className="text-amber-500">Scan failed — academia.edu may be unreachable from the server. Try again shortly.</span>
        )}
      </div>

      {/* New topics found */}
      {scanStatus === 'done' && newTopics.length > 0 && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200">
          <p className="text-xs font-semibold text-amber-800 mb-2">
            {newTopics.length} discipline{newTopics.length > 1 ? 's' : ''} have new subtopics
          </p>
          <div className="space-y-1">
            {newTopics.map(t => (
              <div key={t.name} className="text-xs text-amber-700 font-mono">
                {t.name}: {t.storedCount} → {t.liveCount} (+{t.diff})
              </div>
            ))}
          </div>
          <p className="text-xs text-amber-600 mt-2">
            Run: <span className="font-mono">node scripts/crawl-academia-topics.mjs</span> to refresh
          </p>
        </div>
      )}

      {/* Search results */}
      {q && (
        <div className="border border-stone-200 divide-y divide-stone-100">
          {filtered.length === 0 ? (
            <div className="px-4 py-6 text-sm text-stone-400 text-center">
              No topics match &ldquo;{q}&rdquo;
            </div>
          ) : (
            <>
              {filtered.slice(0, 200).map(name => (
                <SearchRow key={name} name={name} slug={slugs[name] || name} onSelect={onSelectTopic} />
              ))}
              {filtered.length > 200 && (
                <div className="px-4 py-3 text-xs text-stone-400 font-mono">
                  Showing 200 of {filtered.length.toLocaleString()} — refine your search
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* 3-level accordion */}
      {!q && (
        <div className="space-y-1">
          {disciplines.map(disc => (
            <DisciplineRow
              key={disc}
              name={disc}
              slug={slugs[disc] || disc}
              children={children}
              slugs={slugs}
              onSelect={onSelectTopic}
              expanded={expandedDiscs.has(disc)}
              onToggleExpand={() => toggleDisc(disc)}
              expandedL2s={expandedL2s}
              onToggleL2={toggleL2}
            />
          ))}
        </div>
      )}
    </div>
  );
}
