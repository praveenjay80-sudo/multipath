const SOURCE_LABELS = {
  'openalex-papers':           { label: 'OA',  color: 'text-blue-600 bg-blue-50 border-blue-100' },
  'openalex-books':            { label: 'OA',  color: 'text-blue-600 bg-blue-50 border-blue-100' },
  'openalex-recent':           { label: 'OA↑', color: 'text-sky-600 bg-sky-50 border-sky-100' },
  'semantic-scholar':          { label: 'S2',  color: 'text-violet-600 bg-violet-50 border-violet-100' },
  'semantic-scholar-textbooks':{ label: 'S2T', color: 'text-purple-600 bg-purple-50 border-purple-100' },
  'google-books':              { label: 'GB',  color: 'text-rose-600 bg-rose-50 border-rose-100' },
  'open-library':              { label: 'OL',  color: 'text-emerald-600 bg-emerald-50 border-emerald-100' },
};

function SourceBadge({ source }) {
  const cfg = SOURCE_LABELS[source] || { label: source, color: 'text-stone-500 bg-stone-50 border-stone-100' };
  return (
    <span className={`text-xs font-mono px-1 py-0.5 border rounded ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

export default function CandidatePreview({ candidates, harvestCounts }) {
  if (!candidates?.length) return null;

  const books  = candidates.filter(w => w.type === 'book' || (w.editionCount || 0) > 0).length;
  const papers = candidates.length - books;

  return (
    <div className="mt-6 border border-stone-200 bg-white">
      <div className="px-5 py-3.5 border-b border-stone-100">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-mono text-stone-500">
            Harvested from Real Databases
          </span>
          <span className="text-xs font-mono text-stone-400">
            {candidates.length} unique works · {papers} papers · {books} books
          </span>
        </div>
        {harvestCounts && (
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
            {Object.entries(harvestCounts).map(([source, count]) => (
              <span key={source} className="text-xs text-stone-400">
                <span className="text-stone-500">{source}:</span> {count}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="divide-y divide-stone-50 max-h-80 overflow-y-auto">
        {candidates.slice(0, 60).map((w, i) => {
          const isBook = w.type === 'book' || (w.editionCount || 0) > 0;
          const signal = isBook && w.editionCount
            ? `${w.editionCount} ed.`
            : w.influentialCitationCount
            ? `${w.influentialCitationCount} infl.`
            : w.citationCount
            ? `${w.citationCount.toLocaleString()} cit.`
            : null;

          return (
            <div key={i} className="px-5 py-2 flex items-center gap-3">
              <span className="text-xs font-mono text-stone-300 shrink-0 w-5 text-right">{i + 1}</span>
              <span className={`text-xs shrink-0 px-1 py-0.5 rounded font-mono ${
                isBook ? 'text-amber-600 bg-amber-50' : 'text-stone-400 bg-stone-50'
              }`}>
                {isBook ? 'B' : 'P'}
              </span>
              <span className="text-sm flex-1 truncate text-stone-700">
                {w.title}
                {w.authors && <span className="ml-1.5 text-stone-400">— {w.authors}</span>}
              </span>
              <div className="flex items-center gap-1.5 shrink-0">
                {(w.sources || [w.source]).map(s => <SourceBadge key={s} source={s} />)}
                {signal && (
                  <span className="text-xs font-mono text-stone-500 ml-1">{signal}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="px-5 py-2.5 border-t border-stone-100 bg-stone-50">
        <p className="text-xs text-stone-400">
          Ranked by composite score: influential citations (papers) · edition count + reader ratings (books) · cross-source appearances · FWCI · textbook signal
        </p>
      </div>
    </div>
  );
}
