import React from 'react';
import { useBootstrapModal } from '../../hooks/useBootstrapModal';
import {
  Accumul8Account,
  Accumul8Entity,
  Accumul8EntryType,
  Accumul8StatementUpload,
  Accumul8Transaction,
  Accumul8TransactionUpsertRequest,
} from '../../types/accumul8';
import { resolveAccumul8StatementLink } from '../../utils/accumul8StatementLink';
import { getAccumul8TransactionEditPolicy } from '../../utils/accumul8TransactionPolicy';
import { ACCUMUL8_SAVE_BUTTON_EMOJI } from '../accumul8/accumul8Ui';
import { ModalCloseIconButton } from '../common/ModalCloseIconButton';
import './Accumul8TransactionModal.css';

interface Accumul8TransactionModalFormState {
  transaction_date: string;
  due_date: string;
  paid_date: string;
  entry_type: Accumul8EntryType;
  description: string;
  memo: string;
  amount: number;
  rta_amount: number;
  is_paid: number;
  is_reconciled: number;
  is_budget_planner: number;
  entity_id: string;
  account_id: string;
  balance_entity_id: string;
}

interface Accumul8TransactionModalProps {
  open: boolean;
  busy: boolean;
  mode: 'create' | 'view' | 'edit';
  initialForm: Accumul8TransactionModalFormState;
  transaction: Accumul8Transaction | null;
  entities: Accumul8Entity[];
  accounts: Accumul8Account[];
  statementUploads: Accumul8StatementUpload[];
  ownerUserId: number;
  onClose: () => void;
  onSave: (form: Accumul8TransactionUpsertRequest) => Promise<void>;
}

