import React from 'react';
import { useBootstrapModal } from '../../hooks/useBootstrapModal';
import {
  Accumul8Account,
  Accumul8BankingOrganization,
  Accumul8StatementImportResult,
  Accumul8StatementKind,
  Accumul8StatementSearchResult,
  Accumul8StatementUpload,
} from '../../types/accumul8';
import { Accumul8ModalHelp } from './Accumul8ModalHelp';
import { ModalCloseIconButton } from '../common/ModalCloseIconButton';
import { WebpImage } from '../common/WebpImage';
import { Accumul8StatementHistoryCard, Accumul8StatementSearchResultCard } from './Accumul8StatementHistoryCard';
import { Accumul8StatementNewAccountDraft, Accumul8StatementPlanCard } from './Accumul8StatementPlanCard';
import { createStatementNewAccountDraft, formatStatementDateRange, formatStatementFileSize } from './accumul8StatementUtils';
import './Accumul8StatementModal.css';
interface Accumul8StatementModalProps {
  open: boolean;
  busy: boolean;
  accounts: Accumul8Account[];
  bankingOrganizations: Accumul8BankingOrganization[];
  statementUploads: Accumul8StatementUpload[];
  ownerUserId: number;
  onClose: () => void;
  onUpload: (formData: FormData) => Promise<Accumul8StatementUpload | undefined>;
  onRescan: (id: number, accountId?: number | null) => Promise<Accumul8StatementUpload | undefined>;
  onConfirmImport: (payload: {
    id: number;
    account_id?: number | null;
    create_account?: Accumul8StatementNewAccountDraft | null;
  }) => Promise<{ success: boolean; upload: Accumul8StatementUpload; import_result: Accumul8StatementImportResult | null }>;
  onSearch: (query: string) => Promise<Accumul8StatementSearchResult[]>;
}
const DEFAULT_KIND: Accumul8StatementKind = 'bank_account';

