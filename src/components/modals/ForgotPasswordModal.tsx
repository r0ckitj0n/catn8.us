import React from 'react';
import { ApiClient } from '../../core/ApiClient';
import { useBootstrapModal } from '../../hooks/useBootstrapModal';

interface ForgotPasswordModalProps {
  open: boolean;
  onClose: () => void;
}

export function ForgotPasswordModal({ open, onClose }: ForgotPasswordModalProps) {
  const { modalRef, modalApiRef } = useBootstrapModal(onClose);
  const [email, setEmail] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [newPassword2, setNewPassword2] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    const modal = modalApiRef.current;
    if (!modal) return;
    if (open) modal.show();
    else modal.hide();
  }, [open, modalApiRef]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      if (newPassword !== newPassword2) throw new Error('Passwords do not match');
      await ApiClient.post('/api/auth/request_password_reset.php', { email, new_password: newPassword });
      setMessage('If the email exists, a confirmation link was sent. Your password will update after you click the link.');
    } catch (err: any) {
      setError(err?.message || 'Request failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal fade" tabIndex={-1} aria-hidden="true" ref={modalRef}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Forgot Password</h5>
            <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div className="modal-body">
            {error && <div className="alert alert-danger">{error}</div>}
            {message && <div className="alert alert-success">{message}</div>}
            <form onSubmit={submit}>
              <div className="mb-3">
                <label className="form-label" htmlFor="forgot-email">Email</label>
                <input
                  className="form-control"
                  type="email"
                  id="forgot-email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={busy}
                  required
                />
              </div>
              <div className="mb-3">
                <label className="form-label" htmlFor="forgot-pass1">New password</label>
                <input
                  className="form-control"
                  type="password"
                  id="forgot-pass1"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={busy}
                  required
                />
              </div>
              <div className="mb-3">
                <label className="form-label" htmlFor="forgot-pass2">Confirm new password</label>
                <input
                  className="form-control"
                  type="password"
                  id="forgot-pass2"
                  autoComplete="new-password"
                  value={newPassword2}
                  onChange={(e) => setNewPassword2(e.target.value)}
                  disabled={busy}
                  required
                />
              </div>
              <button type="submit" className="btn btn-primary w-100" disabled={busy}>
                Send reset email
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
