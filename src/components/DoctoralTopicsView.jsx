import { useState, useMemo } from 'react';

function slugToName(slug) {
  return slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function timeAgo(ts) {
  if (!ts) return null;
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const MODES = [
  { key: 'canon',       label: 'Canon',          color: 'text-blue-700   bg-blue-50   hover:bg-blue-100   border-blue-200' },
  { key: 'curriculum',  label: 'Curriculum',      color: 'text-sky-700    bg-sky-50    hover:bg-sky-100    border-sky-200' },
  { key: 'dissertation',label: 'Dissertation',    color: 'text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border-indigo-200' },
  { key: 'reverse',     label: 'Prerequisites',   color: 'text-violet-700 bg-violet-50 hover:bg-violet-100 border-violet-200' },
  { key: 'drift',       label: 'Canon Drift',     color: 'text-amber-700  bg-amber-50  hover:bg-amber-100  border-amber-200' },
  { key: 'consilience', label: 'Consilience',     color: 'text-teal-700   bg-teal-50   hover:bg-teal-100   border-teal-200' },
  { key: 'inquiry',     label: 'Inquiry',         color: 'text-rose-700   bg-rose-50   hover:bg-rose-100   border-rose-200' },
  { key: 'spectrum',    label: 'Spectrum',        color: 'text-cyan-700   bg-cyan-50   hover:bg-cyan-100   border-cyan-200' },
  { key: 'intelligence',label: 'Field Intel',     color: 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-200' },
];

function TopicRow({ topic, subject, onSelect }) {
  const [open, setOpen] = useState(false);
  const name = slugToName(topic);
  const sourceUrl = `https://phd.nthrys.com/${subject}/${topic}`;

  return (
    <div className="relative">
      <div className={`flex items-center gap-1 group px-2 py-1.5 transition-colors ${open ? 'bg-stone-50' : 'hover:bg-stone-50'}`}>
        <span className={`w-1 h-1 rounded-full shrink-0 transition-colors ${open ? 'bg-emerald-500' : 'bg-stone-300 group-hover:bg-emerald-400'}`} />
        <button
          onClick={() => setOpen(o => !o)}
          className="flex-1 text-left text-xs text-stone-600 hover:text-stone-900 transition-colors"
        >
          {name}
        </button>
        <a
          href={sourceUrl}
          target="_blank"
          rel="noreferrer"
          onClick={e => e.stopPropagation()}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-stone-300 hover:text-stone-600 shrink-0"
          title="Open on phd.nthrys.com"
        >
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
            <path d="M5 2H2a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            <path d="M8 1h3m0 0v3m0-3L5.5 6.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </a>
      </div>

      {open && (
        <div className="px-4 pb-2.5 pt-1 bg-stone-50 border-t border-stone-100">
          <p className="text-xs text-stone-400 mb-2 font-mono">Generate with:</p>
          <div className="flex flex-wrap gap-1.5">
            {MODES.map(m => (
              <button
                key={m.key}
                onClick={() => { setOpen(false); onSelect(name, m.key); }}
                className={`text-xs px-2 py-1 border rounded-sm transition-colors ${m.color}`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function DoctoralTopicsView({
  status, subjects, topicsBySubject, totalTopics, error,
  lastChecked, updateCount,
  onLoad, onCheckForUpdates, onSelectTopic,
}) {
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return subjects;
    return subjects.filter(sub =>
      sub.includes(q) ||
      slugToName(sub).toLowerCase().includes(q) ||
      (topicsBySubject[sub] || []).some(t =>
        t.includes(q) || slugToName(t).toLowerCase().includes(q)
      )
    );
  }, [search, subjects, topicsBySubject]);

  const filteredTopics = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return topicsBySubject;
    const result = {};
    for (const sub of filtered) {
      const topics = (topicsBySubject[sub] || []).filter(t =>
        !q || t.includes(q) || slugToName(t).toLowerCase().includes(q) ||
        sub.includes(q) || slugToName(sub).toLowerCase().includes(q)
      );
      result[sub] = topics;
    }
    return result;
  }, [search, filtered, topicsBySubject]);

  if (status === 'idle') {
    return (
      <div className="mt-10 text-center py-16">
        <p className="text-xs font-mono uppercase tracking-widest text-stone-400 mb-2">Doctoral Topics</p>
        <p className="text-sm text-stone-500 mb-2 max-w-md mx-auto">
          1,405 academic subjects · 280,700 PhD research topics
        </p>
        <p className="text-xs text-stone-400 mb-6">Loads on demand · cached after first use</p>
        <button
          onClick={onLoad}
          className="px-6 py-2.5 text-sm bg-stone-900 text-white hover:bg-stone-700 transition-colors"
        >
          Load All Topics
        </button>
      </div>
    );
  }

  if (status === 'loading') {
    return (
      <div className="mt-10 flex items-center gap-2.5 text-stone-400">
        <span className="flex gap-0.5">
          <span className="loading-dot" /><span className="loading-dot" /><span className="loading-dot" />
        </span>
        <span className="text-sm">Loading 280,700 PhD topics across 1,405 subjects...</span>
      </div>
    );
  }

  if (status === 'error' && !subjects.length) {
    return (
      <div className="mt-10 p-5 bg-red-50 border border-red-200">
        <p className="font-medium text-red-900 text-sm mb-1">Could not load topics</p>
        <p className="text-xs text-red-700">{error}</p>
        <button onClick={onLoad} className="mt-3 text-sm text-red-700 underline">Try again</button>
      </div>
    );
  }

  const isUpdating = status === 'updating';

  return (
    <div className="mt-8">
      {/* New topics banner */}
      {updateCount > 0 && !dismissed && (
        <div className="mb-4 px-4 py-3 bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
            <span className="text-sm text-emerald-800 font-medium">
              {updateCount.toLocaleString()} new {updateCount === 1 ? 'topic' : 'topics'} found and saved
            </span>
          </div>
          <button onClick={() => setDismissed(true)} className="text-emerald-600 hover:text-emerald-800 text-xs">dismiss</button>
        </div>
      )}

      {/* Proxy error when we still have data */}
      {status === 'error' && subjects.length > 0 && (
        <div className="mb-4 px-4 py-3 bg-amber-50 border border-amber-200 text-xs text-amber-800">
          Update check failed — {error}
        </div>
      )}

      {/* Stats + search + update button */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
        <div className="flex-1">
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setExpanded(null); }}
            placeholder="Search subjects or topics..."
            className="w-full px-3 py-2.5 text-sm border border-stone-200 bg-white text-stone-900 placeholder-stone-300 focus:outline-none focus:border-stone-700 transition-colors"
          />
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs font-mono text-stone-400">
            {search.trim()
              ? `${filtered.length} of ${subjects.length.toLocaleString()} subjects`
              : `${subjects.length.toLocaleString()} subjects · ${totalTopics.toLocaleString()} topics`}
          </span>
          <div className="flex items-center gap-1.5">
            {lastChecked && (
              <span className="text-xs text-stone-300 font-mono hidden sm:inline">
                checked {timeAgo(lastChecked)}
              </span>
            )}
            <button
              onClick={() => { setDismissed(false); onCheckForUpdates(topicsBySubject); }}
              disabled={isUpdating}
              className="text-xs font-mono px-2.5 py-1.5 border border-stone-200 text-stone-500 hover:border-stone-400 hover:text-stone-700 transition-colors disabled:opacity-40 flex items-center gap-1.5"
            >
              {isUpdating ? (
                <>
                  <span className="flex gap-0.5">
                    <span className="loading-dot" style={{ width: 3, height: 3 }} />
                    <span className="loading-dot" style={{ width: 3, height: 3 }} />
                    <span className="loading-dot" style={{ width: 3, height: 3 }} />
                  </span>
                  Checking...
                </>
              ) : 'Check for Updates'}
            </button>
          </div>
        </div>
      </div>

      {/* Subject accordion */}
      <div className="space-y-1">
        {filtered.map(sub => {
          const topics = filteredTopics[sub] || [];
          const isOpen = expanded === sub || (search.trim() && topics.length > 0);
          const subName = slugToName(sub);

          return (
            <div key={sub} className="border border-stone-200">
              <button
                onClick={() => setExpanded(expanded === sub ? null : sub)}
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-stone-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-stone-800">{subName}</span>
                  <span className="text-xs font-mono text-stone-400 bg-stone-100 px-1.5 py-0.5">
                    {topics.length}
                  </span>
                </div>
                <svg
                  width="12" height="12" viewBox="0 0 12 12" fill="none"
                  className={`text-stone-400 transition-transform shrink-0 ${isOpen ? 'rotate-180' : ''}`}
                >
                  <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="square" strokeLinejoin="miter"/>
                </svg>
              </button>

              {isOpen && topics.length > 0 && (
                <div className="border-t border-stone-100 divide-y divide-stone-100">
                  {topics.map(topic => (
                    <TopicRow
                      key={topic}
                      topic={topic}
                      subject={sub}
                      onSelect={onSelectTopic}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-10 text-sm text-stone-400">
          No subjects or topics match &ldquo;{search}&rdquo;
        </div>
      )}
    </div>
  );
}
