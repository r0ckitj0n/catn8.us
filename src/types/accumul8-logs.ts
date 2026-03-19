export type Accumul8LogType =
  | 'diagnostics'
  | 'entity_endex'
  | 'notifications'
  | 'statement_audits'
  | 'statement_reconciliations'
  | 'sync';

export interface Accumul8LogTypeOption {
  type: Accumul8LogType;
  label: string;
  description: string;
}

export interface Accumul8LogEntry {
  id: string;
  created_at: string;
  status: string;
  title: string;
  subtitle: string;
  body: string;
  details: string[];
  search_text: string;
}

export interface Accumul8LogListResponse {
  success: boolean;
  log_type: Accumul8LogType;
  entries: Accumul8LogEntry[];
  available_log_types: Accumul8LogTypeOption[];
}
