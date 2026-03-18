import React from 'react';

import { Valid8VaultEntryWithSecrets } from '../../types/valid8';
import { StandardIcon } from '../common/StandardIcon';
import { StandardIconButton } from '../common/StandardIconButton';

type SortColumn = 'title' | 'username' | 'email_address' | 'category' | 'owner_name' | 'is_active' | 'updated_at';

interface EntryDraft {
  title: string;
  username: string;
  email_address: string;
  password: string;
  owner_name: string;
  category: string;
  is_active: number;
}

interface Valid8EntriesTableProps {
  attachmentsByEntryId: Record<string, Array<unknown>>;
  categoryOptions: string[];
  confirmArchiveEntry: (entry: Valid8VaultEntryWithSecrets) => Promise<void>;
  confirmDeleteEntry: (entry: Valid8VaultEntryWithSecrets) => Promise<void>;
  drafts: Record<string, EntryDraft>;
  formatDate: (value: string) => string;
  ownerOptions: string[];
  patchDraft: (entryId: string, patch: Partial<EntryDraft>) => void;
  saveInlineDraft: (entry: Valid8VaultEntryWithSecrets) => Promise<void>;
  setEditingEntryId: (entryId: string) => void;
  sortIndicator: (column: SortColumn) => string;
  toggleSort: (column: SortColumn) => void;
  updateEntry: (payload: { entry_id: string; owner_name?: string; category?: string; is_active?: number }) => Promise<unknown>;
  uploadAttachment: (entryId: string, file: File) => Promise<void>;
  visibleEntries: Valid8VaultEntryWithSecrets[];
}

