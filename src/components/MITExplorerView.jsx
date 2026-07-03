import { useEffect, useState, useRef, useMemo } from 'react';
import { syllabusSearch } from '../utils/syllabusHarvest';

// ── Field colour schemes (complete static strings for Tailwind JIT) ───────────
const FIELD_STYLES = {
  'Engineering':    { sel: 'bg-blue-700 text-white border-blue-700',        unsel: 'border-blue-300 text-blue-700 hover:bg-blue-50',          sfBg: 'bg-blue-50',    sfHov: 'hover:bg-blue-100',    sfTx: 'text-blue-900',    badge: 'bg-blue-100 text-blue-700',     numTx: 'text-blue-600'   },
  'Science':        { sel: 'bg-emerald-700 text-white border-emerald-700',   unsel: 'border-emerald-300 text-emerald-700 hover:bg-emerald-50', sfBg: 'bg-emerald-50', sfHov: 'hover:bg-emerald-100', sfTx: 'text-emerald-900', badge: 'bg-emerald-100 text-emerald-700', numTx: 'text-emerald-600' },
  'Mathematics':    { sel: 'bg-violet-700 text-white border-violet-700',     unsel: 'border-violet-300 text-violet-700 hover:bg-violet-50',    sfBg: 'bg-violet-50',  sfHov: 'hover:bg-violet-100',  sfTx: 'text-violet-900',  badge: 'bg-violet-100 text-violet-700',  numTx: 'text-violet-600'  },
  'Humanities':     { sel: 'bg-amber-700 text-white border-amber-700',       unsel: 'border-amber-300 text-amber-700 hover:bg-amber-50',       sfBg: 'bg-amber-50',   sfHov: 'hover:bg-amber-100',   sfTx: 'text-amber-900',   badge: 'bg-amber-100 text-amber-700',    numTx: 'text-amber-600'   },
  'Social Science': { sel: 'bg-teal-700 text-white border-teal-700',         unsel: 'border-teal-300 text-teal-700 hover:bg-teal-50',          sfBg: 'bg-teal-50',    sfHov: 'hover:bg-teal-100',    sfTx: 'text-teal-900',    badge: 'bg-teal-100 text-teal-700',     numTx: 'text-teal-600'   },
  'Management':     { sel: 'bg-rose-700 text-white border-rose-700',         unsel: 'border-rose-300 text-rose-700 hover:bg-rose-50',          sfBg: 'bg-rose-50',    sfHov: 'hover:bg-rose-100',    sfTx: 'text-rose-900',    badge: 'bg-rose-100 text-rose-700',     numTx: 'text-rose-600'   },
  'Architecture':   { sel: 'bg-indigo-700 text-white border-indigo-700',     unsel: 'border-indigo-300 text-indigo-700 hover:bg-indigo-50',    sfBg: 'bg-indigo-50',  sfHov: 'hover:bg-indigo-100',  sfTx: 'text-indigo-900',  badge: 'bg-indigo-100 text-indigo-700',  numTx: 'text-indigo-600'  },
  'Other':          { sel: 'bg-stone-700 text-white border-stone-700',       unsel: 'border-stone-300 text-stone-600 hover:bg-stone-50',       sfBg: 'bg-stone-100',  sfHov: 'hover:bg-stone-200',   sfTx: 'text-stone-800',   badge: 'bg-stone-200 text-stone-700',   numTx: 'text-stone-500'  },
};
const DEFAULT_STYLE = FIELD_STYLES['Other'];
function getStyle(field) { return FIELD_STYLES[field] || DEFAULT_STYLE; }

// ── Helpers ───────────────────────────────────────────────────────────────────

function resolveApiKey() {
  return import.meta.env.VITE_ANTHROPIC_API_KEY || localStorage.getItem('canon_api_key') || '';
}

