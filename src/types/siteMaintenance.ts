export type SiteMaintenanceTab = 'status' | 'database' | 'backups' | 'restore' | 'cleanup';

export interface ISiteMaintenancePrimaryIdentity {
  identifier: string;
  format: string;
  entity: string;
}

export interface ISiteMaintenanceQuickStats {
  total_items: number;
  total_item_images: number;
  total_orders: number;
  active_categories: number;
}

export interface ISiteMaintenanceRecentActivity {
  latest_customers: string[];
  latest_orders: string[];
}

export interface ISiteMaintenanceStatus {
  primary_identity: ISiteMaintenancePrimaryIdentity;
  quick_stats: ISiteMaintenanceQuickStats;
  recent_activity: ISiteMaintenanceRecentActivity;
}

export interface ISiteMaintenanceDbGroupRow {
  table: string;
  row_count: number;
}

export interface ISiteMaintenanceOption {
  id: string;
  label: string;
}

export interface ISiteMaintenanceDbGroup {
  id: string;
  label: string;
  rows: ISiteMaintenanceDbGroupRow[];
}

export interface ISiteMaintenanceDatabase {
  active_tables: number;
  backup_tables: number;
  groups: ISiteMaintenanceDbGroup[];
  db_group_options: ISiteMaintenanceOption[];
  image_group_options: ISiteMaintenanceOption[];
}

export interface ISiteMaintenanceBackupFile {
  path: string;
  name: string;
  size_bytes: number;
  modified_at: string;
}

export interface ISiteMaintenanceBackups {
  website_backups: ISiteMaintenanceBackupFile[];
  database_backups: ISiteMaintenanceBackupFile[];
}

export interface ISiteMaintenanceActionResult {
  success: boolean;
  message?: string;
  [key: string]: unknown;
}
