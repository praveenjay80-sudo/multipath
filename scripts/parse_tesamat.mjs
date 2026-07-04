import { readFileSync, writeFileSync } from 'fs';

const raw = readFileSync('src/data/tesamat_raw.txt', 'utf8');

const SKIP = /Tesamat|Biblioteca|file:\/\/\/|^AB CDE|^TESAMAT|^versión/;
const lines = raw
  .replace(/\f/g, '\n')
  .split('\n')
  .map(l => l.trim())
  .filter(l => l && !SKIP.test(l) && !/^[A-Z\s]{1,3}$/.test(l));

const rawEntries = [];
let cur = '';
for (const line of lines) {
  if (/^\d+\./.test(line)) { if (cur) rawEntries.push(cur); cur = line; }
  else cur += ' ' + line;
}
if (cur) rawEntries.push(cur);

function extractSection(body, tag) {
  const marker = ` ${tag}. `;
  const idx = body.indexOf(marker);
  if (idx === -1) return '';
  let rest = body.slice(idx + marker.length);
  rest = rest.replace(/ (?:tg|te|tr|v|na|up)\. .*/s, '').replace(/\s*\[.*/s, '');
  return rest.trim();
}

function splitTermList(str) {
  if (!str) return [];
  const tokens = str.split(/\s+/);
  const result = [];
  let cur = '';
  for (const t of tokens) {
    // A new term starts with an uppercase LETTER (not parenthesis)
    const startsUpper = /^[A-ZÁÉÍÓÚÑÜÀÈÌÒÙÂÊÎÔÛÃÕÄËÏÖÜ]/.test(t);
    // Previous term ends with a lowercase letter or closing paren/bracket
    const prevEndsLower = cur && /[a-záéíóúñüàèìòùâêîôûãõäëïöü)\]]$/.test(cur);
    if (cur && startsUpper && prevEndsLower) {
      result.push(cur.trim());
      cur = t;
    } else {
      cur = cur ? cur + ' ' + t : t;
    }
  }
  if (cur.trim()) result.push(cur.trim());
  return result;
}

// First pass: collect all reference names (always Spanish-only)
const allRefs = new Set();
for (const entry of rawEntries) {
  const m = entry.match(/^\d+\.\s+(.+)/s);
  if (!m) continue;
  for (const tag of ['tg', 'te']) {
    for (const ref of splitTermList(extractSection(m[1], tag))) allRefs.add(ref);
  }
}

// Second pass: parse entries — extract Spanish label, English label, broader, narrower
const termMap = {};

for (const entry of rawEntries) {
  const m = entry.match(/^\d+\.\s+(.+)/s);
  if (!m) continue;
  const body = m[1];

  if (/ v\. /.test(body) && !/ tg\. /.test(body) && !/ te\. /.test(body)) continue;

  const header = body.split(/ (?:tg|te|tr|v|na|up)\./)[0]
    .replace(/\s*\[.*/, '').trim();

  // Find Spanish label = longest prefix matching a known reference
  let esLabel = header;
  let bestLen = 0;
  for (const ref of allRefs) {
    if (ref.length > bestLen && (header === ref || header.startsWith(ref + ' '))) {
      esLabel = ref; bestLen = ref.length;
    }
  }

  // English label = strip the Spanish prefix, then take the first "English-looking" portion
  // English tokens have no accented characters; strip trailing classifiers like "(Matemáticas)"
  let rawEn = header.slice(esLabel.length).trim();
  // Clean up: strip leading parenthetical that's still Spanish (e.g. "(Álgebra)")
  rawEn = rawEn.replace(/^\([^)]*[áéíóúñü][^)]*\)\s*/i, '').trim();
  // If rawEn is empty, use the Spanish label as fallback for display
  const enLabel = rawEn || esLabel;

  const broader  = splitTermList(extractSection(body, 'tg'));
  const narrower = splitTermList(extractSection(body, 'te'));

  termMap[esLabel] = { es: esLabel, en: enLabel, broader, narrower };
}

console.error(`Parsed ${Object.keys(termMap).length} terms`);

// Build children map (using both te. and reverse tg.)
const children = {};
for (const { es, broader, narrower } of Object.values(termMap)) {
  if (!children[es]) children[es] = new Set();
  for (const n of narrower) if (termMap[n]) children[es].add(n);
  for (const b of broader)  if (termMap[b]) { if (!children[b]) children[b] = new Set(); children[b].add(es); }
}

const visited = new Set();
function buildNode(label) {
  if (visited.has(label)) return null;
  visited.add(label);
  const t = termMap[label];
  const kids = [...(children[label] || [])].sort().map(buildNode).filter(Boolean);
  return { es: label, en: t?.en || label, children: kids };
}

// Build full tree — all terms, not just Matemáticas-reachable
// Terms with no parent become roots
const allChildLabels = new Set(Object.values(children).flatMap(s => [...s]));
const roots = Object.keys(termMap)
  .filter(l => !allChildLabels.has(l))
  .sort()
  .map(buildNode).filter(Boolean);

// Also collect redirect aliases for search
const aliases = {};
for (const entry of rawEntries) {
  const m = entry.match(/^\d+\.\s+(.+)/s);
  if (!m) continue;
  const body = m[1];
  if (!/ v\. /.test(body) || / tg\. /.test(body) || / te\. /.test(body)) continue;
  const header = body.split(/ (?:tg|te|tr|v|na|up)\./)[0].replace(/\s*\[.*/, '').trim();
  const target = extractSection(body, 'v').split(/\s+/).slice(0, 6).join(' ').trim();
  if (header && target) aliases[header] = target;
}

let total = 0;
function countNodes(n) { total++; n.children.forEach(countNodes); }
roots.forEach(countNodes);
console.error(`Roots: ${roots.length}, Total tree nodes: ${total}, Aliases: ${Object.keys(aliases).length}`);
if (termMap['Matemáticas']) {
  const matNode = roots.find(r => r.es === 'Matemáticas');
  if (matNode) console.error('Mathematics children:', matNode.children.slice(0,6).map(c=>`${c.en}(${c.children.length})`).join(', '));
}

writeFileSync('src/data/tesamat.json', JSON.stringify({ roots, aliases }));
console.error('Done');
