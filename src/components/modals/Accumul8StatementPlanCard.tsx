import React from 'react';
import { Accumul8Account, Accumul8BankingOrganization, Accumul8StatementUpload } from '../../types/accumul8';

export interface Accumul8StatementNewAccountDraft {
  banking_organization_name: string;
  account_name: string;
  account_type: string;
  institution_name: string;
  mask_last4: string;
}

interface Accumul8StatementPlanCardProps {
  busy: boolean;
  upload: Accumul8StatementUpload;
  sortedAccounts: Accumul8Account[];
  bankingOrganizations: Accumul8BankingOrganization[];
  accountMode: 'existing' | 'new';
  selectedAccountId: string;
  newAccount: Accumul8StatementNewAccountDraft;
  onModeChange: (mode: 'existing' | 'new') => void;
  onSelectedAccountChange: (accountId: string) => void;
  onNewAccountChange: (draft: Accumul8StatementNewAccountDraft) => void;
  onRescan: () => void;
  onConfirm: () => void;
  formatDateRange: (upload: Accumul8StatementUpload) => string;
  formatFileSize: (bytes: number) => string;
}

export function Accumul8StatementPlanCard({
  busy,
  upload,
  sortedAccounts,
  bankingOrganizations,
  accountMode,
  selectedAccountId,
  newAccount,
  onModeChange,
  onSelectedAccountChange,
  onNewAccountChange,
  onRescan,
  onConfirm,
  formatDateRange,
  formatFileSize,
}: Accumul8StatementPlanCardProps) {
  const plan = upload.plan;
  const canImport = accountMode === 'existing' ? selectedAccountId !== '' : newAccount.account_name.trim() !== '';

  return (
    <article className="accumul8-statement-history-card">
      <div className="accumul8-statement-history-card-head">
        <div>
          <strong>{upload.original_filename}</strong>
          <div className="small text-muted">{[upload.statement_kind.replace('_', ' '), formatDateRange(upload), `${plan?.importable_transaction_count || 0} importable rows`, formatFileSize(upload.file_size_bytes)].join(' · ')}</div>
        </div>
        <div className="accumul8-statement-card-actions">
          <button type="button" className="btn btn-sm btn-outline-secondary" disabled={busy} onClick={onRescan}>Re-scan</button>
          <button type="button" className="btn btn-sm btn-success" disabled={busy || !canImport} onClick={onConfirm}>Approve and Import</button>
        </div>
      </div>
      <div className="accumul8-statement-chip-row">
        <span className={`accumul8-statement-chip is-${upload.status}`}>{upload.status}</span>
        <span className="accumul8-statement-chip">{plan?.estimated_duplicate_count || 0} estimated duplicates</span>
        <span className="accumul8-statement-chip">{plan?.inflow_total.toFixed(2) || '0.00'} inflow</span>
        <span className="accumul8-statement-chip">{plan?.outflow_total.toFixed(2) || '0.00'} outflow</span>
      </div>
      <div className="accumul8-statement-plan-grid">
        <div>
          <div className="small text-muted">AI plan</div>
          <div>{plan?.institution_name || upload.institution_name || 'Institution not detected'}</div>
          <div>{plan?.account_name_hint || upload.account_name_hint || 'Account name not detected'}</div>
          <div className="small text-muted">{plan?.account_match_reason || 'No account match reasoning available.'}</div>
        </div>
        <div>
          <div className="small text-muted">Account target</div>
          <div className="accumul8-statement-mode-toggle">
            <button type="button" className={`btn btn-sm ${accountMode === 'existing' ? 'btn-primary' : 'btn-outline-primary'}`} disabled={busy} onClick={() => onModeChange('existing')}>Existing</button>
            <button type="button" className={`btn btn-sm ${accountMode === 'new' ? 'btn-primary' : 'btn-outline-primary'}`} disabled={busy} onClick={() => onModeChange('new')}>New account</button>
          </div>
          {accountMode === 'existing' ? (
            <select className="form-select form-select-sm mt-2" value={selectedAccountId} onChange={(event) => onSelectedAccountChange(event.target.value)} disabled={busy}>
              <option value="">Choose account</option>
              {sortedAccounts.map((account) => (
                <option key={`${upload.id}-${account.id}`} value={String(account.id)}>
                  {[account.banking_organization_name, account.account_name, account.mask_last4 ? `••${account.mask_last4}` : ''].filter(Boolean).join(' · ')}
                </option>
              ))}
            </select>
          ) : (
            <div className="accumul8-statement-new-account-grid mt-2">
              <input className="form-control form-control-sm" list={`accumul8-statement-bank-orgs-${upload.id}`} placeholder="Banking organization" value={newAccount.banking_organization_name} onChange={(event) => onNewAccountChange({ ...newAccount, banking_organization_name: event.target.value })} disabled={busy} />
              <datalist id={`accumul8-statement-bank-orgs-${upload.id}`}>
                {bankingOrganizations.map((bankingOrganization) => <option key={bankingOrganization.id} value={bankingOrganization.banking_organization_name} />)}
              </datalist>
              <input className="form-control form-control-sm" placeholder="Account name" value={newAccount.account_name} onChange={(event) => onNewAccountChange({ ...newAccount, account_name: event.target.value })} disabled={busy} />
              <input className="form-control form-control-sm" placeholder="Account type" value={newAccount.account_type} onChange={(event) => onNewAccountChange({ ...newAccount, account_type: event.target.value })} disabled={busy} />
              <input className="form-control form-control-sm" placeholder="Institution" value={newAccount.institution_name} onChange={(event) => onNewAccountChange({ ...newAccount, institution_name: event.target.value })} disabled={busy} />
              <input className="form-control form-control-sm" placeholder="Last 4" maxLength={8} value={newAccount.mask_last4} onChange={(event) => onNewAccountChange({ ...newAccount, mask_last4: event.target.value })} disabled={busy} />
            </div>
          )}
        </div>
      </div>
      {upload.processing_notes.length > 0 ? <div className="small text-muted mt-2">{upload.processing_notes.join(' ')}</div> : null}
      {upload.last_error ? <div className="accumul8-statement-error">{upload.last_error}</div> : null}
    </article>
  );
}
