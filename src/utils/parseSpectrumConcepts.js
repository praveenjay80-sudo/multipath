function clean(line) {
  return line.replace(/\*\*/g, '').replace(/\*/g, '').replace(/^#+\s*/, '').trim();
}

export function parseSpectrumConcepts(text) {
  if (!text) return null;

  const result = { question: '', concepts: [] };

  const lines = text.split('\n');
  let i = 0;
  let current = null;
  let collecting = null;
  let collectLines = [];

  const KNOWN_KEYS = /^(QUESTION|CONCEPT|DISCIPLINE|TIER|EXPLANATION|RELEVANCE|READING LIST):/i;

  function flushCollect() {
    if (!collecting) return;
    const val = collectLines.join(' ').trim();
    if (current && ['explanation', 'relevance'].includes(collecting)) {
      current[collecting] = val;
    }
    collecting = null;
    collectLines = [];
  }

  function pushConcept() {
    if (current) result.concepts.push(current);
    current = null;
  }

  while (i < lines.length) {
    const trimmed = clean(lines[i]);

    if (trimmed.match(/^READING LIST:\s*/i)) {
      flushCollect();
      pushConcept();
      break;
    }

    if (!trimmed) { flushCollect(); i++; continue; }

    let m;

    if ((m = trimmed.match(/^QUESTION:\s*(.*)/i))) {
      flushCollect(); result.question = m[1].trim(); i++; continue;
    }

    if ((m = trimmed.match(/^CONCEPT:\s*(.*)/i))) {
      flushCollect(); pushConcept();
      current = { name: m[1].trim(), discipline: '', tier: '', explanation: '', relevance: '' };
      i++; continue;
    }

    if ((m = trimmed.match(/^DISCIPLINE:\s*(.*)/i)) && current) {
      flushCollect(); current.discipline = m[1].trim(); i++; continue;
    }

    if ((m = trimmed.match(/^TIER:\s*(.*)/i)) && current) {
      flushCollect(); current.tier = m[1].trim(); i++; continue;
    }

    if ((m = trimmed.match(/^EXPLANATION:\s*(.*)/i)) && current) {
      flushCollect();
      if (m[1].trim()) current.explanation = m[1].trim();
      else { collecting = 'explanation'; collectLines = []; }
      i++; continue;
    }

    if ((m = trimmed.match(/^RELEVANCE:\s*(.*)/i)) && current) {
      flushCollect();
      if (m[1].trim()) current.relevance = m[1].trim();
      else { collecting = 'relevance'; collectLines = []; }
      i++; continue;
    }

    if (collecting && !trimmed.match(KNOWN_KEYS)) {
      collectLines.push(trimmed);
      i++; continue;
    }

    i++;
  }

  flushCollect();
  pushConcept();

  return result;
}

export function extractReadingListSection(text) {
  if (!text) return '';
  const start = text.match(/^READING LIST:\s*/im);
  if (!start) return '';
  const rest = text.slice(start.index + start[0].length);
  const answerStart = rest.match(/^ANSWER:\s*/im);
  return answerStart ? rest.slice(0, answerStart.index) : rest;
}

export function extractAnswerParagraphs(text) {
  if (!text) return [];
  const start = text.match(/^ANSWER:\s*/im);
  if (!start) return [];
  const rest = text.slice(start.index + start[0].length);
  return rest.split(/\n\s*\n/).map(p => clean(p.replace(/\n/g, ' '))).filter(Boolean);
}
