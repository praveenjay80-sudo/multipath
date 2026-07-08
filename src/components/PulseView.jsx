import { useState, useMemo } from 'react';
import { recentCitationVelocity } from '../utils/pulseOpenAlex';
import { READING_STAGES } from '../hooks/usePulse';

function ScholarKeyPrompt({ onSaved }) {
  const hasSavedKey = !!localStorage.getItem('canon_serp_key');
  const [draft, setDraft] = useState(() => localStorage.getItem('canon_serp_key') || '');
  const [saving, setSaving] = useState(false);

  async function save() {
    const v = draft.trim();
    if (!v) return;
    localStorage.setItem('canon_serp_key', v);
    setSaving(true);
    await onSaved();
    setSaving(false);
  }

  return (
    <div className="px-5 py-6">
      {hasSavedKey ? (
        <p className="text-sm text-stone-500 mb-3">
          A SerpAPI key is already saved, but the last request still failed — either the key itself is wrong, or the backend endpoint this depends on hasn't finished deploying yet. Update the key below, or click Reload to try again.
        </p>
      ) : (
        <p className="text-sm text-stone-500 mb-3">The shared Google Scholar lookup didn't return results (likely quota-limited). Add your own SerpAPI key to see results for this topic.</p>
      )}
      <div className="flex gap-2">
        <input
          type="password"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && save()}
          placeholder="serpapi key..."
          className="flex-1 px-3 py-2 text-sm border border-stone-200 bg-white text-stone-900 placeholder-stone-300 focus:outline-none focus:border-stone-700 transition-colors font-mono"
        />
        <button
          onClick={save}
          disabled={!draft.trim() || saving}
          className="px-4 py-2 text-xs bg-stone-900 text-white hover:bg-stone-700 transition-colors disabled:opacity-40 whitespace-nowrap"
        >
          {saving ? 'Loading...' : hasSavedKey ? 'Reload' : 'Save & Load'}
        </button>
      </div>
      <p className="text-xs text-stone-300 mt-2">
        Stored in this browser only. Get one at{' '}
        <a href="https://serpapi.com/manage-api-key" target="_blank" rel="noreferrer" className="underline hover:text-stone-500">
          serpapi.com
        </a>.
      </p>
    </div>
  );
}

