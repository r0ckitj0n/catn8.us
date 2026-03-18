import React from 'react';

import { Accumul8Account, Accumul8Debtor, Accumul8Entity, Accumul8EntryType } from '../../types/accumul8';
import { Accumul8IouDirection, Accumul8TransactionModalFormState } from './accumul8TransactionModalTypes';

interface Accumul8TransactionModalFieldsProps {
  accounts: Accumul8Account[];
  busy: boolean;
  debtors: Accumul8Debtor[];
  editPolicy: {
    canEditBudgetPlanner: boolean;
    canEditCoreFields: boolean;
    canEditPaidState: boolean;
  };
  entities: Accumul8Entity[];
  form: Accumul8TransactionModalFormState;
  iouDirection: Accumul8IouDirection;
  isIouVariant: boolean;
  isReadOnly: boolean;
  setForm: React.Dispatch<React.SetStateAction<Accumul8TransactionModalFormState>>;
  setIouDirection: React.Dispatch<React.SetStateAction<Accumul8IouDirection>>;
}

export function Accumul8TransactionModalFields({
  accounts,
  busy,
  debtors,
  editPolicy,
  entities,
  form,
  iouDirection,
  isIouVariant,
  isReadOnly,
  setForm,
  setIouDirection,
}: Accumul8TransactionModalFieldsProps) {
  return (
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
      {isIouVariant ? (
        <>
          <div className="col-md-4">
            <label className="form-label" htmlFor="accumul8-transaction-debtor">Person</label>
            <select
              id="accumul8-transaction-debtor"
              className="form-select"
              value={form.debtor_id}
              onChange={(e) => setForm((prev) => ({ ...prev, debtor_id: e.target.value }))}
              disabled={busy || isReadOnly}
            >
              <option value="">Select a person</option>
              {debtors.map((debtor) => (
                <option key={debtor.id} value={debtor.id}>{debtor.debtor_name}</option>
              ))}
            </select>
          </div>
          <div className="col-md-4">
            <label className="form-label" htmlFor="accumul8-transaction-iou-direction">Direction</label>
            <select
              id="accumul8-transaction-iou-direction"
              className="form-select"
              value={iouDirection}
              onChange={(e) => setIouDirection(e.target.value as Accumul8IouDirection)}
              disabled={busy || isReadOnly || !editPolicy.canEditCoreFields}
            >
              <option value="charge">Charge (increase IOU)</option>
              <option value="credit">Credit / Payment (decrease IOU)</option>
            </select>
          </div>
        </>
      ) : (
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
      )}
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
          onChange={(e) => setForm((prev) => ({ ...prev, amount: isIouVariant ? Math.abs(Number(e.target.value)) : Number(e.target.value) }))}
          required
          disabled={busy || isReadOnly || !editPolicy.canEditCoreFields}
        />
        {isIouVariant ? (
          <div className="form-text">
            {iouDirection === 'credit' ? 'Credits and payments are saved as negative amounts.' : 'Charges are saved as positive amounts.'}
          </div>
        ) : null}
      </div>
      {!isIouVariant ? (
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
      ) : null}
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
      {!isIouVariant ? (
        <>
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
        </>
      ) : null}
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
  );
}
