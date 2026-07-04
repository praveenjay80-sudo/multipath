import express from 'express';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// ── GND proxy (lobid.org) ─────────────────────────────────────────────────────

app.get('/api/gnd/search', async (req, res) => {
  try {
    const qs = new URLSearchParams(req.query).toString();
    const r = await fetch(`https://lobid.org/gnd/search?${qs}`);
    const json = await r.json();
    res.json(json);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

app.get('/api/gnd/:id', async (req, res) => {
  try {
    const r = await fetch(`https://lobid.org/gnd/${req.params.id}?format=json`);
    const json = await r.json();
    res.json(json);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// ── Wikidata SPARQL proxy ─────────────────────────────────────────────────────

app.get('/api/sparql', async (req, res) => {
  try {
    const query = req.query.query || '';
    const r = await fetch(
      `https://query.wikidata.org/sparql?query=${encodeURIComponent(query)}&format=json`,
      { headers: { 'User-Agent': 'Canon/1.0 (https://canon-production-75f6.up.railway.app)' } }
    );
    const json = await r.json();
    res.json(json);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

// ── Static ────────────────────────────────────────────────────────────────────

app.use(express.static(path.join(__dirname, 'dist')));
app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));

app.listen(PORT, () => console.log(`Canon listening on ${PORT}`));
