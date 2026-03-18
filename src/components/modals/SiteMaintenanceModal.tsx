import React from 'react';
import { ModalCloseIconButton } from '../common/ModalCloseIconButton';
import { useBootstrapModal } from '../../hooks/useBootstrapModal';
import { IToast } from '../../types/common';
import { ISiteMaintenanceAccumul8RescanResult, SiteMaintenanceTab } from '../../types/siteMaintenance';
import { SiteMaintenancePrimaryPanels } from './SiteMaintenancePrimaryPanels';
import { SiteMaintenanceSecondaryPanels } from './SiteMaintenanceSecondaryPanels';
import { useSiteMaintenance } from './hooks/useSiteMaintenance';
import { pushSiteMaintenanceToast, siteMaintenanceStatCard, siteMaintenanceTabs } from './siteMaintenanceModalUtils';
import './SiteMaintenanceModal.css';

interface SiteMaintenanceModalProps {
  open: boolean;
  onClose: () => void;
  onToast?: (toast: IToast) => void;
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
  const [accumul8OwnerUserId, setAccumul8OwnerUserId] = React.useState('1');
  const [accumul8Limit, setAccumul8Limit] = React.useState('25');
  const [accumul8DryRun, setAccumul8DryRun] = React.useState(true);
  const [accumul8OnlyMissingSuccessfulScan, setAccumul8OnlyMissingSuccessfulScan] = React.useState(true);
  const [accumul8IncludeMissingCatalog, setAccumul8IncludeMissingCatalog] = React.useState(true);
  const [accumul8Force, setAccumul8Force] = React.useState(false);
  const [accumul8Result, setAccumul8Result] = React.useState<ISiteMaintenanceAccumul8RescanResult | null>(null);

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
      if (successMessage) pushSiteMaintenanceToast(onToast, 'success', successMessage);
      else if (res?.message) pushSiteMaintenanceToast(onToast, 'success', String(res.message));
      return res;
    } catch (err: any) {
      pushSiteMaintenanceToast(onToast, 'error', String(err?.message || 'Action failed'));
      return null;
    }
  };

  const runAccumul8Rescan = async () => {
    const parsedLimit = Number.parseInt(accumul8Limit, 10);
    const normalizedLimit = Number.isFinite(parsedLimit) ? Math.max(1, Math.min(500, parsedLimit)) : 25;
    const parsedOwnerId = Number.parseInt(accumul8OwnerUserId, 10);
    const ownerUserId = Number.isFinite(parsedOwnerId) && parsedOwnerId > 0 ? parsedOwnerId : null;

    const res = await runAction(
      () =>
        maint.runJsonAction('accumul8_rescan_statements', {
          owner_user_id: ownerUserId,
          limit: normalizedLimit,
          dry_run: accumul8DryRun,
          only_missing_successful_scan: accumul8OnlyMissingSuccessfulScan,
          include_missing_catalog: accumul8IncludeMissingCatalog,
          force: accumul8Force,
        }),
      accumul8DryRun ? 'Accumul8 dry run completed' : 'Accumul8 rescan completed',
    );

    if (res?.result && typeof res.result === 'object') {
      const next = res.result as ISiteMaintenanceAccumul8RescanResult;
      setAccumul8Result(next);
      pushSiteMaintenanceToast(
        onToast,
        next.failure_count > 0 ? 'info' : 'success',
        `${next.candidate_count} candidate(s), ${next.success_count} succeeded, ${next.failure_count} failed.`,
      );
    }
  };

  return (
    <div className="modal fade catn8-site-maint-modal" tabIndex={-1} aria-hidden="true" ref={modalRef}>
      <div className="modal-dialog modal-dialog-centered modal-xl">
        <div className="modal-content">
          <div className="modal-header">
            <div className="catn8-site-maint-title-wrap">
              <div className="catn8-site-maint-badge">{siteMaintenanceStatCard}</div>
              <div>
                <h5 className="modal-title">Site Maintenance</h5>
                <div className="catn8-site-maint-subtitle">System Health &amp; Data Management</div>
              </div>
            </div>
            <ModalCloseIconButton />
          </div>

          <div className="modal-body">
            <div className="catn8-site-maint-tab-row" role="tablist" aria-label="Site Maintenance sections">
              {siteMaintenanceTabs.map((tab) => {
                const selected = activeTab === tab.key;
                return (
                  <button key={tab.key} type="button" role="tab" aria-selected={selected} className={selected ? 'catn8-site-maint-tab is-active' : 'catn8-site-maint-tab'} onClick={() => setActiveTab(tab.key)}>
                    {tab.label}
                  </button>
                );
              })}
            </div>
            <SiteMaintenancePrimaryPanels
              activeTab={activeTab}
              backupDatabaseMode={backupDatabaseMode}
              backupWebsiteMode={backupWebsiteMode}
              databaseBackupPath={databaseBackupPath}
              databaseRestoreFile={databaseRestoreFile}
              maint={maint}
              onRunAction={runAction}
              restoreDatabaseMode={restoreDatabaseMode}
              restoreWebsiteMode={restoreWebsiteMode}
              selectedDbGroups={selectedDbGroups}
              selectedImageGroups={selectedImageGroups}
              setBackupDatabaseMode={setBackupDatabaseMode}
              setBackupWebsiteMode={setBackupWebsiteMode}
              setDatabaseBackupPath={setDatabaseBackupPath}
              setDatabaseRestoreFile={setDatabaseRestoreFile}
              setRestoreDatabaseMode={setRestoreDatabaseMode}
              setRestoreWebsiteMode={setRestoreWebsiteMode}
              setSelectedDbGroups={setSelectedDbGroups}
              setSelectedImageGroups={setSelectedImageGroups}
              setWebsiteBackupPath={setWebsiteBackupPath}
              setWebsiteRestoreFile={setWebsiteRestoreFile}
              toggleSelection={toggleSelection}
              websiteBackupPath={websiteBackupPath}
              websiteRestoreFile={websiteRestoreFile}
            />
            <SiteMaintenanceSecondaryPanels
              accumul8DryRun={accumul8DryRun}
              accumul8Force={accumul8Force}
              accumul8IncludeMissingCatalog={accumul8IncludeMissingCatalog}
              accumul8Limit={accumul8Limit}
              accumul8OnlyMissingSuccessfulScan={accumul8OnlyMissingSuccessfulScan}
              accumul8OwnerUserId={accumul8OwnerUserId}
              accumul8Result={accumul8Result}
              activeTab={activeTab}
              cleanupDryRun={cleanupDryRun}
              maint={maint}
              onRunAccumul8Rescan={runAccumul8Rescan}
              onRunAction={runAction}
              onToast={onToast}
              setAccumul8DryRun={setAccumul8DryRun}
              setAccumul8Force={setAccumul8Force}
              setAccumul8IncludeMissingCatalog={setAccumul8IncludeMissingCatalog}
              setAccumul8Limit={setAccumul8Limit}
              setAccumul8OnlyMissingSuccessfulScan={setAccumul8OnlyMissingSuccessfulScan}
              setAccumul8OwnerUserId={setAccumul8OwnerUserId}
              setCleanupDryRun={setCleanupDryRun}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
