import { useMemo, useState } from 'react';
import { SECTION_DEFS } from '../hooks/useUnifiedBrowser';

// ── Color palette per section ────────────────────────────────────────────────

const COLOR_MAP = {
  questions:     { border: 'border-violet-200', bg: 'bg-violet-50', dot: 'bg-violet-500', text: 'text-violet-800', header: 'text-violet-900' },
  concepts:      { border: 'border-sky-200',    bg: 'bg-sky-50',    dot: 'bg-sky-500',    text: 'text-sky-700',    header: 'text-sky-800' },
  schools:       { border: 'border-teal-200',   bg: 'bg-teal-50',   dot: 'bg-teal-500',   text: 'text-teal-700',   header: 'text-teal-800' },
  prerequisites: { border: 'border-amber-200',  bg: 'bg-amber-50',  dot: 'bg-amber-500',  text: 'text-amber-700',  header: 'text-amber-800' },
  canon:         { border: 'border-emerald-200',bg: 'bg-emerald-50',dot: 'bg-emerald-500',text: 'text-emerald-700',header: 'text-emerald-800' },
  thinkers:      { border: 'border-indigo-200', bg: 'bg-indigo-50', dot: 'bg-indigo-500', text: 'text-indigo-700', header: 'text-indigo-800' },
  methodologies: { border: 'border-rose-200',   bg: 'bg-rose-50',   dot: 'bg-rose-500',   text: 'text-rose-700',   header: 'text-rose-800' },
  adjacent:      { border: 'border-cyan-200',   bg: 'bg-cyan-50',   dot: 'bg-cyan-500',   text: 'text-cyan-700',   header: 'text-cyan-800' },
  consilience:   { border: 'border-fuchsia-200',bg: 'bg-fuchsia-50',dot: 'bg-fuchsia-500',text: 'text-fuchsia-700',header: 'text-fuchsia-800' },
  frontier:      { border: 'border-orange-200', bg: 'bg-orange-50', dot: 'bg-orange-500', text: 'text-orange-700', header: 'text-orange-800' },
  timeline:      { border: 'border-lime-200',   bg: 'bg-lime-50',   dot: 'bg-lime-600',   text: 'text-lime-700',   header: 'text-lime-800' },
  conferences:   { border: 'border-stone-200',  bg: 'bg-stone-50',  dot: 'bg-stone-500',  text: 'text-stone-700',  header: 'text-stone-800' },
};

const SECTION_ORDER = SECTION_DEFS.map(s => s.key);

// ── Section markdown renderer ─────────────────────────────────────────────────

function renderInlineMarkdown(text) {
  if (!text) return '';
  // Bold
  let html = text.replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold">$1</strong>');
  // Italic
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  // Inline code
  html = html.replace(/`(.+?)`/g, '<code class="bg-stone-100 text-stone-800 px-1 py-0.5 text-xs font-mono">$1</code>');
  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer" class="underline text-current hover:opacity-70">$1</a>');
  return html;
}

// ── Status dot ────────────────────────────────────────────────────────────────

