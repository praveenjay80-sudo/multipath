import { useMemo, useRef } from 'react';
import { SECTION_DEFS } from '../hooks/useOverallAggregator';

const COLOR_MAP = {
  stone:   { bg: 'bg-stone-100',   text: 'text-stone-700',   border: 'border-stone-300',   head: 'text-stone-800'   },
  amber:   { bg: 'bg-amber-100',   text: 'text-amber-800',   border: 'border-amber-300',   head: 'text-amber-900'   },
  teal:    { bg: 'bg-teal-100',    text: 'text-teal-800',    border: 'border-teal-300',    head: 'text-teal-900'    },
  rose:    { bg: 'bg-rose-100',    text: 'text-rose-800',    border: 'border-rose-300',    head: 'text-rose-900'    },
  cyan:    { bg: 'bg-cyan-100',    text: 'text-cyan-800',    border: 'border-cyan-300',    head: 'text-cyan-900'    },
  blue:    { bg: 'bg-blue-100',    text: 'text-blue-800',    border: 'border-blue-300',    head: 'text-blue-900'    },
  violet:  { bg: 'bg-violet-100',  text: 'text-violet-800',  border: 'border-violet-300',  head: 'text-violet-900'  },
  indigo:  { bg: 'bg-indigo-100',  text: 'text-indigo-800',  border: 'border-indigo-300',  head: 'text-indigo-900'  },
  emerald: { bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-300', head: 'text-emerald-900' },
};

// ── Work matching ─────────────────────────────────────────────────────────────

const STOP_WORDS = new Set(['the','a','an','of','in','on','at','to','for','and','or','but','with','by','from','is','are','was','were']);

function normWords(s) {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 2 && !STOP_WORDS.has(w));
}

function buildWorkIndex(papers, textbooks) {
  return [...papers, ...textbooks].map(w => ({
    ...w,
    _words: new Set(normWords(w.title)),
  }));
}

function findWork(title, index) {
  if (!title || !index.length) return null;
  const query = new Set(normWords(title));
  if (!query.size) return null;
  let best = null, bestScore = 0;
  for (const w of index) {
    const overlap = [...query].filter(q => w._words.has(q)).length;
    const score = overlap / Math.max(query.size, w._words.size);
    if (score > bestScore) { best = w; bestScore = score; }
  }
  return bestScore >= 0.45 ? best : null;
}

function getSourceUrl(work) {
  if (work.doi) return `https://doi.org/${work.doi}`;
  if (work.arxivId) return `https://arxiv.org/abs/${work.arxivId}`;
  if (work.oaUrl) return work.oaUrl;
  if (work.isTextbook) return `https://www.google.com/search?tbm=bks&q=${encodeURIComponent(work.title)}`;
  return `https://scholar.google.com/scholar?q=${encodeURIComponent(work.title)}`;
}

function getSourceLabel(work) {
  if (work.doi) return 'DOI';
  if (work.arxivId) return 'arXiv';
  if (work.oaUrl) return 'PDF';
  if (work.isTextbook) return 'Books';
  return 'Scholar';
}

// ── Work badges ───────────────────────────────────────────────────────────────

function WorkBadges({ title, index }) {
  const match = useMemo(() => findWork(title, index), [title, index]);
  if (!match) return null;
  const url = getSourceUrl(match);
  const label = getSourceLabel(match);
  const citations = match.citationCount || match.influentialCitationCount || null;
  return (
    <span className="inline-flex items-center gap-1 ml-1.5 align-baseline">
      {citations != null && citations > 0 && (
        <span className="text-xs text-stone-400 font-mono">
          {citations >= 1000 ? `${(citations / 1000).toFixed(1)}k` : citations} cit.
        </span>
      )}
      {match.syllabusCount > 0 && (
        <span className="text-xs text-stone-400 font-mono">
          {match.syllabusCount} syllabi
        </span>
      )}
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="text-xs text-stone-400 hover:text-blue-600 transition-colors font-mono"
        title={`Open in ${label}`}
        onClick={e => e.stopPropagation()}
      >
        [{label} ↗]
      </a>
    </span>
  );
}

// ── Inline markdown renderer ──────────────────────────────────────────────────

