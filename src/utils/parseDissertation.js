function clean(line) {
  return line.replace(/\*\*/g, '').replace(/\*/g, '').replace(/^#+\s*/, '').trim();
}

export function parseDissertation(text) {
  if (!text) return null;

  const result = {
    question: '', field: '', subfield: '', committeeNote: '',
    tiers: [],
    examPrep: '', timeline: '', advisorNote: '',
  };

  const lines = text.split('\n');
  let i = 0;
  let currentTier = null;
  let collectingCommitteeNote = false;
  let committeeNoteLines = [];
  let collectingTierDesc = false;
  let tierDescLines = [];

  const pushTier = () => {
    if (currentTier) {
      if (tierDescLines.length && !currentTier.description) {
        currentTier.description = tierDescLines.join(' ');
      }
      result.tiers.push(currentTier);
    }
    tierDescLines = [];
    collectingTierDesc = false;
  };

  const normSep = s => s.replace(/ — /g, ' -- ').replace(/—/g, '--');

  while (i < lines.length) {
    const trimmed = clean(lines[i]);

    const questionMatch = trimmed.match(/^QUESTION:\s*(.+)$/i);
    if (questionMatch) { result.question = questionMatch[1].trim(); collectingCommitteeNote = false; i++; continue; }

    const fieldMatch = trimmed.match(/^FIELD:\s*(.+)$/i);
    if (fieldMatch) { result.field = fieldMatch[1].trim(); collectingCommitteeNote = false; i++; continue; }

    const subfieldMatch = trimmed.match(/^SUBFIELD:\s*(.+)$/i);
    if (subfieldMatch) { result.subfield = subfieldMatch[1].trim(); collectingCommitteeNote = false; i++; continue; }

    if (trimmed.match(/^COMMITTEE NOTE:\s*/i)) {
      collectingCommitteeNote = true;
      const inline = trimmed.replace(/^COMMITTEE NOTE:\s*/i, '').trim();
      if (inline) committeeNoteLines.push(inline);
      i++; continue;
    }

    const examPrepMatch = trimmed.match(/^EXAM PREP:\s*(.+)$/i);
    if (examPrepMatch) {
      collectingCommitteeNote = false;
      if (committeeNoteLines.length && !result.committeeNote) result.committeeNote = committeeNoteLines.join(' ');
      result.examPrep = examPrepMatch[1].trim();
      pushTier(); currentTier = null;
      i++; continue;
    }

    const timelineMatch = trimmed.match(/^TIMELINE:\s*(.+)$/i);
    if (timelineMatch) { result.timeline = timelineMatch[1].trim(); i++; continue; }

    const advisorMatch = trimmed.match(/^ADVISOR NOTE:\s*(.+)$/i);
    if (advisorMatch) { result.advisorNote = advisorMatch[1].trim(); i++; continue; }

    if (trimmed === '---') { collectingCommitteeNote = false; i++; continue; }

    if (collectingCommitteeNote && trimmed && !trimmed.match(/^(TIER|FIELD|SUBFIELD|EXAM|TIMELINE|ADVISOR)/i)) {
      committeeNoteLines.push(trimmed); i++; continue;
    }

    const tierMatch = trimmed.match(/^TIER\s+(\d+):\s*(.+)$/i);
    if (tierMatch) {
      collectingCommitteeNote = false;
      if (committeeNoteLines.length && !result.committeeNote) result.committeeNote = committeeNoteLines.join(' ');
      pushTier();
      currentTier = { number: parseInt(tierMatch[1]), name: tierMatch[2].trim(), description: '', works: [] };
      collectingTierDesc = true;
      i++; continue;
    }

    if (currentTier) {
      if (trimmed.match(/^[-*]\s+/)) {
        collectingTierDesc = false;
        if (tierDescLines.length && !currentTier.description) {
          currentTier.description = tierDescLines.join(' ');
          tierDescLines = [];
        }
        const workLine = normSep(trimmed.replace(/^[-*]\s+/, '').trim());
        const dashIdx = workLine.indexOf(' -- ');
        const ref = dashIdx !== -1 ? workLine.slice(0, dashIdx).trim() : workLine;
        const rationale = dashIdx !== -1 ? workLine.slice(dashIdx + 4).trim() : '';
        currentTier.works.push({ ref, rationale, mustMaster: '' });
        i++; continue;
      }

      if ((trimmed.match(/^[-=]>|^→/) || lines[i].match(/^\s+[-=]>|^\s+→/)) && currentTier.works.length > 0) {
        const mustMaster = trimmed
          .replace(/^[-=]>\s*|^→\s*/, '')
          .replace(/^(?:Must master:|Focus:)\s*/i, '')
          .trim();
        currentTier.works[currentTier.works.length - 1].mustMaster = mustMaster;
        i++; continue;
      }

      if (collectingTierDesc && trimmed && !trimmed.match(/^(TIER|EXAM|TIMELINE|ADVISOR|---)/i)) {
        tierDescLines.push(trimmed); i++; continue;
      }
    }

    i++;
  }

  pushTier();
  if (committeeNoteLines.length && !result.committeeNote) result.committeeNote = committeeNoteLines.join(' ');

  return result;
}
