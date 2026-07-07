import ReadingOrderView from './ReadingOrderView';

const CONCEPT_COLORS = [
  { border: 'border-stone-200',   badge: 'bg-stone-200 text-stone-700'     },
  { border: 'border-sky-200',     badge: 'bg-sky-100 text-sky-700'         },
  { border: 'border-indigo-200',  badge: 'bg-indigo-100 text-indigo-700'   },
  { border: 'border-violet-200',  badge: 'bg-violet-100 text-violet-700'   },
  { border: 'border-teal-200',    badge: 'bg-teal-100 text-teal-700'       },
  { border: 'border-emerald-200', badge: 'bg-emerald-100 text-emerald-700' },
  { border: 'border-amber-200',   badge: 'bg-amber-100 text-amber-700'     },
  { border: 'border-rose-200',    badge: 'bg-rose-100 text-rose-700'       },
];

export default function SpectrumView({ parsed, readingListText, answerParagraphs, isStreaming }) {
  if (!parsed) return null;

  const hasContent = parsed.question || parsed.concepts.length > 0;
  if (!hasContent) {
    return (
      <div className="mt-10 flex items-center gap-2.5 text-stone-400">
        <span className="flex gap-0.5">
          <span className="loading-dot" /><span className="loading-dot" /><span className="loading-dot" />
        </span>
        <span className="text-sm">Building the transdisciplinary answer...</span>
      </div>
    );
  }

  return (
    <div className={`mt-10 ${isStreaming ? 'opacity-90' : ''}`}>
      {parsed.question && (
        <div className="mb-8">
          <p className="text-xs font-mono text-stone-400 mb-1">Spectrum</p>
          <h2 className="text-xl font-semibold text-stone-900 tracking-tight leading-snug max-w-2xl">{parsed.question}</h2>
          <div className="mt-4 h-px bg-stone-200" />
        </div>
      )}

      {answerParagraphs && answerParagraphs.length > 0 && (
        <div className="mb-10">
          <p className="text-xs font-mono text-stone-400 mb-3">Answer</p>
          <div className="space-y-4 max-w-3xl">
            {answerParagraphs.map((p, i) => (
              <p key={i} className="text-sm text-stone-800 leading-relaxed">{p}</p>
            ))}
          </div>
          <div className="mt-8 h-px bg-stone-200" />
        </div>
      )}

      <div className="flex gap-6 items-start flex-col lg:flex-row">
        <div className="flex-1 min-w-0 space-y-4">
          <p className="text-xs font-mono text-stone-400 mb-1">Concepts</p>
          {parsed.concepts.map((concept, i) => {
            const c = CONCEPT_COLORS[i % CONCEPT_COLORS.length];
            return (
              <div key={i} className={`border ${c.border} px-5 py-4`}>
                <div className="flex flex-wrap items-baseline gap-2">
                  <h3 className="text-sm font-semibold text-stone-900">{concept.name}</h3>
                  {concept.discipline && (
                    <span className={`text-xs font-mono px-1.5 py-0.5 ${c.badge}`}>
                      {concept.discipline}{concept.tier ? ` · ${concept.tier}` : ''}
                    </span>
                  )}
                </div>
                {concept.explanation && (
                  <p className="mt-2 text-sm text-stone-700 leading-relaxed">{concept.explanation}</p>
                )}
                {concept.relevance && (
                  <div className="mt-2.5 pt-2.5 border-t border-stone-200/70 flex gap-3">
                    <span className="text-xs font-mono text-stone-400 shrink-0 w-16 pt-0.5">Answers</span>
                    <p className="text-xs text-stone-600 leading-relaxed flex-1">{concept.relevance}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="w-full lg:w-[420px] shrink-0">
          <p className="text-xs font-mono text-stone-400 mb-1">Reading List</p>
          <ReadingOrderView content={readingListText} isStreaming={isStreaming} />
        </div>
      </div>
    </div>
  );
}
