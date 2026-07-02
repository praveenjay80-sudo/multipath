const ERA_STYLES = [
  { border: 'border-l-stone-400',  badge: 'bg-stone-100 text-stone-600',   label: 'text-stone-500'  },
  { border: 'border-l-sky-400',    badge: 'bg-sky-50 text-sky-700',         label: 'text-sky-600'    },
  { border: 'border-l-indigo-400', badge: 'bg-indigo-50 text-indigo-700',   label: 'text-indigo-600' },
  { border: 'border-l-violet-500', badge: 'bg-violet-50 text-violet-700',   label: 'text-violet-600' },
];

const TRAJECTORY_STYLES = {
  DEFINING: { dot: 'bg-stone-700', label: 'text-stone-600', text: 'Defining'  },
  RISING:   { dot: 'bg-emerald-500', label: 'text-emerald-700', text: 'Rising'  },
  FADING:   { dot: 'bg-stone-300', label: 'text-stone-400', text: 'Fading'  },
  WATCH:    { dot: 'bg-amber-400', label: 'text-amber-700', text: 'Watch'   },
};

function TrajectoryBadge({ trajectory }) {
  const t = TRAJECTORY_STYLES[trajectory?.toUpperCase()] || TRAJECTORY_STYLES.DEFINING;
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${t.dot}`} />
      <span className={`text-xs font-mono ${t.label}`}>{t.text}</span>
    </span>
  );
}

export default function CanonDriftView({ parsed, isStreaming }) {
  if (!parsed) return null;

  const hasContent = parsed.field || parsed.eras.length > 0;
  if (!hasContent) {
    return (
      <div className="mt-10 flex items-center gap-2.5 text-stone-400">
        <span className="flex gap-0.5">
          <span className="loading-dot" /><span className="loading-dot" /><span className="loading-dot" />
        </span>
        <span className="text-sm">Tracing canon drift across eras...</span>
      </div>
    );
  }

  return (
    <div className={`mt-10 ${isStreaming ? 'opacity-90' : ''}`}>

      {/* Header */}
      {parsed.field && (
        <div className="mb-8">
          <p className="text-xs font-mono uppercase tracking-widest text-stone-400 mb-1">Canon Drift</p>
          <h2 className="text-xl font-semibold text-stone-900 tracking-tight leading-snug">{parsed.field}</h2>
          {parsed.driftSummary && (
            <p className="mt-3 text-sm text-stone-600 leading-relaxed max-w-2xl">{parsed.driftSummary}</p>
          )}

          {/* Trajectory legend */}
          <div className="mt-3 flex flex-wrap gap-3 items-center">
            {Object.values(TRAJECTORY_STYLES).map(t => (
              <span key={t.text} className="inline-flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${t.dot}`} />
                <span className={`text-xs ${t.label}`}>{t.text}</span>
              </span>
            ))}
          </div>
          <div className="mt-4 h-px bg-stone-200" />
        </div>
      )}

      {/* Eras */}
      <div className="space-y-6">
        {parsed.eras.map((era, i) => {
          const s = ERA_STYLES[i % ERA_STYLES.length];
          return (
            <div key={i} className={`border-l-4 ${s.border} pl-5`}>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className={`text-xs font-mono px-1.5 py-0.5 ${s.badge}`}>{era.years}</span>
                {era.label && <span className={`text-sm font-semibold ${s.label}`}>{era.label}</span>}
              </div>
              {era.shift && (
                <p className="text-xs text-stone-500 mt-1 mb-4 leading-relaxed max-w-2xl">{era.shift}</p>
              )}
              <div className="space-y-3">
                {era.works.map((work, j) => (
                  <div key={j} className="flex gap-3 items-start">
                    <TrajectoryBadge trajectory={work.trajectory} />
                    <div className="flex-1">
                      <span className="text-sm font-medium text-stone-800">{work.ref}</span>
                      {work.citations != null && (
                        <span className="ml-2 text-xs font-mono text-stone-400">{work.citations.toLocaleString()} citations</span>
                      )}
                      {work.reason && (
                        <p className="text-xs text-stone-500 mt-0.5 leading-relaxed">{work.reason}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Drift Reveals footer */}
      {parsed.driftReveals && (
        <div className="mt-8 px-5 py-4 bg-stone-900">
          <p className="text-xs font-mono uppercase tracking-widest text-stone-400 mb-1.5">Drift Reveals</p>
          <p className="text-sm text-stone-200 leading-relaxed">{parsed.driftReveals}</p>
        </div>
      )}

    </div>
  );
}
