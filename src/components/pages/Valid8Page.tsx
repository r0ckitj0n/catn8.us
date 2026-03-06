import React from 'react';
import { PageLayout } from '../layout/PageLayout';
import { AppShellPageProps } from '../../types/pages/commonPageProps';
import { useValid8 } from '../../hooks/useValid8';

function formatDate(value: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return value || 'n/a';
  }
  return new Date(parsed).toLocaleString();
}

export function Valid8Page({ viewer, onLoginClick, onLogout, onAccountClick, mysteryTitle, onToast }: AppShellPageProps) {
  const isAuthed = Boolean(viewer?.id);
  const isAdministrator = Number(viewer?.is_admin || 0) === 1 || Number(viewer?.is_administrator || 0) === 1;
  const isValid8User = Number(viewer?.is_valid8_user || 0) === 1;
  const canAccess = isAuthed && (isAdministrator || isValid8User);
  const { busy, loaded, includeInactive, entries, setIncludeInactive, load } = useValid8(canAccess, onToast);

  return (
    <PageLayout page="valid8" title="VALID8" viewer={viewer} onLoginClick={onLoginClick} onLogout={onLogout} onAccountClick={onAccountClick} mysteryTitle={mysteryTitle}>
      <main className="container py-4">
        <section className="card shadow-sm">
          <div className="card-body">
            <h1 className="section-title mb-3">VALID8 Password Vault</h1>
            {!isAuthed && (
              <>
                <p className="mb-3">Log in to view your VALID8 vault entries.</p>
                <button type="button" className="btn btn-primary" onClick={onLoginClick}>Log In</button>
              </>
            )}
            {isAuthed && !canAccess && (
              <p className="mb-0 text-danger">
                Your account does not currently have access to VALID8. Contact an administrator to join the VALID8 Users group.
              </p>
            )}
            {canAccess && (
              <>
                <div className="d-flex flex-wrap align-items-center gap-3 mb-3">
                  <label className="form-check mb-0">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      checked={includeInactive}
                      onChange={(event) => setIncludeInactive(event.target.checked)}
                    />
                    <span className="form-check-label">Include inactive history</span>
                  </label>
                  <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => void load(includeInactive)} disabled={busy}>
                    {busy ? 'Loading...' : 'Refresh'}
                  </button>
                </div>
                {!loaded && <p className="mb-0 text-muted">Loading vault entries...</p>}
                {loaded && entries.length === 0 && (
                  <p className="mb-0 text-muted">No vault entries were found for your account.</p>
                )}
                {loaded && entries.length > 0 && (
                  <div className="table-responsive">
                    <table className="table table-sm align-middle">
                      <thead>
                        <tr>
                          <th scope="col">Title</th>
                          <th scope="col">Username</th>
                          <th scope="col">Password</th>
                          <th scope="col">Category</th>
                          <th scope="col">Status</th>
                          <th scope="col">Updated</th>
                        </tr>
                      </thead>
                      <tbody>
                        {entries.map((entry) => (
                          <tr key={entry.id}>
                            <td>{entry.title || 'n/a'}</td>
                            <td><code>{entry.username || ''}</code></td>
                            <td><code>{entry.password || ''}</code></td>
                            <td>{entry.category || 'n/a'}</td>
                            <td>{Number(entry.is_active) === 1 ? 'Active' : 'Inactive'}</td>
                            <td>{formatDate(entry.updated_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      </main>
    </PageLayout>
  );
}
