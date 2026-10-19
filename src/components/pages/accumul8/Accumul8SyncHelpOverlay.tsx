import React from 'react';

interface Accumul8SyncHelpOverlayProps {
  onCloseSyncHelp: () => void;
  onOpenStatementImportFallback: () => void;
  syncHelpError: string;
  syncHelpOpen: boolean;
  syncHelpToken: string;
}

export function Accumul8SyncHelpOverlay({
  onCloseSyncHelp,
  onOpenStatementImportFallback,
  syncHelpError,
  syncHelpOpen,
  syncHelpToken,
}: Accumul8SyncHelpOverlayProps) {
  if (!syncHelpOpen) {
    return null;
  }

  return (
    <div className="accumul8-help-overlay" role="dialog" aria-modal="true" aria-label="Plaid setup guide">
      <div className="accumul8-help-modal">
        <div className="d-flex justify-content-between align-items-start mb-2">
          <h4 className="h6 mb-0">Plaid Sync Setup Guide</h4>
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onCloseSyncHelp}>Close</button>
        </div>
        {syncHelpError ? <div className="alert alert-warning py-2"><strong>Current error:</strong> {syncHelpError}</div> : null}
        {syncHelpToken ? <div className="alert alert-success py-2"><strong>Plaid link token loaded:</strong> <code>{syncHelpToken.slice(0, 40)}...</code></div> : null}
        <ol className="mb-2 ps-3">
          <li>Create your Plaid application credentials in <a href="https://dashboard.plaid.com" target="_blank" rel="noreferrer">Plaid Dashboard</a>.</li>
          <li>Save your Plaid Client ID, Secret, and environment in Settings &gt; Plaid Configuration. Do not paste Plaid keys into Teller fields.</li>
          <li>Allow the redirect URI <code>https://catn8.us/accumul8/</code> and register OAuth institutions you use, including Barclays and Navy Federal.</li>
          <li>Click <strong>Connect Bank via Plaid</strong> in this tab, or <strong>Reconnect via Plaid</strong> on an existing connection.</li>
          <li>Complete Plaid Link and authorize your institution.</li>
          <li>Accumul8 will automatically exchange the public token, save the connection, and sync transactions.</li>
          <li>After that, Plaid calls the site webhook when new transactions are ready, and housekeeping syncs every active Plaid connection at least twice a day. The status badge on this tab turns red when a bank needs <strong>Reconnect via Plaid</strong>.</li>
        </ol>
        <div className="alert alert-info py-2">
          Teller shut down its API, so retired Teller connections stay on file for history and do not sync until you reconnect them with Plaid. If a bank does not expose accounts through Plaid Link, import those accounts from the Bank Statements tab instead.
          <div className="mt-2">
            <button type="button" className="btn btn-sm btn-outline-primary" onClick={onOpenStatementImportFallback}>Go To Bank Statements</button>
          </div>
        </div>
        <div className="small">
          Quick references: <a href="https://plaid.com/docs/link/" target="_blank" rel="noreferrer">Plaid Link</a> | <a href="https://plaid.com/docs/api/products/transactions/" target="_blank" rel="noreferrer">Transactions</a>
        </div>
      </div>
    </div>
  );
}
