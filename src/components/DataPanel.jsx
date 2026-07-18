// Extracted from PulseView.jsx (originally private/unexported) so live-data
// modes other than Master Reading List — starting with Theory Deep Dive —
// can reuse the same panel/list rendering instead of duplicating it.

export function ItemRow({ item, renderMetric, renderLink, renderSecondary, renderBadges, renderTertiary }) {
  const link = renderLink ? renderLink(item) : null;
  const titleEl = link ? (
    <a href={link} target="_blank" rel="noreferrer" className="text-sm font-medium text-stone-800 hover:text-stone-950 hover:underline leading-snug">
      {item.title}
    </a>
  ) : (
    <p className="text-sm font-medium text-stone-800 leading-snug">{item.title}</p>
  );
  const secondary = renderSecondary
    ? renderSecondary(item)
    : `${item.authors || ''}${item.authors && item.year ? ' · ' : ''}${item.year || ''}`;
  const badges = renderBadges ? renderBadges(item) : null;
  const tertiary = renderTertiary ? renderTertiary(item) : null;
  return (
    <div className="py-3 border-b border-stone-100 last:border-0 flex items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        {titleEl}
        {secondary && <p className="text-xs text-stone-400 mt-0.5">{secondary}</p>}
        {tertiary && <p className="text-xs text-stone-500 mt-1 leading-relaxed">{tertiary}</p>}
        {badges && <div className="flex flex-wrap items-center gap-1.5 mt-1.5">{badges}</div>}
      </div>
      {renderMetric && (
        <div className="shrink-0 text-xs font-mono text-stone-500 whitespace-nowrap pt-0.5">
          {renderMetric(item)}
        </div>
      )}
    </div>
  );
}

export function Panel({ title, subtitle, items, renderMetric, renderLink, renderSecondary, renderBadges, renderTertiary, emptyText, emptyContent, loading, headerRight, children }) {
  return (
    <div className="border border-stone-200 bg-white">
      <div className="px-5 py-3 border-b border-stone-200 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-stone-900">{title}</h3>
          {subtitle && <p className="text-xs text-stone-400 mt-0.5">{subtitle}</p>}
        </div>
        {headerRight && <div className="shrink-0">{headerRight}</div>}
      </div>
      {children ? (
        <div className="px-5">{children}</div>
      ) : loading ? (
        <div className="px-5 py-6 flex items-center gap-2.5 text-stone-400">
          <span className="flex gap-0.5">
            <span className="loading-dot" /><span className="loading-dot" /><span className="loading-dot" />
          </span>
          <span className="text-sm">Loading...</span>
        </div>
      ) : items.length === 0 ? (
        emptyContent || <p className="px-5 py-6 text-sm text-stone-400">{emptyText || 'No data found.'}</p>
      ) : (
        <div className="px-5">
          {items.map((item, i) => (
            <ItemRow key={i} item={item} renderMetric={renderMetric} renderLink={renderLink} renderSecondary={renderSecondary} renderBadges={renderBadges} renderTertiary={renderTertiary} />
          ))}
        </div>
      )}
    </div>
  );
}
