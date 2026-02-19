import React from 'react';

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
    <div className="catn8-card p-3 mb-3">
      <div className="fw-bold">Set Password (User #{String(pwUserId)})</div>
      <form onSubmit={savePassword} className="row g-2 mt-1">
        <div className="col-md-8">
          <label className="form-label" htmlFor="settings-user-pw">New Password</label>
          <input id="settings-user-pw" className="form-control" type="password" value={pwValue} onChange={(e) => setPwValue(e.target.value)} disabled={busy} />
        </div>
        <div className="col-md-4 d-flex justify-content-end align-items-end gap-2">
          <button type="button" className="btn btn-outline-secondary" onClick={cancelPassword} disabled={busy}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy || !pwValue.trim()}>Save Password</button>
        </div>
      </form>
    </div>
  );
}
