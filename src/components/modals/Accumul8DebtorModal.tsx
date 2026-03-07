import React from 'react';
import { useBootstrapModal } from '../../hooks/useBootstrapModal';
import { Accumul8Contact, Accumul8DebtorUpsertRequest } from '../../types/accumul8';
import { ACCUMUL8_SAVE_BUTTON_EMOJI } from '../accumul8/accumul8Ui';
import { ModalCloseIconButton } from '../common/ModalCloseIconButton';

interface Accumul8DebtorModalFormState {
  debtor_name: string;
  contact_id: string;
  notes: string;
  is_active: number;
}

interface Accumul8DebtorModalProps {
  open: boolean;
  busy: boolean;
  editing: boolean;
  initialForm: Accumul8DebtorModalFormState;
  contacts: Accumul8Contact[];
  onClose: () => void;
  onSave: (form: Accumul8DebtorUpsertRequest) => Promise<void>;
}

export function Accumul8DebtorModal({
  open,
  busy,
  editing,
  initialForm,
  contacts,
  onClose,
  onSave,
}: Accumul8DebtorModalProps) {
  const { modalRef, modalApiRef } = useBootstrapModal(onClose);
  const [form, setForm] = React.useState<Accumul8DebtorModalFormState>(initialForm);

  React.useEffect(() => {
    setForm(initialForm);
  }, [initialForm]);

  React.useEffect(() => {
    const modal = modalApiRef.current;
    if (!modal) return;
    if (open) {
      modal.show();
      return;
    }
    modal.hide();
  }, [modalApiRef, open]);

  return (
    <div className="modal fade" tabIndex={-1} aria-hidden="true" ref={modalRef}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">{editing ? 'Edit Balance Person' : 'Add Balance Person'}</h5>
            <ModalCloseIconButton />
          </div>
          <form
            className="modal-body d-grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              void onSave({
                debtor_name: String(form.debtor_name || '').trim(),
                contact_id: form.contact_id ? Number(form.contact_id) : null,
                notes: String(form.notes || '').trim(),
                is_active: Number(form.is_active || 0),
              });
            }}
          >
            <div className="row g-3">
              <div className="col-12">
                <label className="form-label" htmlFor="accumul8-debtor-name">Person Name</label>
                <input
                  id="accumul8-debtor-name"
                  className="form-control"
                  value={form.debtor_name}
                  onChange={(e) => setForm((prev) => ({ ...prev, debtor_name: e.target.value }))}
                  required
                />
              </div>
              <div className="col-12">
                <label className="form-label" htmlFor="accumul8-debtor-contact">Linked Contact</label>
                <select
                  id="accumul8-debtor-contact"
                  className="form-select"
                  value={form.contact_id}
                  onChange={(e) => setForm((prev) => ({ ...prev, contact_id: e.target.value }))}
                >
                  <option value="">Link contact (optional)</option>
                  {contacts.map((contact) => (
                    <option key={contact.id} value={contact.id}>{contact.contact_name}</option>
                  ))}
                </select>
              </div>
              <div className="col-md-4">
                <label className="form-label" htmlFor="accumul8-debtor-status">Status</label>
                <select
                  id="accumul8-debtor-status"
                  className="form-select"
                  value={String(form.is_active)}
                  onChange={(e) => setForm((prev) => ({ ...prev, is_active: Number(e.target.value) }))}
                >
                  <option value="1">Active</option>
                  <option value="0">Paused</option>
                </select>
              </div>
              <div className="col-12">
                <label className="form-label" htmlFor="accumul8-debtor-notes">Notes</label>
                <textarea
                  id="accumul8-debtor-notes"
                  className="form-control"
                  rows={3}
                  value={form.notes}
                  onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                />
              </div>
            </div>
            <div className="d-flex justify-content-end gap-2">
              <button type="button" className="btn btn-outline-secondary" onClick={onClose} disabled={busy}>Cancel</button>
              <button
                type="submit"
                className="btn btn-success"
                disabled={busy || !form.debtor_name.trim()}
                aria-label={editing ? 'Save balance person changes' : 'Add balance person'}
                title={editing ? 'Save balance person changes' : 'Add balance person'}
              >
                <span aria-hidden="true">{editing ? ACCUMUL8_SAVE_BUTTON_EMOJI : '➕'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
