import React from 'react';
import { Accumul8Account, Accumul8BankingOrganization, Accumul8StatementUpload } from '../../types/accumul8';
import { StatementHistoryPanel } from './Accumul8StatementHistoryCard';

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
  onDiscard: () => void;
  onConfirm: () => void;
  onOpenWorkspace?: (panel: Exclude<StatementHistoryPanel, 'status' | null>) => void;
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
  onDiscard,
  onConfirm,
  onOpenWorkspace,
  formatDateRange,
  formatFileSize,
}: Accumul8StatementPlanCardProps) {
  const plan = upload.plan;
  const canImport = accountMode === 'existing' ? selectedAccountId !== '' : newAccount.account_name.trim() !== '';
  const [activePanel, setActivePanel] = React.useState<'importable' | 'duplicates' | 'invalid' | 'totals' | null>(null);
  const importActionLabel = upload.imported_transaction_count > 0 ? 'Import Missing Records' : 'Approve and Import';
  const togglePanel = React.useCallback((panel: 'importable' | 'duplicates' | 'invalid' | 'totals') => {
    setActivePanel((current) => (current === panel ? null : panel));
  }, []);

  return (
    <article className="accumul8-statement-history-card">
      <div className="accumul8-statement-history-card-head">
        <div>
          <strong>{upload.original_filename}</strong>
          <div className="small text-muted">{[upload.statement_kind.replace('_', ' '), formatDateRange(upload), `${plan?.importable_transaction_count || 0} importable rows`, formatFileSize(upload.file_size_bytes)].join(' · ')}</div>
        </div>
        <div className="accumul8-statement-card-actions">
          <button type="button" className="btn btn-sm btn-outline-secondary" disabled={busy} onClick={onRescan}>Re-scan</button>
          <button type="button" className="btn btn-sm btn-outline-warning" disabled={busy} onClick={onDiscard}>Discard</button>
          <button type="button" className="btn btn-sm btn-success" disabled={busy || !canImport} onClick={onConfirm}>{importActionLabel}</button>
        </div>
      </div>
      <div className="accumul8-statement-chip-row">
        <button type="button" className="accumul8-statement-chip accumul8-statement-chip-button is-warning" disabled={busy} onClick={() => onOpenWorkspace ? onOpenWorkspace('review') : undefined}>needs review</button>
        <button type="button" className={`accumul8-statement-chip accumul8-statement-chip-button${activePanel === 'importable' ? ' is-active' : ''}`} disabled={busy} onClick={() => onOpenWorkspace ? onOpenWorkspace('review') : togglePanel('importable')}>{plan?.importable_transaction_count || 0} importable rows</button>
        <button type="button" className={`accumul8-statement-chip accumul8-statement-chip-button${activePanel === 'duplicates' ? ' is-active' : ''}`} disabled={busy} onClick={() => onOpenWorkspace ? onOpenWorkspace('duplicates') : togglePanel('duplicates')}>{plan?.estimated_duplicate_count || 0} estimated duplicates</button>
        <button type="button" className={`accumul8-statement-chip accumul8-statement-chip-button${activePanel === 'invalid' ? ' is-active' : ''}${(plan?.invalid_transaction_count || 0) > 0 ? ' is-warning' : ''}`} disabled={busy} onClick={() => onOpenWorkspace ? onOpenWorkspace('failed') : togglePanel('invalid')}>{plan?.invalid_transaction_count || 0} invalid rows</button>
        <button type="button" className={`accumul8-statement-chip accumul8-statement-chip-button${activePanel === 'totals' ? ' is-active' : ''}`} disabled={busy} onClick={() => togglePanel('totals')}>{plan?.inflow_total.toFixed(2) || '0.00'} inflow · {plan?.outflow_total.toFixed(2) || '0.00'} outflow</button>
      </div>
      {activePanel === 'importable' ? (
        <div className="accumul8-statement-detail-panel">
          <strong>Importable rows</strong>
          <div className="small text-muted">
            Approving this plan will attempt to post {plan?.importable_transaction_count || 0} parsed rows. If this statement was imported before, only the still-missing rows will post and anything already in the ledger will stay skipped as a duplicate.
          </div>
        </div>
      ) : null}
      {activePanel === 'duplicates' ? (
        <div className="accumul8-statement-detail-panel">
          <strong>Estimated duplicates</strong>
          <div className="small text-muted">
            The scan thinks about {plan?.estimated_duplicate_count || 0} rows may already exist in the ledger for the selected account. Use {importActionLabel.toLowerCase()} when you want to add anything new without re-posting those matches.
          </div>
        </div>
      ) : null}
      {activePanel === 'invalid' ? (
        <div className="accumul8-statement-detail-panel">
          <strong>Invalid rows</strong>
          <div className="small text-muted">
            {plan?.invalid_transaction_count || 0} parsed rows are missing enough information to post safely. Re-scan after improving OCR or confirm only when you are comfortable leaving those rows out.
          </div>
        </div>
      ) : null}
      {activePanel === 'totals' ? (
        <div className="accumul8-statement-detail-panel">
          <strong>Statement totals</strong>
          <div className="small text-muted">
            This plan detected {plan?.inflow_total.toFixed(2) || '0.00'} of inflow and {plan?.outflow_total.toFixed(2) || '0.00'} of outflow across the parsed rows between {plan?.first_transaction_date || 'unknown start'} and {plan?.last_transaction_date || 'unknown end'}.
          </div>
        </div>
      ) : null}
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
