const EMPTY_STATE = `Enter any academic topic above and click Explore. The field's subfields will appear here for navigation.`;

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function TaxonomyNav({ topic, taxonomy, currentCanonTopic, onSelectTopic, onSelectSubfield, disabled }) {
  return (
    <div className="mb-5">
      <p className="text-xs font-mono uppercase tracking-widest text-stone-400 mb-0.5">
        {taxonomy.domain}
      </p>
      <p className="text-xs text-stone-400 mb-3">{taxonomy.subject}</p>

      <ul className="space-y-0.5">
        {/* Main topic — full canon */}
        <li>
          <button
            onClick={() => onSelectTopic(topic)}
            disabled={disabled}
            className={`w-full text-left px-2 py-2 text-sm font-semibold transition-colors disabled:opacity-40 ${
              currentCanonTopic === topic
                ? 'bg-stone-900 text-white'
                : 'text-stone-800 hover:bg-stone-100'
            }`}
          >
            {topic}
            <span className={`block text-xs font-normal mt-0.5 ${currentCanonTopic === topic ? 'text-stone-300' : 'text-stone-400'}`}>
              full canon
            </span>
          </button>
        </li>

        {/* Subfields */}
        {taxonomy.subfields.map(sf => (
          <li key={sf}>
            <button
              onClick={() => onSelectSubfield(sf)}
              disabled={disabled}
              className={`w-full text-left px-2 py-1.5 text-sm transition-colors disabled:opacity-40 border-l-2 ml-2 ${
                currentCanonTopic === sf
                  ? 'border-stone-900 bg-stone-900 text-white'
                  : 'border-stone-200 text-stone-600 hover:border-stone-500 hover:text-stone-900 hover:bg-stone-50'
              }`}
            >
              {sf}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Sidebar({
  history, onLoad, onDelete, onClearAll,
  taxonomy, currentTopic, currentCanonTopic,
  onSelectTopic, onSelectSubfield, disabled,
}) {
  const hasTaxonomy = taxonomy && currentTopic;

  return (
    <div className="flex flex-col h-full">
      {hasTaxonomy && (
        <>
          <TaxonomyNav
            topic={currentTopic}
            taxonomy={taxonomy}
            currentCanonTopic={currentCanonTopic}
            onSelectTopic={onSelectTopic}
            onSelectSubfield={onSelectSubfield}
            disabled={disabled}
          />
          {history.length > 0 && <div className="border-t border-stone-200 mb-4" />}
        </>
      )}

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-mono uppercase tracking-widest text-stone-500">
          Saved
          {history.length > 0 && <span className="ml-1.5 text-stone-400">({history.length})</span>}
        </h2>
        {history.length > 0 && (
          <button onClick={onClearAll} className="text-xs text-stone-400 hover:text-stone-700 transition-colors">
            Clear all
          </button>
        )}
      </div>

      {history.length === 0 && !hasTaxonomy ? (
        <p className="text-xs text-stone-400 leading-relaxed">{EMPTY_STATE}</p>
      ) : history.length === 0 ? null : (
        <ul className="space-y-0.5 flex-1 overflow-y-auto">
          {history.map(item => (
            <li key={item.id} className="group flex items-start gap-1">
              <button
                onClick={() => onLoad(item)}
                className="flex-1 text-left py-2 px-2 text-sm text-stone-700 hover:bg-stone-100 transition-colors leading-snug"
              >
                <div className="font-medium truncate">{item.topic}</div>
                <div className="text-xs text-stone-400 mt-0.5">{formatDate(item.generatedAt)}</div>
              </button>
              <button
                onClick={() => onDelete(item.id)}
                className="shrink-0 p-2 text-stone-300 hover:text-stone-600 transition-colors opacity-0 group-hover:opacity-100"
                aria-label="Delete"
              >
                <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                  <path d="M1 1l9 9M10 1L1 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
