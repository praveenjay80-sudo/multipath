import { useMemo, useRef } from 'react';
import { SECTION_DEFS } from '../hooks/useOverallAggregator';

const COLOR_MAP = {
  stone:   { bg: 'bg-stone-100',   text: 'text-stone-700',   border: 'border-stone-300',   dot: 'bg-stone-500',   head: 'text-stone-800'   },
  amber:   { bg: 'bg-amber-100',   text: 'text-amber-800',   border: 'border-amber-300',   dot: 'bg-amber-500',   head: 'text-amber-900'   },
  teal:    { bg: 'bg-teal-100',    text: 'text-teal-800',    border: 'border-teal-300',    dot: 'bg-teal-500',    head: 'text-teal-900'    },
  rose:    { bg: 'bg-rose-100',    text: 'text-rose-800',    border: 'border-rose-300',    dot: 'bg-rose-500',    head: 'text-rose-900'    },
  cyan:    { bg: 'bg-cyan-100',    text: 'text-cyan-800',    border: 'border-cyan-300',    dot: 'bg-cyan-500',    head: 'text-cyan-900'    },
  blue:    { bg: 'bg-blue-100',    text: 'text-blue-800',    border: 'border-blue-300',    dot: 'bg-blue-500',    head: 'text-blue-900'    },
  violet:  { bg: 'bg-violet-100',  text: 'text-violet-800',  border: 'border-violet-300',  dot: 'bg-violet-500',  head: 'text-violet-900'  },
  indigo:  { bg: 'bg-indigo-100',  text: 'text-indigo-800',  border: 'border-indigo-300',  dot: 'bg-indigo-500',  head: 'text-indigo-900'  },
  emerald: { bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-300', dot: 'bg-emerald-500', head: 'text-emerald-900' },
};

function renderInline(text) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  if (parts.length === 1) return text;
  return parts.map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i} className="font-semibold text-stone-900">{part.slice(2, -2)}</strong>
      : <span key={i}>{part}</span>
  );
}

function StreamingText({ content, isStreaming }) {
  const elements = useMemo(() => {
    const lines = content.split('\n');
    const out = [];
    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i];
      const t = raw.trim();
      if (!t) { out.push(<div key={i} className="h-2" />); continue; }
      if (t.startsWith('### ')) {
        out.push(<h3 key={i} className="text-sm font-bold text-stone-900 mt-5 mb-2 first:mt-0">{t.slice(4)}</h3>);
        continue;
      }
      if (t.startsWith('## ')) {
        out.push(<h2 key={i} className="text-base font-bold text-stone-900 mt-6 mb-2">{t.slice(3)}</h2>);
        continue;
      }
      if (t.startsWith('- ')) {
        out.push(
          <div key={i} className="flex gap-2 text-sm text-stone-700 leading-relaxed py-0.5 pl-1">
            <span className="text-stone-400 shrink-0 mt-0.5">·</span>
            <span>{renderInline(t.slice(2))}</span>
          </div>
        );
        continue;
      }
      out.push(<p key={i} className="text-sm text-stone-700 leading-relaxed">{renderInline(t)}</p>);
    }
    return out;
  }, [content]);

  return (
    <div className="space-y-1">
      {elements}
      {isStreaming && content && (
        <span className="inline-block w-1.5 h-3.5 bg-stone-400 opacity-70 animate-pulse ml-0.5 align-middle" />
      )}
    </div>
  );
}

function StatusDot({ phase }) {
  if (phase === 'idle') return <span className="w-1.5 h-1.5 rounded-full bg-stone-300 shrink-0" />;
  if (phase === 'generating') return <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0 animate-pulse" />;
  if (phase === 'complete') return <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />;
  if (phase === 'error') return <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />;
  return null;
}

function wordCount(text) {
  return Math.round(text.trim().split(/\s+/).filter(Boolean).length);
}

