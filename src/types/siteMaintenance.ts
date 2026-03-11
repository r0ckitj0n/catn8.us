export type SiteMaintenanceTab = 'status' | 'database' | 'backups' | 'restore' | 'cleanup' | 'accumul8';

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

export interface ISiteMaintenanceAccumul8RescanRow {
  id: number;
  owner_user_id: number;
  status: string;
  original_filename: string;
  reasons?: string[];
  needs_catalog_refresh?: boolean;
  has_successful_scan?: boolean;
  last_error?: string;
  last_scanned_at?: string;
  error?: string;
  catalog_page_count?: number;
  locator_count?: number;
}

export interface ISiteMaintenanceAccumul8RescanResult {
  owner_user_id: number | null;
  dry_run: boolean;
  limit: number;
  only_missing_successful_scan: boolean;
  include_missing_catalog: boolean;
  force: boolean;
  candidate_count: number;
  scanned_count: number;
  success_count: number;
  failure_count: number;
  skipped_count: number;
  results: ISiteMaintenanceAccumul8RescanRow[];
}
