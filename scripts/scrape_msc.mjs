import { writeFileSync } from 'fs';

const BASE = 'https://www.mi.imati.cnr.it/~alberto/dml_11_';
const TOTAL_PAGES = 59;
const DELAY_MS = 300;

// MSC 2020 top-level category names
const MSC_TOP = {
  '00': 'General and overarching topics',
  '01': 'History and biography',
  '03': 'Mathematical logic and foundations',
  '05': 'Combinatorics',
  '06': 'Order, lattices, ordered algebraic structures',
  '08': 'General algebraic systems',
  '11': 'Number theory',
  '12': 'Field theory and polynomials',
  '13': 'Commutative algebra',
  '14': 'Algebraic geometry',
  '15': 'Linear and multilinear algebra; matrix theory',
  '16': 'Associative rings and algebras',
  '17': 'Nonassociative rings and algebras',
  '18': 'Category theory; homological algebra',
  '19': 'K-theory',
  '20': 'Group theory and generalizations',
  '22': 'Topological groups, Lie groups',
  '26': 'Real functions',
  '28': 'Measure and integration',
  '30': 'Functions of a complex variable',
  '31': 'Potential theory',
  '32': 'Several complex variables and analytic spaces',
  '33': 'Special functions',
  '34': 'Ordinary differential equations',
  '35': 'Partial differential equations',
  '37': 'Dynamical systems and ergodic theory',
  '39': 'Difference and functional equations',
  '40': 'Sequences, series, summability',
  '41': 'Approximations and expansions',
  '42': 'Harmonic analysis on Euclidean spaces',
  '43': 'Abstract harmonic analysis',
  '44': 'Integral transforms, operational calculus',
  '45': 'Integral equations',
  '46': 'Functional analysis',
  '47': 'Operator theory',
  '49': 'Calculus of variations and optimal control',
  '51': 'Geometry',
  '52': 'Convex and discrete geometry',
  '53': 'Differential geometry',
  '54': 'General topology',
  '55': 'Algebraic topology',
  '57': 'Manifolds and cell complexes',
  '58': 'Global analysis, analysis on manifolds',
  '60': 'Probability theory and stochastic processes',
  '62': 'Statistics',
  '65': 'Numerical analysis',
  '68': 'Computer science',
  '70': 'Mechanics of particles and systems',
  '74': 'Mechanics of deformable solids',
  '76': 'Fluid mechanics',
  '78': 'Optics, electromagnetic theory',
  '80': 'Classical thermodynamics, heat transfer',
  '81': 'Quantum theory',
  '82': 'Statistical mechanics, structure of matter',
  '83': 'Relativity and gravitational theory',
  '85': 'Astronomy and astrophysics',
  '86': 'Geophysics',
  '90': 'Operations research, mathematical programming',
  '91': 'Game theory, economics, social and behavioral sciences',
  '92': 'Biology and other natural sciences',
  '93': 'Systems theory; control',
  '94': 'Information and communication theory, circuits',
  '97': 'Mathematics education',
};

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function parsePage(html) {
  const entries = [];
  // Split on <br> boundaries
  const chunks = html.split(/<br\s*\/?>/i);
  for (const chunk of chunks) {
    // Extract MSC code from <font color="#336600">CODE</font>
    const codeMatch = chunk.match(/<font[^>]*color="#336600"[^>]*>([^<]+)<\/font>/i);
    if (!codeMatch) continue;
    const code = codeMatch[1].trim();

    // Extract keyword: everything before the <font> tag, strip HTML tags and &nbsp;
    const before = chunk.slice(0, chunk.indexOf(codeMatch[0]));
    let keyword = before
      .replace(/<[^>]+>/g, '')       // strip tags
      .replace(/&nbsp;/g, ' ')        // decode &nbsp;
      .replace(/&gt;/g, '>')
      .replace(/&lt;/g, '<')
      .replace(/&amp;/g, '&')
      .replace(/&agrave;/g, 'à')
      .replace(/&egrave;/g, 'è')
      .replace(/&aacute;/g, 'á')
      .replace(/&eacute;/g, 'é')
      .replace(/`a/g, 'à')
      .replace(/\\`a/g, 'à')
      .replace(/\s+/g, ' ')
      .trim();

    if (!keyword || !code) continue;

    // Skip DDC codes (contain decimal points like "535.326"); keep only MSC codes
    // MSC format: 2 digits + letter + (2 digits or "xx"), or "NN-NN"
    if (!(/^\d{2}(-\d{2}|[A-Z](xx|\d{2}))$/.test(code) || /^\d{2}[A-Z]xx$/.test(code))) continue;

    // Reconstruct KWIC: "right_context # left_context" → "right_context left_context"
    // The pivot word itself is implicit (indicated by #)
    // Just join with a space and clean up double spaces/punctuation
    keyword = keyword.replace(/\s*#\s*/g, ' ').replace(/\s+/g, ' ').trim();
    // Remove leading/trailing punctuation artifacts
    keyword = keyword.replace(/^[,;)\]]+\s*/, '').replace(/\s*[,(]+$/, '').trim();

    entries.push({ keyword, code });
  }
  return entries;
}

async function fetchPage(i) {
  const url = `${BASE}${String(i).padStart(2, '0')}.htm`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

async function main() {
  const allEntries = [];

  for (let i = 0; i < TOTAL_PAGES; i++) {
    process.stderr.write(`Fetching page ${i + 1}/${TOTAL_PAGES}...\r`);
    try {
      const html = await fetchPage(i);
      const entries = parsePage(html);
      allEntries.push(...entries);
    } catch (e) {
      console.error(`\nError on page ${i}: ${e.message}`);
    }
    if (i < TOTAL_PAGES - 1) await sleep(DELAY_MS);
  }

  console.error(`\nTotal entries: ${allEntries.length}`);

  // Build tree: topCode → { name, subs: { secCode → { code, keywords: [] } } }
  const tree = {};

  for (const { keyword, code } of allEntries) {
    const top = code.slice(0, 2);
    if (!MSC_TOP[top]) continue; // skip unknown top-level codes

    if (!tree[top]) tree[top] = { code: top, name: MSC_TOP[top], subs: {} };

    // Secondary key: e.g. "53C" from "53C45" or "53Cxx"
    const secMatch = code.match(/^(\d{2}[A-Z])/);
    const sec = secMatch ? secMatch[1] : top;

    if (!tree[top].subs[sec]) tree[top].subs[sec] = { code: sec, keywords: [] };
    tree[top].subs[sec].keywords.push({ keyword, code });
  }

  // Convert to sorted array
  const roots = Object.values(tree)
    .sort((a, b) => a.code.localeCompare(b.code))
    .map(top => ({
      code: top.code,
      name: top.name,
      children: Object.values(top.subs)
        .sort((a, b) => a.code.localeCompare(b.code))
        .map(sub => ({
          code: sub.code,
          keywords: sub.keywords.sort((a, b) => a.keyword.localeCompare(b.keyword)),
        })),
    }));

  const total = roots.reduce((s, r) => s + r.children.reduce((s2, c) => s2 + c.keywords.length, 0), 0);
  console.error(`Tree: ${roots.length} top-level, ${total} keywords`);

  writeFileSync('src/data/msc.json', JSON.stringify(roots));
  console.error('Written to src/data/msc.json');
}

main().catch(e => { console.error(e); process.exit(1); });