export function Valid8EntriesTable({
  attachmentsByEntryId,
  categoryOptions,
  confirmArchiveEntry,
  confirmDeleteEntry,
  drafts,
  formatDate,
  ownerOptions,
  patchDraft,
  saveInlineDraft,
  setEditingEntryId,
  sortIndicator,
  toggleSort,
  updateEntry,
  uploadAttachment,
  visibleEntries,
}: Valid8EntriesTableProps) {
  return (
    <div className="table-responsive">
      <table className="table table-sm align-middle">
        <thead>
          <tr>
            <th scope="col"><button type="button" className="btn btn-link btn-sm p-0 text-decoration-none" onClick={() => toggleSort('title')}>Title{sortIndicator('title')}</button></th>
            <th scope="col"><button type="button" className="btn btn-link btn-sm p-0 text-decoration-none" onClick={() => toggleSort('username')}>Username{sortIndicator('username')}</button></th>
            <th scope="col"><button type="button" className="btn btn-link btn-sm p-0 text-decoration-none" onClick={() => toggleSort('email_address')}>Email{sortIndicator('email_address')}</button></th>
            <th scope="col"><button type="button" className="btn btn-link btn-sm p-0 text-decoration-none" onClick={() => toggleSort('owner_name')}>Owner{sortIndicator('owner_name')}</button></th>
            <th scope="col"><button type="button" className="btn btn-link btn-sm p-0 text-decoration-none" onClick={() => toggleSort('category')}>Category{sortIndicator('category')}</button></th>
            <th scope="col"><button type="button" className="btn btn-link btn-sm p-0 text-decoration-none" onClick={() => toggleSort('is_active')}>Active{sortIndicator('is_active')}</button></th>
            <th scope="col"><button type="button" className="btn btn-link btn-sm p-0 text-decoration-none" onClick={() => toggleSort('updated_at')}>Updated{sortIndicator('updated_at')}</button></th>
            <th scope="col" className="text-end valid8-actions-column catn8-actions-column">Actions</th>
          </tr>
        </thead>
        <tbody>
          {visibleEntries.map((entry) => {
            const draft = drafts[entry.id] || {
              title: String(entry.title || ''),
              username: String(entry.username || ''),
              email_address: String(entry.email_address || ''),
              password: String(entry.password || ''),
              owner_name: String(entry.owner_name || 'Unassigned'),
              category: String(entry.category || 'General'),
              is_active: Number(entry.is_active || 0) ? 1 : 0,
            };
            const attachments = attachmentsByEntryId[entry.id] || [];
            const hasAttachments = attachments.length > 0;
            return (
              <tr key={entry.id} className="valid8-entry-row">
                <td>
                  <input
                    className="form-control form-control-sm"
                    value={draft.title}
                    onChange={(event) => patchDraft(entry.id, { title: event.target.value })}
                    onBlur={() => void saveInlineDraft(entry)}
                  />
                </td>
                <td>
                  <input
                    className="form-control form-control-sm"
                    value={draft.username}
                    onChange={(event) => patchDraft(entry.id, { username: event.target.value })}
                    onBlur={() => void saveInlineDraft(entry)}
                  />
                </td>
                <td>
                  <input
                    className="form-control form-control-sm"
                    value={draft.email_address}
                    onChange={(event) => patchDraft(entry.id, { email_address: event.target.value })}
                    onBlur={() => void saveInlineDraft(entry)}
                  />
                </td>
                <td>
                  <select
                    className="form-select form-select-sm"
                    value={draft.owner_name}
                    onChange={(event) => {
                      const value = event.target.value;
                      patchDraft(entry.id, { owner_name: value });
                      void updateEntry({ entry_id: entry.id, owner_name: value });
                    }}
                  >
                    {ownerOptions.map((owner) => (
                      <option key={`${entry.id}-owner-${owner}`} value={owner}>{owner}</option>
                    ))}
                    {ownerOptions.includes(draft.owner_name) ? null : <option value={draft.owner_name}>{draft.owner_name}</option>}
                  </select>
                </td>
                <td>
                  <select
                    className="form-select form-select-sm"
                    value={draft.category}
                    onChange={(event) => {
                      const value = event.target.value;
                      patchDraft(entry.id, { category: value });
                      void updateEntry({ entry_id: entry.id, category: value });
                    }}
                  >
                    {categoryOptions.map((category) => (
                      <option key={`${entry.id}-category-${category}`} value={category}>{category}</option>
                    ))}
                    {categoryOptions.includes(draft.category) ? null : <option value={draft.category}>{draft.category}</option>}
                  </select>
                </td>
                <td>
                  <label className="d-inline-flex align-items-center gap-2">
                    <input
                      type="checkbox"
                      checked={Number(draft.is_active || 0) === 1}
                      onChange={(event) => {
                        const value = event.target.checked ? 1 : 0;
                        patchDraft(entry.id, { is_active: value });
                        void updateEntry({ entry_id: entry.id, is_active: value });
                      }}
                    />
                  </label>
                </td>
                <td className="small text-muted">{formatDate(entry.updated_at)}</td>
                <td className="text-end valid8-actions-column catn8-actions-column">
                  <div className="d-inline-flex gap-2 valid8-row-actions">
                    <label
                      className={`btn btn-sm catn8-action-icon-btn valid8-attachment-trigger ${hasAttachments ? 'valid8-attachment-trigger--has-attachment' : 'valid8-attachment-trigger--empty'}`}
                      aria-label={`Attach image for ${entry.title || entry.username || 'entry'}`}
                      title={hasAttachments ? 'Manage attachment in full record' : 'Upload attachment'}
                    >
                      <StandardIcon iconKey="upload" className="catn8-icon-btn-glyph" />
                      <input
                        id={`valid8-attach-${entry.id}`}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        className="valid8-attach-input"
                        aria-label={`Attach image for ${entry.title || entry.username || 'entry'}`}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) {
                            void uploadAttachment(entry.id, file);
                          }
                          event.currentTarget.value = '';
                        }}
                      />
                    </label>
                    <StandardIconButton
                      iconKey="edit"
                      ariaLabel={`Edit ${entry.title || entry.username || 'entry'}`}
                      title="Edit full record"
                      className="btn btn-sm btn-outline-secondary catn8-action-icon-btn"
                      onClick={() => setEditingEntryId(entry.id)}
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
  );
}
