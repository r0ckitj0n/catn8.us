import React from 'react';

import {
  Accumul8AccessibleOwner,
  Accumul8Account,
  Accumul8BankingOrganization,
  Accumul8BillItem,
  Accumul8TransactionsPagination,
  Accumul8BudgetRow,
  Accumul8Contact,
  Accumul8Debtor,
  Accumul8Entity,
  Accumul8EntityAlias,
  Accumul8EntityEndexGuide,
  Accumul8EntityEndexScanLog,
  Accumul8NotificationRule,
  Accumul8RecurringPayment,
  Accumul8StatementAuditRun,
  Accumul8StatementUpload,
  Accumul8Transaction,
} from '../../types/accumul8';

export function useAccumul8State() {
  const [busy, setBusy] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [loaded, setLoaded] = React.useState(false);
  const [statementsLoaded, setStatementsLoaded] = React.useState(false);
  const [activeOwnerUserId, setActiveOwnerUserId] = React.useState<number>(0);
  const [accessibleAccountOwners, setAccessibleAccountOwners] = React.useState<Accumul8AccessibleOwner[]>([]);
  const [summary, setSummary] = React.useState({ net_amount: 0, inflow_total: 0, outflow_total: 0, unpaid_outflow_total: 0 });
  const [entities, setEntities] = React.useState<Accumul8Entity[]>([]);
  const [entityAliases, setEntityAliases] = React.useState<Accumul8EntityAlias[]>([]);
  const [entityEndexGuides, setEntityEndexGuides] = React.useState<Accumul8EntityEndexGuide[]>([]);
  const [entityEndexScanLogs, setEntityEndexScanLogs] = React.useState<Accumul8EntityEndexScanLog[]>([]);
  const [contacts, setContacts] = React.useState<Accumul8Contact[]>([]);
  const [recurringPayments, setRecurringPayments] = React.useState<Accumul8RecurringPayment[]>([]);
  const [transactions, setTransactions] = React.useState<Accumul8Transaction[]>([]);
  const [bankingOrganizations, setBankingOrganizations] = React.useState<Accumul8BankingOrganization[]>([]);
  const [accounts, setAccounts] = React.useState<Accumul8Account[]>([]);
  const [notificationRules, setNotificationRules] = React.useState<Accumul8NotificationRule[]>([]);
  const [payBills, setPayBills] = React.useState<Accumul8BillItem[]>([]);
  const [debtors, setDebtors] = React.useState<Accumul8Debtor[]>([]);
  const [debtorLedger, setDebtorLedger] = React.useState<Accumul8Transaction[]>([]);
  const [budgetRows, setBudgetRows] = React.useState<Accumul8BudgetRow[]>([]);
  const [bankConnections, setBankConnections] = React.useState<any[]>([]);
  const [statementUploads, setStatementUploads] = React.useState<Accumul8StatementUpload[]>([]);
  const [archivedStatementUploads, setArchivedStatementUploads] = React.useState<Accumul8StatementUpload[]>([]);
  const [statementAuditRuns, setStatementAuditRuns] = React.useState<Accumul8StatementAuditRun[]>([]);
  const [transactionsPagination, setTransactionsPagination] = React.useState<Accumul8TransactionsPagination>({
    current_page: 1,
    page_size: 250,
    total_pages: 1,
    total_rows: 0,
    is_full_dataset: false,
  });
  const [syncProvider, setSyncProvider] = React.useState({ provider: 'teller', env: 'sandbox', configured: 0 });

  return React.useMemo(() => ({
    busy, setBusy,
    loading, setLoading,
    loaded, setLoaded,
    statementsLoaded, setStatementsLoaded,
    activeOwnerUserId, setActiveOwnerUserId,
    accessibleAccountOwners, setAccessibleAccountOwners,
    summary, setSummary,
    entities, setEntities,
    entityAliases, setEntityAliases,
    entityEndexGuides, setEntityEndexGuides,
    entityEndexScanLogs, setEntityEndexScanLogs,
    contacts, setContacts,
    recurringPayments, setRecurringPayments,
    transactions, setTransactions,
    bankingOrganizations, setBankingOrganizations,
    accounts, setAccounts,
    notificationRules, setNotificationRules,
    payBills, setPayBills,
    debtors, setDebtors,
    debtorLedger, setDebtorLedger,
    budgetRows, setBudgetRows,
    bankConnections, setBankConnections,
    statementUploads, setStatementUploads,
    archivedStatementUploads, setArchivedStatementUploads,
    statementAuditRuns, setStatementAuditRuns,
    transactionsPagination, setTransactionsPagination,
    syncProvider, setSyncProvider,
  }), [
    busy,
    loading,
    loaded,
    statementsLoaded,
    activeOwnerUserId,
    accessibleAccountOwners,
    summary,
    entities,
    entityAliases,
    entityEndexGuides,
    entityEndexScanLogs,
    contacts,
    recurringPayments,
    transactions,
    bankingOrganizations,
    accounts,
    notificationRules,
    payBills,
    debtors,
    debtorLedger,
    budgetRows,
    bankConnections,
    statementUploads,
    archivedStatementUploads,
    statementAuditRuns,
    transactionsPagination,
    syncProvider,
  ]);
}
