import { EXPLAIN_HEADERS } from '../utils/explainConcept';

export default function ExplainContent({ text }) {
  const lines = text.split('\n');
  return (
    <div className="text-sm text-stone-700 leading-relaxed">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return null;
        if (EXPLAIN_HEADERS.has(trimmed)) {
          return (
            <div key={i} className="text-[9px] font-mono font-bold uppercase tracking-widest text-stone-400 mt-5 mb-1.5 first:mt-0">
              {trimmed}
            </div>
          );
        }
        if (trimmed.startsWith('•')) {
          return (
            <div key={i} className="flex gap-2 py-0.5">
              <span className="text-stone-400 flex-shrink-0">•</span>
              <span>{trimmed.slice(1).trim()}</span>
            </div>
          );
        }
        return <p key={i} className="mb-2 last:mb-0">{trimmed}</p>;
      })}
    </div>
  );
}
