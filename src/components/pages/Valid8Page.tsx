import React from 'react';
import { PageLayout } from '../layout/PageLayout';
import { AppShellPageProps } from '../../types/pages/commonPageProps';
import { useValid8 } from '../../hooks/useValid8';
import { Valid8VaultEntryWithSecrets } from '../../types/valid8';
import { useBrandedConfirm } from '../../hooks/useBrandedConfirm';
import { Valid8AccessState } from '../valid8/Valid8AccessState';
import { Valid8EntriesTable } from '../valid8/Valid8EntriesTable';
import { Valid8PageModals } from '../valid8/Valid8PageModals';
import { Valid8PageToolbar } from '../valid8/Valid8PageToolbar';
import { useValid8PageEntryActions } from '../valid8/useValid8PageEntryActions';
import {
  blankToNull,
  buildCategoryOptions,
  buildOwnerOptions,
  compareEntries,
  EntryDraft,
  filterValid8Entries,
  isDirty,
  makeDraft,
  SortColumn,
} from './valid8PageUtils';
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
    createEntry,
    updateEntry,
    archiveEntry,
    deleteEntry,
    createOwner,
    updateOwner,
    archiveOwner,
    setOwnerArchived,
    deleteOwner,
    createCategory,
    updateCategory,
    archiveCategory,
    setCategoryArchived,
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
  const [creatingEntry, setCreatingEntry] = React.useState(false);
  const [editingEntryId, setEditingEntryId] = React.useState('');
  const [savingEdit, setSavingEdit] = React.useState(false);

  const ownerOptions = React.useMemo(() => buildOwnerOptions(owners, entries), [entries, owners]);

  const categoryOptions = React.useMemo(() => buildCategoryOptions(categories, entries), [categories, entries]);

  const visibleEntries = React.useMemo(() => {
    const filtered = filterValid8Entries(entries, ownerFilter, query);
    return [...filtered].sort((a, b) => compareEntries(a, b, sortBy, sortDir));
  }, [entries, ownerFilter, query, sortBy, sortDir]);

  const selectedEntry = React.useMemo(
    () => entries.find((entry) => entry.id === editingEntryId) || null,
    [editingEntryId, entries],
  );

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
      if (!current) {
        return prev;
      }
      return { ...prev, [entryId]: { ...current, ...patch } };
    });
  }, []);

  const saveInlineDraft = React.useCallback(async (entry: Valid8VaultEntryWithSecrets) => {
    const draft = drafts[entry.id];
    if (!draft || !isDirty(entry, draft)) {
      return;
    }
    try {
      await updateEntry({
        entry_id: entry.id,
        title: draft.title,
        username: draft.username,
        email_address: blankToNull(draft.email_address),
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

  const { addEntry, confirmArchiveEntry, confirmDeleteEntry, saveEntry } = useValid8PageEntryActions({
    archiveEntry,
    confirm,
    createEntry,
    deleteEntry,
    includeInactive,
    load,
    onToast,
    setCreatingEntry,
    setEditingEntryId,
    setSavingEdit,
    updateEntry,
  });

  return (
    <PageLayout page="valid8" title="VALID8" viewer={viewer} onLoginClick={onLoginClick} onLogout={onLogout} onAccountClick={onAccountClick} mysteryTitle={mysteryTitle}>
      <main className="container py-4">
        <section className="card shadow-sm">
          <div className="card-body">
            <Valid8PageToolbar
              busy={busy}
              canAccess={canAccess}
              includeInactive={includeInactive}
              loaded={loaded}
              onCreateEntry={() => setCreatingEntry(true)}
              onLoad={() => void load(includeInactive)}
              onOpenCategories={() => setCategoryModalOpen(true)}
              onOpenOwners={() => setOwnerModalOpen(true)}
              onSetIncludeInactive={setIncludeInactive}
              onSetOwnerFilter={setOwnerFilter}
              onSetQuery={setQuery}
              ownerFilter={ownerFilter}
              ownerOptions={ownerOptions}
              query={query}
            />
            <Valid8AccessState
              canAccess={canAccess}
              entriesCount={entries.length}
              isAuthed={isAuthed}
              loaded={loaded}
              onLoginClick={onLoginClick}
              visibleEntriesCount={visibleEntries.length}
            />
            {canAccess && (
              <>
                {loaded && visibleEntries.length > 0 && (
                  <Valid8EntriesTable
                    attachmentsByEntryId={attachmentsByEntryId}
                    categoryOptions={categoryOptions}
                    confirmArchiveEntry={confirmArchiveEntry}
                    confirmDeleteEntry={confirmDeleteEntry}
                    drafts={drafts}
                    formatDate={formatDate}
                    ownerOptions={ownerOptions}
                    patchDraft={patchDraft}
                    saveInlineDraft={saveInlineDraft}
                    setEditingEntryId={setEditingEntryId}
                    sortIndicator={sortIndicator}
                    toggleSort={toggleSort}
                    updateEntry={updateEntry}
                    uploadAttachment={uploadAttachment}
                    visibleEntries={visibleEntries}
                  />
                )}
              </>
            )}
          </div>
        </section>
      </main>
      <Valid8PageModals
        archiveCategory={archiveCategory}
        archiveOwner={archiveOwner}
        categories={categories}
        categoryModalOpen={categoryModalOpen}
        createCategory={createCategory}
        createOwner={createOwner}
        creatingEntry={creatingEntry}
        deleteCategory={deleteCategory}
        deleteOwner={deleteOwner}
        editingEntryId={editingEntryId}
        entryEditBusy={savingEdit}
        entryEditEntry={selectedEntry}
        onCloseCategoryModal={() => setCategoryModalOpen(false)}
        onCloseEntryModal={() => {
          setCreatingEntry(false);
          setEditingEntryId('');
        }}
        onCloseOwnerModal={() => setOwnerModalOpen(false)}
        onCreateEntry={addEntry}
        onRefreshLookups={refreshLookups}
        onSaveEntry={saveEntry}
        ownerModalOpen={ownerModalOpen}
        owners={owners}
        setCategoryArchived={setCategoryArchived}
        setOwnerArchived={setOwnerArchived}
        updateCategory={updateCategory}
        updateOwner={updateOwner}
      />
      {confirmDialog}
    </PageLayout>
  );
}
