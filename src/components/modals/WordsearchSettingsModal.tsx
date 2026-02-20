import React from 'react';
import { ModalCloseIconButton } from '../common/ModalCloseIconButton';
import { ApiClient } from '../../core/ApiClient';
import { useBootstrapModal } from '../../hooks/useBootstrapModal';
import { IToast } from '../../types/common';

interface WordsearchSettingsModalProps {
  open: boolean;
  onClose: () => void;
  onToast?: (toast: IToast) => void;
}

export function WordsearchSettingsModal({ open, onClose, onToast }: WordsearchSettingsModalProps) {
  const { modalRef, modalApiRef } = useBootstrapModal(onClose);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [message, setMessage] = React.useState('');
  const cleanSnapshotRef = React.useRef('');
  const [settings, setSettings] = React.useState({
    grid_size: 12,
    difficulty: 'easy',
    quick_facts_enabled: 1,
    quick_facts_sentences: 2,
    quick_facts_style: 'gentle',
  });
  const [isAdmin, setIsAdmin] = React.useState(0);
  const [saveGlobal, setSaveGlobal] = React.useState(false);

  React.useEffect(() => {
    const modal = modalApiRef.current;
    if (!modal) return;
    if (open) modal.show();
    else modal.hide();
  }, [open, modalApiRef]);

  React.useEffect(() => {
    if (!open) return;
    setBusy(true);
    setError('');
    setMessage('');
    setSaveGlobal(false);

    ApiClient.get('/api/wordsearch/settings.php')
      .then((res) => {
        const s = res?.settings || {};
        const qEnabled = Number(s.quick_facts_enabled) === 0 ? 0 : 1;
        const qSent = Math.min(6, Math.max(1, Number(s.quick_facts_sentences || 2)));
        const qStyle = String(s.quick_facts_style || 'gentle');
        const nextSettings = {
          grid_size: Number.isFinite(Number(s.grid_size)) ? Number(s.grid_size) : 12,
          difficulty: String(s.difficulty || 'easy'),
          quick_facts_enabled: qEnabled,
          quick_facts_sentences: Number.isFinite(qSent) ? qSent : 2,
          quick_facts_style: qStyle,
        };
        setSettings(nextSettings);
        setIsAdmin(Number(res?.is_admin || 0));
        cleanSnapshotRef.current = JSON.stringify({ settings: nextSettings, saveGlobal: false });
      })
      .catch((e) => setError(e?.message || 'Failed to load word search settings'))
      .finally(() => setBusy(false));
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

  const isDirty = React.useMemo(() => {
    const cur = JSON.stringify({ settings, saveGlobal });
    return String(cleanSnapshotRef.current || '') !== cur;
  }, [settings, saveGlobal]);

  const save = async (e: React.FormEvent | React.MouseEvent) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await ApiClient.post('/api/wordsearch/settings.php', {
        grid_size: settings.grid_size,
        difficulty: settings.difficulty,
        quick_facts_enabled: settings.quick_facts_enabled,
        quick_facts_sentences: settings.quick_facts_sentences,
        quick_facts_style: settings.quick_facts_style,
        save_global: (isAdmin && saveGlobal) ? 1 : 0,
      });
      setMessage((isAdmin && saveGlobal) ? 'Saved global defaults.' : 'Saved for this session.');
      cleanSnapshotRef.current = JSON.stringify({ settings, saveGlobal });
    } catch (err: any) {
      setError(err?.message || 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const saveSvg = (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M2 1a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V4.5a1 1 0 0 0-.293-.707l-2.5-2.5A1 1 0 0 0 11.5 1H2zm1 1h8v4H3V2zm0 6h10v6H3V8zm2 1v4h6V9H5z"
      />
    </svg>
  );

  return (
    <div className="modal fade" tabIndex={-1} aria-hidden="true" ref={modalRef}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Word Search Settings</h5>
            <div className="d-flex align-items-center gap-2">
              <button
                type="button"
                className={'btn btn-sm btn-primary catn8-dirty-save' + (isDirty ? ' catn8-dirty-save--visible' : '')}
                onClick={save}
                disabled={busy || !isDirty}
                aria-label="Save"
                title={isDirty ? 'Save changes' : 'No changes to save'}
              >
                {saveSvg}
                <span className="ms-1">Save</span>
              </button>
              <ModalCloseIconButton />
            </div>
          </div>
          <div className="modal-body">
            <form onSubmit={save}>
              <div className="mb-3">
                <label className="form-label" htmlFor="ws-grid">Grid size</label>
                <input
                  id="ws-grid"
                  className="form-control"
                  type="number"
                  min={8}
                  max={30}
                  step={1}
                  value={String(settings.grid_size)}
                  onChange={(e) => setSettings((s) => ({ ...s, grid_size: Number(e.target.value) }))}
                  disabled={busy}
                />
              </div>

              <div className="mb-3">
                <label className="form-label" htmlFor="ws-difficulty">Difficulty</label>
                <select
                  id="ws-difficulty"
                  className="form-select"
                  value={settings.difficulty}
                  onChange={(e) => setSettings((s) => ({ ...s, difficulty: e.target.value }))}
                  disabled={busy}
                >
                  <option value="easy">Easy (no diagonal, no backwards)</option>
                  <option value="medium">Medium (diagonal allowed)</option>
                  <option value="hard">Hard (diagonal + backwards allowed)</option>
                </select>
              </div>

              {isAdmin ? (
                <div className="form-check mb-3">
                  <input
                    id="ws-save-global"
                    className="form-check-input"
                    type="checkbox"
                    checked={saveGlobal}
                    onChange={(e) => setSaveGlobal(e.target.checked)}
                    disabled={busy}
                  />
                  <label className="form-check-label" htmlFor="ws-save-global">
                    Save as global defaults
                  </label>
                </div>
              ) : null}
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
