import React from 'react';

import {
  Accumul8Account,
  Accumul8BankConnection,
  Accumul8BankConnectionUpsertRequest,
  Accumul8TellerSyncAccountSummary,
  Accumul8TellerSyncResponse,
} from '../../../types/accumul8';
import { Accumul8SyncInstitutionsManager } from '../../accumul8/Accumul8SyncInstitutionsManager';

type SyncProvider = {
  configured: number;
  env: string;
  provider: string;
};

type LastSyncReport = {
  institutionName: string;
  result: Accumul8TellerSyncResponse;
  syncedAt: string;
};

interface Accumul8SyncTabProps {
  bankConnections: Accumul8BankConnection[];
  busy: boolean;
  createBankConnection: (payload: Accumul8BankConnectionUpsertRequest) => Promise<void>;
  deleteBankConnection: (payload: { id: number }) => Promise<unknown>;
  formatAccountBackfillNote: (account: Accumul8Account) => string;
  formatAccountMappingLabel: (account: Accumul8Account) => string;
  formatSyncStatusLabel: (...args: any[]) => string;
  formatSyncStatusMessage: (...args: any[]) => string;
  isTellerRateLimited: (message: string | null | undefined) => boolean;
  lastSyncReport: LastSyncReport | null;
  linkedAccountsByConnectionId: Record<number, Accumul8Account[]>;
  openSyncHelp: () => void;
  runConnectionSync: (connectionId: number, institutionName: string) => Promise<void>;
  runTellerConnect: () => Promise<void>;
  summaryFormatAccountBackfillNote: (account: Accumul8TellerSyncAccountSummary) => string;
  summaryFormatAccountLabel: (account: Accumul8TellerSyncAccountSummary) => string;
  syncProvider: SyncProvider;
  syncingConnectionId: number | null;
  updateBankConnection: (id: number, payload: Accumul8BankConnectionUpsertRequest) => Promise<void>;
}

export function Accumul8SyncTab({
  bankConnections,
  busy,
  createBankConnection,
  deleteBankConnection,
  formatAccountBackfillNote,
  formatAccountMappingLabel,
  formatSyncStatusLabel,
  formatSyncStatusMessage,
  isTellerRateLimited,
  lastSyncReport,
  linkedAccountsByConnectionId,
  openSyncHelp,
  runConnectionSync,
  runTellerConnect,
  summaryFormatAccountBackfillNote,
  summaryFormatAccountLabel,
  syncProvider,
  syncingConnectionId,
  updateBankConnection,
}: Accumul8SyncTabProps) {
  return (
    <React.Suspense fallback={<div className="accumul8-panel text-muted py-4">Loading view...</div>}>
      <div className="accumul8-panel accumul8-panel--viewport-fill">
        <h3>Bank Sync Groundwork</h3>
        <p className="mb-2">Provider: <strong>{syncProvider.provider}</strong> ({syncProvider.env}). Configuration status: <strong>{syncProvider.configured ? 'Configured' : 'Missing API keys'}</strong>.</p>
        <div className="d-flex gap-2 flex-wrap mb-3">
          <button type="button" className="btn btn-outline-primary" onClick={() => void runTellerConnect()} disabled={busy || !syncProvider.configured}>Connect Bank via Teller</button>
          <button type="button" className="btn btn-outline-secondary" onClick={openSyncHelp}>Show Setup Guide</button>
        </div>
        <Accumul8SyncInstitutionsManager
          bankConnections={bankConnections}
          linkedAccountsByConnectionId={linkedAccountsByConnectionId}
          busy={busy}
          syncingConnectionId={syncingConnectionId}
          onCreate={createBankConnection}
          onUpdate={updateBankConnection}
          onDelete={async (id) => {
            await deleteBankConnection({ id });
          }}
          onSync={runConnectionSync}
          formatAccountMappingLabel={formatAccountMappingLabel}
          formatAccountBackfillNote={formatAccountBackfillNote}
          formatSyncStatusLabel={formatSyncStatusLabel}
          formatSyncStatusMessage={formatSyncStatusMessage}
          isTellerRateLimited={isTellerRateLimited}
        />
        {lastSyncReport ? (
          <div className="accumul8-sync-report mt-3">
            <div className="accumul8-sync-report__header">
              <strong>Last Sync Report:</strong> {lastSyncReport.institutionName} at {lastSyncReport.syncedAt.replace('T', ' ').slice(0, 19)}
            </div>
            <div className="accumul8-sync-report__summary">
              Added {lastSyncReport.result.added}, modified {lastSyncReport.result.modified}, unchanged {lastSyncReport.result.unchanged}, removed {lastSyncReport.result.removed}.
            </div>
            <div className="accumul8-sync-report__accounts">
              {lastSyncReport.result.accounts.length > 0 ? (
                lastSyncReport.result.accounts.map((account) => (
                  <div key={`${account.remote_account_id}-${account.local_account_id}`} className="accumul8-sync-report__account">
                    <div className="accumul8-sync-report__account-title">
                      {summaryFormatAccountLabel(account)}
                    </div>
                    <div className="accumul8-sync-report__account-meta">
                      {account.mapping_action === 'created' ? 'Created' : 'Updated'} local account #{account.local_account_id}: {account.local_account_name || 'Unnamed local account'}
                    </div>
                    {account.history_start_date && account.history_end_date ? (
                      <div className="accumul8-sync-report__account-meta">
                        Teller history returned: {account.history_start_date} to {account.history_end_date}.
                      </div>
                    ) : null}
                    <div className="accumul8-sync-report__account-meta">
                      {summaryFormatAccountBackfillNote(account)}
                    </div>
                    {!account.transactions_supported ? (
                      <div className="accumul8-sync-report__account-meta">
                        Balance access: {account.balances_supported ? 'available' : 'not available'}; details access: {account.details_supported ? 'available' : 'not available'}.
                      </div>
                    ) : null}
                    <div className="accumul8-sync-report__account-meta">
                      Transactions added: {account.transactions_added}; modified: {account.transactions_modified}; unchanged: {account.transactions_unchanged}; removed: {account.transactions_removed}.
                    </div>
                    <div className="accumul8-sync-report__account-meta">
                      Cleanup removed {account.stale_teller_removed} stale Teller row{account.stale_teller_removed === 1 ? '' : 's'} and {account.statement_imports_removed} statement import row{account.statement_imports_removed === 1 ? '' : 's'} inside Teller&apos;s returned history window.
                    </div>
                  </div>
                ))
              ) : (
                <div className="accumul8-sync-empty">No Teller accounts were returned in the most recent sync.</div>
              )}
            </div>
          </div>
        ) : null}
        <p className="small text-muted mb-0">Teller accounts are matched by Teller&apos;s stable account IDs and enrollment IDs. On sync, Accumul8 creates or updates a local account record for each returned Teller account and then attaches transactions to that mapped local account.</p>
      </div>
    </React.Suspense>
  );
}
