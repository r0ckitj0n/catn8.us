import React from 'react';

import { Accumul8StatementAuditRun, Accumul8StatementImportResult, Accumul8StatementKind } from '../../types/accumul8';
import { StatementModalSection } from './accumul8StatementWorkspaceUtils';

interface Accumul8StatementModalOverviewProps {
  activeSection: StatementModalSection;
  busy: boolean;
  files: File[];
  latestAuditRun: Accumul8StatementAuditRun | null;
  latestImportResult: { filename: string; result: Accumul8StatementImportResult | null; uploadId: number } | null;
  overview: { failed: number; imported: number; review: number; suspicious: number };
  searchResultsCount: number;
  setActiveSection: (section: StatementModalSection) => void;
  setFiles: (files: File[]) => void;
  setStatementKind: (kind: Accumul8StatementKind) => void;
  statementKind: Accumul8StatementKind;
  statementUploadsCount: number;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}

export function Accumul8StatementModalOverview({
  activeSection,
  busy,
  files,
  latestAuditRun,
  latestImportResult,
  overview,
  searchResultsCount,
  setActiveSection,
  setFiles,
  setStatementKind,
  statementKind,
  statementUploadsCount,
  onSubmit,
}: Accumul8StatementModalOverviewProps) {
  return (
    <>
      <section className="accumul8-statement-summary-grid">
        <button type="button" className={`accumul8-statement-summary-card${activeSection === 'inbox' ? ' is-active' : ''}`} onClick={() => setActiveSection('inbox')}>
          <span className="accumul8-statement-summary-label">Inbox</span>
          <strong>{overview.review}</strong>
          <span className="small text-muted">Statements waiting on review/import</span>
        </button>
        <button type="button" className={`accumul8-statement-summary-card${activeSection === 'library' ? ' is-active' : ''}`} onClick={() => setActiveSection('library')}>
          <span className="accumul8-statement-summary-label">Library</span>
          <strong>{statementUploadsCount}</strong>
          <span className="small text-muted">Scanned statements in the archive</span>
        </button>
        <button type="button" className={`accumul8-statement-summary-card${activeSection === 'search' ? ' is-active' : ''}`} onClick={() => setActiveSection('search')}>
          <span className="accumul8-statement-summary-label">Search</span>
          <strong>{searchResultsCount}</strong>
          <span className="small text-muted">Current content matches</span>
        </button>
        <div className="accumul8-statement-summary-card">
          <span className="accumul8-statement-summary-label">Signals</span>
          <strong>{overview.failed + overview.suspicious}</strong>
          <span className="small text-muted">{overview.failed} failed rows · {overview.suspicious} suspicious flags</span>
        </div>
      </section>

      <section className="accumul8-statement-top-grid">
        <div className="accumul8-statement-upload-card">
          <div className="accumul8-statement-section-head">
            <div>
              <strong>Scan new statements</strong>
              <div className="small text-muted">Upload files once, then work the review queue instead of searching through the full history.</div>
            </div>
          </div>
          <form className="row g-3" onSubmit={onSubmit}>
            <div className="col-md-4">
              <label className="form-label" htmlFor="accumul8-statement-kind">Statement type</label>
              <select id="accumul8-statement-kind" className="form-select" value={statementKind} onChange={(event) => setStatementKind(event.target.value as Accumul8StatementKind)} disabled={busy}>
                <option value="bank_account">Bank account</option>
                <option value="credit_card">Credit card</option>
                <option value="loan">Car loan / installment</option>
                <option value="mortgage">Mortgage</option>
                <option value="other">Other</option>
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
        </div>

        {latestImportResult ? (
          <section className="accumul8-statement-history-card accumul8-statement-result-card">
            <strong>Latest import result</strong>
            <div className="small text-muted mb-2">{latestImportResult.filename}</div>
            <div className="accumul8-statement-chip-row">
              <span className="accumul8-statement-chip is-processed">{latestImportResult.result?.imported_count || 0} imported</span>
              <span className="accumul8-statement-chip">{latestImportResult.result?.duplicate_count || 0} duplicates skipped</span>
              <span className={`accumul8-statement-chip${(latestImportResult.result?.failed_count || 0) > 0 ? ' is-warning' : ''}`}>{latestImportResult.result?.failed_count || 0} failed</span>
            </div>
            {latestImportResult.result?.successful_rows?.length ? <div className="small text-muted">Imported: {latestImportResult.result.successful_rows.map((row) => `${row.transaction_date || ''} ${row.description || ''}`.trim()).slice(0, 4).join(' | ')}</div> : null}
            {latestImportResult.result?.failed_rows?.length ? <div className="accumul8-statement-error">Failed: {latestImportResult.result.failed_rows.map((row) => row.reason || 'Unknown error').slice(0, 3).join(' | ')}</div> : null}
          </section>
        ) : (
          <section className="accumul8-statement-history-card accumul8-statement-result-card">
            <strong>How this works</strong>
            <div className="small text-muted">Use Inbox for items that still need decisions. Use Library to browse older statements by filter and open one statement at a time instead of expanding a long list.</div>
          </section>
        )}
        {latestAuditRun ? (
          <section className="accumul8-statement-history-card accumul8-statement-result-card">
            <strong>Latest audit</strong>
            <div className="small text-muted mb-2">{latestAuditRun.created_at || 'Saved audit run'}</div>
            <div className="accumul8-statement-chip-row">
              <span className="accumul8-statement-chip is-processed">{latestAuditRun.passed_count} passed</span>
              <span className="accumul8-statement-chip">{latestAuditRun.warning_count} warning</span>
              <span className={`accumul8-statement-chip${latestAuditRun.failed_count > 0 ? ' is-warning' : ''}`}>{latestAuditRun.failed_count} failed</span>
            </div>
            <div className="small text-muted">{latestAuditRun.summary_text}</div>
          </section>
        ) : null}
      </section>
    </>
  );
}
