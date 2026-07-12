import { useState, useCallback } from 'react';

export function useOntologicalAtlas() {
  const [status, setStatus] = useState('idle');
  const [schools, setSchools] = useState([]);
  const [works, setWorks] = useState([]);
  const [personas, setPersonas] = useState([]);
  const [dilemmas, setDilemmas] = useState([]);
  const [crawlDate, setCrawlDate] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const { OA_SCHOOLS, OA_WORKS, OA_PERSONAS, OA_DILEMMAS, OA_CRAWL_DATE } =
        await import('../constants/ontologicalAtlas.js');
      setSchools(OA_SCHOOLS);
      setWorks(OA_WORKS);
      setPersonas(OA_PERSONAS);
      setDilemmas(OA_DILEMMAS);
      setCrawlDate(OA_CRAWL_DATE);
      setStatus('complete');
    } catch (e) {
      setError(e.message);
      setStatus('error');
    }
  }, []);

  return { status, schools, works, personas, dilemmas, crawlDate, error, load };
}
