import React from 'react';

import { ISiteMaintenanceAccumul8RescanResult, SiteMaintenanceTab } from '../../types/siteMaintenance';
import { IToast } from '../../types/common';
import { pushSiteMaintenanceToast } from './siteMaintenanceModalUtils';

interface SiteMaintenanceSecondaryPanelsProps {
  accumul8DryRun: boolean;
  accumul8Force: boolean;
  accumul8IncludeMissingCatalog: boolean;
  accumul8Limit: string;
  accumul8OnlyMissingSuccessfulScan: boolean;
  accumul8OwnerUserId: string;
  accumul8Result: ISiteMaintenanceAccumul8RescanResult | null;
  activeTab: SiteMaintenanceTab;
  cleanupDryRun: boolean;
  maint: {
    busy: boolean;
    loading: boolean;
    runJsonAction: (action: string, body: Record<string, unknown>) => Promise<any>;
  };
  onRunAccumul8Rescan: () => Promise<void>;
  onRunAction: <T>(fn: () => Promise<T>, successMessage?: string) => Promise<T | null>;
  onToast?: (toast: IToast) => void;
  setAccumul8DryRun: (value: boolean) => void;
  setAccumul8Force: (value: boolean) => void;
  setAccumul8IncludeMissingCatalog: (value: boolean) => void;
  setAccumul8Limit: (value: string) => void;
  setAccumul8OnlyMissingSuccessfulScan: (value: boolean) => void;
  setAccumul8OwnerUserId: (value: string) => void;
  setCleanupDryRun: (value: boolean) => void;
}

export function SiteMaintenanceSecondaryPanels({
  accumul8DryRun,
  accumul8Force,
  accumul8IncludeMissingCatalog,
  accumul8Limit,
  accumul8OnlyMissingSuccessfulScan,
  accumul8OwnerUserId,
  accumul8Result,
  activeTab,
  cleanupDryRun,
  maint,
  onRunAccumul8Rescan,
  onRunAction,
  onToast,
  setAccumul8DryRun,
  setAccumul8Force,
  setAccumul8IncludeMissingCatalog,
  setAccumul8Limit,
  setAccumul8OnlyMissingSuccessfulScan,
  setAccumul8OwnerUserId,
  setCleanupDryRun,
}: SiteMaintenanceSecondaryPanelsProps) {
  if (activeTab === 'cleanup') {
    return (
      <div className="catn8-site-maint-panel" role="tabpanel">
        <div className="catn8-site-maint-card">
          <h3>Image Cleanup</h3>
          <p>Scans the /images folder, checks which files are referenced in MySQL, and archives unreferenced files into /backups.</p>
          <div className="catn8-site-maint-bar"><label className="catn8-site-maint-check-label"><input type="checkbox" checked={cleanupDryRun} onChange={(e) => setCleanupDryRun(e.target.checked)} /> Dry run (Recommended) <span className="catn8-site-maint-muted">No files moved</span></label><button type="button" className="btn catn8-site-maint-btn-green" disabled={maint.busy || maint.loading} onClick={() => void onRunAction(async () => {
            const res = await maint.runJsonAction('cleanup_images', { dry_run: cleanupDryRun });
            if (res?.result && typeof res.result === 'object') {
              const r = res.result as { moved_files?: number; scanned_files?: number; unreferenced_files?: number };
              pushSiteMaintenanceToast(onToast, 'info', `Scanned ${r.scanned_files || 0}, unreferenced ${r.unreferenced_files || 0}, moved ${r.moved_files || 0}.`);
            }
            return res;
          })}>Run Cleanup</button></div>
        </div>
      </div>
    );
  }

  if (activeTab === 'accumul8') {
    return (
      <div className="catn8-site-maint-panel" role="tabpanel">
        <div className="catn8-site-maint-dashed-card">
          <h3>Statement Rescan Batch</h3>
          <p>Runs the server-side Accumul8 statement rescan flow for uploads missing a successful scan and/or missing locator catalog data.</p>
          <div className="catn8-site-maint-accumul8-grid">
            <label>
              <span className="catn8-site-maint-upload-label">Owner User ID</span>
              <input className="form-control" type="number" min={1} value={accumul8OwnerUserId} onChange={(e) => setAccumul8OwnerUserId(e.target.value)} />
            </label>
            <label>
              <span className="catn8-site-maint-upload-label">Batch Limit</span>
              <input className="form-control" type="number" min={1} max={500} value={accumul8Limit} onChange={(e) => setAccumul8Limit(e.target.value)} />
            </label>
          </div>
          <div className="catn8-site-maint-checkbox-grid catn8-site-maint-accumul8-checks">
            <label><input type="checkbox" checked={accumul8DryRun} onChange={(e) => setAccumul8DryRun(e.target.checked)} /> Dry run only</label>
            <label><input type="checkbox" checked={accumul8OnlyMissingSuccessfulScan} onChange={(e) => setAccumul8OnlyMissingSuccessfulScan(e.target.checked)} /> Include missing successful scan</label>
            <label><input type="checkbox" checked={accumul8IncludeMissingCatalog} onChange={(e) => setAccumul8IncludeMissingCatalog(e.target.checked)} /> Include missing catalog data</label>
            <label><input type="checkbox" checked={accumul8Force} onChange={(e) => setAccumul8Force(e.target.checked)} /> Force all statements in scope</label>
          </div>
          <div className="catn8-site-maint-bar">
            <div className="catn8-site-maint-muted">Run a dry run first, then execute in chunks if the candidate list looks right.</div>
            <button type="button" className="btn catn8-site-maint-btn-green" disabled={maint.busy || maint.loading} onClick={() => void onRunAccumul8Rescan()}>
              {accumul8DryRun ? 'Preview Candidates' : 'Run Statement Rescan'}
            </button>
          </div>
        </div>

        {accumul8Result ? (
          <div className="catn8-site-maint-card mt-3">
            <h3>Latest Batch Result</h3>
            <div className="catn8-site-maint-chip-row">
              <span className="catn8-site-maint-chip">candidates {accumul8Result.candidate_count}</span>
              <span className="catn8-site-maint-chip">scanned {accumul8Result.scanned_count}</span>
              <span className="catn8-site-maint-chip">success {accumul8Result.success_count}</span>
              <span className="catn8-site-maint-chip">failed {accumul8Result.failure_count}</span>
              <span className="catn8-site-maint-chip">skipped {accumul8Result.skipped_count}</span>
            </div>
            <div className="catn8-site-maint-result-table-wrap">
              <table className="catn8-site-maint-result-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Status</th>
                    <th>Reasons</th>
                    <th>Catalog</th>
                    <th>Last Scan</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {accumul8Result.results.map((row) => (
                    <tr key={`${row.owner_user_id}-${row.id}`}>
                      <td>{row.id}</td>
                      <td>{row.status || 'unknown'}</td>
                      <td>{Array.isArray(row.reasons) && row.reasons.length > 0 ? row.reasons.join(', ') : 'n/a'}</td>
                      <td>{typeof row.catalog_page_count === 'number' || typeof row.locator_count === 'number' ? `${row.catalog_page_count ?? 0} page(s), ${row.locator_count ?? 0} locator(s)` : row.needs_catalog_refresh ? 'needs refresh' : 'ok'}</td>
                      <td>{row.last_scanned_at || 'never'}</td>
                      <td>{row.error || row.last_error || row.original_filename}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return null;
}
