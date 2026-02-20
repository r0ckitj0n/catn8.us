import React from 'react';
import { ApiClient } from '../../../core/ApiClient';
import {
  ISiteMaintenanceActionResult,
  ISiteMaintenanceBackups,
  ISiteMaintenanceDatabase,
  ISiteMaintenanceStatus,
} from '../../../types/siteMaintenance';

interface UseSiteMaintenanceOptions {
  open: boolean;
}

const emptyStatus: ISiteMaintenanceStatus = {
  primary_identity: { identifier: 'SKU', format: 'WF-[CATEGORY]-[NUMBER]', entity: 'Items' },
  quick_stats: { total_items: 0, total_item_images: 0, total_orders: 0, active_categories: 0 },
  recent_activity: { latest_customers: [], latest_orders: [] },
};

const emptyDatabase: ISiteMaintenanceDatabase = {
  active_tables: 0,
  backup_tables: 0,
  groups: [],
  db_group_options: [],
  image_group_options: [],
};

const emptyBackups: ISiteMaintenanceBackups = {
  website_backups: [],
  database_backups: [],
};

export function useSiteMaintenance({ open }: UseSiteMaintenanceOptions) {
  const [loading, setLoading] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [status, setStatus] = React.useState<ISiteMaintenanceStatus>(emptyStatus);
  const [database, setDatabase] = React.useState<ISiteMaintenanceDatabase>(emptyDatabase);
  const [backups, setBackups] = React.useState<ISiteMaintenanceBackups>(emptyBackups);

  const loadAll = React.useCallback(async () => {
    setLoading(true);
    try {
      const [statusRes, dbRes, backupsRes] = await Promise.all([
        ApiClient.get('/api/settings/site_maintenance.php?action=status'),
        ApiClient.get('/api/settings/site_maintenance.php?action=database'),
        ApiClient.get('/api/settings/site_maintenance.php?action=backups_list'),
      ]);
      if (statusRes?.status) setStatus(statusRes.status as ISiteMaintenanceStatus);
      if (dbRes?.database) setDatabase(dbRes.database as ISiteMaintenanceDatabase);
      if (backupsRes) {
        setBackups({
          website_backups: Array.isArray(backupsRes.website_backups) ? backupsRes.website_backups : [],
          database_backups: Array.isArray(backupsRes.database_backups) ? backupsRes.database_backups : [],
        });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (!open) return;
    void loadAll();
  }, [open, loadAll]);

  const runJsonAction = React.useCallback(async (action: string, body: Record<string, unknown>): Promise<ISiteMaintenanceActionResult> => {
    setBusy(true);
    try {
      return await ApiClient.post(`/api/settings/site_maintenance.php?action=${encodeURIComponent(action)}`, body);
    } finally {
      setBusy(false);
    }
  }, []);

  const runFormAction = React.useCallback(async (action: string, formData: FormData): Promise<ISiteMaintenanceActionResult> => {
    setBusy(true);
    try {
      return await ApiClient.postFormData(`/api/settings/site_maintenance.php?action=${encodeURIComponent(action)}`, formData);
    } finally {
      setBusy(false);
    }
  }, []);

  const refreshBackups = React.useCallback(async () => {
    const res = await ApiClient.get('/api/settings/site_maintenance.php?action=backups_list');
    setBackups({
      website_backups: Array.isArray(res?.website_backups) ? res.website_backups : [],
      database_backups: Array.isArray(res?.database_backups) ? res.database_backups : [],
    });
    return res;
  }, []);

  const refreshStatus = React.useCallback(async () => {
    const res = await ApiClient.get('/api/settings/site_maintenance.php?action=status');
    if (res?.status) setStatus(res.status as ISiteMaintenanceStatus);
    return res;
  }, []);

  const refreshDatabase = React.useCallback(async () => {
    const res = await ApiClient.get('/api/settings/site_maintenance.php?action=database');
    if (res?.database) setDatabase(res.database as ISiteMaintenanceDatabase);
    return res;
  }, []);

  return {
    loading,
    busy,
    status,
    database,
    backups,
    loadAll,
    refreshBackups,
    refreshStatus,
    refreshDatabase,
    runJsonAction,
    runFormAction,
  };
}
