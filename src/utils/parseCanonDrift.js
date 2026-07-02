function clean(line) {
  return line.replace(/\*\*/g, '').replace(/\*/g, '').replace(/^#+\s*/, '').trim();
}

export function parseCanonDrift(text) {
  if (!text) return null;

  const result = {
    field: '', driftSummary: '',
    eras: [],
    driftReveals: '',
  };

  const lines = text.split('\n');
  let i = 0;
  let currentEra = null;
  let collectingDriftSummary = false;
  let driftSummaryLines = [];
  let collectingShift = false;
  let shiftLines = [];

  const pushEra = () => {
    if (currentEra) {
      if (shiftLines.length && !currentEra.shift) currentEra.shift = shiftLines.join(' ');
      result.eras.push(currentEra);
    }
    shiftLines = [];
    collectingShift = false;
  };

  const normSep = s => s.replace(/ — /g, ' -- ').replace(/—/g, '--');

  while (i < lines.length) {
    const trimmed = clean(lines[i]);

    const fieldMatch = trimmed.match(/^FIELD:\s*(.+)$/i);
    if (fieldMatch) { result.field = fieldMatch[1].trim(); collectingDriftSummary = false; i++; continue; }

    if (trimmed.match(/^DRIFT SUMMARY:\s*/i)) {
      collectingDriftSummary = true;
      const inline = trimmed.replace(/^DRIFT SUMMARY:\s*/i, '').trim();
      if (inline) driftSummaryLines.push(inline);
      i++; continue;
    }

    const driftRevealsMatch = trimmed.match(/^(?:DRIFT REVEALS|TAKEAWAY):\s*(.+)$/i);
    if (driftRevealsMatch) {
      collectingDriftSummary = false;
      if (driftSummaryLines.length && !result.driftSummary) result.driftSummary = driftSummaryLines.join(' ');
      result.driftReveals = driftRevealsMatch[1].trim();
      pushEra(); currentEra = null;
      i++; continue;
    }

    if (trimmed === '---') { collectingDriftSummary = false; i++; continue; }

    if (collectingDriftSummary && trimmed && !trimmed.match(/^(ERA:|FIELD:|DRIFT REVEALS|TAKEAWAY)/i)) {
      driftSummaryLines.push(trimmed); i++; continue;
    }

    // ERA: Pre-1985 -- Foundations
    const eraMatch = trimmed.match(/^ERA:\s*(.+?)(?:\s*--\s*(.+))?$/i);
    if (eraMatch) {
      collectingDriftSummary = false;
      if (driftSummaryLines.length && !result.driftSummary) result.driftSummary = driftSummaryLines.join(' ');
      pushEra();
      const rawName = eraMatch[1].trim();
      // Parse "Pre-1985 -- Foundations" or "1985-1999" style
      const parts = rawName.split(/\s*--\s*/);
      const years = parts[0].trim();
      const label = parts[1]?.trim() || eraMatch[2]?.trim() || '';
      currentEra = { years, label, shift: '', works: [] };
      collectingShift = false;
      i++; continue;
    }

    if (currentEra) {
      const shiftMatch = trimmed.match(/^(?:DEFINING\s+)?SHIFT:\s*(.+)$/i);
      if (shiftMatch) {
        currentEra.shift = shiftMatch[1].trim();
        collectingShift = true;
        i++; continue;
      }

      // Work item
      if (trimmed.match(/^[-*]\s+/)) {
        collectingShift = false;
        if (shiftLines.length && !currentEra.shift) { currentEra.shift = shiftLines.join(' '); shiftLines = []; }
        const workLine = normSep(trimmed.replace(/^[-*]\s+/, '').trim());
        const parts = workLine.split(' -- ');
        const ref = parts[0]?.trim() || workLine;
        // Expect: ref -- citations -- TRAJECTORY -- reason
        let citationStr = '', trajectory = '', reason = '';
        if (parts.length >= 4) {
          citationStr = parts[1]?.trim() || '';
          trajectory = parts[2]?.trim().toUpperCase() || '';
          reason = parts.slice(3).join(' -- ').trim();
        } else if (parts.length === 3) {
          citationStr = parts[1]?.trim() || '';
          reason = parts[2]?.trim() || '';
        } else if (parts.length === 2) {
          reason = parts[1]?.trim() || '';
        }
        const citMatch = citationStr.match(/(\d[\d,]*)/);
        const citations = citMatch ? parseInt(citMatch[1].replace(/,/g, '')) : null;
        currentEra.works.push({ ref, citations, trajectory, reason });
        i++; continue;
      }

      if (collectingShift && trimmed && !trimmed.match(/^(ERA:|DRIFT REVEALS|TAKEAWAY|---)/i)) {
        shiftLines.push(trimmed); i++; continue;
      }
    }

    i++;
  }

  pushEra();
  if (driftSummaryLines.length && !result.driftSummary) result.driftSummary = driftSummaryLines.join(' ');

  return result;
}
