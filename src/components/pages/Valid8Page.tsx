import React from 'react';
import { PageLayout } from '../layout/PageLayout';
import { AppShellPageProps } from '../../types/pages/commonPageProps';
import { useValid8 } from '../../hooks/useValid8';
import { Valid8VaultEntryWithSecrets } from '../../types/valid8';
import './Valid8Page.css';

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
  const { busy, loaded, includeInactive, entries, attachmentsByEntryId, setIncludeInactive, load, uploadAttachment, deleteAttachment } = useValid8(canAccess, onToast);
  const [query, setQuery] = React.useState('');
  const [ownerFilter, setOwnerFilter] = React.useState('');
  const [sortBy, setSortBy] = React.useState<'title' | 'username' | 'password' | 'category' | 'owner_name' | 'is_active' | 'updated_at'>('updated_at');
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('desc');

  const ownerOptions = React.useMemo(() => {
    const unique = new Set<string>();
    entries.forEach((entry) => {
      const owner = String(entry.owner_name || '').trim();
      if (owner) {
        unique.add(owner);
      }
    });
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [entries]);

  const visibleEntries = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = entries.filter((entry) => {
      if (ownerFilter && String(entry.owner_name || '') !== ownerFilter) {
        return false;
      }
      if (!needle) {
        return true;
      }
      const haystack = [
        entry.title,
        entry.username,
        entry.password,
        entry.category,
        entry.owner_name,
        entry.url,
        entry.source_tab,
        entry.source_document,
        Number(entry.is_active) === 1 ? 'active' : 'inactive',
      ]
        .map((value) => String(value || '').toLowerCase())
        .join(' ');
      return haystack.includes(needle);
    });

    const sorted = [...filtered].sort((a, b) => compareEntries(a, b, sortBy, sortDir));
    return sorted;
  }, [entries, ownerFilter, query, sortBy, sortDir]);

  const toggleSort = React.useCallback((nextSortBy: 'title' | 'username' | 'password' | 'category' | 'owner_name' | 'is_active' | 'updated_at') => {
    setSortBy((prevSortBy) => {
      if (prevSortBy !== nextSortBy) {
        setSortDir('asc');
        return nextSortBy;
      }
      setSortDir((prevSortDir) => (prevSortDir === 'asc' ? 'desc' : 'asc'));
      return prevSortBy;
    });
  }, []);

  const sortIndicator = React.useCallback((column: 'title' | 'username' | 'password' | 'category' | 'owner_name' | 'is_active' | 'updated_at') => {
    if (sortBy !== column) {
      return '';
    }
    return sortDir === 'asc' ? ' ▲' : ' ▼';
  }, [sortBy, sortDir]);

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
                  <div className="d-flex align-items-center gap-2">
                    <label className="form-label mb-0" htmlFor="valid8-search">Filter</label>
                    <input
                      id="valid8-search"
                      type="text"
                      className="form-control form-control-sm"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Type to filter..."
                    />
                  </div>
                  <div className="d-flex align-items-center gap-2">
                    <label className="form-label mb-0" htmlFor="valid8-owner-filter">Owner</label>
                    <select
                      id="valid8-owner-filter"
                      className="form-select form-select-sm"
                      value={ownerFilter}
                      onChange={(event) => setOwnerFilter(event.target.value)}
                    >
                      <option value="">All owners</option>
                      {ownerOptions.map((owner) => (
                        <option key={owner} value={owner}>{owner}</option>
                      ))}
                    </select>
                  </div>
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
                {loaded && entries.length > 0 && visibleEntries.length === 0 && (
                  <p className="mb-0 text-muted">No entries match your current filters.</p>
                )}
                {loaded && visibleEntries.length > 0 && (
                  <div className="table-responsive">
                    <table className="table table-sm align-middle">
                      <thead>
                        <tr>
                          <th scope="col"><button type="button" className="btn btn-link btn-sm p-0 text-decoration-none" onClick={() => toggleSort('title')}>Title{sortIndicator('title')}</button></th>
                          <th scope="col"><button type="button" className="btn btn-link btn-sm p-0 text-decoration-none" onClick={() => toggleSort('username')}>Username{sortIndicator('username')}</button></th>
                          <th scope="col"><button type="button" className="btn btn-link btn-sm p-0 text-decoration-none" onClick={() => toggleSort('password')}>Password{sortIndicator('password')}</button></th>
                          <th scope="col"><button type="button" className="btn btn-link btn-sm p-0 text-decoration-none" onClick={() => toggleSort('owner_name')}>Owner{sortIndicator('owner_name')}</button></th>
                          <th scope="col"><button type="button" className="btn btn-link btn-sm p-0 text-decoration-none" onClick={() => toggleSort('category')}>Category{sortIndicator('category')}</button></th>
                          <th scope="col"><button type="button" className="btn btn-link btn-sm p-0 text-decoration-none" onClick={() => toggleSort('is_active')}>Status{sortIndicator('is_active')}</button></th>
                          <th scope="col"><button type="button" className="btn btn-link btn-sm p-0 text-decoration-none" onClick={() => toggleSort('updated_at')}>Updated{sortIndicator('updated_at')}</button></th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleEntries.map((entry) => (
                          <React.Fragment key={entry.id}>
                            <tr>
                              <td>{entry.title || 'n/a'}</td>
                              <td><code>{entry.username || ''}</code></td>
                              <td><code>{entry.password || ''}</code></td>
                              <td>{entry.owner_name || 'Unassigned'}</td>
                              <td>{entry.category || 'n/a'}</td>
                              <td>{Number(entry.is_active) === 1 ? 'Active' : 'Inactive'}</td>
                              <td>{formatDate(entry.updated_at)}</td>
                            </tr>
                            <tr>
                              <td colSpan={7} className="bg-light">
                                <div className="d-flex flex-column gap-2">
                                  <div className="d-flex flex-wrap align-items-center gap-2">
                                    <label className="form-label mb-0" htmlFor={`valid8-attach-${entry.id}`}>Attach image</label>
                                    <input
                                      id={`valid8-attach-${entry.id}`}
                                      type="file"
                                      accept="image/jpeg,image/png,image/webp,image/gif"
                                      className="form-control form-control-sm valid8-attach-input"
                                      onChange={(event) => {
                                        const file = event.target.files?.[0];
                                        if (file) {
                                          void uploadAttachment(entry.id, file);
                                        }
                                        event.currentTarget.value = '';
                                      }}
                                    />
                                  </div>
                                  {(attachmentsByEntryId[entry.id] || []).length > 0 && (
                                    <div className="d-flex flex-wrap gap-3">
                                      {(attachmentsByEntryId[entry.id] || []).map((attachment) => (
                                        <div key={attachment.id} className="border rounded p-2 bg-white valid8-attachment-card">
                                          <a href={attachment.download_url} target="_blank" rel="noreferrer">
                                            <img
                                              src={attachment.download_url}
                                              alt={attachment.original_filename || 'Attachment'}
                                              className="valid8-attachment-image"
                                              loading="lazy"
                                            />
                                          </a>
                                          <div className="small mt-2 text-truncate" title={attachment.original_filename}>
                                            {attachment.original_filename || 'Attachment'}
                                          </div>
                                          <div className="small text-muted mb-2">
                                            {Math.max(1, Math.round(Number(attachment.size_bytes || 0) / 1024))} KB
                                          </div>
                                          <div className="d-flex gap-2">
                                            <a className="btn btn-outline-secondary btn-sm" href={attachment.download_url} target="_blank" rel="noreferrer">Open</a>
                                            <button
                                              type="button"
                                              className="btn btn-outline-danger btn-sm"
                                              onClick={() => void deleteAttachment(entry.id, attachment.id)}
                                            >
                                              Remove
                                            </button>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          </React.Fragment>
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

function compareText(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: 'base' });
}

function compareEntries(
  a: Valid8VaultEntryWithSecrets,
  b: Valid8VaultEntryWithSecrets,
  sortBy: 'title' | 'username' | 'password' | 'category' | 'owner_name' | 'is_active' | 'updated_at',
  sortDir: 'asc' | 'desc',
): number {
  const direction = sortDir === 'asc' ? 1 : -1;
  let result = 0;
  if (sortBy === 'updated_at') {
    result = Date.parse(a.updated_at || '') - Date.parse(b.updated_at || '');
  } else if (sortBy === 'is_active') {
    result = Number(a.is_active || 0) - Number(b.is_active || 0);
  } else {
    result = compareText(String(a[sortBy] || ''), String(b[sortBy] || ''));
  }
  if (result === 0) {
    result = compareText(String(a.title || ''), String(b.title || ''));
  }
  return result * direction;
}
