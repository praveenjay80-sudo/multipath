import { useState, useMemo, useCallback, useRef } from 'react';
import { TOPSCI_FIELDS, TOPSCI_FIELD_SUBFIELDS, TOPSCI_ALL_SUBFIELDS, TOPSCI_COUNTRIES } from '../constants/topSciFacets.js';

const WORKER_BASE = 'https://canon-enrichment.canonworks.workers.dev';

const YEARS = ['2024', '2023', '2022', '2021', '2020'];

const SORT_OPTIONS = [
  { key: 'rank',      label: 'Rank (composite score)', defaultDir: 'asc'  },
  { key: 'citations', label: 'Total Citations',         defaultDir: 'desc' },
  { key: 'hindex',    label: 'H-index',                 defaultDir: 'desc' },
  { key: 'hmindex',   label: 'HM-index (co-author adj.)', defaultDir: 'desc' },
  { key: 'papers',    label: 'Papers Count',             defaultDir: 'desc' },
  { key: 'composite', label: 'Composite Score (c)',      defaultDir: 'desc' },
  { key: 'selfpct',   label: 'Self-citation %',          defaultDir: 'asc'  },
];

const MODES = [
  { key: 'canon',        label: 'Canon',          color: 'text-blue-700    bg-blue-50    hover:bg-blue-100    border-blue-200'    },
  { key: 'curriculum',   label: 'Curriculum',     color: 'text-sky-700     bg-sky-50     hover:bg-sky-100     border-sky-200'     },
  { key: 'dissertation', label: 'Dissertation',   color: 'text-indigo-700  bg-indigo-50  hover:bg-indigo-100  border-indigo-200'  },
  { key: 'reverse',      label: 'Prerequisites',  color: 'text-violet-700  bg-violet-50  hover:bg-violet-100  border-violet-200'  },
  { key: 'intelligence', label: 'Field Intel',    color: 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-200' },
  { key: 'overall',      label: 'Overall',        color: 'text-stone-700   bg-stone-50   hover:bg-stone-100   border-stone-200'   },
];

const ExternalIcon = () => (
  <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
    <path d="M5 2H2a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    <path d="M8 1h3m0 0v3m0-3L5.5 6.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

function pseUrl(year, type, id) {
  return `https://www.pasanhu.cn/WorldTopScientists.aspx?year=${year}&type=${type}&id=${id}`;
}
function scholarProfileSearchUrl(name) {
  return `https://scholar.google.com/scholar?q=${encodeURIComponent(name)}`;
}
function fmtNum(n) {
  return n == null ? '—' : n.toLocaleString();
}

// ── Bio + publications cache (module-level, mirrors ScienceDirectView's pattern) ──
const bioCache = new Map();
const pubCache = new Map();
const detailCache = new Map();

async function fetchBio(name, inst, field, subfield) {
  const cacheKey = name;
  if (bioCache.has(cacheKey)) return bioCache.get(cacheKey);
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
        max_tokens: 220,
        system: `You are a research encyclopedia. Given a scientist's name, institution, and research field/subfield, write a brief (2-3 sentence, under 60 words) plausible scientific bio describing their likely research focus and contribution, grounded only in the field/subfield given. If you have genuine knowledge of this specific person, use it; otherwise describe the kind of work a senior researcher in that subfield typically does — never fabricate specific claims, dates, awards, or paper titles you are not confident about. Respond with the bio text only, no preamble.`,
        messages: [{ role: 'user', content: `Name: ${name}\nInstitution: ${inst || 'unknown'}\nField: ${field}\nSubfield: ${subfield || 'unknown'}` }],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const bio = data.content?.[0]?.text?.trim() || null;
    if (bio) bioCache.set(cacheKey, bio);
    return bio;
  } catch { return null; }
}

async function fetchPublications(name, apiKey, skipCache = false) {
  if (!skipCache && pubCache.has(name)) return pubCache.get(name);
  try {
    const params = new URLSearchParams({ q: name, num: '10' });
    if (apiKey) params.set('key', apiKey);
    const res = await fetch(`${WORKER_BASE}/scholar-search?${params}`);
    const data = await res.json().catch(() => null);
    if (!res.ok || !Array.isArray(data)) return { ok: false, results: [] };
    const sorted = [...data].sort((a, b) => (b.citationCount || 0) - (a.citationCount || 0));
    const out = { ok: true, results: sorted.slice(0, 8) };
    pubCache.set(name, out);
    return out;
  } catch { return { ok: false, results: [] }; }
}

function ScholarKeyPrompt({ onSaved }) {
  const hasSavedKey = !!localStorage.getItem('canon_serp_key');
  const [draft, setDraft] = useState(() => localStorage.getItem('canon_serp_key') || '');
  const [saving, setSaving] = useState(false);

  async function save() {
    const v = draft.trim();
    if (!v) return;
    localStorage.setItem('canon_serp_key', v);
    setSaving(true);
    await onSaved(v);
    setSaving(false);
  }

  return (
    <div className="mt-1">
      <p className="text-xs text-stone-400 mb-1.5">
        {hasSavedKey
          ? 'A saved SerpAPI key still failed — the shared quota is exhausted and this key may need checking.'
          : 'The shared Google Scholar lookup is quota-limited. Add your own SerpAPI key to see results.'}
      </p>
      <div className="flex gap-1.5">
        <input
          type="password" value={draft} onChange={e => setDraft(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && save()}
          placeholder="serpapi key..."
          className="flex-1 px-2 py-1 text-xs border border-stone-200 bg-white text-stone-900 placeholder-stone-300 focus:outline-none focus:border-stone-700 font-mono"
        />
        <button onClick={save} disabled={!draft.trim() || saving}
          className="px-3 py-1 text-xs bg-stone-900 text-white hover:bg-stone-700 disabled:opacity-40 transition-colors shrink-0">
          {saving ? 'Checking…' : 'Save'}
        </button>
      </div>
    </div>
  );
}

async function fetchDetail(year, type, id) {
  const cacheKey = `${year}::${type}::${id}`;
  if (detailCache.has(cacheKey)) return detailCache.get(cacheKey);
  try {
    const params = new URLSearchParams({ year, type, id: String(id) });
    const res = await fetch(`/api/topsci/detail?${params}`);
    const data = await res.json();
    if (!res.ok) return null;
    detailCache.set(cacheKey, data.record);
    return data.record;
  } catch { return null; }
}

// Fields worth surfacing prominently from the full detail record (rest still
// shown, just lower priority) — description text comes straight from pasanhu.cn.
const DETAIL_HIGHLIGHT_FIELDS = ['rank (ns)', 'c (ns)', 'h24 (ns)', 'hm24 (ns)', 'self%', 'firstyr', 'lastyr'];

function ModePicker({ topic, onSelect, onClose }) {
  return (
    <div className="px-4 pb-3 pt-2 bg-stone-50 border-t border-stone-100">
      <p className="text-xs text-stone-400 mb-2 font-mono">Explore "{topic}" with:</p>
      <div className="flex flex-wrap gap-1.5">
        {MODES.map(m => (
          <button
            key={m.key}
            onClick={() => { onClose(); onSelect(topic, m.key); }}
            className={`text-xs px-2 py-1 border rounded-sm transition-colors ${m.color}`}
          >
            {m.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ScientistDetail({ row, year, type, onSelect }) {
  const [bio, setBio] = useState(bioCache.get(row.authfull) || null);
  const [bioLoading, setBioLoading] = useState(false);
  const [pubs, setPubs] = useState(pubCache.get(row.authfull) || null);
  const [pubsLoading, setPubsLoading] = useState(false);
  const [detail, setDetail] = useState(detailCache.get(`${year}::${type}::${row.id}`) || null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showModePicker, setShowModePicker] = useState(false);
  const fetchedRef = useRef(false);

  if (!fetchedRef.current) {
    fetchedRef.current = true;
    setBioLoading(true);
    fetchBio(row.authfull, row.inst_name, row.field, row.subfield1).then(b => { setBio(b); setBioLoading(false); });
    setPubsLoading(true);
    fetchPublications(row.authfull, localStorage.getItem('canon_serp_key') || '').then(p => { setPubs(p); setPubsLoading(false); });
    setDetailLoading(true);
    fetchDetail(year, type, row.id).then(d => { setDetail(d); setDetailLoading(false); });
  }

  async function retryPubsWithKey(key) {
    setPubsLoading(true);
    const p = await fetchPublications(row.authfull, key, true);
    setPubs(p);
    setPubsLoading(false);
  }

  const highlights = useMemo(() => {
    if (!detail) return [];
    return detail.filter(f => DETAIL_HIGHLIGHT_FIELDS.includes(f.field));
  }, [detail]);

  return (
    <div className="pl-6 pr-4 pb-4 pt-1 space-y-4 bg-stone-50 border-t border-stone-100">
      {/* Bio */}
      <div>
        <p className="text-xs font-mono text-stone-400 mb-1">Scientific Bio</p>
        {bioLoading && <p className="text-xs text-stone-300 italic font-mono">loading…</p>}
        {!bioLoading && bio && <p className="text-xs text-stone-600 leading-relaxed">{bio}</p>}
        {!bioLoading && !bio && (
          <p className="text-xs text-stone-300 italic">Set an Anthropic API key above to generate a bio.</p>
        )}
      </div>

      {/* Metrics */}
      <div>
        <p className="text-xs font-mono text-stone-400 mb-1">Key Metrics</p>
        {detailLoading && <p className="text-xs text-stone-300 italic font-mono">loading…</p>}
        {!detailLoading && highlights.length > 0 && (
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {highlights.map(f => (
              <span key={f.field} className="text-xs text-stone-500" title={f.description}>
                <span className="font-semibold text-stone-700">{f.value}</span> {f.description}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Most cited publications */}
      <div>
        <p className="text-xs font-mono text-stone-400 mb-1">Most Cited Publications</p>
        {pubsLoading && <p className="text-xs text-stone-300 italic font-mono">loading…</p>}
        {!pubsLoading && pubs?.ok && pubs.results.length > 0 && (
          <div className="space-y-1.5">
            {pubs.results.map((p, i) => (
              <div key={i} className="text-xs">
                <a href={p.link || scholarProfileSearchUrl(p.title)} target="_blank" rel="noreferrer"
                  className="text-blue-700 hover:underline">{p.title}</a>
                {p.citationCount != null && (
                  <span className="text-stone-400 font-mono ml-1.5">{p.citationCount.toLocaleString()} cit.</span>
                )}
              </div>
            ))}
          </div>
        )}
        {!pubsLoading && (!pubs?.ok || pubs.results.length === 0) && (
          <ScholarKeyPrompt onSaved={retryPubsWithKey} />
        )}
      </div>

      {/* Links + mode picker */}
      <div className="flex items-center gap-4 pt-1">
        <a href={pseUrl(year, type, row.id)} target="_blank" rel="noreferrer"
          className="text-xs text-stone-400 hover:text-blue-600 flex items-center gap-1 font-mono">
          View on PASE <ExternalIcon />
        </a>
        <a href={scholarProfileSearchUrl(row.authfull)} target="_blank" rel="noreferrer"
          className="text-xs text-stone-400 hover:text-blue-600 flex items-center gap-1 font-mono">
          Google Scholar <ExternalIcon />
        </a>
        <button onClick={() => setShowModePicker(s => !s)} className="text-xs text-stone-400 hover:text-stone-700 font-mono">
          Explore field ▾
        </button>
      </div>
      {showModePicker && (
        <ModePicker topic={row.subfield1 || row.field} onSelect={onSelect} onClose={() => setShowModePicker(false)} />
      )}
    </div>
  );
}

function ScientistRow({ row, rank, year, type, onSelect }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-stone-100 last:border-0">
      <div
        className="flex items-center gap-3 px-3 py-2.5 hover:bg-stone-50 cursor-pointer transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <span className="text-xs font-mono text-stone-300 w-10 shrink-0 tabular-nums">{fmtNum(rank)}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-stone-800 font-medium truncate">{row.authfull}</p>
          <p className="text-xs text-stone-400 truncate">{row.inst_name || '—'} {row.cntry ? `· ${row.cntry.toUpperCase()}` : ''}</p>
        </div>
        <div className="hidden md:block text-xs text-stone-400 w-56 shrink-0 truncate" title={`${row.field} / ${row.subfield1}`}>
          {row.subfield1 || row.field}
        </div>
        <div className="flex gap-3 shrink-0 text-xs font-mono text-stone-500 tabular-nums">
          <span title="Citations">{fmtNum(row.citations)}c</span>
          <span title="H-index">h{fmtNum(row.hindex)}</span>
        </div>
      </div>
      {open && <ScientistDetail row={row} year={year} type={type} onSelect={onSelect} />}
    </div>
  );
}

function FilterSelect({ label, value, onChange, options, disabled }) {
  return (
    <div>
      <label className="block text-xs font-mono text-stone-400 mb-1">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        className="w-full border border-stone-300 px-2 py-1.5 text-xs text-stone-700 bg-white focus:outline-none focus:border-stone-500 disabled:opacity-50"
      >
        {options}
      </select>
    </div>
  );
}

export default function TopScientistsView({ status, filters, rows, count, capped, error, page, totalPages, onLoad, onSetFilters, onGoToPage, onSelect }) {
  const [authInput, setAuthInput] = useState(filters.authfull);
  const [instInput, setInstInput] = useState(filters.inst_name);

  const subfield1Options = filters.sm_field ? (TOPSCI_FIELD_SUBFIELDS[filters.sm_field] || []) : TOPSCI_ALL_SUBFIELDS;

  const handleSortChange = useCallback((sortBy) => {
    const opt = SORT_OPTIONS.find(o => o.key === sortBy);
    onSetFilters({ sortBy, sortDir: opt?.defaultDir || 'desc' });
  }, [onSetFilters]);

  const submitTextFilters = useCallback(() => {
    onSetFilters({ authfull: authInput.trim(), inst_name: instInput.trim() });
  }, [authInput, instInput, onSetFilters]);

  if (status === 'idle') {
    return (
      <div className="mt-8 flex flex-col items-center gap-4 py-12">
        <p className="text-stone-400 text-sm font-mono">World's Top 2% Scientists — live from pasanhu.cn (Stanford/Elsevier dataset)</p>
        <button onClick={onLoad} className="px-6 py-2.5 bg-stone-900 text-white text-sm font-mono hover:bg-stone-700 transition-colors">
          Load Top Scientists
        </button>
      </div>
    );
  }

  return (
    <div className="mt-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-2xl font-bold font-mono text-stone-900 tabular-nums">{count.toLocaleString()}</span>
          <span className="text-sm text-stone-500">scientists matching filters</span>
        </div>
        <a href="https://www.pasanhu.cn/WorldTopScientists.aspx" target="_blank" rel="noreferrer"
          className="text-xs text-stone-400 hover:text-blue-600 transition-colors font-mono flex items-center gap-1">
          PASE <ExternalIcon />
        </a>
      </div>

      {capped && (
        <div className="mb-4 border border-amber-200 bg-amber-50 p-3 rounded text-xs text-amber-700 font-mono">
          Custom sort is limited to the top 30,000 by composite score under current filters — narrow by Field or Subfield for an exact sort across all matches.
        </div>
      )}

      {/* Filters */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <FilterSelect label="Year" value={filters.year} onChange={v => onSetFilters({ year: v })}
          options={YEARS.map(y => <option key={y} value={y}>{y}</option>)} />
        <FilterSelect label="Type" value={filters.type} onChange={v => onSetFilters({ type: v })}
          options={[<option key="" value="">Single Year</option>, <option key="c" value="CAREER">Career</option>]} />
        <FilterSelect label="Field" value={filters.sm_field} onChange={v => onSetFilters({ sm_field: v })}
          options={[<option key="" value="">All fields</option>, ...TOPSCI_FIELDS.map(f => <option key={f} value={f}>{f}</option>)]} />
        <FilterSelect label="Subfield" value={filters.sm_subfield_1} onChange={v => onSetFilters({ sm_subfield_1: v })}
          options={[<option key="" value="">All subfields</option>, ...subfield1Options.map(s => <option key={s} value={s}>{s}</option>)]} />
        <FilterSelect label="Secondary Subfield" value={filters.sm_subfield_2} onChange={v => onSetFilters({ sm_subfield_2: v })}
          options={[<option key="" value="">Any</option>, ...TOPSCI_ALL_SUBFIELDS.map(s => <option key={s} value={s}>{s}</option>)]} />
        <FilterSelect label="Country" value={filters.cntry} onChange={v => onSetFilters({ cntry: v })}
          options={[<option key="" value="">All countries</option>, ...TOPSCI_COUNTRIES.map(c => <option key={c} value={c}>{c.toUpperCase()}</option>)]} />
        <FilterSelect label="Sort By" value={filters.sortBy} onChange={handleSortChange}
          options={SORT_OPTIONS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)} />
        <FilterSelect label="Direction" value={filters.sortDir} onChange={v => onSetFilters({ sortDir: v })}
          options={[<option key="desc" value="desc">Highest first</option>, <option key="asc" value="asc">Lowest first</option>]} />
      </div>

      <div className="flex gap-3 mb-5">
        <input
          type="text" value={authInput} onChange={e => setAuthInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submitTextFilters()}
          placeholder="Author name (Last, First)…"
          className="flex-1 border border-stone-300 px-3 py-2 text-sm text-stone-700 placeholder-stone-300 focus:outline-none focus:border-stone-500"
        />
        <input
          type="text" value={instInput} onChange={e => setInstInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submitTextFilters()}
          placeholder="Institution…"
          className="flex-1 border border-stone-300 px-3 py-2 text-sm text-stone-700 placeholder-stone-300 focus:outline-none focus:border-stone-500"
        />
        <button onClick={submitTextFilters} className="px-4 py-2 text-sm bg-stone-900 text-white hover:bg-stone-700 transition-colors shrink-0">
          Search
        </button>
      </div>

      {status === 'loading' && (
        <div className="flex items-center gap-3 text-stone-400 py-12 justify-center">
          <span className="flex gap-0.5"><span className="loading-dot"/><span className="loading-dot"/><span className="loading-dot"/></span>
          <span className="text-sm font-mono">Loading…</span>
        </div>
      )}

      {status === 'error' && (
        <div className="text-red-600 text-sm py-8 text-center font-mono">{error}</div>
      )}

      {status === 'complete' && (
        <>
          <div className="border border-stone-200 rounded">
            {rows.length === 0 && (
              <p className="text-sm text-stone-400 font-mono py-8 text-center">No scientists match these filters</p>
            )}
            {rows.map((row, i) => (
              <ScientistRow
                key={row.id}
                row={row}
                rank={filters.sortBy === 'rank' && filters.sortDir === 'asc' ? row.rank : (page - 1) * 25 + i + 1}
                year={filters.year}
                type={filters.type}
                onSelect={onSelect}
              />
            ))}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-center gap-4 mt-5">
            <button
              onClick={() => onGoToPage(page - 1)}
              disabled={page <= 1}
              className="text-xs font-mono text-stone-500 hover:text-stone-900 disabled:opacity-30 transition-colors"
            >
              ← Prev
            </button>
            <span className="text-xs font-mono text-stone-400">Page {page.toLocaleString()} of {totalPages.toLocaleString()}</span>
            <button
              onClick={() => onGoToPage(page + 1)}
              disabled={page >= totalPages}
              className="text-xs font-mono text-stone-500 hover:text-stone-900 disabled:opacity-30 transition-colors"
            >
              Next →
            </button>
          </div>
        </>
      )}
    </div>
  );
}
