import React from 'react';

import { Accumul8StatementUpload, Accumul8Transaction } from '../../types/accumul8';
import { Accumul8StatementHistoryCard } from '../modals/Accumul8StatementHistoryCard';
import { Accumul8StatementPickerItem } from '../modals/Accumul8StatementPickerItem';
import { formatStatementDateRange, formatStatementFileSize } from '../modals/accumul8StatementUtils';
import { StatementWorkspaceData } from '../modals/accumul8StatementWorkspaceUtils';

interface Accumul8StatementsSignalsSectionProps {
  busy: boolean;
  isAwaitingImportApproval: (upload: Accumul8StatementUpload) => boolean;
  ownerUserId: number;
  selectedSignalUpload: Accumul8StatementUpload | null;
  selectedSignalUploadId: number | null;
  selectedSignalWorkspace: StatementWorkspaceData | null;
  setSelectedSignalUploadId: (uploadId: number) => void;
  signalUploads: Accumul8StatementUpload[];
  transactionsById: Record<number, Accumul8Transaction>;
  workspaceByUploadId: Record<number, StatementWorkspaceData>;
  onOpenReview: (uploadId: number, panel: 'failed' | 'suspicious') => void;
  onOpenTransaction: (id: number) => void;
  onDeleteTransaction: (id: number, description: string) => void;
  onRescan: (uploadId: number) => void;
  onReconcile: (upload: Accumul8StatementUpload) => void;
}

export function Accumul8StatementsSignalsSection({
  busy,
  isAwaitingImportApproval,
  ownerUserId,
  selectedSignalUpload,
  selectedSignalUploadId,
  selectedSignalWorkspace,
  setSelectedSignalUploadId,
  signalUploads,
  transactionsById,
  workspaceByUploadId,
  onOpenReview,
  onOpenTransaction,
  onDeleteTransaction,
  onRescan,
  onReconcile,
}: Accumul8StatementsSignalsSectionProps) {
  return (
    <section className="accumul8-statement-panel accumul8-statement-workspace-shell">
      <div className="accumul8-statement-section-head">
        <div>
          <strong>Signals</strong>
        </div>
      </div>
      {signalUploads.length === 0 ? (
        <div className="accumul8-statement-history-empty">No failed or suspicious statement rows are waiting for attention.</div>
      ) : (
        <div className="accumul8-statement-workspace-grid">
          <div className="accumul8-statement-picker-column">
            <div className="accumul8-statement-picker-list">
              {signalUploads.map((upload) => {
                const workspace = selectedSignalWorkspace && selectedSignalUpload?.id === upload.id ? selectedSignalWorkspace : workspaceByUploadId[upload.id];
                return (
                  <Accumul8StatementPickerItem
                    key={`signals-${upload.id}`}
                    upload={upload}
                    active={selectedSignalUploadId === upload.id}
                    reviewCount={workspace?.review.length || 0}
                    failedCount={workspace?.failed.length || 0}
                    suspiciousCount={workspace?.suspicious.length || 0}
                    onClick={() => setSelectedSignalUploadId(upload.id)}
                  />
                );
              })}
            </div>
          </div>
          <div className="accumul8-statement-detail-column">
            {selectedSignalUpload ? (
              <Accumul8StatementHistoryCard
                key={`signal-${selectedSignalUpload.id}`}
                busy={busy}
                ownerUserId={ownerUserId}
                upload={selectedSignalUpload}
                counts={{
                  review: selectedSignalWorkspace?.review.length || 0,
                  imported: selectedSignalWorkspace?.imported.length || 0,
                  duplicates: selectedSignalWorkspace?.duplicates.length || 0,
                  failed: selectedSignalWorkspace?.failed.length || 0,
                  suspicious: selectedSignalWorkspace?.suspicious.length || 0,
                }}
                transactionsById={transactionsById}
                onRescan={() => onRescan(selectedSignalUpload.id)}
                onReconcile={() => onReconcile(selectedSignalUpload)}
                onReview={() => onOpenReview(
                  selectedSignalUpload.id,
                  (selectedSignalWorkspace?.failed.length || 0) > 0 ? 'failed' : 'suspicious',
                )}
                onOpenTransaction={onOpenTransaction}
                onDeleteTransaction={onDeleteTransaction}
                isReviewable={isAwaitingImportApproval(selectedSignalUpload)}
                formatDateRange={formatStatementDateRange}
                formatFileSize={formatStatementFileSize}
              />
            ) : (
              <div className="accumul8-statement-history-empty">Select a signal to inspect its statement details.</div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
