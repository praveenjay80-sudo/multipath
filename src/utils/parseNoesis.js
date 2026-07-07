function clean(line) {
  return line.replace(/\*\*/g, '').replace(/\*/g, '').replace(/^#+\s*/, '').trim();
}

const LIST_FIELDS = new Set(['CONCEPTS', 'WORKS', 'THINKERS', 'SCHOOLS', 'CASES', 'MISCONCEPTIONS']);
const PARAGRAPH_FIELDS = new Set(['SYNTHESIS']);
const FIELD_KEYS = [
  'QUESTION', 'PREREQUISITES', 'CONCEPTS', 'INTUITION', 'NOTATION', 'METHOD',
  'WORKS', 'EXAMPLES', 'ALTERNATIVES', 'THINKERS', 'SCHOOLS', 'HISTORY', 'DEBATES',
  'CASES', 'BOUNDARIES', 'MISCONCEPTIONS', 'POSTREQUISITES', 'OPEN', 'SYNTHESIS',
];
const FIELD_KEY_RE = new RegExp(`^(${FIELD_KEYS.join('|')}):\\s*(.*)`, 'i');
const TOP_KEYS = /^(TOPIC|TIER|LEVEL WHY|ANGLES|STATION\s+\d+):/i;

export function splitSemicolonList(raw) {
  if (!raw) return [];
  return raw.split(';').map(s => s.trim()).filter(Boolean).map(entry => {
    const idx = entry.indexOf(' — ');
    if (idx === -1) return { label: entry, detail: '' };
    return { label: entry.slice(0, idx).trim(), detail: entry.slice(idx + 3).trim() };
  });
}

function splitParagraphs(raw) {
  return raw.split(/\n\s*\n/).map(p => clean(p.replace(/\n/g, ' '))).filter(Boolean);
}

export function parseNoesis(text) {
  if (!text) return null;

  const result = { topic: '', tier: '', levelWhy: '', angles: [], stations: [] };

  const lines = text.split('\n');
  let i = 0;
  let currentStation = null;
  let collecting = null;
  let collectLines = [];

  function flushCollect() {
    if (!collecting) return;
    const raw = collectLines.join('\n').trim();
    if (collecting === 'ANGLES') {
      result.angles = splitSemicolonList(raw.replace(/\n/g, ' '));
    } else if (collecting === 'LEVEL_WHY') {
      result.levelWhy = raw.replace(/\n/g, ' ').trim();
    } else if (currentStation) {
      if (LIST_FIELDS.has(collecting)) {
        currentStation.fields[collecting] = splitSemicolonList(raw.replace(/\n/g, ' '));
      } else if (PARAGRAPH_FIELDS.has(collecting)) {
        currentStation.fields[collecting] = splitParagraphs(raw);
      } else {
        currentStation.fields[collecting] = raw.replace(/\n/g, ' ').trim();
      }
    }
    collecting = null;
    collectLines = [];
  }

  function pushStation() {
    if (currentStation) result.stations.push(currentStation);
    currentStation = null;
  }

  while (i < lines.length) {
    const trimmed = clean(lines[i]);

    if (!trimmed) {
      if (collecting && PARAGRAPH_FIELDS.has(collecting)) {
        collectLines.push('');
      } else {
        flushCollect();
      }
      i++; continue;
    }

    let m;

    if ((m = trimmed.match(/^TOPIC:\s*(.*)/i))) {
      flushCollect(); result.topic = m[1].trim(); i++; continue;
    }

    if ((m = trimmed.match(/^TIER:\s*(.*)/i))) {
      flushCollect(); result.tier = m[1].trim(); i++; continue;
    }

    if ((m = trimmed.match(/^LEVEL WHY:\s*(.*)/i))) {
      flushCollect();
      if (m[1].trim()) result.levelWhy = m[1].trim();
      else { collecting = 'LEVEL_WHY'; collectLines = []; }
      i++; continue;
    }

    if ((m = trimmed.match(/^ANGLES:\s*(.*)/i))) {
      flushCollect();
      const inline = m[1].trim();
      if (inline) result.angles = splitSemicolonList(inline);
      else { collecting = 'ANGLES'; collectLines = []; }
      i++; continue;
    }

    if ((m = trimmed.match(/^STATION\s+(\d+):\s*(.*)/i))) {
      flushCollect(); pushStation();
      currentStation = { number: parseInt(m[1]), name: m[2].trim(), fields: {} };
      i++; continue;
    }

    if ((m = trimmed.match(FIELD_KEY_RE)) && currentStation) {
      flushCollect();
      const key = m[1].toUpperCase();
      const inline = m[2].trim();
      if (PARAGRAPH_FIELDS.has(key)) {
        collecting = key; collectLines = inline ? [inline] : [];
      } else if (inline) {
        if (LIST_FIELDS.has(key)) currentStation.fields[key] = splitSemicolonList(inline);
        else currentStation.fields[key] = inline;
      } else {
        collecting = key; collectLines = [];
      }
      i++; continue;
    }

    if (collecting && !trimmed.match(TOP_KEYS) && !trimmed.match(FIELD_KEY_RE)) {
      collectLines.push(trimmed);
      i++; continue;
    }

    i++;
  }

  flushCollect();
  pushStation();

  return result;
}
