import React from 'react';

interface GcpServiceAccountSectionProps {
  hasMysteryServiceAccount: number;
  mysteryServiceAccountJson: string;
  setMysteryServiceAccountJson: (v: string) => void;
  busy: boolean;
  lastGcpServiceAccountTest: string;
  testMysteryGcpServiceAccount: () => Promise<void>;
}

export function GcpServiceAccountSection({
  hasMysteryServiceAccount,
  mysteryServiceAccountJson,
  setMysteryServiceAccountJson,
  busy,
  lastGcpServiceAccountTest,
  testMysteryGcpServiceAccount
}: GcpServiceAccountSectionProps) {
  return (
    <div className="border rounded p-3 h-100">
      <div className="fw-semibold mb-2">Google Cloud Service Account {hasMysteryServiceAccount ? '(saved)' : '(not set)'}</div>
      <label className="form-label" htmlFor="mystery-gcp-service-account-json">Service account JSON</label>
      <textarea
        id="mystery-gcp-service-account-json"
        className="form-control"
        rows={10}
        value={mysteryServiceAccountJson}
        onChange={(e) => setMysteryServiceAccountJson(e.target.value)}
        disabled={busy}
        placeholder={hasMysteryServiceAccount ? 'Paste JSON to replace existing value' : 'Paste service account JSON'}
        autoComplete="off"
      />
      <div className="d-flex justify-content-end align-items-center gap-2 mt-2">
        {lastGcpServiceAccountTest && (
          <div className="text-muted small">Last result: {lastGcpServiceAccountTest}</div>
        )}
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary"
          disabled={busy || !hasMysteryServiceAccount}
          onClick={testMysteryGcpServiceAccount}
        >
          Test service account
        </button>
      </div>
    </div>
  );
}
