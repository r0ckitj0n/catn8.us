import React from 'react';
import { PageLayout } from '../layout/PageLayout';
import { WordsearchSettingsModal } from '../modals/WordsearchSettingsModal';
import { WordsearchPrintModal } from '../modals/WordsearchPrintModal';
import { TopicManagerModal } from '../modals/TopicManagerModal';
import { PuzzleManagerModal } from '../modals/PuzzleManagerModal';
import { ManagePuzzlesModal } from '../modals/ManagePuzzlesModal';
import { IToast } from '../../types/common';
import { useWordsearchPage } from '../../hooks/useWordsearchPage';
import { WordsearchToolbar } from './sections/wordsearch/WordsearchToolbar';
import { WordsearchGrid } from './sections/wordsearch/WordsearchGrid';
import { WordsearchPrintView } from './sections/wordsearch/WordsearchPrintView';
import { ApiClient } from '../../core/ApiClient';
import { pickWordsForPage, buildWordSearch, generateWordsearchQuickFacts } from '../../utils/wordsearchUtils';
import { AppShellPageProps } from '../../types/pages/commonPageProps';

interface WordsearchPageProps extends AppShellPageProps {
  onToast: (toast: IToast) => void;
}

/**
 * WordsearchPage - Refactored Page Component
 * COMPLIANCE: File size < 250 lines
 */
