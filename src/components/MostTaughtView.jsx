import { useState, useMemo, useCallback } from 'react';

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
  { key: 'overall',      label: 'Overall',       color: 'text-stone-700   bg-stone-50   hover:bg-stone-100   border-stone-200'   },
];

const ExternalIcon = () => (
  <svg width="10" height="10" viewBox="0 0 12 12" fill="none" className="inline">
    <path d="M5 2H2a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    <path d="M8 1h3m0 0v3m0-3L5.5 6.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const ChevronIcon = ({ open }) => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className={`transition-transform ${open ? 'rotate-90' : ''}`}>
    <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

function ospUrl(title) {
  return `https://analytics.opensyllabus.org/record/works?id=${encodeURIComponent(title)}`;
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

function TitleCard({ title, rank, authors, appearances, year, subfields, onSelect, fieldName }) {
  const [open, setOpen] = useState(false);

  return (
    <div className={`border rounded-sm transition-all ${open ? 'border-stone-300 shadow-sm' : 'border-stone-100 hover:border-stone-200'}`}>
      <div
        className="flex items-start gap-3 px-3 py-2.5 cursor-pointer select-none"
        onClick={() => setOpen(v => !v)}
      >
        {/* Rank badge */}
        <span className="flex-none mt-0.5 text-xs font-mono text-stone-400 w-7 text-right">
          #{rank}
        </span>

        {/* Title + meta */}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-stone-800 font-medium leading-snug">{title}</p>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
            {authors && <span className="text-xs text-stone-500">{authors}</span>}
            {year && <span className="text-xs text-stone-400">{year}</span>}
            {appearances > 0 && (
              <span className="text-xs text-emerald-600 font-mono">{appearances.toLocaleString()} syllabi</span>
            )}
          </div>
          {subfields && subfields.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {subfields.map(sf => (
                <span key={sf} className="text-[10px] px-1.5 py-0.5 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-full font-mono">
                  {sf}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Right controls */}
        <div className="flex-none flex items-center gap-2">
          <a
            href={ospUrl(title)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="text-stone-300 hover:text-stone-500"
            title="View on Open Syllabus"
          >
            <ExternalIcon />
          </a>
          <ChevronIcon open={open} />
        </div>
      </div>

      {open && (
        <ModePicker
          name={title}
          onSelect={onSelect}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

function GlobalTopCard({ item, rank, onSelect }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`border rounded-sm transition-all ${open ? 'border-stone-300 shadow-sm' : 'border-stone-100 hover:border-stone-200'}`}>
      <div className="flex items-start gap-3 px-3 py-2.5 cursor-pointer select-none" onClick={() => setOpen(v => !v)}>
        <span className="flex-none text-xs font-mono font-bold text-amber-600 w-7 text-right mt-0.5">#{rank}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-stone-800 font-medium leading-snug">{item.title}</p>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
            {item.authors && <span className="text-xs text-stone-500">{item.authors}</span>}
            {item.year && <span className="text-xs text-stone-400">{item.year}</span>}
            {item.appearances > 0 && <span className="text-xs text-emerald-600 font-mono">{item.appearances.toLocaleString()} syllabi</span>}
            {item.score > 0 && <span className="text-xs text-amber-500 font-mono">score {item.score}</span>}
          </div>
        </div>
        <div className="flex-none flex items-center gap-2">
          <a href={ospUrl(item.title)} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-stone-300 hover:text-stone-500">
            <ExternalIcon />
          </a>
          <ChevronIcon open={open} />
        </div>
      </div>
      {open && <ModePicker name={item.title} onSelect={onSelect} onClose={() => setOpen(false)} />}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function MostTaughtView({
  status, fields, titlesByField, subfieldsByField, subfieldNames,
  globalTop, disciplineGroups, meta, crawlDate, error,
  onLoad, onSelect,
}) {
  const [selectedField, setSelectedField] = useState(null);
  const [selectedSubfield, setSelectedSubfield] = useState('All');
  const [search, setSearch] = useState('');
  const [expandedGroups, setExpandedGroups] = useState(new Set(['STEM', 'Social Sciences']));
  const [activeSection, setActiveSection] = useState('fields'); // 'fields' | 'global'

  const toggleGroup = useCallback(g => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      next.has(g) ? next.delete(g) : next.add(g);
      return next;
    });
  }, []);

  const selectField = useCallback(f => {
    setSelectedField(f);
    setSelectedSubfield('All');
    setSearch('');
  }, []);

  // Field lookup map
  const fieldMap = useMemo(() => {
    const m = {};
    for (const f of fields) m[f.name] = f;
    return m;
  }, [fields]);

  // Displayed titles for selected field
  const displayedTitles = useMemo(() => {
    if (!selectedField) return [];
    const all = titlesByField[selectedField] || [];
    const sfMap = subfieldsByField[selectedField] || {};

    let filtered = all;
    if (selectedSubfield !== 'All' && sfMap[selectedSubfield]) {
      const indices = new Set(sfMap[selectedSubfield]);
      filtered = all.filter((_, i) => indices.has(i));
    }
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(t =>
        t.title.toLowerCase().includes(q) || (t.authors && t.authors.toLowerCase().includes(q))
      );
    }
    return filtered;
  }, [selectedField, selectedSubfield, search, titlesByField, subfieldsByField]);

  // Search across ALL fields
  const searchResults = useMemo(() => {
    if (!search || search.length < 2) return [];
    const q = search.toLowerCase();
    const results = [];
    for (const f of fields) {
      const titles = titlesByField[f.name] || [];
      for (const t of titles) {
        if (t.title.toLowerCase().includes(q) || (t.authors && t.authors.toLowerCase().includes(q))) {
          results.push({ ...t, fieldName: f.name });
          if (results.length >= 200) break;
        }
      }
      if (results.length >= 200) break;
    }
    return results;
  }, [search, fields, titlesByField]);

  const isGlobalSearch = search.length >= 2 && !selectedField;

  const subfields = selectedField ? (subfieldNames[selectedField] || []) : [];
  const fieldInfo = selectedField ? fieldMap[selectedField] : null;

  // ── Render ────────────────────────────────────────────────────────────────

  if (status === 'idle') {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-stone-500 font-mono text-sm">Open Syllabus Project — most-taught works from 9.4 million course syllabi</p>
        <button
          onClick={onLoad}
          className="px-6 py-2.5 bg-stone-900 text-white text-sm font-mono hover:bg-stone-700 transition-colors"
        >
          Load Most Taught Data
        </button>
      </div>
    );
  }

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-stone-400 font-mono text-sm animate-pulse">Loading Open Syllabus data…</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="py-20 text-center">
        <p className="text-red-500 text-sm font-mono">{error}</p>
        <button onClick={onLoad} className="mt-4 px-4 py-2 border border-stone-300 text-sm font-mono hover:bg-stone-50">Retry</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">

      {/* ── Header bar ── */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-1 pb-3 border-b border-stone-100">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveSection('fields')}
            className={`text-xs font-mono px-3 py-1 border transition-colors ${activeSection === 'fields' ? 'bg-stone-900 text-white border-stone-900' : 'border-stone-300 text-stone-600 hover:bg-stone-50'}`}
          >
            BY FIELD
          </button>
          <button
            onClick={() => setActiveSection('global')}
            className={`text-xs font-mono px-3 py-1 border transition-colors ${activeSection === 'global' ? 'bg-amber-600 text-white border-amber-600' : 'border-amber-200 text-amber-700 hover:bg-amber-50'}`}
          >
            GLOBAL TOP
          </button>
        </div>

        <div className="flex-1 min-w-[200px] max-w-sm">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={activeSection === 'global' ? 'Search global top…' : selectedField ? `Search ${selectedField}…` : 'Search all titles…'}
            className="w-full text-xs font-mono border border-stone-200 px-3 py-1.5 focus:outline-none focus:border-stone-400 bg-white"
          />
        </div>

        <div className="ml-auto flex items-center gap-3 text-xs font-mono text-stone-400">
          {meta && <span>{meta.totalTitles.toLocaleString()} titles</span>}
          {meta && <span>{fields.length} fields</span>}
          {meta && <span>{(meta.totalSyllabi / 1e6).toFixed(1)}M syllabi</span>}
          {crawlDate && <span>crawled {crawlDate}</span>}
          <a
            href="https://opensyllabus.org"
            target="_blank"
            rel="noopener noreferrer"
            className="text-stone-400 hover:text-stone-600"
          >
            opensyllabus.org <ExternalIcon />
          </a>
        </div>
      </div>

      {/* ── Global Top section ── */}
      {activeSection === 'global' && (
        <div className="flex-1 overflow-y-auto">
          <div className="py-4">
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-sm font-mono font-bold text-amber-700 uppercase tracking-wider">
                Global Top {globalTop.length} — Most Taught Works Across All Fields
              </h2>
            </div>
            {globalTop.length === 0 ? (
              <p className="text-sm text-stone-400 font-mono">No global top data in this snapshot.</p>
            ) : (
              <div className="grid gap-1">
                {globalTop
                  .filter(item => !search || item.title.toLowerCase().includes(search.toLowerCase()) || (item.authors && item.authors.toLowerCase().includes(search.toLowerCase())))
                  .map((item, i) => (
                    <GlobalTopCard key={i} item={item} rank={item.rank || (i + 1)} onSelect={onSelect} />
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── By-field section ── */}
      {activeSection === 'fields' && (
        <div className="flex flex-1 min-h-0 gap-0">

          {/* Left: discipline nav */}
          <div className="w-56 flex-none border-r border-stone-100 overflow-y-auto py-3 pr-2">
            {Object.entries(disciplineGroups).map(([group, groupFields]) => {
              const isOpen = expandedGroups.has(group);
              // filter to fields we actually have
              const available = groupFields.filter(name => fieldMap[name]);
              if (!available.length) return null;

              return (
                <div key={group} className="mb-1">
                  <button
                    onClick={() => toggleGroup(group)}
                    className="w-full flex items-center justify-between px-2 py-1.5 text-xs font-mono font-bold text-stone-500 uppercase tracking-wider hover:text-stone-800 hover:bg-stone-50 rounded-sm transition-colors"
                  >
                    <span>{group}</span>
                    <ChevronIcon open={isOpen} />
                  </button>
                  {isOpen && (
                    <div className="ml-1 mt-0.5">
                      {available.map(name => {
                        const f = fieldMap[name];
                        return (
                          <button
                            key={name}
                            onClick={() => selectField(name)}
                            className={`w-full text-left px-2 py-1.5 text-xs font-mono rounded-sm transition-colors leading-snug ${
                              selectedField === name
                                ? 'bg-stone-900 text-white'
                                : 'text-stone-600 hover:bg-stone-50 hover:text-stone-900'
                            }`}
                          >
                            <span className="block truncate">{name}</span>
                            <span className={`text-[10px] ${selectedField === name ? 'text-stone-300' : 'text-stone-400'}`}>
                              {f.syllabi.toLocaleString()} syllabi
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Right: titles panel */}
          <div className="flex-1 min-w-0 overflow-y-auto px-4 py-3">

            {/* Global search results */}
            {isGlobalSearch && (
              <>
                <div className="flex items-center gap-2 mb-3">
                  <h2 className="text-sm font-mono font-bold text-stone-700">
                    Search results for "{search}"
                  </h2>
                  <span className="text-xs font-mono text-stone-400">{searchResults.length} titles</span>
                </div>
                {searchResults.length === 0 ? (
                  <p className="text-sm text-stone-400 font-mono">No results.</p>
                ) : (
                  <div className="grid gap-1">
                    {searchResults.map((t, i) => (
                      <div key={i}>
                        <div className="text-[10px] font-mono text-stone-400 px-1 mb-0.5">{t.fieldName}</div>
                        <TitleCard
                          title={t.title}
                          rank={t.rank}
                          authors={t.authors}
                          appearances={t.appearances}
                          year={t.year}
                          subfields={t.subfields}
                          fieldName={t.fieldName}
                          onSelect={onSelect}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* No field selected and no search */}
            {!isGlobalSearch && !selectedField && (
              <div className="flex flex-col items-center justify-center h-full text-center py-16">
                <p className="text-stone-400 text-sm font-mono mb-2">Select a field from the left to browse works</p>
                <p className="text-stone-300 text-xs font-mono">or type to search all {meta?.totalTitles?.toLocaleString()} titles</p>
              </div>
            )}

            {/* Field selected */}
            {!isGlobalSearch && selectedField && (
              <>
                {/* Field header */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-3">
                  <h2 className="text-base font-mono font-bold text-stone-800">{selectedField}</h2>
                  {fieldInfo && (
                    <span className="text-xs font-mono text-stone-400">{fieldInfo.syllabi.toLocaleString()} syllabi</span>
                  )}
                  <span className="text-xs font-mono text-stone-400">{(titlesByField[selectedField] || []).length} works</span>
                </div>

                {/* Subfield chips */}
                {subfields.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    <button
                      onClick={() => setSelectedSubfield('All')}
                      className={`text-xs px-2.5 py-1 border rounded-full font-mono transition-colors ${
                        selectedSubfield === 'All'
                          ? 'bg-stone-900 text-white border-stone-900'
                          : 'border-stone-200 text-stone-500 hover:border-stone-400 hover:text-stone-700'
                      }`}
                    >
                      All
                    </button>
                    {subfields.map(sf => {
                      const sfMap = subfieldsByField[selectedField] || {};
                      const count = sfMap[sf] ? sfMap[sf].length : 0;
                      return (
                        <button
                          key={sf}
                          onClick={() => setSelectedSubfield(sf)}
                          className={`text-xs px-2.5 py-1 border rounded-full font-mono transition-colors ${
                            selectedSubfield === sf
                              ? 'bg-indigo-700 text-white border-indigo-700'
                              : 'border-indigo-100 text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50'
                          }`}
                        >
                          {sf} {count > 0 && <span className="opacity-70">({count})</span>}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Search within field */}
                {search && (
                  <p className="text-xs font-mono text-stone-400 mb-2">{displayedTitles.length} results</p>
                )}

                {/* Title list */}
                {displayedTitles.length === 0 ? (
                  <p className="text-sm text-stone-400 font-mono py-8 text-center">
                    {selectedSubfield !== 'All' ? `No works classified under "${selectedSubfield}" — keyword matching uses title text.` : 'No results.'}
                  </p>
                ) : (
                  <div className="grid gap-1">
                    {displayedTitles.map((t, i) => (
                      <TitleCard
                        key={i}
                        title={t.title}
                        rank={t.rank}
                        authors={t.authors}
                        appearances={t.appearances}
                        year={t.year}
                        subfields={t.subfields}
                        fieldName={selectedField}
                        onSelect={onSelect}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
