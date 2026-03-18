import React from 'react';

import { IToast } from '../../types/common';
import { SiteMaintenanceTab } from '../../types/siteMaintenance';

export const siteMaintenanceTabs: Array<{ key: SiteMaintenanceTab; label: string }> = [
  { key: 'status', label: 'System Status' },
  { key: 'database', label: 'Database' },
  { key: 'backups', label: 'Backups' },
  { key: 'restore', label: 'Restore' },
  { key: 'cleanup', label: 'Cleanup' },
  { key: 'accumul8', label: 'Accumul8' },
];

export const siteMaintenanceStatCard = (
  <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path fill="currentColor" d="M12 2 4 5v6c0 5.2 3.6 10 8 11 4.4-1 8-5.8 8-11V5l-8-3Zm0 2.1 6 2.2V11c0 4.1-2.7 8-6 9-3.3-1-6-4.9-6-9V6.3l6-2.2Z" />
  </svg>
);

export function pushSiteMaintenanceToast(
  onToast: ((toast: IToast) => void) | undefined,
  tone: IToast['tone'],
  message: string,
) {
  if (typeof onToast === 'function') {
    onToast({ tone, message });
  }
}
