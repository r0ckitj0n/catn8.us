import React from 'react';

import { Accumul8StatementAuditRun, Accumul8StatementImportResult, Accumul8StatementKind } from '../../types/accumul8';
import { StatementModalSection } from '../modals/accumul8StatementWorkspaceUtils';

interface Accumul8StatementsPanelOverviewProps {
  activeSection: StatementModalSection;
  busy: boolean;
  files: File[];
  latestAuditRun: Accumul8StatementAuditRun | null;
  latestImportResult: { filename: string; result: Accumul8StatementImportResult | null; uploadId: number } | null;
  overview: { failed: number; imported: number; review: number; suspicious: number };
  searchResultsCount: number;
  setActiveSection: (section: StatementModalSection) => void;
  setFiles: (files: File[]) => void;
  setStatementKind: (kind: Accumul8StatementKind | '') => void;
  statementKind: Accumul8StatementKind | '';
  statementUploadsCount: number;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}

export function Accumul8StatementsPanelOverview({
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
}: Accumul8StatementsPanelOverviewProps) {
  return (
    <>
      <section className="accumul8-statement-summary-grid">
        <button type="button" className={`accumul8-statement-summary-card${activeSection === 'inbox' ? ' is-active' : ''}`} onClick={() => setActiveSection('inbox')}>
          <span className="accumul8-statement-summary-label">Inbox</span>
          <strong>{overview.review}</strong>
        </button>
        <button type="button" className={`accumul8-statement-summary-card${activeSection === 'library' ? ' is-active' : ''}`} onClick={() => setActiveSection('library')}>
          <span className="accumul8-statement-summary-label">Library</span>
          <strong>{statementUploadsCount}</strong>
        </button>
        <button type="button" className={`accumul8-statement-summary-card${activeSection === 'search' ? ' is-active' : ''}`} onClick={() => setActiveSection('search')}>
          <span className="accumul8-statement-summary-label">Search</span>
          <strong>{searchResultsCount}</strong>
        </button>
        <button type="button" className={`accumul8-statement-summary-card${activeSection === 'signals' ? ' is-active' : ''}`} onClick={() => setActiveSection('signals')}>
          <span className="accumul8-statement-summary-label">Signals</span>
          <strong>{overview.failed + overview.suspicious}</strong>
        </button>
      </section>

      <section className="accumul8-statement-top-grid is-single-column">
        <div className="accumul8-statement-upload-card">
          <div className="accumul8-statement-upload-toolbar">
            <div className="accumul8-statement-section-head">
              <div className="accumul8-statement-action-row">
                <label htmlFor="accumul8-statement-files" className={`btn btn-success btn-sm${busy ? ' disabled' : ''}`}>Upload Statements</label>
                <button type="submit" className="btn btn-success btn-sm" disabled={busy || files.length === 0} form="accumul8-statement-upload-form">Scan Statements</button>
              </div>
            </div>
            <form id="accumul8-statement-upload-form" className="accumul8-statement-upload-form" onSubmit={onSubmit}>
              <div className="accumul8-statement-upload-fields">
                <select id="accumul8-statement-kind" className="form-select" value={statementKind} onChange={(event) => setStatementKind(event.target.value as Accumul8StatementKind | '')} disabled={busy}>
                  <option value="">Statement type</option>
                  <option value="bank_account">Bank account</option>
                  <option value="credit_card">Credit card</option>
                  <option value="loan">Car loan / installment</option>
                  <option value="mortgage">Mortgage</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <input id="accumul8-statement-files" className="accumul8-statement-file-input" type="file" accept=".pdf,image/*" multiple disabled={busy} onChange={(event) => setFiles(Array.from(event.target.files || []))} />
            </form>
          </div>
          {files.length > 0 ? (
            <div className="small text-muted">{`${files.length} file(s) queued: ${files.map((file) => file.name).join(', ')}`}</div>
          ) : null}
        </div>
        {latestImportResult ? (
          <section className="accumul8-statement-history-card accumul8-statement-result-card">
            <strong>Latest import result</strong>
            <div className="small text-muted">{latestImportResult.filename}</div>
            <div className="accumul8-statement-chip-row">
              <span className="accumul8-statement-chip is-processed">{latestImportResult.result?.imported_count || 0} imported</span>
              <span className="accumul8-statement-chip">{latestImportResult.result?.duplicate_count || 0} duplicates skipped</span>
              <span className={`accumul8-statement-chip${(latestImportResult.result?.failed_count || 0) > 0 ? ' is-warning' : ''}`}>{latestImportResult.result?.failed_count || 0} failed</span>
            </div>
          </section>
        ) : null}
        {latestAuditRun ? (
          <section className="accumul8-statement-history-card accumul8-statement-result-card">
            <strong>Latest audit</strong>
            <div className="small text-muted">{latestAuditRun.created_at || 'Saved audit run'}</div>
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
