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