function parseClaudeDetail(text) {
  const out = { prerequisites: [], skills: [], curriculum: [] };
  let sec = null;
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\*\*/g, '').trim();
    if (!line) continue;
    if (line === 'PREREQUISITES:') { sec = 'prerequisites'; continue; }
    if (line === 'SKILLS:')        { sec = 'skills';        continue; }
    if (line === 'CURRICULUM:')    { sec = 'curriculum';    continue; }
    if (!sec) continue;
    const t = line.replace(/^[-•\d.]\s*/, '').trim();
    if (t) out[sec].push(t);
  }
  return out;
}

async function fetchPapersForCourse(query, signal) {
  const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&limit=15&fields=title,authors,year,citationCount,influentialCitationCount`;
  try {
    const res = await fetch(url, { signal });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.data || [])
      .map(p => ({
        title: p.title || '',
        authors: (p.authors || []).map(a => a.name || '').filter(Boolean).slice(0, 3).join(', '),
        year: p.year || null,
        influentialCitationCount: p.influentialCitationCount || 0,
      }))
      .filter(p => p.influentialCitationCount > 0)
      .sort((a, b) => b.influentialCitationCount - a.influentialCitationCount)
      .slice(0, 10);
  } catch { return []; }
}

// ── Per-course detail panel ───────────────────────────────────────────────────

function CourseDetailPanel({ course }) {
  const [ocw, setOcw]           = useState(null);
  const [books, setBooks]        = useState([]);
  const [papers, setPapers]      = useState([]);
  const [prereqs, setPrereqs]    = useState([]);
  const [skills, setSkills]      = useState([]);
  const [curriculum, setCurriculum] = useState([]);
  const [ocwPhase, setOcwPhase]  = useState('loading');
  const [claudePhase, setClaudePhase] = useState('idle');
  const abort = useRef(null);

  useEffect(() => {
    abort.current = new AbortController();
    const { signal } = abort.current;

    (async () => {
      // Fetch OCW detail + OpenSyllabus books + Semantic Scholar papers in parallel
      const booksQuery = course.spec && course.spec !== 'General' ? course.spec : course.title;
      const papersQuery = course.spec && course.spec !== 'General' ? course.spec : course.title;

      const [ocwRes, bookRes, paperRes] = await Promise.allSettled([
        course.url
          ? fetch(`/api/mit-course-detail?url=${encodeURIComponent(course.url)}`, { signal }).then(r => r.ok ? r.json() : null).catch(() => null)
          : Promise.resolve(null),
        syllabusSearch(booksQuery, 20),
        fetchPapersForCourse(papersQuery, signal),
      ]);

      if (signal.aborted) return;

      if (ocwRes.status === 'fulfilled' && ocwRes.value) setOcw(ocwRes.value);
      if (bookRes.status === 'fulfilled') {
        setBooks(bookRes.value.sort((a, b) => b.syllabusCount - a.syllabusCount).slice(0, 15));
      }
      if (paperRes.status === 'fulfilled') setPapers(paperRes.value);
      setOcwPhase('done');

      // Claude for prerequisites, skills, curriculum
      const key = resolveApiKey();
      if (!key || signal.aborted) return;

      setClaudePhase('streaming');
      try {
        const resp = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': key,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
          },
          body: JSON.stringify({
            model: 'claude-sonnet-5',
            max_tokens: 2000,
            stream: true,
            system: `You are an expert on MIT OpenCourseWare. Output ONLY the structured text below. No markdown. No bold. Start immediately with "PREREQUISITES:" — nothing before it.

PREREQUISITES:
[every prerequisite course or knowledge area, one per line, with MIT course numbers where applicable]

SKILLS:
[concrete competencies students gain — things they can build or demonstrate, one per line]

CURRICULUM:
[week-by-week or module-by-module breakdown, one per line]

Rules: prerequisites must name actual MIT courses with numbers where possible. Skills must be specific and actionable. Curriculum must reflect MIT's actual published structure.`,
            messages: [{
              role: 'user',
              content: `MIT OCW: ${course.courseNums[0] || ''} — ${course.title}\nDepartment: ${course.subfield}\nLevel: ${course.level}`,
            }],
          }),
          signal,
        });

        if (!resp.ok || signal.aborted) { setClaudePhase('done'); return; }

        const reader = resp.body.getReader();
        const dec = new TextDecoder();
        let buf = '', result = '';
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done || signal.aborted) break;
            buf += dec.decode(value, { stream: true });
            const lines = buf.split('\n');
            buf = lines.pop() ?? '';
            for (const ln of lines) {
              if (!ln.startsWith('data: ')) continue;
              const d = ln.slice(6).trim();
              if (!d || d === '[DONE]') continue;
              try {
                const ev = JSON.parse(d);
                if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta') {
                  result += ev.delta.text;
                  const parsed = parseClaudeDetail(result);
                  setPrereqs(parsed.prerequisites);
                  setSkills(parsed.skills);
                  setCurriculum(parsed.curriculum);
                }
              } catch {}
            }
          }
        } finally { reader.releaseLock(); }

        if (!signal.aborted) setClaudePhase('done');
      } catch (e) {
        if (e.name !== 'AbortError') setClaudePhase('done');
      }
    })();

    return () => abort.current?.abort();
  }, [course.url, course.title, course.spec]);

  const loading = ocwPhase === 'loading';

  return (
    <div className="mt-1 mb-4 space-y-2.5 pl-7 pr-4 pb-2">
      {loading && (
        <div className="flex items-center gap-2 py-3">
          <span className="flex gap-0.5"><span className="loading-dot" /><span className="loading-dot" /><span className="loading-dot" /></span>
          <span className="text-xs text-stone-400">Loading course data...</span>
        </div>
      )}

      {/* Real OCW description */}
      {ocw?.description && (
        <div className="border-l-4 border-stone-300 bg-stone-50 px-4 py-3">
          <p className="text-xs font-mono text-stone-400 mb-1.5">About this course</p>
          <p className="text-sm text-stone-700 leading-relaxed">{ocw.description}</p>
        </div>
      )}

      {/* OCW course features */}
      {ocw?.features?.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          <span className="text-xs text-stone-400 mr-1">Materials:</span>
          {ocw.features.map((f, i) => (
            <span key={i} className="text-xs bg-stone-100 text-stone-600 px-2 py-0.5">{f}</span>
          ))}
        </div>
      )}

      {/* OCW topic keywords */}
      {ocw?.keywords?.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {ocw.keywords.slice(0, 12).map((k, i) => (
            <span key={i} className="text-xs bg-sky-50 text-sky-600 border border-sky-100 px-2 py-0.5">{k}</span>
          ))}
        </div>
      )}

      {/* Prerequisites (Claude) */}
      {prereqs.length > 0 && (
        <div className="border-l-4 border-blue-400 bg-blue-50 px-4 py-3">
          <p className="text-xs font-mono text-blue-600 mb-1.5">← Prerequisites</p>
          <ul className="space-y-0.5">
            {prereqs.map((p, i) => <li key={i} className="text-xs text-stone-700">{p}</li>)}
          </ul>
        </div>
      )}

      {/* Skills (Claude) */}
      {skills.length > 0 && (
        <div className="border-l-4 border-emerald-400 bg-emerald-50 px-4 py-3">
          <p className="text-xs font-mono text-emerald-600 mb-1.5">✓ Skills Gained</p>
          <ul className="space-y-0.5">
            {skills.map((s, i) => <li key={i} className="text-xs text-stone-700">{s}</li>)}
          </ul>
        </div>
      )}

      {/* Curriculum (Claude) */}
      {curriculum.length > 0 && (
        <div className="border-l-4 border-amber-400 bg-amber-50 px-4 py-3">
          <p className="text-xs font-mono text-amber-600 mb-1.5">◎ Curriculum</p>
          <ul className="space-y-0.5">
            {curriculum.map((l, i) => <li key={i} className="text-xs text-stone-700">{l}</li>)}
          </ul>
        </div>
      )}

      {claudePhase === 'streaming' && prereqs.length === 0 && (
        <div className="flex items-center gap-2">
          <span className="flex gap-0.5"><span className="loading-dot" /><span className="loading-dot" /><span className="loading-dot" /></span>
          <span className="text-xs text-stone-400">Generating prerequisites &amp; curriculum...</span>
        </div>
      )}

      {/* Books — OpenSyllabus */}
      {books.length > 0 && (
        <div className="border-l-4 border-rose-400 bg-rose-50 px-4 py-3">
          <div className="flex items-baseline gap-2 mb-2">
            <p className="text-xs font-mono text-rose-600">▬ Books &amp; Textbooks</p>
            <span className="text-xs text-rose-300 font-mono">Open Syllabus</span>
          </div>
          <ul className="space-y-2">
            {books.map((b, i) => (
              <li key={i} className="text-xs flex items-baseline gap-2">
                <span className="text-rose-300 font-mono shrink-0 w-4">{i + 1}</span>
                <span>
                  <span className="text-stone-800 font-medium">{b.title}</span>
                  {b.authors && <span className="text-stone-500 ml-1">— {b.authors}</span>}
                  {b.year && <span className="text-stone-400 ml-1">({b.year})</span>}
                  {b.syllabusCount > 0 && (
                    <span className="ml-2 text-rose-400">{b.syllabusCount.toLocaleString()} syllabi</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Papers — Semantic Scholar */}
      {papers.length > 0 && (
        <div className="border-l-4 border-teal-400 bg-teal-50 px-4 py-3">
          <div className="flex items-baseline gap-2 mb-2">
            <p className="text-xs font-mono text-teal-600">◉ Seminal Papers</p>
            <span className="text-xs text-teal-300 font-mono">Semantic Scholar</span>
          </div>
          <ul className="space-y-2">
            {papers.map((p, i) => (
              <li key={i} className="text-xs flex items-baseline gap-2">
                <span className="text-teal-300 font-mono shrink-0 w-4">{i + 1}</span>
                <span>
                  <span className="text-stone-800 font-medium">{p.title}</span>
                  {p.authors && <span className="text-stone-500 ml-1">— {p.authors}</span>}
                  {p.year && <span className="text-stone-400 ml-1">({p.year})</span>}
                  {p.influentialCitationCount > 0 && (
                    <span className="ml-2 text-teal-500">{p.influentialCitationCount.toLocaleString()} citations</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {ocwPhase === 'done' && books.length === 0 && papers.length === 0 && claudePhase === 'done' && (
        <p className="text-xs text-stone-400 pl-1">No additional resources found for this course.</p>
      )}

      {course.url && (
        <div className="pt-1">
          <a href={course.url} target="_blank" rel="noreferrer"
            className="text-xs font-mono text-stone-400 hover:text-stone-700 transition-colors">
            View on MIT OCW ↗
          </a>
        </div>
      )}
    </div>
  );
}

// ── Course row ────────────────────────────────────────────────────────────────

function CourseRow({ course, cs }) {
  const [open, setOpen] = useState(false);
  const num = course.courseNums[0] || '';
  const termStr = course.semester && course.year ? `${course.semester} ${course.year}` : course.year;
  const meta = [course.level, termStr].filter(Boolean).join(' · ');

  return (
    <div>
      <div className="flex items-start gap-3 py-2.5 border-b border-stone-100 last:border-0">
        <button onClick={() => setOpen(o => !o)}
          className="text-xs font-mono text-stone-300 hover:text-stone-600 transition-colors mt-0.5 shrink-0 w-3">
          {open ? '▾' : '▸'}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            {num && (
              <span className={`text-xs font-mono shrink-0 ${cs.numTx}`}>{num}</span>
            )}
            <button onClick={() => setOpen(o => !o)}
              className="text-sm text-stone-900 text-left hover:text-stone-600 transition-colors">
              {course.title}
            </button>
          </div>
          {meta && (
            <p className="text-xs text-stone-400 mt-0.5">{meta}</p>
          )}
        </div>
        {course.url && (
          <a href={course.url} target="_blank" rel="noreferrer"
            className="text-xs font-mono text-stone-300 hover:text-stone-700 transition-colors shrink-0 mt-0.5">↗</a>
        )}
      </div>
      {open && <CourseDetailPanel course={course} />}
    </div>
  );
}

// ── Specialization block (level 3) ────────────────────────────────────────────

function SpecBlock({ name, courses, cs }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-stone-100 last:border-0">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between py-2 px-4 text-left hover:bg-stone-50 transition-colors">
        <span className={`text-xs px-2 py-0.5 ${cs.badge}`}>{name}</span>
        <span className="text-xs font-mono text-stone-400">{courses.length} {open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="pl-6 pr-4 pb-1">
          {courses.map((c, i) => <CourseRow key={c.id || i} course={c} cs={cs} />)}
        </div>
      )}
    </div>
  );
}

// ── Department / subfield block (level 2) ─────────────────────────────────────

function SubfieldBlock({ name, specs, cs }) {
  const [open, setOpen] = useState(false);
  const total = Object.values(specs).reduce((s, a) => s + a.length, 0);
  return (
    <div className="border-b border-stone-200 last:border-0">
      <button onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between py-3 px-4 text-left transition-colors ${cs.sfBg} ${cs.sfHov}`}>
        <span className={`text-sm font-medium ${cs.sfTx}`}>{name}</span>
        <span className="text-xs font-mono text-stone-400">{total} courses {open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="bg-white">
          {Object.entries(specs)
            .sort(([, a], [, b]) => b.length - a.length)
            .map(([spec, courses]) => (
              <SpecBlock key={spec} name={spec} courses={courses} cs={cs} />
            ))}
        </div>
      )}
    </div>
  );
}

// ── Field-level resource row (books / papers) ─────────────────────────────────

function ResourceRow({ item, rank, type }) {
  return (
    <div className="flex items-baseline gap-3 py-2.5 border-b border-stone-100 last:border-0">
      <span className="text-xs font-mono text-stone-300 w-5 shrink-0">{rank}</span>
      <div className="flex-1 min-w-0">
        <span className="text-sm text-stone-800">{item.title}</span>
        {item.authors && <span className="text-xs text-stone-400 ml-2">— {item.authors}</span>}
        {item.year && <span className="text-xs text-stone-400 ml-1">({item.year})</span>}
      </div>
      {type === 'book' && item.syllabusCount > 0 && (
        <span className="text-xs font-mono text-rose-400 shrink-0">{item.syllabusCount.toLocaleString()} syllabi</span>
      )}
      {type === 'paper' && item.influentialCitationCount > 0 && (
        <span className="text-xs font-mono text-teal-500 shrink-0">{item.influentialCitationCount.toLocaleString()} cites</span>
      )}
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

export default function MITExplorerView({
  loadPhase, loadProgress, loadError,
  fields, tree, selectedField, books, papers, resourcesPhase,
  onInitLoad, onSelectField, onScrapeLatest,
}) {
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState('all');

  useEffect(() => {
    if (loadPhase === 'idle') onInitLoad();
  }, [loadPhase, onInitLoad]);

  // Reset filters when field changes
  useEffect(() => { setSearch(''); setLevelFilter('all'); }, [selectedField]);

  const pct = loadProgress.total > 0 ? Math.round((loadProgress.loaded / loadProgress.total) * 100) : 0;

  const rawSubfields = selectedField && tree[selectedField] ? tree[selectedField] : null;

  const filteredSubfields = useMemo(() => {
    if (!rawSubfields) return null;
    const q = search.toLowerCase().trim();
    const result = {};
    for (const [sf, specs] of Object.entries(rawSubfields)) {
      const filteredSpecs = {};
      for (const [spec, courses] of Object.entries(specs)) {
        const filtered = courses.filter(c => {
          const matchLevel = levelFilter === 'all' || c.level.toLowerCase().includes(levelFilter.toLowerCase());
          const matchSearch = !q || c.title.toLowerCase().includes(q) || c.courseNums.some(n => n.toLowerCase().includes(q));
          return matchLevel && matchSearch;
        });
        if (filtered.length > 0) filteredSpecs[spec] = filtered;
      }
      if (Object.keys(filteredSpecs).length > 0) result[sf] = filteredSpecs;
    }
    return result;
  }, [rawSubfields, search, levelFilter]);

  const totalInField = rawSubfields
    ? Object.values(rawSubfields).flatMap(sf => Object.values(sf)).reduce((s, a) => s + a.length, 0)
    : 0;

  const totalFiltered = filteredSubfields
    ? Object.values(filteredSubfields).flatMap(sf => Object.values(sf)).reduce((s, a) => s + a.length, 0)
    : 0;

  const cs = getStyle(selectedField);

  return (
    <div>
      {/* Loading */}
      {loadPhase === 'loading' && (
        <div className="mt-8 border border-stone-200 bg-white px-6 py-5">
          <div className="flex items-center gap-2.5 mb-3">
            <span className="flex gap-0.5">
              <span className="loading-dot" /><span className="loading-dot" /><span className="loading-dot" />
            </span>
            <span className="text-sm text-stone-500">
              {loadProgress.total > 0
                ? `Loading MIT OCW — ${loadProgress.loaded.toLocaleString()} / ${loadProgress.total.toLocaleString()} courses`
                : 'Connecting to MIT OCW...'}
            </span>
          </div>
          {loadProgress.total > 0 && (
            <div className="w-full bg-stone-100 h-1">
              <div className="bg-stone-700 h-1 transition-all duration-300" style={{ width: `${pct}%` }} />
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {loadPhase === 'error' && (
        <div className="mt-6 border border-red-200 bg-red-50 px-5 py-4 flex items-center justify-between">
          <p className="text-sm text-red-700">{loadError}</p>
          <button onClick={onScrapeLatest} className="text-xs font-mono text-red-600 hover:text-red-900">Retry</button>
        </div>
      )}

      {/* Empty */}
      {loadPhase === 'empty' && (
        <div className="mt-6 border border-stone-200 bg-stone-50 px-5 py-4 flex items-center justify-between">
          <p className="text-sm text-stone-500">MIT OCW returned no courses.</p>
          <a href="/api/mit-test" target="_blank" rel="noreferrer"
            className="text-xs font-mono text-stone-500 underline">Debug API</a>
        </div>
      )}

      {/* Ready */}
      {loadPhase === 'ready' && (
        <>
          {/* Field tabs */}
          <div className="flex items-center gap-2 flex-wrap mb-4">
            {fields.map(f => {
              const s = getStyle(f.field);
              const isActive = selectedField === f.field;
              return (
                <button key={f.field}
                  onClick={() => onSelectField(f.field)}
                  className={`px-3 py-1.5 text-xs font-mono border transition-colors ${isActive ? s.sel : s.unsel}`}>
                  {f.field} <span className="opacity-60">({f.count})</span>
                </button>
              );
            })}
            <button onClick={onScrapeLatest}
              className="ml-auto text-xs font-mono text-stone-400 hover:text-stone-900 border border-stone-200 px-3 py-1.5 transition-colors">
              Scrape Latest
            </button>
          </div>

          {/* Stats line */}
          <p className="text-xs font-mono text-stone-400 mb-5">
            {fields.reduce((s, f) => s + f.count, 0).toLocaleString()} courses across {fields.length} fields
            {selectedField && ` · ${totalInField.toLocaleString()} in ${selectedField}`}
            {search && ` · ${totalFiltered.toLocaleString()} matching`}
          </p>

          {!selectedField && (
            <p className="text-sm text-stone-400">
              Select a field above to explore courses by department and specialization.
              Each course shows its description from MIT OCW, prerequisites, curriculum, and books from Open Syllabus.
            </p>
          )}

          {/* Search + level filter */}
          {selectedField && (
            <div className="flex items-center gap-3 mb-4">
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={`Search ${totalInField} courses in ${selectedField}...`}
                className="flex-1 text-sm border border-stone-200 px-3 py-1.5 text-stone-800 placeholder-stone-300 focus:outline-none focus:border-stone-400"
              />
              <div className="flex text-xs font-mono">
                {['all', 'Undergraduate', 'Graduate'].map(lv => (
                  <button key={lv}
                    onClick={() => setLevelFilter(lv)}
                    className={`px-2.5 py-1.5 border-y border-r first:border-l transition-colors ${
                      levelFilter === lv
                        ? `${cs.sel} border-transparent`
                        : 'border-stone-200 text-stone-500 hover:text-stone-800'
                    }`}>
                    {lv === 'all' ? 'All' : lv}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Three-level course tree */}
          {filteredSubfields && (
            <div className="space-y-8">
              {Object.keys(filteredSubfields).length === 0 ? (
                <p className="text-sm text-stone-400">No courses match your filter.</p>
              ) : (
                <section>
                  <div className="border border-stone-200">
                    {Object.entries(filteredSubfields)
                      .map(([sf, specs]) => ({
                        sf, specs,
                        count: Object.values(specs).reduce((s, a) => s + a.length, 0),
                      }))
                      .sort((a, b) => b.count - a.count)
                      .map(({ sf, specs }) => (
                        <SubfieldBlock key={sf} name={sf} specs={specs} cs={cs} />
                      ))}
                  </div>
                </section>
              )}

              {/* Field-level books + papers */}
              {(resourcesPhase === 'loading' || books.length > 0 || papers.length > 0) && (
                <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
                  <section>
                    <div className="flex items-baseline gap-3 mb-3">
                      <h2 className="text-xs font-mono text-stone-500">
                        Top books assigned in <span className={cs.numTx}>{selectedField}</span> courses
                      </h2>
                      <span className="text-xs font-mono text-rose-300">Open Syllabus</span>
                    </div>
                    {resourcesPhase === 'loading' ? (
                      <div className="border border-stone-200 bg-white px-5 py-4">
                        <span className="flex gap-0.5"><span className="loading-dot" /><span className="loading-dot" /><span className="loading-dot" /></span>
                      </div>
                    ) : books.length > 0 ? (
                      <div className="border border-stone-200 bg-white px-5 py-1">
                        {books.map((b, i) => <ResourceRow key={i} item={b} rank={i + 1} type="book" />)}
                      </div>
                    ) : <p className="text-xs text-stone-400">No book data available.</p>}
                  </section>

                  <section>
                    <div className="flex items-baseline gap-3 mb-3">
                      <h2 className="text-xs font-mono text-stone-500">
                        Seminal papers in <span className={cs.numTx}>{selectedField}</span>
                      </h2>
                      <span className="text-xs font-mono text-teal-400">Semantic Scholar</span>
                    </div>
                    {resourcesPhase === 'loading' ? (
                      <div className="border border-stone-200 bg-white px-5 py-4">
                        <span className="flex gap-0.5"><span className="loading-dot" /><span className="loading-dot" /><span className="loading-dot" /></span>
                      </div>
                    ) : papers.length > 0 ? (
                      <div className="border border-stone-200 bg-white px-5 py-1">
                        {papers.map((p, i) => <ResourceRow key={i} item={p} rank={i + 1} type="paper" />)}
                      </div>
                    ) : <p className="text-xs text-stone-400">No paper data available.</p>}
                  </section>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
