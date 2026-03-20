import React from 'react';

import { ModalCloseIconButton } from '../../common/ModalCloseIconButton';

interface UserEditSectionProps {
  busy: boolean;
  editUserId: number;
  editUsername: string;
  setEditUsername: (v: string) => void;
  editEmail: string;
  setEditEmail: (v: string) => void;
  cancelEdit: () => void;
  saveEdit: (e: React.FormEvent) => Promise<void>;
}

export function UserEditSection({
  busy,
  editUserId,
  editUsername,
  setEditUsername,
  editEmail,
  setEditEmail,
  cancelEdit,
  saveEdit
}: UserEditSectionProps) {
  if (!editUserId) return null;

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
            cancelEdit();
          }
        }}
      >
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">Edit User #{String(editUserId)}</h5>
              <ModalCloseIconButton onClick={cancelEdit} />
            </div>
            <form onSubmit={saveEdit}>
              <div className="modal-body">
                <div className="row g-3">
                  <div className="col-12">
                    <label className="form-label" htmlFor="settings-user-edit-username">Username</label>
                    <input id="settings-user-edit-username" className="form-control" value={editUsername} onChange={(e) => setEditUsername(e.target.value)} disabled={busy} />
                  </div>
                  <div className="col-12">
                    <label className="form-label" htmlFor="settings-user-edit-email">Email</label>
                    <input id="settings-user-edit-email" className="form-control" type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} disabled={busy} />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline-secondary" onClick={cancelEdit} disabled={busy}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={busy || !editUsername.trim() || !editEmail.trim()}>Save</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
