import React, { useState } from 'react';
import { ApiClient } from '../../core/ApiClient';
import { useBootstrapModal } from '../../hooks/useBootstrapModal';
import { IToast } from '../../types/common';
import { pickWordsForPage, buildWordSearch } from '../../utils/wordsearchUtils';
import { ModalCloseIconButton } from '../common/ModalCloseIconButton';
import { useBrandedConfirm } from '../../hooks/useBrandedConfirm';

interface ManagePuzzlesModalProps {
  open: boolean;
  onClose: () => void;
  topics: any[];
  puzzles: any[];
  viewer: any;
  onChanged: () => void;
  onToast?: (toast: IToast) => void;
}

export function ManagePuzzlesModal({ open, onClose, topics, puzzles, viewer, onChanged, onToast }: ManagePuzzlesModalProps) {
  const { modalRef, modalApiRef } = useBootstrapModal(onClose);
  const { confirm, confirmDialog } = useBrandedConfirm();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [activeId, setActiveId] = useState<number | null>(null);
  const [title, setTitle] = React.useState('');
  const [pagesCount, setPagesCount] = React.useState(1);
  const [puzzle, setPuzzle] = useState<any>(null);

  const canEditActive = React.useMemo(() => {
    const uid = Number(viewer?.user_id || viewer?.id || 0);
    if (!uid || !puzzle) return false;
    if (Number(viewer?.is_admin || 0) === 1 || Number(viewer?.is_administrator || 0) === 1) return true;
    return Number(puzzle?.owner_user_id || 0) === uid;
  }, [viewer, puzzle]);

  React.useEffect(() => {
    const modal = modalApiRef.current;
    if (!modal) return;
    if (open) modal.show();
    else modal.hide();
  }, [open, modalApiRef]);

  React.useEffect(() => {
    if (!open) return;
    setError('');
    setMessage('');
    setBusy(false);
    setActiveId(null);
    setPuzzle(null);
    setTitle('');
    setPagesCount(1);
  }, [open]);

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

  const loadPuzzle = async (id: number) => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const res = await ApiClient.get('/api/wordsearch/puzzles.php?action=get&id=' + String(id));
      const p = res?.puzzle;
      if (!p) throw new Error('Puzzle not found');
      setActiveId(Number(p.id));
      setPuzzle(p);
      setTitle(String(p.title || ''));
      setPagesCount(Number(p.pages_count || 1));
    } catch (e: any) {
      setError(e?.message || 'Failed to load puzzle');
    } finally {
      setBusy(false);
    }
  };

  const rename = async () => {
    if (!activeId || !canEditActive) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await ApiClient.post('/api/wordsearch/puzzles.php?action=update', { id: activeId, title });
      setMessage('Saved.');
      if (typeof onChanged === 'function') onChanged();
    } catch (e: any) {
      setError(e?.message || 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const resize = async () => {
    if (!activeId || !canEditActive) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const desired = Number(pagesCount);
      const oldCount = Number(puzzle?.pages_count || 1);

      await ApiClient.post('/api/wordsearch/puzzles.php?action=resize', { id: activeId, pages_count: desired });

      if (desired > oldCount) {
        const topic = (Array.isArray(topics) ? topics : []).find((t) => Number(t.id) === Number(puzzle?.topic_id || 0));
        if (topic) {
          const wordsPerPage = Number(topic.words_per_page || 15);
          const baseSeed = (Date.now() ^ (activeId * 1009)) >>> 0;
          for (let pageNumber = oldCount + 1; pageNumber <= desired; pageNumber += 1) {
            const seed = (baseSeed + (pageNumber * 7919)) >>> 0;
            const words = pickWordsForPage({ allWords: topic.words, count: wordsPerPage, gridSize: Number(puzzle?.grid_size || 12), seed: seed + 17 });
            const out = buildWordSearch({ size: Number(puzzle?.grid_size || 12), words, seed, difficulty: String(puzzle?.difficulty || 'easy') });
            await ApiClient.post('/api/wordsearch/pages.php?action=upsert', {
              puzzle_id: activeId,
              page_number: pageNumber,
              seed: String(seed),
              words: out.words,
              grid: out.grid,
            });
          }
        }
      }

      setMessage('Updated page count.');
      if (typeof onChanged === 'function') onChanged();
      await loadPuzzle(activeId);
    } catch (e: any) {
      setError(e?.message || 'Resize failed');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!activeId || !canEditActive) return;
    const confirmed = await confirm({
      title: 'Delete Puzzle?',
      message: 'Are you sure you want to delete this puzzle?',
      confirmLabel: 'Delete Puzzle',
      tone: 'danger',
    });
    if (!confirmed) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await ApiClient.post('/api/wordsearch/puzzles.php?action=delete', { id: activeId });
      setMessage('Deleted.');
      setActiveId(null);
      setPuzzle(null);
      setTitle('');
      setPagesCount(1);
      if (typeof onChanged === 'function') onChanged();
    } catch (e: any) {
      setError(e?.message || 'Delete failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal fade" tabIndex={-1} aria-hidden="true" ref={modalRef}>
      <div className="modal-dialog modal-dialog-centered modal-xl">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Manage Puzzles</h5>
            <ModalCloseIconButton />
          </div>
          <div className="modal-body">
            <div className="row g-3">
              <div className="col-lg-4">
                <div className="fw-bold mb-2">Puzzles</div>
                <div className="list-group">
                  {(puzzles || []).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className={'list-group-item list-group-item-action ' + (Number(p.id) === Number(activeId) ? 'active' : '')}
                      onClick={() => loadPuzzle(p.id)}
                      disabled={busy}
                    >
                      <div className="fw-bold">{p.title}</div>
                      <div className="small">{p.topic_title}{p.owner_username ? ` — ${p.owner_username}` : ''}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="col-lg-8">
                {!puzzle ? (
                  <div className="text-muted">Select a puzzle to manage.</div>
                ) : (
                  <>
                    <div className="row g-3">
                      <div className="col-md-8">
                        <label className="form-label" htmlFor="mp-title">Title</label>
                        <input
                          id="mp-title"
                          className="form-control"
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          disabled={busy || !canEditActive}
                        />
                      </div>
                      <div className="col-md-4">
                        <label className="form-label" htmlFor="mp-pages">Pages</label>
                        <input
                          id="mp-pages"
                          className="form-control"
                          type="number"
                          min={1}
                          max={200}
                          step={1}
                          value={String(pagesCount)}
                          onChange={(e) => setPagesCount(Number(e.target.value))}
                          disabled={busy || !canEditActive}
                        />
                      </div>
                    </div>

                    <div className="d-flex gap-2 mt-3">
                      <button type="button" className="btn btn-primary" onClick={rename} disabled={busy || !canEditActive || !title.trim()}>
                        Save title
                      </button>
                      <button type="button" className="btn btn-primary" onClick={resize} disabled={busy || !canEditActive}>
                        Update pages
                      </button>
                      <button type="button" className="btn btn-outline-danger ms-auto" onClick={remove} disabled={busy || !canEditActive}>
                        Delete puzzle
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      {confirmDialog}
    </div>
  );
}
