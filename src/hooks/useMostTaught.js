import { useState, useCallback } from 'react';

export function useMostTaught() {
  const [status, setStatus] = useState('idle');
  const [fields, setFields] = useState([]);
  const [titlesByField, setTitlesByField] = useState({});
  const [subfieldsByField, setSubfieldsByField] = useState({});
  const [subfieldNames, setSubfieldNames] = useState({});
  const [globalTop, setGlobalTop] = useState([]);
  const [disciplineGroups, setDisciplineGroups] = useState({});
  const [meta, setMeta] = useState(null);
  const [crawlDate, setCrawlDate] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setStatus('loading');
    setError(null);
    try {
      const {
        OSP_FIELDS, OSP_TITLES_BY_FIELD, OSP_SUBFIELDS_BY_FIELD,
        OSP_SUBFIELD_NAMES, OSP_GLOBAL_TOP, OSP_DISCIPLINE_GROUPS,
        OSP_META, OSP_CRAWL_DATE,
      } = await import('../constants/ospData.js');
      setFields(OSP_FIELDS);
      setTitlesByField(OSP_TITLES_BY_FIELD);
      setSubfieldsByField(OSP_SUBFIELDS_BY_FIELD);
      setSubfieldNames(OSP_SUBFIELD_NAMES);
      setGlobalTop(OSP_GLOBAL_TOP);
      setDisciplineGroups(OSP_DISCIPLINE_GROUPS);
      setMeta(OSP_META);
      setCrawlDate(OSP_CRAWL_DATE);
      setStatus('complete');
    } catch (e) {
      setError(e.message);
      setStatus('error');
    }
  }, []);

  return {
    status, fields, titlesByField, subfieldsByField, subfieldNames,
    globalTop, disciplineGroups, meta, crawlDate, error, load,
  };
}
