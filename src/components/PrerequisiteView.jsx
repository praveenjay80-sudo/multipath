const PHASE_COLORS = [
  { bg: 'bg-stone-50',   border: 'border-stone-200',  badge: 'bg-stone-200 text-stone-700',   num: 'text-stone-400' },
  { bg: 'bg-sky-50',     border: 'border-sky-200',    badge: 'bg-sky-100 text-sky-700',       num: 'text-sky-500' },
  { bg: 'bg-violet-50',  border: 'border-violet-200', badge: 'bg-violet-100 text-violet-700', num: 'text-violet-400' },
  { bg: 'bg-amber-50',   border: 'border-amber-200',  badge: 'bg-amber-100 text-amber-700',   num: 'text-amber-500' },
  { bg: 'bg-emerald-50', border: 'border-emerald-200',badge: 'bg-emerald-100 text-emerald-700',num: 'text-emerald-500' },
];

export default function PrerequisiteView({ parsed, isStreaming }) {
  if (!parsed) return null;

  const hasContent = parsed.work || parsed.phases.length > 0;
  if (!hasContent) {
    return (
      <div className="mt-10 flex items-center gap-2.5 text-stone-400">
        <span className="flex gap-0.5">
          <span className="loading-dot" />
          <span className="loading-dot" />
          <span className="loading-dot" />
        </span>
        <span className="text-sm">Mapping prerequisite path...</span>
      </div>
    );
  }

  return (
    <div className={`mt-10 ${isStreaming ? 'opacity-90' : ''}`}>

      {/* Target work header */}
      {parsed.work && (
        <div className="mb-8">
          <p className="text-xs font-mono uppercase tracking-widest text-stone-400 mb-1">Prerequisite Path For</p>
          <h2 className="text-xl font-semibold text-stone-900 tracking-tight leading-snug">{parsed.work}</h2>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
            {parsed.field && <span className="text-xs text-stone-500">{parsed.field}</span>}
            {parsed.difficulty && (
              <>
                <span className="text-stone-300 text-xs">·</span>
                <span className="text-xs text-stone-400">{parsed.difficulty}</span>
              </>
            )}
          </div>
          {parsed.context && (
            <p className="mt-3 text-sm text-stone-600 leading-relaxed max-w-2xl">{parsed.context}</p>
          )}
          <div className="mt-5 h-px bg-stone-200" />
        </div>
      )}

      {/* Phases */}
      <div className="space-y-4">
        {parsed.phases.map((phase, i) => {
          const c = PHASE_COLORS[i % PHASE_COLORS.length];
          return (
            <div key={i} className={`border ${c.border} ${c.bg} p-6`}>
              <div className="flex items-baseline gap-3 mb-1">
                <span className={`text-xs font-mono px-1.5 py-0.5 ${c.badge}`}>Phase {phase.number}</span>
                <h3 className="text-sm font-semibold text-stone-800">{phase.name}</h3>
              </div>
              {phase.focus && (
                <p className="text-xs text-stone-500 mt-1 mb-4 leading-relaxed">{phase.focus}</p>
              )}
              <div className="space-y-4">
                {phase.works.map((work, j) => (
                  <div key={j} className="flex gap-3">
                    <span className={`text-xs font-mono mt-0.5 shrink-0 w-4 ${c.num}`}>{j + 1}.</span>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-stone-800">{work.ref}</div>
                      {work.rationale && (
                        <div className="text-xs text-stone-500 mt-0.5 leading-relaxed">{work.rationale}</div>
                      )}
                      {work.focus && (
                        <div className="mt-1.5 flex gap-1.5 items-start">
                          <span className="text-xs font-mono text-stone-400 shrink-0 mt-px">→</span>
                          <span className="text-xs text-stone-600 leading-relaxed">{work.focus}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Total path */}
      {parsed.totalPath && (
        <div className="mt-6 flex items-baseline gap-3 px-5 py-4 bg-stone-900">
          <span className="text-xs font-mono uppercase tracking-widest text-stone-400 shrink-0">Total Path</span>
          <span className="text-sm text-stone-200">{parsed.totalPath}</span>
        </div>
      )}

      {/* Beyond — advanced reading after the target work */}
      {parsed.beyond && (parsed.beyond.summary || parsed.beyond.streams.length > 0) && (
        <div className="mt-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-px flex-1 bg-stone-200" />
            <span className="text-xs font-mono uppercase tracking-widest text-stone-400">Advanced Knowledge</span>
            <div className="h-px flex-1 bg-stone-200" />
          </div>

          {parsed.beyond.summary && (
            <p className="text-sm text-stone-600 leading-relaxed mb-6 max-w-2xl">{parsed.beyond.summary}</p>
          )}

          <div className="space-y-4">
            {parsed.beyond.streams.map((stream, i) => (
              <div key={i} className="border border-stone-900 bg-stone-900 p-6">
                <div className="flex items-baseline gap-3 mb-1">
                  <span className="text-xs font-mono px-1.5 py-0.5 bg-stone-700 text-stone-300">
                    Stream {stream.number}
                  </span>
                  <h3 className="text-sm font-semibold text-white">{stream.name}</h3>
                </div>
                {stream.focus && (
                  <p className="text-xs text-stone-400 mt-1 mb-4 leading-relaxed">{stream.focus}</p>
                )}
                <div className="space-y-4">
                  {stream.works.map((work, j) => (
                    <div key={j} className="flex gap-3">
                      <span className="text-xs font-mono mt-0.5 shrink-0 w-4 text-stone-500">{j + 1}.</span>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-stone-100">{work.ref}</div>
                        {work.rationale && (
                          <div className="text-xs text-stone-400 mt-0.5 leading-relaxed">{work.rationale}</div>
                        )}
                        {work.focus && (
                          <div className="mt-1.5 flex gap-1.5 items-start">
                            <span className="text-xs font-mono text-stone-500 shrink-0 mt-px">→</span>
                            <span className="text-xs text-stone-300 leading-relaxed">{work.focus}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
