import React from 'react';

import { Accumul8StatementUpload, Accumul8Transaction } from '../../types/accumul8';
import { Accumul8StatementHistoryCard } from './Accumul8StatementHistoryCard';
import { Accumul8StatementPickerItem } from './Accumul8StatementPickerItem';
import { formatStatementDateRange, formatStatementFileSize } from './accumul8StatementUtils';
import { StatementLibraryFilter, StatementWorkspaceData } from './accumul8StatementWorkspaceUtils';

interface Accumul8StatementModalLibrarySectionProps {
  busy: boolean;
  filteredLibraryUploads: Accumul8StatementUpload[];
  isAwaitingImportApproval: (upload: Accumul8StatementUpload) => boolean;
  libraryFilter: StatementLibraryFilter;
  libraryQuery: string;
  ownerUserId: number;
  selectedLibraryUpload: Accumul8StatementUpload | null;
  selectedLibraryUploadId: number | null;
  selectedLibraryWorkspace: StatementWorkspaceData | null;
  setLibraryFilter: (filter: StatementLibraryFilter) => void;
  setLibraryQuery: (query: string) => void;
  setSelectedLibraryUploadId: (uploadId: number) => void;
  transactionsById: Record<number, Accumul8Transaction>;
  workspaceByUploadId: Record<number, StatementWorkspaceData>;
  onOpenReview: (uploadId: number) => void;
  onOpenTransaction: (id: number) => void;
  onDeleteTransaction: (id: number, description: string) => void;
  onRescan: (uploadId: number) => void;
  onReconcile: (upload: Accumul8StatementUpload) => void;
}

export function Accumul8StatementModalLibrarySection({
  busy,
  filteredLibraryUploads,
  isAwaitingImportApproval,
  libraryFilter,
  libraryQuery,
  ownerUserId,
  selectedLibraryUpload,
  selectedLibraryUploadId,
  selectedLibraryWorkspace,
  setLibraryFilter,
  setLibraryQuery,
  setSelectedLibraryUploadId,
  transactionsById,
  workspaceByUploadId,
  onOpenReview,
  onOpenTransaction,
  onDeleteTransaction,
  onRescan,
  onReconcile,
}: Accumul8StatementModalLibrarySectionProps) {
  return (
    <section className="accumul8-statement-panel accumul8-statement-workspace-shell">
      <div className="accumul8-statement-section-head">
        <div>
          <strong>Statement library</strong>
          <div className="small text-muted">Filter the archive, select one statement, and inspect its details without expanding every card in the history.</div>
        </div>
      </div>
      <div className="accumul8-statement-library-toolbar">
        <div className="accumul8-statement-chip-row">
          {(['all', 'review', 'processed', 'failed', 'suspicious'] as StatementLibraryFilter[]).map((filter) => (
            <button
              key={filter}
              type="button"
              className={`accumul8-statement-chip accumul8-statement-chip-button${libraryFilter === filter ? ' is-active' : ''}${filter === 'failed' || filter === 'suspicious' ? ' is-warning' : filter === 'processed' ? ' is-processed' : ''}`}
              onClick={() => setLibraryFilter(filter)}
            >
              {filter === 'all' ? 'all statements' : filter}
            </button>
          ))}
        </div>
        <input className="form-control" value={libraryQuery} onChange={(event) => setLibraryQuery(event.target.value)} placeholder="Filter by file name, account, institution, period, or status" />
      </div>
      <div className="accumul8-statement-workspace-grid">
        <div className="accumul8-statement-picker-column">
          <div className="accumul8-statement-picker-list">
            {filteredLibraryUploads.length === 0 ? (
              <div className="accumul8-statement-history-empty">No statements match this filter.</div>
            ) : filteredLibraryUploads.map((upload) => {
              const workspace = selectedLibraryWorkspace && selectedLibraryUpload?.id === upload.id ? selectedLibraryWorkspace : workspaceByUploadId[upload.id];
              return (
                <Accumul8StatementPickerItem
                  key={`library-${upload.id}`}
                  upload={upload}
                  active={selectedLibraryUploadId === upload.id}
                  reviewCount={workspace?.review.length || 0}
                  failedCount={workspace?.failed.length || 0}
                  suspiciousCount={workspace?.suspicious.length || 0}
                  onClick={() => setSelectedLibraryUploadId(upload.id)}
                />
              );
            })}
          </div>
        </div>
        <div className="accumul8-statement-detail-column">
          {selectedLibraryUpload ? (
            <Accumul8StatementHistoryCard
              key={selectedLibraryUpload.id}
              busy={busy}
              ownerUserId={ownerUserId}
              upload={selectedLibraryUpload}
              counts={{
                review: selectedLibraryWorkspace?.review.length || 0,
                imported: selectedLibraryWorkspace?.imported.length || 0,
                duplicates: selectedLibraryWorkspace?.duplicates.length || 0,
                failed: selectedLibraryWorkspace?.failed.length || 0,
                suspicious: selectedLibraryWorkspace?.suspicious.length || 0,
              }}
              transactionsById={transactionsById}
              onRescan={() => onRescan(selectedLibraryUpload.id)}
              onReconcile={() => onReconcile(selectedLibraryUpload)}
              onReview={selectedLibraryUpload.plan ? () => onOpenReview(selectedLibraryUpload.id) : undefined}
              onOpenTransaction={onOpenTransaction}
              onDeleteTransaction={onDeleteTransaction}
              isReviewable={isAwaitingImportApproval(selectedLibraryUpload)}
              formatDateRange={formatStatementDateRange}
              formatFileSize={formatStatementFileSize}
            />
          ) : (
            <div className="accumul8-statement-history-empty">Select a statement to inspect its details.</div>
          )}
        </div>
      </div>
    </section>
  );
}
