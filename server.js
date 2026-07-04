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

// ── Static ────────────────────────────────────────────────────────────────────

app.use(express.static(path.join(__dirname, 'dist')));
app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));

app.listen(PORT, () => console.log(`Canon listening on ${PORT}`));
