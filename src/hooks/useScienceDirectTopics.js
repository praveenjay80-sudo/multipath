import { useState, useCallback } from 'react';

export function useScienceDirectTopics() {
  const [status, setStatus] = useState('idle');
  const [subjects, setSubjects] = useState([]);
  const [topicsBySubject, setTopicsBySubject] = useState({});
  const [total, setTotal] = useState(0);
  const [crawlDate, setCrawlDate] = useState(null);
  const [error, setError] = useState(null);
  const [scanStatus, setScanStatus] = useState('idle'); // 'idle' | 'scanning' | 'done' | 'error'
  const [newTopics, setNewTopics] = useState([]); // [{name, slug, currentCount, storedCount, diff}]

  const load = useCallback(async () => {
    setStatus('loading');
    setError(null);
    try {
      const { SD_SUBJECTS, SD_TOPICS_BY_SUBJECT, SD_TOTAL, SD_CRAWL_DATE } =
        await import('../constants/scienceDirectTopics.js');
      setSubjects(SD_SUBJECTS);
      setTopicsBySubject(SD_TOPICS_BY_SUBJECT || {});
      setTotal(SD_TOTAL);
      setCrawlDate(SD_CRAWL_DATE || null);
      setStatus('complete');
    } catch (e) {
      setError(e.message);
      setStatus('error');
    }
  }, []);

  const checkForUpdates = useCallback(async (storedSubjects) => {
    setScanStatus('scanning');
    setNewTopics([]);
    try {
      const res = await fetch('/api/html-proxy?url=' + encodeURIComponent('https://www.sciencedirect.com/topics'));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();

      // Parse subject links + counts: href="/topics/{slug}" with adjacent number
      const re = /href="\/topics\/([a-z0-9-]+)"[^>]*>([^<]+)<[^)]*\(?([\d,]+)\)?/g;
      // Simpler: find all anchor tags pointing to /topics/{slug} and extract text with number
      const re2 = /href="\/topics\/([^"\/]+)"[^>]*>\s*([^<]+?)([\d,]+)\s*</g;
      const liveCounts = {};
      let m;
      while ((m = re2.exec(html)) !== null) {
        const slug = m[1];
        const count = parseInt(m[3].replace(/,/g, ''));
        if (slug && count > 0) liveCounts[slug] = count;
      }

      const grown = storedSubjects
        .filter(s => liveCounts[s.slug] && liveCounts[s.slug] > s.count)
        .map(s => ({
          name: s.name,
          slug: s.slug,
          currentCount: liveCounts[s.slug],
          storedCount: s.count,
          diff: liveCounts[s.slug] - s.count,
        }));

      setNewTopics(grown);
      setScanStatus('done');
    } catch (e) {
      setScanStatus('error');
      setError(`Scan failed: ${e.message}. ScienceDirect may block server-side requests. Try again shortly.`);
    }
  }, []);

  return { status, subjects, topicsBySubject, total, crawlDate, error, load, scanStatus, newTopics, checkForUpdates };
}
