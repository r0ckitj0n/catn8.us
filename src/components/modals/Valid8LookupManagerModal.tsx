import React from 'react';
import { useBootstrapModal } from '../../hooks/useBootstrapModal';
import { ModalCloseIconButton } from '../common/ModalCloseIconButton';
import { StandardIconButton } from '../common/StandardIconButton';
import { useBrandedConfirm } from '../../hooks/useBrandedConfirm';
import { Valid8LookupItem } from '../../types/valid8';

interface Valid8LookupManagerModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  itemLabel: string;
  items: Valid8LookupItem[];
  onRefresh: () => Promise<void>;
  onCreate: (name: string) => Promise<void>;
  onUpdate: (id: string, name: string) => Promise<void>;
  onArchive: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function Valid8LookupManagerModal({
  open,
  onClose,
  title,
  itemLabel,
  items,
  onRefresh,
  onCreate,
  onUpdate,
  onArchive,
  onDelete,
}: Valid8LookupManagerModalProps) {
  const { modalRef, modalApiRef } = useBootstrapModal(onClose);
  const { confirm, confirmDialog } = useBrandedConfirm();
  const [busy, setBusy] = React.useState(false);
  const [newName, setNewName] = React.useState('');
  const [editId, setEditId] = React.useState('');
  const [editName, setEditName] = React.useState('');

  React.useEffect(() => {
    const modal = modalApiRef.current;
    if (!modal) return;
    if (open) modal.show();
    else modal.hide();
  }, [open, modalApiRef]);

  React.useEffect(() => {
    if (open) {
      setNewName('');
      setEditId('');
      setEditName('');
    }
  }, [open]);

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

  const saveEdit = async () => {
    const id = editId.trim();
    const name = editName.trim();
    if (!id || !name) return;
    setBusy(true);
    try {
      await onUpdate(id, name);
      setEditId('');
      setEditName('');
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

  return (
    <div className="modal fade" tabIndex={-1} aria-hidden="true" ref={modalRef}>
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">{title}</h5>
            <ModalCloseIconButton />
          </div>
          <div className="modal-body">
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
                    <th>Status</th>
                    <th>Updated</th>
                    <th className="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id || item.name}>
                      <td>
                        {editId === item.id ? (
                          <div className="d-flex align-items-center gap-2">
                            <input
                              className="form-control form-control-sm"
                              value={editName}
                              onChange={(event) => setEditName(event.target.value)}
                              disabled={busy}
                              maxLength={itemLabel === 'Owner' ? 120 : 64}
                            />
                            <button type="button" className="btn btn-sm btn-primary" onClick={() => void saveEdit()} disabled={busy || !editName.trim()}>
                              Save
                            </button>
                            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => { setEditId(''); setEditName(''); }} disabled={busy}>
                              Cancel
                            </button>
                          </div>
                        ) : (
                          item.name
                        )}
                      </td>
                      <td>{Number(item.is_archived) === 1 ? 'Archived' : 'Active'}</td>
                      <td>{item.updated_at || item.created_at || '-'}</td>
                      <td className="text-end">
                        <div className="d-inline-flex gap-2">
                          <StandardIconButton
                            iconKey="edit"
                            ariaLabel={`Edit ${itemLabel} ${item.name}`}
                            title={`Edit ${itemLabel}`}
                            className="btn btn-sm btn-outline-secondary catn8-action-icon-btn"
                            onClick={() => {
                              if (!item.id) return;
                              setEditId(item.id);
                              setEditName(item.name);
                            }}
                            disabled={busy || !item.id || Number(item.is_archived) === 1}
                          />
                          <StandardIconButton
                            iconKey="archive"
                            ariaLabel={`Archive ${itemLabel} ${item.name}`}
                            title={`Archive ${itemLabel}`}
                            className="btn btn-sm btn-outline-warning catn8-action-icon-btn"
                            onClick={() => void archiveItem(item)}
                            disabled={busy || !item.id || Number(item.is_archived) === 1}
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
                  ))}
                  {items.length === 0 ? (
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
      {confirmDialog}
    </div>
  );
}
