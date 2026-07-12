import { useState, useMemo, useCallback, useRef } from 'react';

// ── Topic description cache + fetcher ─────────────────────────────────────────
const descCache = new Map();

async function fetchDescription(topicName) {
  if (descCache.has(topicName)) return descCache.get(topicName);
  const key = localStorage.getItem('canon_api_key') || import.meta.env?.VITE_ANTHROPIC_API_KEY || '';
  if (!key) return null;
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 80,
        system: 'You are a scientific encyclopedia. Respond with exactly one sentence (under 25 words) defining the given research topic. No preamble, no punctuation beyond the period.',
        messages: [{ role: 'user', content: `Define: ${topicName}` }],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const desc = data.content?.[0]?.text?.trim() || null;
    if (desc) descCache.set(topicName, desc);
    return desc;
  } catch { return null; }
}

const MODES = [
  { key: 'canon',        label: 'Canon',          color: 'text-blue-700    bg-blue-50    hover:bg-blue-100    border-blue-200'    },
  { key: 'curriculum',   label: 'Curriculum',     color: 'text-sky-700     bg-sky-50     hover:bg-sky-100     border-sky-200'     },
  { key: 'dissertation', label: 'Dissertation',   color: 'text-indigo-700  bg-indigo-50  hover:bg-indigo-100  border-indigo-200'  },
  { key: 'reverse',      label: 'Prerequisites',  color: 'text-violet-700  bg-violet-50  hover:bg-violet-100  border-violet-200'  },
  { key: 'drift',        label: 'Canon Drift',    color: 'text-amber-700   bg-amber-50   hover:bg-amber-100   border-amber-200'   },
  { key: 'consilience',  label: 'Consilience',    color: 'text-teal-700    bg-teal-50    hover:bg-teal-100    border-teal-200'    },
  { key: 'inquiry',      label: 'Inquiry',        color: 'text-rose-700    bg-rose-50    hover:bg-rose-100    border-rose-200'    },
  { key: 'spectrum',     label: 'Spectrum',       color: 'text-cyan-700    bg-cyan-50    hover:bg-cyan-100    border-cyan-200'    },
  { key: 'intelligence', label: 'Field Intel',    color: 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-200' },
  { key: 'overall',      label: 'Overall',        color: 'text-stone-700   bg-stone-50   hover:bg-stone-100   border-stone-200'   },
];

const ExternalIcon = () => (
  <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
    <path d="M5 2H2a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    <path d="M8 1h3m0 0v3m0-3L5.5 6.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

function sdUrl(subjectSlug, topicSlug) {
  return `https://www.sciencedirect.com/topics/${subjectSlug}/${topicSlug}`;
}

function ModePicker({ name, onSelect, onClose }) {
  return (
    <div className="px-4 pb-3 pt-2 bg-stone-50 border-t border-stone-100">
      <p className="text-xs text-stone-400 mb-2 font-mono">Generate with:</p>
      <div className="flex flex-wrap gap-1.5">
        {MODES.map(m => (
          <button
            key={m.key}
            onClick={() => { onClose(); onSelect(name, m.key); }}
            className={`text-xs px-2 py-1 border rounded-sm transition-colors ${m.color}`}
          >
            {m.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function TopicRow({ topic, subjectSlug, onSelect }) {
  const [open, setOpen] = useState(false);
  const [desc, setDesc] = useState(descCache.get(topic.n) || null);
  const [descLoading, setDescLoading] = useState(false);
  const fetchedRef = useRef(false);

  function handleOpen() {
    setOpen(o => !o);
    if (!fetchedRef.current && !descCache.has(topic.n)) {
      fetchedRef.current = true;
      setDescLoading(true);
      fetchDescription(topic.n).then(d => { setDesc(d); setDescLoading(false); });
    }
  }

  return (
    <div>
      <div className="flex items-center gap-1 group pl-6 pr-3 py-1 hover:bg-stone-50 transition-colors">
        <span className="text-stone-200 text-xs shrink-0 select-none">·</span>
        <button
          onClick={handleOpen}
          className="flex-1 text-left text-xs text-stone-600 hover:text-stone-900 transition-colors leading-snug py-0.5"
        >
          {topic.n}
        </button>
        <a
          href={sdUrl(subjectSlug, topic.s)}
          target="_blank"
          rel="noreferrer"
          onClick={e => e.stopPropagation()}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-stone-300 hover:text-blue-600 shrink-0 ml-1"
          title="Open on ScienceDirect"
        >
          <ExternalIcon />
        </a>
      </div>
      {open && (
        <>
          {(descLoading || desc) && (
            <div className="pl-8 pr-4 pb-1.5 pt-0">
              {descLoading
                ? <span className="text-xs text-stone-300 font-mono italic">defining…</span>
                : <p className="text-xs text-stone-500 leading-relaxed italic">{desc}</p>
              }
            </div>
          )}
          <ModePicker name={topic.n} onSelect={onSelect} onClose={() => setOpen(false)} />
        </>
      )}
    </div>
  );
}

function groupByLetter(topics) {
  const map = new Map();
  for (const t of topics) {
    const letter = t.n[0].toUpperCase();
    if (!map.has(letter)) map.set(letter, []);
    map.get(letter).push(t);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([letter, topics]) => ({ label: letter, topics }));
}

function GroupRow({ group, subjectSlug, onSelect }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div>
      <div
        className="flex items-center gap-2 pl-4 pr-3 py-1.5 hover:bg-stone-50 cursor-pointer transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none"
          className={`transition-transform shrink-0 text-stone-400 ${expanded ? 'rotate-90' : ''}`}>
          <path d="M3 2l4 3-4 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <span className="text-xs font-semibold text-stone-700">{group.label}</span>
        <span className="text-xs font-mono text-stone-300">{group.topics.length.toLocaleString()}</span>
      </div>
      {expanded && group.topics.map(t => (
        <TopicRow key={t.s} topic={t} subjectSlug={subjectSlug} onSelect={onSelect} />
      ))}
    </div>
  );
}

function SubjectRow({ subject, topics, onSelect, searchActive }) {
  const [expanded, setExpanded] = useState(false);
  const hasTopics = topics.length > 0;
  const isExpanded = searchActive || expanded;

  const groups = useMemo(() => groupByLetter(topics), [topics]);

  return (
    <div className="border border-stone-200 rounded">
      <div className="flex items-center group px-4 py-3 hover:bg-stone-50 transition-colors rounded">
        <button
          onClick={() => setExpanded(e => !e)}
          className="flex-1 text-left flex items-center gap-3 min-w-0"
        >
          <span className="text-sm font-semibold text-stone-800 truncate">{subject.name}</span>
          <span className="text-xs font-mono text-stone-400 bg-stone-100 px-1.5 py-0.5 shrink-0 rounded">
            {hasTopics ? topics.length.toLocaleString() : subject.count.toLocaleString()}
          </span>
          {!hasTopics && (
            <span className="text-xs text-stone-300 font-mono shrink-0">crawl required</span>
          )}
        </button>
        <a
          href={`https://www.sciencedirect.com/topics/${subject.slug}`}
          target="_blank"
          rel="noreferrer"
          onClick={e => e.stopPropagation()}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-stone-300 hover:text-blue-600 mr-3 shrink-0"
          title="Open on ScienceDirect"
        >
          <ExternalIcon />
        </a>
        <button
          onClick={() => setExpanded(e => !e)}
          className="text-stone-400 hover:text-stone-700 transition-colors shrink-0"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
            className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
            <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      {isExpanded && hasTopics && (
        <div className="border-t border-stone-100">
          {searchActive
            ? topics.map(t => (
                <TopicRow key={t.s} topic={t} subjectSlug={subject.slug} onSelect={onSelect} />
              ))
            : groups.map(g => (
                <GroupRow key={g.label} group={g} subjectSlug={subject.slug} onSelect={onSelect} />
              ))
          }
        </div>
      )}
      {isExpanded && !hasTopics && (
        <div className="border-t border-stone-100 px-6 py-3 text-xs text-stone-400 font-mono">
          Topics not loaded — run the crawl script first.
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ScienceDirectView({ status, subjects, topicsBySubject, total, crawlDate, error, onLoad, onSelect, scanStatus, newTopics, onCheckForUpdates }) {

  const [query, setQuery] = useState('');

  const topicsHarvested = Object.keys(topicsBySubject).length > 0;

  const filteredSubjects = useMemo(() => {
    if (!query.trim()) return subjects.map(s => ({
      subject: s,
      topics: (topicsBySubject[s.slug] || []),
    }));
    const q = query.toLowerCase();
    return subjects.map(s => {
      const all = topicsBySubject[s.slug] || [];
      const filtered = all.filter(t => t.n.toLowerCase().includes(q));
      return { subject: s, topics: filtered };
    }).filter(r => r.topics.length > 0 || r.subject.name.toLowerCase().includes(q));
  }, [subjects, topicsBySubject, query]);

  // Count total matching topics
  const matchCount = useMemo(() => {
    if (!query.trim()) return null;
    return filteredSubjects.reduce((sum, r) => sum + r.topics.length, 0);
  }, [filteredSubjects, query]);

  const handleSelect = useCallback((name, mode) => {
    if (onSelect) onSelect(name, mode);
  }, [onSelect]);

  // ── Not loaded ─────────────────────────────────────────────────────────────
  if (status === 'idle') {
    return (
      <div className="mt-8 flex flex-col items-center gap-4 py-12">
        <p className="text-stone-400 text-sm font-mono">353,074 topics across 20 scientific disciplines</p>
        <button
          onClick={onLoad}
          className="px-6 py-2.5 bg-stone-900 text-white text-sm font-mono hover:bg-stone-700 transition-colors"
        >
          Load ScienceDirect Topics
        </button>
      </div>
    );
  }

  if (status === 'loading') {
    return (
      <div className="mt-8 flex items-center gap-3 text-stone-400 py-12 justify-center">
        <span className="flex gap-0.5">
          <span className="loading-dot"/><span className="loading-dot"/><span className="loading-dot"/>
        </span>
        <span className="text-sm font-mono">Loading topics…</span>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="mt-8 text-red-600 text-sm py-8 text-center font-mono">{error}</div>
    );
  }

  // ── Loaded ─────────────────────────────────────────────────────────────────
  return (
    <div className="mt-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-2xl font-bold font-mono text-stone-900 tabular-nums">
            {total.toLocaleString()}
          </span>
          <span className="text-sm text-stone-500">topics · {subjects.length} disciplines</span>
          {crawlDate && (
            <span className="text-xs text-stone-300 font-mono">crawled {crawlDate}</span>
          )}
          {!topicsHarvested && (
            <span className="text-xs font-mono text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
              Topics not crawled — run scripts/crawl-sciencedirect-console.js
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0 ml-4">
          {topicsHarvested && (
            <button
              onClick={() => onCheckForUpdates(subjects)}
              disabled={scanStatus === 'scanning'}
              className="text-xs font-mono text-stone-400 hover:text-stone-700 transition-colors disabled:opacity-40"
            >
              {scanStatus === 'scanning' ? 'scanning…' : 'Check for new topics'}
            </button>
          )}
          <a
            href="https://www.sciencedirect.com/topics"
            target="_blank"
            rel="noreferrer"
            className="text-xs text-stone-400 hover:text-blue-600 transition-colors font-mono flex items-center gap-1"
          >
            ScienceDirect <ExternalIcon />
          </a>
        </div>
      </div>

      {/* Scan results */}
      {scanStatus === 'done' && newTopics.length > 0 && (
        <div className="mb-5 border border-emerald-200 bg-emerald-50 p-4 rounded">
          <p className="text-xs font-mono text-emerald-700 mb-2 font-semibold">
            {newTopics.reduce((s, t) => s + t.diff, 0).toLocaleString()} new topics found across {newTopics.length} subjects
          </p>
          <div className="space-y-1">
            {newTopics.map(t => (
              <div key={t.slug} className="flex items-center gap-2 text-xs text-emerald-700">
                <span className="font-semibold">{t.name}</span>
                <span className="text-emerald-500">{t.storedCount.toLocaleString()} → {t.currentCount.toLocaleString()}</span>
                <span className="font-mono text-emerald-600">+{t.diff.toLocaleString()}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-emerald-600 font-mono mt-2">Re-run the crawl script to update.</p>
        </div>
      )}
      {scanStatus === 'done' && newTopics.length === 0 && (
        <div className="mb-5 border border-stone-200 bg-stone-50 p-3 rounded text-xs text-stone-500 font-mono">
          All subjects up to date — no new topics found.
        </div>
      )}
      {scanStatus === 'error' && (
        <div className="mb-5 border border-amber-200 bg-amber-50 p-3 rounded text-xs text-amber-700 font-mono">
          {error}
        </div>
      )}

      {/* Search */}
      {topicsHarvested && (
        <div className="mb-5">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search topics…"
            className="w-full border border-stone-300 px-3 py-2 text-sm text-stone-700 placeholder-stone-300 focus:outline-none focus:border-stone-500"
          />
          {query.trim() && (
            <p className="text-xs text-stone-400 font-mono mt-1.5">
              {matchCount?.toLocaleString() ?? 0} topics match
            </p>
          )}
        </div>
      )}

      {/* Subject list */}
      <div className="space-y-2">
        {filteredSubjects.map(({ subject, topics }) => (
          <SubjectRow
            key={subject.slug}
            subject={subject}
            topics={topics}
            onSelect={handleSelect}
            searchActive={!!query.trim()}
          />
        ))}
        {filteredSubjects.length === 0 && query.trim() && (
          <p className="text-sm text-stone-400 font-mono py-8 text-center">No topics match "{query}"</p>
        )}
      </div>
    </div>
  );
}