// Mirrors BookEntry.jsx's FwciBadge — same thresholds/colors, kept in sync by hand.
function FwciBadge({ fwci }) {
  const color = fwci >= 3 ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
    : fwci >= 2 ? 'text-emerald-600 bg-emerald-50 border-emerald-100'
    : fwci >= 1 ? 'text-blue-600 bg-blue-50 border-blue-100'
    : fwci >= 0.5 ? 'text-stone-500 bg-stone-50 border-stone-200'
    : 'text-amber-600 bg-amber-50 border-amber-100';
  const label = fwci >= 3 ? 'Exceptional' : fwci >= 2 ? 'Excellent' : fwci >= 1 ? 'Above avg' : fwci >= 0.5 ? 'Average' : 'Below avg';
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] border px-1.5 py-0.5 ${color}`}>
      <span className="font-mono font-semibold">{fwci.toFixed(2)}</span>
      <span className="opacity-60">FWCI</span>
      <span className="opacity-40">·</span>
      <span>{label}</span>
    </span>
  );
}

const TYPE_LABELS = { article: 'Paper', book: 'Book', 'book-chapter': 'Chapter', preprint: 'Preprint', dissertation: 'Thesis' };

function workBadges(w) {
  const badges = [];
  if (w.crossVerified) {
    badges.push(
      <span key="xv" className="inline-flex items-center gap-1 text-[10px] text-violet-700 border border-violet-200 bg-violet-50 px-1.5 py-0.5" title="Also ranks among Semantic Scholar's Most Influential Papers for this set — cited by later work in a way that builds on it, not just background citations">
        ✓ Cross-verified
      </span>
    );
  }
  if (w.fwci != null) badges.push(<FwciBadge key="fwci" fwci={w.fwci} />);
  if (w.percentile != null) {
    badges.push(
      <span key="pct" className="text-[10px] text-stone-400 border border-stone-200 px-1.5 py-0.5">
        {w.percentile}th pct. (same year)
      </span>
    );
  }
  if (w.type) {
    badges.push(
      <span key="type" className="text-[10px] text-stone-400 border border-stone-200 px-1.5 py-0.5">
        {TYPE_LABELS[w.type] || w.type}
      </span>
    );
  }
  if (w.isOA) {
    badges.push(
      <span key="oa" className="text-[10px] text-emerald-600 border border-emerald-200 bg-emerald-50 px-1.5 py-0.5">
        Open Access
      </span>
    );
  }
  if (w.venue) {
    badges.push(
      <span key="venue" className="text-[10px] text-stone-400 truncate max-w-[220px]">
        {w.venue}
      </span>
    );
  }
  return badges.length ? badges : null;
}

// Every metric a work carries — total citations, FWCI, same-year percentile,
// recent (2yr) velocity. Picking one re-sorts and re-labels the primary metric;
// the badge row below always shows all of them regardless of sort.
const WORK_SORTS = {
  citations: {
    label: 'Total citations',
    compare: (a, b) => b.citationCount - a.citationCount,
    metric: w => `${w.citationCount.toLocaleString()} cit.`,
  },
  fwci: {
    label: 'FWCI',
    compare: (a, b) => (b.fwci ?? -1) - (a.fwci ?? -1),
    metric: w => (w.fwci != null ? w.fwci.toFixed(2) : '—'),
  },
  percentile: {
    label: 'Percentile (same year)',
    compare: (a, b) => (b.percentile ?? -1) - (a.percentile ?? -1),
    metric: w => (w.percentile != null ? `${w.percentile}th pct.` : '—'),
  },
  velocity: {
    label: 'Recent velocity (2yr)',
    compare: (a, b) => recentCitationVelocity(b) - recentCitationVelocity(a),
    metric: w => `${recentCitationVelocity(w).toLocaleString()} cit. / 2yr`,
  },
};

// H-index/i10-index are career-wide (from the author's own OpenAlex profile),
// while citations/work-count here are scoped to just the works in this set.
const AUTHOR_SORTS = {
  citations: {
    label: 'Total citations (this set)',
    compare: (a, b) => b.citationCount - a.citationCount,
    metric: a => `${a.citationCount.toLocaleString()} cit.`,
  },
  hindex: {
    label: 'H-index (career)',
    compare: (a, b) => (b.hIndex ?? -1) - (a.hIndex ?? -1),
    metric: a => (a.hIndex != null ? `H-${a.hIndex}` : '—'),
  },
  works: {
    label: 'Works in this set',
    compare: (a, b) => b.workCount - a.workCount,
    metric: a => `${a.workCount} work${a.workCount === 1 ? '' : 's'}`,
  },
};

function SortSelect({ value, onChange, options }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="text-[11px] border border-stone-200 bg-white px-2 py-1 text-stone-600 focus:outline-none focus:border-stone-700 transition-colors"
    >
      {Object.entries(options).map(([key, o]) => (
        <option key={key} value={key}>{o.label}</option>
      ))}
    </select>
  );
}

function ItemRow({ item, renderMetric, renderLink, renderSecondary, renderBadges }) {
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
  return (
    <div className="py-3 border-b border-stone-100 last:border-0 flex items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        {titleEl}
        {secondary && <p className="text-xs text-stone-400 mt-0.5">{secondary}</p>}
        {badges && <div className="flex flex-wrap items-center gap-1.5 mt-1.5">{badges}</div>}
      </div>
      <div className="shrink-0 text-xs font-mono text-stone-500 whitespace-nowrap pt-0.5">
        {renderMetric(item)}
      </div>
    </div>
  );
}

function Panel({ title, subtitle, items, renderMetric, renderLink, renderSecondary, renderBadges, emptyText, emptyContent, loading, headerRight, children }) {
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
            <ItemRow key={i} item={item} renderMetric={renderMetric} renderLink={renderLink} renderSecondary={renderSecondary} renderBadges={renderBadges} />
          ))}
        </div>
      )}
    </div>
  );
}

function worksSubtitle(isTextMatch, wasClaudeValidated) {
  if (!isTextMatch) return 'OpenAlex, filtered to this exact topic';
  return wasClaudeValidated
    ? 'OpenAlex, text-matched to this Claude-suggested topic — then Claude-checked to drop any that turned out unrelated'
    : 'OpenAlex — text-matched to this Claude-suggested topic, not ID-filtered';
}

function ViewToggle({ mode, onChange }) {
  const base = 'px-2 py-1 text-[11px] border transition-colors';
  return (
    <div className="flex">
      <button
        type="button"
        onClick={() => onChange('ranked')}
        className={`${base} border-stone-200 ${mode === 'ranked' ? 'bg-stone-900 text-white border-stone-900' : 'bg-white text-stone-500 hover:bg-stone-50'}`}
      >
        Ranked
      </button>
      <button
        type="button"
        onClick={() => onChange('stages')}
        className={`${base} border-l-0 ${mode === 'stages' ? 'bg-violet-700 text-white border-violet-700' : 'bg-white text-violet-600 border-stone-200 hover:bg-violet-50'}`}
        title="Groups works into a pedagogical reading sequence — classified by Claude, not by any citation metric"
      >
        ✨ Reading Order
      </button>
    </div>
  );
}

export default function PulseView({
  topicName, isTextMatch, wasClaudeValidated, mostCited, topAuthors, mostInfluential, scholar, scholarLoading, scholarFailed, onScholarKeySaved,
  readingStages, readingStagesLoading, readingStagesFailed, onLoadReadingStages,
}) {
  const asOf = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  const [workSort, setWorkSort] = useState('citations');
  const [authorSort, setAuthorSort] = useState('citations');
  const [worksView, setWorksView] = useState('ranked');

  const influentialDois = useMemo(
    () => new Set((mostInfluential || []).map(p => p.doi).filter(Boolean)),
    [mostInfluential]
  );
  const sortedWorks = useMemo(
    () => mostCited
      .map((w, i) => ({ ...w, originalIndex: i, crossVerified: !!(w.doi && influentialDois.has(w.doi)) }))
      .sort(WORK_SORTS[workSort].compare),
    [mostCited, workSort, influentialDois]
  );
  const sortedAuthors = useMemo(
    () => (topAuthors || []).map(a => ({ ...a, title: a.name })).sort(AUTHOR_SORTS[authorSort].compare),
    [topAuthors, authorSort]
  );
  const stageGroups = useMemo(() => {
    if (!readingStages) return null;
    const groups = new Map(READING_STAGES.map(s => [s, []]));
    const unclassified = [];
    for (const w of sortedWorks) {
      const stage = readingStages[w.originalIndex];
      if (stage && groups.has(stage)) groups.get(stage).push(w);
      else unclassified.push(w);
    }
    return { groups, unclassified };
  }, [sortedWorks, readingStages]);

  function handleWorksViewChange(mode) {
    setWorksView(mode);
    if (mode === 'stages' && !readingStages && !readingStagesLoading) onLoadReadingStages();
  }

  return (
    <div className="mt-10">
      <div className="mb-6">
        <p className="text-xs font-mono text-stone-400 mb-1">Master Reading List · live, not generated · as of {asOf}</p>
        <h2 className="text-xl font-semibold text-stone-900 tracking-tight leading-snug">{topicName}</h2>
        <div className="mt-4 h-px bg-stone-200" />
      </div>

      <div className="grid grid-cols-1 gap-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Panel
            title="Most Cited Works"
            subtitle={worksView === 'stages'
              ? 'Grouped into a Claude-classified pedagogical sequence — the numbers below are still real, only the grouping is AI-assigned'
              : worksSubtitle(isTextMatch, wasClaudeValidated)}
            items={sortedWorks}
            renderMetric={WORK_SORTS[workSort].metric}
            renderLink={w => w.oaUrl || (w.doi ? w.doi : null)}
            renderBadges={workBadges}
            emptyText={wasClaudeValidated ? "OpenAlex found text matches, but Claude didn't judge any of them to be genuinely about this topic." : undefined}
            headerRight={
              <div className="flex items-center gap-2">
                <ViewToggle mode={worksView} onChange={handleWorksViewChange} />
                {worksView === 'ranked' && <SortSelect value={workSort} onChange={setWorkSort} options={WORK_SORTS} />}
              </div>
            }
          >
            {worksView === 'stages' && (
              readingStagesLoading ? (
                <div className="py-6 flex items-center gap-2.5 text-stone-400">
                  <span className="flex gap-0.5">
                    <span className="loading-dot" /><span className="loading-dot" /><span className="loading-dot" />
                  </span>
                  <span className="text-sm">Claude is placing each work in the reading sequence...</span>
                </div>
              ) : readingStagesFailed ? (
                <div className="py-6">
                  <p className="text-sm text-stone-400 mb-2">Couldn't classify these works right now.</p>
                  <button onClick={onLoadReadingStages} className="text-xs text-violet-600 hover:underline">Try again</button>
                </div>
              ) : stageGroups ? (
                <>
                  {READING_STAGES.map(stage => {
                    const stageWorks = stageGroups.groups.get(stage);
                    return (
                      <div key={stage} className="pt-4 first:pt-0">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-600 mb-1">{stage}</p>
                        {stageWorks.length === 0 ? (
                          <p className="text-xs text-stone-300 pb-2">No work in this set fit this stage.</p>
                        ) : (
                          stageWorks.map((item, i) => (
                            <ItemRow key={i} item={item} renderMetric={WORK_SORTS.citations.metric} renderLink={w => w.oaUrl || (w.doi ? w.doi : null)} renderBadges={workBadges} />
                          ))
                        )}
                      </div>
                    );
                  })}
                  {stageGroups.unclassified.length > 0 && (
                    <div className="pt-4">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-400 mb-1">Unclassified</p>
                      {stageGroups.unclassified.map((item, i) => (
                        <ItemRow key={i} item={item} renderMetric={WORK_SORTS.citations.metric} renderLink={w => w.oaUrl || (w.doi ? w.doi : null)} renderBadges={workBadges} />
                      ))}
                    </div>
                  )}
                </>
              ) : null
            )}
          </Panel>
          <Panel
            title="Most Cited Researchers"
            subtitle="Aggregated across the works above — every listed coauthor is credited the work's citations"
            items={sortedAuthors}
            renderMetric={AUTHOR_SORTS[authorSort].metric}
            renderLink={a => a.id || null}
            renderSecondary={a => `${a.workCount} work${a.workCount === 1 ? '' : 's'} in this set${a.hIndex != null ? ` · H-index ${a.hIndex} (career)` : ''}`}
            headerRight={<SortSelect value={authorSort} onChange={setAuthorSort} options={AUTHOR_SORTS} />}
          />
        </div>
        <Panel
          title="Most Influential Papers"
          subtitle="Of the works above, ranked by Semantic Scholar's influential-citation count"
          items={mostInfluential}
          renderMetric={p => `${p.influentialCitationCount.toLocaleString()} infl.`}
          renderSecondary={p => `${p.authors || ''}${p.authors && p.year ? ' · ' : ''}${p.year || ''}${p.citationCount ? ` · ${p.citationCount.toLocaleString()} total cit.` : ''}`}
          emptyText="No Semantic Scholar match for these works yet."
        />
        <Panel
          title="Google Scholar"
          subtitle="Text-matched to this topic name — approximate, not ID-filtered"
          items={scholar}
          loading={scholarLoading}
          renderMetric={w => `${w.citationCount.toLocaleString()} cit.`}
          renderLink={w => w.link || null}
          emptyText="No Google Scholar results found."
          emptyContent={scholarFailed ? <ScholarKeyPrompt onSaved={onScholarKeySaved} /> : undefined}
        />
      </div>
    </div>
  );
}
