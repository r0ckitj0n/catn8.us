import React from 'react';

import { ModalCloseIconButton } from '../../common/ModalCloseIconButton';

interface UserPasswordSectionProps {
  busy: boolean;
  pwUserId: number;
  pwValue: string;
  setPwValue: (v: string) => void;
  cancelPassword: () => void;
  savePassword: (e: React.FormEvent) => Promise<void>;
}

export function UserPasswordSection({
  busy,
  pwUserId,
  pwValue,
  setPwValue,
  cancelPassword,
  savePassword
}: UserPasswordSectionProps) {
  if (!pwUserId) return null;

  return (
    <>
      <div className="modal-backdrop fade show" />
      <div
        className="modal fade show"
        tabIndex={-1}
        aria-hidden="false"
        aria-modal="true"
        role="dialog"
        style={{ display: 'block' }}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            cancelPassword();
          }
        }}
      >
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">Set Password for User #{String(pwUserId)}</h5>
              <ModalCloseIconButton onClick={cancelPassword} />
            </div>
            <form onSubmit={savePassword}>
              <div className="modal-body">
                <input
                  type="text"
                  name="username"
                  autoComplete="username"
                  value={`user-${String(pwUserId)}`}
                  readOnly
                  tabIndex={-1}
                  aria-hidden="true"
                  style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px', opacity: 0 }}
                />
                <label className="form-label" htmlFor="settings-user-pw">New Password</label>
                <input id="settings-user-pw" className="form-control" type="password" value={pwValue} onChange={(e) => setPwValue(e.target.value)} disabled={busy} autoComplete="new-password" />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline-secondary" onClick={cancelPassword} disabled={busy}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={busy || !pwValue.trim()}>Save Password</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
