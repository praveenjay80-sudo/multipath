import { useState, useEffect, useMemo } from 'react';
import { fetchOpenAlexTaxonomy } from '../utils/openAlexTaxonomy';

export default function PulseInput({ onSelect, disabled }) {
  const [taxonomy, setTaxonomy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [field, setField] = useState('');
  const [subfield, setSubfield] = useState('');
  const [topic, setTopic] = useState('');

  useEffect(() => {
    fetchOpenAlexTaxonomy().then(setTaxonomy).finally(() => setLoading(false));
  }, []);

  const subfields = useMemo(() => (field && taxonomy ? taxonomy.fieldSubfields[field] || [] : []), [field, taxonomy]);
  const topics = useMemo(() => (subfield && taxonomy ? taxonomy.subfieldTopics[subfield] || [] : []), [subfield, taxonomy]);

  function handleField(e) {
    setField(e.target.value);
    setSubfield('');
    setTopic('');
  }

  function handleSubfield(e) {
    setSubfield(e.target.value);
    setTopic('');
  }

  function handleTopic(e) {
    const v = e.target.value;
    setTopic(v);
    if (!v) return;
    const t = topics.find(x => x.name === v);
    if (t && t.url) onSelect(t.url, t.name);
  }

  const selectClass = "flex-1 px-3 py-2.5 text-sm border border-stone-200 bg-white text-stone-900 focus:outline-none focus:border-stone-700 transition-colors disabled:opacity-50 disabled:bg-stone-50";

  return (
    <div>
      <p className="text-xs text-stone-400 mb-2">Pick a field, subfield, and topic — see live citation and syllabus data for it right now, straight from OpenAlex, Semantic Scholar, and Open Syllabus. No AI involved.</p>
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
          {topics.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
        </select>
      </div>
    </div>
  );
}
