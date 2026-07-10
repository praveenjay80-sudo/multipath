import WorkSourceLink from './WorkSourceLink';

const FIELD_COLORS = [
  { bg: 'bg-stone-50',   border: 'border-stone-200',   badge: 'bg-stone-200 text-stone-700'     },
  { bg: 'bg-sky-50',     border: 'border-sky-200',     badge: 'bg-sky-100 text-sky-700'         },
  { bg: 'bg-indigo-50',  border: 'border-indigo-200',  badge: 'bg-indigo-100 text-indigo-700'   },
  { bg: 'bg-violet-50',  border: 'border-violet-200',  badge: 'bg-violet-100 text-violet-700'   },
  { bg: 'bg-teal-50',    border: 'border-teal-200',    badge: 'bg-teal-100 text-teal-700'       },
  { bg: 'bg-emerald-50', border: 'border-emerald-200', badge: 'bg-emerald-100 text-emerald-700' },
  { bg: 'bg-amber-50',   border: 'border-amber-200',   badge: 'bg-amber-100 text-amber-700'     },
  { bg: 'bg-rose-50',    border: 'border-rose-200',    badge: 'bg-rose-100 text-rose-700'       },
];

export default function ConsilienceView({ parsed, isStreaming }) {
  if (!parsed) return null;

  const hasContent = parsed.question || parsed.lenses.length > 0;
  if (!hasContent) {
    return (
      <div className="mt-10 flex items-center gap-2.5 text-stone-400">
        <span className="flex gap-0.5">
          <span className="loading-dot" /><span className="loading-dot" /><span className="loading-dot" />
        </span>
        <span className="text-sm">Synthesizing across disciplines...</span>
      </div>
    );
  }

  return (
    <div className={`mt-10 ${isStreaming ? 'opacity-90' : ''}`}>

      {/* Header */}
      {parsed.question && (
        <div className="mb-8">
          <p className="text-xs font-mono text-stone-400 mb-1">Consilience</p>
          <h2 className="text-xl font-semibold text-stone-900 tracking-tight leading-snug max-w-2xl">{parsed.question}</h2>
          {parsed.fields.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {parsed.fields.map((f, i) => {
                const c = FIELD_COLORS[i % FIELD_COLORS.length];
                return (
                  <span key={i} className={`text-xs font-mono px-2 py-0.5 ${c.badge}`}>{f}</span>
                );
              })}
            </div>
          )}
          <div className="mt-4 h-px bg-stone-200" />
        </div>
      )}

      {/* Discipline lenses */}
      <div className="space-y-4">
        {parsed.lenses.map((lens, i) => {
          const c = FIELD_COLORS[i % FIELD_COLORS.length];
          return (
            <div key={i} className={`border ${c.border} ${c.bg} px-6 pt-5 pb-5`}>
              <span className={`inline-block text-xs font-mono px-1.5 py-0.5 mb-3 ${c.badge}`}>{lens.name}</span>
              {lens.lens && (
                <p className="text-xs text-stone-500 italic mb-3 leading-relaxed">{lens.lens}</p>
              )}
              {lens.answer && (
                <p className="text-sm text-stone-800 leading-relaxed">{lens.answer}</p>
              )}
              {lens.keyWorks && lens.keyWorks.length > 0 && (
                <div className="mt-4 pt-3 border-t border-stone-200/70">
                  <p className="text-xs font-mono text-stone-400 mb-2">Key Works</p>
                  <ul className="space-y-1">
                    {lens.keyWorks.map((w, j) => (
                      <li key={j} className="text-xs text-stone-700 leading-relaxed">— {w}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Synthesis footer */}
      {(parsed.convergence || parsed.tensions || parsed.synthesis || parsed.crossReading) && (
        <div className="mt-6 border border-stone-200 divide-y divide-stone-200">
          {parsed.convergence && (
            <div className="px-6 py-5">
              <p className="text-xs font-mono text-stone-400 mb-2">Convergence</p>
              <p className="text-sm text-stone-700 leading-relaxed">{parsed.convergence}</p>
            </div>
          )}
          {parsed.tensions && (
            <div className="px-6 py-5">
              <p className="text-xs font-mono text-stone-400 mb-2">Tensions</p>
              <p className="text-sm text-stone-700 leading-relaxed">{parsed.tensions}</p>
            </div>
          )}
          {parsed.synthesis && (
            <div className="px-6 py-5 bg-stone-900">
              <p className="text-xs font-mono text-stone-400 mb-2">Synthesis</p>
              <p className="text-sm text-stone-200 leading-relaxed">{parsed.synthesis}</p>
            </div>
          )}
          {parsed.crossReading && (
            <div className="px-6 py-5">
              <p className="text-xs font-mono text-stone-400 mb-2">Cross-Disciplinary Reading</p>
              <ul className="space-y-1">
                {parsed.crossReading.split(/[;]/).map(s => s.trim()).filter(Boolean).map((w, i) => (
                  <li key={i} className="text-sm text-stone-700 leading-relaxed flex items-baseline gap-2 flex-wrap">
                    <span>— {w}</span>
                    <WorkSourceLink title={w} isPaper={false} />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
