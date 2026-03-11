import React from 'react';
import { Accumul8StatementKind, Accumul8StatementUpload } from '../../types/accumul8';
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
  ownerUserId: number;
  upload: Accumul8StatementUpload;
  onUpdateMetadata?: (payload: { id: number; statement_kind?: string; account_name_hint?: string; account_last4?: string }) => Promise<{ success: boolean; upload: Accumul8StatementUpload }>;
  onRescan: () => void;
  onDiscard: () => void;
  onConfirm: () => void;
  onReconcile?: () => void;
  onOpenWorkspace?: (panel: Exclude<StatementHistoryPanel, 'status' | null>) => void;
  rightColumn?: React.ReactNode;
  formatDateRange: (upload: Accumul8StatementUpload) => string;
  formatFileSize: (bytes: number) => string;
}

function normalizeStatementHelperText(value: string): string {
  const text = String(value || '').trim();
  if (text === 'User selected the import account.') {
    return '';
  }
  return text;
}

export function Accumul8StatementPlanCard({
  busy,
  ownerUserId,
  upload,
  onUpdateMetadata,
  onRescan,
  onDiscard,
  onConfirm,
  onReconcile,
  onOpenWorkspace,
  rightColumn,
  formatDateRange,
  formatFileSize,
}: Accumul8StatementPlanCardProps) {
  const plan = upload.plan;
  const accountMatchReason = normalizeStatementHelperText(plan?.account_match_reason || '');
  const filteredProcessingNotes = upload.processing_notes.filter((note) => normalizeStatementHelperText(note) !== '');
  const [activePanel, setActivePanel] = React.useState<'importable' | 'duplicates' | 'invalid' | 'totals' | null>(null);
  const [selectedKind, setSelectedKind] = React.useState<Accumul8StatementKind>(upload.statement_kind || 'bank_account');
  const [selectedSection, setSelectedSection] = React.useState(() => {
    const sections = plan?.account_section_options || [];
    const current = sections.find((section) => section.account_name_hint === (plan?.account_name_hint || upload.account_name_hint) && section.account_last4 === (plan?.account_last4 || upload.account_mask_last4));
    return current?.label || sections[0]?.label || '';
  });
  const importActionLabel = upload.imported_transaction_count > 0 ? 'Import Missing Records' : 'Approve and Import';
  const togglePanel = React.useCallback((panel: 'importable' | 'duplicates' | 'invalid' | 'totals') => {
    setActivePanel((current) => (current === panel ? null : panel));
  }, []);
  React.useEffect(() => {
    setSelectedKind(upload.statement_kind || 'bank_account');
    const sections = plan?.account_section_options || [];
    const current = sections.find((section) => section.account_name_hint === (plan?.account_name_hint || upload.account_name_hint) && section.account_last4 === (plan?.account_last4 || upload.account_mask_last4));
    setSelectedSection(current?.label || sections[0]?.label || '');
  }, [plan?.account_last4, plan?.account_name_hint, plan?.account_section_options, upload.account_mask_last4, upload.account_name_hint, upload.statement_kind]);
  const statementHref = `/api/accumul8.php?action=download_statement_upload&id=${upload.id}&owner_user_id=${ownerUserId}`;
  const handleKindChange = React.useCallback(async (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value as Accumul8StatementKind;
    setSelectedKind(value);
    if (onUpdateMetadata) {
      await onUpdateMetadata({ id: upload.id, statement_kind: value });
    }
  }, [onUpdateMetadata, upload.id]);
  const handleSectionChange = React.useCallback(async (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    setSelectedSection(value);
    const section = (plan?.account_section_options || []).find((option) => option.label === value);
    if (!section || !onUpdateMetadata) {
      return;
    }
    await onUpdateMetadata({
      id: upload.id,
      account_name_hint: section.account_name_hint,
      account_last4: section.account_last4,
    });
  }, [onUpdateMetadata, plan?.account_section_options, upload.id]);

  return (
    <article className="accumul8-statement-history-card accumul8-statement-plan-card">
      <div className={`accumul8-statement-plan-layout${rightColumn ? ' has-right-column' : ''}`}>
        <div className="accumul8-statement-chip-stack accumul8-statement-chip-stack--left">
          <button type="button" className="accumul8-statement-chip accumul8-statement-chip-button accumul8-statement-chip-button--tone-1" disabled={busy} onClick={() => onOpenWorkspace ? onOpenWorkspace('review') : undefined}>needs review</button>
          <button type="button" className={`accumul8-statement-chip accumul8-statement-chip-button accumul8-statement-chip-button--tone-2${activePanel === 'importable' ? ' is-active' : ''}`} disabled={busy} onClick={() => onOpenWorkspace ? onOpenWorkspace('review') : togglePanel('importable')}>{plan?.importable_transaction_count || 0} importable rows</button>
          <button type="button" className={`accumul8-statement-chip accumul8-statement-chip-button accumul8-statement-chip-button--tone-3${activePanel === 'duplicates' ? ' is-active' : ''}`} disabled={busy} onClick={() => onOpenWorkspace ? onOpenWorkspace('duplicates') : togglePanel('duplicates')}>{plan?.estimated_duplicate_count || 0} estimated duplicates</button>
          <button type="button" className={`accumul8-statement-chip accumul8-statement-chip-button accumul8-statement-chip-button--tone-4${activePanel === 'invalid' ? ' is-active' : ''}`} disabled={busy} onClick={() => onOpenWorkspace ? onOpenWorkspace('failed') : togglePanel('invalid')}>{plan?.invalid_transaction_count || 0} invalid rows</button>
          <button type="button" className={`accumul8-statement-chip accumul8-statement-chip-button accumul8-statement-chip-button--tone-5${activePanel === 'totals' ? ' is-active' : ''}`} disabled={busy} onClick={() => togglePanel('totals')}>{plan?.inflow_total.toFixed(2) || '0.00'} inflow · {plan?.outflow_total.toFixed(2) || '0.00'} outflow</button>
        </div>
        <div className="accumul8-statement-plan-main">
          <div>
            <strong>
              <a href={statementHref} target="_blank" rel="noreferrer">{upload.original_filename}</a>
            </strong>
            <div className="small text-muted">{[upload.statement_kind.replace('_', ' '), formatDateRange(upload), `${plan?.importable_transaction_count || 0} importable rows`, formatFileSize(upload.file_size_bytes)].join(' · ')}</div>
          </div>
          <div>
            <div>{plan?.institution_name || upload.institution_name || 'Institution not detected'}</div>
            <div className="accumul8-statement-plan-inline-fields">
              <select className="form-select form-select-sm" disabled={busy || !onUpdateMetadata} value={selectedKind} onChange={(event) => void handleKindChange(event)}>
                <option value="bank_account">Bank Account</option>
                <option value="credit_card">Credit Card</option>
                <option value="loan">Loan</option>
                <option value="mortgage">Mortgage</option>
                <option value="other">Other</option>
              </select>
              <select className="form-select form-select-sm" disabled={busy || !onUpdateMetadata || (plan?.account_section_options || []).length <= 1} value={selectedSection} onChange={(event) => void handleSectionChange(event)}>
                {((plan?.account_section_options || []).length > 0 ? plan?.account_section_options || [] : [{ label: plan?.account_name_hint || upload.account_name_hint || 'Account name not detected', account_name_hint: plan?.account_name_hint || upload.account_name_hint || '', account_last4: plan?.account_last4 || upload.account_mask_last4 || '' }]).map((option) => (
                  <option key={`${option.label}-${option.account_last4}`} value={option.label}>{option.label || 'Account name not detected'}</option>
                ))}
              </select>
            </div>
            {accountMatchReason ? <div className="small text-muted">{accountMatchReason}</div> : null}
          </div>
          <div className="accumul8-statement-card-actions">
            <button type="button" className="btn btn-sm btn-outline-secondary" disabled={busy} onClick={onRescan}>Re-scan</button>
            {onReconcile ? <button type="button" className="btn btn-sm btn-outline-primary" disabled={busy} onClick={onReconcile}>Reconciliation</button> : null}
            <button type="button" className="btn btn-sm btn-success" disabled={busy} onClick={onConfirm}>{importActionLabel}</button>
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
                The scan thinks about {plan?.estimated_duplicate_count || 0} rows may already exist in the ledger for the detected target account. Use {importActionLabel.toLowerCase()} when you want to add anything new without re-posting those matches.
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
          {plan?.suggested_account_label ? (
            <div className="small text-muted">
              Target account: {plan.suggested_account_label}
            </div>
          ) : null}
        </div>
        {rightColumn ? <div className="accumul8-statement-plan-side">{rightColumn}</div> : null}
      </div>
      {filteredProcessingNotes.length > 0 ? <div className="small text-muted mt-2">{filteredProcessingNotes.join(' ')}</div> : null}
      {upload.last_error ? <div className="accumul8-statement-error">{upload.last_error}</div> : null}
    </article>
  );
}
