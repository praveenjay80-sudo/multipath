function citKey(title) {
  return title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 60);
}

export default function CandidatePreview({ candidates, citations, progress }) {
  if (!candidates.length) return null;

  const verified = candidates.filter(c => citations[citKey(c.title)] != null).length;

  return (
    <div className="mt-8 border border-stone-200 bg-white">
      <div className="px-5 py-3.5 border-b border-stone-100 flex items-center justify-between">
        <span className="text-xs font-mono uppercase tracking-widest text-stone-500">
          Verifying Impact
        </span>
        <span className="text-xs font-mono text-stone-400">
          {verified}/{candidates.length} verified
        </span>
      </div>

      <div className="divide-y divide-stone-50 max-h-72 overflow-y-auto">
        {candidates.map((c, i) => {
          const cit = citations[citKey(c.title)];
          const done = cit != null;
          return (
            <div key={i} className="px-5 py-2 flex items-center gap-3">
              <span className={`text-xs font-mono shrink-0 w-3 ${done ? 'text-emerald-500' : 'text-stone-200'}`}>
                {done ? '✓' : '·'}
              </span>
              <span className={`text-sm flex-1 truncate ${done ? 'text-stone-700' : 'text-stone-400'}`}>
                {c.title}
                {c.author && (
                  <span className={`ml-1.5 ${done ? 'text-stone-400' : 'text-stone-300'}`}>
                    — {c.author}
                  </span>
                )}
              </span>
              {cit?.citationCount != null && (
                <span className="text-xs font-mono text-stone-500 shrink-0">
                  {cit.citationCount.toLocaleString()}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