// Detects bold-title work citations: **Title** by Author (Year)
const WORK_PATTERN = /\*\*(?:\d+\.\s+)?([^*]{4,}?)\*\*(?=\s+by\s+[^(]*\(\d{4}\))/;

function renderInline(text, index) {
  // Split on **bold** spans
  const boldParts = text.split(/(\*\*[^*]+\*\*)/g);
  const elements = [];
  for (let i = 0; i < boldParts.length; i++) {
    const part = boldParts[i];
    if (part.startsWith('**') && part.endsWith('**')) {
      const inner = part.slice(2, -2);
      // Check if next plain-text part starts with " by ... (YYYY)"
      const nextPart = boldParts[i + 1] || '';
      const isWorkCite = /^\s+by\s+[^(]*\(\d{4}\)/.test(nextPart);
      elements.push(
        <strong key={i} className="font-semibold text-stone-900">
          {isWorkCite && index.length
            ? <span className="group relative">
                {inner}
                <WorkBadges title={inner} index={index} />
              </span>
            : inner}
        </strong>
      );
    } else {
      elements.push(<span key={i}>{part}</span>);
    }
  }
  return elements;
}

// ── StreamingText ─────────────────────────────────────────────────────────────

function StreamingText({ content, isStreaming, workIndex }) {
  const elements = useMemo(() => {
    const lines = content.split('\n');
    const out = [];
    for (let i = 0; i < lines.length; i++) {
      const t = lines[i].trim();
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
            <span>{renderInline(t.slice(2), workIndex)}</span>
          </div>
        );
        continue;
      }
      out.push(<p key={i} className="text-sm text-stone-700 leading-relaxed">{renderInline(t, workIndex)}</p>);
    }
    return out;
  }, [content, workIndex]);

  return (
    <div className="space-y-1">
      {elements}
      {isStreaming && content && (
        <span className="inline-block w-1.5 h-3.5 bg-stone-400 opacity-70 animate-pulse ml-0.5 align-middle" />
      )}
    </div>
  );
}

// ── Section status dot ────────────────────────────────────────────────────────

function StatusDot({ phase }) {
  if (phase === 'idle')       return <span className="w-1.5 h-1.5 rounded-full bg-stone-300 shrink-0" />;
  if (phase === 'generating') return <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0 animate-pulse" />;
  if (phase === 'complete')   return <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />;
  if (phase === 'error')      return <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />;
  return null;
}

function wordCount(text) {
  return Math.round(text.trim().split(/\s+/).filter(Boolean).length);
}

// ── Main view ─────────────────────────────────────────────────────────────────

export default function OverallAggregatorView({
  question, overallPhase, dataCount, error,
  sections, completedCount, generatingCount,
  harvestedPapers, harvestedTextbooks,
  onReset,
}) {
  const sectionRefs = useRef({});

  // Build the fuzzy-match index once from harvested works
  const workIndex = useMemo(
    () => buildWorkIndex(harvestedPapers, harvestedTextbooks),
    [harvestedPapers, harvestedTextbooks]
  );

  function scrollTo(key) {
    sectionRefs.current[key]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const totalWords = useMemo(
    () => Object.values(sections).reduce((acc, s) => acc + wordCount(s.content), 0),
    [sections]
  );

  return (
    <div className="mt-8">
      {/* Status bar */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-stone-200">
        <div className="flex items-center gap-3 flex-wrap">
          {overallPhase === 'harvesting' && (
            <>
              <span className="flex gap-0.5">
                <span className="loading-dot" /><span className="loading-dot" /><span className="loading-dot" />
              </span>
              <span className="text-sm text-stone-500">
                Harvesting literature for <span className="font-medium text-stone-700">{question}</span>…
              </span>
            </>
          )}
          {overallPhase === 'generating' && (
            <span className="text-sm text-stone-500">
              <span className="font-medium text-stone-700">{question}</span>
              {dataCount > 0 && <span> · {dataCount} works harvested</span>}
              <span> · {completedCount}/{SECTION_DEFS.length} sections complete</span>
              {generatingCount > 0 && <span> · {generatingCount} streaming</span>}
            </span>
          )}
          {overallPhase === 'complete' && (
            <span className="text-sm text-stone-500">
              <span className="font-medium text-stone-700">{question}</span>
              <span> · {SECTION_DEFS.length} sections · ~{totalWords.toLocaleString()} words</span>
              {dataCount > 0 && <span> · {dataCount} works harvested</span>}
            </span>
          )}
        </div>
        <button
          onClick={onReset}
          className="text-xs text-stone-400 hover:text-stone-700 transition-colors shrink-0 ml-4"
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

              {s.phase === 'idle' && (
                <p className="text-xs text-stone-300 font-mono">waiting…</p>
              )}
              {(s.phase === 'generating' || s.phase === 'complete') && s.content && (
                <StreamingText
                  content={s.content}
                  isStreaming={s.phase === 'generating'}
                  workIndex={workIndex}
                />
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
