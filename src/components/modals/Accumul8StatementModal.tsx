import React from 'react';
import { useBootstrapModal } from '../../hooks/useBootstrapModal';
import {
  Accumul8StatementArchiveResponse,
  Accumul8StatementArchiveSection,
  Accumul8StatementAuditRequest,
  Accumul8StatementAuditRun,
  Accumul8StatementImportResult,
  Accumul8StatementKind,
  Accumul8StatementRestoreResponse,
  Accumul8StatementSearchResult,
  Accumul8StatementUpload,
  Accumul8Transaction,
} from '../../types/accumul8';
import { Accumul8ModalHelp } from './Accumul8ModalHelp';
import { Accumul8StatementArchiveDialog } from './Accumul8StatementArchiveDialog';
import { ModalCloseIconButton } from '../common/ModalCloseIconButton';
import { WebpImage } from '../common/WebpImage';
import { Accumul8StatementModalInboxSection } from './Accumul8StatementModalInboxSection';
import { Accumul8StatementModalLibrarySection } from './Accumul8StatementModalLibrarySection';
import { Accumul8StatementModalOverview } from './Accumul8StatementModalOverview';
import { Accumul8StatementModalSearchSection } from './Accumul8StatementModalSearchSection';
import { useAccumul8StatementModalActions } from './useAccumul8StatementModalActions';
import { useAccumul8StatementModalState } from './useAccumul8StatementModalState';
import './Accumul8StatementModal.css';
interface Accumul8StatementModalProps {
  open: boolean;
  busy: boolean;
  statementUploads: Accumul8StatementUpload[];
  archivedStatementUploads: Accumul8StatementUpload[];
  statementAuditRuns?: Accumul8StatementAuditRun[];
  transactions: Accumul8Transaction[];
  ownerUserId: number;
  onClose: () => void;
  onUpload: (formData: FormData) => Promise<Accumul8StatementUpload | undefined>;
  onRescan: (id: number, accountId?: number | null) => Promise<Accumul8StatementUpload | undefined>;
  onArchiveStatement: (payload: { id: number; archived_from_section?: Accumul8StatementArchiveSection }) => Promise<Accumul8StatementArchiveResponse>;
  onRestoreStatement: (id: number) => Promise<Accumul8StatementRestoreResponse>;
  onDeleteArchivedStatement: (id: number) => Promise<{ success: boolean; id: number }>;
  onConfirmImport: (payload: {
    id: number;
  }) => Promise<{ success: boolean; upload: Accumul8StatementUpload; import_result: Accumul8StatementImportResult | null }>;
  onReconcile?: (payload: {
    id: number;
  }) => Promise<{ success: boolean; upload: Accumul8StatementUpload }>;
  onImportReviewRow: (payload: {
    id: number;
    row_index: number;
    transaction_date?: string;
    description?: string;
    memo?: string;
    amount?: number;
    account_id?: number | null;
  }) => Promise<{ success: boolean; upload: Accumul8StatementUpload; transaction_id: number }>;
  onLinkReviewRow: (payload: {
    id: number;
    row_index: number;
    transaction_id: number;
  }) => Promise<{ success: boolean; upload: Accumul8StatementUpload; linked_transaction_id: number }>;
  onSearch: (query: string) => Promise<Accumul8StatementSearchResult[]>;
  onAuditStatements?: (payload: Accumul8StatementAuditRequest) => Promise<{ success: boolean; run: Accumul8StatementAuditRun }>;
  onOpenTransaction: (id: number) => void;
  onDeleteTransaction: (id: number, description: string) => void;
}
export function Accumul8StatementModal({
  open,
  busy,
  statementUploads,
  archivedStatementUploads,
  statementAuditRuns = [],
  transactions,
  ownerUserId,
  onClose,
  onUpload,
  onRescan,
  onArchiveStatement,
  onRestoreStatement,
  onDeleteArchivedStatement,
  onConfirmImport,
  onReconcile,
  onImportReviewRow,
  onLinkReviewRow,
  onSearch,
  onAuditStatements,
  onOpenTransaction,
  onDeleteTransaction,
}: Accumul8StatementModalProps) {
  const { modalRef, modalApiRef } = useBootstrapModal(onClose);
  const state = useAccumul8StatementModalState({ modalApiRef, open, ownerUserId, statementAuditRuns, statementUploads, transactions });
  const actions = useAccumul8StatementModalActions({
    files: state.files,
    isAwaitingImportApproval: state.isAwaitingImportApproval,
    onArchiveStatement,
    onAuditStatements,
    onConfirmImport,
    onDeleteArchivedStatement,
    onImportReviewRow,
    onLinkReviewRow,
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
    setDismissedRowKeysByUpload: state.setDismissedRowKeysByUpload,
    setFiles: state.setFiles,
    setLatestImportResult: state.setLatestImportResult,
    setSearchBusy: state.setSearchBusy,
    setSearchResults: state.setSearchResults,
    setSelectedLibraryUploadId: state.setSelectedLibraryUploadId,
    setSelectedReviewUploadId: state.setSelectedReviewUploadId,
    setSelectedWorkspacePanel: state.setSelectedWorkspacePanel,
    statementKind: state.statementKind,
  });

  return (
    <div className="modal fade accumul8-contact-modal accumul8-statement-modal" tabIndex={-1} aria-hidden="true" ref={modalRef}>
      <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-xl">
        <div className="modal-content">
          {busy ? (
            <div className="accumul8-statement-busy-overlay" role="status" aria-live="polite" aria-label={state.auditBusy ? 'Statement audit in progress' : 'Statement scan in progress'}>
              <div className="accumul8-statement-busy-card">
                <WebpImage
                  className="accumul8-statement-busy-logo"
                  src="/images/catn8_logo.png"
                  alt=""
                  aria-hidden="true"
                />
                <div className="accumul8-statement-busy-text">{state.auditBusy ? 'Auditing statements and reconciling the ledger...' : 'Scanning statement...'}</div>
              </div>
            </div>
          ) : null}
          <div className="modal-header">
            <h5 className="modal-title">Bank Statements</h5>
            <div className="accumul8-statement-modal-header-actions">
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={() => void actions.handleBatchProcessInbox()}
                disabled={busy || state.pendingUploads.length === 0}
                title={`Batch process inbox (${state.pendingUploads.length})`}
                aria-label={`Batch process inbox (${state.pendingUploads.length})`}
              >
                ⚙️
              </button>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={() => void actions.handleAuditStatements()}
                disabled={busy || !onAuditStatements}
                title="Catalog missing statements and reconcile the ledger"
                aria-label="Catalog missing statements and reconcile the ledger"
              >
                🔎
              </button>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={() => state.setArchiveDialogOpen(true)}
                disabled={busy}
                title={`Archived statements (${archivedStatementUploads.length})`}
                aria-label={`Open archived statements (${archivedStatementUploads.length})`}
              >
                🗃️
              </button>
              <Accumul8ModalHelp buttonLabel="Statement upload help" buttonTitle="Statement upload help" modalTitle="Statement Upload Help" parentOpen={open}>
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
              <ModalCloseIconButton />
            </div>
          </div>
          <div className="modal-body">
            <div className="accumul8-statement-shell">
              <Accumul8StatementModalOverview
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
                  latestImportResultSummary={null}
                  latestAuditRunSummary={null}
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
                  setSelectedLibraryUploadId={state.setSelectedLibraryUploadId}
                  transactionsById={state.transactionsById}
                  workspaceByUploadId={state.workspaceByUploadId}
                  onOpenReview={actions.openReview}
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
            onRestore={(upload) => void actions.restoreArchivedUpload(upload)}
            onEdit={(upload) => void actions.restoreArchivedUpload(upload, true)}
            onDelete={(upload) => void actions.deleteArchivedUpload(upload)}
          />
        </div>
      </div>
    </div>
  );
}