export function WordsearchPage({ viewer, onLoginClick, onLogout, onAccountClick, onToast, mysteryTitle }: WordsearchPageProps) {
  const state = useWordsearchPage(viewer, (err) => onToast({ tone: 'error', message: err }));

  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [topicsOpen, setTopicsOpen] = React.useState(false);
  const [puzzlesOpen, setPuzzlesOpen] = React.useState(false);
  const [managePuzzlesOpen, setManagePuzzlesOpen] = React.useState(false);
  const [printOpen, setPrintOpen] = React.useState(false);

  const regeneratePage = async () => {
    if (!state.canEditPuzzle || !state.puzzle || !state.selectedPage || !state.topic) return;
    state.setBusy(true);
    try {
      const settingsRes = await ApiClient.get('/api/wordsearch/settings.php');
      const wsSettings = settingsRes?.settings || {};
      const wordsPerPage = Number(state.topic.words_per_page || 15);
      const seed = (Date.now() ^ (Number(state.puzzle.id) * 1009) ^ (Number(state.selectedPage.page_number) * 7919)) >>> 0;
      const words = pickWordsForPage({ allWords: state.topic.words, count: wordsPerPage, gridSize: Number(state.puzzle.grid_size || 12), seed: seed + 17 });
      const out = buildWordSearch({ size: Number(state.puzzle.grid_size || 12), words, seed, difficulty: String(state.puzzle.difficulty || 'easy') });

      const qf = generateWordsearchQuickFacts({ topic: state.topic, puzzleTitle: state.puzzle.title, pageNumber: state.selectedPage.page_number, words: out.words, settings: wsSettings });
      await ApiClient.post('/api/wordsearch/pages.php?action=upsert', {
        puzzle_id: state.puzzle.id,
        page_number: state.selectedPage.page_number,
        seed: String(seed),
        words: out.words,
        grid: out.grid,
        description: qf.description,
        summary: qf.summary,
      });
      await state.reloadPages(state.puzzle.id);
    } catch (e: any) {
      onToast({ tone: 'error', message: e?.message || 'Regenerate failed' });
    } finally {
      state.setBusy(false);
    }
  };

  const deletePage = async () => {
    if (!state.canEditPuzzle || !state.selectedPage) return;
    if (!window.confirm('Are you sure you want to delete this page?')) return;
    state.setBusy(true);
    try {
      await ApiClient.post('/api/wordsearch/pages.php?action=delete', { id: state.selectedPage.id });
      await state.reloadPages(state.puzzle?.id);
    } catch (e: any) {
      onToast({ tone: 'error', message: e?.message || 'Delete page failed' });
    } finally {
      state.setBusy(false);
    }
  };

  const deletePuzzle = async () => {
    if (!state.puzzle || !state.canEditPuzzle) return;
    if (!window.confirm('Are you sure you want to delete this entire puzzle and all its pages?')) return;
    state.setBusy(true);
    try {
      await ApiClient.post('/api/wordsearch/puzzles.php?action=delete', { id: state.puzzle.id });
      state.loadPuzzles();
      state.setPuzzleId('');
      state.setPages([]);
      state.setPageId('');
      state.setPuzzle(null);
    } catch (e: any) {
      onToast({ tone: 'error', message: e?.message || 'Delete failed' });
    } finally {
      state.setBusy(false);
    }
  };

  if (!state.isLoggedIn) {
    return (
      <PageLayout page="wordsearch" title="Word Search" viewer={viewer} onLoginClick={onLoginClick} onLogout={onLogout} onAccountClick={onAccountClick} mysteryTitle={mysteryTitle}>
        <section className="section">
          <div className="container">
            <h1 className="section-title">Word Search</h1>
            <div className="catn8-card p-2">
              <div className="fw-bold">Login required</div>
              <div className="mt-1">You must be logged in to access Word Search.</div>
              <button type="button" className="btn btn-primary mt-3" onClick={onLoginClick}>Log in</button>
            </div>
          </div>
        </section>
      </PageLayout>
    );
  }

  return (
    <>
      <PageLayout page="wordsearch" title="Word Search" viewer={viewer} onLoginClick={onLoginClick} onLogout={onLogout} onAccountClick={onAccountClick} mysteryTitle={mysteryTitle}>
        <section className="section">
          <div className="container">
            <h1 className="section-title">Word Search</h1>
            <WordsearchToolbar 
              puzzles={state.puzzles} puzzleId={state.puzzleId} setPuzzleId={state.setPuzzleId} busy={state.busy}
              setPuzzlesOpen={setPuzzlesOpen} setManagePuzzlesOpen={setManagePuzzlesOpen} 
              setSettingsOpen={setSettingsOpen} setPrintOpen={setPrintOpen} setTopicsOpen={setTopicsOpen}
              deletePuzzle={deletePuzzle} isAdmin={state.isAdmin} canEditPuzzle={state.canEditPuzzle} puzzle={state.puzzle}
              pages={state.pages} pageId={state.pageId} setPageId={state.setPageId}
              regeneratePage={regeneratePage} deletePage={deletePage} selectedPage={state.selectedPage}
              topics={state.topics} topicId={state.topicId} setTopicId={state.setTopicId} topic={state.topic}
            />

            {!state.selectedPage && state.puzzle && !state.busy && state.pages.length === 0 && (
              <div className="catn8-card p-2 mt-3">
                <div className="fw-bold">No pages found for this puzzle.</div>
                <div className="mt-2 d-flex gap-2 flex-wrap">
                  <button type="button" className="btn btn-primary" onClick={state.generateAllPages} disabled={!state.canEditPuzzle || !state.topic}>
                    Generate pages
                  </button>
                  {!state.canEditPuzzle && <div className="text-muted">Log in as the owner (or admin) to generate pages.</div>}
                  {state.canEditPuzzle && !state.topic && <div className="text-muted">Select a topic to generate pages.</div>}
                </div>
              </div>
            )}

            <WordsearchGrid puzzle={state.puzzle} selectedPage={state.selectedPage} />
          </div>
        </section>
      </PageLayout>

      <WordsearchPrintView printJobs={state.printJobs} />

      <WordsearchSettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} onToast={onToast} />
      <WordsearchPrintModal open={printOpen} onClose={() => setPrintOpen(false)} puzzles={state.puzzles} defaultPuzzleId={state.puzzleId} onPrint={state.buildPrintJobs} onToast={onToast} />
      <TopicManagerModal open={topicsOpen} onClose={() => setTopicsOpen(false)} onChanged={state.loadTopics} viewer={viewer} onToast={onToast} />
      <PuzzleManagerModal open={puzzlesOpen} onClose={() => setPuzzlesOpen(false)} topics={state.topics} viewer={viewer} onToast={onToast}
        onCreated={async (newId) => { state.loadPuzzles(); state.setPuzzleId(String(newId)); setPuzzlesOpen(false); }}
        onDeleted={async () => state.loadPuzzles()}
      />
      <ManagePuzzlesModal open={managePuzzlesOpen} onClose={() => setManagePuzzlesOpen(false)} topics={state.topics} puzzles={state.puzzles} viewer={viewer} onToast={onToast}
        onChanged={async () => { state.loadPuzzles(); await state.reloadPages(state.puzzleId); }}
      />
    </>
  );
}
