export const SECTION_CONFIG = {
  orientation: {
    key: 'orientation',
    label: 'Orientation',
    accent: 'text-amber-800',
    badge: 'bg-amber-100 text-amber-800 border border-amber-200',
    border: 'border-l-amber-500',
    headerBg: 'bg-amber-50',
    headerBorder: 'border-b border-amber-100',
    dot: 'bg-amber-500',
  },
  core: {
    key: 'core',
    label: 'Core',
    accent: 'text-stone-900',
    badge: 'bg-stone-900 text-white',
    border: 'border-l-stone-900',
    headerBg: 'bg-stone-900',
    headerBorder: '',
    dot: 'bg-stone-900',
    invertHeader: true,
  },
  'technical-depth': {
    key: 'technical-depth',
    label: 'Technical Depth',
    accent: 'text-blue-800',
    badge: 'bg-blue-100 text-blue-800 border border-blue-200',
    border: 'border-l-blue-600',
    headerBg: 'bg-blue-50',
    headerBorder: 'border-b border-blue-100',
    dot: 'bg-blue-600',
  },
  contemporary: {
    key: 'contemporary',
    label: 'Contemporary',
    accent: 'text-emerald-800',
    badge: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
    border: 'border-l-emerald-600',
    headerBg: 'bg-emerald-50',
    headerBorder: 'border-b border-emerald-100',
    dot: 'bg-emerald-600',
  },
  papers: {
    key: 'papers',
    label: 'Seminal Papers',
    accent: 'text-violet-800',
    badge: 'bg-violet-100 text-violet-800 border border-violet-200',
    border: 'border-l-violet-600',
    headerBg: 'bg-violet-50',
    headerBorder: 'border-b border-violet-100',
    dot: 'bg-violet-600',
  },
  // Subfield canon sections
  textbooks: {
    key: 'textbooks',
    label: 'Core Textbooks',
    accent: 'text-amber-800',
    badge: 'bg-amber-100 text-amber-800 border border-amber-200',
    border: 'border-l-amber-500',
    headerBg: 'bg-amber-50',
    headerBorder: 'border-b border-amber-100',
    dot: 'bg-amber-500',
  },
  monographs: {
    key: 'monographs',
    label: 'Research Monographs',
    accent: 'text-blue-800',
    badge: 'bg-blue-100 text-blue-800 border border-blue-200',
    border: 'border-l-blue-600',
    headerBg: 'bg-blue-50',
    headerBorder: 'border-b border-blue-100',
    dot: 'bg-blue-600',
  },
};

// Backward compat for saved canons using old Tier N format
export const TIER_COLORS = {
  1: { key: 'tier-1', label: 'Tier 1', accent: 'text-blue-700', badge: 'bg-blue-50 text-blue-700', border: 'border-l-blue-700', headerBg: 'bg-blue-50', headerBorder: 'border-b border-blue-100', dot: 'bg-blue-700' },
  2: { key: 'tier-2', label: 'Tier 2', accent: 'text-indigo-600', badge: 'bg-indigo-50 text-indigo-600', border: 'border-l-indigo-600', headerBg: 'bg-indigo-50', headerBorder: 'border-b border-indigo-100', dot: 'bg-indigo-600' },
  3: { key: 'tier-3', label: 'Tier 3', accent: 'text-violet-600', badge: 'bg-violet-50 text-violet-600', border: 'border-l-violet-600', headerBg: 'bg-violet-50', headerBorder: 'border-b border-violet-100', dot: 'bg-violet-600' },
  4: { key: 'tier-4', label: 'Tier 4', accent: 'text-amber-600', badge: 'bg-amber-50 text-amber-600', border: 'border-l-amber-500', headerBg: 'bg-amber-50', headerBorder: 'border-b border-amber-100', dot: 'bg-amber-500' },
  5: { key: 'tier-5', label: 'Tier 5', accent: 'text-emerald-600', badge: 'bg-emerald-50 text-emerald-600', border: 'border-l-emerald-600', headerBg: 'bg-emerald-50', headerBorder: 'border-b border-emerald-100', dot: 'bg-emerald-600' },
};

function classifySection(heading) {
  const h = heading.toLowerCase().trim();
  if (h === 'orientation') return 'orientation';
  if (h === 'core') return 'core';
  if (/^technical[\s-]*depth$/.test(h)) return 'technical-depth';
  if (h === 'contemporary') return 'contemporary';
  if (/^(seminal|foundational)\s*papers?$/.test(h)) return 'papers';
  if (/^core\s+textbooks?$/.test(h)) return 'textbooks';
  if (/^research\s+monographs?$/.test(h)) return 'monographs';
  return null;
}

