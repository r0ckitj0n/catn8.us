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
    <div className="accumul8-help-overlay" role="dialog" aria-modal="true" aria-label="Teller setup guide">
      <div className="accumul8-help-modal">
        <div className="d-flex justify-content-between align-items-start mb-2">
          <h4 className="h6 mb-0">Teller Sync Setup Guide</h4>
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onCloseSyncHelp}>Close</button>
        </div>
        {syncHelpError ? <div className="alert alert-warning py-2"><strong>Current error:</strong> {syncHelpError}</div> : null}
        {syncHelpToken ? <div className="alert alert-success py-2"><strong>Teller application loaded:</strong> <code>{syncHelpToken.slice(0, 40)}...</code></div> : null}
        <ol className="mb-2 ps-3">
          <li>Create your Teller application credentials in <a href="https://teller.io/dashboard" target="_blank" rel="noreferrer">Teller Dashboard</a>.</li>
          <li>Save your Teller Application ID, certificate PEM, private key PEM, and environment in Settings.</li>
          <li>Click <strong>Connect Bank via Teller</strong> in this tab.</li>
          <li>Complete Teller Connect and authorize your institution.</li>
          <li>Accumul8 will automatically exchange token, save the connection, and sync transactions.</li>
        </ol>
        <div className="alert alert-info py-2">
          If Teller shows a message like &quot;no suitable accounts,&quot; the institution/login did not expose any eligible accounts for Teller sync. Accumul8 cannot force that connection, so import those accounts from the Bank Statements tab instead.
          <div className="mt-2">
            <strong>Fifth Third / Truist guidance:</strong> Chase credit cards can sync through Teller, but some Fifth Third and Truist credit-card logins are still getting rejected inside Teller Connect before Accumul8 receives any account metadata. When that happens, statement import is the reliable fallback path.
          </div>
          <div className="mt-2">
            <button type="button" className="btn btn-sm btn-outline-primary" onClick={onOpenStatementImportFallback}>Go To Bank Statements</button>
          </div>
        </div>
        <div className="small">
          Quick references: <a href="https://teller.io/docs/connect" target="_blank" rel="noreferrer">Teller Connect</a> | <a href="https://teller.io/docs/api" target="_blank" rel="noreferrer">Teller API</a>
        </div>
      </div>
    </div>
  );
}
