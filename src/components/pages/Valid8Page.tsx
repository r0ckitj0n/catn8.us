import React from 'react';
import { PageLayout } from '../layout/PageLayout';
import { AppShellPageProps } from '../../types/pages/commonPageProps';
import { useValid8 } from '../../hooks/useValid8';
import { Valid8VaultEntryWithSecrets } from '../../types/valid8';
import { StandardIconButton } from '../common/StandardIconButton';
import { useBrandedConfirm } from '../../hooks/useBrandedConfirm';
import { Valid8LookupManagerModal } from '../modals/Valid8LookupManagerModal';
import './Valid8Page.css';

function formatDate(value: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return value || 'n/a';
  }
  return new Date(parsed).toLocaleString();
}

interface EntryDraft {
  title: string;
  username: string;
  password: string;
  owner_name: string;
  category: string;
  is_active: number;
}

type SortColumn = 'title' | 'username' | 'password' | 'category' | 'owner_name' | 'is_active' | 'updated_at';

export function Valid8Page({ viewer, onLoginClick, onLogout, onAccountClick, mysteryTitle, onToast }: AppShellPageProps) {
  const isAuthed = Boolean(viewer?.id);
  const isAdministrator = Number(viewer?.is_admin || 0) === 1 || Number(viewer?.is_administrator || 0) === 1;
  const isValid8User = Number(viewer?.is_valid8_user || 0) === 1;
  const canAccess = isAuthed && (isAdministrator || isValid8User);
  const {
    busy,
    loaded,
    includeInactive,
    entries,
    attachmentsByEntryId,
    owners,
    categories,
    setIncludeInactive,
    load,
    refreshLookups,
    uploadAttachment,
    deleteAttachment,
    updateEntry,
    archiveEntry,
    deleteEntry,
    createOwner,
    updateOwner,
    archiveOwner,
    deleteOwner,
    createCategory,
    updateCategory,
    archiveCategory,
    deleteCategory,
  } = useValid8(canAccess, onToast);
  const { confirm, confirmDialog } = useBrandedConfirm();

  const [query, setQuery] = React.useState('');
  const [ownerFilter, setOwnerFilter] = React.useState('');
  const [sortBy, setSortBy] = React.useState<SortColumn>('updated_at');
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('desc');
  const [drafts, setDrafts] = React.useState<Record<string, EntryDraft>>({});
  const [ownerModalOpen, setOwnerModalOpen] = React.useState(false);
  const [categoryModalOpen, setCategoryModalOpen] = React.useState(false);
  const titleInputRefs = React.useRef<Record<string, HTMLInputElement | null>>({});

  const ownerOptions = React.useMemo(() => {
    const set = new Set<string>();
    owners.forEach((owner) => {
      const name = String(owner.name || '').trim();
      if (name && Number(owner.is_archived || 0) !== 1) {
        set.add(name);
      }
    });
    entries.forEach((entry) => {
      const name = String(entry.owner_name || '').trim();
      if (name) {
        set.add(name);
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [entries, owners]);

  const categoryOptions = React.useMemo(() => {
    const set = new Set<string>();
    categories.forEach((category) => {
      const name = String(category.name || '').trim();
      if (name && Number(category.is_archived || 0) !== 1) {
        set.add(name);
      }
    });
    entries.forEach((entry) => {
      const name = String(entry.category || '').trim();
      if (name) {
        set.add(name);
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [categories, entries]);

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
      ].map((value) => String(value || '').toLowerCase()).join(' ');
      return haystack.includes(needle);
    });
    return [...filtered].sort((a, b) => compareEntries(a, b, sortBy, sortDir));
  }, [entries, ownerFilter, query, sortBy, sortDir]);

  React.useEffect(() => {
    setDrafts((prev) => {
      const next: Record<string, EntryDraft> = {};
      visibleEntries.forEach((entry) => {
        next[entry.id] = prev[entry.id] || makeDraft(entry);
      });
      return next;
    });
  }, [visibleEntries]);

  const toggleSort = React.useCallback((nextSortBy: SortColumn) => {
    setSortBy((prevSortBy) => {
      if (prevSortBy !== nextSortBy) {
        setSortDir('asc');
        return nextSortBy;
      }
      setSortDir((prevSortDir) => (prevSortDir === 'asc' ? 'desc' : 'asc'));
      return prevSortBy;
    });
  }, []);

  const sortIndicator = React.useCallback((column: SortColumn) => {
    if (sortBy !== column) {
      return '';
    }
    return sortDir === 'asc' ? ' ▲' : ' ▼';
  }, [sortBy, sortDir]);

  const patchDraft = React.useCallback((entryId: string, patch: Partial<EntryDraft>) => {
    setDrafts((prev) => {
      const current = prev[entryId];
      if (!current) return prev;
      return { ...prev, [entryId]: { ...current, ...patch } };
    });
  }, []);

  const saveEntryDraft = React.useCallback(async (entry: Valid8VaultEntryWithSecrets) => {
    const draft = drafts[entry.id];
    if (!draft) return;
    if (!isDirty(entry, draft)) return;
    try {
      await updateEntry({
        entry_id: entry.id,
        title: draft.title,
        username: draft.username,
        password: draft.password,
        owner_name: draft.owner_name,
        category: draft.category,
        is_active: draft.is_active,
      });
    } catch (error: any) {
      if (onToast) {
        onToast({ tone: 'error', message: String(error?.message || 'Failed to update entry') });
      }
    }
  }, [drafts, onToast, updateEntry]);

  const confirmArchiveEntry = React.useCallback(async (entry: Valid8VaultEntryWithSecrets) => {
    const ok = await confirm({
      title: 'Archive Entry?',
      message: `Archive "${entry.title || entry.username || 'entry'}"?`,
      confirmLabel: 'Archive',
      tone: 'primary',
    });
    if (!ok) return;
    try {
      await archiveEntry(entry.id);
      await load(includeInactive);
    } catch (error: any) {
      if (onToast) {
        onToast({ tone: 'error', message: String(error?.message || 'Failed to archive entry') });
      }
    }
  }, [archiveEntry, confirm, includeInactive, load, onToast]);

  const confirmDeleteEntry = React.useCallback(async (entry: Valid8VaultEntryWithSecrets) => {
    const ok = await confirm({
      title: 'Delete Entry?',
      message: `Delete "${entry.title || entry.username || 'entry'}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await deleteEntry(entry.id);
    } catch (error: any) {
      if (onToast) {
        onToast({ tone: 'error', message: String(error?.message || 'Failed to delete entry') });
      }
    }
  }, [confirm, deleteEntry, onToast]);

  return (
    <PageLayout page="valid8" title="VALID8" viewer={viewer} onLoginClick={onLoginClick} onLogout={onLogout} onAccountClick={onAccountClick} mysteryTitle={mysteryTitle}>
      <main className="container py-4">
        <section className="card shadow-sm">
          <div className="card-body">
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
              <h1 className="section-title mb-0">VALID8 Password Vault</h1>
              {canAccess && (
                <div className="d-inline-flex gap-2">
                  <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setOwnerModalOpen(true)}>Owners</button>
                  <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setCategoryModalOpen(true)}>Categories</button>
                </div>
              )}
            </div>
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
                          <th scope="col"><button type="button" className="btn btn-link btn-sm p-0 text-decoration-none" onClick={() => toggleSort('is_active')}>Active{sortIndicator('is_active')}</button></th>
                          <th scope="col"><button type="button" className="btn btn-link btn-sm p-0 text-decoration-none" onClick={() => toggleSort('updated_at')}>Updated{sortIndicator('updated_at')}</button></th>
                          <th scope="col">Attach image</th>
                          <th scope="col" className="text-end">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleEntries.map((entry) => {
                          const draft = drafts[entry.id] || makeDraft(entry);
                          const attachments = attachmentsByEntryId[entry.id] || [];
                          return (
                            <tr key={entry.id} className="valid8-entry-row">
                              <td>
                                <input
                                  ref={(element) => { titleInputRefs.current[entry.id] = element; }}
                                  className="form-control form-control-sm"
                                  value={draft.title}
                                  onChange={(event) => patchDraft(entry.id, { title: event.target.value })}
                                  onBlur={() => void saveEntryDraft(entry)}
                                  onKeyDown={(event) => {
                                    if (event.key === 'Enter') {
                                      event.preventDefault();
                                      event.currentTarget.blur();
                                    }
                                  }}
                                />
                              </td>
                              <td>
                                <input
                                  className="form-control form-control-sm"
                                  value={draft.username}
                                  onChange={(event) => patchDraft(entry.id, { username: event.target.value })}
                                  onBlur={() => void saveEntryDraft(entry)}
                                  onKeyDown={(event) => {
                                    if (event.key === 'Enter') {
                                      event.preventDefault();
                                      event.currentTarget.blur();
                                    }
                                  }}
                                />
                              </td>
                              <td>
                                <input
                                  className="form-control form-control-sm"
                                  value={draft.password}
                                  onChange={(event) => patchDraft(entry.id, { password: event.target.value })}
                                  onBlur={() => void saveEntryDraft(entry)}
                                  onKeyDown={(event) => {
                                    if (event.key === 'Enter') {
                                      event.preventDefault();
                                      event.currentTarget.blur();
                                    }
                                  }}
                                />
                              </td>
                              <td>
                                <select
                                  className="form-select form-select-sm"
                                  value={draft.owner_name}
                                  onChange={(event) => {
                                    const next = event.target.value;
                                    patchDraft(entry.id, { owner_name: next });
                                    void updateEntry({ entry_id: entry.id, owner_name: next });
                                  }}
                                >
                                  {ownerOptions.map((owner) => (
                                    <option key={`${entry.id}-owner-${owner}`} value={owner}>{owner}</option>
                                  ))}
                                  {ownerOptions.includes(draft.owner_name) ? null : (
                                    <option value={draft.owner_name}>{draft.owner_name}</option>
                                  )}
                                </select>
                              </td>
                              <td>
                                <select
                                  className="form-select form-select-sm"
                                  value={draft.category}
                                  onChange={(event) => {
                                    const next = event.target.value;
                                    patchDraft(entry.id, { category: next });
                                    void updateEntry({ entry_id: entry.id, category: next });
                                  }}
                                >
                                  {categoryOptions.map((category) => (
                                    <option key={`${entry.id}-category-${category}`} value={category}>{category}</option>
                                  ))}
                                  {categoryOptions.includes(draft.category) ? null : (
                                    <option value={draft.category}>{draft.category}</option>
                                  )}
                                </select>
                              </td>
                              <td>
                                <label className="d-inline-flex align-items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={Number(draft.is_active || 0) === 1}
                                    onChange={(event) => {
                                      const next = event.target.checked ? 1 : 0;
                                      patchDraft(entry.id, { is_active: next });
                                      void updateEntry({ entry_id: entry.id, is_active: next });
                                    }}
                                  />
                                </label>
                              </td>
                              <td className="small text-muted">{formatDate(entry.updated_at)}</td>
                              <td>
                                <div className="d-flex flex-wrap align-items-center gap-2">
                                  {attachments.map((attachment) => (
                                    <div key={attachment.id} className="valid8-inline-attachment">
                                      <a href={attachment.download_url} target="_blank" rel="noreferrer">
                                        <img
                                          src={attachment.download_url}
                                          alt={attachment.original_filename || 'Attachment'}
                                          className="valid8-attachment-image"
                                          loading="lazy"
                                        />
                                      </a>
                                      <button
                                        type="button"
                                        className="btn btn-sm btn-outline-danger valid8-attachment-remove-btn"
                                        onClick={() => void deleteAttachment(entry.id, attachment.id)}
                                      >
                                        Remove
                                      </button>
                                    </div>
                                  ))}
                                  <input
                                    id={`valid8-attach-${entry.id}`}
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp,image/gif"
                                    className="form-control form-control-sm valid8-attach-input"
                                    aria-label={`Attach image for ${entry.title || entry.username || 'entry'}`}
                                    onChange={(event) => {
                                      const file = event.target.files?.[0];
                                      if (file) {
                                        void uploadAttachment(entry.id, file);
                                      }
                                      event.currentTarget.value = '';
                                    }}
                                  />
                                </div>
                              </td>
                              <td className="text-end">
                                <div className="d-inline-flex gap-2 valid8-row-actions">
                                  <StandardIconButton
                                    iconKey="edit"
                                    ariaLabel={`Edit ${entry.title || entry.username || 'entry'}`}
                                    title="Edit line"
                                    className="btn btn-sm btn-outline-secondary catn8-action-icon-btn"
                                    onClick={() => titleInputRefs.current[entry.id]?.focus()}
                                  />
                                  <StandardIconButton
                                    iconKey="archive"
                                    ariaLabel={`Archive ${entry.title || entry.username || 'entry'}`}
                                    title="Archive line"
                                    className="btn btn-sm btn-outline-warning catn8-action-icon-btn"
                                    onClick={() => void confirmArchiveEntry(entry)}
                                  />
                                  <StandardIconButton
                                    iconKey="delete"
                                    ariaLabel={`Delete ${entry.title || entry.username || 'entry'}`}
                                    title="Delete line"
                                    className="btn btn-sm btn-outline-danger catn8-action-icon-btn"
                                    onClick={() => void confirmDeleteEntry(entry)}
                                  />
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      </main>
      <Valid8LookupManagerModal
        open={ownerModalOpen}
        onClose={() => setOwnerModalOpen(false)}
        title="VALID8 Owners"
        itemLabel="Owner"
        items={owners}
        onRefresh={refreshLookups}
        onCreate={createOwner}
        onUpdate={updateOwner}
        onArchive={archiveOwner}
        onDelete={deleteOwner}
      />
      <Valid8LookupManagerModal
        open={categoryModalOpen}
        onClose={() => setCategoryModalOpen(false)}
        title="VALID8 Categories"
        itemLabel="Category"
        items={categories}
        onRefresh={refreshLookups}
        onCreate={createCategory}
        onUpdate={updateCategory}
        onArchive={archiveCategory}
        onDelete={deleteCategory}
      />
      {confirmDialog}
    </PageLayout>
  );
}

function makeDraft(entry: Valid8VaultEntryWithSecrets): EntryDraft {
  return {
    title: String(entry.title || ''),
    username: String(entry.username || ''),
    password: String(entry.password || ''),
    owner_name: String(entry.owner_name || 'Unassigned'),
    category: String(entry.category || 'General'),
    is_active: Number(entry.is_active || 0) ? 1 : 0,
  };
}

function isDirty(entry: Valid8VaultEntryWithSecrets, draft: EntryDraft): boolean {
  return String(entry.title || '') !== draft.title
    || String(entry.username || '') !== draft.username
    || String(entry.password || '') !== draft.password
    || String(entry.owner_name || 'Unassigned') !== draft.owner_name
    || String(entry.category || 'General') !== draft.category
    || Number(entry.is_active || 0) !== Number(draft.is_active || 0);
}

function compareText(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: 'base' });
}

function compareEntries(
  a: Valid8VaultEntryWithSecrets,
  b: Valid8VaultEntryWithSecrets,
  sortBy: SortColumn,
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