export default function OverallAggregatorView({
  question, overallPhase, dataCount, error,
  sections, completedCount, generatingCount,
  onReset,
}) {
  const sectionRefs = useRef({});

  function scrollTo(key) {
    sectionRefs.current[key]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const totalWords = useMemo(() =>
    Object.values(sections).reduce((acc, s) => acc + wordCount(s.content), 0),
  [sections]);

  return (
    <div className="mt-8">
      {/* Status bar */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-stone-200">
        <div className="flex items-center gap-3">
          {overallPhase === 'harvesting' && (
            <>
              <span className="flex gap-0.5">
                <span className="loading-dot" /><span className="loading-dot" /><span className="loading-dot" />
              </span>
              <span className="text-sm text-stone-500">Harvesting literature for <span className="font-medium text-stone-700">{question}</span>…</span>
            </>
          )}
          {overallPhase === 'generating' && (
            <span className="text-sm text-stone-500">
              <span className="font-medium text-stone-700">{question}</span>
              {' · '}
              {dataCount > 0 && <span>{dataCount} works harvested · </span>}
              {completedCount}/{SECTION_DEFS.length} sections complete
              {generatingCount > 0 && <span> · {generatingCount} generating</span>}
            </span>
          )}
          {overallPhase === 'complete' && (
            <span className="text-sm text-stone-500">
              <span className="font-medium text-stone-700">{question}</span>
              {' · '}
              {SECTION_DEFS.length} sections · ~{totalWords.toLocaleString()} words
              {dataCount > 0 && <span> · {dataCount} works harvested</span>}
            </span>
          )}
        </div>
        <button
          onClick={onReset}
          className="text-xs text-stone-400 hover:text-stone-700 transition-colors"
        >
          New question
        </button>
      </div>

      {/* Section nav pills */}
      <div className="flex flex-wrap gap-1.5 mb-8">
        {SECTION_DEFS.map((def, idx) => {
          const c = COLOR_MAP[def.color];
          const s = sections[def.key];
          return (
            <button
              key={def.key}
              onClick={() => scrollTo(def.key)}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono rounded transition-opacity ${c.bg} ${c.text} ${s.phase === 'idle' ? 'opacity-40' : 'opacity-100'}`}
            >
              <span className="font-bold">{idx + 1}</span>
              <span>{def.label}</span>
              <StatusDot phase={s.phase} />
            </button>
          );
        })}
      </div>

      {/* Sections */}
      <div className="space-y-12">
        {SECTION_DEFS.map((def, idx) => {
          const c = COLOR_MAP[def.color];
          const s = sections[def.key];
          return (
            <div
              key={def.key}
              ref={el => { sectionRefs.current[def.key] = el; }}
              className={`border-l-2 pl-6 ${c.border}`}
            >
              {/* Section header */}
              <div className="flex items-center gap-2.5 mb-4">
                <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${c.bg} ${c.text}`}>
                  {idx + 1}
                </span>
                <h2 className={`text-xs font-mono font-bold tracking-widest ${c.head}`}>{def.label}</h2>
                <StatusDot phase={s.phase} />
                {s.phase === 'generating' && (
                  <span className="text-xs text-stone-400 font-mono">generating…</span>
                )}
                {s.phase === 'complete' && (
                  <span className="text-xs text-stone-400 font-mono">~{wordCount(s.content).toLocaleString()} words</span>
                )}
                {s.phase === 'error' && (
                  <span className="text-xs text-red-500 font-mono">failed</span>
                )}
              </div>

              {/* Content */}
              {s.phase === 'idle' && (
                <p className="text-xs text-stone-300 font-mono">waiting…</p>
              )}
              {(s.phase === 'generating' || s.phase === 'complete') && s.content && (
                <StreamingText content={s.content} isStreaming={s.phase === 'generating'} />
              )}
              {s.phase === 'error' && (
                <p className="text-sm text-red-600">{s.content || 'Generation failed.'}</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom actions */}
      {overallPhase === 'complete' && (
        <div className="mt-12 pt-6 border-t border-stone-200 flex gap-2">
          <button
            onClick={() => {
              const text = SECTION_DEFS.map(def =>
                `# ${def.label}\n\n${sections[def.key].content}`
              ).join('\n\n---\n\n');
              navigator.clipboard.writeText(`# OVERALL AGGREGATOR: ${question}\n\n${text}`);
            }}
            className="px-4 py-2 text-sm border border-stone-300 text-stone-700 hover:bg-stone-50 transition-colors"
          >
            Copy All
          </button>
          <button
            onClick={onReset}
            className="px-4 py-2 text-sm bg-stone-900 text-white hover:bg-stone-700 transition-colors"
          >
            New Question
          </button>
        </div>
      )}
    </div>
  );
}
