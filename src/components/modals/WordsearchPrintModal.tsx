import React, { useState } from 'react';
import { useBootstrapModal } from '../../hooks/useBootstrapModal';
import { IToast } from '../../types/common';

interface WordsearchPrintModalProps {
  open: boolean;
  onClose: () => void;
  puzzles: any[];
  defaultPuzzleId?: string | number | null;
  onPrint: (selectedIds: string[]) => Promise<void>;
  onToast?: (toast: IToast) => void;
}

export function WordsearchPrintModal({ open, onClose, puzzles, defaultPuzzleId, onPrint, onToast }: WordsearchPrintModalProps) {
  const { modalRef, modalApiRef } = useBootstrapModal(onClose);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [selected, setSelected] = useState<string[]>([]);

  React.useEffect(() => {
    if (!error) return;
    if (typeof onToast === 'function') onToast({ tone: 'error', message: String(error) });
    setError('');
  }, [error, onToast]);

  React.useEffect(() => {
    const modal = modalApiRef.current;
    if (!modal) return;
    if (open) modal.show();
    else modal.hide();
  }, [open, modalApiRef]);

  React.useEffect(() => {
    if (!open) return;
    const start = defaultPuzzleId ? [String(defaultPuzzleId)] : [];
    setSelected(start);
    setError('');
  }, [open, defaultPuzzleId]);

  const toggle = (pid: string | number) => {
    const id = String(pid);
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      if (typeof onPrint !== 'function') throw new Error('Print handler not available');
      await onPrint(selected);
      const modal = modalApiRef.current;
      if (modal) modal.hide();
    } catch (e: any) {
      setError(e?.message || 'Print failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal fade" tabIndex={-1} aria-hidden="true" ref={modalRef}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Print Word Search</h5>
            <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div className="modal-body">
            <div className="fw-bold mb-2">Select puzzles to print</div>
            <div className="d-flex flex-column gap-2" style={{ maxHeight: 320, overflow: 'auto' }}>
              {(Array.isArray(puzzles) ? puzzles : []).map((p) => (
                <label key={p.id} className="form-check">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    checked={selected.includes(String(p.id))}
                    onChange={() => toggle(p.id)}
                    disabled={busy}
                  />
                  <span className="form-check-label">{p.title}</span>
                </label>
              ))}
            </div>
            <button type="button" className="btn btn-primary w-100 mt-3" onClick={submit} disabled={busy || !selected.length}>
              Print
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
