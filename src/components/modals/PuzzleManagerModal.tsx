import React from 'react';
import { ModalCloseIconButton } from '../common/ModalCloseIconButton';
import { ApiClient } from '../../core/ApiClient';
import { useBootstrapModal } from '../../hooks/useBootstrapModal';
import { IToast } from '../../types/common';

interface PuzzleManagerModalProps {
  open: boolean;
  onClose: () => void;
  topics: any[];
  viewer: any;
  onCreated: (puzzleId: number) => void;
  onDeleted?: () => Promise<void>;
  onToast?: (toast: IToast) => void;
}

export function PuzzleManagerModal({ open, onClose, topics, viewer, onCreated, onDeleted, onToast }: PuzzleManagerModalProps) {
  const { modalRef, modalApiRef } = useBootstrapModal(onClose);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [message, setMessage] = React.useState('');

  const [title, setTitle] = React.useState('');
  const [topicId, setTopicId] = React.useState('');
  const [gridSize, setGridSize] = React.useState(12);
  const [difficulty, setDifficulty] = React.useState('easy');
  const [pagesCount, setPagesCount] = React.useState(1);

  const viewerId = Number(viewer?.id || 0);
  const isAdmin = Number(viewer?.is_admin || 0) === 1 || Number(viewer?.is_administrator || 0) === 1;
  const canCreate = Boolean(viewerId);

  React.useEffect(() => {
    const modal = modalApiRef.current;
    if (!modal) return;
    if (open) modal.show();
    else modal.hide();
  }, [open, modalApiRef]);

  React.useEffect(() => {
    if (!open) return;
    setBusy(false);
    setError('');
    setMessage('');
    if (!topicId && Array.isArray(topics) && topics.length) {
      setTopicId(String(topics[0]?.id || ''));
    }
  }, [open, topics, topicId]);

  React.useEffect(() => {
    if (!error) return;
    if (typeof onToast === 'function') onToast({ tone: 'error', message: String(error) });
    setError('');
  }, [error, onToast]);

  React.useEffect(() => {
    if (!message) return;
    if (typeof onToast === 'function') onToast({ tone: 'success', message: String(message) });
    setMessage('');
  }, [message, onToast]);

  const createPuzzle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreate) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const res = await ApiClient.post('/api/wordsearch/puzzles.php?action=create', {
        title: String(title || '').trim(),
        topic_id: Number(topicId || 0),
        grid_size: Number(gridSize || 0),
        difficulty: String(difficulty || 'easy'),
        pages_count: Number(pagesCount || 1),
      });
      const pid = Number(res?.puzzle_id || 0);
      if (!pid) throw new Error('Puzzle create failed');
      setMessage('Created.');
      if (typeof onCreated === 'function') onCreated(pid);
    } catch (err: any) {
      setError(err?.message || 'Create failed');
    } finally {
      setBusy(false);
    }
  };

  const deleteMyPuzzles = async () => {
    if (!canCreate || !isAdmin) return;
    try {
      if (typeof onDeleted === 'function') await onDeleted();
    } catch (_err) {
    }
  };

  return (
    <div className="modal fade" tabIndex={-1} aria-hidden="true" ref={modalRef}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Create Puzzle</h5>
            <ModalCloseIconButton />
          </div>
          <div className="modal-body">
            {!canCreate ? (
              <div className="text-muted">You must be logged in to create puzzles.</div>
            ) : null}

            <form onSubmit={createPuzzle}>
              <div className="mb-3">
                <label className="form-label" htmlFor="puz-title">Title</label>
                <input
                  id="puz-title"
                  className="form-control"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={busy || !canCreate}
                  placeholder="My Puzzle"
                  required
                />
              </div>

              <div className="mb-3">
                <label className="form-label" htmlFor="puz-topic">Topic</label>
                <select
                  id="puz-topic"
                  className="form-select"
                  value={topicId}
                  onChange={(e) => setTopicId(e.target.value)}
                  disabled={busy || !canCreate}
                  required
                >
                  {(Array.isArray(topics) ? topics : []).map((t) => (
                    <option key={t.id} value={String(t.id)}>{t.title}</option>
                  ))}
                </select>
              </div>

              <div className="row g-2">
                <div className="col-6">
                  <label className="form-label" htmlFor="puz-grid">Grid size</label>
                  <input
                    id="puz-grid"
                    className="form-control"
                    type="number"
                    min={8}
                    max={30}
                    value={String(gridSize)}
                    onChange={(e) => setGridSize(Number(e.target.value))}
                    disabled={busy || !canCreate}
                    required
                  />
                </div>
                <div className="col-6">
                  <label className="form-label" htmlFor="puz-pages">Pages</label>
                  <input
                    id="puz-pages"
                    className="form-control"
                    type="number"
                    min={1}
                    max={200}
                    value={String(pagesCount)}
                    onChange={(e) => setPagesCount(Number(e.target.value))}
                    disabled={busy || !canCreate}
                    required
                  />
                </div>
              </div>

              <div className="mb-3 mt-2">
                <label className="form-label" htmlFor="puz-difficulty">Difficulty</label>
                <select
                  id="puz-difficulty"
                  className="form-select"
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                  disabled={busy || !canCreate}
                  required
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>

              <button type="submit" className="btn btn-primary w-100" disabled={busy || !canCreate || !String(title || '').trim() || !Number(topicId || 0)}>
                Create
              </button>
            </form>

            {isAdmin ? (
              <button type="button" className="btn btn-sm btn-outline-secondary w-100 mt-3" onClick={deleteMyPuzzles} disabled={busy}>
                Refresh
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
