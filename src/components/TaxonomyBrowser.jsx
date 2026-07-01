export default function TaxonomyBrowser({ topic, taxonomy, onSelectSubfield, onGenerateBroadly, disabled }) {
  return (
    <div className="mt-8 border border-stone-200 bg-white p-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-xs font-mono text-stone-400 mb-5 uppercase tracking-wider">
        <span>{taxonomy.domain}</span>
        <span className="text-stone-300">›</span>
        <span>{taxonomy.subject}</span>
        <span className="text-stone-300">›</span>
        <span className="text-stone-700 font-semibold">{topic}</span>
      </div>

      {/* Subfields */}
      <p className="text-xs font-mono uppercase tracking-widest text-stone-400 mb-3">
        Choose a subfield — or generate the full canon below
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-6">
        {taxonomy.subfields.map(sf => (
          <button
            key={sf}
            onClick={() => onSelectSubfield(sf)}
            disabled={disabled}
            className="px-4 py-3 text-sm text-left border border-stone-200 bg-stone-50 text-stone-700 hover:border-stone-900 hover:bg-white hover:text-stone-900 transition-all duration-100 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {sf}
            <span className="block text-xs text-stone-400 mt-0.5 font-mono">textbooks · papers</span>
          </button>
        ))}
      </div>

      <div className="border-t border-stone-100 pt-4">
        <button
          onClick={onGenerateBroadly}
          disabled={disabled}
          className="text-sm text-stone-500 hover:text-stone-900 transition-colors disabled:opacity-40"
        >
          Generate full canon for <span className="font-medium">"{topic}"</span> →
        </button>
      </div>
    </div>
  );
}
