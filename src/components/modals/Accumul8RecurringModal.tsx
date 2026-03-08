import React from 'react';
import { useBootstrapModal } from '../../hooks/useBootstrapModal';
import {
  Accumul8Account,
  Accumul8Direction,
  Accumul8Entity,
  Accumul8Frequency,
  Accumul8PaymentMethod,
  Accumul8RecurringUpsertRequest,
} from '../../types/accumul8';
import { ACCUMUL8_SAVE_BUTTON_EMOJI } from '../accumul8/accumul8Ui';
import { ModalCloseIconButton } from '../common/ModalCloseIconButton';
import './Accumul8RecurringModal.css';

interface Accumul8RecurringModalFormState {
  title: string;
  direction: Accumul8Direction;
  amount: number;
  frequency: Accumul8Frequency;
  payment_method: Accumul8PaymentMethod;
  interval_count: number;
  next_due_date: string;
  entity_id: string;
  account_id: string;
  is_budget_planner: number;
  notes: string;
}

interface Accumul8RecurringModalProps {
  open: boolean;
  busy: boolean;
  initialForm: Accumul8RecurringModalFormState;
  entities: Accumul8Entity[];
  accounts: Accumul8Account[];
  onClose: () => void;
  onSave: (form: Accumul8RecurringUpsertRequest) => Promise<void>;
}

export function Accumul8RecurringModal({
  open,
  busy,
  initialForm,
  entities,
  accounts,
  onClose,
  onSave,
}: Accumul8RecurringModalProps) {
  const { modalRef, modalApiRef } = useBootstrapModal(onClose);
  const [form, setForm] = React.useState<Accumul8RecurringModalFormState>(initialForm);

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
    document.body.classList.toggle('accumul8-recurring-modal-open', open);
    return () => {
      document.body.classList.remove('accumul8-recurring-modal-open');
    };
  }, [open]);

  return (
    <div className="modal fade accumul8-recurring-modal" tabIndex={-1} aria-hidden="true" ref={modalRef}>
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Edit Recurring Payment</h5>
            <ModalCloseIconButton />
          </div>
          <form
            className="modal-body d-grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              void onSave({
                title: String(form.title || '').trim(),
                direction: (form.direction || 'outflow') as Accumul8Direction,
                amount: Number(form.amount || 0),
                frequency: (form.frequency || 'monthly') as Accumul8Frequency,
                payment_method: (form.payment_method || 'unspecified') as Accumul8PaymentMethod,
                interval_count: Math.max(1, Number(form.interval_count || 1)),
                next_due_date: String(form.next_due_date || ''),
                entity_id: form.entity_id ? Number(form.entity_id) : null,
                account_id: form.account_id ? Number(form.account_id) : null,
                is_budget_planner: Number(form.is_budget_planner || 0),
                notes: String(form.notes || '').trim(),
              });
            }}
          >
            <div className="row g-3">
              <div className="col-md-5">
                <label className="form-label" htmlFor="accumul8-recurring-title">Title</label>
                <input
                  id="accumul8-recurring-title"
                  className="form-control"
                  value={form.title}
                  onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                  required
                />
              </div>
              <div className="col-md-3">
                <label className="form-label" htmlFor="accumul8-recurring-direction">Direction</label>
                <select
                  id="accumul8-recurring-direction"
                  className="form-select"
                  value={form.direction}
                  onChange={(e) => setForm((prev) => ({ ...prev, direction: e.target.value as Accumul8Direction }))}
                >
                  <option value="outflow">Outflow</option>
                  <option value="inflow">Inflow</option>
                </select>
              </div>
              <div className="col-md-4">
                <label className="form-label" htmlFor="accumul8-recurring-amount">Amount</label>
                <input
                  id="accumul8-recurring-amount"
                  className="form-control"
                  type="number"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setForm((prev) => ({ ...prev, amount: Number(e.target.value) }))}
                  required
                />
              </div>
              <div className="col-md-4">
                <label className="form-label" htmlFor="accumul8-recurring-frequency">Frequency</label>
                <select
                  id="accumul8-recurring-frequency"
                  className="form-select"
                  value={form.frequency}
                  onChange={(e) => setForm((prev) => ({ ...prev, frequency: e.target.value as Accumul8Frequency }))}
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Biweekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <div className="col-md-4">
                <label className="form-label" htmlFor="accumul8-recurring-payment-method">Payment Method</label>
                <select
                  id="accumul8-recurring-payment-method"
                  className="form-select"
                  value={form.payment_method}
                  onChange={(e) => setForm((prev) => ({ ...prev, payment_method: e.target.value as Accumul8PaymentMethod }))}
                >
                  <option value="unspecified">Payment Method</option>
                  <option value="autopay">Auto debit / autopay</option>
                  <option value="manual">Manual payment</option>
                </select>
              </div>
              <div className="col-md-4">
                <label className="form-label" htmlFor="accumul8-recurring-interval">Every</label>
                <input
                  id="accumul8-recurring-interval"
                  className="form-control"
                  type="number"
                  min={1}
                  max={365}
                  value={form.interval_count}
                  onChange={(e) => setForm((prev) => ({ ...prev, interval_count: Number(e.target.value) }))}
                />
              </div>
              <div className="col-md-4">
                <label className="form-label" htmlFor="accumul8-recurring-next-due">Next Due</label>
                <input
                  id="accumul8-recurring-next-due"
                  className="form-control"
                  type="date"
                  value={form.next_due_date}
                  onChange={(e) => setForm((prev) => ({ ...prev, next_due_date: e.target.value }))}
                  required
                />
              </div>
              <div className="col-md-4">
                <label className="form-label" htmlFor="accumul8-recurring-contact">Entity</label>
                <select
                  id="accumul8-recurring-contact"
                  className="form-select"
                  value={form.entity_id}
                  onChange={(e) => setForm((prev) => ({ ...prev, entity_id: e.target.value }))}
                >
                  <option value="">Entity</option>
                  {entities.map((entity) => (
                    <option key={entity.id} value={entity.id}>{entity.display_name}</option>
                  ))}
                </select>
              </div>
              <div className="col-md-4">
                <label className="form-label" htmlFor="accumul8-recurring-account">Account</label>
                <select
                  id="accumul8-recurring-account"
                  className="form-select"
                  value={form.account_id}
                  onChange={(e) => setForm((prev) => ({ ...prev, account_id: e.target.value }))}
                >
                  <option value="">Account</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>{account.account_name}</option>
                  ))}
                </select>
              </div>
              <div className="col-md-4">
                <label className="form-label" htmlFor="accumul8-recurring-planner">Planner</label>
                <select
                  id="accumul8-recurring-planner"
                  className="form-select"
                  value={String(form.is_budget_planner)}
                  onChange={(e) => setForm((prev) => ({ ...prev, is_budget_planner: Number(e.target.value) }))}
                >
                  <option value="1">Show In Planner</option>
                  <option value="0">Hide From Planner</option>
                </select>
              </div>
              <div className="col-12">
                <label className="form-label" htmlFor="accumul8-recurring-notes">Notes</label>
                <textarea
                  id="accumul8-recurring-notes"
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
                disabled={busy || !form.title.trim() || !form.next_due_date}
                aria-label="Save recurring payment changes"
                title="Save recurring payment changes"
              >
                <span aria-hidden="true">{ACCUMUL8_SAVE_BUTTON_EMOJI}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
