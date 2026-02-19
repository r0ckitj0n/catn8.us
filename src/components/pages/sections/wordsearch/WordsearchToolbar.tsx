import React from 'react';
import './WordsearchToolbar.css';

interface WordsearchToolbarProps {
  puzzles: any[];
  puzzleId: string;
  setPuzzleId: (id: string) => void;
  busy: boolean;
  setPuzzlesOpen: (open: boolean) => void;
  setManagePuzzlesOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  setPrintOpen: (open: boolean) => void;
  setTopicsOpen: (open: boolean) => void;
  deletePuzzle: () => Promise<void>;
  isAdmin: number;
  canEditPuzzle: boolean;
  puzzle: any;
  pages: any[];
  pageId: string;
  setPageId: (id: string) => void;
  regeneratePage: () => Promise<void>;
  deletePage: () => Promise<void>;
  selectedPage: any;
  topics: any[];
  topicId: string;
  setTopicId: (id: string) => void;
  topic: any;
}

export function WordsearchToolbar({
  puzzles, puzzleId, setPuzzleId, busy,
  setPuzzlesOpen, setManagePuzzlesOpen, setSettingsOpen, setPrintOpen, setTopicsOpen,
  deletePuzzle, isAdmin, canEditPuzzle, puzzle,
  pages, pageId, setPageId, regeneratePage, deletePage, selectedPage,
  topics, topicId, setTopicId, topic
}: WordsearchToolbarProps) {
  return (
    <div className="catn8-ws-toolbar">
      <div className="row g-2 align-items-end">
        <div className="col-md-6">
          <label className="form-label" htmlFor="ws-puzzle">Puzzle</label>
          <select
            id="ws-puzzle"
            className="form-select"
            value={puzzleId}
            onChange={(e) => setPuzzleId(e.target.value)}
            disabled={busy}
          >
            {puzzles.map((p) => (
              <option key={p.id} value={String(p.id)}>
                {p.title}{p.owner_username ? ` — ${p.owner_username}` : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="col-md-6">
          <div className="d-flex gap-2">
            <button type="button" className="btn btn-primary flex-grow-1" onClick={() => setPuzzlesOpen(true)} disabled={busy}>
              New Puzzle
            </button>
            <button type="button" className="btn btn-outline-secondary" onClick={() => setManagePuzzlesOpen(true)} disabled={busy}>
              Manage
            </button>
            <button type="button" className="btn btn-outline-secondary" onClick={() => setSettingsOpen(true)}>
              Settings
            </button>
            <button type="button" className="btn btn-outline-secondary" onClick={() => setPrintOpen(true)} disabled={busy}>
              Print
            </button>
            {isAdmin ? (
              <button type="button" className="btn btn-outline-secondary" onClick={() => setTopicsOpen(true)}>
                Topics
              </button>
            ) : null}
            {canEditPuzzle && (
              <button type="button" className="btn btn-outline-danger" onClick={deletePuzzle} disabled={busy || !puzzle}>
                Delete
              </button>
            )}
          </div>
        </div>

        <div className="col-12">
          <div className="row g-2">
            <div className="col-md-6">
              <label className="form-label" htmlFor="ws-page">Page</label>
              <select
                id="ws-page"
                className="form-select"
                value={pageId}
                onChange={(e) => setPageId(e.target.value)}
                disabled={busy}
              >
                {pages.map((p) => (
                  <option key={p.id} value={String(p.id)}>Page {p.page_number}</option>
                ))}
              </select>
              <div className="d-flex gap-2 mt-2">
                <button type="button" className="btn btn-outline-secondary" onClick={regeneratePage} disabled={busy || !canEditPuzzle || !selectedPage}>
                  Regenerate page
                </button>
                <button type="button" className="btn btn-outline-danger" onClick={deletePage} disabled={busy || !canEditPuzzle || !selectedPage}>
                  Delete page
                </button>
              </div>
            </div>

            <div className="col-md-6">
              <label className="form-label" htmlFor="ws-topic">Topic</label>
              <select
                id="ws-topic"
                className="form-select"
                value={topicId}
                onChange={(e) => setTopicId(e.target.value)}
                disabled={busy}
              >
                {topics.map((t) => (
                  <option key={t.id} value={String(t.id)}>{t.title}</option>
                ))}
              </select>
              {topic?.description ? <div className="form-text">{topic.description}</div> : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
