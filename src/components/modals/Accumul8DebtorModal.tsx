import React from 'react';
import { useBootstrapModal } from '../../hooks/useBootstrapModal';
import { Accumul8DebtorUpsertRequest } from '../../types/accumul8';
import { ModalCloseIconButton } from '../common/ModalCloseIconButton';
import { StandardIconButton } from '../common/StandardIconButton';

interface Accumul8DebtorModalFormState {
  debtor_name: string;
  notes: string;
  is_active: number;
}

interface Accumul8DebtorModalProps {
  open: boolean;
  busy: boolean;
  editing: boolean;
  initialForm: Accumul8DebtorModalFormState;
  onClose: () => void;
  onSave: (form: Accumul8DebtorUpsertRequest) => Promise<void>;
}

export function Accumul8DebtorModal({
  open,
  busy,
  editing,
  initialForm,
  onClose,
  onSave,
}: Accumul8DebtorModalProps) {
  const { modalRef, modalApiRef } = useBootstrapModal(onClose);
  const [form, setForm] = React.useState<Accumul8DebtorModalFormState>(initialForm);

  const buildPayload = React.useCallback((): Accumul8DebtorUpsertRequest => ({
    debtor_name: String(form.debtor_name || '').trim(),
    notes: String(form.notes || '').trim(),
    is_active: Number(form.is_active || 0),
  }), [form]);
  const isDirty = React.useMemo(
    () => JSON.stringify(buildPayload()) !== JSON.stringify({
      debtor_name: String(initialForm.debtor_name || '').trim(),
      notes: String(initialForm.notes || '').trim(),
      is_active: Number(initialForm.is_active || 0),
    }),
    [buildPayload, initialForm],
  );
  const handleSave = React.useCallback(() => {
    if (busy || !isDirty || !String(form.debtor_name || '').trim()) return;
    void onSave(buildPayload());
  }, [buildPayload, busy, form.debtor_name, isDirty, onSave]);

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
            <h5 className="modal-title">{editing ? 'Edit IOU Person' : 'Add IOU Person'}</h5>
            <div className="d-flex align-items-center gap-2">
              <StandardIconButton
                iconKey="save"
                ariaLabel={editing ? 'Save IOU person changes' : 'Add IOU person'}
                title={isDirty ? (editing ? 'Save IOU person changes' : 'Add IOU person') : 'No changes to save'}
                className="btn btn-outline-primary btn-sm catn8-action-icon-btn"
                onClick={handleSave}
                disabled={busy || !isDirty || !form.debtor_name.trim()}
              />
              <ModalCloseIconButton />
            </div>
          </div>
          <form
            className="modal-body d-grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              handleSave();
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
          </form>
        </div>
      </div>
    </div>
  );
}
