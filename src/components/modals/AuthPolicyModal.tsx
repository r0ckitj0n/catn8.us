import React from 'react';
import { ModalCloseIconButton } from '../common/ModalCloseIconButton';
import { ApiClient } from '../../core/ApiClient';
import { useBootstrapModal } from '../../hooks/useBootstrapModal';
import { IToast } from '../../types/common';

interface AuthPolicyModalProps {
  open: boolean;
  onClose: () => void;
  onToast?: (toast: IToast) => void;
}

export function AuthPolicyModal({ open, onClose, onToast }: AuthPolicyModalProps) {
  const { modalRef, modalApiRef } = useBootstrapModal(onClose);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [policy, setPolicy] = React.useState({ require_email_verification: 0, allow_public_signup: 1 });
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
    ApiClient.get('/api/settings/auth_policy.php')
      .then((res) => {
        const p = res?.policy || {};
        const nextPolicy = {
          require_email_verification: (p.require_email_verification ? 1 : 0),
          allow_public_signup: (p.allow_public_signup ? 1 : 0),
        };
        setPolicy(nextPolicy);
        cleanSnapshotRef.current = JSON.stringify(nextPolicy);
      })
      .catch((e) => setError(e?.message || 'Failed to load settings'))
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
    return String(cleanSnapshotRef.current || '') !== JSON.stringify(policy);
  }, [policy]);

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
      await ApiClient.post('/api/settings/auth_policy.php', policy);
      setMessage('Saved.');
      cleanSnapshotRef.current = JSON.stringify(policy);
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
            <h5 className="modal-title">Account & Signup Policy</h5>
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
              <div className="form-check form-switch mb-3">
                <input
                  className="form-check-input"
                  type="checkbox"
                  role="switch"
                  id="policy-allow-public"
                  checked={policy.allow_public_signup === 1}
                  onChange={(e) => setPolicy((p) => ({ ...p, allow_public_signup: e.target.checked ? 1 : 0 }))}
                  disabled={busy}
                />
                <label className="form-check-label" htmlFor="policy-allow-public">
                  Allow public users to create accounts
                </label>
                <div className="form-text">
                  If off, signups are still accepted but accounts are disabled until an admin enables them.
                </div>
              </div>

              <div className="form-check form-switch mb-3">
                <input
                  className="form-check-input"
                  type="checkbox"
                  role="switch"
                  id="policy-require-verify"
                  checked={policy.require_email_verification === 1}
                  onChange={(e) => setPolicy((p) => ({ ...p, require_email_verification: e.target.checked ? 1 : 0 }))}
                  disabled={busy || policy.allow_public_signup === 0}
                />
                <label className="form-check-label" htmlFor="policy-require-verify">
                  Require email verification before activation
                </label>
                <div className="form-text">
                  When public signup is disabled, verification is forced off (admin approval becomes the activation step).
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
