import React from 'react';
import { ModalCloseIconButton } from '../common/ModalCloseIconButton';
import { useBootstrapModal } from '../../hooks/useBootstrapModal';
import { IToast } from '../../types/common';
import { SiteMaintenanceTab } from '../../types/siteMaintenance';
import { useSiteMaintenance } from './hooks/useSiteMaintenance';
import './SiteMaintenanceModal.css';

interface SiteMaintenanceModalProps {
  open: boolean;
  onClose: () => void;
  onToast?: (toast: IToast) => void;
}

const tabs: Array<{ key: SiteMaintenanceTab; label: string }> = [
  { key: 'status', label: 'System Status' },
  { key: 'database', label: 'Database' },
  { key: 'backups', label: 'Backups' },
  { key: 'restore', label: 'Restore' },
  { key: 'cleanup', label: 'Cleanup' },
];

const statCard = (
  <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path fill="currentColor" d="M12 2 4 5v6c0 5.2 3.6 10 8 11 4.4-1 8-5.8 8-11V5l-8-3Zm0 2.1 6 2.2V11c0 4.1-2.7 8-6 9-3.3-1-6-4.9-6-9V6.3l6-2.2Z" />
  </svg>
);

function pushToast(onToast: SiteMaintenanceModalProps['onToast'], tone: IToast['tone'], message: string) {
  if (typeof onToast === 'function') onToast({ tone, message });
}

