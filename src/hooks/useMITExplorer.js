import { useState, useCallback, useMemo } from 'react';
import { fetchAllMITCourses, groupCoursesTree, treeFieldList, clearMITCache } from '../utils/mitHarvest';
import { syllabusSearch, seminalPapersHarvest } from '../utils/syllabusHarvest';

export function useMITExplorer() {
  const [allCourses, setAllCourses] = useState([]);
  const [loadProgress, setLoadProgress] = useState({ loaded: 0, total: 0 });
  const [loadPhase, setLoadPhase] = useState('idle');
  const [loadError, setLoadError] = useState(null);

  const [selectedField, setSelectedField] = useState('');
  const [books, setBooks] = useState([]);
  const [papers, setPapers] = useState([]);
  const [resourcesPhase, setResourcesPhase] = useState('idle');

  const tree = useMemo(() => groupCoursesTree(allCourses), [allCourses]);
  const fields = useMemo(() => treeFieldList(tree), [tree]);

  const doLoad = useCallback(async (force = false) => {
    setAllCourses([]);
    setLoadProgress({ loaded: 0, total: 0 });
    setLoadError(null);
    setLoadPhase('loading');
    try {
      const courses = await fetchAllMITCourses((loaded, total) => {
        setLoadProgress({ loaded, total });
      }, force);
      setAllCourses(courses);
      setLoadPhase(courses.length > 0 ? 'ready' : 'empty');
    } catch (err) {
      setLoadError(err.message || 'Failed to load MIT courses.');
      setLoadPhase('error');
    }
  }, []);

  const initLoad = useCallback(() => {
    if (loadPhase === 'idle') doLoad(false);
  }, [loadPhase, doLoad]);

  const scrapeLatest = useCallback(() => {
    clearMITCache();
    doLoad(true);
  }, [doLoad]);

  const selectField = useCallback(async (field) => {
    setSelectedField(field);
    setBooks([]);
    setPapers([]);
    setResourcesPhase('loading');
    try {
      const [bookResults, paperResults] = await Promise.all([
        syllabusSearch(field, 50),
        seminalPapersHarvest(field),
      ]);
      setBooks(bookResults.sort((a, b) => b.syllabusCount - a.syllabusCount).slice(0, 30));
      setPapers(paperResults.slice(0, 30));
      setResourcesPhase('done');
    } catch {
      setResourcesPhase('idle');
    }
  }, []);

  return {
    loadPhase, loadProgress, loadError,
    fields, tree, selectedField, books, papers, resourcesPhase,
    initLoad, selectField, scrapeLatest,
  };
}
