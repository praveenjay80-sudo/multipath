function parseReadingOrder(text) {
  const phases = [];
  let current = null;

  for (const line of text.split('\n')) {
    const phaseMatch = line.match(/^PHASE\s+(\d+):\s*(.+)$/i);
    if (phaseMatch) {
      if (current) phases.push(current);
      current = { number: parseInt(phaseMatch[1]), header: phaseMatch[2].trim(), focus: '', works: [] };
      continue;
    }
    if (!current) continue;
    const workMatch = line.match(/^-\s+(.+)$/);
    if (workMatch) {
      current.works.push(workMatch[1].trim());
    } else if (line.trim() && !current.focus) {
      current.focus = line.trim();
    }
  }
  if (current) phases.push(current);
  return phases;
}

const PHASE_COLORS = [
  { border: 'border-stone-200', bg: 'bg-stone-50', badge: 'text-stone-600 bg-stone-100', num: 'text-stone-400' },
  { border: 'border-blue-200', bg: 'bg-blue-50', badge: 'text-blue-700 bg-blue-100', num: 'text-blue-400' },
  { border: 'border-violet-200', bg: 'bg-violet-50', badge: 'text-violet-700 bg-violet-100', num: 'text-violet-400' },
  { border: 'border-amber-200', bg: 'bg-amber-50', badge: 'text-amber-700 bg-amber-100', num: 'text-amber-400' },
  { border: 'border-emerald-200', bg: 'bg-emerald-50', badge: 'text-emerald-700 bg-emerald-100', num: 'text-emerald-400' },
];

export default function ReadingOrderView({ content, isStreaming }) {
  const phases = parseReadingOrder(content);

  if (!phases.length) {
    return (
      <div className="flex items-center gap-2.5 text-stone-400 py-8">
        <span className="flex gap-0.5">
          <span className="loading-dot" />
          <span className="loading-dot" />
          <span className="loading-dot" />
        </span>
        <span className="text-sm">Sequencing canon into reading phases...</span>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${isStreaming ? 'opacity-90' : ''}`}>
      {phases.map((phase, i) => {
        const c = PHASE_COLORS[i % PHASE_COLORS.length];
        return (
          <div key={i} className={`border ${c.border} ${c.bg} p-6`}>
            <div className="flex items-baseline gap-3 mb-1">
              <span className={`text-xs font-mono px-1.5 py-0.5 ${c.badge}`}>Phase {phase.number}</span>
              <h3 className="text-sm font-semibold text-stone-800">{phase.header}</h3>
            </div>
            {phase.focus && (
              <p className="text-xs text-stone-500 mt-1 mb-4 leading-relaxed">{phase.focus}</p>
            )}
            <div className="space-y-3">
              {phase.works.map((work, j) => {
                const dashIdx = work.indexOf(' — ');
                const ref = dashIdx >= 0 ? work.slice(0, dashIdx) : work;
                const rationale = dashIdx >= 0 ? work.slice(dashIdx + 3) : '';
                return (
                  <div key={j} className="flex gap-3">
                    <span className={`text-xs font-mono mt-0.5 shrink-0 w-4 ${c.num}`}>{j + 1}.</span>
                    <div>
                      <div className="text-sm font-medium text-stone-800">{ref}</div>
                      {rationale && <div className="text-xs text-stone-500 mt-0.5 leading-relaxed">{rationale}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
