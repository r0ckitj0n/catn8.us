import React from 'react';
import { useBootstrapModal } from '../../hooks/useBootstrapModal';
import {
  Accumul8Account,
  Accumul8Contact,
  Accumul8Debtor,
  Accumul8EntryType,
  Accumul8TransactionUpsertRequest,
} from '../../types/accumul8';
import { ACCUMUL8_SAVE_BUTTON_EMOJI } from '../accumul8/accumul8Ui';
import { ModalCloseIconButton } from '../common/ModalCloseIconButton';

interface Accumul8TransactionModalFormState {
  transaction_date: string;
  due_date: string;
  entry_type: Accumul8EntryType;
  description: string;
  memo: string;
  amount: number;
  rta_amount: number;
  is_paid: number;
  is_reconciled: number;
  is_budget_planner: number;
  contact_id: string;
  account_id: string;
  debtor_id: string;
}

interface Accumul8TransactionModalProps {
  open: boolean;
  busy: boolean;
  editing: boolean;
  initialForm: Accumul8TransactionModalFormState;
  contacts: Accumul8Contact[];
  accounts: Accumul8Account[];
  debtors: Accumul8Debtor[];
  onClose: () => void;
  onSave: (form: Accumul8TransactionUpsertRequest) => Promise<void>;
}

