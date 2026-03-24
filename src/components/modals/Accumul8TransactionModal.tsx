import React from 'react';
import { useBootstrapModal } from '../../hooks/useBootstrapModal';
import {
  Accumul8Account,
  Accumul8Debtor,
  Accumul8Entity,
  Accumul8EntryType,
  Accumul8StatementUpload,
  Accumul8Transaction,
  Accumul8TransactionUpsertRequest,
} from '../../types/accumul8';
import { resolveAccumul8StatementLink } from '../../utils/accumul8StatementLink';
import { getAccumul8TransactionEditPolicy } from '../../utils/accumul8TransactionPolicy';
import { ModalCloseIconButton } from '../common/ModalCloseIconButton';
import { StandardIconButton } from '../common/StandardIconButton';
import { Accumul8TransactionModalFields } from './Accumul8TransactionModalFields';
import { Accumul8IouDirection, Accumul8TransactionModalFormState } from './accumul8TransactionModalTypes';
import './Accumul8TransactionModal.css';

interface Accumul8TransactionModalProps {
  open: boolean;
  busy: boolean;
  mode: 'create' | 'view' | 'edit';
  variant?: 'ledger' | 'iou';
  initialForm: Accumul8TransactionModalFormState;
  transaction: Accumul8Transaction | null;
  entities: Accumul8Entity[];
  debtors?: Accumul8Debtor[];
  accounts: Accumul8Account[];
  statementUploads: Accumul8StatementUpload[];
  ownerUserId: number;
  onClose: () => void;
  onEdit?: () => void;
  onSave: (form: Accumul8TransactionUpsertRequest) => Promise<void>;
}