export function Accumul8TransactionModal({
  open,
  busy,
  mode,
  initialForm,
  transaction,
  entities,
  accounts,
  statementUploads,
  ownerUserId,
  onClose,
  onSave,
}: Accumul8TransactionModalProps) {
  const { modalRef, modalApiRef } = useBootstrapModal(onClose);
  const [form, setForm] = React.useState<Accumul8TransactionModalFormState>(initialForm);
  const isReadOnly = mode === 'view';
  const isEditing = mode === 'edit';
  const statementLink = React.useMemo(
    () => resolveAccumul8StatementLink(transaction, statementUploads, ownerUserId),
    [ownerUserId, statementUploads, transaction],
  );
  const editPolicy = React.useMemo(() => getAccumul8TransactionEditPolicy(transaction), [transaction]);

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
    <div className="modal fade accumul8-transaction-modal" tabIndex={-1} aria-hidden="true" ref={modalRef}>
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">{isEditing ? 'Edit Ledger Entry' : isReadOnly ? 'View Ledger Entry' : 'Add Ledger Entry'}</h5>
            <ModalCloseIconButton />
          </div>
          <form
            className="modal-body d-grid gap-3"
            onSubmit={(event) => {
              if (isReadOnly) {
                return;
              }
              event.preventDefault();
              void onSave({
                transaction_date: String(form.transaction_date || ''),
                due_date: String(form.due_date || ''),
                paid_date: String(form.paid_date || ''),
                entry_type: (form.entry_type || 'manual') as Accumul8EntryType,
                description: String(form.description || '').trim(),
                memo: String(form.memo || '').trim(),
                amount: Number(form.amount || 0),
                rta_amount: Number(form.rta_amount || 0),
                is_paid: Number(form.is_paid || 0),
                is_reconciled: Number(form.is_reconciled || 0),
                is_budget_planner: Number(form.is_budget_planner || 0),
                entity_id: form.entity_id ? Number(form.entity_id) : null,
                account_id: form.account_id ? Number(form.account_id) : null,
                balance_entity_id: form.balance_entity_id ? Number(form.balance_entity_id) : null,
              });
            }}
          >
            {(isEditing || isReadOnly) && statementLink ? (
              <div className="d-flex justify-content-between align-items-center gap-3 flex-wrap">
                <div className="small text-muted">This ledger record is tied to a saved bank statement.</div>
                <a className="btn btn-outline-primary btn-sm" href={statementLink.href} target="_blank" rel="noreferrer">
                  {statementLink.label}
                </a>
              </div>
            ) : null}
            {(isEditing || isReadOnly) && editPolicy.isImported ? (
              <div className="small text-muted">
                Source: {editPolicy.sourceLabel}. Bank-imported fields stay read-only here; you can still adjust entity assignment, notes, and reconciliation.
              </div>
            ) : null}
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
                  disabled={busy || isReadOnly || !editPolicy.canEditCoreFields}
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
                  disabled={busy || isReadOnly || !editPolicy.canEditCoreFields}
                />
              </div>
              <div className="col-md-4">
                <label className="form-label" htmlFor="accumul8-transaction-entry-type">Entry Type</label>
                <select
                  id="accumul8-transaction-entry-type"
                  className="form-select"
                  value={form.entry_type}
                  onChange={(e) => setForm((prev) => ({ ...prev, entry_type: e.target.value as Accumul8EntryType }))}
                  disabled={busy || isReadOnly || !editPolicy.canEditCoreFields}
                >
                  <option value="manual">Manual</option>
                  <option value="auto">Auto</option>
                  <option value="transfer">Transfer</option>
                  <option value="deposit">Deposit</option>
                  <option value="bill">Bill</option>
                </select>
              </div>
              <div className="col-md-4">
                <label className="form-label" htmlFor="accumul8-transaction-paid-date">Paid Date</label>
                <input
                  id="accumul8-transaction-paid-date"
                  className="form-control"
                  type="date"
                  value={form.paid_date}
                  onChange={(e) => setForm((prev) => ({ ...prev, paid_date: e.target.value }))}
                  disabled={busy || isReadOnly || !editPolicy.canEditPaidState}
                />
              </div>
              <div className="col-md-8">
                <label className="form-label" htmlFor="accumul8-transaction-description">Description</label>
                <input
                  id="accumul8-transaction-description"
                  className="form-control"
                  value={form.description}
                  onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                  required
                  disabled={busy || isReadOnly || !editPolicy.canEditCoreFields}
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
                  disabled={busy || isReadOnly || !editPolicy.canEditCoreFields}
                />
              </div>
              <div className="col-md-4">
                <label className="form-label" htmlFor="accumul8-transaction-contact">Entity</label>
                <select
                  id="accumul8-transaction-contact"
                  className="form-select"
                  value={form.entity_id}
                  onChange={(e) => setForm((prev) => ({ ...prev, entity_id: e.target.value }))}
                  disabled={busy || isReadOnly}
                >
                  <option value="">Entity</option>
                  {entities
                    .filter((entity) => Number(entity.is_balance_person || 0) === 0)
                    .map((entity) => (
                    <option key={entity.id} value={entity.id}>{entity.display_name}</option>
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
                  disabled={busy || isReadOnly || !editPolicy.canEditCoreFields}
                >
                  <option value="">Account</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>{account.account_name}</option>
                  ))}
                </select>
              </div>
              <div className="col-md-4">
                <label className="form-label" htmlFor="accumul8-transaction-debtor">IOU Person</label>
                <select
                  id="accumul8-transaction-debtor"
                  className="form-select"
                  value={form.balance_entity_id}
                  onChange={(e) => setForm((prev) => ({
                    ...prev,
                    balance_entity_id: e.target.value,
                    is_budget_planner: e.target.value ? 0 : prev.is_budget_planner,
                  }))}
                  disabled={busy || isReadOnly}
                >
                  <option value="">IOU Person</option>
                  {entities
                    .filter((entity) => Number(entity.is_balance_person || 0) === 1)
                    .map((entity) => (
                    <option key={entity.id} value={entity.id}>{entity.display_name}</option>
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
                  disabled={busy || isReadOnly || !editPolicy.canEditCoreFields}
                />
              </div>
              <div className="col-md-4">
                <label className="form-label" htmlFor="accumul8-transaction-planner">Budget Planner</label>
                <select
                  id="accumul8-transaction-planner"
                  className="form-select"
                  value={String(form.is_budget_planner)}
                  onChange={(e) => setForm((prev) => ({ ...prev, is_budget_planner: Number(e.target.value) }))}
                  disabled={busy || isReadOnly || Boolean(form.balance_entity_id) || !editPolicy.canEditBudgetPlanner}
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
                  disabled={busy || isReadOnly || !editPolicy.canEditPaidState}
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
                  disabled={busy || isReadOnly}
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
                  disabled={busy || isReadOnly}
                />
              </div>
            </div>
            <div className="d-flex justify-content-end gap-2">
              <button type="button" className="btn btn-outline-secondary" onClick={onClose} disabled={busy}>{isReadOnly ? 'Close' : 'Cancel'}</button>
              {!isReadOnly ? (
                <button
                  type="submit"
                  className="btn btn-success"
                  disabled={busy || !form.transaction_date || !form.description.trim()}
                  aria-label={isEditing ? 'Save ledger entry changes' : 'Add ledger entry'}
                  title={isEditing ? 'Save ledger entry changes' : 'Add ledger entry'}
                >
                  <span aria-hidden="true">{isEditing ? ACCUMUL8_SAVE_BUTTON_EMOJI : '➕'}</span>
                </button>
              ) : null}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
