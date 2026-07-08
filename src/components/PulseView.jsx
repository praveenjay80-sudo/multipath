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

function Panel({ title, subtitle, items, renderMetric, renderLink, emptyText, emptyContent, loading }) {
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 px-5 py-2">
          {items.map((item, i) => {
            const link = renderLink ? renderLink(item) : null;
            const titleEl = link ? (
              <a href={link} target="_blank" rel="noreferrer" className="text-xs font-medium text-stone-800 hover:text-stone-950 hover:underline line-clamp-2 leading-snug">
                {item.title}
              </a>
            ) : (
              <p className="text-xs font-medium text-stone-800 line-clamp-2 leading-snug">{item.title}</p>
            );
            return (
              <div key={i} className="py-2 border-b border-stone-100 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  {titleEl}
                  <p className="text-[11px] text-stone-400 mt-0.5 truncate">
                    {item.authors}{item.authors && item.year ? ' · ' : ''}{item.year}
                  </p>
                </div>
                <div className="shrink-0 text-[11px] font-mono text-stone-500 whitespace-nowrap pt-0.5">
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
  topicName, mostCited, rising, mostInfluential, scholar, scholarLoading, scholarFailed, onScholarKeySaved,
}) {
  const asOf = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

  return (
    <div className="mt-10">
      <div className="mb-6">
        <p className="text-xs font-mono text-stone-400 mb-1">Pulse · live, not generated · as of {asOf}</p>
        <h2 className="text-xl font-semibold text-stone-900 tracking-tight leading-snug">{topicName}</h2>
        <div className="mt-4 h-px bg-stone-200" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Panel
          title="Most Cited"
          subtitle="OpenAlex, ranked by total citations, filtered to this exact topic"
          items={mostCited}
          renderMetric={w => `${w.citationCount.toLocaleString()} cit.`}
          renderLink={w => w.oaUrl || (w.doi ? w.doi : null)}
        />
        <Panel
          title="Rising"
          subtitle="Same works, ranked by citations in the last 2 years"
          items={rising}
          renderMetric={w => `${recentCitationVelocity(w).toLocaleString()} cit. / 2yr`}
          renderLink={w => w.oaUrl || (w.doi ? w.doi : null)}
        />
        <Panel
          title="Most Influential Papers"
          subtitle="Of the works above, ranked by Semantic Scholar's influential-citation count"
          items={mostInfluential}
          renderMetric={p => `${p.influentialCitationCount.toLocaleString()} infl.`}
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
