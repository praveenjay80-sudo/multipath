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
