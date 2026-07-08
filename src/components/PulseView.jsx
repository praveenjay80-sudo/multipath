import { recentCitationVelocity } from '../utils/pulseOpenAlex';

function Panel({ title, subtitle, items, renderMetric, renderLink, emptyText }) {
  return (
    <div className="border border-stone-200 bg-white">
      <div className="px-5 py-3 border-b border-stone-200">
        <h3 className="text-sm font-semibold text-stone-900">{title}</h3>
        {subtitle && <p className="text-xs text-stone-400 mt-0.5">{subtitle}</p>}
      </div>
      {items.length === 0 ? (
        <p className="px-5 py-6 text-sm text-stone-400">{emptyText || 'No data found.'}</p>
      ) : (
        <div className="divide-y divide-stone-100">
          {items.map((item, i) => {
            const link = renderLink ? renderLink(item) : null;
            const titleEl = link ? (
              <a href={link} target="_blank" rel="noreferrer" className="text-sm font-medium text-stone-800 hover:text-stone-950 hover:underline truncate block">
                {item.title}
              </a>
            ) : (
              <p className="text-sm font-medium text-stone-800 truncate">{item.title}</p>
            );
            return (
              <div key={i} className="px-5 py-3 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  {titleEl}
                  <p className="text-xs text-stone-400 mt-0.5">
                    {item.authors}{item.authors && item.year ? ' · ' : ''}{item.year}
                  </p>
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

export default function PulseView({ topicName, mostCited, rising, mostAssigned, mostInfluential, scholar, hasScholarKey }) {
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
          title="Most Assigned"
          subtitle="Open Syllabus Project, text-matched to this topic name — approximate, not ID-filtered"
          items={mostAssigned}
          renderMetric={w => `${(w.syllabusCount || 0).toLocaleString()} courses`}
        />
        <Panel
          title="Google Scholar"
          subtitle="Text-matched to this topic name — approximate, not ID-filtered"
          items={scholar}
          renderMetric={w => `${w.citationCount.toLocaleString()} cit.`}
          renderLink={w => w.link || null}
          emptyText={hasScholarKey ? 'No Google Scholar results found.' : 'Add a SerpAPI key in Settings above to see Google Scholar results.'}
        />
      </div>
    </div>
  );
}