export function Accumul8TransactionModal({
  open,
  busy,
  mode,
  variant = 'ledger',
  initialForm,
  transaction,
  entities,
  debtors = [],
  accounts,
  statementUploads,
  ownerUserId,
  onClose,
  onEdit,
  onSave,
}: Accumul8TransactionModalProps) {
  const { modalRef, modalApiRef } = useBootstrapModal(onClose);
  const [form, setForm] = React.useState<Accumul8TransactionModalFormState>(initialForm);
  const [iouDirection, setIouDirection] = React.useState<Accumul8IouDirection>(initialForm.amount < 0 ? 'credit' : 'charge');
  const isReadOnly = mode === 'view';
  const isEditing = mode === 'edit';
  const isIouVariant = variant === 'iou';
  const statementLink = React.useMemo(
    () => resolveAccumul8StatementLink(transaction, statementUploads, ownerUserId),
    [ownerUserId, statementUploads, transaction],
  );
  const editPolicy = React.useMemo(() => getAccumul8TransactionEditPolicy(transaction), [transaction]);
  const signedAmount = React.useMemo(() => {
    const normalizedAmount = Math.abs(Number(form.amount || 0));
    if (!isIouVariant) {
      return Number(form.amount || 0);
    }
    return iouDirection === 'credit' ? -normalizedAmount : normalizedAmount;
  }, [form.amount, iouDirection, isIouVariant]);
  const buildPayload = React.useCallback((): Accumul8TransactionUpsertRequest => ({
    transaction_date: String(form.transaction_date || ''),
    due_date: String(form.due_date || ''),
    paid_date: isIouVariant ? '' : String(form.paid_date || ''),
    entry_type: (form.entry_type || 'manual') as Accumul8EntryType,
    description: String(form.description || '').trim(),
    memo: String(form.memo || '').trim(),
    amount: signedAmount,
    rta_amount: isIouVariant ? 0 : Number(form.rta_amount || 0),
    is_paid: isIouVariant ? 0 : Number(form.is_paid || 0),
    is_reconciled: isIouVariant ? 0 : Number(form.is_reconciled || 0),
    is_budget_planner: isIouVariant ? 0 : Number(form.is_budget_planner || 0),
    entity_id: isIouVariant ? null : (form.entity_id ? Number(form.entity_id) : null),
    account_id: form.account_id ? Number(form.account_id) : null,
    balance_entity_id: isIouVariant ? null : (form.balance_entity_id ? Number(form.balance_entity_id) : null),
    debtor_id: isIouVariant ? (form.debtor_id ? Number(form.debtor_id) : null) : undefined,
    skip_recurring_template_sync: !editPolicy.isImported && Number(transaction?.recurring_payment_id || 0) > 0 ? 1 : 0,
  }), [editPolicy.isImported, form, isIouVariant, signedAmount, transaction?.recurring_payment_id]);
  const isDirty = React.useMemo(
    () => JSON.stringify(buildPayload()) !== JSON.stringify({
      transaction_date: String(initialForm.transaction_date || ''),
      due_date: String(initialForm.due_date || ''),
      paid_date: isIouVariant ? '' : String(initialForm.paid_date || ''),
      entry_type: (initialForm.entry_type || 'manual') as Accumul8EntryType,
      description: String(initialForm.description || '').trim(),
      memo: String(initialForm.memo || '').trim(),
      amount: Number(initialForm.amount || 0),
      rta_amount: isIouVariant ? 0 : Number(initialForm.rta_amount || 0),
      is_paid: isIouVariant ? 0 : Number(initialForm.is_paid || 0),
      is_reconciled: isIouVariant ? 0 : Number(initialForm.is_reconciled || 0),
      is_budget_planner: isIouVariant ? 0 : Number(initialForm.is_budget_planner || 0),
      entity_id: isIouVariant ? null : (initialForm.entity_id ? Number(initialForm.entity_id) : null),
      account_id: initialForm.account_id ? Number(initialForm.account_id) : null,
      balance_entity_id: isIouVariant ? null : (initialForm.balance_entity_id ? Number(initialForm.balance_entity_id) : null),
      debtor_id: isIouVariant ? (initialForm.debtor_id ? Number(initialForm.debtor_id) : null) : undefined,
    }),
    [buildPayload, initialForm, isIouVariant],
  );
  const handleSave = React.useCallback(() => {
    if (isReadOnly || busy || !isDirty || !form.transaction_date || !form.description.trim()) return;
    if (isIouVariant && !form.debtor_id) return;
    void onSave(buildPayload());
  }, [buildPayload, busy, form.debtor_id, form.description, form.transaction_date, isDirty, isIouVariant, isReadOnly, onSave]);

  React.useEffect(() => {
    setForm({
      ...initialForm,
      amount: isIouVariant ? Math.abs(Number(initialForm.amount || 0)) : Number(initialForm.amount || 0),
    });
    setIouDirection(Number(initialForm.amount || 0) < 0 ? 'credit' : 'charge');
  }, [initialForm, isIouVariant]);

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
            <h5 className="modal-title">
              {isEditing
                ? (isIouVariant ? 'Edit IOU Entry' : 'Edit Ledger Entry')
                : isReadOnly
                  ? (isIouVariant ? 'View IOU Entry' : 'View Ledger Entry')
                  : (isIouVariant ? 'Add IOU Entry' : 'Add Ledger Entry')}
            </h5>
            <div className="d-flex align-items-center gap-2">
              {!isReadOnly ? (
                <StandardIconButton
                  iconKey="save"
                  ariaLabel={isEditing ? 'Save ledger entry changes' : 'Add ledger entry'}
                  title={isDirty ? (isEditing ? 'Save ledger entry changes' : 'Add ledger entry') : 'No changes to save'}
                  className="btn btn-outline-primary btn-sm catn8-action-icon-btn"
                  onClick={handleSave}
                  disabled={busy || !isDirty || !form.transaction_date || !form.description.trim() || (isIouVariant && !form.debtor_id)}
                />
              ) : null}
              {isReadOnly && onEdit ? (
                <StandardIconButton
                  iconKey="edit"
                  ariaLabel="Edit ledger entry"
                  title="Edit ledger entry"
                  className="btn btn-outline-primary btn-sm catn8-action-icon-btn"
                  onClick={onEdit}
                />
              ) : null}
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
            <Accumul8TransactionModalFields
              accounts={accounts}
              busy={busy}
              debtors={debtors}
              editPolicy={editPolicy}
              entities={entities}
              form={form}
              iouDirection={iouDirection}
              isIouVariant={isIouVariant}
              isReadOnly={isReadOnly}
              setForm={setForm}
              setIouDirection={setIouDirection}
            />
          </form>
        </div>
      </div>
    </div>
  );
}
