function fwciLabel(fwci) {
  if (fwci === null || fwci === undefined) return null;
  if (fwci >= 3) return { label: 'Exceptional', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
  if (fwci >= 2) return { label: 'Excellent', color: 'text-emerald-600 bg-emerald-50 border-emerald-100' };
  if (fwci >= 1) return { label: 'Above avg', color: 'text-blue-600 bg-blue-50 border-blue-100' };
  if (fwci >= 0.5) return { label: 'Average', color: 'text-stone-500 bg-stone-50 border-stone-200' };
  return { label: 'Below avg', color: 'text-amber-600 bg-amber-50 border-amber-100' };
}

function FwciBadge({ fwci }) {
  if (fwci === null || fwci === undefined) return null;
  const info = fwciLabel(fwci);
  return (
    <span className={`inline-flex items-center gap-1 text-xs border px-1.5 py-0.5 ${info.color}`}>
      <span className="font-mono font-medium">{fwci.toFixed(2)}</span>
      <span className="text-stone-400">FWCI</span>
      <span>·</span>
      <span>{info.label}</span>
    </span>
  );
}

function TypeBadge({ type }) {
  if (!type) return null;
  const labels = {
    'journal-article': 'Paper',
    'book': 'Book',
    'book-chapter': 'Chapter',
    'preprint': 'Preprint',
    'dataset': 'Dataset',
    'dissertation': 'Thesis',
  };
  return (
    <span className="text-xs text-stone-400 border border-stone-200 px-1.5 py-0.5">
      {labels[type] || type}
    </span>
  );
}

function OABadge({ isOA, oaUrl }) {
  if (!isOA) return null;
  const el = <span className="text-xs text-emerald-600 border border-emerald-200 bg-emerald-50 px-1.5 py-0.5">Open Access</span>;
  return oaUrl ? <a href={oaUrl} target="_blank" rel="noreferrer">{el}</a> : el;
}

function VerificationRow({ v }) {
  return (
    <div className="py-4 border-b border-stone-100 last:border-0">
      <div className="flex items-start gap-3">
        <span className={`mt-1.5 shrink-0 w-2 h-2 rounded-full ${v.found ? 'bg-emerald-500' : 'bg-red-400'}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="text-sm font-medium text-stone-800">{v.entry.title}</span>
              {v.entry.author && <span className="text-sm text-stone-400"> — {v.entry.author}</span>}
              {v.entry.year && <span className="text-sm text-stone-400 ml-1">({v.entry.year})</span>}
            </div>
            <span className="shrink-0 text-xs text-stone-300">Tier {v.entry.tierNumber}</span>
          </div>

          {v.found ? (
            <div className="mt-2 flex flex-wrap gap-2 items-center">
              {v.citationCount != null && (
                <span className="text-xs font-mono text-stone-500">
                  {v.citationCount.toLocaleString()} citations
                </span>
              )}
              {v.fwci != null && <FwciBadge fwci={v.fwci} />}
              {v.percentile != null && (
                <span className="text-xs text-stone-400">
                  top {100 - v.percentile}% in year
                </span>
              )}
              <TypeBadge type={v.type} />
              <OABadge isOA={v.isOA} oaUrl={v.oaUrl} />
              {v.venue && <span className="text-xs text-stone-400 italic">{v.venue}</span>}
            </div>
          ) : (
            <p className="mt-1 text-xs text-red-500">Not found in OpenAlex — verify manually</p>
          )}

          {v.topics?.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {v.topics.map((t, i) => (
                <span key={i} className="text-xs text-stone-400 bg-stone-100 px-1.5 py-0.5">{t}</span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MissingWork({ work }) {
  return (
    <div className="py-3 border-b border-stone-100 last:border-0">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="text-sm font-medium text-stone-800">{work.title}</span>
          {work.authors && <span className="text-sm text-stone-400"> — {work.authors}</span>}
          {work.year && <span className="text-sm text-stone-400 ml-1">({work.year})</span>}
        </div>
        <div className="shrink-0 flex flex-col items-end gap-1">
          {work.citationCount > 0 && (
            <span className="text-xs font-mono text-amber-600 bg-amber-50 border border-amber-100 px-2 py-0.5">
              {work.citationCount.toLocaleString()} citations
            </span>
          )}
          {work.fwci != null && <FwciBadge fwci={work.fwci} />}
        </div>
      </div>
      {work.venue && <p className="text-xs text-stone-400 mt-1 italic">{work.venue}</p>}
      {work.snippet && <p className="text-xs text-stone-400 mt-1 leading-relaxed">{work.snippet}</p>}
    </div>
  );
}

export default function ValidationPanel({ status, progress, results, onValidate, onClose }) {
  if (status === 'idle') {
    return (
      <div className="mt-6 border border-stone-200 bg-white p-6">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h3 className="font-medium text-stone-900 text-sm">Validate Canon</h3>
            <p className="text-xs text-stone-400 mt-1 leading-relaxed max-w-lg">
              Cross-reference against OpenAlex (250M+ works). Verifies existence, retrieves citation counts,
              FWCI (field-weighted citation impact), open access status, and surfaces high-impact works missing from the canon.
            </p>
          </div>
          <button
            onClick={onValidate}
            className="shrink-0 px-4 py-2 bg-stone-900 text-white text-xs hover:bg-stone-700 transition-colors"
          >
            Run Validation
          </button>
        </div>
      </div>
    );
  }

  if (status === 'running') {
    return (
      <div className="mt-6 border border-stone-200 bg-white p-6">
        <div className="flex items-center gap-3">
          <div className="flex gap-1 text-stone-400">
            <span className="loading-dot" />
            <span className="loading-dot" />
            <span className="loading-dot" />
          </div>
          <span className="text-sm text-stone-500">{progress || 'Validating...'}</span>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="mt-6 border border-red-200 bg-red-50 p-5 flex items-center justify-between">
        <span className="text-sm text-red-700">Validation failed. Check your connection and try again.</span>
        <button onClick={onClose} className="text-xs text-red-500 underline ml-4">Dismiss</button>
      </div>
    );
  }

  if (!results) return null;

  const { verifications, missing, confidence, notFound, usedScholar } = results;
  const fwciExplainer = 'FWCI (Field-Weighted Citation Impact): ratio of citations received vs. expected for works in the same field and year. > 1 = above average; > 2 = excellent; > 3 = exceptional.';

  return (
    <div className="mt-6 border border-stone-200 bg-white">
      {/* Summary header */}
      <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-6">
          <div>
            <span className={`text-2xl font-semibold tabular-nums ${
              confidence >= 80 ? 'text-emerald-600' : confidence >= 60 ? 'text-amber-600' : 'text-red-500'
            }`}>
              {confidence}%
            </span>
            <span className="text-stone-400 text-sm ml-2">verified</span>
          </div>
          <div className="text-xs text-stone-400 leading-relaxed max-w-xs" title={fwciExplainer}>
            FWCI = citations received ÷ expected for field &amp; year.
            Values: &gt;1 above avg · &gt;2 excellent · &gt;3 exceptional
          </div>
          {usedScholar && (
            <span className="text-xs text-stone-400 border border-stone-200 px-2 py-1">+ Google Scholar</span>
          )}
        </div>
        <button onClick={onClose} className="text-xs text-stone-400 hover:text-stone-700 transition-colors">
          Close
        </button>
      </div>

      {/* Not found */}
      {notFound.length > 0 && (
        <div className="px-6 py-4 border-b border-stone-100 bg-red-50">
          <h4 className="text-xs font-medium text-red-700 mb-2">
            {notFound.length} work{notFound.length !== 1 ? 's' : ''} not found in OpenAlex
          </h4>
          {notFound.map((v, i) => (
            <div key={i} className="text-sm text-red-600 py-1">
              <span className="font-medium">{v.entry.title}</span>
              {v.entry.author && <span className="text-red-400"> — {v.entry.author}</span>}
            </div>
          ))}
        </div>
      )}

      {/* Missing high-impact works */}
      {missing.length > 0 && (
        <div className="px-6 py-4 border-b border-stone-100">
          <h4 className="text-xs font-medium text-amber-700 mb-3">
            {missing.length} high-impact work{missing.length !== 1 ? 's' : ''} not in canon
          </h4>
          {missing.map((work, i) => (
            <MissingWork key={i} work={work} />
          ))}
        </div>
      )}

      {/* Full verification list */}
      <div className="px-6 py-2">
        <h4 className="text-xs text-stone-400 font-medium py-3 border-b border-stone-100">
          All works — citation data from OpenAlex
        </h4>
        {verifications.map((v, i) => (
          <VerificationRow key={i} v={v} />
        ))}
      </div>
    </div>
  );
}
