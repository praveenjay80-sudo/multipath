import { useEffect, useState, useRef, useMemo } from 'react';
import { syllabusHarvest, seminalPapersHarvest } from '../utils/syllabusHarvest';

// ── Dark academic colour tokens (inline styles for exact shades) ──────────────
const DA = {
  bg:        '#0E0E0E',
  surface:   '#181818',
  elevated:  '#222222',
  border:    '#2E2E2E',
  borderMid: '#3A3A3A',
  text:      '#EDE8D8',
  muted:     '#7A7060',
  faint:     '#4A4438',
  gold:      '#C9A84C',
  goldDim:   '#8A6F2A',
  goldHov:   '#E8C870',
};

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

async function fetchPapersForTopic(query) {
  const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&limit=20&fields=title,authors,year,citationCount,influentialCitationCount`;
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.data || [])
      .map(p => ({
        title: p.title || '',
        authors: (p.authors || []).map(a => a.name || '').filter(Boolean).slice(0, 3).join(', '),
        year: p.year || null,
        citationCount: p.citationCount || 0,
        influentialCitationCount: p.influentialCitationCount || 0,
      }))
      .filter(p => (p.citationCount || 0) > 5)
      .sort((a, b) => (b.influentialCitationCount || b.citationCount) - (a.influentialCitationCount || a.citationCount))
      .slice(0, 12);
  } catch { return []; }
}

// ── Dark section wrapper ───────────────────────────────────────────────────────

function DSection({ label, icon, color, children }) {
  return (
    <div style={{ borderLeft: `3px solid ${color}`, background: DA.elevated, padding: '12px 16px', marginBottom: 10 }}>
      <div style={{ color, fontSize: 10, fontFamily: 'monospace', marginBottom: 8, letterSpacing: '0.08em' }}>
        {icon} {label}
      </div>
      {children}
    </div>
  );
}

// ── Per-course detail panel ───────────────────────────────────────────────────

function CourseDetailPanel({ course }) {
  const [ocw, setOcw]           = useState(null);
  const [books, setBooks]        = useState([]);
  const [papers, setPapers]      = useState([]);
  const [prereqs, setPrereqs]    = useState([]);
  const [skills, setSkills]      = useState([]);
  const [curriculum, setCurriculum] = useState([]);
  const [phase, setPhase]        = useState('loading');
  const [claudePhase, setClaudePhase] = useState('idle');
  const abort = useRef(null);

  useEffect(() => {
    abort.current = new AbortController();
    const { signal } = abort.current;

    (async () => {
      const papersQuery = course.spec && course.spec !== 'General' ? course.spec : course.title;

      const [ocwRes, bookRes, paperRes] = await Promise.allSettled([
        course.url
          ? fetch(`/api/mit-course-detail?url=${encodeURIComponent(course.url)}`, { signal })
              .then(r => r.ok ? r.json() : null).catch(() => null)
          : Promise.resolve(null),
        syllabusHarvest(course.title),
        fetchPapersForTopic(papersQuery),
      ]);

      if (signal.aborted) return;

      if (ocwRes.status === 'fulfilled') setOcw(ocwRes.value);
      if (bookRes.status === 'fulfilled') setBooks(bookRes.value.slice(0, 15));
      if (paperRes.status === 'fulfilled') setPapers(paperRes.value);
      setPhase('done');

      // Claude: prerequisites, skills, curriculum
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
            system: `You are an expert on MIT OpenCourseWare. Output ONLY the structured text below — no markdown, no bold, no preamble.

PREREQUISITES:
[every prerequisite, one per line, with MIT course numbers where applicable]

SKILLS:
[concrete competencies students gain — specific, actionable, one per line]

CURRICULUM:
[week-by-week or module-by-module breakdown, one per line]`,
            messages: [{
              role: 'user',
              content: `MIT OCW: ${course.courseNums[0] || ''} — ${course.title}\nDept: ${course.subfield}, Level: ${course.level}`,
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
            const lines = buf.split('\n'); buf = lines.pop() ?? '';
            for (const ln of lines) {
              if (!ln.startsWith('data: ')) continue;
              const d = ln.slice(6).trim();
              if (!d || d === '[DONE]') continue;
              try {
                const ev = JSON.parse(d);
                if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta') {
                  result += ev.delta.text;
                  const p = parseClaudeDetail(result);
                  setPrereqs(p.prerequisites);
                  setSkills(p.skills);
                  setCurriculum(p.curriculum);
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

  const txt = { color: DA.text, fontSize: 13, lineHeight: '1.7' };
  const mutedTxt = { color: DA.muted, fontSize: 11 };

  return (
    <div style={{ background: DA.surface, borderTop: `1px solid ${DA.border}`, padding: '16px 20px 20px', marginLeft: 24 }}>
      {phase === 'loading' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0' }}>
          <span className="flex gap-0.5"><span className="loading-dot" /><span className="loading-dot" /><span className="loading-dot" /></span>
          <span style={mutedTxt}>Loading course data...</span>
        </div>
      )}

      {/* OCW description */}
      {ocw?.description && (
        <DSection label="COURSE DESCRIPTION" icon="◈" color={DA.gold}>
          <p style={txt}>{ocw.description}</p>
        </DSection>
      )}

      {/* OCW material types */}
      {ocw?.features?.length > 0 && (
        <div style={{ marginBottom: 12, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {ocw.features.map((f, i) => (
            <span key={i} style={{ fontSize: 10, fontFamily: 'monospace', color: DA.goldDim, border: `1px solid ${DA.goldDim}`, padding: '2px 8px', letterSpacing: '0.05em' }}>
              {f}
            </span>
          ))}
        </div>
      )}

      {/* Prerequisites */}
      {prereqs.length > 0 && (
        <DSection label="PREREQUISITES" icon="←" color="#6B8FBF">
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {prereqs.map((p, i) => <li key={i} style={{ ...txt, fontSize: 12 }}>— {p}</li>)}
          </ul>
        </DSection>
      )}

      {/* Skills */}
      {skills.length > 0 && (
        <DSection label="SKILLS GAINED" icon="✓" color="#5A9E6F">
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {skills.map((s, i) => <li key={i} style={{ ...txt, fontSize: 12 }}>✓ {s}</li>)}
          </ul>
        </DSection>
      )}

      {/* Curriculum */}
      {curriculum.length > 0 && (
        <DSection label="CURRICULUM" icon="◎" color="#C47A3A">
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {curriculum.map((l, i) => <li key={i} style={{ ...txt, fontSize: 12 }}>{l}</li>)}
          </ul>
        </DSection>
      )}

      {claudePhase === 'streaming' && prereqs.length === 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span className="flex gap-0.5"><span className="loading-dot" /><span className="loading-dot" /><span className="loading-dot" /></span>
          <span style={mutedTxt}>Generating prerequisites &amp; curriculum...</span>
        </div>
      )}

      {/* Books — OpenSyllabus */}
      {phase === 'loading' ? null : books.length > 0 ? (
        <DSection label="KEY BOOKS & TEXTBOOKS — Open Syllabus" icon="▬" color="#A06090">
          <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {books.map((b, i) => (
              <li key={i} style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
                <span style={{ color: DA.faint, fontFamily: 'monospace', fontSize: 10, minWidth: 16 }}>{i + 1}</span>
                <span>
                  <span style={{ color: DA.text, fontSize: 12, fontWeight: 500 }}>{b.title}</span>
                  {b.authors && <span style={{ color: DA.muted, fontSize: 11 }}> — {b.authors}</span>}
                  {b.year && <span style={{ color: DA.faint, fontSize: 11 }}> ({b.year})</span>}
                  {b.syllabusCount > 0 && (
                    <span style={{ color: '#7A5090', fontSize: 10, fontFamily: 'monospace', marginLeft: 8 }}>
                      {b.syllabusCount.toLocaleString()} syllabi
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ol>
        </DSection>
      ) : (
        <div style={{ ...mutedTxt, marginBottom: 10 }}>No book data from Open Syllabus for this course.</div>
      )}

      {/* Papers — Semantic Scholar */}
      {phase === 'loading' ? null : papers.length > 0 ? (
        <DSection label="SEMINAL PAPERS — Semantic Scholar" icon="◉" color="#3A8A7A">
          <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {papers.map((p, i) => (
              <li key={i} style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
                <span style={{ color: DA.faint, fontFamily: 'monospace', fontSize: 10, minWidth: 16 }}>{i + 1}</span>
                <span>
                  <span style={{ color: DA.text, fontSize: 12, fontWeight: 500 }}>{p.title}</span>
                  {p.authors && <span style={{ color: DA.muted, fontSize: 11 }}> — {p.authors}</span>}
                  {p.year && <span style={{ color: DA.faint, fontSize: 11 }}> ({p.year})</span>}
                  {(p.influentialCitationCount || p.citationCount) > 0 && (
                    <span style={{ color: '#3A8A7A', fontSize: 10, fontFamily: 'monospace', marginLeft: 8 }}>
                      {(p.influentialCitationCount || p.citationCount).toLocaleString()} cites
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ol>
        </DSection>
      ) : (
        <div style={{ ...mutedTxt, marginBottom: 10 }}>No papers found for this topic.</div>
      )}

      {course.url && (
        <a href={course.url} target="_blank" rel="noreferrer"
          style={{ color: DA.goldDim, fontSize: 11, fontFamily: 'monospace', letterSpacing: '0.05em', textDecoration: 'none' }}
          onMouseEnter={e => e.target.style.color = DA.gold}
          onMouseLeave={e => e.target.style.color = DA.goldDim}>
          VIEW ON MIT OCW ↗
        </a>
      )}
    </div>
  );
}

// ── Course row ────────────────────────────────────────────────────────────────

function CourseRow({ course }) {
  const [open, setOpen] = useState(false);
  const num = course.courseNums[0] || '';
  const termStr = course.semester && course.year ? `${course.semester} ${course.year}` : course.year;

  return (
    <div style={{ borderBottom: `1px solid ${DA.border}` }}>
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', cursor: 'pointer' }}
        onClick={() => setOpen(o => !o)}
      >
        <span style={{ color: DA.faint, fontSize: 10, fontFamily: 'monospace', minWidth: 10 }}>
          {open ? '▾' : '▸'}
        </span>
        {num && (
          <span style={{ color: DA.gold, fontSize: 11, fontFamily: 'monospace', minWidth: 52, flexShrink: 0 }}>
            {num}
          </span>
        )}
        <span style={{ color: DA.text, fontSize: 13, flex: 1 }}>{course.title}</span>
        {termStr && (
          <span style={{ color: DA.faint, fontSize: 10, fontFamily: 'monospace', flexShrink: 0 }}>{termStr}</span>
        )}
        {course.url && (
          <a href={course.url} target="_blank" rel="noreferrer"
            style={{ color: DA.faint, fontSize: 11, flexShrink: 0, textDecoration: 'none' }}
            onClick={e => e.stopPropagation()}
            onMouseEnter={e => e.target.style.color = DA.muted}
            onMouseLeave={e => e.target.style.color = DA.faint}>↗</a>
        )}
      </div>
      {open && <CourseDetailPanel course={course} />}
    </div>
  );
}

// ── Specialization block (level 3) ────────────────────────────────────────────

function SpecBlock({ name, courses }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: `1px solid ${DA.border}` }}>
      <div
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', cursor: 'pointer' }}
        onClick={() => setOpen(o => !o)}
        onMouseEnter={e => e.currentTarget.style.background = DA.elevated}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        <span style={{ fontSize: 11, fontFamily: 'monospace', color: DA.goldDim, letterSpacing: '0.04em' }}>{name}</span>
        <span style={{ fontSize: 10, fontFamily: 'monospace', color: DA.faint }}>
          {courses.length} {open ? '▾' : '▸'}
        </span>
      </div>
      {open && (
        <div style={{ paddingLeft: 32, paddingRight: 16, paddingBottom: 4, background: DA.surface }}>
          {courses.map((c, i) => <CourseRow key={c.id || i} course={c} />)}
        </div>
      )}
    </div>
  );
}

// ── Subfield / department block (level 2) ─────────────────────────────────────

function SubfieldBlock({ name, specs }) {
  const [open, setOpen] = useState(false);
  const total = Object.values(specs).reduce((s, a) => s + a.length, 0);
  return (
    <div style={{ borderBottom: `1px solid ${DA.border}` }}>
      <div
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', cursor: 'pointer', background: DA.elevated }}
        onClick={() => setOpen(o => !o)}
        onMouseEnter={e => e.currentTarget.style.background = '#292929'}
        onMouseLeave={e => e.currentTarget.style.background = DA.elevated}
      >
        <span style={{ color: DA.text, fontSize: 14, fontWeight: 500 }}>{name}</span>
        <span style={{ color: DA.muted, fontSize: 11, fontFamily: 'monospace' }}>
          {total} courses {open ? '▾' : '▸'}
        </span>
      </div>
      {open && (
        <div style={{ background: DA.surface }}>
          {Object.entries(specs)
            .sort(([, a], [, b]) => b.length - a.length)
            .map(([spec, courses]) => (
              <SpecBlock key={spec} name={spec} courses={courses} />
            ))}
        </div>
      )}
    </div>
  );
}

// ── Field-level resource row ───────────────────────────────────────────────────

function ResourceRow({ item, rank, type }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, padding: '10px 0', borderBottom: `1px solid ${DA.border}` }}>
      <span style={{ color: DA.faint, fontFamily: 'monospace', fontSize: 10, minWidth: 20 }}>{rank}</span>
      <div style={{ flex: 1 }}>
        <span style={{ color: DA.text, fontSize: 13 }}>{item.title}</span>
        {item.authors && <span style={{ color: DA.muted, fontSize: 11, marginLeft: 8 }}>— {item.authors}</span>}
        {item.year && <span style={{ color: DA.faint, fontSize: 11, marginLeft: 6 }}>({item.year})</span>}
      </div>
      {type === 'book' && item.syllabusCount > 0 && (
        <span style={{ color: '#7A5090', fontFamily: 'monospace', fontSize: 10, flexShrink: 0 }}>
          {item.syllabusCount.toLocaleString()} syllabi
        </span>
      )}
      {type === 'paper' && (item.influentialCitationCount || item.citationCount) > 0 && (
        <span style={{ color: '#3A8A7A', fontFamily: 'monospace', fontSize: 10, flexShrink: 0 }}>
          {(item.influentialCitationCount || item.citationCount).toLocaleString()} cites
        </span>
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

  const root = { background: DA.bg, minHeight: '100%', padding: '8px 0', color: DA.text };
  const label = { color: DA.muted, fontSize: 10, fontFamily: 'monospace', letterSpacing: '0.08em' };

  return (
    <div style={root}>
      {/* Loading */}
      {loadPhase === 'loading' && (
        <div style={{ background: DA.surface, border: `1px solid ${DA.border}`, padding: '20px 24px', marginTop: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <span className="flex gap-0.5"><span className="loading-dot" /><span className="loading-dot" /><span className="loading-dot" /></span>
            <span style={{ color: DA.muted, fontSize: 13 }}>
              {loadProgress.total > 0
                ? `Loading MIT OCW — ${loadProgress.loaded.toLocaleString()} / ${loadProgress.total.toLocaleString()} courses`
                : 'Connecting to MIT OCW...'}
            </span>
          </div>
          {loadProgress.total > 0 && (
            <div style={{ background: DA.elevated, height: 2 }}>
              <div style={{ background: DA.gold, height: 2, width: `${pct}%`, transition: 'width 0.3s' }} />
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {loadPhase === 'error' && (
        <div style={{ border: '1px solid #4A2A2A', background: '#1A0A0A', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#C06060', fontSize: 13 }}>{loadError}</span>
          <button onClick={onScrapeLatest} style={{ color: '#C06060', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'monospace', fontSize: 11 }}>Retry</button>
        </div>
      )}

      {/* Ready */}
      {loadPhase === 'ready' && (
        <>
          {/* Field tabs */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, marginBottom: 24, borderBottom: `1px solid ${DA.border}`, paddingBottom: 0 }}>
            {fields.map(f => {
              const active = selectedField === f.field;
              return (
                <button key={f.field}
                  onClick={() => onSelectField(f.field)}
                  style={{
                    padding: '8px 16px',
                    background: 'none',
                    border: 'none',
                    borderBottom: active ? `2px solid ${DA.gold}` : '2px solid transparent',
                    color: active ? DA.gold : DA.muted,
                    fontFamily: 'monospace',
                    fontSize: 11,
                    letterSpacing: '0.06em',
                    cursor: 'pointer',
                    marginBottom: -1,
                    transition: 'color 0.15s',
                  }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.color = DA.text; }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.color = DA.muted; }}>
                  {f.field.toUpperCase()} <span style={{ opacity: 0.5 }}>({f.count})</span>
                </button>
              );
            })}
            <button onClick={onScrapeLatest}
              style={{ marginLeft: 'auto', background: 'none', border: `1px solid ${DA.border}`, color: DA.faint, fontFamily: 'monospace', fontSize: 10, padding: '4px 12px', cursor: 'pointer', letterSpacing: '0.05em' }}
              onMouseEnter={e => e.currentTarget.style.color = DA.muted}
              onMouseLeave={e => e.currentTarget.style.color = DA.faint}>
              SCRAPE LATEST
            </button>
          </div>

          {/* Stats */}
          <div style={{ ...label, marginBottom: 20 }}>
            {fields.reduce((s, f) => s + f.count, 0).toLocaleString()} courses · {fields.length} fields
            {selectedField && ` · ${totalInField.toLocaleString()} in ${selectedField.toUpperCase()}`}
          </div>

          {!selectedField && (
            <p style={{ color: DA.muted, fontSize: 13, lineHeight: 1.7 }}>
              Select a field above to browse courses by department and specialization.
              Each course expands to show its description from MIT OCW, prerequisites, curriculum, key textbooks from Open Syllabus, and seminal papers from Semantic Scholar.
            </p>
          )}

          {/* Search + level filter */}
          {selectedField && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={`Search ${totalInField} courses...`}
                style={{
                  flex: 1, background: DA.surface, border: `1px solid ${DA.border}`, color: DA.text,
                  padding: '8px 14px', fontSize: 13, outline: 'none', fontFamily: 'inherit',
                }}
                onFocus={e => e.target.style.borderColor = DA.goldDim}
                onBlur={e => e.target.style.borderColor = DA.border}
              />
              <div style={{ display: 'flex' }}>
                {['all', 'Undergraduate', 'Graduate'].map(lv => (
                  <button key={lv}
                    onClick={() => setLevelFilter(lv)}
                    style={{
                      background: levelFilter === lv ? DA.goldDim : 'none',
                      border: `1px solid ${DA.border}`,
                      borderRight: lv === 'Graduate' ? `1px solid ${DA.border}` : 'none',
                      color: levelFilter === lv ? DA.bg : DA.muted,
                      fontFamily: 'monospace', fontSize: 10, padding: '6px 12px',
                      cursor: 'pointer', letterSpacing: '0.05em',
                    }}>
                    {lv === 'all' ? 'ALL' : lv.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Three-level tree */}
          {filteredSubfields && (
            <div>
              {Object.keys(filteredSubfields).length === 0 ? (
                <p style={{ color: DA.muted, fontSize: 13 }}>No courses match your filter.</p>
              ) : (
                <div style={{ border: `1px solid ${DA.border}`, marginBottom: 40 }}>
                  {Object.entries(filteredSubfields)
                    .map(([sf, specs]) => ({ sf, specs, count: Object.values(specs).reduce((s, a) => s + a.length, 0) }))
                    .sort((a, b) => b.count - a.count)
                    .map(({ sf, specs }) => (
                      <SubfieldBlock key={sf} name={sf} specs={specs} />
                    ))}
                </div>
              )}

              {/* Field-level books + papers — always shown when field selected */}
              {selectedField && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 32 }}>
                  <section>
                    <div style={{ ...label, marginBottom: 12 }}>
                      TOP BOOKS IN {selectedField.toUpperCase()} — <span style={{ color: '#7A5090' }}>OPEN SYLLABUS</span>
                    </div>
                    {resourcesPhase === 'loading' ? (
                      <div style={{ background: DA.surface, border: `1px solid ${DA.border}`, padding: '16px 20px' }}>
                        <span className="flex gap-0.5"><span className="loading-dot" /><span className="loading-dot" /><span className="loading-dot" /></span>
                      </div>
                    ) : books.length > 0 ? (
                      <div style={{ background: DA.surface, border: `1px solid ${DA.border}`, padding: '4px 20px' }}>
                        {books.map((b, i) => <ResourceRow key={i} item={b} rank={i + 1} type="book" />)}
                      </div>
                    ) : (
                      <div style={{ background: DA.surface, border: `1px solid ${DA.border}`, padding: '16px 20px' }}>
                        <span style={{ color: DA.faint, fontSize: 12 }}>No book data from Open Syllabus for this field.</span>
                      </div>
                    )}
                  </section>

                  <section>
                    <div style={{ ...label, marginBottom: 12 }}>
                      SEMINAL PAPERS IN {selectedField.toUpperCase()} — <span style={{ color: '#3A8A7A' }}>SEMANTIC SCHOLAR</span>
                    </div>
                    {resourcesPhase === 'loading' ? (
                      <div style={{ background: DA.surface, border: `1px solid ${DA.border}`, padding: '16px 20px' }}>
                        <span className="flex gap-0.5"><span className="loading-dot" /><span className="loading-dot" /><span className="loading-dot" /></span>
                      </div>
                    ) : papers.length > 0 ? (
                      <div style={{ background: DA.surface, border: `1px solid ${DA.border}`, padding: '4px 20px' }}>
                        {papers.map((p, i) => <ResourceRow key={i} item={p} rank={i + 1} type="paper" />)}
                      </div>
                    ) : (
                      <div style={{ background: DA.surface, border: `1px solid ${DA.border}`, padding: '16px 20px' }}>
                        <span style={{ color: DA.faint, fontSize: 12 }}>No paper data from Semantic Scholar for this field.</span>
                      </div>
                    )}
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
