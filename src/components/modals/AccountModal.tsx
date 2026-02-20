import React from 'react';
import { ModalCloseIconButton } from '../common/ModalCloseIconButton';
import { ApiClient } from '../../core/ApiClient';
import { useBootstrapModal } from '../../hooks/useBootstrapModal';
import { IToast } from '../../types/common';

interface AccountModalProps {
  open: boolean;
  onClose: () => void;
  viewer: any;
  onChanged: () => void;
  onToast?: (toast: IToast) => void;
}

export function AccountModal({ open, onClose, viewer, onChanged, onToast }: AccountModalProps) {
  const { modalRef, modalApiRef } = useBootstrapModal(onClose);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [username, setUsername] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [currentPassword, setCurrentPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [deletePassword, setDeletePassword] = React.useState('');
  const cleanProfileRef = React.useRef('');

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
    setCurrentPassword('');
    setNewPassword('');
    setDeletePassword('');

    ApiClient.get('/api/auth/account.php')
      .then((res) => {
        const u = res?.user || viewer || {};
        setUsername(String(u.username || ''));
        setEmail(String(u.email || ''));
        cleanProfileRef.current = JSON.stringify({ username: String(u.username || ''), email: String(u.email || '') });
      })
      .catch((e) => setError(e?.message || 'Failed to load account'))
      .finally(() => setBusy(false));
  }, [open, viewer]);

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

  const isProfileDirty = React.useMemo(() => {
    const cur = JSON.stringify({ username: String(username || ''), email: String(email || '') });
    return String(cleanProfileRef.current || '') !== cur;
  }, [username, email]);

  const saveProfile = async (e: React.FormEvent | React.MouseEvent) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await ApiClient.post('/api/auth/account.php', { action: 'update_profile', username, email });
      setMessage('Saved.');
      cleanProfileRef.current = JSON.stringify({ username: String(username || ''), email: String(email || '') });
      if (typeof onChanged === 'function') onChanged();
    } catch (err: any) {
      setError(err?.message || 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await ApiClient.post('/api/auth/account.php', { action: 'change_password', current_password: currentPassword, new_password: newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setMessage('Password updated.');
    } catch (err: any) {
      setError(err?.message || 'Update failed');
    } finally {
      setBusy(false);
    }
  };

  const deleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!window.confirm('Are you sure you want to delete your account? This action is permanent.')) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await ApiClient.post('/api/auth/account.php', { action: 'delete_account', current_password: deletePassword });
      setMessage('Account deleted.');
      if (typeof onChanged === 'function') onChanged();
      if (typeof onClose === 'function') onClose();
    } catch (err: any) {
      setError(err?.message || 'Delete failed');
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
            <h5 className="modal-title">Your Account</h5>
            <div className="d-flex align-items-center gap-2">
              <button
                type="button"
                className={isProfileDirty ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-outline-secondary'}
                onClick={saveProfile}
                disabled={busy || !isProfileDirty}
                aria-label="Save"
                title={isProfileDirty ? 'Save profile changes' : 'No profile changes to save'}
              >
                {saveSvg}
                <span className="ms-1">Save</span>
              </button>
              <ModalCloseIconButton />
            </div>
          </div>
          <div className="modal-body">
            <div className="fw-bold mb-2">Profile</div>
            <form onSubmit={saveProfile}>
              <div className="mb-3">
                <label className="form-label" htmlFor="acct-username">Username</label>
                <input
                  id="acct-username"
                  className="form-control"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={busy}
                  autoComplete="username"
                  required
                />
              </div>
              <div className="mb-3">
                <label className="form-label" htmlFor="acct-email">Email</label>
                <input
                  id="acct-email"
                  className="form-control"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={busy}
                  autoComplete="email"
                  required
                />
              </div>
              <button type="submit" className="btn btn-primary w-100" disabled={busy}>
                Save profile
              </button>
            </form>

            <hr />

            <div className="fw-bold mb-2">Change password</div>
            <form onSubmit={changePassword}>
              <div className="mb-3">
                <label className="form-label" htmlFor="acct-current-pass">Current password</label>
                <input
                  id="acct-current-pass"
                  className="form-control"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  disabled={busy}
                  autoComplete="current-password"
                  required
                />
              </div>
              <div className="mb-3">
                <label className="form-label" htmlFor="acct-new-pass">New password</label>
                <input
                  id="acct-new-pass"
                  className="form-control"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={busy}
                  autoComplete="new-password"
                  required
                />
              </div>
              <button type="submit" className="btn btn-primary w-100" disabled={busy || !currentPassword || !newPassword}>
                Update password
              </button>
            </form>

            <hr />

            <div className="fw-bold mb-2">Delete account</div>
            <form onSubmit={deleteAccount}>
              <div className="mb-3">
                <label className="form-label" htmlFor="acct-delete-pass">Current password</label>
                <input
                  id="acct-delete-pass"
                  className="form-control"
                  type="password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  disabled={busy}
                  autoComplete="current-password"
                  required
                />
              </div>
              <button type="submit" className="btn btn-outline-danger w-100" disabled={busy || !deletePassword}>
                Delete my account
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
