function parseWorksList(lines, startIdx) {
  // Parse a list of - work lines with → focus lines from a given start index
  // Returns { works, nextIdx }
  const works = [];
  let i = startIdx;
  while (i < lines.length) {
    const line = lines[i];
    if (line.match(/^-\s+/)) {
      const workLine = line.slice(2).trim();
      const dashIdx = workLine.indexOf(' — ');
      works.push({
        ref: dashIdx >= 0 ? workLine.slice(0, dashIdx) : workLine,
        rationale: dashIdx >= 0 ? workLine.slice(dashIdx + 3) : '',
        focus: '',
      });
    } else if (line.match(/^\s*→\s*/) && works.length > 0) {
      works[works.length - 1].focus = line.replace(/^\s*→\s*(Focus:\s*)?/, '').trim();
    } else if (line.trim() === '---' || line.match(/^(PHASE|STREAM|BEYOND|TOTAL PATH)/i)) {
      break;
    }
    i++;
  }
  return { works, nextIdx: i };
}

export function parsePrerequisites(text) {
  if (!text) return null;

  const result = {
    work: '', field: '', difficulty: '', context: '',
    phases: [], totalPath: '',
    beyond: { summary: '', streams: [] },
  };

  const lines = text.split('\n');
  let i = 0;
  let collectingContext = false;
  let contextLines = [];
  let inBeyond = false;
  let currentPhase = null;
  let currentStream = null;

  while (i < lines.length) {
    const line = lines[i];

    const workMatch = line.match(/^WORK:\s*(.+)$/);
    if (workMatch) { result.work = workMatch[1].trim(); collectingContext = false; i++; continue; }

    const fieldMatch = line.match(/^FIELD:\s*(.+)$/);
    if (fieldMatch) { result.field = fieldMatch[1].trim(); collectingContext = false; i++; continue; }

    const diffMatch = line.match(/^DIFFICULTY:\s*(.+)$/);
    if (diffMatch) { result.difficulty = diffMatch[1].trim(); collectingContext = false; i++; continue; }

    if (line.match(/^CONTEXT:\s*/)) {
      collectingContext = true;
      const inline = line.replace(/^CONTEXT:\s*/, '').trim();
      if (inline) contextLines.push(inline);
      i++; continue;
    }

    const totalMatch = line.match(/^TOTAL PATH:\s*(.+)$/);
    if (totalMatch) {
      result.totalPath = totalMatch[1].trim();
      collectingContext = false;
      if (contextLines.length && !result.context) result.context = contextLines.join(' ');
      i++; continue;
    }

    const phaseMatch = line.match(/^PHASE\s+(\d+):\s*(.+)$/i);
    if (phaseMatch) {
      collectingContext = false;
      inBeyond = false;
      if (contextLines.length && !result.context) result.context = contextLines.join(' ');
      if (currentStream) { result.beyond.streams.push(currentStream); currentStream = null; }
      if (currentPhase) result.phases.push(currentPhase);
      currentPhase = { number: parseInt(phaseMatch[1]), name: phaseMatch[2].trim(), focus: '', works: [] };
      i++; continue;
    }

    // BEYOND section header
    if (line.match(/^BEYOND:\s*/)) {
      inBeyond = true;
      collectingContext = false;
      if (currentPhase) { result.phases.push(currentPhase); currentPhase = null; }
      const inline = line.replace(/^BEYOND:\s*/, '').trim();
      if (inline) result.beyond.summary = inline;
      i++; continue;
    }

    // STREAM within BEYOND
    const streamMatch = line.match(/^STREAM\s+(\d+):\s*(.+)$/i);
    if (streamMatch && inBeyond) {
      if (currentStream) result.beyond.streams.push(currentStream);
      currentStream = { number: parseInt(streamMatch[1]), name: streamMatch[2].trim(), focus: '', works: [] };
      i++; continue;
    }

    if (line.trim() === '---') { collectingContext = false; i++; continue; }

    if (collectingContext && line.trim() && !line.match(/^(PHASE|STREAM|BEYOND|TOTAL PATH)/i)) {
      contextLines.push(line.trim()); i++; continue;
    }

    // BEYOND summary continuation
    if (inBeyond && !currentStream && line.trim() && !line.match(/^STREAM/i)) {
      if (result.beyond.summary) result.beyond.summary += ' ' + line.trim();
      else result.beyond.summary = line.trim();
      i++; continue;
    }

    // Stream focus line
    if (currentStream && line.trim() && !line.match(/^-\s+/) && !line.match(/^\s*→/) && !currentStream.focus) {
      currentStream.focus = line.trim(); i++; continue;
    }

    // Works inside phase or stream
    const target = currentStream || currentPhase;
    if (target) {
      if (line.match(/^-\s+/)) {
        const workLine = line.slice(2).trim();
        const dashIdx = workLine.indexOf(' — ');
        target.works.push({
          ref: dashIdx >= 0 ? workLine.slice(0, dashIdx) : workLine,
          rationale: dashIdx >= 0 ? workLine.slice(dashIdx + 3) : '',
          focus: '',
        });
      } else if (line.match(/^\s*→\s*/) && target.works.length > 0) {
        target.works[target.works.length - 1].focus = line.replace(/^\s*→\s*(Focus:\s*)?/, '').trim();
      } else if (line.trim() && !target.focus && !line.match(/^(PHASE|STREAM|BEYOND|TOTAL PATH)/i)) {
        target.focus = line.trim();
      }
    }

    i++;
  }

  if (currentPhase) result.phases.push(currentPhase);
  if (currentStream) result.beyond.streams.push(currentStream);
  if (contextLines.length && !result.context) result.context = contextLines.join(' ');
  return result;
}
