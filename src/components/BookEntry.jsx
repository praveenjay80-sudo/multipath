import { useState } from 'react';

function Field({ label, value }) {
  return (
    <div className="flex gap-3 text-sm">
      <span className="w-32 shrink-0 text-stone-400 text-xs pt-0.5">{label}</span>
      <span className="flex-1 text-stone-600 leading-relaxed">{value}</span>
    </div>
  );
}

function KeyChapters({ value }) {
  const chapters = value.split(/\s*;\s*/).filter(Boolean);
  if (!chapters.length) return null;
  return (
    <div className="flex gap-3 text-sm">
      <span className="w-32 shrink-0 text-stone-400 text-xs pt-0.5">Key chapters</span>
      <ul className="flex-1 space-y-1">
        {chapters.map((ch, i) => (
          <li key={i} className="text-stone-600 leading-relaxed">{ch.trim()}</li>
        ))}
      </ul>
    </div>
  );
}

function FwciBadge({ fwci }) {
  const color = fwci >= 3 ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
    : fwci >= 2 ? 'text-emerald-600 bg-emerald-50 border-emerald-100'
    : fwci >= 1 ? 'text-blue-600 bg-blue-50 border-blue-100'
    : fwci >= 0.5 ? 'text-stone-500 bg-stone-50 border-stone-200'
    : 'text-amber-600 bg-amber-50 border-amber-100';
  const label = fwci >= 3 ? 'Exceptional' : fwci >= 2 ? 'Excellent' : fwci >= 1 ? 'Above avg' : fwci >= 0.5 ? 'Average' : 'Below avg';
  return (
    <span className={`inline-flex items-center gap-1 text-xs border px-1.5 py-0.5 ${color}`}>
      <span className="font-mono font-semibold">{fwci.toFixed(2)}</span>
      <span className="opacity-60">FWCI</span>
      <span className="opacity-40">·</span>
      <span>{label}</span>
    </span>
  );
}

