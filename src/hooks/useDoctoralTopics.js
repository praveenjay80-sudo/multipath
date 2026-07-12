import { useState, useCallback } from 'react';

const SITEMAP_COUNT = 13;
const BASE = 'https://phd.nthrys.com';
const PATCHES_KEY = 'doctoral_topics_patches';
const CHECKED_KEY = 'doctoral_topics_checked';

function loadPatches() {
  try { return JSON.parse(localStorage.getItem(PATCHES_KEY) || '{}'); } catch { return {}; }
}

function savePatches(patches) {
  try { localStorage.setItem(PATCHES_KEY, JSON.stringify(patches)); } catch {}
}

function applyPatches(subjects, topicsBySubject, totalTopics, patches) {
  if (!Object.keys(patches).length) return { subjects, topicsBySubject, totalTopics };
  const merged = {};
  for (const sub of subjects) merged[sub] = [...topicsBySubject[sub]];
  for (const [sub, newTopics] of Object.entries(patches)) {
    if (!merged[sub]) merged[sub] = [];
    const existing = new Set(merged[sub]);
    for (const t of newTopics) if (!existing.has(t)) merged[sub].push(t);
    merged[sub].sort();
  }
  const mergedSubjects = Object.keys(merged).sort();
  let total = 0;
  for (const sub of mergedSubjects) total += merged[sub].length;
  return { subjects: mergedSubjects, topicsBySubject: merged, totalTopics: total };
}

async function fetchSitemapViaProxy(n) {
  const target = encodeURIComponent(`${BASE}/sitemap/${String(n).padStart(4, '0')}.xml`);
  const res = await fetch(`/api/html-proxy?url=${target}`);
  if (!res.ok) throw new Error(`Sitemap ${n} failed: ${res.status}`);
  return res.text();
}

function parseLevel2(xml) {
  const result = {};
  const re = /<loc>https:\/\/phd\.nthrys\.com\/([^/<]+)\/([^/<\s]+)<\/loc>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const subject = m[1];
    const topic = m[2];
    if (!result[subject]) result[subject] = new Set();
    result[subject].add(topic);
  }
  return result;
}

function slugToName(slug) {
  return slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export function useDoctoralTopics() {
  const [status, setStatus] = useState('idle');
  const [subjects, setSubjects] = useState([]);
  const [topicsBySubject, setTopicsBySubject] = useState({});
  const [totalTopics, setTotalTopics] = useState(0);
  const [error, setError] = useState(null);
  const [updateCount, setUpdateCount] = useState(0);
  const [lastChecked, setLastChecked] = useState(() => {
    try { return parseInt(localStorage.getItem(CHECKED_KEY), 10) || null; } catch { return null; }
  });

  const load = useCallback(async () => {
    setStatus('loading');
    setError(null);
    try {
      // Dynamic import keeps the 14 MB data file out of the main bundle
      const { DOCTORAL_SUBJECTS, DOCTORAL_TOPICS, DOCTORAL_TOTAL } =
        await import('../constants/doctoralTopics.js');
      const patches = loadPatches();
      const result = applyPatches(DOCTORAL_SUBJECTS, DOCTORAL_TOPICS, DOCTORAL_TOTAL, patches);
      setSubjects(result.subjects);
      setTopicsBySubject(result.topicsBySubject);
      setTotalTopics(result.totalTopics);
      setStatus('complete');
    } catch (e) {
      setError(e.message);
      setStatus('error');
    }
  }, []);

  const checkForUpdates = useCallback(async (currentTopicsBySubject) => {
    setStatus('updating');
    setError(null);

    const indices = Array.from({ length: SITEMAP_COUNT }, (_, i) => i + 1);
    const results = await Promise.allSettled(indices.map(fetchSitemapViaProxy));

    const fresh = {};
    for (const r of results) {
      if (r.status !== 'fulfilled') continue;
      const parsed = parseLevel2(r.value);
      for (const [sub, topics] of Object.entries(parsed)) {
        if (!fresh[sub]) fresh[sub] = new Set();
        for (const t of topics) fresh[sub].add(t);
      }
    }

    if (!Object.keys(fresh).length) {
      setError('Could not reach phd.nthrys.com via proxy. Try again later.');
      setStatus('complete');
      return;
    }

    const patches = loadPatches();
    let newCount = 0;

    for (const [sub, freshTopics] of Object.entries(fresh)) {
      const current = new Set(currentTopicsBySubject[sub] || []);
      for (const t of freshTopics) {
        if (!current.has(t)) {
          if (!patches[sub]) patches[sub] = [];
          if (!patches[sub].includes(t)) { patches[sub].push(t); newCount++; }
        }
      }
    }

    savePatches(patches);
    const now = Date.now();
    try { localStorage.setItem(CHECKED_KEY, now.toString()); } catch {}

    // Re-import static base and reapply all patches
    const { DOCTORAL_SUBJECTS, DOCTORAL_TOPICS, DOCTORAL_TOTAL } =
      await import('../constants/doctoralTopics.js');
    const result = applyPatches(DOCTORAL_SUBJECTS, DOCTORAL_TOPICS, DOCTORAL_TOTAL, patches);
    setSubjects(result.subjects);
    setTopicsBySubject(result.topicsBySubject);
    setTotalTopics(result.totalTopics);
    setUpdateCount(newCount);
    setLastChecked(now);
    setStatus('complete');
  }, []);

  return {
    status, subjects, topicsBySubject, totalTopics,
    slugToName, error, load, checkForUpdates, lastChecked, updateCount,
  };
}
