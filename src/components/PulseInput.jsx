import { useState, useEffect, useMemo } from 'react';
import { fetchOpenAlexTaxonomy } from '../utils/openAlexTaxonomy';
import { useTopicSuggestions } from '../hooks/useTopicSuggestions';

export default function PulseInput({ onSelect, disabled }) {
  const [taxonomy, setTaxonomy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [field, setField] = useState('');
  const [subfield, setSubfield] = useState('');
  const [topic, setTopic] = useState('');
  const claude = useTopicSuggestions();

  useEffect(() => {
    fetchOpenAlexTaxonomy().then(setTaxonomy).finally(() => setLoading(false));
  }, []);

  const subfields = useMemo(() => (field && taxonomy ? taxonomy.fieldSubfields[field] || [] : []), [field, taxonomy]);
  const topics = useMemo(() => (subfield && taxonomy ? taxonomy.subfieldTopics[subfield] || [] : []), [subfield, taxonomy]);

  function handleField(e) {
    setField(e.target.value);
    setSubfield('');
    setTopic('');
    claude.reset();
  }

  function handleSubfield(e) {
    setSubfield(e.target.value);
    setTopic('');
    claude.reset();
  }

  function handleTopic(e) {
    const v = e.target.value;
    setTopic(v);
    if (!v) return;
    const t = topics.find(x => x.name === v);
    if (t && t.url) { onSelect(t.url, t.name); return; }
    // No OpenAlex id — this came from Claude's suggestion list, so Pulse falls
    // back to a text search instead of an exact topics.id filter.
    onSelect(null, v);
  }

  const selectClass = "flex-1 px-3 py-2.5 text-sm border border-stone-200 bg-white text-stone-900 focus:outline-none focus:border-stone-700 transition-colors disabled:opacity-50 disabled:bg-stone-50";

  return (
    <div>
      <p className="text-xs text-stone-400 mb-2">Pick a field, subfield, and topic — the citation data itself is always live and AI-free, straight from OpenAlex, Semantic Scholar, and Google Scholar. Optionally ask Claude to suggest more specific topics within a subfield.</p>
      <div className="flex flex-col sm:flex-row gap-2">
        <select value={field} onChange={handleField} disabled={disabled || loading} className={selectClass}>
          <option value="">{loading ? 'Loading fields...' : 'Field...'}</option>
          {taxonomy?.fieldNames.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
        <select value={subfield} onChange={handleSubfield} disabled={disabled || !field} className={selectClass}>
          <option value="">Subfield...</option>
          {subfields.map(sf => <option key={sf} value={sf}>{sf}</option>)}
        </select>
        <select value={topic} onChange={handleTopic} disabled={disabled || !subfield} className={selectClass}>
          <option value="">Topic...</option>
          {topics.length > 0 && (
            <optgroup label="OpenAlex topics">
              {topics.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
            </optgroup>
          )}
          {claude.suggestions.length > 0 && (
            <optgroup label="Claude-suggested topics">
              {claude.suggestions.map(name => <option key={name} value={name}>{name}</option>)}
            </optgroup>
          )}
        </select>
        <button
          type="button"
          onClick={() => claude.suggest(field, subfield)}
          disabled={disabled || !subfield || claude.loading}
          className="px-3 py-2.5 text-xs border border-violet-200 text-violet-600 hover:bg-violet-50 transition-colors disabled:opacity-40 disabled:hover:bg-white whitespace-nowrap font-mono"
        >
          {claude.loading ? 'Asking Claude...' : '✨ Suggest more topics'}
        </button>
      </div>
      {claude.error && <p className="text-xs text-red-600 mt-2">{claude.error}</p>}
      {!claude.error && claude.suggestions.length > 0 && (
        <p className="text-xs text-violet-500 mt-2">{claude.suggestions.length} Claude-suggested topics added to the dropdown above.</p>
      )}
    </div>
  );
}