function renderExplanation(text) {
  if (!text) return null;
  const parts = text.split(/\n\n+/);
  return parts.map((block, i) => {
    if (block.startsWith('**') && block.includes('**\n')) {
      const newline = block.indexOf('\n');
      const heading = block.slice(2, block.indexOf('**', 2));
      const body = block.slice(newline + 1).trim();
      const isList = body.startsWith('-') || body.startsWith('•');
      return (
        <div key={i} className="mb-4 last:mb-0">
          <p className="text-xs font-bold text-stone-800 uppercase tracking-widest mb-2">{heading}</p>
          {isList ? (
            <ul className="space-y-1">
              {body.split('\n').filter(l => l.trim()).map((line, j) => (
                <li key={j} className="flex gap-2 text-xs text-stone-600 leading-relaxed">
                  <span className="text-stone-300 shrink-0 mt-0.5">—</span>
                  <span>{line.replace(/^[-•]\s*/, '')}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-stone-600 leading-relaxed">{body}</p>
          )}
        </div>
      );
    }
    return <p key={i} className="text-xs text-stone-600 leading-relaxed mb-2 last:mb-0">{block}</p>;
  });
}

export default function BookEntry({ entry, isPaper, citationData: cit, onExplain, explanation }) {
  const [showExplain, setShowExplain] = useState(false);

  function handleExplainToggle() {
    if (!showExplain && !explanation) {
      onExplain?.(entry.title, entry.author);
    }
    setShowExplain(v => !v);
  }

  const isLoading = explanation === 'loading';
  const isError = explanation === 'error';
  const hasExplanation = explanation && explanation !== 'loading' && explanation !== 'error';

  return (
    <div className="py-5 border-b border-stone-100 last:border-0 last:pb-0">
      {/* Title row */}
      <div className="flex items-start justify-between gap-4 mb-1">
        <div className="flex-1 min-w-0">
          <span className="font-semibold text-stone-900">{entry.title}</span>
          {entry.author && <span className="text-stone-500 font-normal"> — {entry.author}</span>}
          {entry.year && <span className="text-stone-400 text-sm ml-1.5">({entry.year})</span>}
        </div>
        {cit?.citationCount != null && (
          <span className="text-xs font-mono text-stone-400 shrink-0 pt-0.5 whitespace-nowrap">
            {cit.citationCount.toLocaleString()} citations
          </span>
        )}
      </div>

      {/* Badges */}
      {cit && (cit.fwci != null || cit.isOA || cit.scholarLink || cit.doi || cit.type || cit.venue) && (
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {cit.fwci != null && <FwciBadge fwci={cit.fwci} />}
          {cit.type && (
            <span className="text-xs text-stone-400 border border-stone-200 px-1.5 py-0.5">
              {{ 'journal-article': 'Paper', book: 'Book', 'book-chapter': 'Chapter', preprint: 'Preprint', dissertation: 'Thesis' }[cit.type] || cit.type}
            </span>
          )}
          {cit.isOA && (
            cit.oaUrl
              ? <a href={cit.oaUrl} target="_blank" rel="noreferrer" className="text-xs text-emerald-600 border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 hover:underline">Open Access</a>
              : <span className="text-xs text-emerald-600 border border-emerald-200 bg-emerald-50 px-1.5 py-0.5">Open Access</span>
          )}
          {cit.scholarLink && (
            <a href={cit.scholarLink} target="_blank" rel="noreferrer" className="text-xs text-stone-400 hover:text-stone-700 hover:underline font-mono">Scholar</a>
          )}
          {cit.doi && (
            <a href={`https://doi.org/${cit.doi}`} target="_blank" rel="noreferrer" className="text-xs text-stone-400 hover:text-stone-700 hover:underline font-mono">DOI</a>
          )}
          {cit.venue && <span className="text-xs text-stone-400 italic">{cit.venue}</span>}
        </div>
      )}

      {entry.description && (
        <p className="text-sm text-stone-600 leading-relaxed mb-4">{entry.description}</p>
      )}

      <div className="space-y-2.5">
        {isPaper ? (
          <>
            {entry.coreContribution && <Field label="Core contribution" value={entry.coreContribution} />}
            {entry.whyCanonical && <Field label="Why canonical" value={entry.whyCanonical} />}
            {entry.access && <Field label="Access" value={entry.access} />}
          </>
        ) : (
          <>
            {entry.whyCanonical && <Field label="Why canonical" value={entry.whyCanonical} />}
            {entry.whyThisTier && <Field label="Why this tier" value={entry.whyThisTier} />}
            {entry.keyChapters && <KeyChapters value={entry.keyChapters} />}
            {entry.audience && <Field label="Audience" value={entry.audience} />}
            {entry.difficulty && <Field label="Difficulty" value={entry.difficulty} />}
            {entry.prerequisites && <Field label="Prerequisites" value={entry.prerequisites} />}
          </>
        )}
      </div>

      {/* Explain toggle */}
      <button
        onClick={handleExplainToggle}
        className={`mt-4 inline-flex items-center gap-2 text-xs font-medium px-3 py-1.5 border rounded transition-colors ${
          showExplain
            ? 'bg-stone-900 text-white border-stone-900 hover:bg-stone-700 hover:border-stone-700'
            : 'bg-white text-stone-600 border-stone-300 hover:border-stone-600 hover:text-stone-900'
        }`}
      >
        <svg
          width="11" height="11" viewBox="0 0 11 11" fill="none"
          className={`transition-transform duration-150 ${showExplain ? 'rotate-180' : ''}`}
        >
          <path d="M1.5 3.5l4 4 4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="square" />
        </svg>
        {showExplain ? 'Hide explanation' : 'Explain this work'}
      </button>

      {/* Explanation panel */}
      {showExplain && (
        <div className="mt-3 bg-stone-50 border border-stone-200 rounded p-5">
          {isLoading && (
            <div className="flex items-center gap-2.5 text-xs text-stone-500">
              <span className="flex gap-0.5">
                <span className="loading-dot" style={{ width: 4, height: 4 }} />
                <span className="loading-dot" style={{ width: 4, height: 4 }} />
                <span className="loading-dot" style={{ width: 4, height: 4 }} />
              </span>
              Generating explanation...
            </div>
          )}
          {isError && (
            <p className="text-xs text-red-600">Could not load explanation. Check your API key.</p>
          )}
          {hasExplanation && renderExplanation(explanation)}
        </div>
      )}
    </div>
  );
}
