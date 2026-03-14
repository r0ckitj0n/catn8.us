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
import { getAccumul8AccountDisplayName } from '../../utils/accumul8Accounts';
import { ModalCloseIconButton } from '../common/ModalCloseIconButton';
import { StandardIconButton } from '../common/StandardIconButton';
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

function formatRecurringAccountOptionLabel(account: Pick<Accumul8Account, 'account_name' | 'account_nickname'>): string {
  const displayName = getAccumul8AccountDisplayName(account);
  const accountName = String(account.account_name || '').trim();
  return displayName !== accountName && accountName
    ? `${displayName} (${accountName})`
    : displayName;
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

  const buildPayload = React.useCallback((): Accumul8RecurringUpsertRequest => ({
    title: String(form.title || '').trim(),
    direction: (form.direction || 'outflow') as Accumul8Direction,
    amount: Number(form.amount || 0),
    frequency: (form.frequency || 'monthly') as Accumul8Frequency,
    payment_method: (form.payment_method || 'unspecified') as Accumul8PaymentMethod,
    interval_count: Math.max(1, Number(form.interval_count || 1)),
    next_due_date: String(form.next_due_date || ''),
    entity_id: form.entity_id ? Number(form.entity_id) : null,
    account_id: form.account_id ? Number(form.account_id) : null,
    is_budget_planner: Number(form.is_budget_planner ?? 1),
    notes: String(form.notes || '').trim(),
  }), [form]);
  const isInflow = form.direction === 'inflow';
  const isDirty = React.useMemo(
    () => JSON.stringify(buildPayload()) !== JSON.stringify({
      title: String(initialForm.title || '').trim(),
      direction: (initialForm.direction || 'outflow') as Accumul8Direction,
      amount: Number(initialForm.amount || 0),
      frequency: (initialForm.frequency || 'monthly') as Accumul8Frequency,
      payment_method: (initialForm.payment_method || 'unspecified') as Accumul8PaymentMethod,
      interval_count: Math.max(1, Number(initialForm.interval_count || 1)),
      next_due_date: String(initialForm.next_due_date || ''),
      entity_id: initialForm.entity_id ? Number(initialForm.entity_id) : null,
      account_id: initialForm.account_id ? Number(initialForm.account_id) : null,
      is_budget_planner: Number(initialForm.is_budget_planner ?? 1),
      notes: String(initialForm.notes || '').trim(),
    }),
    [buildPayload, initialForm],
  );
  const handleSave = React.useCallback(() => {
    if (busy || !isDirty || !form.title.trim() || !form.next_due_date) return;
    void onSave(buildPayload());
  }, [buildPayload, busy, form.next_due_date, form.title, isDirty, onSave]);

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
            <h5 className="modal-title">{initialForm.title ? 'Edit Recurring Item' : 'Add Recurring Item'}</h5>
            <div className="d-flex align-items-center gap-2">
              <StandardIconButton
                iconKey="save"
                ariaLabel="Save recurring item changes"
                title={isDirty ? 'Save recurring item changes' : 'No changes to save'}
                className="btn btn-outline-primary btn-sm catn8-action-icon-btn"
                onClick={handleSave}
                disabled={busy || !isDirty || !form.title.trim() || !form.next_due_date}
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
                <label className="form-label" htmlFor="accumul8-recurring-payment-method">{isInflow ? 'Deposit Method' : 'Payment Method'}</label>
                <select
                  id="accumul8-recurring-payment-method"
                  className="form-select"
                  value={form.payment_method}
                  onChange={(e) => setForm((prev) => ({ ...prev, payment_method: e.target.value as Accumul8PaymentMethod }))}
                >
                  <option value="unspecified">{isInflow ? 'Deposit Method' : 'Payment Method'}</option>
                  <option value="autopay">{isInflow ? 'Automatic deposit' : 'Auto debit / autopay'}</option>
                  <option value="manual">{isInflow ? 'Manual deposit' : 'Manual payment'}</option>
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
                <label className="form-label" htmlFor="accumul8-recurring-next-due">Next Date</label>
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
                <label className="form-label" htmlFor="accumul8-recurring-contact">{isInflow ? 'Source' : 'Entity'}</label>
                <select
                  id="accumul8-recurring-contact"
                  className="form-select"
                  value={form.entity_id}
                  onChange={(e) => setForm((prev) => ({ ...prev, entity_id: e.target.value }))}
                >
                  <option value="">{isInflow ? 'Source' : 'Entity'}</option>
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
                    <option key={account.id} value={account.id}>{formatRecurringAccountOptionLabel(account)}</option>
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
          </form>
        </div>
      </div>
    </div>
  );
}
