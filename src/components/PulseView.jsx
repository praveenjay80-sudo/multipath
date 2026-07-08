import { useState } from 'react';
import { recentCitationVelocity } from '../utils/pulseOpenAlex';

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

function Panel({ title, subtitle, items, renderMetric, renderLink, renderSecondary, renderBadges, emptyText, emptyContent, loading }) {
  return (
    <div className="border border-stone-200 bg-white">
      <div className="px-5 py-3 border-b border-stone-200">
        <h3 className="text-sm font-semibold text-stone-900">{title}</h3>
        {subtitle && <p className="text-xs text-stone-400 mt-0.5">{subtitle}</p>}
      </div>
      {loading ? (
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
          {items.map((item, i) => {
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
              <div key={i} className="py-3 border-b border-stone-100 last:border-0 flex items-start justify-between gap-4">
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
          })}
        </div>
      )}
    </div>
  );
}

export default function PulseView({
  topicName, mostCited, rising, topAuthors, mostInfluential, scholar, scholarLoading, scholarFailed, onScholarKeySaved,
}) {
  const asOf = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  const authorItems = (topAuthors || []).map(a => ({ ...a, title: a.name }));

  return (
    <div className="mt-10">
      <div className="mb-6">
        <p className="text-xs font-mono text-stone-400 mb-1">Pulse · live, not generated · as of {asOf}</p>
        <h2 className="text-xl font-semibold text-stone-900 tracking-tight leading-snug">{topicName}</h2>
        <div className="mt-4 h-px bg-stone-200" />
      </div>

      <div className="grid grid-cols-1 gap-6">
        <Panel
          title="Most Cited"
          subtitle="OpenAlex, ranked by total citations, filtered to this exact topic"
          items={mostCited}
          renderMetric={w => `${w.citationCount.toLocaleString()} cit.`}
          renderLink={w => w.oaUrl || (w.doi ? w.doi : null)}
          renderBadges={workBadges}
        />
        <Panel
          title="Rising"
          subtitle="Same works, ranked by citations in the last 2 years"
          items={rising}
          renderMetric={w => `${recentCitationVelocity(w).toLocaleString()} cit. / 2yr`}
          renderLink={w => w.oaUrl || (w.doi ? w.doi : null)}
          renderBadges={workBadges}
        />
        <Panel
          title="Most Cited Researchers"
          subtitle="Aggregated citation totals across the works above — attributes each work's citations to every listed coauthor, not a separate author-level lookup"
          items={authorItems}
          renderMetric={a => `${a.citationCount.toLocaleString()} cit.`}
          renderLink={a => a.id || null}
          renderSecondary={a => `${a.workCount} work${a.workCount === 1 ? '' : 's'} in this set`}
        />
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
