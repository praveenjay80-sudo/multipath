const TIER_STYLES = [
  { bg: 'bg-stone-50',   border: 'border-stone-200',   badge: 'bg-stone-200 text-stone-700',     num: 'text-stone-400'    },
  { bg: 'bg-sky-50',     border: 'border-sky-200',     badge: 'bg-sky-100 text-sky-700',         num: 'text-sky-400'      },
  { bg: 'bg-violet-50',  border: 'border-violet-200',  badge: 'bg-violet-100 text-violet-700',   num: 'text-violet-400'   },
  { bg: 'bg-teal-50',    border: 'border-teal-200',    badge: 'bg-teal-100 text-teal-700',       num: 'text-teal-500'     },
  { bg: 'bg-amber-50',   border: 'border-amber-200',   badge: 'bg-amber-100 text-amber-700',     num: 'text-amber-500'    },
];

export default function DissertationView({ parsed, isStreaming }) {
  if (!parsed) return null;

  const hasContent = parsed.question || parsed.tiers.length > 0;
  if (!hasContent) {
    return (
      <div className="mt-10 flex items-center gap-2.5 text-stone-400">
        <span className="flex gap-0.5">
          <span className="loading-dot" /><span className="loading-dot" /><span className="loading-dot" />
        </span>
        <span className="text-sm">Building qualifying exam reading list...</span>
      </div>
    );
  }

  return (
    <div className={`mt-10 ${isStreaming ? 'opacity-90' : ''}`}>

      {/* Header */}
      {parsed.question && (
        <div className="mb-8">
          <p className="text-xs font-mono uppercase tracking-widest text-stone-400 mb-1">Qualifying Exam Reading List</p>
          <h2 className="text-xl font-semibold text-stone-900 tracking-tight leading-snug max-w-2xl">{parsed.question}</h2>
          <div className="flex flex-wrap gap-2 mt-2">
            {parsed.field && (
              <span className="text-xs font-mono px-2 py-0.5 bg-stone-100 text-stone-600 border border-stone-200">{parsed.field}</span>
            )}
            {parsed.subfield && (
              <span className="text-xs font-mono px-2 py-0.5 bg-stone-100 text-stone-500 border border-stone-200">{parsed.subfield}</span>
            )}
          </div>
          {parsed.committeeNote && (
            <div className="mt-4 px-5 py-4 bg-stone-900 max-w-2xl">
              <p className="text-xs font-mono uppercase tracking-widest text-stone-400 mb-1.5">Committee Expects</p>
              <p className="text-sm text-stone-200 leading-relaxed">{parsed.committeeNote}</p>
            </div>
          )}
          <div className="mt-5 h-px bg-stone-200" />
        </div>
      )}

      {/* Tiers */}
      <div className="space-y-4">
        {parsed.tiers.map((tier, i) => {
          const s = TIER_STYLES[i % TIER_STYLES.length];
          return (
            <div key={i} className={`border ${s.border} ${s.bg}`}>
              <div className="px-6 pt-5 pb-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-xs font-mono px-1.5 py-0.5 shrink-0 ${s.badge}`}>Tier {tier.number}</span>
                  <h3 className="text-sm font-semibold text-stone-800">{tier.name}</h3>
                </div>
                {tier.description && (
                  <p className="text-xs text-stone-500 leading-relaxed mb-4">{tier.description}</p>
                )}
                <div className="space-y-4">
                  {tier.works.map((work, j) => (
                    <div key={j} className="flex gap-3">
                      <span className={`text-xs font-mono mt-0.5 shrink-0 w-4 ${s.num}`}>{j + 1}.</span>
                      <div className="flex-1">
                        <span className="text-sm font-medium text-stone-800">{work.ref}</span>
                        {work.rationale && (
                          <p className="text-xs text-stone-500 mt-0.5 leading-relaxed">{work.rationale}</p>
                        )}
                        {work.mustMaster && (
                          <div className="mt-1.5 flex gap-1.5 items-start">
                            <span className="text-xs font-mono text-stone-400 shrink-0">→</span>
                            <span className="text-xs text-stone-600 leading-relaxed">{work.mustMaster}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      {(parsed.examPrep || parsed.timeline || parsed.advisorNote) && (
        <div className="mt-6 space-y-0 border border-stone-200">
          {parsed.examPrep && (
            <div className="px-5 py-4 border-b border-stone-200">
              <p className="text-xs font-mono uppercase tracking-widest text-stone-400 mb-1.5">Exam Preparation</p>
              <p className="text-sm text-stone-600 leading-relaxed">{parsed.examPrep}</p>
            </div>
          )}
          <div className="px-5 py-4 flex flex-wrap gap-6">
            {parsed.timeline && (
              <div>
                <p className="text-xs font-mono uppercase tracking-widest text-stone-400 mb-1">Timeline</p>
                <p className="text-sm text-stone-700">{parsed.timeline}</p>
              </div>
            )}
            {parsed.advisorNote && (
              <div className="flex-1">
                <p className="text-xs font-mono uppercase tracking-widest text-stone-400 mb-1">Advisor Note</p>
                <p className="text-sm text-stone-700 italic">{parsed.advisorNote}</p>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
