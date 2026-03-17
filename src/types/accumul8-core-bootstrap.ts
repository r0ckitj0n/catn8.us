import type {
  Accumul8Account,
  Accumul8AccessibleOwner,
  Accumul8BankConnection,
  Accumul8BankingOrganization,
  Accumul8BillItem,
  Accumul8Contact,
  Accumul8NotificationRule,
  Accumul8RecurringPayment,
  Accumul8Summary,
  Accumul8Transaction,
} from './accumul8-core';
import type {
  Accumul8BudgetRow,
  Accumul8Debtor,
  Accumul8Entity,
  Accumul8EntityAlias,
  Accumul8EntityEndexGuide,
  Accumul8EntityEndexScanLog,
} from './accumul8-core';
import type { Accumul8StatementAuditRun, Accumul8StatementUpload } from './accumul8-statements';

export interface Accumul8BootstrapResponse {
  success: boolean;
  selected_owner_user_id: number;
  accessible_account_owners: Accumul8AccessibleOwner[];
  entities: Accumul8Entity[];
  entity_aliases: Accumul8EntityAlias[];
  entity_endex_guides: Accumul8EntityEndexGuide[];
  entity_endex_scan_logs: Accumul8EntityEndexScanLog[];
  contacts: Accumul8Contact[];
  recurring_payments: Accumul8RecurringPayment[];
  transactions: Accumul8Transaction[];
  banking_organizations: Accumul8BankingOrganization[];
  accounts: Accumul8Account[];
  notification_rules: Accumul8NotificationRule[];
  pay_bills: Accumul8BillItem[];
  bank_connections: Accumul8BankConnection[];
  debtors: Accumul8Debtor[];
  debtor_ledger: Accumul8Transaction[];
  budget_rows: Accumul8BudgetRow[];
  sync_provider: {
    provider: string;
    env: string;
    configured: number;
  };
  summary: Accumul8Summary;
  statement_uploads?: Accumul8StatementUpload[];
  archived_statement_uploads?: Accumul8StatementUpload[];
  statement_audit_runs?: Accumul8StatementAuditRun[];
}
