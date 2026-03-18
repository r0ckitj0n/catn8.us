import React from 'react';

import { SiteMaintenanceTab } from '../../types/siteMaintenance';

interface SiteMaintenancePrimaryPanelsProps {
  activeTab: SiteMaintenanceTab;
  backupDatabaseMode: 'full' | 'selected';
  backupWebsiteMode: 'full' | 'images';
  databaseBackupPath: string;
  databaseRestoreFile: File | null;
  maint: {
    backups: {
      database_backups: Array<{ path: string; name: string }>;
      website_backups: Array<{ path: string; name: string }>;
    };
    busy: boolean;
    database: {
      active_tables: number;
      backup_tables: number;
      db_group_options: Array<{ id: string; label: string }>;
      groups: Array<{ id: string; label: string; rows: Array<{ table: string; row_count: number }> }>;
      image_group_options: Array<{ id: string; label: string }>;
    };
    loading: boolean;
    refreshBackups: () => Promise<unknown>;
    refreshDatabase: () => Promise<unknown>;
    runFormAction: (action: string, formData: FormData) => Promise<unknown>;
    runJsonAction: (action: string, body: Record<string, unknown>) => Promise<any>;
    status: {
      primary_identity: { entity: string; format: string; identifier: string };
      quick_stats: { active_categories: number; total_item_images: number; total_items: number; total_orders: number };
      recent_activity: { latest_customers: string[]; latest_orders: string[] };
    };
  };
  onRunAction: <T>(fn: () => Promise<T>, successMessage?: string) => Promise<T | null>;
  restoreDatabaseMode: 'full' | 'selected';
  restoreWebsiteMode: 'full' | 'selected';
  selectedDbGroups: string[];
  selectedImageGroups: string[];
  setBackupDatabaseMode: (value: 'full' | 'selected') => void;
  setBackupWebsiteMode: (value: 'full' | 'images') => void;
  setDatabaseBackupPath: (value: string) => void;
  setDatabaseRestoreFile: (file: File | null) => void;
  setRestoreDatabaseMode: (value: 'full' | 'selected') => void;
  setRestoreWebsiteMode: (value: 'full' | 'selected') => void;
  setSelectedDbGroups: React.Dispatch<React.SetStateAction<string[]>>;
  setSelectedImageGroups: React.Dispatch<React.SetStateAction<string[]>>;
  setWebsiteBackupPath: (value: string) => void;
  setWebsiteRestoreFile: (file: File | null) => void;
  toggleSelection: (setFn: React.Dispatch<React.SetStateAction<string[]>>, value: string) => void;
  websiteBackupPath: string;
  websiteRestoreFile: File | null;
}

