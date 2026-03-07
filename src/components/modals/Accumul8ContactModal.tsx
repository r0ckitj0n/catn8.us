import React from 'react';
import { useBootstrapModal } from '../../hooks/useBootstrapModal';
import { Accumul8ContactType, Accumul8ContactUpsertRequest } from '../../types/accumul8';
import { ModalCloseIconButton } from '../common/ModalCloseIconButton';
import './Accumul8ContactModal.css';

interface Accumul8ContactModalProps {
  open: boolean;
  busy: boolean;
  initialForm: Accumul8ContactUpsertRequest;
  editing: boolean;
  onClose: () => void;
  onSave: (form: Accumul8ContactUpsertRequest) => Promise<void>;
}

export function Accumul8ContactModal({
  open,
  busy,
  initialForm,
  editing,
  onClose,
  onSave,
}: Accumul8ContactModalProps) {
  const { modalRef, modalApiRef } = useBootstrapModal(onClose);
  const [form, setForm] = React.useState<Accumul8ContactUpsertRequest>(initialForm);

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

  React.useEffect(() => {
    if (typeof document === 'undefined') return;
    document.body.classList.toggle('accumul8-contact-modal-open', open);
    return () => {
      document.body.classList.remove('accumul8-contact-modal-open');
    };
  }, [open]);

  return (
    <div className="modal fade accumul8-contact-modal" tabIndex={-1} aria-hidden="true" ref={modalRef}>
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">{editing ? 'Edit Payee / Payer' : 'Add Payee / Payer'}</h5>
            <ModalCloseIconButton />
          </div>
          <form
            className="modal-body d-grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              void onSave({
                contact_name: String(form.contact_name || '').trim(),
                contact_type: (form.contact_type || 'both') as Accumul8ContactType,
                default_amount: Number(form.default_amount || 0),
                email: String(form.email || '').trim(),
                phone_number: String(form.phone_number || '').trim(),
                street_address: String(form.street_address || '').trim(),
                city: String(form.city || '').trim(),
                state: String(form.state || '').trim(),
                zip: String(form.zip || '').trim(),
                notes: String(form.notes || '').trim(),
              });
            }}
          >
            <div className="row g-3">
              <div className="col-md-7">
                <label className="form-label" htmlFor="accumul8-contact-name">Name</label>
                <input
                  id="accumul8-contact-name"
                  className="form-control"
                  value={form.contact_name}
                  onChange={(e) => setForm((prev) => ({ ...prev, contact_name: e.target.value }))}
                  required
                />
              </div>
              <div className="col-md-5">
                <label className="form-label" htmlFor="accumul8-contact-type">Type</label>
                <select
                  id="accumul8-contact-type"
                  className="form-select"
                  value={form.contact_type}
                  onChange={(e) => setForm((prev) => ({ ...prev, contact_type: e.target.value as Accumul8ContactType }))}
                >
                  <option value="payee">Payee</option>
                  <option value="payer">Payer</option>
                  <option value="both">Both</option>
                </select>
              </div>
              <div className="col-md-4">
                <label className="form-label" htmlFor="accumul8-contact-default-amount">Default Amount</label>
                <input
                  id="accumul8-contact-default-amount"
                  className="form-control"
                  type="number"
                  step="0.01"
                  value={form.default_amount}
                  onChange={(e) => setForm((prev) => ({ ...prev, default_amount: Number(e.target.value) }))}
                />
              </div>
              <div className="col-md-4">
                <label className="form-label" htmlFor="accumul8-contact-email">Email</label>
                <input
                  id="accumul8-contact-email"
                  className="form-control"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                />
              </div>
              <div className="col-md-4">
                <label className="form-label" htmlFor="accumul8-contact-phone">Phone</label>
                <input
                  id="accumul8-contact-phone"
                  className="form-control"
                  value={form.phone_number}
                  onChange={(e) => setForm((prev) => ({ ...prev, phone_number: e.target.value }))}
                />
              </div>
              <div className="col-12">
                <label className="form-label" htmlFor="accumul8-contact-street">Street Address</label>
                <input
                  id="accumul8-contact-street"
                  className="form-control"
                  value={form.street_address}
                  onChange={(e) => setForm((prev) => ({ ...prev, street_address: e.target.value }))}
                />
              </div>
              <div className="col-md-5">
                <label className="form-label" htmlFor="accumul8-contact-city">City</label>
                <input
                  id="accumul8-contact-city"
                  className="form-control"
                  value={form.city}
                  onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value }))}
                />
              </div>
              <div className="col-md-3">
                <label className="form-label" htmlFor="accumul8-contact-state">State</label>
                <input
                  id="accumul8-contact-state"
                  className="form-control"
                  value={form.state}
                  onChange={(e) => setForm((prev) => ({ ...prev, state: e.target.value }))}
                />
              </div>
              <div className="col-md-4">
                <label className="form-label" htmlFor="accumul8-contact-zip">ZIP</label>
                <input
                  id="accumul8-contact-zip"
                  className="form-control"
                  value={form.zip}
                  onChange={(e) => setForm((prev) => ({ ...prev, zip: e.target.value }))}
                />
              </div>
              <div className="col-12">
                <label className="form-label" htmlFor="accumul8-contact-notes">Notes</label>
                <textarea
                  id="accumul8-contact-notes"
                  className="form-control"
                  rows={3}
                  value={form.notes}
                  onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                />
              </div>
            </div>
            <div className="d-flex justify-content-end gap-2">
              <button type="button" className="btn btn-outline-secondary" onClick={onClose} disabled={busy}>Cancel</button>
              <button type="submit" className="btn btn-success" disabled={busy}>{editing ? 'Save Changes' : 'Add Payee / Payer'}</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
