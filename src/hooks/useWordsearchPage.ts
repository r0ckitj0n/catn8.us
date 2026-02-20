import React, { useState } from 'react';
import { ApiClient } from '../core/ApiClient';
import { pickWordsForPage, buildWordSearch, generateWordsearchQuickFacts } from '../utils/wordsearchUtils';

export function useWordsearchPage(viewer: any, setError: (err: string) => void) {
  const isLoggedIn = Number(viewer?.id || 0) > 0;
  const [topics, setTopics] = useState<any[]>([]);
  const [topicId, setTopicId] = React.useState('');
  const [topic, setTopic] = useState<any>(null);
  const [puzzles, setPuzzles] = useState<any[]>([]);
  const [puzzleId, setPuzzleId] = React.useState('');
  const [puzzle, setPuzzle] = useState<any>(null);
  const [pages, setPages] = useState<any[]>([]);
  const [pageId, setPageId] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [isAdmin, setIsAdmin] = React.useState(0);
  const [printJobs, setPrintJobs] = useState<any[]>([]);
  const setErrorRef = React.useRef(setError);

  React.useEffect(() => {
    setErrorRef.current = setError;
  }, [setError]);

  const reportError = React.useCallback((fallback: string, e: any) => {
    setErrorRef.current(e?.message || fallback);
  }, []);

  const loadTopics = React.useCallback(() => {
    setBusy(true);
    setErrorRef.current('');
    ApiClient.get('/api/wordsearch/topics.php?action=list')
      .then((res) => {
        const t = Array.isArray(res?.topics) ? res.topics : [];
        setTopics(t);
        if (t.length) {
          setTopicId((prev) => (prev ? prev : String(t[0].id)));
        }
      })
      .catch((e) => reportError('Failed to load topics', e))
      .finally(() => setBusy(false));
  }, [reportError]);

  const loadPuzzles = React.useCallback(() => {
    setBusy(true);
    setErrorRef.current('');
    ApiClient.get('/api/wordsearch/puzzles.php?action=list')
      .then((res) => {
        const list = Array.isArray(res?.puzzles) ? res.puzzles : [];
        setPuzzles(list);
        if (list.length) {
          setPuzzleId((prev) => (prev ? prev : String(list[0].id)));
        }
        setIsAdmin(Number(res?.viewer?.is_admin || 0));
      })
      .catch((e) => reportError('Failed to load puzzles', e))
      .finally(() => setBusy(false));
  }, [reportError]);

  React.useEffect(() => {
    if (!isLoggedIn) return;
    loadTopics();
    loadPuzzles();
  }, [isLoggedIn, loadTopics, loadPuzzles]);

  React.useEffect(() => {
    if (!isLoggedIn) return;
    const id = Number(topicId);
    if (!id) return;
    setBusy(true);
    setErrorRef.current('');
    setTopic(null);
    ApiClient.get('/api/wordsearch/topics.php?action=get&id=' + String(id))
      .then((res) => setTopic(res?.topic || null))
      .catch((e) => reportError('Failed to load topic', e))
      .finally(() => setBusy(false));
  }, [topicId, isLoggedIn, reportError]);

  React.useEffect(() => {
    if (!isLoggedIn) return;
    const id = Number(puzzleId);
    if (!id) {
      setPages([]);
      setPageId('');
      setPuzzle(null);
      return;
    }

    setBusy(true);
    setErrorRef.current('');
    setPuzzle(null);
    setPages([]);
    setPageId('');

    ApiClient.get('/api/wordsearch/puzzles.php?action=get&id=' + String(id))
      .then((res) => {
        const p = res?.puzzle || null;
        setPuzzle(p);
        if (p && p.topic_id) setTopicId(String(p.topic_id));
      })
      .catch((e) => reportError('Failed to load puzzle', e))
      .finally(() => setBusy(false));

    ApiClient.get('/api/wordsearch/pages.php?action=list&puzzle_id=' + String(id))
      .then((res) => {
        const list = Array.isArray(res?.pages) ? res.pages : [];
        setPages(list);
        if (list.length) setPageId(String(list[0].id));
      })
      .catch((e) => reportError('Failed to load pages', e));
  }, [puzzleId, isLoggedIn, reportError]);

  const reloadPages = async (pid: string | number) => {
    const id = Number(pid);
    if (!id) return;
    try {
      const res = await ApiClient.get('/api/wordsearch/pages.php?action=list&puzzle_id=' + String(id));
      const list = Array.isArray(res?.pages) ? res.pages : [];
      setPages(list);
      if (list.length && !list.find((p) => String(p.id) === String(pageId))) {
        setPageId(String(list[0].id));
      }
    } catch (e) {
      reportError('Failed to reload pages', e);
    }
  };

  const selectedPage = React.useMemo(() => {
    const id = Number(pageId);
    if (!id) return null;
    return pages.find((p) => Number(p.id) === id) || null;
  }, [pages, pageId]);

  const canEditPuzzle = React.useMemo(() => {
    const uid = Number(viewer?.id || 0);
    if (!uid) return false;
    if (Number(viewer?.is_admin || 0) === 1) return true;
    return Number(puzzle?.owner_user_id || 0) === uid;
  }, [viewer, puzzle]);

  const generateAllPages = async () => {
    if (!canEditPuzzle || !puzzle || !topic) return;
    setBusy(true);
    setErrorRef.current('');
    try {
      const settingsRes = await ApiClient.get('/api/wordsearch/settings.php');
      const wsSettings = settingsRes?.settings || {};
      const wordsPerPage = Number(topic.words_per_page || 15);
      const baseSeed = (Date.now() ^ (Number(puzzle.id) * 1009)) >>> 0;
      const total = Number(puzzle.pages_count || 1);
      const limit = Math.min(Math.max(total, 1), 200);

      for (let pageNumber = 1; pageNumber <= limit; pageNumber += 1) {
        const seed = (baseSeed + (pageNumber * 7919)) >>> 0;
        const words = pickWordsForPage({ allWords: topic.words, count: wordsPerPage, gridSize: Number(puzzle.grid_size || 12), seed: seed + 17 });
        const out = buildWordSearch({ size: Number(puzzle.grid_size || 12), words, seed, difficulty: String(puzzle.difficulty || 'easy') });

        const qf = generateWordsearchQuickFacts({ topic, puzzleTitle: puzzle.title, pageNumber, words: out.words, settings: wsSettings });
        await ApiClient.post('/api/wordsearch/pages.php?action=upsert', {
          puzzle_id: puzzle.id,
          page_number: pageNumber,
          seed: String(seed),
          words: out.words,
          grid: out.grid,
          description: qf.description,
          summary: qf.summary,
        });
      }

      await reloadPages(puzzle.id);
    } catch (e: any) {
      reportError('Generate pages failed', e);
    } finally {
      setBusy(false);
    }
  };

  const buildPrintJobs = async (selectedPuzzleIds: string[]) => {
    const picked = (Array.isArray(selectedPuzzleIds) ? selectedPuzzleIds : []).map((id) => String(id));
    if (!picked.length) throw new Error('Select at least one puzzle to print.');

    const byId = new Map(puzzles.map((p) => [String(p.id), p]));
    const jobs = [];

    for (const pid of picked) {
      const p = byId.get(pid);
      if (!p) continue;
      const res = await ApiClient.get('/api/wordsearch/pages.php?action=list&puzzle_id=' + String(pid));
      const list = Array.isArray(res?.pages) ? res.pages : [];
      for (const pg of list) {
        jobs.push({ puzzle: p, page: pg });
      }
    }

    if (!jobs.length) throw new Error('No pages found to print for the selected puzzles.');

    setPrintJobs(jobs);
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
    window.print();
  };

  return {
    isLoggedIn,
    topics, setTopics,
    topicId, setTopicId,
    topic, setTopic,
    puzzles, setPuzzles,
    puzzleId, setPuzzleId,
    puzzle, setPuzzle,
    pages, setPages,
    pageId, setPageId,
    busy, setBusy,
    isAdmin,
    printJobs,
    selectedPage,
    canEditPuzzle,
    loadTopics,
    loadPuzzles,
    reloadPages,
    generateAllPages,
    buildPrintJobs
  };
}
