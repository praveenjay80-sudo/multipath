import { TOP_LEVEL_FIELDS } from '../constants/academicFields';

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function ChevronIcon({ open }) {
  return (
    <svg
      width="10" height="10" viewBox="0 0 10 10" fill="none"
      className={`shrink-0 transition-transform duration-150 ${open ? 'rotate-90' : ''}`}
    >
      <path d="M3 2l4 3-4 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FieldNav({
  activeCanonTopic,
  onClickTopLevel, onClickSubfield, onClickSubSubfield,
  isFieldExpanded, isSubfieldExpanded,
  getSubfields, getSubSubfields,
  disabled,
}) {
  return (
    <div className="mb-5">
      <p className="text-xs font-mono text-stone-400 mb-2">Fields</p>
      <ul>
        {TOP_LEVEL_FIELDS.map(field => {
          const expanded = isFieldExpanded(field);
          const subfields = getSubfields(field);
          const isActive = activeCanonTopic === field;

          return (
            <li key={field}>
              {/* Level 1 */}
              <button
                onClick={() => onClickTopLevel(field)}
                disabled={disabled}
                className={`w-full text-left px-2 py-1.5 text-sm flex items-center justify-between gap-1 transition-colors disabled:opacity-40 ${
                  isActive ? 'bg-stone-900 text-white' : 'text-stone-700 hover:bg-stone-100'
                }`}
              >
                <span className="truncate">{field}</span>
                <span className={isActive ? 'text-stone-300' : 'text-stone-400'}>
                  <ChevronIcon open={expanded} />
                </span>
              </button>

              {expanded && (
                <ul className="ml-3 border-l border-stone-200">
                  {subfields.map(sf => {
                    const sfKey = `${field}::${sf}`;
                    const sfExpanded = isSubfieldExpanded(sfKey);
                    const sfActive = activeCanonTopic === sf;
                    const subSubfields = getSubSubfields(field, sf);

                    return (
                      <li key={sf}>
                        {/* Level 2 */}
                        <button
                          onClick={() => onClickSubfield(field, sf)}
                          disabled={disabled}
                          className={`w-full text-left pl-2 pr-1 py-1 text-sm flex items-center justify-between gap-1 transition-colors disabled:opacity-40 ${
                            sfActive ? 'bg-stone-900 text-white' : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
                          }`}
                        >
                          <span className="truncate">{sf}</span>
                          {subSubfields.length > 0 && (
                            <span className={sfActive ? 'text-stone-300' : 'text-stone-400'}>
                              <ChevronIcon open={sfExpanded} />
                            </span>
                          )}
                        </button>

                        {sfExpanded && subSubfields.length > 0 && (
                          <ul className="ml-3 border-l border-stone-100">
                            {subSubfields.map(ssf => {
                              const ssfActive = activeCanonTopic === ssf;
                              return (
                                <li key={ssf}>
                                  {/* Level 3 */}
                                  <button
                                    onClick={() => onClickSubSubfield(ssf)}
                                    disabled={disabled}
                                    className={`w-full text-left pl-2 pr-1 py-0.5 text-xs transition-colors disabled:opacity-40 ${
                                      ssfActive ? 'bg-stone-900 text-white' : 'text-stone-500 hover:bg-stone-100 hover:text-stone-800'
                                    }`}
                                  >
                                    {ssf}
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function Sidebar({
  history, onLoad, onDelete, onClearAll,
  activeCanonTopic,
  onClickTopLevel, onClickSubfield, onClickSubSubfield,
  isFieldExpanded, isSubfieldExpanded,
  getSubfields, getSubSubfields,
  disabled,
}) {
  return (
    <div className="flex flex-col h-full">
      <FieldNav
        activeCanonTopic={activeCanonTopic}
        onClickTopLevel={onClickTopLevel}
        onClickSubfield={onClickSubfield}
        onClickSubSubfield={onClickSubSubfield}
        isFieldExpanded={isFieldExpanded}
        isSubfieldExpanded={isSubfieldExpanded}
        getSubfields={getSubfields}
        getSubSubfields={getSubSubfields}
        disabled={disabled}
      />

      {history.length > 0 && <div className="border-t border-stone-200 mb-4" />}

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-mono text-stone-500">
          Saved
          {history.length > 0 && <span className="ml-1.5 text-stone-400">({history.length})</span>}
        </h2>
        {history.length > 0 && (
          <button onClick={onClearAll} className="text-xs text-stone-400 hover:text-stone-700 transition-colors">
            Clear all
          </button>
        )}
      </div>

      {history.length > 0 && (
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
