const EMPTY_STATE = `Canon generates definitive scholarly reading lists — not popularity rankings, but the foundational works every serious student of a field should encounter. Start by entering any academic topic above.`;

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function Sidebar({ history, onLoad, onDelete, onClearAll }) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs font-mono uppercase tracking-widest text-stone-500">
          Saved Canons
          {history.length > 0 && (
            <span className="ml-2 text-stone-400">({history.length})</span>
          )}
        </h2>
        {history.length > 0 && (
          <button
            onClick={onClearAll}
            className="text-xs text-stone-400 hover:text-stone-700 transition-colors"
          >
            Clear all
          </button>
        )}
      </div>

      {history.length === 0 ? (
        <p className="text-xs text-stone-400 leading-relaxed">{EMPTY_STATE}</p>
      ) : (
        <ul className="space-y-1 flex-1 overflow-y-auto">
          {history.map(item => (
            <li key={item.id} className="group flex items-start gap-2">
              <button
                onClick={() => onLoad(item)}
                className="flex-1 text-left py-2 px-3 text-sm text-stone-700 hover:bg-stone-100 transition-colors border border-transparent hover:border-stone-200 leading-snug"
              >
                <div className="font-medium truncate">{item.topic}</div>
                <div className="text-xs text-stone-400 mt-0.5 flex items-center gap-2">
                  <span>{formatDate(item.generatedAt)}</span>
                  {item.passType === 'quick' && (
                    <span className="text-stone-300 font-mono">quick</span>
                  )}
                </div>
              </button>
              <button
                onClick={() => onDelete(item.id)}
                className="shrink-0 p-2 text-stone-300 hover:text-stone-600 transition-colors opacity-0 group-hover:opacity-100"
                aria-label="Delete"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
