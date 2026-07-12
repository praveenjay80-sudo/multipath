// Fetches all persona pages from ontologicalatlas.com and patches ontologicalAtlas.json
// Pure Node.js https + regex — no jsdom dependency needed
import https from 'https';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));

async function get(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function stripHtml(str) {
  return str.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&#\d+;/g, '').replace(/\s+/g, ' ').trim();
}

function parsePersonaPage(html) {
  const personas = [];
  const linkRe = /<a\s[^>]*href="(\/personas\/([^/"?]+)\/)"/gi;
  let match;
  while ((match = linkRe.exec(html)) !== null) {
    const href = match[1];
    const slug = match[2];
    if (!slug || href.includes('/compare/') || href === '/personas/') continue;

    const start = match.index + match[0].length;
    const closeIdx = html.indexOf('</a>', start);
    if (closeIdx === -1) continue;
    const inner = html.slice(start, closeIdx);

    const h3m = inner.match(/<h[23][^>]*>([\s\S]*?)<\/h[23]>/i);
    const name = h3m ? stripHtml(h3m[1]) : stripHtml(inner).slice(0, 60);
    if (!name || name.length < 2) continue;

    const pm = inner.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
    const description = pm ? stripHtml(pm[1]) : '';

    const dateMatch = inner.match(/(\d{4})\s*[–\-]\s*(\d{4}|present)/i) || inner.match(/\b(1[0-9]{3}|20[0-2][0-9])\b/);
    const dates = dateMatch ? dateMatch[0] : '';

    personas.push({ slug, name, dates, description });
  }
  return personas;
}

function dedup(arr) {
  const seen = new Set();
  return arr.filter(p => { if (seen.has(p.slug)) return false; seen.add(p.slug); return true; });
}

const data = JSON.parse(readFileSync(join(__dir, 'ontologicalAtlas.json'), 'utf8'));
const personas = [];
for (let page = 1; page <= 12; page++) {
  const url = page === 1
    ? 'https://ontologicalatlas.com/personas/'
    : `https://ontologicalatlas.com/personas/?page=${page}`;
  try {
    const html = await get(url);
    const batch = parsePersonaPage(html);
    if (batch.length === 0) { console.log(`Page ${page}: empty, stopping`); break; }
    personas.push(...batch);
    console.log(`Page ${page}: ${batch.length} personas (total ${personas.length})`);
    await sleep(400);
  } catch (e) { console.warn(`Page ${page} error:`, e.message); }
}

const unique = dedup(personas);
data.personas = unique;
writeFileSync(join(__dir, 'ontologicalAtlas.json'), JSON.stringify(data), 'utf8');
console.log(`Patched: ${unique.length} personas`);
