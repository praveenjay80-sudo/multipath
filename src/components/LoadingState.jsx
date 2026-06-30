const STEPS = [
  { key: 'candidates', label: 'Candidates', n: 1 },
  { key: 'enriching', label: 'Impact', n: 2 },
  { key: 'composing', label: 'Canon', n: 3 },
];

export default function LoadingState({ phase, message }) {
  const isRefining = phase === 'refining';
  const activeStep = STEPS.find(s => s.key === phase)?.n ?? 0;

  return (
    <div className="mt-8 border border-stone-200 bg-white px-6 py-5">
      {!isRefining && (
        <div className="flex items-center gap-6 mb-4">
          {STEPS.map((s, i) => {
            const done = s.n < activeStep;
            const active = s.n === activeStep;
            return (
              <div key={s.key} className="flex items-center gap-2">
                <div className={`w-5 h-5 flex items-center justify-center text-xs font-mono border
                  ${done ? 'bg-stone-900 border-stone-900 text-white'
                    : active ? 'border-stone-500 text-stone-700 bg-white'
                    : 'border-stone-200 text-stone-300 bg-white'}`}>
                  {done ? '✓' : s.n}
                </div>
                <span className={`text-xs ${active ? 'text-stone-800 font-medium' : done ? 'text-stone-500' : 'text-stone-300'}`}>
                  {s.label}
                </span>
                {i < STEPS.length - 1 && (
                  <span className={`ml-2 text-xs ${done ? 'text-stone-400' : 'text-stone-200'}`}>—</span>
                )}
              </div>
            );
          })}
        </div>
      )}
      <div className="flex items-center gap-2.5">
        <span className="flex gap-0.5">
          <span className="loading-dot" />
          <span className="loading-dot" />
          <span className="loading-dot" />
        </span>
        <span className="text-sm text-stone-500">{message || 'Working...'}</span>
      </div>
    </div>
  );
}
