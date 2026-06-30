import BookEntry from './BookEntry';

export default function TierSection({ tier, isLastStreaming, getCitation, onExplain, getExplanation }) {
  const { config, isPaper } = tier;
  const isInverted = config.invertHeader;

  return (
    <div className={`border-l-4 ${config.border} bg-white shadow-sm overflow-hidden`}>
      {/* Section header — colored band */}
      <div className={`px-6 py-4 ${config.headerBg} ${config.headerBorder}`}>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${config.dot}`} />
            <span className={`text-sm font-bold tracking-wide uppercase ${isInverted ? 'text-white' : config.accent}`}>
              {config.label}
            </span>
            {tier.subtitle && tier.subtitle !== config.label && (
              <span className={`text-sm font-semibold ${isInverted ? 'text-white/80' : 'text-stone-700'} leading-tight`}>
                — {tier.subtitle}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {tier.entries?.length > 0 && (
              <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${config.badge}`}>
                {tier.entries.length} {tier.entries.length === 1 ? 'work' : 'works'}
              </span>
            )}
            {isLastStreaming && (
              <span className="flex items-center gap-1">
                <span className="loading-dot" style={{ width: 4, height: 4 }} />
              </span>
            )}
          </div>
        </div>
        {tier.description && (
          <p className={`text-xs mt-2 leading-relaxed pl-5 ${isInverted ? 'text-white/60' : 'text-stone-500'}`}>
            {tier.description}
          </p>
        )}
      </div>

      <div className="px-6 py-2">
        {tier.entries?.length > 0 ? (
          tier.entries.map((entry, i) => (
            <BookEntry
              key={i}
              entry={entry}
              isPaper={isPaper}
              citationData={getCitation?.(entry.title)}
              onExplain={onExplain}
              explanation={getExplanation?.(entry.title)}
            />
          ))
        ) : isLastStreaming ? (
          <div className="py-4 flex gap-1 text-stone-300">
            <span className="loading-dot" />
            <span className="loading-dot" />
            <span className="loading-dot" />
          </div>
        ) : null}
      </div>
    </div>
  );
}
