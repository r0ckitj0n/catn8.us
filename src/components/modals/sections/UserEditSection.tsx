import React from 'react';

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
    <div className="catn8-card p-3 mb-3">
      <div className="fw-bold">Edit User #{String(editUserId)}</div>
      <form onSubmit={saveEdit} className="row g-2 mt-1">
        <div className="col-md-4">
          <label className="form-label" htmlFor="settings-user-edit-username">Username</label>
          <input id="settings-user-edit-username" className="form-control" value={editUsername} onChange={(e) => setEditUsername(e.target.value)} disabled={busy} />
        </div>
        <div className="col-md-6">
          <label className="form-label" htmlFor="settings-user-edit-email">Email</label>
          <input id="settings-user-edit-email" className="form-control" type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} disabled={busy} />
        </div>
        <div className="col-md-2 d-flex justify-content-end align-items-end gap-2">
          <button type="button" className="btn btn-outline-secondary" onClick={cancelEdit} disabled={busy}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy || !editUsername.trim() || !editEmail.trim()}>Save</button>
        </div>
      </form>
    </div>
  );
}
