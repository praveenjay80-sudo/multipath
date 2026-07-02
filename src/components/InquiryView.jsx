const QUESTION_COLORS = [
  { border: 'border-stone-200',   num: 'text-stone-400'   },
  { border: 'border-sky-200',     num: 'text-sky-400'     },
  { border: 'border-indigo-200',  num: 'text-indigo-400'  },
  { border: 'border-violet-200',  num: 'text-violet-400'  },
  { border: 'border-teal-200',    num: 'text-teal-500'    },
  { border: 'border-emerald-200', num: 'text-emerald-500' },
  { border: 'border-amber-200',   num: 'text-amber-500'   },
  { border: 'border-rose-200',    num: 'text-rose-500'    },
];

function MetaRow({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex gap-3">
      <span className="text-xs font-mono text-stone-400 shrink-0 w-14 pt-0.5">{label}</span>
      <p className="text-sm text-stone-600 leading-relaxed flex-1">{value}</p>
    </div>
  );
}

export default function InquiryView({ parsed, isStreaming }) {
  if (!parsed) return null;

  const hasContent = parsed.topic || parsed.questions.length > 0;
  if (!hasContent) {
    return (
      <div className="mt-10 flex items-center gap-2.5 text-stone-400">
        <span className="flex gap-0.5">
          <span className="loading-dot" /><span className="loading-dot" /><span className="loading-dot" />
        </span>
        <span className="text-sm">Mapping open questions...</span>
      </div>
    );
  }

  return (
    <div className={`mt-10 ${isStreaming ? 'opacity-90' : ''}`}>

      {/* Header */}
      {parsed.topic && (
        <div className="mb-8">
          <p className="text-xs font-mono text-stone-400 mb-1">The Inquiry</p>
          <h2 className="text-xl font-semibold text-stone-900 tracking-tight leading-snug">{parsed.topic}</h2>
          {parsed.overview && (
            <p className="mt-3 text-sm text-stone-600 leading-relaxed max-w-2xl">{parsed.overview}</p>
          )}
          <div className="mt-4 h-px bg-stone-200" />
        </div>
      )}

      {/* Questions */}
      <div className="space-y-5">
        {parsed.questions.map((q, i) => {
          const c = QUESTION_COLORS[i % QUESTION_COLORS.length];
          return (
            <div key={i} className={`border ${c.border}`}>
              <div className="px-6 pt-5 pb-4 border-b border-inherit">
                <div className="flex items-start gap-3">
                  <span className={`text-xs font-mono mt-0.5 shrink-0 ${c.num}`}>Q{q.number}.</span>
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-stone-900 leading-snug">{q.question}</h3>
                    {q.plain && (
                      <p className="mt-1.5 text-sm text-stone-500 italic leading-relaxed">{q.plain}</p>
                    )}
                  </div>
                </div>
              </div>
              <div className="px-6 py-4 space-y-3">
                <MetaRow label="Matters" value={q.matters} />
                <MetaRow label="Hard" value={q.hard} />
                <MetaRow label="Tried" value={q.tried} />
                <MetaRow label="Action" value={q.action} />
                {q.entry && (
                  <div className="flex gap-3">
                    <span className="text-xs font-mono text-stone-400 shrink-0 w-14 pt-0.5">Entry</span>
                    <p className="text-xs font-mono text-stone-500 leading-relaxed flex-1 italic">{q.entry}</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Open Territory footer */}
      {parsed.openTerritory && (
        <div className="mt-8 px-5 py-4 bg-stone-900">
          <p className="text-xs font-mono text-stone-400 mb-1.5">Open Territory</p>
          <p className="text-sm text-stone-200 leading-relaxed">{parsed.openTerritory}</p>
        </div>
      )}

    </div>
  );
}
