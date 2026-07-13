import { useMemo, useState } from 'react';
import { SECTION_DEFS } from '../hooks/useUnifiedBrowser';
import EntityDetailPanel from './EntityDetailPanel';
import ConceptCooccurrenceGraph from './ConceptCooccurrenceGraph';

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

// ── Section markdown renderer with inline entity linking ─────────────────────

function renderInlineMarkdown(text, onEntityClick) {
  if (!text) return '';
  let html = text.replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold">$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/`(.+?)`/g, '<code class="bg-stone-100 text-stone-800 px-1 py-0.5 text-xs font-mono">$1</code>');
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer" class="underline text-current hover:opacity-70">$1</a>');
  return html;
}

// Split markdown by `### ` headers
function splitByHeaders(text) {
  return (text || '').split(/(?=### )/);
}

// Detect a list item that might be a "Title" by Author (Year) entry
// Returns {type, name} or null
// Detect a list item that might be a "Title" by Author (Year) entry
// Returns {type, name, _year, _firstAuthor, _allAuthors} or null
function detectWorkEntity(line) {
  // "Title" by Author (Year) — annotation
  let m = line.match(/^[-*]\s+[""]([^""]{3,200})[""]\s+by\s+([^()]+?)\s*\((\d{4})\)/);
  if (m) {
    return {
      type: 'work',
      name: m[1],
      _year: parseInt(m[3], 10),
      _allAuthors: m[2].trim(),
      _firstAuthor: m[2].split(/,\s*|\s+and\s+|\s+&\s+/)[0].trim(),
      _full: line,
    };
  }
  // **Title** by Author (Year)
  m = line.match(/^[-*]\s+\*\*([^*]{3,200})\*\*\s+by\s+([^()]+?)\s*\((\d{4})\)/);
  if (m) {
    return {
      type: 'work',
      name: m[1],
      _year: parseInt(m[3], 10),
      _allAuthors: m[2].trim(),
      _firstAuthor: m[2].split(/,\s*|\s+and\s+|\s+&\s+/)[0].trim(),
      _full: line,
    };
  }
  return null;
}

// Detect a list item that might be a concept (in Tier sections) or researcher
// Returns {type, name, _contribution} or null
function detectListEntity(line, sectionHeader) {
  if (!sectionHeader) return null;
  const isConcept = /Tier\s+\d|Concepts?$/i.test(sectionHeader);
  const isResearcher = /Foundational|Active\s+Researchers/i.test(sectionHeader);

  if (isConcept) {
    // - Concept Name — definition
    const m = line.match(/^[-*]\s+\*?\*?([^\n—\-]{2,80}?)\*?\*?\s*[—\-]\s+(.{3,})/);
    if (m) return { type: 'concept', name: m[1].trim(), _contribution: m[2].trim() };
  }
  if (isResearcher) {
    const m = line.match(/^[-*]\s+\*?\*?([^\n—\-]{2,80}?)\*?\*?(?:\s*\(\d{4}[-–]\d{0,4}\))?\s*[—\-]\s+(.{3,})/);
    if (m) return {
      type: 'researcher',
      name: m[1].replace(/\s*\(\d{4}[-–]\d{0,4}\)/, '').trim(),
      _contribution: m[2].trim(),
    };
  }
  return null;
}

// ── Connected line renderer ──────────────────────────────────────────────────

function ConnectedLine({ line, sectionHeader, onEntityClick, index }) {
  const entity = detectWorkEntity(line) || detectListEntity(line, sectionHeader);

  if (!entity) {
    const trimmed = line.trim();
    const content = trimmed.replace(/^[-*]\s+/, '');
    return (
      <div className="flex gap-2 ml-1">
        <span className="text-stone-400 shrink-0 mt-0.5">–</span>
        <span dangerouslySetInnerHTML={{ __html: renderInlineMarkdown(content) }} />
      </div>
    );
  }

  // Find matching data in index
  // Find matching data in index. Always produce a non-null entity so the
  // panel opens even when no harvested match was found.
  let matchedData = null;
  if (entity.type === 'work') {
    const normTitle = (s) => (s || '').toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 2).join(' ');
    const target = normTitle(entity.name);
    let harvested = null;
    for (const w of index.workByTitle.values()) {
      if (normTitle(w.title) === target) { harvested = w; break; }
    }
    matchedData = {
      type: 'work',
      name: harvested?.title || entity.name,
      work: harvested || {
        title: entity.name,
        authors: entity._firstAuthor || entity._allAuthors,
        year: entity._year,
        citationCount: null,
        _synthetic: true,
      },
    };
  } else if (entity.type === 'concept') {
    matchedData = { type: 'concept', name: entity.name };
  } else if (entity.type === 'researcher') {
    const normAuthor = (s) => (s || '').toLowerCase().replace(/[.,]/g, '').replace(/\s+/g, ' ').trim();
    const target = normAuthor(entity.name);
    const profile = index.authorProfile.get(target);
    matchedData = {
      type: 'author',
      name: profile?.name || entity.name,
      profile,
      contribution: entity._contribution,
    };
  }

  return (
    <div className="flex gap-2 ml-1">
      <span className="text-stone-400 shrink-0 mt-0.5">–</span>
      <span>
        <button
          onClick={() => onEntityClick(matchedData)}
          className={`font-medium underline decoration-dotted underline-offset-2 transition-colors ${
            entity.type === 'work' ? 'text-emerald-700 hover:text-emerald-900' :
            entity.type === 'concept' ? 'text-violet-700 hover:text-violet-900' :
            'text-indigo-700 hover:text-indigo-900'
          }`}
        >
          {entity.name}
        </button>
        {(() => {
          // For work entities, show the rest of the line as plain text
          if (entity.type === 'work') {
            const rest = line.replace(/^[-*]\s+[""]([^""]{3,200})[""]|^[-*]\s+\*\*([^*]{3,200})\*\*/, '').trim();
            const noTitle = rest.replace(/^by\s+[^()]+?\s*\(\d{4}\)\s*[—\-]?\s*/, '');
            return <span dangerouslySetInnerHTML={{ __html: renderInlineMarkdown(noTitle) }} />;
          }
          // For concept/researcher, show the rest of the line
          const rest = line.replace(/^[-*]\s+[^—\-]+[—\-]\s+/, '').trim();
          return <span dangerouslySetInnerHTML={{ __html: renderInlineMarkdown(rest) }} />;
        })()}
      </span>
    </div>
  );
}

function ConnectedSectionContent({ text, isStreaming, onEntityClick, index }) {
  const parts = splitByHeaders(text);

  return (
    <div className="space-y-4 text-sm leading-relaxed text-stone-700">
      {parts.map((part, i) => {
        const headerMatch = part.match(/^### (.+)/);
        if (headerMatch) {
          const sectionHeader = headerMatch[1];
          const rest = part.slice(headerMatch[0].length).trim();
          return (
            <div key={i} className="pt-1">
              <h4 className="font-semibold text-sm text-stone-900 mb-2">
                {sectionHeader}
              </h4>
              <div className="space-y-2">
                {rest.split('\n').map((line, j) => {
                  const trimmed = line.trim();
                  if (!trimmed) return null;
                  if (/^\d+\.\s/.test(trimmed)) {
                    return (
                      <div key={j} className="flex gap-2 ml-1">
                        <span className="text-stone-400 shrink-0 mt-0.5 font-mono text-xs">{trimmed.match(/^\d+/)[0]}.</span>
                        <span dangerouslySetInnerHTML={{ __html: renderInlineMarkdown(trimmed.replace(/^\d+\.\s+/, '')) }} />
                      </div>
                    );
                  }
                  return (
                    <ConnectedLine
                      key={j}
                      line={line}
                      sectionHeader={sectionHeader}
                      onEntityClick={onEntityClick}
                      index={index}
                    />
                  );
                })}
              </div>
            </div>
          );
        }
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

// ── Helpers ─────────────────────────────────────────────────────────────────

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

function AnimatedDots() {
  return (
    <span className="flex gap-0.5">
      <span className="loading-dot" />
      <span className="loading-dot" />
      <span className="loading-dot" />
    </span>
  );
}

function wordCount(text) {
  return Math.round((text || '').trim().split(/\s+/).filter(Boolean).length);
}

function SectionCard({ def, section, topic, onEntityClick, index }) {
  const [collapsed, setCollapsed] = useState(false);
  const colors = COLOR_MAP[def.key] || COLOR_MAP.conferences;
  const isComplete = section.phase === 'complete';
  const isStreaming = section.phase === 'streaming';
  const hasContent = !!section.content;

  return (
    <div className={`border ${colors.border} ${colors.bg}`}>
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

      {!collapsed && hasContent && section.content.trim() && (
        <div className={`px-5 py-4 border-t ${colors.border}`}>
          <ConnectedSectionContent
            text={section.content}
            isStreaming={isStreaming}
            onEntityClick={onEntityClick}
            index={index}
          />
        </div>
      )}
    </div>
  );
}

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

// ── Connectivity Dashboard ───────────────────────────────────────────────────

function ConnectivityDashboard({ parsedEntities, entityIndex, harvestedPapers, onEntityClick }) {
  if (parsedEntities.works.length === 0 && parsedEntities.concepts.length === 0 && parsedEntities.researchers.length === 0) {
    return null;
  }

  const topAuthors = Array.from(entityIndex.authorProfile.values())
    .sort((a, b) => b.totalCitations - a.totalCitations)
    .slice(0, 8);

  return (
    <div className="mb-6 border border-stone-200 bg-white">
      <div className="px-5 py-3 border-b border-stone-200">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-stone-900">Connectivity</h3>
          <span className="text-xs text-stone-400 font-mono">
            {parsedEntities.works.length} works · {parsedEntities.concepts.length} concepts · {parsedEntities.researchers.length} researchers
          </span>
        </div>
      </div>
      <div className="p-5">
        <ConceptCooccurrenceGraph
          concepts={parsedEntities.concepts}
          works={parsedEntities.works}
          authors={topAuthors.map(a => a.name)}
          onNodeClick={(node) => {
            if (node.type === 'concept') {
              onEntityClick({ type: 'concept', name: node.label });
            } else if (node.type === 'work') {
              const w = harvestedPapers.find(x => x.title?.startsWith(node.label.slice(0, 20)));
              if (w) onEntityClick({ type: 'work', name: w.title, work: w });
            } else if (node.type === 'author') {
              const profile = entityIndex.authorProfile.get(node.label.toLowerCase().replace(/[.,]/g, '').replace(/\s+/g, ' '));
              onEntityClick({ type: 'author', name: node.label, profile });
            }
          }}
          width={760}
          height={320}
        />
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div>
            <div className="font-mono text-stone-400 mb-1.5">TOP CONCEPTS</div>
            <div className="flex flex-wrap gap-1">
              {parsedEntities.concepts.slice(0, 6).map(c => (
                <button
                  key={c.name}
                  onClick={() => onEntityClick({ type: 'concept', name: c.name, definition: c.definition, tier: c.tier })}
                  className="px-2 py-1 bg-violet-50 border border-violet-200 text-violet-800 hover:bg-violet-100 transition-colors"
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="font-mono text-stone-400 mb-1.5">TOP WORKS</div>
            <div className="flex flex-col gap-1">
              {parsedEntities.works.slice(0, 4).map(w => {
                const matched = harvestedPapers.find(h => h.title === w.title);
                return (
                  <button
                    key={w.title}
                    onClick={() => onEntityClick({ type: 'work', name: w.title, work: matched })}
                    className="text-left px-2 py-1 bg-emerald-50 border border-emerald-200 text-emerald-800 hover:bg-emerald-100 transition-colors line-clamp-1"
                  >
                    {w.title}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <div className="font-mono text-stone-400 mb-1.5">TOP AUTHORS</div>
            <div className="flex flex-wrap gap-1">
              {topAuthors.slice(0, 6).map(a => (
                <button
                  key={a.name}
                  onClick={() => onEntityClick({ type: 'author', name: a.name, profile: a })}
                  className="px-2 py-1 bg-indigo-50 border border-indigo-200 text-indigo-800 hover:bg-indigo-100 transition-colors"
                >
                  {a.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

export default function UnifiedKnowledgePane({
  topic, phase, dataCount, error,
  sections, completedCount, activeCount,
  parsedEntities, entityIndex, harvestedPapers,
  selectedEntity, openEntity, closeEntity,
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

      {error && (
        <div className="mb-6 p-4 border border-red-200 bg-red-50">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {phase !== 'idle' && (
        <ProgressBar
          completedCount={completedCount}
          activeCount={activeCount}
          total={totalSections}
        />
      )}

      {dataCount > 0 && (
        <div className="mb-6 text-xs text-stone-400 font-mono">
          Harvested {dataCount} works across OpenAlex, Semantic Scholar, and Open Syllabus
        </div>
      )}

      {/* Connectivity Dashboard */}
      {phase === 'idle' && (
        <div className="text-center py-16 text-stone-400">
          <p className="text-sm font-mono">Select a topic above to explore everything about it</p>
        </div>
      )}

      <div className="space-y-2">
        <ConnectivityDashboard
          parsedEntities={parsedEntities}
          entityIndex={entityIndex}
          harvestedPapers={harvestedPapers}
          onEntityClick={openEntity}
        />
        {SECTION_DEFS.map(def => (
          <SectionCard
            key={def.key}
            def={def}
            section={sections[def.key]}
            topic={topic}
            onEntityClick={openEntity}
            index={entityIndex}
          />
        ))}
      </div>

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

      {/* Entity detail panel */}
      <EntityDetailPanel
        entity={selectedEntity}
        index={entityIndex}
        onClose={closeEntity}
        onOpen={openEntity}
      />
    </div>
  );
}
