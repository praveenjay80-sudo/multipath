import TierSection from './TierSection';
import { parseBullets } from '../utils/parseCanon';

function renderInline(text) {
  if (!text) return null;
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('*') && part.endsWith('*')) return <em key={i}>{part.slice(1, -1)}</em>;
    return <span key={i}>{part}</span>;
  });
}

function ProseSection({ title, content, className = '' }) {
  if (!content) return null;
  const bullets = parseBullets(content);
  const isList = content.trim().match(/^[\-\*•]/m);
  return (
    <div className={`bg-stone-50 border border-stone-200 p-6 ${className}`}>
      <h3 className="text-xs font-mono uppercase tracking-widest text-stone-500 mb-3">{title}</h3>
      {isList ? (
        <ul className="space-y-2">
          {bullets.map((b, i) => (
            <li key={i} className="flex gap-3 text-sm text-stone-600 leading-relaxed">
              <span className="text-stone-300 shrink-0 mt-0.5">—</span>
              <span>{renderInline(b)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-stone-600 leading-relaxed">{renderInline(content)}</p>
      )}
    </div>
  );
}

function BookIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-amber-600">
      <rect x="2" y="2" width="9" height="12" rx="0" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5 2v12" stroke="currentColor" strokeWidth="1.5" />
      <path d="M11 4l3 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
      <path d="M11 7l3 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
    </svg>
  );
}

export default function CanonOutput({ parsed, isStreaming, getCitation, getVerification, onExplain, getExplanation }) {
  if (!parsed) return null;

  return (
    <div className={`mt-10 ${isStreaming ? 'opacity-90' : ''}`}>
      {parsed.topic && (
        <div className="mb-8">
          <h2 className="text-2xl font-semibold text-stone-900 tracking-tight">{parsed.topic}</h2>
          <div className="mt-2 h-px bg-stone-200" />
        </div>
      )}

      {parsed.tiers.length > 0 && (
        <div className="space-y-3">
          {parsed.tiers.map((tier, idx) => (
            <TierSection
              key={tier.sectionKey}
              tier={tier}
              getCitation={getCitation}
              getVerification={getVerification}
              onExplain={onExplain}
              getExplanation={getExplanation}
              isLastStreaming={isStreaming && idx === parsed.tiers.length - 1}
            />
          ))}
        </div>
      )}

      {(parsed.prerequisites || parsed.whatsMissing || parsed.oneBook || parsed.criticsNotes || parsed.revisionNotes) && (
        <div className="mt-8 space-y-3">
          <ProseSection title="Prerequisites to Master the Full Canon" content={parsed.prerequisites} />
          <ProseSection title="What's Missing" content={parsed.whatsMissing} />

          {parsed.oneBook && (
            <div className="bg-amber-50 border border-amber-200 p-6">
              <div className="flex items-center gap-2 mb-3">
                <BookIcon />
                <h3 className="text-xs font-mono uppercase tracking-widest text-amber-700">The One Book</h3>
              </div>
              <div className="text-sm text-stone-700 leading-relaxed">{renderInline(parsed.oneBook)}</div>
            </div>
          )}

          {parsed.criticsNotes && (
            <div className="border-l-4 border-stone-300 bg-stone-50 p-6">
              <h3 className="text-xs font-mono uppercase tracking-widest text-stone-500 mb-3">Critic's Notes</h3>
              <ul className="space-y-2">
                {parseBullets(parsed.criticsNotes).map((note, i) => (
                  <li key={i} className="flex gap-3 text-sm text-stone-600 leading-relaxed">
                    <span className="text-stone-400 shrink-0 mt-0.5">—</span>
                    <span>{renderInline(note)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {parsed.revisionNotes && (
            <div className="border-l-4 border-blue-300 bg-blue-50 p-6">
              <h3 className="text-xs font-mono uppercase tracking-widest text-blue-600 mb-2">Revision Notes</h3>
              <p className="text-sm text-stone-600 leading-relaxed">{renderInline(parsed.revisionNotes)}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
