import express from 'express';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

function withTimeout(ms) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  return { signal: ctrl.signal, clear: () => clearTimeout(id) };
}

// ── LCSH proxy (id.loc.gov) ───────────────────────────────────────────────────

function lcshLabel(nodes, id) {
  const uri  = 'http://id.loc.gov/authorities/subjects/' + id;
  const node = nodes.find(x => x['@id'] === uri);
  return (
    node?.['http://www.w3.org/2004/02/skos/core#prefLabel']?.[0]?.['@value'] ||
    node?.['http://www.loc.gov/mads/rdf/v1#authoritativeLabel']?.[0]?.['@value'] ||
    null
  );
}

async function fetchLcshConcept(id, signal) {
  const uri = 'http://id.loc.gov/authorities/subjects/' + id;
  const r = await fetch(`https://id.loc.gov/authorities/subjects/${id}.skos.json`, { signal });
  if (!r.ok) throw new Error(`LCSH HTTP ${r.status}`);
  const nodes = await r.json();
  const main  = nodes.find(x => x['@id'] === uri);
  const label = lcshLabel(nodes, id);
  const narrowerIds = (main?.['http://www.w3.org/2004/02/skos/core#narrower'] || [])
    .map(n => n['@id'].replace('http://id.loc.gov/authorities/subjects/', ''))
    .slice(0, 40);
  return { label, narrowerIds };
}

app.get('/api/lcsh/:id', async (req, res) => {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const { label, narrowerIds } = await fetchLcshConcept(req.params.id, ctrl.signal);

    // Fetch narrower labels in parallel
    const narrower = await Promise.all(narrowerIds.map(async nid => {
      try {
        const r = await fetch(`https://id.loc.gov/authorities/subjects/${nid}.skos.json`, { signal: ctrl.signal });
        if (!r.ok) return { id: nid, label: nid };
        const nodes = await r.json();
        return { id: nid, label: lcshLabel(nodes, nid) || nid };
      } catch { return { id: nid, label: nid }; }
    }));

    clearTimeout(timer);
    res.json({ label, narrower: narrower.filter(n => !n.label.includes('--')) });
  } catch (e) {
    clearTimeout(timer);
    res.status(502).json({ error: e.message });
  }
});

// ── USP Vocabulary proxy (vocabusp.abcd.usp.br) ──────────────────────────────

const HTML_ENTITIES = {
  Agrave:'À',agrave:'à',Aacute:'Á',aacute:'á',Acirc:'Â',acirc:'â',Atilde:'Ã',atilde:'ã',
  Auml:'Ä',auml:'ä',Ccedil:'Ç',ccedil:'ç',Egrave:'È',egrave:'è',Eacute:'É',eacute:'é',
  Ecirc:'Ê',ecirc:'ê',Euml:'Ë',euml:'ë',Iacute:'Í',iacute:'í',Icirc:'Î',icirc:'î',
  Ntilde:'Ñ',ntilde:'ñ',Oacute:'Ó',oacute:'ó',Ocirc:'Ô',ocirc:'ô',Otilde:'Õ',otilde:'õ',
  Ouml:'Ö',ouml:'ö',Uacute:'Ú',uacute:'ú',Ucirc:'Û',ucirc:'û',Uuml:'Ü',uuml:'ü',
  amp:'&',lt:'<',gt:'>',quot:'"',nbsp:' ',
};

function decodeHtml(s = '') {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/&([A-Za-z]+);/g, (m, e) => HTML_ENTITIES[e] || m)
    .trim();
}

// Parse ARV page → return children of parentCode
function parseArv(html, parentCode) {
  const parentDepth = parentCode.split('.').length;
  const results = [];
  const re = /<A [^>]*HREF="[^"]*ARV\?HIER=([^"&]+)"[^>]*>[^<]*<\/A>\s*([^<\r\n]*)/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const code  = m[1].trim();
    const label = decodeHtml(m[2].replace(/-\s*/, '').trim());
    const depth = code.split('.').length;
    if (depth === parentDepth + 1 && code.startsWith(parentCode + '.') && label) {
      results.push({ code, label });
    }
  }
  return results;
}