export function Accumul8TransactionModal({
  open,
  busy,
  editing,
  initialForm,
  contacts,
  accounts,
  debtors,
  onClose,
  onSave,
}: Accumul8TransactionModalProps) {
  const { modalRef, modalApiRef } = useBootstrapModal(onClose);
  const [form, setForm] = React.useState<Accumul8TransactionModalFormState>(initialForm);

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
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">{editing ? 'Edit Ledger Entry' : 'Add Ledger Entry'}</h5>
            <ModalCloseIconButton />
          </div>
          <form
            className="modal-body d-grid gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              void onSave({
                transaction_date: String(form.transaction_date || ''),
                due_date: String(form.due_date || ''),
                entry_type: (form.entry_type || 'manual') as Accumul8EntryType,
                description: String(form.description || '').trim(),
                memo: String(form.memo || '').trim(),
                amount: Number(form.amount || 0),
                rta_amount: Number(form.rta_amount || 0),
                is_paid: Number(form.is_paid || 0),
                is_reconciled: Number(form.is_reconciled || 0),
                is_budget_planner: Number(form.is_budget_planner || 0),
                contact_id: form.contact_id ? Number(form.contact_id) : null,
                account_id: form.account_id ? Number(form.account_id) : null,
                debtor_id: form.debtor_id ? Number(form.debtor_id) : null,
              });
            }}
          >
            <div className="row g-3">
              <div className="col-md-4">
                <label className="form-label" htmlFor="accumul8-transaction-date">Transaction Date</label>
                <input
                  id="accumul8-transaction-date"
                  className="form-control"
                  type="date"
                  value={form.transaction_date}
                  onChange={(e) => setForm((prev) => ({ ...prev, transaction_date: e.target.value }))}
                  required
                />
              </div>
              <div className="col-md-4">
                <label className="form-label" htmlFor="accumul8-transaction-due-date">Due Date</label>
                <input
                  id="accumul8-transaction-due-date"
                  className="form-control"
                  type="date"
                  value={form.due_date}
                  onChange={(e) => setForm((prev) => ({ ...prev, due_date: e.target.value }))}
                />
              </div>
              <div className="col-md-4">
                <label className="form-label" htmlFor="accumul8-transaction-entry-type">Entry Type</label>
                <select
                  id="accumul8-transaction-entry-type"
                  className="form-select"
                  value={form.entry_type}
                  onChange={(e) => setForm((prev) => ({ ...prev, entry_type: e.target.value as Accumul8EntryType }))}
                >
                  <option value="manual">Manual</option>
                  <option value="auto">Auto</option>
                  <option value="transfer">Transfer</option>
                  <option value="deposit">Deposit</option>
                  <option value="bill">Bill</option>
                </select>
              </div>
              <div className="col-md-8">
                <label className="form-label" htmlFor="accumul8-transaction-description">Description</label>
                <input
                  id="accumul8-transaction-description"
                  className="form-control"
                  value={form.description}
                  onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                  required
                />
              </div>
              <div className="col-md-4">
                <label className="form-label" htmlFor="accumul8-transaction-amount">Amount</label>
                <input
                  id="accumul8-transaction-amount"
                  className="form-control"
                  type="number"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setForm((prev) => ({ ...prev, amount: Number(e.target.value) }))}
                  required
                />
              </div>
              <div className="col-md-4">
                <label className="form-label" htmlFor="accumul8-transaction-contact">Contact</label>
                <select
                  id="accumul8-transaction-contact"
                  className="form-select"
                  value={form.contact_id}
                  onChange={(e) => setForm((prev) => ({ ...prev, contact_id: e.target.value }))}
                >
                  <option value="">Contact</option>
                  {contacts.map((contact) => (
                    <option key={contact.id} value={contact.id}>{contact.contact_name}</option>
                  ))}
                </select>
              </div>
              <div className="col-md-4">
                <label className="form-label" htmlFor="accumul8-transaction-account">Account</label>
                <select
                  id="accumul8-transaction-account"
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
                <label className="form-label" htmlFor="accumul8-transaction-debtor">Person / Balance</label>
                <select
                  id="accumul8-transaction-debtor"
                  className="form-select"
                  value={form.debtor_id}
                  onChange={(e) => setForm((prev) => ({
                    ...prev,
                    debtor_id: e.target.value,
                    is_budget_planner: e.target.value ? 0 : prev.is_budget_planner,
                  }))}
                >
                  <option value="">Person / Balance</option>
                  {debtors.map((debtor) => (
                    <option key={debtor.id} value={debtor.id}>{debtor.debtor_name}</option>
                  ))}
                </select>
              </div>
              <div className="col-md-4">
                <label className="form-label" htmlFor="accumul8-transaction-rta">RTA Amount</label>
                <input
                  id="accumul8-transaction-rta"
                  className="form-control"
                  type="number"
                  step="0.01"
                  value={form.rta_amount}
                  onChange={(e) => setForm((prev) => ({ ...prev, rta_amount: Number(e.target.value) }))}
                />
              </div>
              <div className="col-md-4">
                <label className="form-label" htmlFor="accumul8-transaction-planner">Budget Planner</label>
                <select
                  id="accumul8-transaction-planner"
                  className="form-select"
                  value={String(form.is_budget_planner)}
                  onChange={(e) => setForm((prev) => ({ ...prev, is_budget_planner: Number(e.target.value) }))}
                  disabled={Boolean(form.debtor_id)}
                >
                  <option value="1">In Budget Planner</option>
                  <option value="0">Exclude From Planner</option>
                </select>
              </div>
              <div className="col-md-6">
                <label className="form-label" htmlFor="accumul8-transaction-paid">Paid</label>
                <select
                  id="accumul8-transaction-paid"
                  className="form-select"
                  value={String(form.is_paid)}
                  onChange={(e) => setForm((prev) => ({ ...prev, is_paid: Number(e.target.value) }))}
                >
                  <option value="0">No</option>
                  <option value="1">Yes</option>
                </select>
              </div>
              <div className="col-md-6">
                <label className="form-label" htmlFor="accumul8-transaction-reconciled">Reconciled</label>
                <select
                  id="accumul8-transaction-reconciled"
                  className="form-select"
                  value={String(form.is_reconciled)}
                  onChange={(e) => setForm((prev) => ({ ...prev, is_reconciled: Number(e.target.value) }))}
                >
                  <option value="0">No</option>
                  <option value="1">Yes</option>
                </select>
              </div>
              <div className="col-12">
                <label className="form-label" htmlFor="accumul8-transaction-memo">Memo</label>
                <textarea
                  id="accumul8-transaction-memo"
                  className="form-control"
                  rows={3}
                  value={form.memo}
                  onChange={(e) => setForm((prev) => ({ ...prev, memo: e.target.value }))}
                />
              </div>
            </div>
            <div className="d-flex justify-content-end gap-2">
              <button type="button" className="btn btn-outline-secondary" onClick={onClose} disabled={busy}>Cancel</button>
              <button
                type="submit"
                className="btn btn-success"
                disabled={busy || !form.transaction_date || !form.description.trim()}
                aria-label={editing ? 'Save ledger entry changes' : 'Add ledger entry'}
                title={editing ? 'Save ledger entry changes' : 'Add ledger entry'}
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
