import React from 'react';

import { Accumul8ModalHelp } from '../modals/Accumul8ModalHelp';
import { Accumul8StatementArchiveDialog } from '../modals/Accumul8StatementArchiveDialog';
import { Accumul8StatementModalInboxSection } from '../modals/Accumul8StatementModalInboxSection';
import { Accumul8StatementModalLibrarySection } from '../modals/Accumul8StatementModalLibrarySection';
import { Accumul8StatementModalSearchSection } from '../modals/Accumul8StatementModalSearchSection';
import { WebpImage } from '../common/WebpImage';
import './Accumul8StatementsPanel.css';
import { Accumul8StatementsCleanupModal } from './Accumul8StatementsCleanupModal';
import { Accumul8StatementsPanelOverview } from './Accumul8StatementsPanelOverview';
import { Accumul8StatementsSignalsSection } from './Accumul8StatementsSignalsSection';
import { Accumul8StatementsPanelProps } from './accumul8StatementsPanelTypes';
import { useAccumul8StatementsPanelActions } from './useAccumul8StatementsPanelActions';
import { useAccumul8StatementsPanelState } from './useAccumul8StatementsPanelState';

export function Accumul8StatementsPanel({
  busy,
  statementUploads,
  archivedStatementUploads,
  statementAuditRuns,
  transactions,
  ownerUserId,
  onUpload,
  onRescan,
  onUpdateMetadata,
  onArchiveStatement,
  onRestoreStatement,
  onDeleteArchivedStatement,
  onConfirmImport,
  onReconcile,
  onImportReviewRow,
  onLinkReviewRow,
  onSearch,
  onAuditStatements,
  onAuditImportedCleanup,
  onPurgeImportedCleanup,
  onPurgeAllImportedTransactions,
  onPurgeAllStatementUploads,
  onOpenTransaction,
  onDeleteTransaction,
}: Accumul8StatementsPanelProps) {
  const state = useAccumul8StatementsPanelState({
    ownerUserId,
    statementAuditRuns,
    statementUploads,
    transactions,
  });
  const actions = useAccumul8StatementsPanelActions({
    files: state.files,
    isAwaitingImportApproval: state.isAwaitingImportApproval,
    onArchiveStatement,
    onAuditImportedCleanup,
    onAuditStatements,
    onConfirmImport,
    onDeleteArchivedStatement,
    onImportReviewRow,
    onLinkReviewRow,
    onPurgeAllImportedTransactions,
    onPurgeAllStatementUploads,
    onPurgeImportedCleanup,
    onReconcile,
    onRescan,
    onRestoreStatement,
    onSearch,
    onUpload,
    pendingUploads: state.pendingUploads,
    searchQuery: state.searchQuery,
    setActiveSection: state.setActiveSection,
    setArchiveDialogOpen: state.setArchiveDialogOpen,
    setAuditBusy: state.setAuditBusy,
    setCleanupBusy: state.setCleanupBusy,
    setCleanupModalOpen: state.setCleanupModalOpen,
    setCleanupMode: state.setCleanupMode,
    setCleanupReport: state.setCleanupReport,
    setCleanupSelectedIds: state.setCleanupSelectedIds,
    setDismissedRowKeysByUpload: state.setDismissedRowKeysByUpload,
    setFiles: state.setFiles,
    setLatestImportResult: state.setLatestImportResult,
    setSearchBusy: state.setSearchBusy,
    setSearchResults: state.setSearchResults,
    setSelectedLibraryUploadId: state.setSelectedLibraryUploadId,
    setSelectedReviewUploadId: state.setSelectedReviewUploadId,
    setSelectedSignalUploadId: state.setSelectedSignalUploadId,
    setSelectedWorkspacePanel: state.setSelectedWorkspacePanel,
    statementKind: state.statementKind,
  });

  const latestImportResultSummary = state.latestImportResult ? (
    <section className="accumul8-statement-history-card accumul8-statement-result-card is-inline">
      <strong>Latest import result</strong>
      <div className="small text-muted">{state.latestImportResult.filename}</div>
      <div className="accumul8-statement-chip-row">
        <span className="accumul8-statement-chip is-processed">{state.latestImportResult.result?.imported_count || 0} imported</span>
        <span className="accumul8-statement-chip">{state.latestImportResult.result?.duplicate_count || 0} duplicates skipped</span>
        <span className={`accumul8-statement-chip${(state.latestImportResult.result?.failed_count || 0) > 0 ? ' is-warning' : ''}`}>{state.latestImportResult.result?.failed_count || 0} failed</span>
      </div>
    </section>
  ) : null;
  const latestAuditRunSummary = state.latestAuditRun ? (
    <section className="accumul8-statement-history-card accumul8-statement-result-card is-inline">
      <strong>Latest audit</strong>
      <div className="small text-muted">{state.latestAuditRun.created_at || 'Saved audit run'}</div>
      <div className="accumul8-statement-chip-row">
        <span className="accumul8-statement-chip is-processed">{state.latestAuditRun.passed_count} passed</span>
        <span className="accumul8-statement-chip">{state.latestAuditRun.warning_count} warning</span>
        <span className={`accumul8-statement-chip${state.latestAuditRun.failed_count > 0 ? ' is-warning' : ''}`}>{state.latestAuditRun.failed_count} failed</span>
      </div>
      <div className="small text-muted">{state.latestAuditRun.summary_text}</div>
    </section>
  ) : null;

  return (
    <section className="accumul8-statements-page">
      {busy ? (
        <div className="accumul8-statement-busy-overlay" role="status" aria-live="polite" aria-label={state.auditBusy ? 'Statement audit in progress' : state.cleanupBusy ? (state.cleanupMode === 'files' ? 'Statement file deletion in progress' : 'Imported transaction cleanup in progress') : 'Statement scan in progress'}>
          <div className="accumul8-statement-busy-card">
            <WebpImage className="accumul8-statement-busy-logo" src="/images/catn8_logo.png" alt="" aria-hidden="true" />
            <div className="accumul8-statement-busy-text">{state.auditBusy ? 'Auditing statements and reconciling the ledger...' : state.cleanupBusy ? (state.cleanupMode === 'files' ? 'Deleting saved bank statement files...' : 'Reviewing imported transactions for cleanup...') : 'Scanning statement...'}</div>
          </div>
        </div>
      ) : null}

      <div className="accumul8-statements-page-header">
        <h2 className="accumul8-statements-page-title mb-0">Bank Statements</h2>
        <div className="accumul8-statement-modal-header-actions">
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => void actions.handleBatchProcessInbox()} disabled={busy || state.pendingUploads.length === 0} title={`Batch process inbox (${state.pendingUploads.length})`} aria-label={`Batch process inbox (${state.pendingUploads.length})`}>⚙️</button>
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => void actions.handleAuditStatements()} disabled={busy} title="Catalog missing statements and reconcile the ledger" aria-label="Catalog missing statements and reconcile the ledger">🔎</button>
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => void actions.handleAuditImportedCleanup()} disabled={busy} title="Audit imported transaction cleanup candidates" aria-label="Audit imported transaction cleanup candidates">🧽</button>
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => void actions.handlePurgeAllImportedTransactions()} disabled={busy} title="Purge all bank-statement-imported ledger transactions" aria-label="Purge all bank-statement-imported ledger transactions">🧹</button>
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => void actions.handlePurgeAllStatementUploads()} disabled={busy || statementUploads.length + archivedStatementUploads.length === 0} title="Delete all saved bank statement files" aria-label="Delete all saved bank statement files">🗑️</button>
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => state.setArchiveDialogOpen(true)} disabled={busy} title={`Archived statements (${archivedStatementUploads.length})`} aria-label={`Open archived statements (${archivedStatementUploads.length})`}>🗃️</button>
          <Accumul8ModalHelp buttonLabel="Statement upload help" buttonTitle="Statement upload help" modalTitle="Statement Upload Help" parentOpen>
            <div className="accumul8-statement-hero">
              <div className="accumul8-statement-hero-card">
                <strong>Scan first, import second</strong>
                <p className="mb-0">Each file is OCR scanned, cataloged, and converted into an AI import plan first. Nothing reaches the ledger until you approve the plan.</p>
              </div>
              <div className="accumul8-statement-hero-card">
                <strong>Review and retry</strong>
                <p className="mb-0">You can re-scan any saved statement, let AI target the right account automatically, and review imported, duplicate, and failed rows afterward.</p>
              </div>
            </div>
          </Accumul8ModalHelp>
        </div>
      </div>

      <Accumul8StatementsCleanupModal
        busy={busy}
        cleanupModalOpen={state.cleanupModalOpen}
        cleanupReport={state.cleanupReport}
        cleanupSelectedIds={state.cleanupSelectedIds}
        recommendedCleanupIds={state.recommendedCleanupIds}
        setCleanupModalOpen={state.setCleanupModalOpen}
        setCleanupSelectedIds={state.setCleanupSelectedIds}
        onPurgeImportedCleanup={(cleanupSelectedIds) => { void actions.handlePurgeImportedCleanup(cleanupSelectedIds); }}
      />

      <div className="accumul8-statements-page-body">
        <div className="accumul8-statement-shell">
          <Accumul8StatementsPanelOverview
            activeSection={state.activeSection}
            busy={busy}
            files={state.files}
            latestAuditRun={state.latestAuditRun}
            latestImportResult={state.latestImportResult}
            overview={state.overview}
            searchResultsCount={state.searchResults.length}
            setActiveSection={state.setActiveSection}
            setFiles={state.setFiles}
            setStatementKind={state.setStatementKind}
            statementKind={state.statementKind}
            statementUploadsCount={statementUploads.length}
            onSubmit={actions.handleSubmit}
          />

          {state.activeSection === 'search' ? (
            <Accumul8StatementModalSearchSection
              busy={busy}
              ownerUserId={ownerUserId}
              searchBusy={state.searchBusy}
              searchQuery={state.searchQuery}
              searchResults={state.searchResults}
              setSearchQuery={state.setSearchQuery}
              onSearch={actions.handleSearch}
            />
          ) : null}

          {state.activeSection === 'inbox' ? (
            <Accumul8StatementModalInboxSection
              activeReviewUpload={state.activeReviewUpload}
              activeWorkspace={state.activeWorkspace}
              busy={busy}
              latestAuditRunSummary={latestAuditRunSummary}
              latestImportResultSummary={latestImportResultSummary}
              onAcceptRow={actions.acceptWorkspaceRow}
              onArchiveUpload={(upload) => { void actions.archiveActiveReviewUpload(upload); }}
              onConfirmImport={(upload) => { void actions.handleConfirmImport(upload); }}
              onDeleteTransaction={onDeleteTransaction}
              onDismissRow={actions.dismissWorkspaceRow}
              onHandleReconcile={(upload) => { void actions.handleReconcile(upload); }}
              onLinkRow={actions.linkWorkspaceRow}
              onOpenReview={actions.openReview}
              onOpenTransaction={onOpenTransaction}
              onOpenWorkspace={actions.openWorkspace}
              onRescan={(uploadId) => { void onRescan(uploadId, null); }}
              ownerUserId={ownerUserId}
              pendingUploads={state.pendingUploads}
              selectedWorkspacePanel={state.selectedWorkspacePanel}
              setSelectedWorkspacePanel={state.setSelectedWorkspacePanel}
              workspaceByUploadId={state.workspaceByUploadId}
            />
          ) : null}

          {state.activeSection === 'library' ? (
            <Accumul8StatementModalLibrarySection
              busy={busy}
              filteredLibraryUploads={state.filteredLibraryUploads}
              isAwaitingImportApproval={state.isAwaitingImportApproval}
              libraryFilter={state.libraryFilter}
              libraryQuery={state.libraryQuery}
              ownerUserId={ownerUserId}
              selectedLibraryUpload={state.selectedLibraryUpload}
              selectedLibraryUploadId={state.selectedLibraryUploadId}
              selectedLibraryWorkspace={state.selectedLibraryWorkspace}
              setLibraryFilter={state.setLibraryFilter}
              setLibraryQuery={state.setLibraryQuery}
              setSelectedLibraryUploadId={(uploadId) => state.setSelectedLibraryUploadId(uploadId)}
              transactionsById={state.transactionsById}
              workspaceByUploadId={state.workspaceByUploadId}
              onOpenReview={actions.openReview}
              onOpenTransaction={onOpenTransaction}
              onDeleteTransaction={onDeleteTransaction}
              onRescan={(uploadId) => { void onRescan(uploadId, null); }}
              onReconcile={(upload) => { void actions.handleReconcile(upload); }}
            />
          ) : null}

          {state.activeSection === 'signals' ? (
            <Accumul8StatementsSignalsSection
              busy={busy}
              isAwaitingImportApproval={state.isAwaitingImportApproval}
              ownerUserId={ownerUserId}
              selectedSignalUpload={state.selectedSignalUpload}
              selectedSignalUploadId={state.selectedSignalUploadId}
              selectedSignalWorkspace={state.selectedSignalWorkspace}
              setSelectedSignalUploadId={(uploadId) => state.setSelectedSignalUploadId(uploadId)}
              signalUploads={state.signalUploads}
              transactionsById={state.transactionsById}
              workspaceByUploadId={state.workspaceByUploadId}
              onOpenReview={(uploadId, panel) => actions.openWorkspace(uploadId, panel)}
              onOpenTransaction={onOpenTransaction}
              onDeleteTransaction={onDeleteTransaction}
              onRescan={(uploadId) => { void onRescan(uploadId, null); }}
              onReconcile={(upload) => { void actions.handleReconcile(upload); }}
            />
          ) : null}
        </div>
      </div>

      <Accumul8StatementArchiveDialog
        open={state.archiveDialogOpen}
        busy={busy}
        ownerUserId={ownerUserId}
        uploads={archivedStatementUploads}
        onClose={() => state.setArchiveDialogOpen(false)}
        onRestore={(upload) => { void actions.restoreArchivedUpload(upload); }}
        onEdit={(upload) => { void actions.restoreArchivedUpload(upload, true); }}
        onDelete={(upload) => { void actions.deleteArchivedUpload(upload); }}
      />
    </section>
  );
}