function StatusDot({ phase, dotColor }) {
  if (phase === 'idle' || phase === 'waiting') return null;
  return (
    <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${
      phase === 'complete' ? dotColor :
      phase === 'streaming' ? `${dotColor} animate-pulse` :
      phase === 'error' ? 'bg-red-500' :
      'bg-stone-300'
    }`} />
  );
}

// ── Loading dots animation ────────────────────────────────────────────────────

function AnimatedDots() {
  return (
    <span className="flex gap-0.5">
      <span className="loading-dot" />
      <span className="loading-dot" />
      <span className="loading-dot" />
    </span>
  );
}

// ── Section content (renders markdown to HTML) ────────────────────────────────

function SectionContent({ text, isStreaming }) {
  // Split by ### headers
  const parts = (text || '').split(/(?=### )/);

  return (
    <div className="space-y-4 text-sm leading-relaxed text-stone-700">
      {parts.map((part, i) => {
        const headerMatch = part.match(/^### (.+)/);
        if (headerMatch) {
          const rest = part.slice(headerMatch[0].length).trim();
          return (
            <div key={i} className="pt-1">
              <h4 className="font-semibold text-sm text-stone-900 mb-2">
                {headerMatch[1]}
              </h4>
              <div className="space-y-2">
                {rest.split('\n').map((line, j) => {
                  const trimmed = line.trim();
                  if (!trimmed) return null;
                  // Bullet
                  if (trimmed.startsWith('- ')) {
                    return (
                      <div key={j} className="flex gap-2 ml-1">
                        <span className="text-stone-400 shrink-0 mt-0.5">–</span>
                        <span dangerouslySetInnerHTML={{ __html: renderInlineMarkdown(trimmed.slice(2)) }} />
                      </div>
                    );
                  }
                  if (/^\d+\.\s/.test(trimmed)) {
                    return (
                      <div key={j} className="flex gap-2 ml-1">
                        <span className="text-stone-400 shrink-0 mt-0.5 font-mono text-xs">{trimmed.match(/^\d+/)[0]}.</span>
                        <span dangerouslySetInnerHTML={{ __html: renderInlineMarkdown(trimmed.replace(/^\d+\.\s+/, '')) }} />
                      </div>
                    );
                  }
                  return (
                    <p key={j} dangerouslySetInnerHTML={{ __html: renderInlineMarkdown(trimmed) }} />
                  );
                })}
              </div>
            </div>
          );
        }
        // Prose paragraphs
        return (
          <div key={i} className="space-y-2">
            {part.split('\n').filter(l => l.trim()).map((line, j) => {
              const trimmed = line.trim();
              if (trimmed.startsWith('- ')) {
                return (
                  <div key={j} className="flex gap-2 ml-1">
                    <span className="text-stone-400 shrink-0 mt-0.5">–</span>
                    <span dangerouslySetInnerHTML={{ __html: renderInlineMarkdown(trimmed.slice(2)) }} />
                  </div>
                );
              }
              return (
                <p key={j} dangerouslySetInnerHTML={{ __html: renderInlineMarkdown(trimmed) }} />
              );
            })}
          </div>
        );
      })}
      {isStreaming && (
        <div className="flex items-center gap-2 text-stone-400 text-xs pt-2">
          <AnimatedDots />
          <span>Generating...</span>
        </div>
      )}
    </div>
  );
}

// ── Section card ──────────────────────────────────────────────────────────────

function SectionCard({ def, section, topic }) {
  const [collapsed, setCollapsed] = useState(false);
  const colors = COLOR_MAP[def.key] || COLOR_MAP.conferences;
  const isComplete = section.phase === 'complete';
  const isStreaming = section.phase === 'streaming';
  const isEmpty = section.phase === 'idle' || section.phase === 'waiting';
  const hasContent = !!section.content;

  return (
    <div className={`border ${colors.border} ${colors.bg} transition-colors`}>
      {/* Header */}
      <button
        onClick={() => hasContent && setCollapsed(c => !c)}
        className={`w-full flex items-center gap-3 px-5 py-3.5 text-left transition-colors ${hasContent ? 'hover:opacity-80 cursor-pointer' : 'cursor-default'}`}
      >
        <StatusDot phase={section.phase} dotColor={colors.dot} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-semibold ${colors.header}`}>
              {def.label}
            </span>
            {isComplete && (
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-none ${colors.bg} ${colors.text} border ${colors.border}`}>
                {wordCount(section.content)} words
              </span>
            )}
          </div>
          <div className="text-xs text-stone-400 mt-0.5">
            {section.phase === 'idle' && 'Waiting to start...'}
            {section.phase === 'waiting' && 'Waiting for data...'}
            {section.phase === 'streaming' && 'Generating...'}
            {section.phase === 'complete' && `Complete`}
            {section.phase === 'error' && 'Failed'}
          </div>
        </div>
        {hasContent && (
          <span className={`text-xs transition-transform ${collapsed ? '' : 'rotate-180'}`}>
            ▼
          </span>
        )}
      </button>

      {/* Content */}
      {!collapsed && hasContent && section.content.trim() && (
        <div className={`px-5 py-4 border-t ${colors.border}`}>
          <SectionContent text={section.content} isStreaming={isStreaming} />
        </div>
      )}
    </div>
  );
}

function wordCount(text) {
  return Math.round((text || '').trim().split(/\s+/).filter(Boolean).length);
}

// ── Progress summary bar ──────────────────────────────────────────────────────

function ProgressBar({ completedCount, activeCount, total }) {
  const pct = total > 0 ? Math.round((completedCount / total) * 100) : 0;
  return (
    <div className="flex items-center gap-4 text-xs text-stone-500 mb-6">
      <span className="font-mono">{completedCount}/{total} sections complete</span>
      <div className="flex-1 h-1.5 bg-stone-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-stone-700 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="font-mono">{pct}%</span>
      {activeCount > 0 && (
        <span className="text-stone-400 flex items-center gap-1">
          <AnimatedDots />
          {activeCount} active
        </span>
      )}
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

export default function UnifiedKnowledgePane({
  topic, phase, dataCount, error,
  sections, completedCount, activeCount,
  onReset,
}) {
  const totalSections = SECTION_DEFS.length;

  return (
    <div className="mt-10">
      {/* Topic header */}
      <div className="mb-8 pb-6 border-b border-stone-200">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-mono text-stone-400 mb-1">Knowledge Browser</div>
            <h2 className="text-2xl font-bold text-stone-900">{topic}</h2>
          </div>
          <button
            onClick={onReset}
            className="shrink-0 px-4 py-2 text-sm border border-stone-300 text-stone-700 hover:bg-stone-50 transition-colors"
          >
            New Topic
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 border border-red-200 bg-red-50">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Progress */}
      {phase !== 'idle' && (
        <ProgressBar
          completedCount={completedCount}
          activeCount={activeCount}
          total={totalSections}
        />
      )}

      {/* Data count */}
      {dataCount > 0 && (
        <div className="mb-6 text-xs text-stone-400 font-mono">
          Harvested {dataCount} works across OpenAlex, Semantic Scholar, and Open Syllabus
        </div>
      )}

      {/* Sections */}
      {phase === 'idle' && (
        <div className="text-center py-16 text-stone-400">
          <p className="text-sm font-mono">Select a topic above to explore everything about it</p>
        </div>
      )}

      <div className="space-y-2">
        {SECTION_DEFS.map(def => (
          <SectionCard
            key={def.key}
            def={def}
            section={sections[def.key]}
            topic={topic}
          />
        ))}
      </div>

      {/* Copy / export */}
      {completedCount === totalSections && (
        <div className="mt-8 pt-6 border-t border-stone-200 flex gap-3">
          <button
            onClick={onReset}
            className="px-5 py-2.5 text-sm bg-stone-900 text-white hover:bg-stone-700 transition-colors"
          >
            New Topic
          </button>
        </div>
      )}
    </div>
  );
}
