import React from 'react';
import { StandardIconButton } from '../common/StandardIconButton';
import { useBrandedConfirm } from '../../hooks/useBrandedConfirm';
import { Valid8LookupItem } from '../../types/valid8';
import './Valid8LookupManagerModal.css';

interface Valid8LookupManagerModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  itemLabel: string;
  items: Valid8LookupItem[];
  onRefresh: () => Promise<void>;
  onCreate: (name: string) => Promise<void>;
  onUpdate: (id: string, name: string) => Promise<void>;
  onSetActive: (id: string, isActive: boolean) => Promise<void>;
  onArchive: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

interface LookupFormState {
  id: string;
  name: string;
  isActive: boolean;
}

const EMPTY_FORM: LookupFormState = {
  id: '',
  name: '',
  isActive: true,
};

export function Valid8LookupManagerModal({
  open,
  onClose,
  title,
  itemLabel,
  items,
  onRefresh,
  onCreate,
  onUpdate,
  onSetActive,
  onArchive,
  onDelete,
}: Valid8LookupManagerModalProps) {
  const { confirm, confirmDialog } = useBrandedConfirm();
  const [busy, setBusy] = React.useState(false);
  const [newName, setNewName] = React.useState('');
  const [editingItem, setEditingItem] = React.useState<LookupFormState>(EMPTY_FORM);

  React.useEffect(() => {
    if (open) {
      setNewName('');
      setEditingItem(EMPTY_FORM);
    }
  }, [open]);

  const sortedItems = React.useMemo(
    () => [...items].sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''))),
    [items],
  );

  const saveNew = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    try {
      await onCreate(name);
      setNewName('');
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = async (event: React.FormEvent) => {
    event.preventDefault();
    const id = editingItem.id.trim();
    const name = editingItem.name.trim();
    if (!id || !name) return;
    setBusy(true);
    try {
      await onUpdate(id, name);
      await onSetActive(id, editingItem.isActive);
      setEditingItem(EMPTY_FORM);
    } finally {
      setBusy(false);
    }
  };

  const toggleItemActive = async (itemId: string, isActive: boolean) => {
    if (!itemId) return;
    setBusy(true);
    try {
      await onSetActive(itemId, isActive);
    } finally {
      setBusy(false);
    }
  };

  const archiveItem = async (item: Valid8LookupItem) => {
    const confirmed = await confirm({
      title: `Archive ${itemLabel}?`,
      message: `Archive ${itemLabel.toLowerCase()} "${item.name}"?`,
      confirmLabel: 'Archive',
      tone: 'primary',
    });
    if (!confirmed) return;
    setBusy(true);
    try {
      await onArchive(item.id);
    } finally {
      setBusy(false);
    }
  };

  const deleteItem = async (item: Valid8LookupItem) => {
    const confirmed = await confirm({
      title: `Delete ${itemLabel}?`,
      message: `Delete ${itemLabel.toLowerCase()} "${item.name}"?`,
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!confirmed) return;
    setBusy(true);
    try {
      await onDelete(item.id);
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return null;
  }

  return (
    <>
      <div className="valid8-lookup-modal-backdrop" onClick={onClose} />
      <div className="valid8-lookup-modal-shell" role="dialog" aria-modal="true" aria-label={title}>
        <div className="valid8-lookup-modal-content">
          <div className="modal-header">
            <h5 className="modal-title">{title}</h5>
            <button type="button" className="btn-close" aria-label="Close" onClick={onClose} />
          </div>
          <div className="modal-body valid8-lookup-modal-body">
            <form className="d-flex align-items-end gap-2 mb-3" onSubmit={(event) => void saveNew(event)}>
              <div className="flex-grow-1">
                <label className="form-label mb-1" htmlFor={`valid8-${itemLabel.toLowerCase()}-new-name`}>New {itemLabel}</label>
                <input
                  id={`valid8-${itemLabel.toLowerCase()}-new-name`}
                  className="form-control"
                  value={newName}
                  onChange={(event) => setNewName(event.target.value)}
                  disabled={busy}
                  maxLength={itemLabel === 'Owner' ? 120 : 64}
                />
              </div>
              <button type="submit" className="btn btn-primary" disabled={busy || !newName.trim()}>Add</button>
              <StandardIconButton
                iconKey="refresh"
                ariaLabel={`Refresh ${title}`}
                title="Refresh"
                className="btn btn-outline-secondary catn8-action-icon-btn"
                onClick={() => void onRefresh()}
                disabled={busy}
              />
            </form>

            <div className="table-responsive">
              <table className="table table-sm align-middle">
                <thead>
                  <tr>
                    <th>{itemLabel}</th>
                    <th>Active</th>
                    <th>Updated</th>
                    <th className="text-end valid8-lookup-actions-column catn8-actions-column">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedItems.map((item) => {
                    const isActive = Number(item.is_archived || 0) !== 1;
                    return (
                      <tr key={item.id || item.name} className="valid8-lookup-row">
                        <td>{item.name}</td>
                        <td>
                          <input
                            type="checkbox"
                            checked={isActive}
                            disabled={busy || !item.id}
                            aria-label={`Set ${itemLabel.toLowerCase()} ${item.name} active`}
                            onChange={(event) => void toggleItemActive(item.id, event.target.checked)}
                          />
                        </td>
                        <td>{item.updated_at || item.created_at || '-'}</td>
                        <td className="text-end valid8-lookup-actions-column catn8-actions-column">
                          <div className="d-inline-flex gap-2 valid8-lookup-row-actions">
                            <StandardIconButton
                              iconKey="edit"
                              ariaLabel={`Edit ${itemLabel} ${item.name}`}
                              title={`Edit ${itemLabel}`}
                              className="btn btn-sm btn-outline-secondary catn8-action-icon-btn"
                              onClick={() => setEditingItem({
                                id: item.id,
                                name: item.name,
                                isActive,
                              })}
                              disabled={busy || !item.id}
                            />
                            <StandardIconButton
                              iconKey="archive"
                              ariaLabel={`Archive ${itemLabel} ${item.name}`}
                              title={`Archive ${itemLabel}`}
                              className="btn btn-sm btn-outline-warning catn8-action-icon-btn"
                              onClick={() => void archiveItem(item)}
                              disabled={busy || !item.id || !isActive}
                            />
                            <StandardIconButton
                              iconKey="delete"
                              ariaLabel={`Delete ${itemLabel} ${item.name}`}
                              title={`Delete ${itemLabel}`}
                              className="btn btn-sm btn-outline-danger catn8-action-icon-btn"
                              onClick={() => void deleteItem(item)}
                              disabled={busy || !item.id}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {sortedItems.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-muted">No {itemLabel.toLowerCase()} values yet.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {editingItem.id ? (
        <>
          <div className="valid8-lookup-modal-backdrop valid8-lookup-modal-backdrop--nested" onClick={() => setEditingItem(EMPTY_FORM)} />
          <div className="valid8-lookup-edit-shell" role="dialog" aria-modal="true" aria-label={`Edit ${itemLabel}`}>
            <div className="valid8-lookup-edit-content">
              <div className="modal-header">
                <h5 className="modal-title">Edit {itemLabel}</h5>
                <button type="button" className="btn-close" aria-label="Close" onClick={() => setEditingItem(EMPTY_FORM)} />
              </div>
              <form className="modal-body d-grid gap-3" onSubmit={(event) => void saveEdit(event)}>
                <div>
                  <label className="form-label" htmlFor={`valid8-${itemLabel.toLowerCase()}-edit-name`}>{itemLabel}</label>
                  <input
                    id={`valid8-${itemLabel.toLowerCase()}-edit-name`}
                    className="form-control"
                    value={editingItem.name}
                    onChange={(event) => setEditingItem((prev) => ({ ...prev, name: event.target.value }))}
                    disabled={busy}
                    maxLength={itemLabel === 'Owner' ? 120 : 64}
                  />
                </div>
                <label className="form-check-label d-inline-flex align-items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editingItem.isActive}
                    onChange={(event) => setEditingItem((prev) => ({ ...prev, isActive: event.target.checked }))}
                    disabled={busy}
                  />
                  Active
                </label>
                <div className="modal-footer p-0 pt-2">
                  <button type="button" className="btn btn-outline-secondary" onClick={() => setEditingItem(EMPTY_FORM)} disabled={busy}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={busy || !editingItem.name.trim()}>
                    {busy ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      ) : null}
      {confirmDialog}
    </>
  );
}