export function SiteMaintenanceModal({ open, onClose, onToast }: SiteMaintenanceModalProps) {
  const { modalRef, modalApiRef } = useBootstrapModal(onClose);
  const maint = useSiteMaintenance({ open });

  const [activeTab, setActiveTab] = React.useState<SiteMaintenanceTab>('status');
  const [backupWebsiteMode, setBackupWebsiteMode] = React.useState<'full' | 'images'>('full');
  const [backupDatabaseMode, setBackupDatabaseMode] = React.useState<'full' | 'selected'>('full');
  const [restoreWebsiteMode, setRestoreWebsiteMode] = React.useState<'full' | 'selected'>('full');
  const [restoreDatabaseMode, setRestoreDatabaseMode] = React.useState<'full' | 'selected'>('full');
  const [cleanupDryRun, setCleanupDryRun] = React.useState(true);

  const [selectedImageGroups, setSelectedImageGroups] = React.useState<string[]>(['all']);
  const [selectedDbGroups, setSelectedDbGroups] = React.useState<string[]>([]);

  const [websiteBackupPath, setWebsiteBackupPath] = React.useState('');
  const [databaseBackupPath, setDatabaseBackupPath] = React.useState('');
  const [websiteRestoreFile, setWebsiteRestoreFile] = React.useState<File | null>(null);
  const [databaseRestoreFile, setDatabaseRestoreFile] = React.useState<File | null>(null);

  React.useEffect(() => {
    const modal = modalApiRef.current;
    if (!modal) return;
    if (open) modal.show();
    else modal.hide();
  }, [open, modalApiRef]);

  React.useEffect(() => {
    if (!open) return;
    setActiveTab('status');
  }, [open]);

  React.useEffect(() => {
    if (selectedDbGroups.length > 0) return;
    if (maint.database.db_group_options.length === 0) return;
    setSelectedDbGroups(maint.database.db_group_options.map((g) => g.id));
  }, [maint.database.db_group_options, selectedDbGroups.length]);

  React.useEffect(() => {
    if (websiteBackupPath !== '' || maint.backups.website_backups.length === 0) return;
    setWebsiteBackupPath(maint.backups.website_backups[0].path);
  }, [maint.backups.website_backups, websiteBackupPath]);

  React.useEffect(() => {
    if (databaseBackupPath !== '' || maint.backups.database_backups.length === 0) return;
    setDatabaseBackupPath(maint.backups.database_backups[0].path);
  }, [maint.backups.database_backups, databaseBackupPath]);

  const toggleSelection = (setFn: React.Dispatch<React.SetStateAction<string[]>>, value: string) => {
    setFn((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  };

  const runAction = async (fn: () => Promise<any>, successMessage?: string) => {
    try {
      const res = await fn();
      if (successMessage) pushToast(onToast, 'success', successMessage);
      else if (res?.message) pushToast(onToast, 'success', String(res.message));
      return res;
    } catch (err: any) {
      pushToast(onToast, 'error', String(err?.message || 'Action failed'));
      return null;
    }
  };

  return (
    <div className="modal fade catn8-site-maint-modal" tabIndex={-1} aria-hidden="true" ref={modalRef}>
      <div className="modal-dialog modal-dialog-centered modal-xl">
        <div className="modal-content">
          <div className="modal-header">
            <div className="catn8-site-maint-title-wrap">
              <div className="catn8-site-maint-badge">{statCard}</div>
              <div>
                <h5 className="modal-title">Site Maintenance</h5>
                <div className="catn8-site-maint-subtitle">System Health &amp; Data Management</div>
              </div>
            </div>
            <ModalCloseIconButton />
          </div>

          <div className="modal-body">
            <div className="catn8-site-maint-tab-row" role="tablist" aria-label="Site Maintenance sections">
              {tabs.map((tab) => {
                const selected = activeTab === tab.key;
                return (
                  <button key={tab.key} type="button" role="tab" aria-selected={selected} className={selected ? 'catn8-site-maint-tab is-active' : 'catn8-site-maint-tab'} onClick={() => setActiveTab(tab.key)}>
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {activeTab === 'status' ? (
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
            ) : null}

            {activeTab === 'database' ? (
              <div className="catn8-site-maint-panel" role="tabpanel">
                <div className="catn8-site-maint-card is-soft-green catn8-site-maint-bar">
                  <div>
                    <h3>Database Structure</h3>
                    <p className="mb-0">{maint.database.active_tables} active tables, {maint.database.backup_tables} backup tables</p>
                  </div>
                  <button type="button" className="btn btn-sm catn8-site-maint-btn-green" disabled={maint.busy || maint.loading} onClick={() => void runAction(async () => {
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
            ) : null}

            {activeTab === 'backups' ? (
              <div className="catn8-site-maint-panel" role="tabpanel">
                <div className="row g-3">
                  <div className="col-12 col-lg-6">
                    <div className="catn8-site-maint-dashed-card">
                      <h3>Website Files Backup</h3>
                      <p>Create a full site archive or save only selected image folders.</p>
                      <div className="catn8-site-maint-radio-row"><label><input type="radio" checked={backupWebsiteMode === 'full'} onChange={() => setBackupWebsiteMode('full')} /> Full site files</label><label><input type="radio" checked={backupWebsiteMode === 'images'} onChange={() => setBackupWebsiteMode('images')} /> Images only</label></div>
                      {backupWebsiteMode === 'images' ? <div className="catn8-site-maint-checkbox-grid">{maint.database.image_group_options.map((g) => <label key={g.id}><input type="checkbox" checked={selectedImageGroups.includes(g.id)} onChange={() => toggleSelection(setSelectedImageGroups, g.id)} /> {g.label}</label>)}</div> : null}
                      <button type="button" className="btn catn8-site-maint-btn-green w-100" disabled={maint.busy || maint.loading} onClick={() => void runAction(async () => {
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
                      <button type="button" className="btn catn8-site-maint-btn-orange w-100" disabled={maint.busy || maint.loading} onClick={() => void runAction(async () => {
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
            ) : null}

            {activeTab === 'restore' ? (
              <div className="catn8-site-maint-panel" role="tabpanel">
                <div className="catn8-site-maint-card catn8-site-maint-bar">
                  <div>
                    <h3>Available Backup Files</h3>
                    <p className="mb-0">{maint.backups.website_backups.length + maint.backups.database_backups.length} file(s) detected in /backups</p>
                  </div>
                  <button type="button" className="btn btn-sm catn8-site-maint-btn-orange" disabled={maint.busy || maint.loading} onClick={() => void runAction(() => maint.refreshBackups(), 'Backup list refreshed')}>
                    Refresh List
                  </button>
                </div>

                <div className="row g-3 mt-1">
                  <div className="col-12 col-lg-6"><div className="catn8-site-maint-dashed-card"><h3>Website Backup Restore</h3><p>Restore site files from a server backup list or upload a `.zip` / `.tar.gz` backup from your computer.</p><div className="catn8-site-maint-input-stack"><div className="catn8-site-maint-radio-row boxed"><label><input type="radio" checked={restoreWebsiteMode === 'full'} onChange={() => setRestoreWebsiteMode('full')} /> Restore all website files from archive</label><label><input type="radio" checked={restoreWebsiteMode === 'selected'} onChange={() => setRestoreWebsiteMode('selected')} /> Restore only selected image groups</label></div>{restoreWebsiteMode === 'selected' ? <div className="catn8-site-maint-checkbox-grid">{maint.database.image_group_options.map((g) => <label key={g.id}><input type="checkbox" checked={selectedImageGroups.includes(g.id)} onChange={() => toggleSelection(setSelectedImageGroups, g.id)} /> {g.label}</label>)}</div> : null}<select className="form-select" value={websiteBackupPath} onChange={(e) => setWebsiteBackupPath(e.target.value)}><option value="">Select website backup...</option>{maint.backups.website_backups.map((b) => <option key={b.path} value={b.path}>{b.name}</option>)}</select><div className="catn8-site-maint-upload-label">Or choose local website backup</div><input className="form-control" type="file" onChange={(e) => setWebsiteRestoreFile(e.target.files?.[0] || null)} /></div><button type="button" className="btn catn8-site-maint-btn-tan w-100" disabled={maint.busy || maint.loading} onClick={() => void runAction(async () => {
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

                  <div className="col-12 col-lg-6"><div className="catn8-site-maint-dashed-card"><h3>Database Backup Restore</h3><p>Restore SQL data from a server backup list or upload a `.sql` / `.sql.gz` file from your computer.</p><div className="catn8-site-maint-input-stack"><div className="catn8-site-maint-radio-row boxed"><label><input type="radio" checked={restoreDatabaseMode === 'full'} onChange={() => setRestoreDatabaseMode('full')} /> Restore full SQL backup</label><label><input type="radio" checked={restoreDatabaseMode === 'selected'} onChange={() => setRestoreDatabaseMode('selected')} /> Restore selected data groups only</label></div>{restoreDatabaseMode === 'selected' ? <div className="catn8-site-maint-checkbox-grid">{maint.database.db_group_options.map((g) => <label key={g.id}><input type="checkbox" checked={selectedDbGroups.includes(g.id)} onChange={() => toggleSelection(setSelectedDbGroups, g.id)} /> {g.label}</label>)}</div> : null}<select className="form-select" value={databaseBackupPath} onChange={(e) => setDatabaseBackupPath(e.target.value)}><option value="">Select database backup...</option>{maint.backups.database_backups.map((b) => <option key={b.path} value={b.path}>{b.name}</option>)}</select><div className="catn8-site-maint-upload-label">Or choose local backup file</div><input className="form-control" type="file" onChange={(e) => setDatabaseRestoreFile(e.target.files?.[0] || null)} /></div><button type="button" className="btn catn8-site-maint-btn-lime w-100" disabled={maint.busy || maint.loading} onClick={() => void runAction(async () => {
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
            ) : null}

            {activeTab === 'cleanup' ? (
              <div className="catn8-site-maint-panel" role="tabpanel">
                <div className="catn8-site-maint-card">
                  <h3>Image Cleanup</h3>
                  <p>Scans the /images folder, checks which files are referenced in MySQL, and archives unreferenced files into /backups.</p>
                  <div className="catn8-site-maint-bar"><label className="catn8-site-maint-check-label"><input type="checkbox" checked={cleanupDryRun} onChange={(e) => setCleanupDryRun(e.target.checked)} /> Dry run (Recommended) <span className="catn8-site-maint-muted">No files moved</span></label><button type="button" className="btn catn8-site-maint-btn-green" disabled={maint.busy || maint.loading} onClick={() => void runAction(async () => {
                    const res = await maint.runJsonAction('cleanup_images', { dry_run: cleanupDryRun });
                    if (res?.result && typeof res.result === 'object') {
                      const r = res.result as any;
                      pushToast(onToast, 'info', `Scanned ${r.scanned_files || 0}, unreferenced ${r.unreferenced_files || 0}, moved ${r.moved_files || 0}.`);
                    }
                    return res;
                  })}>Run Cleanup</button></div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
