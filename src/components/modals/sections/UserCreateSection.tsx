import React from 'react';

interface UserCreateSectionProps {
  busy: boolean;
  createUsername: string;
  setCreateUsername: (v: string) => void;
  createEmail: string;
  setCreateEmail: (v: string) => void;
  createPassword: string;
  setCreatePassword: (v: string) => void;
  createIsActive: boolean;
  setCreateIsActive: (v: boolean) => void;
  createIsAdmin: boolean;
  setCreateIsAdmin: (v: boolean) => void;
  createUser: (e: React.FormEvent) => Promise<void>;
}

export function UserCreateSection({
  busy,
  createUsername, setCreateUsername,
  createEmail, setCreateEmail,
  createPassword, setCreatePassword,
  createIsActive, setCreateIsActive,
  createIsAdmin, setCreateIsAdmin,
  createUser
}: UserCreateSectionProps) {
  return (
    <div className="catn8-card p-3 mb-3">
      <div className="fw-bold">Create User</div>
      <form onSubmit={createUser} className="row g-2 mt-1">
        <div className="col-md-4">
          <label className="form-label" htmlFor="settings-user-create-username">Username</label>
          <input id="settings-user-create-username" className="form-control" value={createUsername} onChange={(e) => setCreateUsername(e.target.value)} disabled={busy} />
        </div>
        <div className="col-md-4">
          <label className="form-label" htmlFor="settings-user-create-email">Email</label>
          <input id="settings-user-create-email" className="form-control" type="email" value={createEmail} onChange={(e) => setCreateEmail(e.target.value)} disabled={busy} />
        </div>
        <div className="col-md-4">
          <label className="form-label" htmlFor="settings-user-create-password">Password</label>
          <input id="settings-user-create-password" className="form-control" type="password" value={createPassword} onChange={(e) => setCreatePassword(e.target.value)} disabled={busy} />
        </div>
        <div className="col-md-3">
          <div className="form-check mt-4">
            <input id="settings-user-create-active" className="form-check-input" type="checkbox" checked={createIsActive} onChange={(e) => setCreateIsActive(e.target.checked)} disabled={busy} />
            <label className="form-check-label" htmlFor="settings-user-create-active">Active</label>
          </div>
        </div>
        <div className="col-md-3">
          <div className="form-check mt-4">
            <input id="settings-user-create-admin" className="form-check-input" type="checkbox" checked={createIsAdmin} onChange={(e) => setCreateIsAdmin(e.target.checked)} disabled={busy} />
            <label className="form-check-label" htmlFor="settings-user-create-admin">Admin</label>
          </div>
        </div>
        <div className="col-md-6 d-flex justify-content-end align-items-end">
          <button type="submit" className="btn btn-primary" disabled={busy || !createUsername.trim() || !createEmail.trim() || !createPassword.trim()}>
            Create
          </button>
        </div>
      </form>
    </div>
  );
}
