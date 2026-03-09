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
  editing: boolean;
  initialForm: Accumul8TransactionModalFormState;
  transaction: Accumul8Transaction | null;
  entities: Accumul8Entity[];
  accounts: Accumul8Account[];
  statementUploads: Accumul8StatementUpload[];
  ownerUserId: number;
  onClose: () => void;
  onSave: (form: Accumul8TransactionUpsertRequest) => Promise<void>;
}

function normalizeLocatorText(value: string): string {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ');
}

function resolveStatementLink(
  transaction: Accumul8Transaction | null,
  statementUploads: Accumul8StatementUpload[],
  ownerUserId: number,
): { href: string; label: string } | null {
  if (!transaction || ownerUserId <= 0) {
    return null;
  }

  const sourceKind = String(transaction.source_kind || '').trim().toLowerCase();
  const sourceRef = String(transaction.source_ref || '').trim();
  if (!sourceRef || (sourceKind !== 'statement_pdf' && sourceKind !== 'statement_upload')) {
    return null;
  }

  const directUploadIdMatch = sourceRef.match(/^statement_upload:(\d+)$/);
  let candidates = directUploadIdMatch
    ? statementUploads.filter((upload) => upload.id === Number(directUploadIdMatch[1]))
    : statementUploads.filter((upload) => upload.original_filename === sourceRef);

  if (Number(transaction.account_id || 0) > 0) {
    const accountScoped = candidates.filter((upload) => Number(upload.account_id || 0) === Number(transaction.account_id || 0));
    if (accountScoped.length > 0) {
      candidates = accountScoped;
    }
  }

  const normalizedDescription = normalizeLocatorText(transaction.description);
  const amount = Number(transaction.amount || 0);
  for (const upload of candidates) {
    const matchedLocator = upload.transaction_locators.find((locator) => {
      if (String(locator.transaction_date || '') !== String(transaction.transaction_date || '')) {
        return false;
      }
      if (Math.abs(Number(locator.amount || 0) - amount) > 0.01) {
        return false;
      }
      return normalizeLocatorText(locator.description) === normalizedDescription;
    });
    const pageNumber = Number(matchedLocator?.page_number || 0);
    const pageSuffix = pageNumber > 0 ? `#page=${pageNumber}` : '';
    return {
      href: `/api/accumul8.php?action=download_statement_upload&id=${upload.id}&owner_user_id=${ownerUserId}${pageSuffix}`,
      label: pageNumber > 0 ? `Open statement page ${pageNumber}` : 'Open statement PDF',
    };
  }

  return null;
}

export function Accumul8TransactionModal({
  open,
  busy,
  editing,
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
  const statementLink = React.useMemo(
    () => resolveStatementLink(transaction, statementUploads, ownerUserId),
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
            {editing && statementLink ? (
              <div className="d-flex justify-content-between align-items-center gap-3 flex-wrap">
                <div className="small text-muted">This ledger record is tied to a saved bank statement.</div>
                <a className="btn btn-outline-primary btn-sm" href={statementLink.href} target="_blank" rel="noreferrer">
                  {statementLink.label}
                </a>
              </div>
            ) : null}
            {editing && editPolicy.isImported ? (
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
                  disabled={busy || !editPolicy.canEditCoreFields}
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
                  disabled={busy || !editPolicy.canEditCoreFields}
                />
              </div>
              <div className="col-md-4">
                <label className="form-label" htmlFor="accumul8-transaction-entry-type">Entry Type</label>
                <select
                  id="accumul8-transaction-entry-type"
                  className="form-select"
                  value={form.entry_type}
                  onChange={(e) => setForm((prev) => ({ ...prev, entry_type: e.target.value as Accumul8EntryType }))}
                  disabled={busy || !editPolicy.canEditCoreFields}
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
                  disabled={busy || !editPolicy.canEditPaidState}
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
                  disabled={busy || !editPolicy.canEditCoreFields}
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
                  disabled={busy || !editPolicy.canEditCoreFields}
                />
              </div>
              <div className="col-md-4">
                <label className="form-label" htmlFor="accumul8-transaction-contact">Entity</label>
                <select
                  id="accumul8-transaction-contact"
                  className="form-select"
                  value={form.entity_id}
                  onChange={(e) => setForm((prev) => ({ ...prev, entity_id: e.target.value }))}
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
                  disabled={busy || !editPolicy.canEditCoreFields}
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
                  disabled={busy || !editPolicy.canEditCoreFields}
                />
              </div>
              <div className="col-md-4">
                <label className="form-label" htmlFor="accumul8-transaction-planner">Budget Planner</label>
                <select
                  id="accumul8-transaction-planner"
                  className="form-select"
                  value={String(form.is_budget_planner)}
                  onChange={(e) => setForm((prev) => ({ ...prev, is_budget_planner: Number(e.target.value) }))}
                  disabled={busy || Boolean(form.balance_entity_id) || !editPolicy.canEditBudgetPlanner}
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
                  disabled={busy || !editPolicy.canEditPaidState}
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
                  disabled={busy}
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
