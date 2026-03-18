import React from 'react';

import { Accumul8Account, Accumul8AccountUpsertRequest, Accumul8BankingOrganization } from '../../types/accumul8';
import { getAccumul8AccountDisplayName } from '../../utils/accumul8Accounts';
import { toAccountForm, toAccountPayload } from './bankingOrganizationManagerModalData';

interface BankingOrganizationManagerAccountSectionProps {
  accountForm: Accumul8AccountUpsertRequest;
  busy: boolean;
  createAccount: (form: Accumul8AccountUpsertRequest) => Promise<void>;
  editingAccountId: number | null;
  resetAccountForm: () => void;
  setAccountForm: React.Dispatch<React.SetStateAction<Accumul8AccountUpsertRequest>>;
  setEditingAccountId: (id: number | null) => void;
  updateAccount: (id: number, form: Accumul8AccountUpsertRequest) => Promise<void>;
  visibleAccounts: Accumul8Account[];
  visibleBankingOrganizations: Accumul8BankingOrganization[];
  onDelete: (account: Accumul8Account) => void;
}

export function BankingOrganizationManagerAccountSection({
  accountForm,
  busy,
  createAccount,
  editingAccountId,
  resetAccountForm,
  setAccountForm,
  setEditingAccountId,
  updateAccount,
  visibleAccounts,
  visibleBankingOrganizations,
  onDelete,
}: BankingOrganizationManagerAccountSectionProps) {
  return (
    <>
      <p className="text-muted small mb-3">Create, rename, reassign, disable, or remove bank accounts. Deleting an account also permanently removes its ledger and recurring records, while saved statement files remain but lose their account link.</p>
      <form className="row g-2 mb-3" onSubmit={(e) => {
        e.preventDefault();
        const payload = toAccountPayload(accountForm);
        if (editingAccountId) void updateAccount(editingAccountId, payload).then(() => resetAccountForm());
        else void createAccount(payload).then(() => resetAccountForm());
      }}>
        <div className="col-md-4"><label className="form-label" htmlFor="accumul8-account-name">Bank account name</label><input id="accumul8-account-name" className="form-control" value={accountForm.account_name || ''} onChange={(e) => setAccountForm((prev) => ({ ...prev, account_name: e.target.value }))} required /></div>
        <div className="col-md-3"><label className="form-label" htmlFor="accumul8-account-nickname">Nickname</label><input id="accumul8-account-nickname" className="form-control" value={accountForm.account_nickname || ''} onChange={(e) => setAccountForm((prev) => ({ ...prev, account_nickname: e.target.value }))} /></div>
        <div className="col-md-3"><label className="form-label" htmlFor="accumul8-account-banking-organization">Banking organization</label><select id="accumul8-account-banking-organization" className="form-select" value={Number(accountForm.banking_organization_id || 0) > 0 ? String(accountForm.banking_organization_id) : ''} onChange={(e) => setAccountForm((prev) => ({ ...prev, banking_organization_id: e.target.value ? Number(e.target.value) : null }))}><option value="">No banking organization</option>{visibleBankingOrganizations.map((bankingOrganization) => <option key={bankingOrganization.id} value={bankingOrganization.id}>{bankingOrganization.banking_organization_name}</option>)}</select></div>
        <div className="col-md-2"><label className="form-label" htmlFor="accumul8-account-type">Type</label><input id="accumul8-account-type" className="form-control" value={accountForm.account_type || 'checking'} onChange={(e) => setAccountForm((prev) => ({ ...prev, account_type: e.target.value }))} /></div>
        <div className="col-md-2"><label className="form-label" htmlFor="accumul8-account-subtype">Subtype</label><input id="accumul8-account-subtype" className="form-control" value={accountForm.account_subtype || ''} onChange={(e) => setAccountForm((prev) => ({ ...prev, account_subtype: e.target.value }))} /></div>
        <div className="col-md-3"><label className="form-label" htmlFor="accumul8-account-institution">Institution</label><input id="accumul8-account-institution" className="form-control" value={accountForm.institution_name || ''} onChange={(e) => setAccountForm((prev) => ({ ...prev, institution_name: e.target.value }))} /></div>
        <div className="col-md-2"><label className="form-label" htmlFor="accumul8-account-number-mask">Account mask</label><input id="accumul8-account-number-mask" className="form-control" maxLength={32} value={accountForm.account_number_mask || ''} onChange={(e) => setAccountForm((prev) => ({ ...prev, account_number_mask: e.target.value }))} /></div>
        <div className="col-md-2"><label className="form-label" htmlFor="accumul8-account-last4">Last 4</label><input id="accumul8-account-last4" className="form-control" maxLength={8} value={accountForm.mask_last4 || ''} onChange={(e) => setAccountForm((prev) => ({ ...prev, mask_last4: e.target.value }))} /></div>
        <div className="col-md-2"><label className="form-label" htmlFor="accumul8-account-routing-number">Routing</label><input id="accumul8-account-routing-number" className="form-control" value={accountForm.routing_number || ''} onChange={(e) => setAccountForm((prev) => ({ ...prev, routing_number: e.target.value }))} /></div>
        <div className="col-md-2"><label className="form-label" htmlFor="accumul8-account-currency-code">Currency</label><input id="accumul8-account-currency-code" className="form-control" maxLength={3} value={accountForm.currency_code || 'USD'} onChange={(e) => setAccountForm((prev) => ({ ...prev, currency_code: e.target.value }))} /></div>
        <div className="col-md-2"><label className="form-label" htmlFor="accumul8-account-statement-day">Statement day</label><input id="accumul8-account-statement-day" className="form-control" type="number" min={1} max={31} value={accountForm.statement_day_of_month ?? ''} onChange={(e) => setAccountForm((prev) => ({ ...prev, statement_day_of_month: e.target.value ? Number(e.target.value) : null }))} /></div>
        <div className="col-md-2"><label className="form-label" htmlFor="accumul8-account-payment-due-day">Due day</label><input id="accumul8-account-payment-due-day" className="form-control" type="number" min={1} max={31} value={accountForm.payment_due_day_of_month ?? ''} onChange={(e) => setAccountForm((prev) => ({ ...prev, payment_due_day_of_month: e.target.value ? Number(e.target.value) : null }))} /></div>
        <div className="col-md-2"><label className="form-label" htmlFor="accumul8-account-autopay-enabled">Autopay</label><select id="accumul8-account-autopay-enabled" className="form-select" value={String(Number(accountForm.autopay_enabled || 0))} onChange={(e) => setAccountForm((prev) => ({ ...prev, autopay_enabled: Number(e.target.value) }))}><option value="0">No</option><option value="1">Yes</option></select></div>
        <div className="col-md-2"><label className="form-label" htmlFor="accumul8-account-active">Status</label><select id="accumul8-account-active" className="form-select" value={String(Number(accountForm.is_active || 0))} onChange={(e) => setAccountForm((prev) => ({ ...prev, is_active: Number(e.target.value) }))}><option value="1">Active</option><option value="0">Inactive</option></select></div>
        <div className="col-md-2"><label className="form-label" htmlFor="accumul8-account-credit-limit">Credit limit</label><input id="accumul8-account-credit-limit" className="form-control" type="number" step="0.01" value={accountForm.credit_limit ?? 0} onChange={(e) => setAccountForm((prev) => ({ ...prev, credit_limit: Number(e.target.value || 0) }))} /></div>
        <div className="col-md-2"><label className="form-label" htmlFor="accumul8-account-interest-rate">APR %</label><input id="accumul8-account-interest-rate" className="form-control" type="number" step="0.0001" value={accountForm.interest_rate ?? 0} onChange={(e) => setAccountForm((prev) => ({ ...prev, interest_rate: Number(e.target.value || 0) }))} /></div>
        <div className="col-md-2"><label className="form-label" htmlFor="accumul8-account-minimum-payment">Min payment</label><input id="accumul8-account-minimum-payment" className="form-control" type="number" step="0.01" value={accountForm.minimum_payment ?? 0} onChange={(e) => setAccountForm((prev) => ({ ...prev, minimum_payment: Number(e.target.value || 0) }))} /></div>
        <div className="col-md-2"><label className="form-label" htmlFor="accumul8-account-opened-on">Opened</label><input id="accumul8-account-opened-on" className="form-control" type="date" value={typeof accountForm.opened_on === 'string' ? accountForm.opened_on : ''} onChange={(e) => setAccountForm((prev) => ({ ...prev, opened_on: e.target.value }))} /></div>
        <div className="col-md-2"><label className="form-label" htmlFor="accumul8-account-closed-on">Closed</label><input id="accumul8-account-closed-on" className="form-control" type="date" value={typeof accountForm.closed_on === 'string' ? accountForm.closed_on : ''} onChange={(e) => setAccountForm((prev) => ({ ...prev, closed_on: e.target.value }))} /></div>
        <div className="col-md-2 d-grid"><label className="form-label invisible">Save</label><button type="submit" className="btn btn-success" disabled={busy}>{editingAccountId ? 'Update' : 'Add'}</button></div>
        <div className="col-12"><label className="form-label" htmlFor="accumul8-account-notes">Notes</label><textarea id="accumul8-account-notes" className="form-control" rows={2} value={typeof accountForm.notes === 'string' ? accountForm.notes : ''} onChange={(e) => setAccountForm((prev) => ({ ...prev, notes: e.target.value }))} /></div>
        {editingAccountId ? <div className="col-md-2 d-grid"><label className="form-label invisible">Cancel</label><button type="button" className="btn btn-outline-secondary" onClick={resetAccountForm} disabled={busy}>Cancel</button></div> : null}
      </form>
      <div className="table-responsive">
        <table className="table table-sm align-middle">
          <thead><tr><th>Name</th><th>Banking Organization</th><th>Institution / Type</th><th>Servicing</th><th>Status</th><th className="text-end catn8-actions-column">Actions</th></tr></thead>
          <tbody>
            {visibleAccounts.map((account) => (
              <tr key={account.id}>
                <td>{getAccumul8AccountDisplayName(account)}{account.account_nickname ? <div className="small text-muted">{account.account_name}</div> : null}{account.mask_last4 ? <span className="text-muted"> • {account.mask_last4}</span> : null}</td>
                <td>{account.banking_organization_name || '-'}</td>
                <td><div>{account.institution_name || '-'}</div><div className="small text-muted">{account.account_type || '-'}{account.account_subtype ? ` / ${account.account_subtype}` : ''}</div></td>
                <td><div>{account.currency_code || 'USD'}{account.account_number_mask ? ` • ${account.account_number_mask}` : ''}</div><div className="small text-muted">{account.statement_day_of_month ? `Stmt ${account.statement_day_of_month}` : ''}{account.payment_due_day_of_month ? `${account.statement_day_of_month ? ' • ' : ''}Due ${account.payment_due_day_of_month}` : ''}{account.autopay_enabled ? `${account.statement_day_of_month || account.payment_due_day_of_month ? ' • ' : ''}Autopay` : ''}</div></td>
                <td>{account.is_active ? 'Active' : 'Inactive'}</td>
                <td className="text-end catn8-actions-column"><div className="d-inline-flex gap-2"><button type="button" className="btn btn-sm btn-outline-primary" onClick={() => { setEditingAccountId(account.id); setAccountForm(toAccountForm(account)); }} disabled={busy}>Edit</button><button type="button" className="btn btn-sm btn-outline-danger" onClick={() => onDelete(account)} disabled={busy}>Delete</button></div></td>
              </tr>
            ))}
            {visibleAccounts.length === 0 ? <tr><td colSpan={6} className="text-muted">No bank accounts created yet.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
