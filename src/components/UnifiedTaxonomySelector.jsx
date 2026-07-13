import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { ACADEMIC_TAXONOMY, getSubfields, getSubSubfields } from '../constants/academicTaxonomy';
import { SECTION_DEFS } from '../hooks/useUnifiedBrowser';

// ── Search index over all taxonomy sources ──────────────────────────────────

function buildSearchIndex() {
  const entries = [];
  for (const [field, subfields] of Object.entries(ACADEMIC_TAXONOMY)) {
    entries.push({
      name: field,
      path: field,
      type: 'field',
      source: 'Academic Taxonomy',
    });
    for (const [subfield, topics] of Object.entries(subfields)) {
      entries.push({
        name: subfield,
        path: `${field} > ${subfield}`,
        type: 'subfield',
        source: 'Academic Taxonomy',
      });
      for (const topic of topics) {
        entries.push({
          name: topic,
          path: `${field} > ${subfield} > ${topic}`,
          type: 'topic',
          source: 'Academic Taxonomy',
        });
      }
    }
  }
  return entries;
}

const SEARCH_INDEX = buildSearchIndex();

function scoreMatch(entry, query) {
  const q = query.toLowerCase();
  const name = entry.name.toLowerCase();
  const path = entry.path.toLowerCase();

  // Exact prefix match on name
  if (name === q) return 100;
  if (name.startsWith(q)) return 90 - (name.length - q.length);
  // Exact word match
  const words = name.split(/\s+/);
  if (words.some(w => w === q)) return 80;
  const startWord = words.find(w => w.startsWith(q));
  if (startWord) return 70 - (startWord.length - q.length);
  // Substring match
  if (name.includes(q)) return 50;
  if (path.includes(q)) return 30;
  return 0;
}

function searchTaxonomy(query) {
  if (!query || query.trim().length < 2) return [];
  const q = query.trim();
  const scored = SEARCH_INDEX
    .map(entry => ({ ...entry, score: scoreMatch(entry, q) }))
    .filter(e => e.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 30);
  return scored;
}

// ── Field icon ──────────────────────────────────────────────────────────────

const FIELD_ICONS = {
  'Mathematics': '∑',
  'Statistics & Probability': '∩',
  'Physics': '⚛',
  'Chemistry': '⟡',
  'Biology': '⊗',
  'Neuroscience': 'Ψ',
  'Computer Science': '⬡',
  'Artificial Intelligence': '◇',
  'Economics': '∆',
  'Finance': '¤',
  'Psychology': '◎',
  'Sociology': '∷',
  'Political Science': '⊹',
  'Anthropology': '◈',
  'History': '⊞',
  'Philosophy': 'Φ',
  'Linguistics': '∝',
  'Literature & Literary Theory': '∿',
  'Law': '⊜',
  'Medicine & Health Sciences': '⨁',
  'Earth & Environmental Science': '⊕',
  'Engineering': '⚙',
  'Education': '◑',
  'Geography & Geospatial Sciences': '⊙',
  'Communication & Media Studies': '⊡',
  'Religious Studies & Theology': '✦',
  'Architecture & Urban Design': '⊟',
  'Music & Musicology': '∮',
  'Art History & Visual Culture': '◻',
  'Gender & Sexuality Studies': '⊕',
  'Management & Business': '⊠',
  'Criminology & Criminal Justice': '⊗',
  'Information Science': '≡',
  'Cognitive Science': '⟳',
  'Operations Research': '⊛',
  'Complex Systems & Network Science': '∞',
  'Agriculture & Food Science': '⊜',
  'Public Administration': '⊹',
  'Sports Science & Kinesiology': '◎',
  'Social Work & Human Services': '⊟',
  'Environmental Studies & Sustainability': '⊕',
  'Digital Humanities': '⟳',
  'International & Area Studies': '⊞',
};

