import React from 'react';
import { Valid8LookupItem, Valid8VaultEntryUpdateRequest, Valid8VaultEntryWithSecrets } from '../../types/valid8';
import { useBootstrapModal } from '../../hooks/useBootstrapModal';
import { ModalCloseIconButton } from '../common/ModalCloseIconButton';

interface Valid8EntryEditModalProps {
  open: boolean;
  busy: boolean;
  entry: Valid8VaultEntryWithSecrets | null;
  owners: Valid8LookupItem[];
  categories: Valid8LookupItem[];
  onClose: () => void;
  onSave: (payload: Valid8VaultEntryUpdateRequest) => Promise<void>;
}

interface EntryFormState {
  title: string;
  url: string;
  email_address: string;
  username: string;
  password: string;
  notes: string;
  owner_name: string;
  category: string;
  is_active: number;
  source_tab: string;
  source_document: string;
}

export function Valid8EntryEditModal({
  open,
  busy,
  entry,
  owners,
  categories,
  onClose,
  onSave,
}: Valid8EntryEditModalProps) {
  const { modalRef, modalApiRef } = useBootstrapModal(onClose);
  const [state, setState] = React.useState<EntryFormState>(() => makeState(entry));

  React.useEffect(() => {
    const modal = modalApiRef.current;
    if (!modal) return;
    if (open) {
      modal.show();
    } else {
      modal.hide();
    }
  }, [modalApiRef, open]);

  React.useEffect(() => {
    if (open) {
      setState(makeState(entry));
    }
  }, [entry, open]);

  const ownerOptions = React.useMemo(() => {
    const set = new Set<string>();
    owners.forEach((owner) => {
      const name = String(owner.name || '').trim();
      if (name && Number(owner.is_archived || 0) !== 1) {
        set.add(name);
      }
    });
    const current = String(state.owner_name || '').trim();
    if (current) {
      set.add(current);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [owners, state.owner_name]);

  const categoryOptions = React.useMemo(() => {
    const set = new Set<string>();
    categories.forEach((category) => {
      const name = String(category.name || '').trim();
      if (name && Number(category.is_archived || 0) !== 1) {
        set.add(name);
      }
    });
    const current = String(state.category || '').trim();
    if (current) {
      set.add(current);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [categories, state.category]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!entry?.id || busy) return;
    await onSave({
      entry_id: entry.id,
      title: state.title,
      url: blankToNull(state.url),
      email_address: blankToNull(state.email_address),
      username: state.username,
      password: state.password,
      notes: blankToNull(state.notes),
      owner_name: state.owner_name,
      category: state.category,
      is_active: Number(state.is_active || 0) ? 1 : 0,
      source_tab: blankToNull(state.source_tab),
      source_document: blankToNull(state.source_document),
    });
  };

  return (
    <div className="modal fade" tabIndex={-1} aria-hidden="true" ref={modalRef}>
      <div className="modal-dialog modal-dialog-centered modal-xl">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Edit VALID8 Entry</h5>
            <ModalCloseIconButton />
          </div>
          <form className="modal-body d-grid gap-3" onSubmit={(event) => void submit(event)}>
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label" htmlFor="valid8-edit-title">Title</label>
                <input
                  id="valid8-edit-title"
                  className="form-control"
                  value={state.title}
                  onChange={(event) => setState((prev) => ({ ...prev, title: event.target.value }))}
                  maxLength={191}
                  required
                />
              </div>
              <div className="col-md-6">
                <label className="form-label" htmlFor="valid8-edit-url">URL</label>
                <input
                  id="valid8-edit-url"
                  className="form-control"
                  value={state.url}
                  onChange={(event) => setState((prev) => ({ ...prev, url: event.target.value }))}
                  maxLength={2048}
                />
              </div>
              <div className="col-md-6">
                <label className="form-label" htmlFor="valid8-edit-username">Username</label>
                <input
                  id="valid8-edit-username"
                  className="form-control"
                  value={state.username}
                  onChange={(event) => setState((prev) => ({ ...prev, username: event.target.value }))}
                  maxLength={8192}
                  required
                />
              </div>
              <div className="col-md-6">
                <label className="form-label" htmlFor="valid8-edit-email">Email Address</label>
                <input
                  id="valid8-edit-email"
                  className="form-control"
                  type="email"
                  value={state.email_address}
                  onChange={(event) => setState((prev) => ({ ...prev, email_address: event.target.value }))}
                  maxLength={191}
                />
              </div>
              <div className="col-md-6">
                <label className="form-label" htmlFor="valid8-edit-password">Password</label>
                <input
                  id="valid8-edit-password"
                  className="form-control"
                  value={state.password}
                  onChange={(event) => setState((prev) => ({ ...prev, password: event.target.value }))}
                  maxLength={8192}
                  required
                />
              </div>
              <div className="col-md-3">
                <label className="form-label" htmlFor="valid8-edit-owner">Owner</label>
                <select
                  id="valid8-edit-owner"
                  className="form-select"
                  value={state.owner_name}
                  onChange={(event) => setState((prev) => ({ ...prev, owner_name: event.target.value }))}
                >
                  {ownerOptions.map((owner) => (
                    <option key={owner} value={owner}>{owner}</option>
                  ))}
                </select>
              </div>
              <div className="col-md-3">
                <label className="form-label" htmlFor="valid8-edit-category">Category</label>
                <select
                  id="valid8-edit-category"
                  className="form-select"
                  value={state.category}
                  onChange={(event) => setState((prev) => ({ ...prev, category: event.target.value }))}
                >
                  {categoryOptions.map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>
              <div className="col-md-6">
                <label className="form-label" htmlFor="valid8-edit-source-tab">Source Tab</label>
                <input
                  id="valid8-edit-source-tab"
                  className="form-control"
                  value={state.source_tab}
                  onChange={(event) => setState((prev) => ({ ...prev, source_tab: event.target.value }))}
                  maxLength={191}
                />
              </div>
              <div className="col-md-6">
                <label className="form-label" htmlFor="valid8-edit-source-document">Source Document</label>
                <input
                  id="valid8-edit-source-document"
                  className="form-control"
                  value={state.source_document}
                  onChange={(event) => setState((prev) => ({ ...prev, source_document: event.target.value }))}
                  maxLength={191}
                />
              </div>
              <div className="col-12">
                <label className="form-label" htmlFor="valid8-edit-notes">Notes</label>
                <textarea
                  id="valid8-edit-notes"
                  className="form-control"
                  rows={4}
                  value={state.notes}
                  onChange={(event) => setState((prev) => ({ ...prev, notes: event.target.value }))}
                />
              </div>
              <div className="col-12">
                <label className="form-check-label d-inline-flex align-items-center gap-2">
                  <input
                    type="checkbox"
                    checked={Number(state.is_active || 0) === 1}
                    onChange={(event) => setState((prev) => ({ ...prev, is_active: event.target.checked ? 1 : 0 }))}
                  />
                  Active
                </label>
              </div>
            </div>
            <div className="modal-footer p-0 pt-2">
              <button type="button" className="btn btn-outline-secondary" onClick={onClose} disabled={busy}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={busy || !entry?.id}>
                {busy ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function makeState(entry: Valid8VaultEntryWithSecrets | null): EntryFormState {
  return {
    title: String(entry?.title || ''),
    url: String(entry?.url || ''),
    email_address: String(entry?.email_address || ''),
    username: String(entry?.username || ''),
    password: String(entry?.password || ''),
    notes: String(entry?.notes || ''),
    owner_name: String(entry?.owner_name || 'Unassigned'),
    category: String(entry?.category || 'General'),
    is_active: Number(entry?.is_active || 0) ? 1 : 0,
    source_tab: String(entry?.source_tab || ''),
    source_document: String(entry?.source_document || ''),
  };
}

function blankToNull(value: string): string | null {
  const trimmed = String(value || '').trim();
  return trimmed === '' ? null : trimmed;
}
