const DEPTH = '#24478C';
const LEVEL = '#B0701F';
const ANGLE = '#1C7A6E';

const TIERS = ['Foundational', 'Core Abstract Structures', 'Fundamental Methods', 'Specific Theories & Applied'];

const FIELD_LABELS = {
  QUESTION: 'Question', PREREQUISITES: 'Prerequisites',
  CONCEPTS: 'Concepts', INTUITION: 'Intuition', NOTATION: 'Notation', METHOD: 'Method',
  WORKS: 'Works', EXAMPLES: 'Example', ALTERNATIVES: 'Alternative',
  THINKERS: 'Thinkers', SCHOOLS: 'Schools', HISTORY: 'History', DEBATES: 'Debates',
  CASES: 'Cases', BOUNDARIES: 'Boundaries', MISCONCEPTIONS: 'Misconceptions',
  POSTREQUISITES: 'Postrequisites', OPEN: 'Open Questions', SYNTHESIS: 'Synthesis',
};

function FieldBlock({ fieldKey, value }) {
  const label = FIELD_LABELS[fieldKey] || fieldKey;
  return (
    <div className="py-3 first:pt-0 last:pb-0">
      <p className="text-xs font-mono text-stone-400 mb-1.5">{label}</p>
      {fieldKey === 'SYNTHESIS' && Array.isArray(value) ? (
        <div className="space-y-2.5">
          {value.map((p, i) => <p key={i} className="text-sm text-stone-700 leading-relaxed">{p}</p>)}
        </div>
      ) : Array.isArray(value) ? (
        <ul className="space-y-1.5">
          {value.map((item, i) => (
            <li key={i} className="text-sm text-stone-700 leading-relaxed">
              <span className="font-medium text-stone-900">{item.label}</span>
              {item.detail && <span> — {item.detail}</span>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-stone-700 leading-relaxed">{value}</p>
      )}
    </div>
  );
}

export default function NoesisView({ parsed, isStreaming }) {
  if (!parsed) return null;

  const hasContent = parsed.topic || parsed.stations.length > 0;
  if (!hasContent) {
    return (
      <div className="mt-10 flex items-center gap-2.5 text-stone-400">
        <span className="flex gap-0.5">
          <span className="loading-dot" /><span className="loading-dot" /><span className="loading-dot" />
        </span>
        <span className="text-sm">Building the understanding map...</span>
      </div>
    );
  }

  return (
    <div className={`mt-10 max-w-3xl mx-auto ${isStreaming ? 'opacity-90' : ''}`}>

      {parsed.topic && (
        <div className="mb-8">
          <p className="text-xs font-mono text-stone-400 mb-1">Noesis</p>
          <h2 className="text-xl font-semibold text-stone-900 tracking-tight leading-snug max-w-2xl">{parsed.topic}</h2>
          {parsed.tier && (
            <div className="mt-3 flex items-center gap-2.5 flex-wrap">
              <span className="text-xs font-mono px-2 py-0.5 border" style={{ color: LEVEL, borderColor: LEVEL }}>
                {parsed.tier}
              </span>
              {parsed.levelWhy && <span className="text-xs text-stone-500 italic">{parsed.levelWhy}</span>}
            </div>
          )}
          <div className="mt-4 h-px bg-stone-200" />
        </div>
      )}

      <div className="mb-8 flex flex-wrap gap-x-5 gap-y-1.5 text-xs font-mono text-stone-400">
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: DEPTH }} />Depth Line — ride in order</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full border-2" style={{ borderColor: LEVEL }} />Level Line — how far up</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full border-2" style={{ borderColor: ANGLE }} />Angle Line — how many directions</span>
      </div>

      <div className="relative pt-1 pb-2">
        <div className="absolute left-[21px] sm:left-1/2 sm:-translate-x-1/2 top-1 bottom-6 w-[3px] bg-stone-200" />
        {parsed.stations.map((station, i) => {
          const isLeft = i % 2 === 0;
          return (
            <div
              key={station.number}
              className={`relative w-full sm:w-1/2 pb-9 pl-11 text-left ${
                isLeft ? 'sm:left-0 sm:pl-0 sm:pr-9 sm:text-right' : 'sm:left-1/2 sm:pl-9'
              }`}
            >
              <span
                className={`absolute top-1.5 w-[14px] h-[14px] rounded-full left-[15px] sm:left-auto ${isLeft ? 'sm:right-[-8px]' : 'sm:left-[-8px]'}`}
                style={{ background: DEPTH, border: '3px solid #FAFAF9', boxShadow: `0 0 0 2px ${DEPTH}` }}
              />
              <div className="inline-block text-left bg-white border border-stone-200 px-5 py-4 max-w-full">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-xs font-mono text-stone-400 uppercase tracking-wide">Station {String(station.number).padStart(2, '0')}</span>
                  <span className="text-[0.6rem] font-mono px-1 border" style={{ color: LEVEL, borderColor: LEVEL }}>L</span>
                  <span className="text-[0.6rem] font-mono px-1 border" style={{ color: ANGLE, borderColor: ANGLE }}>A</span>
                </div>
                <h3 className="text-base font-semibold uppercase tracking-wide mb-1" style={{ color: DEPTH }}>{station.name}</h3>
                <div className="divide-y divide-stone-200/70">
                  {Object.entries(station.fields).map(([key, value]) => (
                    <FieldBlock key={key} fieldKey={key} value={value} />
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <section className="mt-10">
        <h4 className="flex items-center gap-2 text-sm font-mono uppercase tracking-wide mb-1" style={{ color: LEVEL }}>
          <span className="w-2.5 h-2.5 rounded-full border-2 inline-block" style={{ borderColor: LEVEL }} />
          Level Line
        </h4>
        <p className="text-xs text-stone-500 italic mb-4">Where this topic sits on the ladder — the same concept looks different depending on how far up you're standing.</p>
        <div className="relative flex justify-between">
          <div className="absolute left-[6%] right-[6%] top-[9px] h-[2px] bg-stone-200" />
          {TIERS.map((t) => {
            const active = t === parsed.tier;
            return (
              <div key={t} className="relative flex-1 text-center pt-7 text-[0.68rem] font-mono leading-tight px-1">
                <span
                  className="absolute top-0.5 left-1/2 -translate-x-1/2 w-[14px] h-[14px] rounded-full bg-[#FAFAF9] border-[3px]"
                  style={{ borderColor: active ? LEVEL : '#D6D3D1' }}
                />
                <span className={active ? 'font-medium' : 'text-stone-400'} style={active ? { color: LEVEL } : undefined}>{t}</span>
              </div>
            );
          })}
        </div>
      </section>

      {parsed.angles.length > 0 && (
        <section className="mt-10">
          <h4 className="flex items-center gap-2 text-sm font-mono uppercase tracking-wide mb-1" style={{ color: ANGLE }}>
            <span className="w-2.5 h-2.5 rounded-full border-2 inline-block" style={{ borderColor: ANGLE }} />
            Angle Line
          </h4>
          <p className="text-xs text-stone-500 italic mb-4">Every direction a complete understanding must be approached from.</p>
          <div className="space-y-2.5">
            {parsed.angles.map((a, i) => (
              <div key={i} className="border-l-2 pl-3" style={{ borderColor: ANGLE }}>
                <span className="text-sm font-medium text-stone-900">{a.label}</span>
                {a.detail && <span className="text-sm text-stone-600"> — {a.detail}</span>}
              </div>
            ))}
          </div>
        </section>
      )}

    </div>
  );
}