export function parseCanon(markdown) {
  if (!markdown) return null;

  const result = {
    topic: '',
    tiers: [],
    prerequisites: null,
    whatsMissing: null,
    oneBook: null,
    criticsNotes: null,
    revisionNotes: null,
  };

  const topicMatch = markdown.match(/^##\s+Canon:\s*(.+)/m);
  if (topicMatch) result.topic = topicMatch[1].trim();

  const sectionMatches = [...markdown.matchAll(/^###\s+(.+)$/gm)];

  for (let i = 0; i < sectionMatches.length; i++) {
    const match = sectionMatches[i];
    const heading = match[1].trim();
    const start = match.index + match[0].length;
    const end = sectionMatches[i + 1]?.index ?? markdown.length;
    const body = markdown.slice(start, end).trim();

    // New-style named sections
    const sectionKey = classifySection(heading);
    if (sectionKey) {
      const { description, entries } = parseTierBody(body);
      result.tiers.push({
        sectionKey,
        subtitle: '',
        label: heading,
        config: SECTION_CONFIG[sectionKey],
        isPaper: sectionKey === 'papers',
        description,
        entries,
      });

      continue;
    }

    // Old-style Tier N sections (backward compat)
    const tierMatch = heading.match(/^Tier\s+(\d+)\s*[—–-]+\s*(.+)/);
    if (tierMatch) {
      const num = parseInt(tierMatch[1]);
      const { description, entries } = parseTierBody(body);
      result.tiers.push({
        sectionKey: `tier-${num}`,
        subtitle: tierMatch[2].trim(),
        label: heading,
        config: TIER_COLORS[num] || TIER_COLORS[1],
        isPaper: num === 4,
        description,
        entries,
      });
      continue;
    }

    if (/^prerequisites/i.test(heading)) {
      result.prerequisites = body;
    } else if (/what.s missing/i.test(heading)) {
      result.whatsMissing = body;
    } else if (/the one book/i.test(heading)) {
      result.oneBook = body;
    } else if (/critic.s notes/i.test(heading)) {
      result.criticsNotes = body;
    } else if (/revision notes/i.test(heading)) {
      result.revisionNotes = body;
    }
  }

  return result;
}

function parseTierBody(text) {
  const firstEntryIndex = text.search(/^\*\*/m);

  let description = '';
  let entryText = text;

  if (firstEntryIndex > 0) {
    description = text.slice(0, firstEntryIndex).trim().replace(/^\*|\*$/g, '');
    entryText = text.slice(firstEntryIndex);
  } else if (firstEntryIndex === -1) {
    description = text.replace(/^\*|\*$/g, '');
    entryText = '';
  }

  return { description, entries: entryText ? parseEntries(entryText) : [] };
}

function parseEntries(text) {
  const entries = [];
  const lines = text.split('\n');
  let currentLines = [];

  for (const line of lines) {
    if (line.match(/^\*\*.+\*\*/) && currentLines.length > 0) {
      const entry = parseEntry(currentLines);
      if (entry) entries.push(entry);
      currentLines = [line];
    } else {
      currentLines.push(line);
    }
  }

  if (currentLines.length > 0) {
    const entry = parseEntry(currentLines);
    if (entry) entries.push(entry);
  }

  return entries;
}

function parseEntry(lines) {
  const filtered = lines.filter(l => l.trim());
  if (filtered.length === 0) return null;

  const firstLine = filtered[0];
  if (!firstLine.match(/^\*\*.+\*\*/)) return null;

  const titleContent = firstLine.replace(/^\*\*|\*\*\s*$/g, '').trim();
  const { title, author, year } = parseTitleLine(titleContent);

  const entry = { title, author, year };

  for (let i = 1; i < filtered.length; i++) {
    const fieldMatch = filtered[i].match(/^\*([^*:]+):\*\s*(.*)/);
    if (fieldMatch) {
      const rawKey = fieldMatch[1].trim().toLowerCase();
      const value = fieldMatch[2].trim();
      if (rawKey === 'description') entry.description = value;
      else if (rawKey === 'why canonical') entry.whyCanonical = value;
      else if (rawKey === 'why this tier') entry.whyThisTier = value;
      else if (rawKey === 'key chapters') entry.keyChapters = value;
      else if (rawKey === 'core contribution') entry.coreContribution = value;
      else if (rawKey === 'audience') entry.audience = value;
      else if (rawKey === 'difficulty') entry.difficulty = value;
      else if (rawKey === 'prerequisite' || rawKey === 'prerequisites') entry.prerequisites = value;
      else if (rawKey === 'access') entry.access = value;
    }
  }

  return entry;
}

function parseTitleLine(text) {
  const dashMatch =
    text.match(/^(.+?)\s*[—–]{1}\s*(.+?)\s*\((\d{4}(?:[–-]\d{2,4})?)\)\s*$/) ||
    text.match(/^(.+?)\s*--\s*(.+?)\s*\((\d{4}(?:[–-]\d{2,4})?)\)\s*$/);

  if (dashMatch) {
    return { title: dashMatch[1].trim(), author: dashMatch[2].trim(), year: dashMatch[3] };
  }

  const yearOnlyMatch = text.match(/^(.+)\s*\((\d{4}(?:[–-]\d{2,4})?)\)\s*$/);
  if (yearOnlyMatch) {
    return { title: yearOnlyMatch[1].trim(), author: '', year: yearOnlyMatch[2] };
  }

  return { title: text, author: '', year: '' };
}

export function parseBullets(text) {
  if (!text) return [];
  const lines = text.split('\n');
  const bullets = [];
  let current = null;

  for (const line of lines) {
    const bulletMatch = line.match(/^[\-\*•]\s+(.+)/);
    if (bulletMatch) {
      if (current !== null) bullets.push(current);
      current = bulletMatch[1];
    } else if (current !== null && line.trim()) {
      current += ' ' + line.trim();
    }
  }

  if (current !== null) bullets.push(current);
  if (bullets.length === 0) return text.split('\n').filter(l => l.trim());
  return bullets;
}
