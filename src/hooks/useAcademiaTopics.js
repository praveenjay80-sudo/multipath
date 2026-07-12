import { useState, useCallback } from 'react';

export function useAcademiaTopics() {
  const [status, setStatus] = useState('idle');
  const [disciplines, setDisciplines] = useState([]);
  const [children, setChildren] = useState({});
  const [slugs, setSlugs] = useState({});
  const [total, setTotal] = useState(0);
  const [crawlDate, setCrawlDate] = useState(null);
  const [error, setError] = useState(null);
  const [newTopics, setNewTopics] = useState([]);
  const [scanStatus, setScanStatus] = useState('idle'); // 'idle' | 'scanning' | 'done' | 'error'

  const load = useCallback(async () => {
    setStatus('loading');
    setError(null);
    try {
      const { ACADEMIA_DISCIPLINES, ACADEMIA_CHILDREN, ACADEMIA_SLUGS, ACADEMIA_TOTAL, ACADEMIA_CRAWL_DATE } =
        await import('../constants/academiaTopics.js');
      setDisciplines(ACADEMIA_DISCIPLINES);
      setChildren(ACADEMIA_CHILDREN);
      setSlugs(ACADEMIA_SLUGS);
      setTotal(ACADEMIA_TOTAL);
      setCrawlDate(ACADEMIA_CRAWL_DATE || null);
      setStatus('complete');
    } catch (e) {
      setError(e.message);
      setStatus('error');
    }
  }, []);

  const checkForUpdates = useCallback(async (currentChildren) => {
    setScanStatus('scanning');
    setNewTopics([]);
    try {
      const res = await fetch('/api/html-proxy?url=' + encodeURIComponent('https://www.academia.edu/topics'));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();

      // Parse topic-card-link hrefs + topic-stats
      const re = /href="https?:\/\/www\.academia\.edu\/Documents\/in\/([^"]+)"[^>]*>[\s\S]*?<div class="topic-name">([^<]+)<\/div>[\s\S]*?<div class="topic-stats">(\d+) subtopics<\/div>/g;
      const found = [];
      let m;
      while ((m = re.exec(html)) !== null) {
        const name = m[2].trim();
        const liveCount = parseInt(m[3], 10);
        const storedCount = (currentChildren[name] || []).length;
        if (liveCount > storedCount) {
          found.push({ name, liveCount, storedCount, diff: liveCount - storedCount });
        }
      }
      setNewTopics(found);
      setScanStatus('done');
    } catch (e) {
      setScanStatus('error');
      setError(e.message);
    }
  }, []);

  return { status, disciplines, children, slugs, total, crawlDate, error, load, checkForUpdates, scanStatus, newTopics };
}
