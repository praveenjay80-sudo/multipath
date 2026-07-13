// Parse Claude's streamed text to extract entity mentions:
// works, concepts, researchers.
//
// We do regex-based extraction, not LLM-based, because we need this
// to be incremental (every streamed chunk) and not require an extra
// Claude call. The trade-off is precision: we link exact-text matches
// and accept some misses, but never false positives on the indices.

// ── Works: "Title" by Author (Year) ─ annotation ──────────────────────────

const WORK_PATTERNS = [
  // "Title" by Author (Year) — annotation (handles straight, left-curly, right-curly quotes)
  /["""]([^"""]{3,200})["""]\s+by\s+([^()]+?)\s*\((\d{4})\)/g,
  // **Title** by Author (Year)
  /\*\*([^*]{3,200})\*\*\s+by\s+([^()]+?)\s*\((\d{4})\)/g,
];

export function extractWorks(text) {
  const works = [];
  const seen = new Set();

  for (const pattern of WORK_PATTERNS) {
    let m;
    const re = new RegExp(pattern.source, pattern.flags);
    while ((m = re.exec(text)) !== null) {
      const title = m[1].trim();
      const authorStr = m[2].trim();
      const year = parseInt(m[3], 10);
      // First author (split on comma, "and", "&")
      const firstAuthor = authorStr.split(/,\s*|\s+and\s+|\s+&\s+/)[0].trim();
      const key = `${title.toLowerCase()}|${firstAuthor.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      works.push({
        title,
        firstAuthor,
        allAuthors: authorStr,
        year,
        index: m.index,
      });
    }
  }
  return works;
}

// ── Concepts: lines under "### Tier N: ... Concepts" sections ──────────────

const CONCEPT_HEADER = /Tier\s+(\d)[:\s]+(.+)/i;

export function extractConcepts(text) {
  const concepts = [];
  const seen = new Set();
  const lines = text.split('\n');
  let currentTier = null;
  let currentTierName = null;

  for (const line of lines) {
    const trimmed = line.trim();

    const headerMatch = trimmed.match(/^###\s+(.+)/);
    if (headerMatch) {
      const h = headerMatch[1];
      const tierMatch = h.match(CONCEPT_HEADER);
      if (tierMatch) {
        currentTier = tierMatch[1];
        currentTierName = h;
      } else if (h.match(/Concepts?/i)) {
        currentTier = '0';
        currentTierName = h;
      } else {
        currentTier = null;
        currentTierName = null;
      }
      continue;
    }

    if (currentTier === null) continue;

    // Handle all formats Claude might use as the separator or leading marker:
    // - **Name** — def  |  - **Name** – def  |  - **Name**: def  |  - Name — def
    // **Name** — def  |  **Name**: def  |  1. **Name** — def
    const m = trimmed.match(/^(?:[-*•]|\d+\.)\s+\*?\*?([^*\n—–]{2,80}?)\*?\*?\s*[—–]\s+(.{3,})/)
           || trimmed.match(/^\*\*([^*\n—–]{2,80}?)\*\*\s*[—–]\s+(.{3,})/)
           || trimmed.match(/^(?:[-*•]|\d+\.)\s+\*?\*?([^*\n:]{2,60}?)\*?\*?:\s+(.{10,})/)
           || trimmed.match(/^\*\*([^*\n:]{2,60}?)\*\*:\s+(.{10,})/);
    if (m) {
      const name = m[1].trim();
      const rawGroup2 = m[2].trim();
      // Split definition from Claude-generated canonical works (pipe separator)
      const pipeIdx = rawGroup2.indexOf(' | ');
      const definition = pipeIdx >= 0 ? rawGroup2.slice(0, pipeIdx).trim() : rawGroup2;
      const worksStr = pipeIdx >= 0 ? rawGroup2.slice(pipeIdx + 3) : '';

      // Parse canonical works embedded in the concept line
      const canonicalWorks = [];
      if (worksStr) {
        for (const pattern of WORK_PATTERNS) {
          const re = new RegExp(pattern.source, pattern.flags);
          let wm;
          while ((wm = re.exec(worksStr)) !== null) {
            const firstAuthor = wm[2].trim().split(/,\s*|\s+and\s+|\s+&\s+/)[0].trim();
            canonicalWorks.push({ title: wm[1].trim(), author: firstAuthor, year: parseInt(wm[3], 10) });
          }
        }
      }

      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      concepts.push({
        name,
        definition,
        tier: currentTier,
        tierName: currentTierName,
        canonicalWorks,
      });
    }
  }
  return concepts;
}

// ── Researchers: lines under "### Foundational Thinkers" or "Active Researchers"

export function extractResearchers(text) {
  const researchers = [];
  const seen = new Set();
  const lines = text.split('\n');
  let currentKind = null; // 'foundational' | 'active'

  for (const line of lines) {
    const trimmed = line.trim();
    const headerMatch = trimmed.match(/^###\s+(.+)/);
    if (headerMatch) {
      const h = headerMatch[1].toLowerCase();
      if (h.includes('foundational')) currentKind = 'foundational';
      else if (h.includes('active')) currentKind = 'active';
      else currentKind = null;
      continue;
    }
    if (currentKind === null) continue;

    // - Name (1844-1906) — contribution
    // - **Name** — contribution
    // - Name — contribution
    const m = trimmed.match(/^[-*]\s+\*?\*?([^*\n—\-]{2,80}?)\*?\*?(?:\s*\(\d{4}[-–]\d{0,4}\))?\s*[—\-]\s+(.{3,})/);
    if (m) {
      const name = m[1].replace(/\s*\(\d{4}[-–]\d{0,4}\)/, '').trim();
      const contribution = m[2].trim();
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      researchers.push({ name, contribution, kind: currentKind });
    }
  }
  return researchers;
}

// ── Convenience: parse everything at once ─────────────────────────────────

export function parseAll(text) {
  return {
    works: extractWorks(text),
    concepts: extractConcepts(text),
    researchers: extractResearchers(text),
  };
}