// Parse Mac page → grouped domains with level-1 fields
function parseMac(html) {
  const domains = [];
  let current = null;

  // Split on H4/H5 headings and ARV links
  const re = /(<H[45][^>]*>([^<]+)<\/H[45]>)|(<A [^>]*HREF="[^"]*ARV\?Hier=([^"&]+)"[^>]*>[^<]*<\/A>([^<\r\n]*))/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    if (m[1]) {
      // Heading — new domain group
      const raw = decodeHtml(m[2]);
      const match = raw.match(/^([A-Z]{2}\d+)\s+(.*)/);
      if (match) {
        current = { code: match[1], label: match[2].trim(), fields: [] };
        domains.push(current);
      }
    } else if (m[3] && current) {
      // ARV link — level-1 field under current domain
      const code  = m[4].trim();
      const label = decodeHtml(m[5].replace(/-\s*/, '').trim());
      if (label) current.fields.push({ code, label });
    }
  }
  return domains;
}

app.get('/api/usp/mac', async (req, res) => {
  const { signal, clear } = withTimeout(10000);
  try {
    const r = await fetch('https://vocabusp.abcd.usp.br/Vocab/Sibix652.dll/Mac', {
      signal, headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    clear();
    const html = await r.text();
    res.json(parseMac(html));
  } catch (e) {
    clear();
    res.status(502).json({ error: e.message });
  }
});

app.get('/api/usp/arv', async (req, res) => {
  const code = req.query.code || '';
  const { signal, clear } = withTimeout(10000);
  try {
    const r = await fetch(`https://vocabusp.abcd.usp.br/Vocab/Sibix652.dll/ARV?HIER=${encodeURIComponent(code)}`, {
      signal, headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    clear();
    const html = await r.text();
    res.json(parseArv(html, code));
  } catch (e) {
    clear();
    res.status(502).json({ error: e.message });
  }
});

// ── GND proxy (lobid.org) ─────────────────────────────────────────────────────

app.get('/api/gnd/search', async (req, res) => {
  const { signal, clear } = withTimeout(8000);
  try {
    const qs = new URLSearchParams(req.query).toString();
    const r = await fetch(`https://lobid.org/gnd/search?${qs}`, { signal });
    clear();
    const json = await r.json();
    res.json(json);
  } catch (e) {
    clear();
    res.status(502).json({ error: e.message });
  }
});

app.get('/api/gnd/:id', async (req, res) => {
  const { signal, clear } = withTimeout(8000);
  try {
    const r = await fetch(`https://lobid.org/gnd/${req.params.id}?format=json`, { signal });
    clear();
    const json = await r.json();
    res.json(json);
  } catch (e) {
    clear();
    res.status(502).json({ error: e.message });
  }
});

// ── Wikidata SPARQL proxy ─────────────────────────────────────────────────────

app.get('/api/sparql', async (req, res) => {
  const { signal, clear } = withTimeout(10000);
  try {
    const query = req.query.query || '';
    const r = await fetch(
      `https://query.wikidata.org/sparql?query=${encodeURIComponent(query)}&format=json`,
      { signal, headers: { 'User-Agent': 'Canon/1.0 (https://canon-production-75f6.up.railway.app)' } }
    );
    clear();
    const json = await r.json();
    res.json(json);
  } catch (e) {
    clear();
    res.status(502).json({ error: e.message });
  }
});

// ── UDC New Terms proxy (eth-udk.library.ethz.ch) ────────────────────────────

function parseUdcNewTerms(html) {
  const allMatches = [];

  const dateRe = /Added ([^\n<]+)/g;
  let dm;
  while ((dm = dateRe.exec(html)) !== null) {
    allMatches.push({ pos: dm.index, type: 'date', value: dm[1].trim() });
  }

  const linkRe = /href="https:\/\/eth-udk\.library\.ethz\.ch\/terms\/(\d+)\/eng"/g;
  let lm;
  while ((lm = linkRe.exec(html)) !== null) {
    const snippet = html.slice(lm.index, lm.index + 500);
    const labelM = snippet.match(/text-blue-600">([^<]+)<\/div>/);
    const codeM  = snippet.match(/ml-auto[^>]*>([^<]+)<\/div>/);
    if (labelM && codeM) {
      allMatches.push({
        pos: lm.index, type: 'entry',
        id: lm[1], label: labelM[1].trim(), code: codeM[1].trim(),
      });
    }
  }

  allMatches.sort((a, b) => a.pos - b.pos);
  const entries = [];
  let currentDate = null;
  for (const m of allMatches) {
    if (m.type === 'date') currentDate = m.value.replace(/\s+/g, ' ').trim();
    else if (m.type === 'entry') entries.push({ id: m.id, label: m.label, code: m.code, addedDate: currentDate });
  }
  return entries;
}

app.get('/api/udc-new-terms', async (req, res) => {
  const { signal, clear } = withTimeout(15000);
  try {
    const r = await fetch('https://eth-udk.library.ethz.ch/new-terms/eng', {
      signal, headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Canon/1.0)' },
    });
    clear();
    if (!r.ok) throw new Error(`ETH-UDK HTTP ${r.status}`);
    const entries = parseUdcNewTerms(await r.text());
    res.json({ entries, lastFetched: Date.now() });
  } catch (e) {
    clear();
    res.status(502).json({ error: e.message });
  }
});

// ── World's Top 2% Scientists proxy (pasanhu.cn) ─────────────────────────────
// Mirrors the official Stanford/Elsevier "World's Top 2% Scientists" dataset
// (Ioannidis et al., Mendeley Data DOI 10.17632/btchxktzyw) via pasanhu.cn's
// live ASMX JSON service (HSSrv.asmx). The service needs a bearer token that
// is embedded in the site's own page HTML — regenerated on every page load
// but not tied to a login — so it's fetched here server-side and cached
// briefly, with a forced refresh on 401.

const PASANHU_BASE = 'https://www.pasanhu.cn';
const PASANHU_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
let pasanhuToken = null;
let pasanhuTokenAt = 0;
const PASANHU_TOKEN_TTL = 5 * 60 * 1000;

async function getPasanhuToken(force = false) {
  if (!force && pasanhuToken && Date.now() - pasanhuTokenAt < PASANHU_TOKEN_TTL) return pasanhuToken;
  const r = await fetch(`${PASANHU_BASE}/WorldTopScientists.aspx`, { headers: { 'User-Agent': PASANHU_UA } });
  const html = await r.text();
  const m = html.match(/main\.render\("([^"]+)"/);
  if (!m) throw new Error('Could not extract pasanhu.cn auth token');
  pasanhuToken = m[1];
  pasanhuTokenAt = Date.now();
  return pasanhuToken;
}

async function pasanhuPost(fn, body, retry = true) {
  const token = await getPasanhuToken();
  const r = await fetch(`${PASANHU_BASE}/HSSrv.asmx/${fn}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json;charset=utf-8',
      'Authorization': token,
      'User-Agent': PASANHU_UA,
    },
    body: JSON.stringify(body),
  });
  if (r.status === 401 && retry) {
    await getPasanhuToken(true);
    return pasanhuPost(fn, body, false);
  }
  if (!r.ok) throw new Error(`pasanhu.cn HTTP ${r.status}`);
  const json = await r.json();
  if (json?.d?.code !== 0) throw new Error(json?.d?.msg || 'pasanhu.cn error');
  return json.d;
}

async function pasanhuPostRetry(fn, body, attempt = 0) {
  try {
    return await pasanhuPost(fn, body);
  } catch (e) {
    if (attempt < 3) {
      await new Promise(res => setTimeout(res, 1500 * (attempt + 1)));
      return pasanhuPostRetry(fn, body, attempt + 1);
    }
    throw e;
  }
}

function pasanhuYY(year) { return String(year).slice(-2); }

// Field names differ by year (single-year citations, h-index, hm-index all
// carry the 2-digit year in their key) and by type (career citations sum
// from 1996 rather than the single year) — see CLAUDE.md for the derivation.
function pasanhuMetricColumns(year, type) {
  const y = pasanhuYY(year);
  const nc = type === 'CAREER' ? `nc96${y} (ns)` : `nc${y}${y} (ns)`;
  return {
    rank: 'rank (ns)',
    citations: nc,
    hindex: `h${y} (ns)`,
    hmindex: `hm${y} (ns)`,
    papers: `np60${y}`,
    composite: 'c (ns)',
    selfpct: 'self%',
  };
}

const PASANHU_BASE_COLS = ['authfull', 'inst_name', 'cntry', 'sm-field', 'sm-subfield-1', 'sm-subfield-2'];
const PASANHU_METRIC_ORDER = ['rank', 'citations', 'hindex', 'hmindex', 'papers', 'composite', 'selfpct'];

function pasanhuBuildColumns(year, type) {
  const m = pasanhuMetricColumns(year, type);
  const columns = [...PASANHU_BASE_COLS, ...PASANHU_METRIC_ORDER.map(k => m[k])];
  const metricIndex = Object.fromEntries(PASANHU_METRIC_ORDER.map((k, i) => [k, PASANHU_BASE_COLS.length + i]));
  return { columns, metricIndex };
}

function pasanhuRowToObject(row, metricIndex) {
  const [authfull, inst_name, cntry, field, subfield1, subfield2] = row.values;
  const num = (i) => { const v = parseFloat(row.values[i]); return Number.isFinite(v) ? v : null; };
  return {
    id: row.id, authfull, inst_name, cntry, field, subfield1, subfield2,
    rank: num(metricIndex.rank),
    citations: num(metricIndex.citations),
    hindex: num(metricIndex.hindex),
    hmindex: num(metricIndex.hmindex),
    papers: num(metricIndex.papers),
    composite: num(metricIndex.composite),
    selfpct: num(metricIndex.selfpct),
  };
}

const pasanhuQueryCache = new Map(); // key -> { rows, total, capped, ts }
const PASANHU_CACHE_TTL = 10 * 60 * 1000;
const PASANHU_FETCH_ALL_CAP = 30000;
// pasanhu.cn's ASMX service has an undocumented response-size limit that
// scales with column count, not just row count — a 13-column query (our
// full metric set) 500s above ~300-400 rows/page even though a 1-column
// query handles 1000 fine. 250 stays safely under that threshold.
const PASANHU_UPSTREAM_PAGE = 250;
const PASANHU_FETCH_CONCURRENCY = 8;

function pasanhuPruneCache() {
  if (pasanhuQueryCache.size <= 40) return;
  const oldestKey = [...pasanhuQueryCache.entries()].sort((a, b) => a[1].ts - b[1].ts)[0]?.[0];
  if (oldestKey) pasanhuQueryCache.delete(oldestKey);
}

app.get('/api/topsci/query', async (req, res) => {
  try {
    const year = req.query.year || '2024';
    const type = req.query.type === 'CAREER' ? 'CAREER' : '';
    const sm_field = req.query.sm_field || '';
    const sm_subfield_1 = req.query.sm_subfield_1 || '';
    const sm_subfield_2 = req.query.sm_subfield_2 || '';
    const cntry = req.query.cntry || '';
    const authfull = req.query.authfull || '';
    const inst_name = req.query.inst_name || '';
    const sortBy = PASANHU_METRIC_ORDER.includes(req.query.sortBy) ? req.query.sortBy : 'rank';
    const sortDir = req.query.sortDir === 'desc' ? 'desc' : 'asc';
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 25));

    const { columns, metricIndex } = pasanhuBuildColumns(year, type);
    const baseArgs = { year: String(year), type, authfull, inst_name, cntry, sm_field, sm_subfield_1, sm_subfield_2, column: columns };

    // Native order (rank ascending == composite score descending, excl.
    // self-citations) is exactly what pasanhu.cn already returns — a cheap
    // single-request passthrough with no local sorting needed.
    const isNativeOrder = sortBy === 'rank' && sortDir === 'asc';
    if (isNativeOrder) {
      const d = await pasanhuPostRetry('QueryWPData2', { ...baseArgs, page, limit });
      const rows = d.data.map(r => pasanhuRowToObject(r, metricIndex));
      return res.json({ count: d.count, page, limit, rows, capped: false });
    }

    // Any other sort requires pulling the full filtered set and sorting
    // locally — pasanhu.cn exposes no sort parameter. Capped + cached since
    // an unfiltered custom sort would otherwise mean pulling all ~230k rows
    // on every request.
    const cacheKey = JSON.stringify({ year, type, sm_field, sm_subfield_1, sm_subfield_2, cntry, authfull, inst_name, sortBy, sortDir });
    let entry = pasanhuQueryCache.get(cacheKey);
    if (!entry || Date.now() - entry.ts > PASANHU_CACHE_TTL) {
      const first = await pasanhuPostRetry('QueryWPData2', { ...baseArgs, page: 1, limit: PASANHU_UPSTREAM_PAGE });
      const total = first.count;
      const capped = total > PASANHU_FETCH_ALL_CAP;
      const fetchCount = Math.min(total, PASANHU_FETCH_ALL_CAP);
      const totalPages = Math.ceil(fetchCount / PASANHU_UPSTREAM_PAGE);
      const allRows = first.data.map(r => pasanhuRowToObject(r, metricIndex));

      for (let batchStart = 2; batchStart <= totalPages; batchStart += PASANHU_FETCH_CONCURRENCY) {
        const batch = [];
        for (let p = batchStart; p < batchStart + PASANHU_FETCH_CONCURRENCY && p <= totalPages; p++) batch.push(p);
        const results = await Promise.all(batch.map(p => pasanhuPostRetry('QueryWPData2', { ...baseArgs, page: p, limit: PASANHU_UPSTREAM_PAGE })));
        for (const d of results) allRows.push(...d.data.map(r => pasanhuRowToObject(r, metricIndex)));
      }

      allRows.sort((a, b) => {
        const av = a[sortBy], bv = b[sortBy];
        if (av == null && bv == null) return 0;
        if (av == null) return 1;
        if (bv == null) return -1;
        return sortDir === 'desc' ? bv - av : av - bv;
      });

      entry = { rows: allRows, total, capped, ts: Date.now() };
      pasanhuQueryCache.set(cacheKey, entry);
      pasanhuPruneCache();
    }

    const startIdx = (page - 1) * limit;
    const pageRows = entry.rows.slice(startIdx, startIdx + limit);
    res.json({ count: entry.total, page, limit, rows: pageRows, capped: entry.capped });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

app.get('/api/topsci/detail', async (req, res) => {
  try {
    const year = req.query.year || '2024';
    const type = req.query.type === 'CAREER' ? 'CAREER' : '';
    const id = parseInt(req.query.id, 10);
    if (!Number.isFinite(id)) throw new Error('Missing or invalid id');
    const d = await pasanhuPostRetry('GetWPData', { year: String(year), type, id });
    const keys = d.data.keys;
    const values = d.data.data.values;
    const record = keys.map((k, i) => ({ field: k.field, description: k.description, value: values[i + 1] }));
    res.json({ id, record });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// Top Scientists' actual scientist rows are always live-queried, so only two
// things can go stale: the app's hardcoded year list, and the one-time
// facets crawl (src/constants/topSciFacets.js). This checks both cheaply —
// candidate-year existence via a 1-row probe per type, and a same-page
// field/subfield/country sample the client diffs against its known facets.
app.get('/api/topsci/check-updates', async (req, res) => {
  try {
    const knownYears = (req.query.knownYears || '').split(',').map(y => parseInt(y, 10)).filter(Number.isFinite);
    const maxKnownYear = knownYears.length ? Math.max(...knownYears) : 2024;
    const candidateYear = String(maxKnownYear + 1);

    const probe = (year, type) => pasanhuPostRetry('QueryWPData2', {
      year, type, authfull: '', inst_name: '', cntry: '', sm_field: '', sm_subfield_1: '', sm_subfield_2: '',
      page: 1, limit: 1, column: ['authfull'],
    }).then(d => d.count).catch(() => 0);

    const [singleCount, careerCount, sample] = await Promise.all([
      probe(candidateYear, ''),
      probe(candidateYear, 'CAREER'),
      pasanhuPostRetry('QueryWPData2', {
        year: String(maxKnownYear), type: '', authfull: '', inst_name: '', cntry: '',
        sm_field: '', sm_subfield_1: '', sm_subfield_2: '', page: 1, limit: 500,
        column: ['cntry', 'sm-field', 'sm-subfield-1', 'sm-subfield-2'],
      }),
    ]);

    const sampleFields = new Set(), sampleSubfields = new Set(), sampleCountries = new Set();
    for (const row of sample.data) {
      const [cntry, field, sf1, sf2] = row.values;
      if (cntry) sampleCountries.add(cntry);
      if (field) sampleFields.add(field);
      if (sf1) sampleSubfields.add(sf1);
      if (sf2) sampleSubfields.add(sf2);
    }

    res.json({
      candidateYear: (singleCount > 0 || careerCount > 0) ? candidateYear : null,
      singleCount, careerCount,
      sampleFields: [...sampleFields], sampleSubfields: [...sampleSubfields], sampleCountries: [...sampleCountries],
    });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// ── Generic HTML proxy (scan-for-updates in OntologicalAtlas, Academia, ScienceDirect) ──

app.get('/api/html-proxy', async (req, res) => {
  const target = req.query.url;
  if (!target || !target.startsWith('https://')) {
    return res.status(400).json({ error: 'Missing or invalid url param' });
  }
  const { signal, clear } = withTimeout(20000);
  try {
    const r = await fetch(target, {
      signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    });
    clear();
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const html = await r.text();
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (e) {
    clear();
    res.status(502).json({ error: e.message });
  }
});

// ── Static ────────────────────────────────────────────────────────────────────

app.use(express.static(path.join(__dirname, 'dist')));
app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));

app.listen(PORT, () => console.log(`Canon listening on ${PORT}`));
