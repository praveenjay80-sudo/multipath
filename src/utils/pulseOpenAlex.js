import { openAlexAuth } from './openAlexAuth';

const MAILTO = 'mailto=canon-app@praveen.dev';

async function fetchWithTimeout(url, options = {}, ms = 12000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...options, signal: ctrl.signal }).finally(() => clearTimeout(timer));
}

function extractAuthors(authorships) {
  return (authorships || []).slice(0, 3).map(a => a.author?.display_name).filter(Boolean).join(', ');
}

function oaWork(w) {
  return {
    title: w.title,
    authors: extractAuthors(w.authorships),
    authorList: (w.authorships || [])
      .map(a => ({ id: a.author?.id, name: a.author?.display_name }))
      .filter(a => a.id && a.name),
    year: w.publication_year,
    citationCount: w.cited_by_count || 0,
    fwci: w.fwci ?? null,
    percentile: w.cited_by_percentile_year?.min ?? null,
    type: w.type,
    isOA: w.open_access?.is_oa || false,
    oaUrl: w.open_access?.oa_url || null,
    venue: w.primary_location?.source?.display_name || null,
    doi: w.doi || null,
    countsByYear: w.counts_by_year || [],
  };
}

export function recentCitationVelocity(work) {
  const counts = work.countsByYear || [];
  const sorted = [...counts].sort((a, b) => b.year - a.year);
  return sorted.slice(0, 2).reduce((sum, c) => sum + (c.cited_by_count || 0), 0);
}

// Derived from the same fetched works — not a separate author-level API call
// (OpenAlex's Authors endpoint has no reliable topic filter, and this avoids
// burning extra credit budget). Attributes each work's citation count to
// every listed coauthor and ranks by the running total.
export function aggregateTopAuthors(works) {
  const byId = new Map();
  for (const w of works) {
    for (const a of w.authorList || []) {
      const cur = byId.get(a.id) || { id: a.id, name: a.name, citationCount: 0, workCount: 0 };
      cur.citationCount += w.citationCount || 0;
      cur.workCount += 1;
      byId.set(a.id, cur);
    }
  }
  return [...byId.values()].sort((a, b) => b.citationCount - a.citationCount);
}

// Topic ids from fetchOpenAlexTaxonomy() are full URLs (https://openalex.org/T10883);
// the filter param wants the bare id.
function bareId(id) {
  return id.split('/').pop();
}

// Broad OpenAlex topic nodes pull in software manuals, program docs, and bare
// journal/proceedings containers alongside real scholarship. type:article|book
// removes datasets/reports/editorials server-side; this catches what slips through.
const NOISE_TITLE_RE = /\b(user'?s?\s+guide|user\s+manual|reference\s+guide|reference\s+manual|instruction\s+manual|program\s+distributed\s+by|proceeding(s)?|symposium|workshop\s+on|for\s+windows|for\s+personal\s+computers|version\s+\d)\b/i;
// Bare journal/venue placeholders masquerading as a work title: "X forum",
// or a "<journal name> <volume>(<issue>) <year>" citation stub with no real title.
const NOISE_CONTAINER_RE = /\bforum$|\d+\(\d+\)\s+\d{4}$/i;

function isNoisyTitle(title) {
  const t = (title || '').trim();
  if (t.length < 8) return true;
  if (/^\d+$/.test(t)) return true;
  return NOISE_TITLE_RE.test(t) || NOISE_CONTAINER_RE.test(t);
}

// Batched by OpenAlex id (the `openalex:` filter takes up to 100 pipe-separated
// ids in one request) — h-index/i10-index are career-wide stats from each
// author's own profile, not scoped to this topic, so this is a separate call
// from fetchTopicWorks rather than something derivable from the works we have.
export async function fetchAuthorStats(authorIds) {
  const ids = authorIds.filter(Boolean).map(bareId);
  if (!ids.length) return {};
  const url = `https://api.openalex.org/authors?filter=openalex:${ids.join('|')}&select=id,summary_stats&per_page=${ids.length}&${MAILTO}${openAlexAuth()}`;
  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) return {};
    const json = await res.json();
    const map = {};
    for (const a of json.results || []) {
      map[a.id] = {
        hIndex: a.summary_stats?.h_index ?? null,
        i10Index: a.summary_stats?.i10_index ?? null,
      };
    }
    return map;
  } catch {
    return {};
  }
}

const WORK_SELECT = 'title,authorships,publication_year,cited_by_count,fwci,cited_by_percentile_year,type,open_access,primary_location,doi,counts_by_year';

async function runWorksQuery(url, limit) {
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`OpenAlex fetch failed: ${res.status}`);
  const json = await res.json();
  return (json.results || [])
    .map(oaWork)
    .filter(w => !isNoisyTitle(w.title))
    .slice(0, limit);
}

export async function fetchTopicWorks(topicId, limit = 30) {
  const fetchLimit = Math.min(limit * 3, 100);
  const url = `https://api.openalex.org/works?filter=topics.id:${encodeURIComponent(bareId(topicId))},type:article|book&select=${WORK_SELECT}&sort=cited_by_count:desc&per_page=${fetchLimit}&${MAILTO}${openAlexAuth()}`;
  return runWorksQuery(url, limit);
}

const STOPWORDS = new Set(['a', 'an', 'and', 'of', 'the', 'in', 'on', 'for', 'with', 'to', 'at', 'by', 'or', 'vs', 'via', 'as']);

// OpenAlex's `search` enables its own boolean mode when it sees the literal
// uppercase word AND/OR/NOT — joining the topic's significant words with AND
// requires every one of them to appear (anywhere, not necessarily adjacent),
// instead of the default loose match. That default loose match is *also*
// citation-boosted internally, so even sort=relevance_score:desc wasn't
// enough on its own — a query for "Modular forms and L-functions" still
// surfaced lme4, QUANTUM ESPRESSO, and InterProScan ahead of genuinely
// on-topic papers, because they merely contained "modular" and are hugely
// cited. Requiring every substantive word (via AND) rules those out.
function booleanAndQuery(topicName) {
  const words = topicName.split(/\s+/).map(w => w.trim()).filter(w => w && !STOPWORDS.has(w.toLowerCase()));
  return words.length > 1 ? words.join(' AND ') : topicName;
}

// For topics that don't come from the OpenAlex taxonomy (e.g. a Claude-suggested
// topic name) — falls back to full-text search instead of an exact topics.id
// filter, since there's no id to filter on.
export async function fetchTopicWorksByText(topicName, limit = 30) {
  const fetchLimit = Math.min(limit * 3, 100);
  const andQuery = booleanAndQuery(topicName);

  const strictUrl = `https://api.openalex.org/works?search=${encodeURIComponent(andQuery)}&filter=type:article|book&select=${WORK_SELECT}&sort=cited_by_count:desc&per_page=${fetchLimit}&${MAILTO}${openAlexAuth()}`;
  const strict = await runWorksQuery(strictUrl, limit);
  if (strict.length >= 5 || andQuery === topicName) return strict;

  // Requiring every word was too strict for this phrasing (near-empty result) —
  // fall back to a relevance-ranked loose search rather than showing nothing.
  const looseUrl = `https://api.openalex.org/works?search=${encodeURIComponent(topicName)}&filter=type:article|book&select=${WORK_SELECT}&sort=relevance_score:desc&per_page=${fetchLimit}&${MAILTO}${openAlexAuth()}`;
  return runWorksQuery(looseUrl, limit);
}