export function SiteMaintenancePrimaryPanels({
  activeTab,
  backupDatabaseMode,
  backupWebsiteMode,
  databaseBackupPath,
  databaseRestoreFile,
  maint,
  onRunAction,
  restoreDatabaseMode,
  restoreWebsiteMode,
  selectedDbGroups,
  selectedImageGroups,
  setBackupDatabaseMode,
  setBackupWebsiteMode,
  setDatabaseBackupPath,
  setDatabaseRestoreFile,
  setRestoreDatabaseMode,
  setRestoreWebsiteMode,
  setSelectedDbGroups,
  setSelectedImageGroups,
  setWebsiteBackupPath,
  setWebsiteRestoreFile,
  toggleSelection,
  websiteBackupPath,
  websiteRestoreFile,
}: SiteMaintenancePrimaryPanelsProps) {
  if (activeTab === 'status') {
    return (
      <div className="catn8-site-maint-panel" role="tabpanel">
        <div className="row g-3">
          <div className="col-12 col-lg-6">
            <div className="catn8-site-maint-card is-soft-green">
              <h3>Primary Identity</h3>
              <p><strong>Identifier:</strong> {maint.status.primary_identity.identifier}</p>
              <p><strong>Format:</strong> {maint.status.primary_identity.format}</p>
              <p className="mb-0"><strong>Entity:</strong> {maint.status.primary_identity.entity}</p>
            </div>
          </div>
          <div className="col-12 col-lg-6">
            <div className="catn8-site-maint-card is-soft-teal">
              <h3>Quick Stats</h3>
              <p><strong>Total Items:</strong> {maint.status.quick_stats.total_items} ({maint.status.quick_stats.total_item_images} images)</p>
              <p><strong>Total Orders:</strong> {maint.status.quick_stats.total_orders}</p>
              <p className="mb-0"><strong>Categories:</strong> {maint.status.quick_stats.active_categories} active</p>
            </div>
          </div>
        </div>
        <div className="catn8-site-maint-card catn8-site-maint-activity mt-3">
          <h3>Recent Activity</h3>
          <div className="catn8-site-maint-activity-label">Latest Customers</div>
          <div className="catn8-site-maint-chip-row">{maint.status.recent_activity.latest_customers.map((v) => <span className="catn8-site-maint-chip" key={v}>{v}</span>)}</div>
          <div className="catn8-site-maint-activity-label">Latest Orders</div>
          <div className="catn8-site-maint-chip-row">{maint.status.recent_activity.latest_orders.map((v) => <span className="catn8-site-maint-chip" key={v}>{v}</span>)}</div>
        </div>
      </div>
    );
  }

  if (activeTab === 'database') {
    return (
      <div className="catn8-site-maint-panel" role="tabpanel">
        <div className="catn8-site-maint-card is-soft-green catn8-site-maint-bar">
          <div>
            <h3>Database Structure</h3>
            <p className="mb-0">{maint.database.active_tables} active tables, {maint.database.backup_tables} backup tables</p>
          </div>
          <button type="button" className="btn btn-sm catn8-site-maint-btn-green" disabled={maint.busy || maint.loading} onClick={() => void onRunAction(async () => {
            const res = await maint.runJsonAction('compact_repair', {});
            await maint.refreshDatabase();
            return res;
          }, 'Compact & repair completed')}>
            Compact &amp; Repair
          </button>
        </div>
        <div className="catn8-site-maint-db-grid mt-3">
          {maint.database.groups.map((group) => (
            <div key={group.id} className="catn8-site-maint-db-card">
              <h4>{group.label}</h4>
              {group.rows.map((row) => (
                <div key={row.table} className="catn8-site-maint-db-row"><span>{row.table}</span><span>{row.row_count} rows</span></div>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (activeTab === 'backups') {
    return (
      <div className="catn8-site-maint-panel" role="tabpanel">
        <div className="row g-3">
          <div className="col-12 col-lg-6">
            <div className="catn8-site-maint-dashed-card">
              <h3>Website Files Backup</h3>
              <p>Create a full site archive or save only selected image folders.</p>
              <div className="catn8-site-maint-radio-row"><label><input type="radio" checked={backupWebsiteMode === 'full'} onChange={() => setBackupWebsiteMode('full')} /> Full site files</label><label><input type="radio" checked={backupWebsiteMode === 'images'} onChange={() => setBackupWebsiteMode('images')} /> Images only</label></div>
              {backupWebsiteMode === 'images' ? <div className="catn8-site-maint-checkbox-grid">{maint.database.image_group_options.map((g) => <label key={g.id}><input type="checkbox" checked={selectedImageGroups.includes(g.id)} onChange={() => toggleSelection(setSelectedImageGroups, g.id)} /> {g.label}</label>)}</div> : null}
              <button type="button" className="btn catn8-site-maint-btn-green w-100" disabled={maint.busy || maint.loading} onClick={() => void onRunAction(async () => {
                const res = await maint.runJsonAction('create_website_backup', { mode: backupWebsiteMode, image_groups: selectedImageGroups });
                await maint.refreshBackups();
                return res;
              })}>
                Create Website Backup
              </button>
            </div>
          </div>
          <div className="col-12 col-lg-6">
            <div className="catn8-site-maint-dashed-card">
              <h3>Database Backup</h3>
              <p>Create a full SQL dump or save only selected business data groups.</p>
              <div className="catn8-site-maint-radio-row"><label><input type="radio" checked={backupDatabaseMode === 'full'} onChange={() => setBackupDatabaseMode('full')} /> Full database</label><label><input type="radio" checked={backupDatabaseMode === 'selected'} onChange={() => setBackupDatabaseMode('selected')} /> Selected data groups</label></div>
              {backupDatabaseMode === 'selected' ? <div className="catn8-site-maint-checkbox-grid">{maint.database.db_group_options.map((g) => <label key={g.id}><input type="checkbox" checked={selectedDbGroups.includes(g.id)} onChange={() => toggleSelection(setSelectedDbGroups, g.id)} /> {g.label}</label>)}</div> : null}
              <button type="button" className="btn catn8-site-maint-btn-orange w-100" disabled={maint.busy || maint.loading} onClick={() => void onRunAction(async () => {
                const res = await maint.runJsonAction('create_database_backup', { mode: backupDatabaseMode, group_ids: selectedDbGroups });
                await maint.refreshBackups();
                return res;
              })}>
                Create Database Backup
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (activeTab === 'restore') {
    return (
      <div className="catn8-site-maint-panel" role="tabpanel">
        <div className="catn8-site-maint-card catn8-site-maint-bar">
          <div>
            <h3>Available Backup Files</h3>
            <p className="mb-0">{maint.backups.website_backups.length + maint.backups.database_backups.length} file(s) detected in /backups</p>
          </div>
          <button type="button" className="btn btn-sm catn8-site-maint-btn-orange" disabled={maint.busy || maint.loading} onClick={() => void onRunAction(() => maint.refreshBackups(), 'Backup list refreshed')}>
            Refresh List
          </button>
        </div>
        <div className="row g-3 mt-1">
          <div className="col-12 col-lg-6"><div className="catn8-site-maint-dashed-card"><h3>Website Backup Restore</h3><p>Restore site files from a server backup list or upload a `.zip` / `.tar.gz` backup from your computer.</p><div className="catn8-site-maint-input-stack"><div className="catn8-site-maint-radio-row boxed"><label><input type="radio" checked={restoreWebsiteMode === 'full'} onChange={() => setRestoreWebsiteMode('full')} /> Restore all website files from archive</label><label><input type="radio" checked={restoreWebsiteMode === 'selected'} onChange={() => setRestoreWebsiteMode('selected')} /> Restore only selected image groups</label></div>{restoreWebsiteMode === 'selected' ? <div className="catn8-site-maint-checkbox-grid">{maint.database.image_group_options.map((g) => <label key={g.id}><input type="checkbox" checked={selectedImageGroups.includes(g.id)} onChange={() => toggleSelection(setSelectedImageGroups, g.id)} /> {g.label}</label>)}</div> : null}<select className="form-select" value={websiteBackupPath} onChange={(e) => setWebsiteBackupPath(e.target.value)}><option value="">Select website backup...</option>{maint.backups.website_backups.map((b) => <option key={b.path} value={b.path}>{b.name}</option>)}</select><div className="catn8-site-maint-upload-label">Or choose local website backup</div><input className="form-control" type="file" onChange={(e) => setWebsiteRestoreFile(e.target.files?.[0] || null)} /></div><button type="button" className="btn catn8-site-maint-btn-tan w-100" disabled={maint.busy || maint.loading} onClick={() => void onRunAction(async () => {
            if (websiteRestoreFile) {
              const fd = new FormData();
              fd.append('mode', restoreWebsiteMode);
              fd.append('image_groups', JSON.stringify(selectedImageGroups));
              fd.append('backup_file', websiteRestoreFile);
              const res = await maint.runFormAction('restore_website_upload', fd);
              await maint.refreshBackups();
              return res;
            }
            return maint.runJsonAction('restore_website_server', { mode: restoreWebsiteMode, image_groups: selectedImageGroups, backup_path: websiteBackupPath });
          })}>Restore Website Backup</button></div></div>
          <div className="col-12 col-lg-6"><div className="catn8-site-maint-dashed-card"><h3>Database Backup Restore</h3><p>Restore SQL data from a server backup list or upload a `.sql` / `.sql.gz` file from your computer.</p><div className="catn8-site-maint-input-stack"><div className="catn8-site-maint-radio-row boxed"><label><input type="radio" checked={restoreDatabaseMode === 'full'} onChange={() => setRestoreDatabaseMode('full')} /> Restore full SQL backup</label><label><input type="radio" checked={restoreDatabaseMode === 'selected'} onChange={() => setRestoreDatabaseMode('selected')} /> Restore selected data groups only</label></div>{restoreDatabaseMode === 'selected' ? <div className="catn8-site-maint-checkbox-grid">{maint.database.db_group_options.map((g) => <label key={g.id}><input type="checkbox" checked={selectedDbGroups.includes(g.id)} onChange={() => toggleSelection(setSelectedDbGroups, g.id)} /> {g.label}</label>)}</div> : null}<select className="form-select" value={databaseBackupPath} onChange={(e) => setDatabaseBackupPath(e.target.value)}><option value="">Select database backup...</option>{maint.backups.database_backups.map((b) => <option key={b.path} value={b.path}>{b.name}</option>)}</select><div className="catn8-site-maint-upload-label">Or choose local backup file</div><input className="form-control" type="file" onChange={(e) => setDatabaseRestoreFile(e.target.files?.[0] || null)} /></div><button type="button" className="btn catn8-site-maint-btn-lime w-100" disabled={maint.busy || maint.loading} onClick={() => void onRunAction(async () => {
            if (databaseRestoreFile) {
              const fd = new FormData();
              fd.append('mode', restoreDatabaseMode);
              fd.append('group_ids', JSON.stringify(selectedDbGroups));
              fd.append('backup_file', databaseRestoreFile);
              return maint.runFormAction('restore_database_upload', fd);
            }
            return maint.runJsonAction('restore_database_server', { mode: restoreDatabaseMode, group_ids: selectedDbGroups, backup_path: databaseBackupPath });
          })}>Restore Database Backup</button></div></div>
        </div>
      </div>
    );
  }

  return null;
}