export default function UnifiedTaxonomySelector({ onSelectTopic, disabled }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [selectedField, setSelectedField] = useState('');
  const [selectedSubfield, setSelectedSubfield] = useState('');
  const [expandedField, setExpandedField] = useState(null);
  const [expandedSubfield, setExpandedSubfield] = useState(null);
  const [pendingTopic, setPendingTopic] = useState(null);
  const [selectedSections, setSelectedSections] = useState(() => new Set(SECTION_DEFS.map(d => d.key)));
  const inputRef = useRef(null);
  const resultsRef = useRef(null);

  // Close on click outside
  useEffect(() => {
    function handleClick(e) {
      if (resultsRef.current && !resultsRef.current.contains(e.target) &&
          inputRef.current && !inputRef.current.contains(e.target)) {
        setShowResults(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleQueryChange = useCallback((e) => {
    const v = e.target.value;
    setQuery(v);
    const matches = searchTaxonomy(v);
    setResults(matches);
    setShowResults(true);
  }, []);

  const handleSelectResult = useCallback((entry) => {
    setQuery(entry.path);
    setShowResults(false);
    setPendingTopic({ name: entry.name, path: entry.path });
  }, []);

  const handleFieldSelect = useCallback((field) => {
    setSelectedField(field);
    setSelectedSubfield('');
    setExpandedField(expandedField === field ? null : field);
    setExpandedSubfield(null);
  }, [expandedField]);

  const handleSubfieldSelect = useCallback((field, subfield) => {
    setSelectedSubfield(subfield);
    setExpandedSubfield(expandedSubfield === subfield ? null : subfield);
  }, [expandedSubfield]);

  const handleTopicSelect = useCallback((topic, field, subfield) => {
    const path = `${field} > ${subfield} > ${topic}`;
    setQuery(path);
    setShowResults(false);
    setPendingTopic({ name: topic, path });
  }, []);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && results.length > 0) {
      handleSelectResult(results[0]);
    }
    if (e.key === 'Escape') {
      setShowResults(false);
    }
  }, [results, handleSelectResult]);

  const fieldNames = Object.keys(ACADEMIC_TAXONOMY).sort();

  const toggleSection = useCallback((key) => {
    setSelectedSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) { if (next.size > 1) next.delete(key); }
      else next.add(key);
      return next;
    });
  }, []);

  const handleGenerate = useCallback(() => {
    if (!pendingTopic) return;
    onSelectTopic(pendingTopic.name, pendingTopic.path, Array.from(selectedSections));
    setPendingTopic(null);
  }, [pendingTopic, selectedSections, onSelectTopic]);

  return (
    <div className="space-y-6">
      {/* Section picker — shown after topic is selected */}
      {pendingTopic && (
        <div className="border border-stone-300 bg-white p-5 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs font-mono text-stone-400 mb-0.5">Selected topic</div>
              <div className="text-base font-semibold text-stone-900">{pendingTopic.name}</div>
              <div className="text-xs text-stone-400 mt-0.5">{pendingTopic.path}</div>
            </div>
            <button
              onClick={() => setPendingTopic(null)}
              className="text-xs text-stone-400 hover:text-stone-700 transition-colors"
            >
              ✕ Change
            </button>
          </div>

          <div>
            <div className="text-xs font-mono text-stone-400 mb-2">
              Sections to generate ({selectedSections.size}/{SECTION_DEFS.length})
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
              {SECTION_DEFS.map(def => {
                const on = selectedSections.has(def.key);
                return (
                  <button
                    key={def.key}
                    onClick={() => toggleSection(def.key)}
                    className={`text-left px-3 py-2 text-xs border transition-colors ${
                      on
                        ? 'bg-stone-900 text-white border-stone-900'
                        : 'bg-white text-stone-500 border-stone-200 hover:border-stone-400'
                    }`}
                  >
                    <span className={`font-mono mr-1 ${on ? 'text-stone-300' : 'text-stone-300'}`}>
                      {on ? '✓' : '○'}
                    </span>
                    {def.label}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => setSelectedSections(new Set(SECTION_DEFS.map(d => d.key)))}
                className="text-[10px] font-mono text-stone-400 hover:text-stone-700 transition-colors"
              >
                Select all
              </button>
              <span className="text-stone-200">|</span>
              <button
                onClick={() => setSelectedSections(new Set([SECTION_DEFS[0].key]))}
                className="text-[10px] font-mono text-stone-400 hover:text-stone-700 transition-colors"
              >
                Select none
              </button>
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={disabled || selectedSections.size === 0}
            className="w-full py-3 bg-stone-900 text-white text-sm font-medium hover:bg-stone-700 transition-colors disabled:opacity-40"
          >
            Generate {selectedSections.size} section{selectedSections.size !== 1 ? 's' : ''} on {pendingTopic.name}
          </button>
        </div>
      )}

      {/* Search bar */}
      <div className="relative">
        <div className="flex items-center gap-3 border border-stone-300 bg-white px-4 py-3 focus-within:border-stone-700 transition-colors">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-stone-400 shrink-0">
            <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M10.5 10.5l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleQueryChange}
            onKeyDown={handleKeyDown}
            onFocus={() => query && setShowResults(true)}
            placeholder="Search across every academic field, subfield, and topic..."
            disabled={disabled}
            className="flex-1 text-sm text-stone-900 placeholder-stone-300 bg-transparent outline-none"
          />
          {query && (
            <button
              onClick={() => { setQuery(''); setResults([]); inputRef.current?.focus(); }}
              className="text-stone-400 hover:text-stone-700 text-xs px-1"
            >
              ✕
            </button>
          )}
        </div>

        {/* Search results dropdown */}
        {showResults && results.length > 0 && (
          <div
            ref={resultsRef}
            className="absolute z-30 left-0 right-0 mt-1 border border-stone-200 bg-white shadow-lg max-h-80 overflow-y-auto"
          >
            {results.map((entry, i) => (
              <button
                key={i}
                onClick={() => handleSelectResult(entry)}
                className="w-full text-left px-4 py-2.5 hover:bg-stone-50 border-b border-stone-100 last:border-0 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-mono px-1.5 py-0.5 rounded-none ${
                    entry.type === 'field' ? 'bg-stone-900 text-white' :
                    entry.type === 'subfield' ? 'bg-stone-200 text-stone-700' :
                    'bg-stone-100 text-stone-500'
                  }`}>
                    {entry.type === 'field' ? 'FIELD' : entry.type === 'subfield' ? 'SUB' : 'TOPIC'}
                  </span>
                  <span className="text-sm text-stone-800">{entry.name}</span>
                </div>
                <div className="text-xs text-stone-400 mt-0.5 ml-1">{entry.path}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* OR divider */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-stone-200" />
        <span className="text-xs font-mono text-stone-400">or browse by field</span>
        <div className="flex-1 h-px bg-stone-200" />
      </div>

      {/* Field tree browser */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
        {fieldNames.map(field => {
          const subfields = getSubfields(field);
          const isExpanded = expandedField === field;
          const icon = FIELD_ICONS[field] || '⊡';
          return (
            <div key={field}>
              <button
                onClick={() => handleFieldSelect(field)}
                className={`w-full text-left px-4 py-3 text-sm transition-colors flex items-center gap-3 ${
                  isExpanded
                    ? 'bg-stone-900 text-white'
                    : 'bg-white border border-stone-200 hover:border-stone-400 text-stone-800'
                }`}
              >
                <span className="text-base font-mono">{icon}</span>
                <span className="font-medium">{field}</span>
                <span className={`ml-auto text-xs font-mono opacity-60 ${
                  isExpanded ? 'text-stone-300' : 'text-stone-400'
                }`}>
                  {subfields.length}
                </span>
              </button>

              {isExpanded && (
                <div className="mt-1 border border-stone-200 bg-white divide-y divide-stone-100">
                  {subfields.map(sf => {
                    const topics = getSubSubfields(field, sf);
                    const isSfExpanded = expandedSubfield === sf;
                    return (
                      <div key={sf}>
                        <button
                          onClick={() => handleSubfieldSelect(field, sf)}
                          className={`w-full text-left px-4 py-2 text-xs transition-colors flex items-center gap-2 ${
                            isSfExpanded ? 'bg-stone-100 text-stone-900' : 'text-stone-600 hover:text-stone-900 hover:bg-stone-50'
                          }`}
                        >
                          <span className="text-stone-300">{isSfExpanded ? '▼' : '▶'}</span>
                          <span>{sf}</span>
                          {topics.length > 0 && (
                            <span className="ml-auto text-stone-300 font-mono text-[10px]">
                              {topics.length}
                            </span>
                          )}
                        </button>

                        {isSfExpanded && topics.length > 0 && (
                          <div className="border-t border-stone-100 bg-stone-50 divide-y divide-stone-100">
                            {topics.map(topic => (
                              <button
                                key={topic}
                                onClick={() => handleTopicSelect(topic, field, sf)}
                                disabled={disabled}
                                className="w-full text-left px-6 py-1.5 text-xs text-stone-600 hover:text-stone-900 hover:bg-white transition-colors disabled:opacity-40"
                              >
                                {topic}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Quick start chips */}
      <div className="pt-4">
        <div className="text-xs font-mono text-stone-400 mb-3">Popular starting points</div>
        <div className="flex flex-wrap gap-2">
          {['Quantum Mechanics', 'Game Theory', 'Cognitive Neuroscience', 'Machine Learning', 'Molecular Biology', 'Political Philosophy', 'Thermodynamics', 'Category Theory'].map(topic => (
            <button
              key={topic}
              onClick={() => {
                setQuery(topic);
                setPendingTopic({ name: topic, path: topic });
              }}
              disabled={disabled}
              className="px-3 py-1.5 text-xs border border-stone-200 bg-white text-stone-600 hover:border-stone-400 hover:text-stone-800 transition-colors disabled:opacity-40"
            >
              {topic}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