export function Accumul8StatementModal({
  open,
  busy,
  accounts,
  bankingOrganizations,
  statementUploads,
  ownerUserId,
  onClose,
  onUpload,
  onRescan,
  onConfirmImport,
  onSearch,
}: Accumul8StatementModalProps) {
  const { modalRef, modalApiRef } = useBootstrapModal(onClose);
  const [statementKind, setStatementKind] = React.useState<Accumul8StatementKind>(DEFAULT_KIND);
  const [accountId, setAccountId] = React.useState('');
  const [files, setFiles] = React.useState<File[]>([]);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [searchBusy, setSearchBusy] = React.useState(false);
  const [searchResults, setSearchResults] = React.useState<Accumul8StatementSearchResult[]>([]);
  const [accountModeById, setAccountModeById] = React.useState<Record<number, 'existing' | 'new'>>({});
  const [selectedAccountById, setSelectedAccountById] = React.useState<Record<number, string>>({});
  const [newAccountById, setNewAccountById] = React.useState<Record<number, Accumul8StatementNewAccountDraft>>({});
  const [latestImportResult, setLatestImportResult] = React.useState<{ uploadId: number; filename: string; result: Accumul8StatementImportResult | null } | null>(null);
  const [selectedReviewUploadId, setSelectedReviewUploadId] = React.useState<number | null>(null);

  React.useEffect(() => {
    const modal = modalApiRef.current;
    if (!modal) return;
    if (open) modal.show();
    else modal.hide();
  }, [modalApiRef, open]);
  React.useEffect(() => {
    if (!open) {
      setStatementKind(DEFAULT_KIND);
      setAccountId('');
      setFiles([]);
      setSearchQuery('');
      setSearchResults([]);
      setLatestImportResult(null);
      setSelectedReviewUploadId(null);
    }
  }, [open]);

  React.useEffect(() => {
    if (typeof document === 'undefined') return;
    document.body.classList.toggle('accumul8-contact-modal-open', open);
    return () => document.body.classList.remove('accumul8-contact-modal-open');
  }, [open]);

  React.useEffect(() => {
    setSelectedAccountById((prev) => {
      const next = { ...prev };
      statementUploads.forEach((upload) => {
        if (!(upload.id in next)) {
          next[upload.id] = upload.account_id ? String(upload.account_id) : (upload.plan?.suggested_account_id ? String(upload.plan.suggested_account_id) : '');
        }
      });
      return next;
    });
    setAccountModeById((prev) => {
      const next = { ...prev };
      statementUploads.forEach((upload) => {
        if (!(upload.id in next)) {
          next[upload.id] = upload.plan?.suggested_account_id ? 'existing' : 'new';
        }
      });
      return next;
    });
    setNewAccountById((prev) => {
      const next = { ...prev };
      statementUploads.forEach((upload) => {
        if (!(upload.id in next)) {
          next[upload.id] = createStatementNewAccountDraft(upload);
        }
      });
      return next;
    });
  }, [statementUploads]);

  const sortedAccounts = React.useMemo(
    () => [...accounts].sort((a, b) => `${a.banking_organization_name} ${a.account_name}`.localeCompare(`${b.banking_organization_name} ${b.account_name}`)),
    [accounts],
  );
  const pendingUploads = React.useMemo(
    () => statementUploads.filter((upload) => upload.plan && (upload.status === 'scanned' || upload.status === 'needs_review' || upload.status === 'failed')),
    [statementUploads],
  );
  const activeReviewUpload = React.useMemo(
    () => pendingUploads.find((upload) => upload.id === selectedReviewUploadId) || pendingUploads[0] || null,
    [pendingUploads, selectedReviewUploadId],
  );

  React.useEffect(() => {
    if (pendingUploads.length === 0) {
      setSelectedReviewUploadId(null);
      return;
    }
    if (!pendingUploads.some((upload) => upload.id === selectedReviewUploadId)) {
      setSelectedReviewUploadId(pendingUploads[0].id);
    }
  }, [pendingUploads, selectedReviewUploadId]);

  const handleSubmit = React.useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (files.length === 0) return;
    setLatestImportResult(null);
    for (const file of files) {
      const formData = new FormData();
      formData.append('statement_kind', statementKind);
      if (accountId) formData.append('account_id', accountId);
      formData.append('statement_file', file);
      await onUpload(formData);
    }
    setFiles([]);
  }, [accountId, files, onUpload, statementKind]);

  const handleSearch = React.useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = searchQuery.trim();
    if (!query) {
      setSearchResults([]);
      return;
    }
    setSearchBusy(true);
    try {
      setSearchResults(await onSearch(query));
    } finally {
      setSearchBusy(false);
    }
  }, [onSearch, searchQuery]);

  const handleConfirmImport = React.useCallback(async (upload: Accumul8StatementUpload) => {
    const mode = accountModeById[upload.id] || 'existing';
    const selectedAccount = selectedAccountById[upload.id] || '';
    const createAccount = newAccountById[upload.id] || createStatementNewAccountDraft(upload);
    const response = await onConfirmImport({
      id: upload.id,
      account_id: mode === 'existing' && selectedAccount ? Number(selectedAccount) : null,
      create_account: mode === 'new' ? createAccount : null,
    });
    setLatestImportResult({
      uploadId: upload.id,
      filename: upload.original_filename,
      result: response.import_result,
    });
  }, [accountModeById, newAccountById, onConfirmImport, selectedAccountById]);

  const openReview = React.useCallback((uploadId: number) => {
    setSelectedReviewUploadId(uploadId);
    if (typeof document !== 'undefined') {
      window.requestAnimationFrame(() => {
        document.getElementById(`accumul8-statement-review-${uploadId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  }, []);

  return (
    <div className="modal fade accumul8-contact-modal accumul8-statement-modal" tabIndex={-1} aria-hidden="true" ref={modalRef}>
      <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-xl">
        <div className="modal-content">
          {busy ? (
            <div className="accumul8-statement-busy-overlay" role="status" aria-live="polite" aria-label="Statement scan in progress">
              <div className="accumul8-statement-busy-card">
                <WebpImage
                  className="accumul8-statement-busy-logo"
                  src="/images/catn8_logo.png"
                  alt=""
                  aria-hidden="true"
                />
                <div className="accumul8-statement-busy-text">Scanning statement...</div>
              </div>
            </div>
          ) : null}
          <div className="modal-header">
            <h5 className="modal-title">Bank Statements</h5>
            <div className="accumul8-statement-modal-header-actions">
              <Accumul8ModalHelp buttonLabel="Statement upload help" buttonTitle="Statement upload help" modalTitle="Statement Upload Help" parentOpen={open}>
                <div className="accumul8-statement-hero">
                  <div className="accumul8-statement-hero-card">
                    <strong>Scan first, import second</strong>
                    <p className="mb-0">Each file is OCR scanned, cataloged, and converted into an AI import plan first. Nothing reaches the ledger until you approve the plan.</p>
                  </div>
                  <div className="accumul8-statement-hero-card">
                    <strong>Review and retry</strong>
                    <p className="mb-0">You can re-scan any saved statement, choose an existing account, create a new account for unmatched statements, and review imported, duplicate, and failed rows afterward.</p>
                  </div>
                </div>
              </Accumul8ModalHelp>
              <ModalCloseIconButton />
            </div>
          </div>
          <div className="modal-body">
            <form className="row g-3 mb-2" onSubmit={handleSubmit}>
              <div className="col-md-3">
                <label className="form-label" htmlFor="accumul8-statement-kind">Statement type</label>
                <select id="accumul8-statement-kind" className="form-select" value={statementKind} onChange={(event) => setStatementKind(event.target.value as Accumul8StatementKind)} disabled={busy}>
                  <option value="bank_account">Bank account</option>
                  <option value="credit_card">Credit card</option>
                  <option value="loan">Car loan / installment</option>
                  <option value="mortgage">Mortgage</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="col-md-5">
                <label className="form-label" htmlFor="accumul8-statement-account">Preferred account</label>
                <select id="accumul8-statement-account" className="form-select" value={accountId} onChange={(event) => setAccountId(event.target.value)} disabled={busy}>
                  <option value="">Let AI propose an account</option>
                  {sortedAccounts.map((uploadAccount) => (
                    <option key={uploadAccount.id} value={String(uploadAccount.id)}>
                      {[uploadAccount.banking_organization_name, uploadAccount.account_name, uploadAccount.mask_last4 ? `••${uploadAccount.mask_last4}` : ''].filter(Boolean).join(' · ')}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-4">
                <label className="form-label" htmlFor="accumul8-statement-files">Statement files</label>
                <input id="accumul8-statement-files" className="form-control" type="file" accept=".pdf,image/*" multiple disabled={busy} onChange={(event) => setFiles(Array.from(event.target.files || []))} />
              </div>
              <div className="col-12">
                <div className="accumul8-statement-upload-actions">
                  <div className="small text-muted">
                    {files.length > 0 ? `${files.length} file(s) queued: ${files.map((file) => file.name).join(', ')}` : 'Choose one or more statements to scan into an import plan.'}
                  </div>
                  <button type="submit" className="btn btn-success" disabled={busy || files.length === 0}>Scan Statements</button>
                </div>
              </div>
            </form>

            <form className="accumul8-statement-search" onSubmit={handleSearch}>
              <input className="form-control" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search scanned statement contents, payees, memo text, or dates" disabled={busy || searchBusy} />
              <button type="submit" className="btn btn-outline-primary" disabled={busy || searchBusy || searchQuery.trim() === ''}>Search</button>
            </form>
            {searchResults.length > 0 ? (
              <div className="accumul8-statement-search-results">
                {searchResults.map((result) => <Accumul8StatementSearchResultCard key={result.upload_id} ownerUserId={ownerUserId} result={result} />)}
              </div>
            ) : null}

            {latestImportResult ? (
              <section className="accumul8-statement-history-card">
                <strong>Latest import result</strong>
                <div className="small text-muted mb-2">{latestImportResult.filename}</div>
                <div className="accumul8-statement-chip-row">
                  <span className="accumul8-statement-chip is-processed">{latestImportResult.result?.imported_count || 0} imported</span>
                  <span className="accumul8-statement-chip">{latestImportResult.result?.duplicate_count || 0} duplicates skipped</span>
                  <span className={`accumul8-statement-chip${(latestImportResult.result?.failed_count || 0) > 0 ? ' is-warning' : ''}`}>{latestImportResult.result?.failed_count || 0} failed</span>
                </div>
                {latestImportResult.result?.successful_rows?.length ? <div className="small text-muted">Imported: {latestImportResult.result.successful_rows.map((row) => `${row.transaction_date || ''} ${row.description || ''}`.trim()).slice(0, 5).join(' | ')}</div> : null}
                {latestImportResult.result?.failed_rows?.length ? <div className="accumul8-statement-error">Failed: {latestImportResult.result.failed_rows.map((row) => row.reason || 'Unknown error').slice(0, 3).join(' | ')}</div> : null}
              </section>
            ) : null}

            {activeReviewUpload ? (
              <section id={`accumul8-statement-review-${activeReviewUpload.id}`} className="accumul8-statement-review-section">
                <div className="accumul8-statement-history-head">
                  <div>
                    <strong>Review and approve import</strong>
                    <div className="small text-muted">
                      {pendingUploads.length > 1
                        ? `${pendingUploads.length} statements are waiting for review. Choose one below, then approve when the target account looks right.`
                        : 'This scan is waiting for your approval before anything new is posted to the ledger.'}
                    </div>
                  </div>
                </div>
                {pendingUploads.length > 1 ? (
                  <div className="accumul8-statement-review-selector">
                    {pendingUploads.map((upload) => (
                      <button
                        key={`review-selector-${upload.id}`}
                        type="button"
                        className={`btn btn-sm ${activeReviewUpload.id === upload.id ? 'btn-primary' : 'btn-outline-primary'}`}
                        onClick={() => openReview(upload.id)}
                        disabled={busy}
                      >
                        {upload.original_filename}
                      </button>
                    ))}
                  </div>
                ) : null}
                {(() => {
                  const upload = activeReviewUpload;
                  const mode = accountModeById[upload.id] || 'existing';
                  const selectedUploadAccount = selectedAccountById[upload.id] || '';
                  const newAccount = newAccountById[upload.id] || createStatementNewAccountDraft(upload);
                  return (
                    <Accumul8StatementPlanCard
                      key={`plan-${upload.id}`}
                      busy={busy}
                      upload={upload}
                      sortedAccounts={sortedAccounts}
                      bankingOrganizations={bankingOrganizations}
                      accountMode={mode}
                      selectedAccountId={selectedUploadAccount}
                      newAccount={newAccount}
                      onModeChange={(nextMode) => setAccountModeById((prev) => ({ ...prev, [upload.id]: nextMode }))}
                      onSelectedAccountChange={(nextAccountId) => setSelectedAccountById((prev) => ({ ...prev, [upload.id]: nextAccountId }))}
                      onNewAccountChange={(draft) => setNewAccountById((prev) => ({ ...prev, [upload.id]: draft }))}
                      onRescan={() => void onRescan(upload.id, selectedUploadAccount ? Number(selectedUploadAccount) : null)}
                      onConfirm={() => void handleConfirmImport(upload)}
                      formatDateRange={formatStatementDateRange}
                      formatFileSize={formatStatementFileSize}
                    />
                  );
                })()}
              </section>
            ) : null}

            <div className="accumul8-statement-history-list">
              {statementUploads.length === 0 ? (
                <div className="accumul8-statement-history-empty">No statements uploaded yet.</div>
              ) : statementUploads.map((upload) => (
                <Accumul8StatementHistoryCard
                  key={upload.id}
                  busy={busy}
                  ownerUserId={ownerUserId}
                  upload={upload}
                  onRescan={() => void onRescan(upload.id, upload.account_id)}
                  onReview={upload.plan ? () => openReview(upload.id) : undefined}
                  isReviewable={Boolean(upload.plan && (upload.status === 'scanned' || upload.status === 'needs_review' || upload.status === 'failed'))}
                  formatDateRange={formatStatementDateRange}
                  formatFileSize={formatStatementFileSize}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
