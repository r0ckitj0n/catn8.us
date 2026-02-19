import React from 'react';
import { ApiClient } from '../../core/ApiClient';
import { useBootstrapModal } from '../../hooks/useBootstrapModal';
import { IToast } from '../../types/common';

interface SiteAppearanceModalProps {
  open: boolean;
  onClose: () => void;
  onToast?: (toast: IToast) => void;
}

export function SiteAppearanceModal({ open, onClose, onToast }: SiteAppearanceModalProps) {
  const { modalRef, modalApiRef } = useBootstrapModal(onClose);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [tokens, setTokens] = React.useState({ brand_primary: '#9b59b6', brand_secondary: '#2ecc71', action_fg: '#ffffff' });
  const cleanSnapshotRef = React.useRef('');

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
    ApiClient.get('/api/settings/appearance.php')
      .then((res) => {
        const t = res?.tokens || {};
        const nextTokens = {
          brand_primary: String(t.brand_primary || '#9b59b6'),
          brand_secondary: String(t.brand_secondary || '#2ecc71'),
          action_fg: String(t.action_fg || '#ffffff'),
        };
        setTokens(nextTokens);
        cleanSnapshotRef.current = JSON.stringify(nextTokens);
      })
      .catch((e) => setError(e?.message || 'Failed to load appearance settings'))
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
    return String(cleanSnapshotRef.current || '') !== JSON.stringify(tokens);
  }, [tokens]);

  const saveSvg = (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M2 1a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V4.5a1 1 0 0 0-.293-.707l-2.5-2.5A1 1 0 0 0 11.5 1H2zm1 1h8v4H3V2zm0 6h10v6H3V8zm2 1v4h6V9H5z"
      />
    </svg>
  );

  const save = async (e: React.FormEvent | React.MouseEvent) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await ApiClient.post('/api/settings/appearance.php', tokens);
      setMessage('Saved. Refresh the page if you don\'t see changes immediately.');
      cleanSnapshotRef.current = JSON.stringify(tokens);
    } catch (err: any) {
      setError(err?.message || 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal fade" tabIndex={-1} aria-hidden="true" ref={modalRef}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Site Appearance</h5>
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
              <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
          </div>
          <div className="modal-body">
            <form onSubmit={save}>
              <div className="mb-3">
                <label className="form-label" htmlFor="appearance-brand-primary">Primary brand color</label>
                <input
                  className="form-control form-control-color"
                  type="color"
                  id="appearance-brand-primary"
                  value={tokens.brand_primary}
                  onChange={(e) => setTokens((t) => ({ ...t, brand_primary: e.target.value }))}
                  disabled={busy}
                />
              </div>

              <div className="mb-3">
                <label className="form-label" htmlFor="appearance-brand-secondary">Secondary brand color</label>
                <input
                  className="form-control form-control-color"
                  type="color"
                  id="appearance-brand-secondary"
                  value={tokens.brand_secondary}
                  onChange={(e) => setTokens((t) => ({ ...t, brand_secondary: e.target.value }))}
                  disabled={busy}
                />
              </div>

              <div className="mb-3">
                <label className="form-label" htmlFor="appearance-action-fg">Button text color</label>
                <input
                  className="form-control form-control-color"
                  type="color"
                  id="appearance-action-fg"
                  value={tokens.action_fg}
                  onChange={(e) => setTokens((t) => ({ ...t, action_fg: e.target.value }))}
                  disabled={busy}
                />
              </div>

              <div className="d-flex gap-2 mb-3">
                <button type="button" className="btn btn-primary" disabled>
                  Primary button
                </button>
                <button type="button" className="btn btn-secondary" disabled>
                  Secondary button
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
