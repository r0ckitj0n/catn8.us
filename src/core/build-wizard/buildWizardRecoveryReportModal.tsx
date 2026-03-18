import React from 'react';

import { StandardIconButton } from '../../components/common/StandardIconButton';

interface BuildWizardRecoveryReportModalProps {
  fetchSingletreeRecoveryStatus: (jobId: string) => Promise<unknown>;
  onClose: () => void;
  onToast?: (t: { tone: 'success' | 'error' | 'info' | 'warning'; message: string }) => void;
  open: boolean;
  recoveryJobId: string;
  recoveryPolling: boolean;
  recoveryReportJson: string;
  recoveryStagedCount: number;
  recoveryStagedRoot: string;
  recoveryStatus: string;
  setRecoveryJobId: React.Dispatch<React.SetStateAction<string>>;
  setRecoveryPolling: React.Dispatch<React.SetStateAction<boolean>>;
  setRecoveryReportJson: React.Dispatch<React.SetStateAction<string>>;
  setRecoveryStatus: React.Dispatch<React.SetStateAction<string>>;
}

export function BuildWizardRecoveryReportModal({
  fetchSingletreeRecoveryStatus,
  onClose,
  onToast,
  open,
  recoveryJobId,
  recoveryPolling,
  recoveryReportJson,
  recoveryStagedCount,
  recoveryStagedRoot,
  recoveryStatus,
  setRecoveryJobId,
  setRecoveryPolling,
  setRecoveryReportJson,
  setRecoveryStatus,
}: BuildWizardRecoveryReportModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="build-wizard-doc-manager" onClick={onClose}>
      <div className="build-wizard-doc-manager-inner build-wizard-recovery-modal" onClick={(e) => e.stopPropagation()}>
        <div className="build-wizard-doc-manager-head">
          <h3>Singletree Recovery Report</h3>
          <div className="build-wizard-doc-manager-actions">
            <button
              className="btn btn-outline-primary btn-sm"
              onClick={async () => {
                if (!recoveryJobId || recoveryPolling) {
                  return;
                }
                setRecoveryPolling(true);
                try {
                  const status = await fetchSingletreeRecoveryStatus(recoveryJobId) as { status?: string; completed?: number } | null;
                  if (status) {
                    setRecoveryStatus(String(status.status || ''));
                    setRecoveryReportJson(JSON.stringify(status, null, 2));
                    if (Number(status.completed || 0) === 1 || status.status === 'completed' || status.status === 'failed') {
                      setRecoveryJobId('');
                    }
                  }
                } finally {
                  setRecoveryPolling(false);
                }
              }}
              disabled={!recoveryJobId || recoveryPolling}
            >
              {recoveryPolling ? 'Checking...' : 'Refresh Status'}
            </button>
            <button
              className="btn btn-outline-secondary btn-sm"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(recoveryReportJson || '');
                  onToast?.({ tone: 'success', message: 'Recovery report copied.' });
                } catch (_) {
                  onToast?.({ tone: 'warning', message: 'Could not copy to clipboard.' });
                }
              }}
              disabled={!recoveryReportJson}
            >
              Copy JSON
            </button>
            <StandardIconButton
              iconKey="close"
              ariaLabel="Close recovery report"
              title="Close"
              className="btn btn-outline-secondary btn-sm catn8-build-wizard-close-btn"
              onClick={onClose}
            />
          </div>
        </div>
        {recoveryStagedRoot ? (
          <div className="build-wizard-recovery-status">
            Staged Files: {recoveryStagedCount} | Source Root: {recoveryStagedRoot}
          </div>
        ) : (
          <div className="build-wizard-recovery-status">
            No staged files yet. Upload source files from your Mac, then run Dry Run/Apply.
          </div>
        )}
        {recoveryStatus ? (
          <div className="build-wizard-recovery-status">
            Status: {recoveryStatus}{recoveryJobId ? ` (job ${recoveryJobId})` : ''}
          </div>
        ) : null}
        {recoveryReportJson ? (
          <pre className="build-wizard-recovery-json">{recoveryReportJson}</pre>
        ) : (
          <div className="build-wizard-muted">No recovery report yet. Run Dry Run or Apply first.</div>
        )}
      </div>
    </div>
  );
}
